import { Platform } from 'react-native';
import { setWidgetData, reloadWidgets } from '../../../../modules/widget-bridge';
import type { StrokeSegment } from '../types';
import { renderStrokesToBase64 } from './widgetImageExport';

export async function updateWidget(strokes: StrokeSegment[]): Promise<void> {
  try {
    const base64 = renderStrokesToBase64(strokes);
    if (!base64) return;

    if (Platform.OS === 'ios') {
      setWidgetData('LiveDrawImage', base64);
      reloadWidgets();
    } else if (Platform.OS === 'android') {
      setWidgetData('LiveDrawImage', base64);
      reloadWidgets();
    }
  } catch (e) {
    // Widget update is non-critical; don't crash the app
    console.warn('Failed to update widget:', e);
  }
}
