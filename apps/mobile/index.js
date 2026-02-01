import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/features/live-draw/widgets/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);

import 'expo-router/entry';
