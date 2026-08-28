import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ApiError } from '../../../lib/apiClient';
import { appDataApi, type LiveDrawState } from '../../../lib/appDataApi';
import type { StrokeSegment, StrokePoint } from '../types';
import { updateWidget } from '../utils/widgetBridge';

interface UseDrawingSyncConfig {
  coupleId: string;
  userId: string | undefined;
  onStrokeStart: (stroke: StrokeSegment) => void;
  onStrokeContinue: (strokeId: string, points: StrokePoint[]) => void;
  onStrokeEnd: (strokeId: string) => void;
  onClearCanvas: () => void;
  onUndo: (strokeId: string) => void;
  onRedo: (stroke: StrokeSegment) => void;
  onLoadStrokes: (strokes: StrokeSegment[]) => void;
}

interface UseDrawingSyncReturn {
  beginLocalStroke: (stroke: StrokeSegment) => void;
  appendLocalPoint: (point: StrokePoint) => void;
  endLocalStroke: (stroke: StrokeSegment) => Promise<void>;
  broadcastClearCanvas: () => void;
  broadcastUndo: (strokeId: string) => void;
  broadcastRedo: (stroke: StrokeSegment) => void;
  persistStrokes: (strokes: StrokeSegment[]) => Promise<void>;
}

function conflictState(error: unknown): LiveDrawState | null {
  if (!(error instanceof ApiError) || error.status !== 409 || typeof error.details !== 'object' || error.details === null) return null;
  const state = (error.details as { current_state?: LiveDrawState }).current_state;
  return state && Array.isArray(state.strokes) && Number.isInteger(state.revision) ? state : null;
}

// Keeps the position of the first occurrence (stable z-order) but the value of
// the last (the most complete copy of a stroke that was persisted mid-draw).
export function dedupeById(strokes: StrokeSegment[]): StrokeSegment[] {
  const byId = new Map<string, StrokeSegment>();
  for (const stroke of strokes) byId.set(stroke.id, stroke);
  return [...byId.values()];
}

export function mergeDrawingChanges(base: StrokeSegment[], desired: StrokeSegment[], current: StrokeSegment[]): StrokeSegment[] {
  const desiredById = new Map(desired.map(stroke => [stroke.id, stroke]));
  const desiredIds = new Set(desiredById.keys());
  const removedIds = new Set(base.filter(stroke => !desiredIds.has(stroke.id)).map(stroke => stroke.id));
  const currentIds = new Set(current.map(stroke => stroke.id));
  const merged = current
    .filter(stroke => !removedIds.has(stroke.id))
    .map(stroke => desiredById.get(stroke.id) ?? stroke);
  return dedupeById([...merged, ...desired.filter(stroke => !currentIds.has(stroke.id))]);
}

