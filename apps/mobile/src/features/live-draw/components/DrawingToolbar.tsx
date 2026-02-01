import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../../theme';
import { PRESET_COLORS, BRUSH_MIN_WIDTH, BRUSH_MAX_WIDTH } from '../constants';

interface DrawingToolbarProps {
  selectedColor: string;
  brushWidth: number;
  isEraser: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onColorChange: (color: string) => void;
  onBrushWidthChange: (width: number) => void;
  onToggleEraser: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSave: () => void;
}

export function DrawingToolbar({
  selectedColor,
  brushWidth,
  isEraser,
  canUndo,
  canRedo,
  onColorChange,
  onBrushWidthChange,
  onToggleEraser,
  onUndo,
  onRedo,
  onClear,
  onSave,
}: DrawingToolbarProps) {
  const brushSizes = [BRUSH_MIN_WIDTH, 6, 12, BRUSH_MAX_WIDTH];

  return (
    <View style={styles.container}>
      {/* Color palette */}
      <View style={styles.row}>
        {PRESET_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            onPress={() => onColorChange(color)}
            style={[
              styles.colorDot,
              { backgroundColor: color },
              selectedColor === color && !isEraser && styles.colorDotSelected,
            ]}
          />
        ))}
      </View>

      {/* Brush sizes */}
      <View style={styles.row}>
        {brushSizes.map((size) => (
          <TouchableOpacity
            key={size}
            onPress={() => onBrushWidthChange(size)}
            style={[styles.sizeButton, brushWidth === size && styles.sizeButtonSelected]}
          >
            <View
              style={[
                styles.sizeDot,
                {
                  width: Math.max(size, 4),
                  height: Math.max(size, 4),
                  borderRadius: Math.max(size, 4) / 2,
                  backgroundColor: isEraser ? colors.textSecondary : selectedColor,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onToggleEraser}
          style={[styles.actionButton, isEraser && styles.actionButtonActive]}
        >
          <Ionicons
            name="backspace-outline"
            size={20}
            color={isEraser ? colors.background : colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onUndo}
          disabled={!canUndo}
          style={[styles.actionButton, !canUndo && styles.actionButtonDisabled]}
        >
          <Ionicons name="arrow-undo" size={20} color={canUndo ? colors.text : colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onRedo}
          disabled={!canRedo}
          style={[styles.actionButton, !canRedo && styles.actionButtonDisabled]}
        >
          <Ionicons name="arrow-redo" size={20} color={canRedo ? colors.text : colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onClear} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onSave} style={styles.saveButton}>
          <Ionicons name="share-outline" size={18} color={colors.text} />
          <Text style={styles.saveText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: colors.text,
    borderWidth: 2,
  },
  sizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sizeDot: {
    // Dynamic size set inline
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  saveText: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: '600',
  },
});
