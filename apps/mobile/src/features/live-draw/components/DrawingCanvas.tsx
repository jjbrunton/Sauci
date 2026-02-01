import React, { useMemo, useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { StrokeSegment, StrokePoint } from '../types';
import { CANVAS_BACKGROUND } from '../constants';

export interface DrawingCanvasHandle {
  startStroke: (stroke: StrokeSegment) => void;
  addPoint: (point: StrokePoint) => void;
  endStroke: () => StrokeSegment | null;
}

interface DrawingCanvasProps {
  strokes: StrokeSegment[];
  canvasWidth: number;
  canvasHeight: number;
  onTouchStart: (point: StrokePoint) => void;
  onTouchMove: (point: StrokePoint) => void;
  onTouchEnd: () => void;
  onCanvasReady?: (makeSnapshot: () => SkImage | null) => void;
}

function buildPath(points: StrokePoint[], width: number, height: number) {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;

  const first = points[0];
  path.moveTo(first.x * width, first.y * height);

  if (points.length === 1) {
    path.lineTo(first.x * width + 0.1, first.y * height + 0.1);
    return path;
  }

  // Quadratic bezier smoothing
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = ((prev.x + curr.x) / 2) * width;
    const midY = ((prev.y + curr.y) / 2) * height;

    if (i === 1) {
      path.lineTo(midX, midY);
    } else {
      path.quadTo(prev.x * width, prev.y * height, midX, midY);
    }
  }

  const last = points[points.length - 1];
  path.lineTo(last.x * width, last.y * height);

  return path;
}

const StrokePath = React.memo(function StrokePath({
  stroke,
  canvasWidth,
  canvasHeight,
}: {
  stroke: StrokeSegment;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const path = useMemo(
    () => buildPath(stroke.points, canvasWidth, canvasHeight),
    [stroke.points, canvasWidth, canvasHeight]
  );

  return (
    <Path
      path={path}
      color={stroke.isEraser ? CANVAS_BACKGROUND : stroke.color}
      style="stroke"
      strokeWidth={stroke.width}
      strokeCap="round"
      strokeJoin="round"
    />
  );
});

// Renders the in-progress stroke from a ref, re-rendered only via rafTick
const CurrentStrokePath = React.memo(function CurrentStrokePath({
  strokeRef,
  canvasWidth,
  canvasHeight,
  _tick,
}: {
  strokeRef: React.RefObject<StrokeSegment | null>;
  canvasWidth: number;
  canvasHeight: number;
  _tick: number; // forces re-render at RAF cadence
}) {
  const stroke = strokeRef.current;
  if (!stroke) return null;

  const path = buildPath(stroke.points, canvasWidth, canvasHeight);

  return (
    <Path
      path={path}
      color={stroke.isEraser ? CANVAS_BACKGROUND : stroke.color}
      style="stroke"
      strokeWidth={stroke.width}
      strokeCap="round"
      strokeJoin="round"
    />
  );
});

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    {
      strokes,
      canvasWidth,
      canvasHeight,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onCanvasReady,
    },
    ref
  ) {
    const canvasRef = useRef<any>(null);
    const currentStrokeRef = useRef<StrokeSegment | null>(null);
    const rafScheduled = useRef(false);
    const [rafTick, setRafTick] = useState(0);

    useEffect(() => {
      if (onCanvasReady) {
        onCanvasReady(() => {
          return canvasRef.current?.makeImageSnapshot() ?? null;
        });
      }
    }, [onCanvasReady]);

    const scheduleRafUpdate = useCallback(() => {
      if (rafScheduled.current) return;
      rafScheduled.current = true;
      requestAnimationFrame(() => {
        rafScheduled.current = false;
        setRafTick((t) => t + 1);
      });
    }, []);

    useImperativeHandle(ref, () => ({
      startStroke(stroke: StrokeSegment) {
        currentStrokeRef.current = stroke;
        scheduleRafUpdate();
      },
      addPoint(point: StrokePoint) {
        const s = currentStrokeRef.current;
        if (!s) return;
        // Mutate in place — no React state involved
        s.points.push(point);
        scheduleRafUpdate();
      },
      endStroke(): StrokeSegment | null {
        const s = currentStrokeRef.current;
        currentStrokeRef.current = null;
        scheduleRafUpdate();
        return s;
      },
    }), [scheduleRafUpdate]);

    const pan = Gesture.Pan()
      .minDistance(0)
      .onStart((e) => {
        runOnJS(onTouchStart)({
          x: e.x / canvasWidth,
          y: e.y / canvasHeight,
        });
      })
      .onUpdate((e) => {
        runOnJS(onTouchMove)({
          x: e.x / canvasWidth,
          y: e.y / canvasHeight,
        });
      })
      .onEnd(() => {
        runOnJS(onTouchEnd)();
      });

    return (
      <GestureDetector gesture={pan}>
        <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]}>
          <Canvas ref={canvasRef} style={styles.canvas}>
            {strokes.map((stroke) => (
              <StrokePath
                key={stroke.id}
                stroke={stroke}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            ))}
            <CurrentStrokePath
              strokeRef={currentStrokeRef}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              _tick={rafTick}
            />
          </Canvas>
        </View>
      </GestureDetector>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: CANVAS_BACKGROUND,
    borderRadius: 12,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
});
