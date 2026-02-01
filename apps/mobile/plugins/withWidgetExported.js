const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Fixes react-native-android-widget setting android:exported="false" on widget receivers.
 * Widget receivers MUST be exported so the launcher can send APPWIDGET_UPDATE broadcasts.
 *
 * Uses withAndroidManifest's dangerous modifier priority to run after all other plugins.
 */
module.exports = function withWidgetExported(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication =
      config.modResults.manifest.application?.[0];
    if (!mainApplication?.receiver) return config;

    for (const receiver of mainApplication.receiver) {
      const intentFilters = receiver['intent-filter'] ?? [];
      const isWidget = intentFilters.some((filter) =>
        filter.action?.some(
          (a) =>
            a.$?.['android:name'] ===
            'android.appwidget.action.APPWIDGET_UPDATE'
        )
      );
      if (isWidget) {
        receiver.$['android:exported'] = 'true';
      }
    }

    return config;
  });
};
