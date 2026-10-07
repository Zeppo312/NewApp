const { test } = require('node:test');
const assert = require('node:assert/strict');
const configure = require('../../app.config.js');
const config = require('../../app.json').expo;
const profiles = require('../../eas.json').build;

test('every new EAS build includes effective consents, including store and isolated QA profiles', () => {
  for (const [name, profile] of Object.entries(profiles)) {
    assert.equal(profile.env?.EXPO_PUBLIC_DATA_CONSENTS_ENABLED, 'true', `${name} must include the effective flow`);
    if (name.startsWith('family-qa') && !profile.extends?.startsWith('family-qa')) {
      assert.equal(profile.env.EXPO_PUBLIC_QA_PROJECT_REF, 'ggyonianphloycmqrwvj');
    }
  }
});

test('new builds cannot opt back into the inert preview through an environment override', () => {
  const original = { ...process.env };
  try {
    for (const name of ['EXPO_PUBLIC_BACKEND_ENV','EXPO_PUBLIC_QA_SUPABASE_URL','EXPO_PUBLIC_QA_SUPABASE_KEY','EXPO_PUBLIC_QA_PROJECT_REF']) delete process.env[name];
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = 'false';
    assert.throws(() => configure({ config }), /effective data consents/);
    process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = 'true';
    const next = configure({ config });
    assert.equal(next.ios.bundleIdentifier, config.ios.bundleIdentifier);
    assert.equal(next.android.package, config.android.package);
  } finally { process.env = original; }
});

test('the explicitly disabled preview stays available for local design work', () => {
  const original = { ...process.env };
  try {
    for (const name of ['EAS_BUILD_PROFILE','EXPO_PUBLIC_BACKEND_ENV','EXPO_PUBLIC_QA_SUPABASE_URL','EXPO_PUBLIC_QA_SUPABASE_KEY','EXPO_PUBLIC_QA_PROJECT_REF']) delete process.env[name];
    process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = 'false';
    assert.equal(configure({ config }).name, config.name);
  } finally { process.env = original; }
});