export function useDrawingSync(config: UseDrawingSyncConfig): UseDrawingSyncReturn {
  const { coupleId, userId, onLoadStrokes } = config;
  const revisionRef = useRef(0);
  const baselineRef = useRef<StrokeSegment[]>([]);
  const workingRef = useRef<StrokeSegment[]>([]);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWritesRef = useRef(0);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The stroke currently under the finger. Owned here and mutated in place so a
  // touch move costs a push, not a rebuild of every stroke on the canvas.
  const localStrokeRef = useRef<StrokeSegment | null>(null);
  const onLoadStrokesRef = useRef(onLoadStrokes);
  onLoadStrokesRef.current = onLoadStrokes;

  // workingRef never holds the in-progress stroke; compose it in only when we
  // are about to send, so the O(n) copy happens once per write, not per point.
  const composeWorking = useCallback((): StrokeSegment[] => {
    const local = localStrokeRef.current;
    if (!local) return workingRef.current;
    return dedupeById([
      ...workingRef.current,
      { ...local, points: [...local.points] },
    ]);
  }, []);

  const acceptState = useCallback((state: LiveDrawState) => {
    revisionRef.current = state.revision;
    baselineRef.current = state.strokes;

    const local = localStrokeRef.current;
    if (local) {
      // Mid-stroke: adopt the remote strokes for the next write, but do NOT
      // push them into React state. The server's copy of the stroke under the
      // finger is always behind it, and handing it to setStrokes is what makes
      // the line snap backwards while drawing.
      workingRef.current = state.strokes.filter(stroke => stroke.id !== local.id);
      return;
    }

    workingRef.current = state.strokes;
    onLoadStrokesRef.current(state.strokes);
  }, []);

  const writeSnapshot = useCallback(async (desired: StrokeSegment[]) => {
    const base = baselineRef.current;
    try {
      acceptState(await appDataApi.putLiveDraw(desired, revisionRef.current));
    } catch (error) {
      const current = conflictState(error);
      if (!current) throw error;
      const merged = mergeDrawingChanges(base, desired, current.strokes);
      acceptState(await appDataApi.putLiveDraw(merged, current.revision));
    }
    updateWidget(composeWorking());
  }, [acceptState, composeWorking]);

  const enqueueWrite = useCallback((strokes: StrokeSegment[]): Promise<void> => {
    const desired = dedupeById(strokes);
    workingRef.current = desired.filter(stroke => stroke.id !== localStrokeRef.current?.id);
    pendingWritesRef.current += 1;
    const next = writeQueueRef.current.then(() => writeSnapshot(desired));
    writeQueueRef.current = next.catch(error => { console.error('Failed to persist live drawing:', error); });
    return next.finally(() => { pendingWritesRef.current -= 1; });
  }, [writeSnapshot]);

  // Throttled: reads the latest state at fire time rather than capturing a
  // freshly built array on every call.
  const scheduleWrite = useCallback(() => {
    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      void enqueueWrite(composeWorking());
    }, 250);
  }, [enqueueWrite, composeWorking]);

  useEffect(() => {
    if (!coupleId) return;
    onLoadStrokesRef.current([]);
    void appDataApi.getLiveDraw().then(acceptState).catch(error => console.error('Failed to load live drawing:', error));
  }, [coupleId, acceptState]);

  useEffect(() => {
    if (!coupleId || !userId) return;
    let cancelled = false;
    const poll = async () => {
      if (pendingWritesRef.current > 0) return;
      try {
        const state = await appDataApi.getLiveDraw();
        if (!cancelled && state.revision > revisionRef.current) acceptState(state);
      } catch (error) { console.error('Failed to poll live drawing:', error); }
    };
    const timer = setInterval(() => void poll(), 750);
    return () => { cancelled = true; clearInterval(timer); if (throttleRef.current) clearTimeout(throttleRef.current); };
  }, [coupleId, userId, acceptState]);

  const persistStrokes = useCallback((strokes: StrokeSegment[]) => {
    if (throttleRef.current) clearTimeout(throttleRef.current);
    throttleRef.current = null;
    return enqueueWrite(strokes);
  }, [enqueueWrite]);

  const beginLocalStroke = useCallback((stroke: StrokeSegment) => {
    localStrokeRef.current = { ...stroke, points: [...stroke.points] };
    workingRef.current = workingRef.current.filter(item => item.id !== stroke.id);
    scheduleWrite();
  }, [scheduleWrite]);

  const appendLocalPoint = useCallback((point: StrokePoint) => {
    localStrokeRef.current?.points.push(point);
    scheduleWrite();
  }, [scheduleWrite]);

  const endLocalStroke = useCallback((stroke: StrokeSegment) => {
    localStrokeRef.current = null;
    // dedupeById drops the truncated copy the mid-draw writes left behind.
    return persistStrokes([...workingRef.current, stroke]);
  }, [persistStrokes]);

  const broadcastClearCanvas = useCallback(() => {
    localStrokeRef.current = null;
    workingRef.current = [];
  }, []);
  const broadcastUndo = useCallback((strokeId: string) => { workingRef.current = workingRef.current.filter(stroke => stroke.id !== strokeId); }, []);
  const broadcastRedo = useCallback((stroke: StrokeSegment) => { workingRef.current = dedupeById([...workingRef.current, stroke]); }, []);

  // Stable identity: the screen's touch handlers depend on this object, and a
  // new one every render rebuilt the pan gesture mid-stroke.
  return useMemo(() => ({
    beginLocalStroke,
    appendLocalPoint,
    endLocalStroke,
    broadcastClearCanvas,
    broadcastUndo,
    broadcastRedo,
    persistStrokes,
  }), [beginLocalStroke, appendLocalPoint, endLocalStroke, broadcastClearCanvas, broadcastUndo, broadcastRedo, persistStrokes]);
}
