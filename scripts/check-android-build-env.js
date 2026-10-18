// Runs on the EAS worker after environment variables have been loaded.
// SDK keys are never printed. A Preview APK can smoke-test the app without billing.
function validateAndroidBuildEnv(env = process.env) {
  if (env.EAS_BUILD_PLATFORM !== 'android') return;
  const profile = env.EAS_BUILD_PROFILE;
  const key = env.EXPO_PUBLIC_RC_ANDROID_KEY?.trim() ||
    env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
  const isStoreBuild = ['production', 'store-internal', 'preview-testflight', 'release-candidate', 'family-qa-play'].includes(profile);
  const isDevelopment = profile === 'development';
  if (!isDevelopment && key && !/^goog_\S+$/.test(key)) {
    throw new Error('[Android build] RevenueCat requires a Google Play SDK key (goog_...), not a Test Store, Apple, or secret key.');
  }
  if (isStoreBuild && !key) {
    throw new Error('[Android build] Missing Google Play RevenueCat SDK key. Configure EXPO_PUBLIC_RC_ANDROID_KEY in the selected EAS environment before building a store AAB. Do not substitute a test_ key.');
  }
  return key ? 'Google Play SDK key configured (value withheld).' :
    'No Android billing key: this APK is for launch/UI smoke tests only; purchases are unavailable.';
}

if (require.main === module) {
  try {
    const result = validateAndroidBuildEnv();
    if (result) console.log(`[Android build] ${result}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateAndroidBuildEnv };
