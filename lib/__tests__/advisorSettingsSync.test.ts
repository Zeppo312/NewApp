import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { DEFAULT_ADVISOR_SETTINGS, fetchAdvisorSettings, saveAdvisorSettings, type AdvisorSettings } from '../advisor/advisorStorage';
import { clearAdvisorSettingsSync, getAdvisorSettingsSync } from '../advisor/settingsSync';

jest.mock('@/lib/supabase', () => ({
  supabaseUrl: 'https://test.supabase.co',
  supabase: { auth: { onAuthStateChange: jest.fn() } },
}));
jest.mock('../advisor/advisorStorage', () => ({
  ...jest.requireActual('../advisor/advisorStorage'),
  fetchAdvisorSettings: jest.fn(), saveAdvisorSettings: jest.fn(),
}));

const fetchSettings = fetchAdvisorSettings as jest.Mock;
const saveSettings = saveAdvisorSettings as jest.Mock;
const authChange = supabase.auth.onAuthStateChange as jest.Mock;
const draftKey = 'advisor_settings_pending_v1:https%3A%2F%2Ftest.supabase.co:user-a';
const tick = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const setAppState = (state: AppStateStatus) => Object.defineProperty(AppState, 'currentState', { configurable: true, value: state });
let changeState: (state: AppStateStatus) => void;
let changeAccount: (event: string, session: { user: { id: string } } | null) => void;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  setAppState('active');
  fetchSettings.mockResolvedValue({ ...DEFAULT_ADVISOR_SETTINGS, themes: [...DEFAULT_ADVISOR_SETTINGS.themes] });
  saveSettings.mockResolvedValue(true);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    changeState = listener;
    return { remove: jest.fn() };
  });
  authChange.mockImplementation(listener => {
    changeAccount = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
});
afterEach(async () => { await clearAdvisorSettingsSync(); jest.restoreAllMocks(); jest.useRealTimers(); });

async function loaded(userId = 'user-a') {
  const sync = getAdvisorSettingsSync(userId);
  sync.start();
  await sync.reload();
  return sync;
}

it('updates immediately, retains the selection after failure, and confirms an automatic retry', async () => {
  const sync = await loaded();
  saveSettings.mockResolvedValueOnce(false);
  sync.update(current => ({ ...current, themes: ['sleep'] }));
  expect(sync.getSnapshot()).toMatchObject({ settings: { themes: ['sleep'] }, status: 'saving' });
  await tick();
  expect(sync.getSnapshot().status).toBe('retrying');
  expect(JSON.parse((await AsyncStorage.getItem(draftKey))!)).toMatchObject({ themes: ['sleep'] });
  await jest.advanceTimersByTimeAsync(999);
  expect(saveSettings).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(saveSettings).toHaveBeenCalledTimes(2);
  expect(sync.getSnapshot()).toMatchObject({ settings: { themes: ['sleep'] }, status: 'idle' });
  expect(await AsyncStorage.getItem(draftKey)).toBeNull();
});

it('serializes rapid edits and retries the latest complete selection', async () => {
  const sync = await loaded();
  const first = deferred<boolean>();
  saveSettings.mockReturnValueOnce(first.promise).mockResolvedValueOnce(false);
  sync.update(current => ({ ...current, themes: ['sleep'] }));
  await tick();
  sync.update(current => ({ ...current, themes: [...current.themes, 'feeding'] }));
  sync.update(current => ({ ...current, themes: current.themes.filter(theme => theme !== 'sleep') }));
  await tick();
  expect(saveSettings).toHaveBeenCalledTimes(1);
  first.resolve(true);
  await tick();
  expect(saveSettings).toHaveBeenCalledTimes(2);
  expect(saveSettings.mock.calls[1][0].themes).toEqual(['feeding']);
  expect(sync.getSnapshot().status).toBe('retrying');
  await jest.advanceTimersByTimeAsync(1_000);
  expect(saveSettings.mock.calls[2][0].themes).toEqual(['feeding']);
  expect(sync.getSnapshot().settings?.themes).toEqual(['feeding']);
});

it('uses growing delays capped at 30 seconds and allows an immediate manual retry', async () => {
  const sync = await loaded();
  saveSettings.mockResolvedValue(false);
  sync.update(current => ({ ...current, enabled: false }));
  await tick();
  for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
    const count = saveSettings.mock.calls.length;
    await jest.advanceTimersByTimeAsync(delay - 1);
    expect(saveSettings).toHaveBeenCalledTimes(count);
    await jest.advanceTimersByTimeAsync(1);
    expect(saveSettings).toHaveBeenCalledTimes(count + 1);
  }
  saveSettings.mockResolvedValue(true);
  sync.retry();
  await tick();
  expect(sync.getSnapshot().status).toBe('idle');
});

