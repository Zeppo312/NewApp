import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearStartupAccess, persistStartupAccess, readStartupAccess, readStartupDisplaySession, revokeStartupAccess,
  startupAccessRevision, STARTUP_ACCESS_MAX_AGE_MS, STARTUP_ACCESS_PREFIX, validStartupAccess } from '../startupAccess';
const scope = { backendHost: 'fixture.supabase.co', userId: 'A' };
const evidence = () => ({ accessReason: 'tester' as const, verifiedAt: Date.now(), subscriptionExpiresAt: null });
const key = `${STARTUP_ACCESS_PREFIX}fixture.supabase.co:A`;
beforeEach(async () => { jest.clearAllMocks(); await clearStartupAccess(); await AsyncStorage.clear(); });

it('roundtrips a bounded grant with strict backend/account isolation and known subscription expiry', async () => {
  const snapshot = await persistStartupAccess(scope, evidence());
  expect(await readStartupAccess(scope)).toEqual(snapshot);
  expect(snapshot?.validUntil).toBe(snapshot!.verifiedAt + STARTUP_ACCESS_MAX_AGE_MS);
  expect(await readStartupAccess({ ...scope, userId: 'B' })).toBeNull();
  expect(await readStartupAccess({ ...scope, backendHost: 'qa.supabase.co' })).toBeNull();
  const expiresAt = Date.now() + 60_000;
  expect((await persistStartupAccess(scope, { ...evidence(), accessReason: 'subscription', subscriptionExpiresAt: expiresAt }))?.validUntil).toBe(expiresAt);
});
it('rejects corrupt, expired, future, altered, mismatched and unsupported evidence', async () => {
  const snapshot = await persistStartupAccess(scope, evidence());
  for (const change of [{ schemaVersion: 2 }, { userId: 'B' }, { backendHost: 'qa' }, { accessReason: 'none' },
    { validUntil: Date.now() }, { verifiedAt: Date.now() + 60_000 }, { validUntil: Date.now() + STARTUP_ACCESS_MAX_AGE_MS + 60_000 },
    { subscriptionExpiresAt: Date.now() - 1 }, { subscriptionExpiresAt: 'invalid' }]) {
    await AsyncStorage.setItem(key, JSON.stringify({ ...snapshot, ...change }));
    expect(await readStartupAccess(scope)).toBeNull();
  }
  await AsyncStorage.setItem(key, 'broken'); expect(await readStartupAccess(scope)).toBeNull();
  expect(validStartupAccess(snapshot, scope, snapshot!.validUntil)).toBe(false);
});
it('cannot renew a grant by rereading older provider evidence', async () => {
  const original = { ...evidence(), verifiedAt: Date.now() - 23 * 3_600_000 };
  const first = await persistStartupAccess(scope, original);
  expect((await persistStartupAccess(scope, original))?.validUntil).toBe(first?.validUntil);
  expect(await persistStartupAccess(scope, { ...original, verifiedAt: Date.now() - STARTUP_ACCESS_MAX_AGE_MS })).toBeNull();
});
it('revocation immediately blocks disk reads, drains an already started write, and rejects older revisions', async () => {
  const set = AsyncStorage.setItem; let release!: () => void; let entered!: () => void;
  const started = new Promise<void>(r => { entered = r; }); const held = new Promise<void>(r => { release = r; });
  const revision = startupAccessRevision(scope);
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => { entered(); await held; return set(key, value); });
  const write = persistStartupAccess(scope, evidence(), revision); await started;
  const revoke = revokeStartupAccess(scope); expect(await readStartupAccess(scope)).toBeNull();
  release(); await Promise.all([write, revoke]);
  expect(await AsyncStorage.getItem(key)).toBeNull();
  expect(await persistStartupAccess(scope, evidence(), revision)).toBeNull();
  expect(await persistStartupAccess(scope, evidence())).not.toBeNull();
});
it('full cleanup drains proof writers before deleting their keys', async () => {
  const set = AsyncStorage.setItem; let release!: () => void; let entered!: () => void;
  const started = new Promise<void>(r => { entered = r; }); const held = new Promise<void>(r => { release = r; });
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => { entered(); await held; return set(key, value); });
  const revision = startupAccessRevision(scope);
  const write = persistStartupAccess(scope, evidence(), revision); await started;
  const clear = clearStartupAccess(); expect(await readStartupAccess(scope)).toBeNull();
  release(); await Promise.all([write, clear]);
  expect(await AsyncStorage.getItem(key)).toBeNull();
  expect(await persistStartupAccess(scope, evidence(), revision)).toBeNull();
});
it('requires both a real persisted session shape and an unexpired grant for local display recovery', async () => {
  const session = { user: { id: 'A' }, access_token: 'synthetic-expired', refresh_token: 'synthetic-refresh', expires_at: 1 };
  await AsyncStorage.setItem('auth', JSON.stringify(session));
  expect(await readStartupDisplaySession(scope.backendHost, 'auth')).toBeNull();
  await persistStartupAccess(scope, evidence());
  expect(await readStartupDisplaySession(scope.backendHost, 'auth')).toEqual(session);
  expect(await readStartupDisplaySession('qa.supabase.co', 'auth')).toBeNull();
  await AsyncStorage.setItem('auth', JSON.stringify({ ...session, refresh_token: null }));
  expect(await readStartupDisplaySession(scope.backendHost, 'auth')).toBeNull();
});
it('does not report durability when storage rejects the write', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await expect(persistStartupAccess(scope, evidence())).rejects.toThrow('disk full');
  expect(await readStartupAccess(scope)).toBeNull();
});
