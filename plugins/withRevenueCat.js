/**
 * Expo config plugin (no-op) used to validate RevenueCat environment variables.
 *
 * RevenueCat is configured at runtime via `Purchases.configure` in JS.
 * The SDK keys must be provided as env vars:
 * - EXPO_PUBLIC_RC_IOS_KEY (iOS, usually starts with `appl_`)
 * - EXPO_PUBLIC_RC_ANDROID_KEY (Android, usually starts with `goog_`)
 */
module.exports = function withRevenueCat(config, props = {}) {
  const iosKey = props.iosApiKey || process.env.EXPO_PUBLIC_RC_IOS_KEY;
  const androidKey = props.androidApiKey || process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

  if (!iosKey && !androidKey) {
    // eslint-disable-next-line no-console
    console.warn(
      '[RevenueCat] Missing EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY. Purchases will be unavailable.',
    );
  }

  return config;
};

