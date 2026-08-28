import React, { useMemo, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import type { SkImage, SkPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import type { StrokeSegment, StrokePoint } from '../types';
import { CANVAS_BACKGROUND } from '../constants';

export interface DrawingCanvasHandle {
  /** Drops the in-progress stroke rendered on the UI thread. */
  clearLiveStroke: () => void;
}

interface DrawingCanvasProps {
  strokes: StrokeSegment[];
  canvasWidth: number;
  canvasHeight: number;
  strokeColor: string;
  strokeWidth: number;
  isEraser: boolean;
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

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    {
      strokes,
      canvasWidth,
      canvasHeight,
      strokeColor,
      strokeWidth,
      isEraser,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onCanvasReady,
    },
    ref
  ) {
    const canvasRef = useRef<any>(null);

    // The in-progress stroke lives entirely on the UI thread: the pan gesture
    // extends the path in place, so ink never waits on the JS thread.
    const livePath = useSharedValue<SkPath | null>(null);
    const livePrev = useSharedValue<StrokePoint | null>(null);
    // Doubles as the invalidation signal: the path is mutated in place, so this
    // counter is what tells the derived value to re-read it.
    const livePointCount = useSharedValue(0);

    const liveColor = isEraser ? CANVAS_BACKGROUND : strokeColor;

    // Re-derived once per frame that the path changed — not once per point.
    const renderedLivePath = useDerivedValue(() => {
      const count = livePointCount.value;
      const path = livePath.value;
      return count > 0 && path ? path.copy() : Skia.Path.Make();
    });

    useEffect(() => {
      if (onCanvasReady) {
        onCanvasReady(() => {
          return canvasRef.current?.makeImageSnapshot() ?? null;
        });
      }
    }, [onCanvasReady]);

    useImperativeHandle(ref, () => ({
      clearLiveStroke() {
        livePath.value = null;
        livePrev.value = null;
        livePointCount.value = 0;
      },
    }), [livePath, livePrev, livePointCount]);

    const pan = useMemo(
      () =>
        Gesture.Pan()
          .minDistance(0)
          .onStart((e) => {
            'worklet';
            const path = Skia.Path.Make();
            path.moveTo(e.x, e.y);
            livePath.value = path;
            livePrev.value = { x: e.x, y: e.y };
            livePointCount.value = 1;
            runOnJS(onTouchStart)({ x: e.x / canvasWidth, y: e.y / canvasHeight });
          })
          .onUpdate((e) => {
            'worklet';
            const path = livePath.value;
            const prev = livePrev.value;
            if (path && prev) {
              // Same quadratic smoothing as buildPath, applied incrementally.
              const midX = (prev.x + e.x) / 2;
              const midY = (prev.y + e.y) / 2;
              if (livePointCount.value === 1) {
                path.lineTo(midX, midY);
              } else {
                path.quadTo(prev.x, prev.y, midX, midY);
              }
              livePrev.value = { x: e.x, y: e.y };
              livePointCount.value += 1;
            }
            runOnJS(onTouchMove)({ x: e.x / canvasWidth, y: e.y / canvasHeight });
          })
          .onEnd(() => {
            'worklet';
            const path = livePath.value;
            const prev = livePrev.value;
            if (path && prev) {
              // Close the half-segment the incremental midpoints leave at the tip.
              path.lineTo(prev.x, prev.y);
              livePointCount.value += 1;
            }
            runOnJS(onTouchEnd)();
          }),
      [
        canvasWidth,
        canvasHeight,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        livePath,
        livePrev,
        livePointCount,
      ]
    );

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
            <Path
              path={renderedLivePath}
              color={liveColor}
              style="stroke"
              strokeWidth={strokeWidth}
              strokeCap="round"
              strokeJoin="round"
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
