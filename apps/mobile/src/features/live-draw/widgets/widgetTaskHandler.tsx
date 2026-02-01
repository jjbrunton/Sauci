import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { LiveDrawWidget } from './LiveDrawWidget';

const WIDGET_NAME = 'LiveDraw';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const widgetAction = props.widgetAction;

  if (widgetInfo.widgetName !== WIDGET_NAME) return;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      // Read stored image from SharedPreferences via the widget bridge
      // The image is stored by the app when strokes are persisted
      props.renderWidget(<LiveDrawWidget />);
      break;
    }
    case 'WIDGET_CLICK':
      // Click handling is done via clickAction="OPEN_APP" in the widget
      break;
  }
}
