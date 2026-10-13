import assert from 'node:assert/strict';
import test from 'node:test';
import { googleAuthPatch, readGoogleWebClient, NATIVE_GOOGLE_REDIRECT } from '../configure-google-auth.mjs';

const ref = 'kwniiyayhzgjfqjsjcfu';
const file = { web: { client_id: 'test.apps.googleusercontent.com', client_secret: 'test-only',
  redirect_uris: [`https://${ref}.supabase.co/auth/v1/callback`] } };

test('accepts only a Web OAuth client with the project-specific Google callback', () => {
  assert.deepEqual(readGoogleWebClient(file, ref), { clientId: 'test.apps.googleusercontent.com', clientSecret: 'test-only' });
  assert.throws(() => readGoogleWebClient({ installed: file.web }, ref));
  assert.throws(() => readGoogleWebClient({ web: { ...file.web, client_secret: '' } }, ref));
  assert.throws(() => readGoogleWebClient(file, 'ggyonianphloycmqrwvj'));
});

test('preserves existing redirects and updates only the Google provider and callback allowlist', () => {
  const current = { uri_allow_list: 'https://lottibaby.de/auth/callback,com.lottibaby.app://auth/reset-password', site_url: 'unchanged', external_apple_enabled: true };
  const patch = googleAuthPatch(current, readGoogleWebClient(file, ref));
  assert.equal(patch.uri_allow_list, `${current.uri_allow_list},${NATIVE_GOOGLE_REDIRECT}`);
  assert.equal(patch.external_google_enabled, true);
  assert.equal('site_url' in patch, false);
  assert.equal('external_apple_enabled' in patch, false);
  assert.deepEqual(current, { uri_allow_list: 'https://lottibaby.de/auth/callback,com.lottibaby.app://auth/reset-password', site_url: 'unchanged', external_apple_enabled: true });
});

test('does not duplicate redirects on a repeated setup', () => {
  const credentials = readGoogleWebClient(file, ref);
  const first = googleAuthPatch({}, credentials);
  assert.equal(googleAuthPatch(first, credentials).uri_allow_list, NATIVE_GOOGLE_REDIRECT);
});

test('reuses an original download only with a recent Console check bound to the same client and callback', () => {
  const qa = 'ggyonianphloycmqrwvj';
  const verification = { method: 'google-cloud-console', projectRef: qa,
    clientId: file.web.client_id, callback: `https://${qa}.supabase.co/auth/v1/callback`,
    verifiedAt: new Date().toISOString() };
  const original = JSON.stringify(file);
  assert.deepEqual(readGoogleWebClient(file, qa, verification), { clientId: file.web.client_id, clientSecret: file.web.client_secret });
  assert.equal(JSON.stringify(file), original);
  for (const change of [
    { clientId: 'other.apps.googleusercontent.com' }, { projectRef: ref },
    { callback: file.web.redirect_uris[0] }, { method: 'unverified' },
    { verifiedAt: 'invalid' }, { verifiedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
    { verifiedAt: new Date(Date.now() + 60_000).toISOString() },
  ]) assert.throws(() => readGoogleWebClient(file, qa, { ...verification, ...change }));
});

test('requires a secure web origin and includes the exact callback path', () => {
  const credentials = readGoogleWebClient(file, ref);
  assert.match(googleAuthPatch({}, credentials, 'https://app.lottibaby.de').uri_allow_list, /https:\/\/app.lottibaby.de\/auth\/google-callback\?attempt=\*/);
  assert.match(googleAuthPatch({}, credentials, 'http://localhost:8093').uri_allow_list, /http:\/\/localhost:8093/);
  assert.throws(() => googleAuthPatch({}, credentials, 'http://app.lottibaby.de'));
});