it('restores a pending draft on reopening without replacing it with stale server data', async () => {
  const sync = await loaded();
  saveSettings.mockResolvedValueOnce(false);
  sync.update(current => ({ ...current, themes: [] }));
  await tick();
  await clearAdvisorSettingsSync();
  const reopened = await loaded();
  await tick();
  expect(reopened).not.toBe(sync);
  expect(reopened.getSnapshot().settings?.themes).toEqual([]);
  expect(fetchSettings).toHaveBeenCalledTimes(1);
  expect(saveSettings.mock.calls[1][0].themes).toEqual([]);
  expect(reopened.getSnapshot().status).toBe('idle');
});

it('ignores a stale read that completes after the newer edit was saved', async () => {
  const sync = await loaded();
  const oldRead = deferred<AdvisorSettings>();
  fetchSettings.mockReturnValueOnce(oldRead.promise);
  const reload = sync.reload();
  await tick();
  sync.update(current => ({ ...current, themes: ['weather'] }));
  await tick();
  expect(sync.getSnapshot().status).toBe('idle');
  oldRead.resolve(DEFAULT_ADVISOR_SETTINGS);
  await reload;
  expect(sync.getSnapshot().settings?.themes).toEqual(['weather']);
});

it('pauses retries in the background and retries when the app becomes active', async () => {
  const sync = await loaded();
  saveSettings.mockResolvedValueOnce(false);
  sync.update(current => ({ ...current, themes: ['motivation'] }));
  await tick();
  setAppState('background'); changeState('background');
  await jest.advanceTimersByTimeAsync(60_000);
  expect(saveSettings).toHaveBeenCalledTimes(1);
  setAppState('active'); changeState('active');
  await tick();
  expect(saveSettings).toHaveBeenCalledTimes(2);
  expect(sync.getSnapshot().status).toBe('idle');
});

it('cancels a timed-out request and retries without losing the selection', async () => {
  const sync = await loaded();
  saveSettings.mockImplementationOnce((_settings, options) => new Promise<boolean>(resolve => {
    options.signal.addEventListener('abort', () => resolve(false), { once: true });
  }));
  sync.update(current => ({ ...current, themes: ['sleep'] }));
  await tick();
  await jest.advanceTimersByTimeAsync(15_000);
  expect(sync.getSnapshot()).toMatchObject({ settings: { themes: ['sleep'] }, status: 'retrying' });
  await jest.advanceTimersByTimeAsync(1_000);
  expect(sync.getSnapshot().status).toBe('idle');
  expect(saveSettings).toHaveBeenCalledTimes(2);
});

it('waits for outstanding local writes before allowing device storage to be cleared', async () => {
  const sync = await loaded();
  const writing = deferred<void>();
  jest.spyOn(AsyncStorage, 'setItem').mockReturnValueOnce(writing.promise);
  sync.update(current => ({ ...current, themes: ['feeding'] }));
  await tick();
  let cleared = false;
  const cleanup = clearAdvisorSettingsSync().then(async () => { await AsyncStorage.clear(); cleared = true; });
  await tick();
  expect(cleared).toBe(false);
  writing.resolve();
  await cleanup;
  await tick();
  expect(saveSettings).not.toHaveBeenCalled();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});

it('aborts an in-flight save and drains local writes before account cleanup', async () => {
  const sync = await loaded();
  const saving = deferred<boolean>();
  saveSettings.mockReturnValueOnce(saving.promise);
  sync.update(current => ({ ...current, themes: ['feeding'] }));
  await tick();
  const signal = saveSettings.mock.calls[0][1].signal as AbortSignal;
  changeAccount('SIGNED_OUT', null);
  expect(signal.aborted).toBe(true);
  await clearAdvisorSettingsSync();
  await AsyncStorage.clear();
  saving.resolve(true);
  await tick();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(saveSettings).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  const other = await loaded('user-b');
  expect(other.getSnapshot().settings).toEqual(DEFAULT_ADVISOR_SETTINGS);
});

it('shows initial load failures and retains confirmed settings during a failed refresh', async () => {
  fetchSettings.mockRejectedValueOnce(new Error('offline'));
  const sync = await loaded();
  expect(sync.getSnapshot()).toEqual({ settings: null, status: 'load-error' });
  sync.retry(); await tick();
  expect(sync.getSnapshot().settings).toEqual(DEFAULT_ADVISOR_SETTINGS);
  fetchSettings.mockRejectedValueOnce(new Error('offline'));
  await sync.reload();
  expect(sync.getSnapshot().settings).toEqual(DEFAULT_ADVISOR_SETTINGS);
});

it('keeps retrying if the local draft cannot be saved yet', async () => {
  const sync = await loaded();
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage busy')).mockRejectedValueOnce(new Error('storage busy'));
  sync.update(current => ({ ...current, themes: ['sleep'] }));
  await tick();
  expect(sync.getSnapshot().status).toBe('retrying');
  expect(saveSettings).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1_000);
  expect(sync.getSnapshot().status).toBe('idle');
});
