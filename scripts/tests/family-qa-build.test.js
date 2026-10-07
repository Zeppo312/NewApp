const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('QA build hook blocks production native configuration and accepts isolated binaries', async () => {
  const { verifyFamilyQaBuild } = await import('../check-family-qa-build.mjs');
  const root = await mkdtemp(join(tmpdir(), 'family-qa-build-'));
  const env = { EXPO_PUBLIC_BACKEND_ENV: 'family-qa', EAS_BUILD_PROFILE: 'family-qa-ios', EAS_BUILD_PLATFORM: 'ios',
    EXPO_PUBLIC_QA_PROJECT_REF: 'abcdefghijklmnopqrst', EXPO_PUBLIC_QA_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    EXPO_PUBLIC_QA_SUPABASE_KEY: 'sb_publishable_fixture', EXPO_PUBLIC_RC_IOS_KEY: 'appl_fixture', EXPO_PUBLIC_RC_ANDROID_KEY: 'goog_fixture' };
  const save = async (path, text) => { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), text); };
  try {
    assert.deepEqual(await verifyFamilyQaBuild({}, root), { qa: false });
    await assert.rejects(verifyFamilyQaBuild({ EAS_BUILD_PROFILE: 'family-qa-ios' }, root));
    await save('app.json', JSON.stringify({ expo: { version: '1.0' } }));
    const ios = flag => `<key>EXUpdatesEnabled</key><${flag}/><key>EXUpdatesRuntimeVersion</key><string>family-qa-1.0</string>`;
    await save('ios/LottiBaby/Supporting/Expo.plist', ios('true'));
    await assert.rejects(verifyFamilyQaBuild(env, root), /iOS QA/);
    await save('ios/LottiBaby/Supporting/Expo.plist', ios('false'));
    assert.equal((await verifyFamilyQaBuild(env, root)).qa, true);
    await assert.rejects(verifyFamilyQaBuild({ ...env, EAS_BUILD_PROFILE: 'production' }, root));
    await assert.rejects(verifyFamilyQaBuild({ ...env, EXPO_PUBLIC_QA_PROJECT_REF: 'kwniiyayhzgjfqjsjcfu' }, root));
    env.EAS_BUILD_PLATFORM = 'android'; env.EAS_BUILD_PROFILE = 'family-qa-android';
    await save('android/app/src/main/AndroidManifest.xml', '<meta-data android:name="expo.modules.updates.ENABLED" android:value="false"/><meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>');
    await save('android/app/src/main/res/values/strings.xml', '<string name="expo_runtime_version">production</string>');
    await assert.rejects(verifyFamilyQaBuild(env, root), /Android QA/);
    await save('android/app/src/main/res/values/strings.xml', '<string name="expo_runtime_version">family-qa-1.0</string>');
    assert.equal((await verifyFamilyQaBuild(env, root)).qa, true);
    await assert.rejects(verifyFamilyQaBuild({ ...env, EXPO_PUBLIC_RC_ANDROID_KEY: '' }, root), /SDK key/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
