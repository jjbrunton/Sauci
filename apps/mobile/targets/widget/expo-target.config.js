/** @type {import('@bacons/apple-targets').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "LiveDrawWidget",
  // apple-targets 5.x derives the bundle identifier from the folder name
  // ("widget") by default; the store identity must stay LiveDrawWidget.
  bundleIdentifier: "com.sauci.app.LiveDrawWidget",
  deploymentTarget: "16.0",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ?? [
        "group.com.sauci.app",
      ],
  },
});
