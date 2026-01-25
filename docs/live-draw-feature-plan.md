# Live Draw Feature - Implementation Plan

## Overview

Add a real-time collaborative drawing canvas where both partners can draw together and see each other's strokes live. Supports async drawing - one partner can draw and the other sees strokes when they open it later. Entry point from the chat media menu.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Canvas library | `@shopify/react-native-skia` | High-performance Skia engine, great gesture integration, cross-platform |
| Real-time sync | Supabase Broadcast + DB persistence | Broadcast for live updates, DB for async support |
| State persistence | `live_draw_sessions` table | Store current canvas state per match for async viewing |
| Entry point | Chat media menu | Contextual to match, natural extension of chat |
| Storage | Existing `chat-media` bucket | Save completed drawings as PNG images to chat |

## File Structure

### New Files
```
apps/mobile/src/features/live-draw/
├── index.ts
├── LiveDrawScreen.tsx           # Main screen
├── components/
│   ├── DrawingCanvas.tsx        # Skia canvas + gesture handling
│   ├── DrawingToolbar.tsx       # Sliders for thickness/color, eraser, undo/redo
│   ├── ThicknessSlider.tsx      # Custom slider for brush thickness (2-24px)
│   ├── ColorSlider.tsx          # Hue slider for color selection
│   └── PartnerCursor.tsx        # Shows partner's position
├── hooks/
│   ├── useDrawingSync.ts        # Broadcast sync + DB persistence
│   ├── useDrawingHistory.ts     # Undo/redo stack management
│   └── useCanvasCapture.ts      # Capture canvas as image
├── types.ts
└── constants.ts

apps/mobile/app/(app)/live-draw/
└── [matchId].tsx                # Route file

apps/supabase/migrations/
└── YYYYMMDDHHMMSS_add_live_draw_sessions.sql  # New table for canvas state
```

### Files to Modify
- `apps/mobile/package.json` - Add `@shopify/react-native-skia`
- `apps/mobile/src/features/chat/components/InputBar.tsx` - Add brush icon (4th media menu item)
- `apps/mobile/src/features/chat/ChatScreen.tsx` - Add `onOpenLiveDraw` handler
- `apps/mobile/app/(app)/_layout.tsx` - Register hidden `live-draw/[matchId]` route

## Database Schema

```sql
-- New table for persisting canvas state (async support)
CREATE TABLE live_draw_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  strokes JSONB NOT NULL DEFAULT '[]',  -- Array of StrokeSegment
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id)  -- One session per match
);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE live_draw_sessions;

-- RLS: Only couple members can access their match's drawing
CREATE POLICY "Users can view own couple drawings"
  ON live_draw_sessions FOR SELECT
  USING (match_id IN (
    SELECT id FROM matches WHERE couple_id = get_auth_user_couple_id()
  ));

CREATE POLICY "Users can update own couple drawings"
  ON live_draw_sessions FOR ALL
  USING (match_id IN (
    SELECT id FROM matches WHERE couple_id = get_auth_user_couple_id()
  ));
```

## Data Structures

```typescript
// Normalized coordinates (0-1) for cross-device compatibility
interface StrokePoint { x: number; y: number; }

interface StrokeSegment {
  id: string;
  userId: string;
  points: StrokePoint[];
  color: string;       // HSL string from color slider
  width: number;       // 2-24px from thickness slider
  timestamp: number;
  isEraser: boolean;   // If true, renders as white/background color
}

// Broadcast events (real-time when both online)
type LiveDrawEvent =
  | { type: 'stroke_start'; stroke: StrokeSegment }
  | { type: 'stroke_continue'; strokeId: string; points: StrokePoint[] }
  | { type: 'stroke_end'; strokeId: string }
  | { type: 'clear_canvas'; userId: string }
  | { type: 'undo'; userId: string; strokeId: string }
  | { type: 'redo'; userId: string; strokeId: string };
```

## Implementation Phases

### Phase 1: Setup & Database
1. Create migration for `live_draw_sessions` table
2. Install `@shopify/react-native-skia`
3. Run `pod install` for iOS
4. Create feature folder structure

### Phase 2: Drawing Canvas
- Skia `Canvas` with `Path` components for each stroke
- `GestureDetector` from react-native-gesture-handler for touch
- Quadratic bezier path smoothing for natural strokes
- Normalized coordinates for different screen sizes

### Phase 3: Toolbar with Sliders
- **ThicknessSlider**: Horizontal slider (2-24px range), shows preview circle
- **ColorSlider**: Hue slider (0-360°), displays current color
- **Eraser toggle**: Button that switches to eraser mode
- **Undo/Redo buttons**: Stack-based history (own strokes only)
- **Clear canvas**: With confirmation alert

### Phase 4: Real-time Sync + Persistence
- Channel: `livedraw:${matchId}` for broadcast
- Batch points every 50ms (reduces traffic ~80%)
- On stroke end: Update `live_draw_sessions` table
- On screen open: Load existing strokes from DB
- Subscribe to `live_draw_sessions` changes for async updates

### Phase 5: Undo/Redo System
- `useDrawingHistory` hook manages undo/redo stacks
- Track own strokes separately from partner strokes
- Undo removes last own stroke, adds to redo stack
- Redo restores from redo stack
- Clear redo stack when new stroke added

### Phase 6: Save & Send
- Capture canvas as PNG via Skia's `makeImageFromView`
- Upload to `chat-media` bucket: `{match_id}/livedraw_{timestamp}.png`
- Insert message with `media_type: 'image'`
- Clear `live_draw_sessions` for this match (optional - could keep for "continue drawing")
- Navigate back to chat

### Phase 7: Chat Integration
- Add brush icon to InputBar media menu
- Update menu width animation: 132px → 176px (4 items)
- Wire navigation: `router.push(\`/(app)/live-draw/${matchId}\`)`

## Feature Colors

- User strokes: Primary `#e94560`
- Partner strokes: Secondary `#9b59b6`
- Feature accent: Teal `#14B8A6`

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Partner disconnects | Continue drawing, strokes persist in DB for when they return |
| Connection lost | "Reconnecting..." overlay, queue strokes locally, sync on reconnect |
| Partner not in canvas | Strokes saved to DB, they see when they open |
| Both save simultaneously | Either can save, creates two messages (fine) |
| Canvas too large | Limit to ~500 strokes, prompt to save and start fresh |

## Database Changes Required

- New `live_draw_sessions` table (see schema above)
- Migration file: `apps/supabase/migrations/YYYYMMDDHHMMSS_add_live_draw_sessions.sql`
- Add to realtime publication
- RLS policies for couple isolation

## Key Reference Files

These existing files should be referenced during implementation:

- `apps/mobile/src/hooks/useTypingIndicator.ts` - Pattern for Supabase Broadcast real-time sync
- `apps/mobile/src/features/chat/ChatScreen.tsx` - Parent screen pattern and navigation integration
- `apps/mobile/src/features/chat/components/InputBar.tsx` - Entry point for brush icon
- `apps/mobile/src/theme/index.ts` - Design tokens for consistent styling

## Verification

1. **Manual testing with 2 devices**:
   - Open same chat on both devices
   - Tap brush icon → both see Live Draw screen
   - Draw on device A → strokes appear on device B in real-time
   - Close app on device B, draw more on A, reopen B → see new strokes
   - Save → image appears in chat on both devices

2. **Unit tests**:
   - Stroke normalization/denormalization
   - useDrawingSync broadcast handling
   - useDrawingHistory undo/redo logic

3. **Platform testing**:
   - iOS simulator
   - Android emulator
   - Web browser
