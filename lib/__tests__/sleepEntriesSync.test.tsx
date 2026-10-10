import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { supabase } from '@/lib/supabase';
import { useSleepEntriesSync, type SleepEntriesSyncOptions } from '@/hooks/useSleepEntriesSync';

const mockScreenFocusContext = React.createContext(true);
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useContext, useEffect } = jest.requireActual('react');
    const focused = useContext(mockScreenFocusContext);
    useEffect(() => focused ? callback() : undefined, [callback, focused]);
  },
}));

type ChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};
type ChangeBinding = {
  filter: { event: '*' | 'DELETE'; schema: string; table: string; filter?: string };
  callback: (payload: ChangePayload) => void;
};
type MockChannel = {
  topic: string;
  bindings: ChangeBinding[];
  status?: (status: string) => void;
  on: jest.Mock;
  subscribe: jest.Mock;
};
const mockChannels: MockChannel[] = [];
const mockActiveRead = jest.fn();
type MockActiveQuery = { select: jest.Mock; eq: jest.Mock; abortSignal: jest.Mock; maybeSingle: jest.Mock };
const mockActiveQueries: MockActiveQuery[] = [];
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => {
      const query: MockActiveQuery = {
        select: jest.fn(() => query), eq: jest.fn(() => query),
        abortSignal: jest.fn(() => query), maybeSingle: jest.fn(() => mockActiveRead()),
      };
      mockActiveQueries.push(query);
      return query;
    }),
    channel: jest.fn((topic: string) => {
      const channel: MockChannel = {
        topic,
        bindings: [],
        on: jest.fn((_type: string, filter: ChangeBinding['filter'], callback: ChangeBinding['callback']) => {
          channel.bindings.push({ filter, callback });
          return channel;
        }),
        subscribe: jest.fn((callback: (status: string) => void) => {
          channel.status = callback;
          return channel;
        }),
      };
      mockChannels.push(channel);
      return channel;
    }),
    removeChannel: jest.fn(async () => 'ok'),
  },
}));

const originalAppState = AppState.currentState;
const appListeners = new Set<(state: AppStateStatus) => void>();
let tree: ReactTestRenderer | null = null;
let options: SleepEntriesSyncOptions;
let refresh: jest.Mock<Promise<void>, []>;
let invalidate: jest.Mock<void, []>;

function SyncHarness(props: SleepEntriesSyncOptions) {
  useSleepEntriesSync(props);
  return null;
}

function Harness({ focused = true, ...props }: SleepEntriesSyncOptions & { focused?: boolean }) {
  return <mockScreenFocusContext.Provider value={focused}>
    <SyncHarness {...props} />
  </mockScreenFocusContext.Provider>;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockChannels.length = 0;
  mockActiveQueries.length = 0;
  mockActiveRead.mockReset().mockResolvedValue({ data: { id: 'running-entry', end_time: null }, error: null });
  appListeners.clear();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    appListeners.add(callback);
    return { remove: () => { appListeners.delete(callback); } };
  });
  refresh = jest.fn(async () => {});
  invalidate = jest.fn();
  options = {
    userId: 'parent-a', babyId: 'baby-a', enabled: true,
    entryIds: ['running-entry', 'finished-entry'], onRefresh: refresh, onInvalidate: invalidate,
  };
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = null;
  jest.restoreAllMocks();
  jest.useRealTimers();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: originalAppState });
});

async function mount(focused = true) {
  await act(async () => { tree = create(<Harness {...options} focused={focused} />); });
}

async function update(next: Partial<SleepEntriesSyncOptions> & { focused?: boolean }) {
  const { focused = true, ...changedOptions } = next;
  options = { ...options, ...changedOptions };
  await act(async () => { tree?.update(<Harness {...options} focused={focused} />); });
}

async function tick(ms = 200) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}

function event(payload: ChangePayload, binding = 0, channel = mockChannels[0]) {
  act(() => { channel.bindings[binding].callback(payload); });
}

function appState(nextState: AppStateStatus) {
  act(() => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: nextState });
    appListeners.forEach(listener => listener(nextState));
  });
}

function deferredRefresh() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

