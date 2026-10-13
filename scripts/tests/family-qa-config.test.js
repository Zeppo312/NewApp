const { test } = require('node:test');
const assert = require('node:assert/strict');
const configure = require('../../app.config.js');
const config = require('../../app.json').expo;
test('QA builds require an isolated backend and disable production updates', () => {
  const original = {...process.env};
  try {
    for (const name of ['EXPO_PUBLIC_BACKEND_ENV','EXPO_PUBLIC_QA_SUPABASE_URL','EXPO_PUBLIC_QA_SUPABASE_KEY','EXPO_PUBLIC_QA_PROJECT_REF','EAS_BUILD_PROFILE']) delete process.env[name];
    assert.equal(configure({config}).name, config.name);
    process.env.EAS_BUILD_PROFILE = 'family-qa-ios';
    assert.throws(() => configure({config}));
    Object.assign(process.env, {EXPO_PUBLIC_BACKEND_ENV:'family-qa',EXPO_PUBLIC_QA_PROJECT_REF:'abcdefghijklmnopqrst',EXPO_PUBLIC_QA_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',EXPO_PUBLIC_QA_SUPABASE_KEY:'sb_publishable_fixture'});
    const qa = configure({config});
    assert.equal(qa.name,'Lotti Baby QA');
    assert.equal(qa.updates.enabled,false);
    assert.match(qa.ios.runtimeVersion,/^family-qa-/);
    assert.match(qa.android.runtimeVersion,/^family-qa-/);
    assert.equal(qa.ios.bundleIdentifier, config.ios.bundleIdentifier);
    process.env.EAS_BUILD_PROFILE = 'production';
    assert.throws(() => configure({config}));
  } finally { process.env = original; }
});
