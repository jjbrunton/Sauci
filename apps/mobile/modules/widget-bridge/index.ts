import { requireNativeModule } from "expo";

const WidgetBridge = requireNativeModule("WidgetBridge");

export function setWidgetData(key: string, value: string): void {
  WidgetBridge.setWidgetData(key, value);
}

export function reloadWidgets(): void {
  WidgetBridge.reloadWidgets();
}
