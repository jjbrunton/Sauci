import { useState, useCallback, useRef } from 'react';
import type { StrokeSegment } from '../types';

interface UseDrawingHistoryReturn {
  strokes: StrokeSegment[];
  setStrokes: React.Dispatch<React.SetStateAction<StrokeSegment[]>>;
  addStroke: (stroke: StrokeSegment) => void;
  updateStroke: (strokeId: string, points: StrokeSegment['points']) => void;
  undo: (userId: string) => StrokeSegment | undefined;
  redo: (userId: string) => StrokeSegment | undefined;
  canUndo: (userId: string) => boolean;
  canRedo: (userId: string) => boolean;
  clearAll: () => void;
}

export function useDrawingHistory(): UseDrawingHistoryReturn {
  const [strokes, setStrokes] = useState<StrokeSegment[]>([]);
  const redoStackRef = useRef<StrokeSegment[]>([]);

  const addStroke = useCallback((stroke: StrokeSegment) => {
    setStrokes((prev) => [...prev, stroke]);
    // Clear redo stack when new stroke is added
    redoStackRef.current = [];
  }, []);

  const updateStroke = useCallback(
    (strokeId: string, points: StrokeSegment['points']) => {
      setStrokes((prev) =>
        prev.map((s) =>
          s.id === strokeId ? { ...s, points: [...s.points, ...points] } : s
        )
      );
    },
    []
  );

  const undo = useCallback(
    (userId: string): StrokeSegment | undefined => {
      let removed: StrokeSegment | undefined;
      setStrokes((prev) => {
        // Find last stroke by this user
        const idx = [...prev].reverse().findIndex((s) => s.userId === userId);
        if (idx === -1) return prev;
        const actualIdx = prev.length - 1 - idx;
        removed = prev[actualIdx];
        redoStackRef.current.push(removed);
        return [...prev.slice(0, actualIdx), ...prev.slice(actualIdx + 1)];
      });
      return removed;
    },
    []
  );

  const redo = useCallback(
    (userId: string): StrokeSegment | undefined => {
      // Find last redo entry for this user
      const idx = [...redoStackRef.current]
        .reverse()
        .findIndex((s) => s.userId === userId);
      if (idx === -1) return undefined;
      const actualIdx = redoStackRef.current.length - 1 - idx;
      const stroke = redoStackRef.current[actualIdx];
      redoStackRef.current.splice(actualIdx, 1);
      setStrokes((prev) => [...prev, stroke]);
      return stroke;
    },
    []
  );

  const canUndo = useCallback(
    (userId: string) => strokes.some((s) => s.userId === userId),
    [strokes]
  );

  const canRedo = useCallback(
    (userId: string) =>
      redoStackRef.current.some((s) => s.userId === userId),
    []
  );

  const clearAll = useCallback(() => {
    setStrokes([]);
    redoStackRef.current = [];
  }, []);

  return {
    strokes,
    setStrokes,
    addStroke,
    updateStroke,
    undo,
    redo,
    canUndo,
    canRedo,
    clearAll,
  };
}
