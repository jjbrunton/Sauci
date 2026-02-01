import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { DrawingCanvas } from './components/DrawingCanvas';
import type { DrawingCanvasHandle } from './components/DrawingCanvas';
import { DrawingToolbar } from './components/DrawingToolbar';
import { DrawingShareModal } from './components/DrawingShareModal';
import { useDrawingHistory } from './hooks/useDrawingHistory';
import { useDrawingSync } from './hooks/useDrawingSync';
import { useCanvasCapture } from './hooks/useCanvasCapture';
import { useAuthStore } from '../../store';
import { colors, spacing, typography } from '../../theme';
import { GradientBackground } from '../../components/ui';
import type { StrokeSegment, StrokePoint } from './types';
import {
  BRUSH_DEFAULT_WIDTH,
  PRESET_COLORS,
  MAX_STROKES,
} from './constants';

export const LiveDrawScreen: React.FC = () => {
  const { coupleId: coupleIdParam } = useLocalSearchParams<{ coupleId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const coupleId = coupleIdParam || user?.couple_id;
  const { width: screenWidth } = useWindowDimensions();

  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [brushWidth, setBrushWidth] = useState(BRUSH_DEFAULT_WIDTH);
  const [isEraser, setIsEraser] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareDrawingUri, setShareDrawingUri] = useState<string | null>(null);

  const canvasRef = useRef<DrawingCanvasHandle>(null);
  // Keep track of the current stroke id for sync broadcasts
  const currentStrokeIdRef = useRef<string | null>(null);

  const canvasWidth = screenWidth - spacing.md * 2;
  const canvasHeight = canvasWidth * 1.2;

  const {
    strokes,
    setStrokes,
    addStroke,
    updateStroke,
    undo,
    redo,
    canUndo,
    canRedo,
    clearAll,
  } = useDrawingHistory();

  const { makeSnapshot, captureToFile } = useCanvasCapture();

  const handleStrokeStartFromPartner = useCallback(
    (stroke: StrokeSegment) => addStroke(stroke),
    [addStroke]
  );
  const handleStrokeContinueFromPartner = useCallback(
    (strokeId: string, points: StrokePoint[]) => updateStroke(strokeId, points),
    [updateStroke]
  );
  const handleStrokeEndFromPartner = useCallback((_strokeId: string) => {}, []);
  const handleClearFromPartner = useCallback(() => clearAll(), [clearAll]);
  const handleUndoFromPartner = useCallback(
    (strokeId: string) => {
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    },
    [setStrokes]
  );

  const sync = useDrawingSync({
    coupleId: coupleId!,
    userId: user?.id,
    onStrokeStart: handleStrokeStartFromPartner,
    onStrokeContinue: handleStrokeContinueFromPartner,
    onStrokeEnd: handleStrokeEndFromPartner,
    onClearCanvas: handleClearFromPartner,
    onUndo: handleUndoFromPartner,
    onRedo: handleStrokeStartFromPartner,
    onLoadStrokes: (loaded) => setStrokes(loaded),
  });

  const handleTouchStart = useCallback(
    (point: StrokePoint) => {
      if (!user?.id) return;
      if (strokes.length >= MAX_STROKES) {
        Alert.alert('Canvas Full', 'Save your drawing and start fresh.');
        return;
      }

      const stroke: StrokeSegment = {
        id: `${user.id}_${Date.now()}`,
        userId: user.id,
        points: [point],
        color: selectedColor,
        width: brushWidth,
        timestamp: Date.now(),
        isEraser,
      };
      currentStrokeIdRef.current = stroke.id;
      canvasRef.current?.startStroke(stroke);
      sync.broadcastStrokeStart(stroke);
    },
    [user?.id, selectedColor, brushWidth, isEraser, strokes.length, sync]
  );

  const handleTouchMove = useCallback(
    (point: StrokePoint) => {
      if (!currentStrokeIdRef.current) return;
      canvasRef.current?.addPoint(point);
      sync.broadcastStrokeContinue(currentStrokeIdRef.current, [point]);
    },
    [sync]
  );

  const handleTouchEnd = useCallback(() => {
    if (!currentStrokeIdRef.current) return;
    const finished = canvasRef.current?.endStroke() ?? null;
    currentStrokeIdRef.current = null;
    if (finished) {
      addStroke(finished);
      sync.broadcastStrokeEnd(finished.id);
      sync.persistStrokes([...strokes, finished]);
    }
  }, [addStroke, strokes, sync]);

  const handleUndo = useCallback(() => {
    if (!user?.id) return;
    const removed = undo(user.id);
    if (removed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sync.broadcastUndo(removed.id);
      sync.persistStrokes(strokes.filter((s) => s.id !== removed.id));
    }
  }, [user?.id, undo, strokes, sync]);

  const handleRedo = useCallback(() => {
    if (!user?.id) return;
    const restored = redo(user.id);
    if (restored) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sync.broadcastRedo(restored);
      sync.persistStrokes([...strokes, restored]);
    }
  }, [user?.id, redo, strokes, sync]);

  const handleClear = useCallback(() => {
    Alert.alert('Clear Canvas', 'This will erase the entire drawing.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearAll();
          sync.broadcastClearCanvas();
          sync.persistStrokes([]);
        },
      },
    ]);
  }, [clearAll, sync]);

  const handleShare = useCallback(async () => {
    const uri = await captureToFile();
    if (uri) {
      setShareDrawingUri(uri);
      setShowShareModal(true);
    } else {
      Alert.alert('Error', 'Failed to capture drawing');
    }
  }, [captureToFile]);

  const handleToggleEraser = useCallback(() => {
    setIsEraser((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <GradientBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Live Draw</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.canvasContainer}>
        <DrawingCanvas
          ref={canvasRef}
          strokes={strokes}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onCanvasReady={(snapshot) => {
            makeSnapshot.current = snapshot;
          }}
        />
      </View>

      <View style={[styles.toolbarContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <DrawingToolbar
          selectedColor={selectedColor}
          brushWidth={brushWidth}
          isEraser={isEraser}
          canUndo={canUndo(user?.id ?? '')}
          canRedo={canRedo(user?.id ?? '')}
          onColorChange={(c) => {
            setSelectedColor(c);
            setIsEraser(false);
          }}
          onBrushWidthChange={setBrushWidth}
          onToggleEraser={handleToggleEraser}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onSave={handleShare}
        />
      </View>
      <DrawingShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        drawingUri={shareDrawingUri}
      />
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.headline,
    color: colors.text,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  toolbarContainer: {
    backgroundColor: colors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
