import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import type { StrokeSegment, StrokePoint, LiveDrawEvent } from '../types';
import { BROADCAST_BATCH_INTERVAL } from '../constants';
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

export function useDrawingSync(config: UseDrawingSyncConfig): UseDrawingSyncReturn {
  const {
    coupleId,
    userId,
    onStrokeStart,
    onStrokeContinue,
    onStrokeEnd,
    onClearCanvas,
    onUndo,
    onRedo,
    onLoadStrokes,
  } = config;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const batchRef = useRef<{ strokeId: string; points: StrokePoint[] } | null>(null);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing strokes from DB on mount
  useEffect(() => {
    if (!coupleId) return;

    // Clear any stale strokes from a previous couple before loading
    onLoadStrokes([]);

    const loadExisting = async () => {
      const { data } = await supabase
        .from('live_draw_sessions')
        .select('strokes')
        .eq('couple_id', coupleId)
        .maybeSingle();

      if (data?.strokes) {
        onLoadStrokes(data.strokes as StrokeSegment[]);
      }
    };

    loadExisting();
  }, [coupleId]);

  // Subscribe to broadcast channel
  useEffect(() => {
    if (!coupleId || !userId) return;

    const channel = supabase.channel(`livedraw:${coupleId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'draw' }, (payload) => {
      const event = payload.payload as LiveDrawEvent;

      // Ignore own events
      if ('stroke' in event && event.stroke?.userId === userId) return;
      if ('userId' in event && event.userId === userId) return;

      switch (event.type) {
        case 'stroke_start':
          onStrokeStart(event.stroke);
          break;
        case 'stroke_continue':
          onStrokeContinue(event.strokeId, event.points);
          break;
        case 'stroke_end':
          onStrokeEnd(event.strokeId);
          break;
        case 'clear_canvas':
          onClearCanvas();
          break;
        case 'undo':
          onUndo(event.strokeId);
          break;
        case 'redo':
          // For redo, we'd need the full stroke - handled via DB sync
          break;
      }
    });

    channel.subscribe();

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }
    };
  }, [coupleId, userId]);

  const send = useCallback(
    (event: LiveDrawEvent) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'draw',
        payload: event,
      });
    },
    []
  );

  const broadcastStrokeStart = useCallback(
    (stroke: StrokeSegment) => {
      send({ type: 'stroke_start', stroke });
    },
    [send]
  );

  const broadcastStrokeContinue = useCallback(
    (strokeId: string, points: StrokePoint[]) => {
      // Batch points to reduce traffic
      if (!batchRef.current || batchRef.current.strokeId !== strokeId) {
        batchRef.current = { strokeId, points: [...points] };
      } else {
        batchRef.current.points.push(...points);
      }

      if (!batchTimerRef.current) {
        batchTimerRef.current = setInterval(() => {
          if (batchRef.current && batchRef.current.points.length > 0) {
            send({
              type: 'stroke_continue',
              strokeId: batchRef.current.strokeId,
              points: batchRef.current.points,
            });
            batchRef.current.points = [];
          }
        }, BROADCAST_BATCH_INTERVAL);
      }
    },
    [send]
  );

  const broadcastStrokeEnd = useCallback(
    (strokeId: string) => {
      // Flush remaining batch
      if (batchRef.current && batchRef.current.points.length > 0) {
        send({
          type: 'stroke_continue',
          strokeId: batchRef.current.strokeId,
          points: batchRef.current.points,
        });
      }
      batchRef.current = null;
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      send({ type: 'stroke_end', strokeId });
    },
    [send]
  );

  const broadcastClearCanvas = useCallback(() => {
    if (!userId) return;
    send({ type: 'clear_canvas', userId });
  }, [send, userId]);

  const broadcastUndo = useCallback(
    (strokeId: string) => {
      if (!userId) return;
      send({ type: 'undo', userId, strokeId });
    },
    [send, userId]
  );

  const broadcastRedo = useCallback(
    (stroke: StrokeSegment) => {
      // Send full stroke so partner can restore it
      send({ type: 'stroke_start', stroke });
    },
    [send]
  );

  const persistStrokes = useCallback(
    async (strokes: StrokeSegment[]) => {
      await supabase
        .from('live_draw_sessions')
        .upsert(
          {
            couple_id: coupleId,
            strokes: strokes as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'couple_id' }
        );

      // Update home screen widget with latest drawing
      updateWidget(strokes);
    },
    [coupleId]
  );

  return {
    broadcastStrokeStart,
    broadcastStrokeContinue,
    broadcastStrokeEnd,
    broadcastClearCanvas,
    broadcastUndo,
    broadcastRedo,
    persistStrokes,
  };
}
