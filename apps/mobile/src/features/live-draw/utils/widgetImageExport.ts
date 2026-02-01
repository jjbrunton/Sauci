import { Skia, StrokeCap, StrokeJoin, PaintStyle } from '@shopify/react-native-skia';
import type { StrokeSegment, StrokePoint } from '../types';
import { CANVAS_BACKGROUND } from '../constants';

const WIDGET_WIDTH = 300;
const WIDGET_HEIGHT = 250;

function buildPath(points: StrokePoint[], width: number, height: number) {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;

  const first = points[0];
  path.moveTo(first.x * width, first.y * height);

  if (points.length === 1) {
    path.lineTo(first.x * width + 0.1, first.y * height + 0.1);
    return path;
  }

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

export function renderStrokesToBase64(strokes: StrokeSegment[]): string | null {
  const surface = Skia.Surface.Make(WIDGET_WIDTH, WIDGET_HEIGHT);
  if (!surface) return null;

  const canvas = surface.getCanvas();

  // Draw background
  const bgPaint = Skia.Paint();
  bgPaint.setColor(Skia.Color(CANVAS_BACKGROUND));
  canvas.drawRect(
    { x: 0, y: 0, width: WIDGET_WIDTH, height: WIDGET_HEIGHT },
    bgPaint,
  );

  // Draw strokes
  for (const stroke of strokes) {
    const path = buildPath(stroke.points, WIDGET_WIDTH, WIDGET_HEIGHT);
    const paint = Skia.Paint();
    paint.setColor(
      Skia.Color(stroke.isEraser ? CANVAS_BACKGROUND : stroke.color),
    );
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(stroke.width);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    canvas.drawPath(path, paint);
  }

  surface.flush();
  const image = surface.makeImageSnapshot();
  const data = image.encodeToBase64();
  return data;
}