it('loads on focus and subscribes with separate supported identity filters plus a DELETE binding', async () => {
  await mount(false);
  expect(refresh).not.toHaveBeenCalled();
  expect(supabase.channel).not.toHaveBeenCalled();
  await update({ focused: true });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(mockChannels).toHaveLength(1);
  expect(mockChannels[0].bindings.map(binding => binding.filter)).toEqual([
    { event: '*', schema: 'public', table: 'sleep_entries', filter: 'user_id=eq.parent-a' },
    { event: '*', schema: 'public', table: 'sleep_entries', filter: 'partner_id=eq.parent-a' },
    { event: '*', schema: 'public', table: 'sleep_entries', filter: 'shared_with_user_id=eq.parent-a' },
    { event: 'DELETE', schema: 'public', table: 'sleep_entries' },
    { event:'*',schema:'public',table:'sleep_entries',filter:'baby_id=eq.baby-a' },
    { event:'*',schema:'public',table:'baby_members',filter:'user_id=eq.parent-a' },
    { event:'*',schema:'public',table:'sleep_entry_shares',filter:'shared_with_id=eq.parent-a' },
    { event:'*',schema:'public',table:'account_links',filter:'creator_id=eq.parent-a' },
    { event:'*',schema:'public',table:'account_links',filter:'invited_id=eq.parent-a' },
  ]);
});

