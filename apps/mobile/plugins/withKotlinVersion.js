const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Config plugin to ensure Kotlin 1.9.x is used in the Android build.
 * This provides a safety net in case the default version causes issues.
 */
function withKotlinVersion(config, kotlinVersion = "1.9.25") {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      // Ensure Kotlin version is set correctly
      config.modResults.contents = config.modResults.contents.replace(
        /kotlinVersion = findProperty\('android\.kotlinVersion'\) \?: ['"][\d.]+['"]/,
        `kotlinVersion = findProperty('android.kotlinVersion') ?: '${kotlinVersion}'`
      );
    }
    return config;
  });
}

module.exports = withKotlinVersion;
