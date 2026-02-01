// Normalized coordinates (0-1) for cross-device compatibility
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

// Broadcast events (real-time when both online)
export type LiveDrawEvent =
  | { type: 'stroke_start'; stroke: StrokeSegment }
  | { type: 'stroke_continue'; strokeId: string; points: StrokePoint[] }
  | { type: 'stroke_end'; strokeId: string }
  | { type: 'clear_canvas'; userId: string }
  | { type: 'undo'; userId: string; strokeId: string }
  | { type: 'redo'; userId: string; strokeId: string };
