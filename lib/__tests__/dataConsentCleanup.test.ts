import { clearHealthConsentDeviceStorage, clearDeviceStoragePreservingWithdrawals } from '../dataConsentCleanup';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: async () => [...mockStorage.keys()],
  multiGet: async (keys: string[]) => keys.map(key => [key, mockStorage.get(key) ?? null]),
  multiRemove: async (keys: string[]) => { keys.forEach(key => mockStorage.delete(key)); },
}));
jest.mock('../dataConsentRuntime', () => ({ DATA_CONSENTS_ENABLED: true }));

beforeEach(() => {
  mockStorage.clear();
  mockStorage.set('data_consent_snapshot_v1:test.supabase.co:a', 'confirmed-revocation');
  mockStorage.set('data_consent_pending_withdrawal_v1:a', '["health"]');
  mockStorage.set('sb-abcdefghijklmnopqrst-auth-token', 'synthetic-token');
  mockStorage.set('home_cache', 'synthetic-health-data');
});
it('keeps the saved consent status through health withdrawal cleanup', async () => {
  await clearHealthConsentDeviceStorage();
  expect(mockStorage.get('data_consent_snapshot_v1:test.supabase.co:a')).toBe('confirmed-revocation');
  expect(mockStorage.get('data_consent_pending_withdrawal_v1:a')).toBe('["health"]');
  expect(mockStorage.has('home_cache')).toBe(false);
});
it('removes the cached status on logout while keeping an unconfirmed withdrawal', async () => {
  await clearDeviceStoragePreservingWithdrawals();
  expect([...mockStorage.keys()]).toEqual(['data_consent_pending_withdrawal_v1:a']);
});
