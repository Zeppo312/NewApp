import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { acceptCaretakerGuestInvitation, createCaretakerGuestRequest, forgetCaretakerGuestSession, loadCaretakerGuestSession } from '../caretaker-guest';

jest.mock('@/lib/supabase', () => ({ supabaseUrl: 'https://test.supabase.co', supabaseAnonKey: 'public-anon-key' }));
jest.mock('expo-crypto', () => ({ getRandomBytesAsync: jest.fn() }));
const code = '1234567890abcdef1234567890abcdef';
const grantId = '00000000-0000-4000-a000-000000000001';
const fetchMock = jest.fn();
const originalFetch = global.fetch;
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear();
  global.fetch = fetchMock;
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: grantId }) });
  jest.mocked(Crypto.getRandomBytesAsync).mockResolvedValue(new Uint8Array(32).fill(171));
});
afterAll(() => { global.fetch = originalFetch; });

it('accepts with an isolated anonymous request, persisting only the guest credential', async () => {
  const session = await acceptCaretakerGuestInvitation(code.toUpperCase());
  expect(session).toEqual({ token: 'ab'.repeat(32), grantId });
  expect(await loadCaretakerGuestSession()).toEqual(session);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('https://test.supabase.co/rest/v1/rpc/caretaker_guest');
  expect(options.headers.Authorization).toBe('Bearer public-anon-key');
  expect(JSON.parse(options.body)).toEqual({ p_action: 'accept', p_payload: { code }, p_session_token: session.token });
  expect(await AsyncStorage.getItem('caretaker-guest-invitation:v1')).toBeNull();
});
it('reuses the exact credential after a lost response instead of consuming a second invitation', async () => {
  fetchMock.mockRejectedValueOnce(new Error('network response lost'));
  await expect(acceptCaretakerGuestInvitation(code)).rejects.toThrow('network response lost');
  expect(await loadCaretakerGuestSession()).toBeNull();
  await acceptCaretakerGuestInvitation(code);
  expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  expect(Crypto.getRandomBytesAsync).toHaveBeenCalledTimes(1);
});
it('does not claim the invitation if the recovery credential cannot be saved', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage full'));
  await expect(acceptCaretakerGuestInvitation(code)).rejects.toThrow('storage full');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('keeps parent storage untouched when leaving the guest session', async () => {
  await AsyncStorage.setItem('parent-auth', 'parent-session');
  await acceptCaretakerGuestInvitation(code);
  await forgetCaretakerGuestSession();
  expect(await loadCaretakerGuestSession()).toBeNull();
  expect(await AsyncStorage.getItem('parent-auth')).toBe('parent-session');
});
it('rejects malformed codes, credentials and persisted sessions', async () => {
  await expect(acceptCaretakerGuestInvitation('ABCD1234')).rejects.toThrow('invalid_invitation');
  await expect(createCaretakerGuestRequest(code)('read')).rejects.toThrow('invalid_guest_session');
  await AsyncStorage.setItem('caretaker-guest-session:v1', JSON.stringify({ token: code, grantId }));
  expect(await loadCaretakerGuestSession()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
it('propagates server denial without persisting a usable guest session', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ code: '42501', message: 'invalid_invitation' }) });
  await expect(acceptCaretakerGuestInvitation(code)).rejects.toMatchObject({ message: 'invalid_invitation' });
  expect(await loadCaretakerGuestSession()).toBeNull();
});
