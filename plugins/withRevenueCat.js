/**
 * Expo config plugin (no-op) used to validate RevenueCat environment variables.
 *
 * RevenueCat is configured at runtime via `Purchases.configure` in JS.
 * The SDK keys must be provided as env vars:
 * - EXPO_PUBLIC_RC_IOS_KEY (iOS, usually starts with `appl_`)
 * - EXPO_PUBLIC_RC_ANDROID_KEY (Android, usually starts with `goog_`)
 * Legacy names are still accepted for compatibility:
 * - EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
 * - EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
 */
module.exports = function withRevenueCat(config, props = {}) {
  const iosKey =
    props.iosApiKey ||
    process.env.EXPO_PUBLIC_RC_IOS_KEY ||
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const androidKey =
    props.androidApiKey ||
    process.env.EXPO_PUBLIC_RC_ANDROID_KEY ||
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const isReleaseLikeBuildProfile =
    typeof buildProfile === 'string' &&
    !['development', 'development-simulator'].includes(buildProfile);

  if (!iosKey && !androidKey) {
    console.warn(
      '[RevenueCat] Missing RevenueCat SDK keys. Set EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY (preferred) or the legacy EXPO_PUBLIC_REVENUECAT_* names.',
    );
  }

  if (isReleaseLikeBuildProfile && typeof iosKey === 'string' && iosKey.startsWith('test_')) {
    throw new Error(
      `[RevenueCat] EAS build profile "${buildProfile}" is using a Test Store iOS key (test_...). Use an App Store key (appl_...) for preview/production-style builds.`,
    );
  }

  return config;
};
