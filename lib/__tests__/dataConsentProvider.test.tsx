import React from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DataConsentProvider, useDataConsents } from '../../contexts/DataConsentContext';
import { getRuntimeDataConsents, setConsentIdentity, setRuntimeDataConsents } from '../dataConsentRuntime';
import type { DataConsentSnapshot } from '../dataConsentTypes';

const mockRefresh = jest.fn();
const mockHydrate = jest.fn();
let mockUserId = 'a';
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUserId }, loading: false }) }));
jest.mock('@/lib/dataConsents', () => ({ hydrateDataConsents: (...args: unknown[]) => mockHydrate(...args), refreshAndSyncDataConsents: (...args: unknown[]) => mockRefresh(...args), recordDataConsent: jest.fn() }));
jest.mock('@/lib/dataConsentCleanup', () => ({ clearConsentDeviceData: jest.fn(async () => {}) }));
jest.mock('@/lib/localization', () => ({ getDeviceAppLocale: () => 'de' }));
jest.mock('@/lib/dataConsentRuntime', () => {
  const previous = process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED;
  process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = 'true';
  const runtime = jest.requireActual('@/lib/dataConsentRuntime');
  process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED = previous;
  return runtime;
});

const snapshot: DataConsentSnapshot = {
  enabled: true, userId: 'a', revision: 2, documentVersion: '2026-10-01.1', healthAllowed: true, aiAllowed: true,
  health: { decision: 'granted', documentVersion: '2026-10-01.1', decidedAt: '2026-10-01T00:00:00Z' },
  ai: { decision: 'granted', documentVersion: '2026-10-01.1', decidedAt: '2026-10-01T00:00:00Z' },
};
let state: ReturnType<typeof useDataConsents>;
let tree: ReactTestRenderer;
let appStateListener: (state: AppStateStatus) => void;
function Consumer() {
  const current = useDataConsents();
  React.useEffect(() => { state = current; }, [current]);
  return <Text>{current.mode}</Text>;
}
const open = async () => { await act(async () => { tree = create(<DataConsentProvider><Consumer /></DataConsentProvider>); }); };
beforeEach(() => {
  mockUserId = 'a';
  setConsentIdentity(null); setConsentIdentity('a');
  mockRefresh.mockReset(); mockHydrate.mockReset().mockResolvedValue(undefined);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener; return { remove: jest.fn() };
  });
});
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); });

it('uses the real provider to block new builds when the server release is inactive', async () => {
  mockRefresh.mockImplementation(async () => { const next = { ...snapshot, enabled: false }; setRuntimeDataConsents(next); return next; });
  await open();
  expect(state.mode).toBe('unavailable'); expect(state.healthAllowed).toBe(false); expect(state.aiAllowed).toBe(false);
  expect(state.mode).not.toBe('preview'); expect(mockRefresh).toHaveBeenCalledWith('a', 'de');
});
it('uses persisted active grants when the client and backend release are both ready', async () => {
  mockRefresh.mockImplementation(async () => { setRuntimeDataConsents(snapshot); return snapshot; });
  await open();
  expect(state.mode).toBe('active'); expect(state.healthAllowed).toBe(true); expect(state.aiAllowed).toBe(true);
});
it('shows real choices for an unenrolled account without treating legacy server access as consent', async () => {
  const ready = { ...snapshot, revision: 0, health: null, ai: null };
  mockRefresh.mockImplementation(async () => { setRuntimeDataConsents(ready); return ready; });
  await open();
  expect(state.mode).toBe('active');
  expect(state.healthAllowed).toBe(false); expect(state.aiAllowed).toBe(false);
  expect(state.snapshot?.health).toBeNull(); expect(state.snapshot?.ai).toBeNull();
});
it('recovers the installed candidate from its inactive cached snapshot at the same revision', async () => {
  const ready = { ...snapshot, revision: 0, health: null, ai: null };
  mockHydrate.mockImplementation(async () => { setRuntimeDataConsents({ ...ready, enabled: false }); });
  mockRefresh.mockImplementation(async () => { setRuntimeDataConsents(ready); return ready; });
  await open();
  expect(state.mode).toBe('active'); expect(state.snapshot?.enabled).toBe(true);
  expect(state.healthAllowed).toBe(false); expect(state.aiAllowed).toBe(false);
});
it('cannot reopen health processing when the release check fails', async () => {
  mockRefresh.mockRejectedValue(new Error('offline'));
  await open();
  expect(state.mode).toBe('unavailable'); expect(state.healthAllowed).toBe(false); expect(state.aiAllowed).toBe(false);
  expect(getRuntimeDataConsents().snapshot).toBeNull();
});
it('opens from the saved decision while the server check is still running', async () => {
  mockHydrate.mockImplementation(async () => { setRuntimeDataConsents(snapshot); });
  mockRefresh.mockReturnValue(new Promise(() => {}));await open();
  expect(mockHydrate).toHaveBeenCalledWith('a');expect(state.mode).toBe('active');expect(state.healthAllowed).toBe(true);
});
it('keeps the saved decision usable when the background check fails offline', async () => {
  mockHydrate.mockImplementation(async () => { setRuntimeDataConsents(snapshot); });
  mockRefresh.mockRejectedValue(new Error('offline'));await open();
  expect(state.mode).toBe('active');expect(state.healthAllowed).toBe(true);expect(state.aiAllowed).toBe(true);
  expect(getRuntimeDataConsents().snapshot).toEqual(snapshot);
});
it('does not return to the consent loading screen after background and foreground', async () => {
  mockRefresh.mockImplementation(async () => { setRuntimeDataConsents(snapshot); return snapshot; });await open();
  mockRefresh.mockReturnValue(new Promise(() => {}));
  act(() => appStateListener('inactive'));expect(state.mode).toBe('active');expect(state.healthAllowed).toBe(true);
  await act(async () => { appStateListener('active'); });
  expect(state.mode).toBe('active');expect(state.healthAllowed).toBe(true);expect(mockRefresh).toHaveBeenCalledTimes(2);
  expect(mockHydrate).toHaveBeenCalledTimes(1);
});
it('applies a withdrawal discovered by the background check', async () => {
  mockHydrate.mockImplementation(async () => { setRuntimeDataConsents(snapshot); });
  mockRefresh.mockResolvedValue(snapshot);await open();
  mockRefresh.mockImplementation(async () => {
    const revoked={...snapshot,revision:3,healthAllowed:false,aiAllowed:false,health:{...snapshot.health!,decision:'revoked' as const}};
    setRuntimeDataConsents(revoked);return revoked;
  });
  await act(async () => { await state.refresh(); });
  expect(state.healthAllowed).toBe(false);expect(state.aiAllowed).toBe(false);
});
it('does not inherit a saved grant when the account changes', async () => {
  mockHydrate.mockImplementation(async (id: string) => { if (id === 'a') setRuntimeDataConsents(snapshot); });
  mockRefresh.mockReturnValue(new Promise(() => {}));await open();expect(state.healthAllowed).toBe(true);
  mockUserId = 'b';await act(async () => { tree.update(<DataConsentProvider><Consumer /></DataConsentProvider>); });
  expect(state.healthAllowed).toBe(false);expect(state.aiAllowed).toBe(false);expect(state.snapshot).toBeNull();
  expect(mockHydrate).toHaveBeenLastCalledWith('b');
});
