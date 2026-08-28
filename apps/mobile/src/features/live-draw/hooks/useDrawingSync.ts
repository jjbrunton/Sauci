import { useCallback, useEffect, useRef } from 'react';
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
  broadcastStrokeStart: (stroke: StrokeSegment) => void;
  broadcastStrokeContinue: (strokeId: string, points: StrokePoint[]) => void;
  broadcastStrokeEnd: (strokeId: string) => void;
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

export function mergeDrawingChanges(base: StrokeSegment[], desired: StrokeSegment[], current: StrokeSegment[]): StrokeSegment[] {
  const desiredById = new Map(desired.map(stroke => [stroke.id, stroke]));
  const desiredIds = new Set(desiredById.keys());
  const removedIds = new Set(base.filter(stroke => !desiredIds.has(stroke.id)).map(stroke => stroke.id));
  const currentIds = new Set(current.map(stroke => stroke.id));
  const merged = current
    .filter(stroke => !removedIds.has(stroke.id))
    .map(stroke => desiredById.get(stroke.id) ?? stroke);
  return [...merged, ...desired.filter(stroke => !currentIds.has(stroke.id))];
}

export function useDrawingSync(config: UseDrawingSyncConfig): UseDrawingSyncReturn {
  const { coupleId, userId, onLoadStrokes } = config;
  const revisionRef = useRef(0);
  const baselineRef = useRef<StrokeSegment[]>([]);
  const workingRef = useRef<StrokeSegment[]>([]);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWritesRef = useRef(0);
  const throttleRef = useRef<NodeJS.Timeout | null>(null);
  const onLoadStrokesRef = useRef(onLoadStrokes);
  onLoadStrokesRef.current = onLoadStrokes;

  const acceptState = useCallback((state: LiveDrawState) => {
    revisionRef.current = state.revision;
    baselineRef.current = state.strokes;
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
    updateWidget(workingRef.current);
  }, [acceptState]);

  const enqueueWrite = useCallback((strokes: StrokeSegment[]): Promise<void> => {
    workingRef.current = strokes;
    pendingWritesRef.current += 1;
    const next = writeQueueRef.current.then(() => writeSnapshot(strokes));
    writeQueueRef.current = next.catch(error => { console.error('Failed to persist live drawing:', error); });
    return next.finally(() => { pendingWritesRef.current -= 1; });
  }, [writeSnapshot]);

  const scheduleWrite = useCallback((strokes: StrokeSegment[]) => {
    workingRef.current = strokes;
    if (!throttleRef.current) {
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
        void enqueueWrite(workingRef.current);
      }, 250);
    }
  }, [enqueueWrite]);

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

  const broadcastStrokeStart = useCallback((stroke: StrokeSegment) => {
    scheduleWrite([...workingRef.current.filter(item => item.id !== stroke.id), stroke]);
  }, [scheduleWrite]);
  const broadcastStrokeContinue = useCallback((strokeId: string, points: StrokePoint[]) => {
    scheduleWrite(workingRef.current.map(stroke => stroke.id === strokeId ? { ...stroke, points: [...stroke.points, ...points] } : stroke));
  }, [scheduleWrite]);
  const broadcastStrokeEnd = useCallback((_strokeId: string) => undefined, []);
  const broadcastClearCanvas = useCallback(() => { workingRef.current = []; }, []);
  const broadcastUndo = useCallback((strokeId: string) => { workingRef.current = workingRef.current.filter(stroke => stroke.id !== strokeId); }, []);
  const broadcastRedo = useCallback((stroke: StrokeSegment) => { workingRef.current = [...workingRef.current.filter(item => item.id !== stroke.id), stroke]; }, []);
  const persistStrokes = useCallback((strokes: StrokeSegment[]) => {
    if (throttleRef.current) clearTimeout(throttleRef.current);
    throttleRef.current = null;
    return enqueueWrite(strokes);
  }, [enqueueWrite]);

  return { broadcastStrokeStart, broadcastStrokeContinue, broadcastStrokeEnd, broadcastClearCanvas, broadcastUndo, broadcastRedo, persistStrokes };
}
