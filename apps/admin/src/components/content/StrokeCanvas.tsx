import { useEffect, useRef } from 'react';

export interface StrokePoint {
    x: number;
    y: number;
}

export interface StrokeSegment {
    id: string;
    userId: string;
    points: StrokePoint[];
    color: string;
    width: number;
    timestamp: number;
    isEraser: boolean;
}

export const STROKE_CANVAS_BACKGROUND = '#1a1a2e';

/**
 * Renders a `live_draw_sessions.strokes` array to a canvas. Points are stored
 * as 0..1 fractions of the drawing surface, so this scales to whatever size
 * the canvas element is laid out at.
 */
export function StrokeCanvas({ strokes }: { strokes: StrokeSegment[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = STROKE_CANVAS_BACKGROUND;
        ctx.fillRect(0, 0, w, h);

        for (const stroke of strokes) {
            if (stroke.points.length === 0) continue;
            ctx.strokeStyle = stroke.isEraser ? STROKE_CANVAS_BACKGROUND : stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            const first = stroke.points[0];
            ctx.moveTo(first.x * w, first.y * h);

            if (stroke.points.length === 1) {
                ctx.lineTo(first.x * w + 0.1, first.y * h + 0.1);
            } else {
                for (let i = 1; i < stroke.points.length; i++) {
                    const prev = stroke.points[i - 1];
                    const curr = stroke.points[i];
                    const midX = ((prev.x + curr.x) / 2) * w;
                    const midY = ((prev.y + curr.y) / 2) * h;

                    if (i === 1) {
                        ctx.lineTo(midX, midY);
                    } else {
                        ctx.quadraticCurveTo(prev.x * w, prev.y * h, midX, midY);
                    }
                }
                const last = stroke.points[stroke.points.length - 1];
                ctx.lineTo(last.x * w, last.y * h);
            }
            ctx.stroke();
        }
    }, [strokes]);

    return (
        <div className="rounded-xl overflow-hidden border" style={{ background: STROKE_CANVAS_BACKGROUND }}>
            <canvas
                ref={canvasRef}
                style={{ width: '100%', aspectRatio: '4/3', display: 'block' }}
            />
        </div>
    );
}