it.each([
  ['own insert', 0, 'INSERT', { id: 'own-entry', user_id: 'parent-a', baby_id: 'baby-a' }],
  ['partner update', 1, 'UPDATE', { id: 'partner-entry', partner_id: 'parent-a', baby_id: 'baby-a', end_time: 'ended' }],
  ['legacy shared insert', 2, 'INSERT', { id: 'legacy-entry', shared_with_user_id: 'parent-a', baby_id: null }],
] as const)('invalidates immediately and reads fresh data for %s', async (_name, binding, eventType, newRecord) => {
  await mount();
  refresh.mockClear();
  invalidate.mockClear();
  event({ eventType, new: newRecord, old: {} }, binding);
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
  await tick(199);
  expect(refresh).not.toHaveBeenCalled();
  await tick(1);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('coalesces update bursts and preserves a change received during the running read', async () => {
  await mount();
  refresh.mockClear();
  invalidate.mockClear();
  const pending = deferredRefresh();
  refresh.mockImplementationOnce(() => pending.promise);
  const change: ChangePayload = { eventType: 'UPDATE', new: { id: 'running-entry', baby_id: 'baby-a' }, old: {} };
  event(change);
  event(change, 1);
  event(change, 2);
  expect(invalidate).toHaveBeenCalledTimes(3);
  await tick();
  expect(refresh).toHaveBeenCalledTimes(1);
  event(change);
  await tick(1000);
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(); });
  await tick();
  expect(refresh).toHaveBeenCalledTimes(2);
  await tick(60000);
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('refreshes on each successful join, including reconnect, without polling on channel errors', async () => {
  await mount();
  refresh.mockClear();
  act(() => { mockChannels[0].status?.('SUBSCRIBED'); });
  await tick();
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => {
    mockChannels[0].status?.('CHANNEL_ERROR');
    mockChannels[0].status?.('TIMED_OUT');
  });
  await tick(60000);
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => { mockChannels[0].status?.('SUBSCRIBED'); });
  await tick();
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('waits while backgrounded and refreshes immediately on a real foreground transition', async () => {
  await mount();
  refresh.mockClear();
  appState('inactive');
  appState('background');
  event({ eventType: 'UPDATE', new: { id: 'running-entry', baby_id: null }, old: {} });
  act(() => { mockChannels[0].status?.('SUBSCRIBED'); });
  await tick(60000);
  expect(refresh).not.toHaveBeenCalled();
  appState('active');
  await act(async () => {});
  expect(refresh).toHaveBeenCalledTimes(1);
  appState('active');
  await tick(60000);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('drops a queued foreground event when the app backgrounds, then reads it on return', async () => {
  await mount();
  refresh.mockClear();
  event({ eventType: 'UPDATE', new: { id: 'running-entry', baby_id: 'baby-a' }, old: {} });
  appState('background');
  await tick();
  expect(refresh).not.toHaveBeenCalled();
  appState('active');
  await act(async () => {});
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('ignores another baby but refreshes NULL legacy rows, baby moves, and known entries with missing old metadata', async () => {
  await mount();
  refresh.mockClear();
  invalidate.mockClear();
  event({ eventType: 'INSERT', new: { id: 'other-entry', baby_id: 'baby-b' }, old: {} });
  event({ eventType: 'UPDATE', new: { id: 'other-entry', baby_id: 'baby-b' }, old: { baby_id: 'baby-b' } });
  await tick();
  expect(refresh).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  event({ eventType: 'INSERT', new: { id: 'legacy-entry', baby_id: null }, old: {} });
  await tick();
  event({ eventType: 'UPDATE', new: { id: 'moved-entry', baby_id: 'baby-b' }, old: { baby_id: 'baby-a' } });
  await tick();
  event({ eventType: 'UPDATE', new: { id: 'running-entry', baby_id: 'baby-b' }, old: {} });
  await tick();
  expect(refresh).toHaveBeenCalledTimes(3);
});

it('invalidates an unknown-old UPDATE to another baby while the initial snapshot is pending', async () => {
  const pending = deferredRefresh();
  refresh.mockImplementationOnce(() => pending.promise);
  options = { ...options, entryIds: [] };
  await mount();
  invalidate.mockClear();
  event({
    eventType: 'UPDATE',
    new: { id: 'not-loaded-yet', baby_id: 'baby-b', end_time: 'ended' },
    old: {},
  });
  expect(invalidate).toHaveBeenCalledTimes(1);
  await tick(1000);
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(); });
  await tick();
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('refreshes a known primary-key-only DELETE and ignores unknown global deletes', async () => {
  await mount();
  refresh.mockClear();
  invalidate.mockClear();
  event({ eventType: 'DELETE', new: {}, old: { id: 'unknown-entry' } }, 3);
  await tick();
  expect(refresh).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  event({ eventType: 'DELETE', new: {}, old: { id: 'running-entry' } }, 3);
  expect(invalidate).toHaveBeenCalledTimes(1);
  await tick();
  expect(refresh).toHaveBeenCalledTimes(1);
  event({ eventType: 'DELETE', new: {}, old: { id: 'finished-entry' } }, 1);
  await tick();
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('uses new callbacks and entry IDs after rerender without resubscribing', async () => {
  await mount();
  refresh.mockClear();
  const nextRefresh = jest.fn(async () => {});
  const nextInvalidate = jest.fn();
  await update({ entryIds: ['new-entry'], onRefresh: nextRefresh, onInvalidate: nextInvalidate });
  expect(supabase.channel).toHaveBeenCalledTimes(1);
  expect(supabase.removeChannel).not.toHaveBeenCalled();
  event({ eventType: 'DELETE', new: {}, old: { id: 'running-entry' } }, 3);
  await tick();
  expect(nextRefresh).not.toHaveBeenCalled();
  event({ eventType: 'DELETE', new: {}, old: { id: 'new-entry' } }, 3);
  expect(nextInvalidate).toHaveBeenCalledTimes(1);
  await tick();
  expect(nextRefresh).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
});

it('invalidates pending reads and removes timers, AppState listeners, and channel on blur', async () => {
  await mount();
  const oldChannel = mockChannels[0];
  refresh.mockClear();
  const schedule = jest.spyOn(global, 'setTimeout');
  const cancel = jest.spyOn(global, 'clearTimeout');
  event({ eventType: 'UPDATE', new: { id: 'running-entry', baby_id: 'baby-a' }, old: {} });
  const timerIndex = schedule.mock.calls.findIndex((call) => call[1] === 200);
  expect(timerIndex).toBeGreaterThanOrEqual(0);
  const timer = schedule.mock.results[timerIndex].value;
  invalidate.mockClear();
  await update({ focused: false });
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(supabase.removeChannel).toHaveBeenCalledWith(oldChannel);
  expect(appListeners.size).toBe(0);
  expect(cancel).toHaveBeenCalledWith(timer);
  event({ eventType: 'UPDATE', new: { id: 'running-entry', baby_id: 'baby-a' }, old: {} }, 0, oldChannel);
  act(() => { oldChannel.status?.('SUBSCRIBED'); });
  appState('background');
  appState('active');
  await tick(60000);
  expect(refresh).not.toHaveBeenCalled();
  await update({ focused: true });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(mockChannels).toHaveLength(2);
  expect(mockChannels[1].topic).not.toBe(oldChannel.topic);
});

it('does not rerun a request after cleanup even if an event arrived while it was pending', async () => {
  const pending = deferredRefresh();
  refresh.mockImplementationOnce(() => pending.promise);
  await mount();
  event({ eventType: 'UPDATE', new: { id: 'running-entry', baby_id: 'baby-a' }, old: {} });
  await update({ focused: false });
  await act(async () => { pending.resolve(); });
  await tick(60000);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it.each([
  { enabled: false },
  { userId: null },
])('does not subscribe or reload while prerequisites are absent: %p', async (change) => {
  options = { ...options, ...change };
  await mount();
  expect(refresh).not.toHaveBeenCalled();
  expect(supabase.channel).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
});

it('releases a failed refresh and accepts the next event without retry polling', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  refresh.mockRejectedValueOnce(new Error('offline'));
  await mount();
  expect(warn).toHaveBeenCalledTimes(1);
  await tick(60000);
  expect(refresh).toHaveBeenCalledTimes(1);
  event({ eventType: 'UPDATE', new: { id: 'running-entry', baby_id: 'baby-a' }, old: {} });
  await tick();
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('scope, membership and share signals request an authorized snapshot instead of applying event values', async () => {
  await mount();
  for (const binding of mockChannels[0].bindings.filter(b => b.filter.table !== 'sleep_entries' || b.filter.filter?.startsWith('baby_id='))) {
    act(() => binding.callback({eventType:'UPDATE',new:{},old:{}}));
  }
  await tick(200);
  expect(refresh).toHaveBeenCalledTimes(2);
});

it.each([{ id: 'running-entry', end_time: '2026-10-09T08:00:00Z' }, null])(
  'recovers a stopped or deleted partner timer when its realtime event is never delivered: %p', async data => {
    options = { ...options, activeEntryId: 'running-entry' };
    mockActiveRead.mockResolvedValue({ data, error: null });
    await mount();
    refresh.mockClear(); invalidate.mockClear();
    await tick(15000);
    expect(supabase.from).toHaveBeenCalledWith('sleep_entries');
    expect(mockActiveQueries[0].select).toHaveBeenCalledWith('id,end_time');
    expect(mockActiveQueries[0].eq).toHaveBeenCalledWith('id', 'running-entry');
    expect(invalidate).toHaveBeenCalledTimes(1);
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
  },
);

it('only probes the active timer; an unchanged or failed probe never reloads history or changes visible state', async () => {
  options = { ...options, activeEntryId: 'running-entry' };
  await mount(); refresh.mockClear(); invalidate.mockClear();
  await tick(15000);
  mockActiveRead.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await tick(15000);
  mockActiveRead.mockRejectedValueOnce(new Error('Network request failed'));
  await tick(15000);
  expect(mockActiveRead).toHaveBeenCalledTimes(3);
  expect(refresh).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
  await update({ activeEntryId: null });
  await tick(60000);
  expect(mockActiveRead).toHaveBeenCalledTimes(3);
});

it('aborts probes in the background and on blur, and ignores a late result for a replaced timer', async () => {
  options = { ...options, activeEntryId: 'running-entry' };
  let resolve!: (value: any) => void;
  mockActiveRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await mount(); refresh.mockClear(); invalidate.mockClear();
  await tick(15000);
  const signal = mockActiveQueries[0].abortSignal.mock.calls[0][0] as AbortSignal;
  appState('background'); expect(signal.aborted).toBe(true);
  await tick(60000); expect(mockActiveRead).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ data: null, error: null }); });
  expect(invalidate).not.toHaveBeenCalled();
  appState('active'); await act(async () => {}); refresh.mockClear(); invalidate.mockClear();
  mockActiveRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await tick(15000);
  await update({ activeEntryId: 'new-entry' });
  await act(async () => { resolve({ data: null, error: null }); });
  await tick(); expect(refresh).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
  mockActiveRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await tick(15000);
  const lastSignal = mockActiveQueries.at(-1)!.abortSignal.mock.calls[0][0] as AbortSignal;
  await update({ focused: false }); expect(lastSignal.aborted).toBe(true);
  await act(async () => { resolve({ data: null, error: null }); });
  refresh.mockClear(); await tick(60000); expect(refresh).not.toHaveBeenCalled();
});

it('does not overlap probes or interrupt an ongoing snapshot, and ignores a timed-out probe', async () => {
  options = { ...options, activeEntryId: 'running-entry' };
  const pending = deferredRefresh();
  refresh.mockImplementationOnce(() => pending.promise);
  await mount(); invalidate.mockClear();
  await tick(30000);
  expect(mockActiveRead).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
  await act(async () => { pending.resolve(); });
  let resolve!: (value: any) => void;
  mockActiveRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await tick(15000);
  await tick(15000);
  expect(mockActiveRead).toHaveBeenCalledTimes(1);
  expect(mockActiveQueries[0].abortSignal.mock.calls[0][0].aborted).toBe(true);
  await act(async () => { resolve({ data: null, error: null }); });
  expect(invalidate).not.toHaveBeenCalled();
  mockActiveRead.mockResolvedValueOnce({ data: null, error: null });
  await tick(15000); await tick();
  expect(refresh).toHaveBeenCalledTimes(2);
});
