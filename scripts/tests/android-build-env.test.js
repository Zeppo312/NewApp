const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAndroidBuildEnv } = require('../check-android-build-env');

const android = { EAS_BUILD_PLATFORM: 'android' };
for (const profile of ['production', 'store-internal', 'preview-testflight']) {
  test(`${profile} refuses a store build without an Android key`, () => {
    assert.throws(() => validateAndroidBuildEnv({ ...android, EAS_BUILD_PROFILE: profile }), /Missing Google Play/);
  });
}
for (const key of ['test_example', 'appl_example', 'sk_example', 'goog_']) {
  test(`release APK and store AAB reject the ${key.split('_')[0]} key case`, () => {
    for (const profile of ['preview', 'store-internal', 'production']) {
      assert.throws(() => validateAndroidBuildEnv({ ...android, EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_RC_ANDROID_KEY: key }), /requires a Google Play/);
    }
  });
}
test('preview without billing is explicitly reported as a smoke test', () => {
  assert.match(validateAndroidBuildEnv({ ...android, EAS_BUILD_PROFILE: 'preview' }), /purchases are unavailable/);
});
test('blank preferred key falls back to the legacy Google key without printing it', () => {
  const result = validateAndroidBuildEnv({ ...android, EAS_BUILD_PROFILE: 'store-internal', EXPO_PUBLIC_RC_ANDROID_KEY: '  ', EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: ' goog_example ' });
  assert.match(result, /configured/);
  assert.ok(!result.includes('goog_example'));
});
test('a wrong preferred key is not hidden by a valid legacy key', () => {
  assert.throws(() => validateAndroidBuildEnv({ ...android, EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_RC_ANDROID_KEY: 'test_example', EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_example' }), /requires a Google Play/);
});
test('iOS build environment is unaffected', () => {
  assert.equal(validateAndroidBuildEnv({ EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'production' }), undefined);
});
