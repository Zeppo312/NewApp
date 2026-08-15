/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  name: "LottiBabyLiveActivity",
  displayName: "Lotti Baby",
  type: "widget",
  deploymentTarget: "16.1",
  icon: "../../assets/images/icon.png",
  entitlements: {
    // Geteilter Speicher für das Einkaufslisten-Widget (siehe ShoppingWidgetStore.swift)
    "com.apple.security.application-groups": ["group.com.LottiBaby.app"],
  },
});
