import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { findFreshActiveSleepEntry, isStaleActiveSleepEntry } from '../sleepEntryGuards';

// Exercise the screen's actual loader without importing the screen or mocking
// its native UI. The AST extraction makes a regression in the shipped loader
// fail here; there is no copied implementation of the synchronization logic.
const screenPath = join(__dirname, '../../app/(tabs)/sleep-tracker.tsx');
const screenSource = readFileSync(screenPath, 'utf8');
const screenAst = ts.createSourceFile(
  screenPath,
  screenSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let loaderNode: ts.FunctionDeclaration | undefined;
const handlerNames = [
  'invalidateSleepDataRequests',
  'beginSleepMutation',
  'handleStartSleep',
  'handleStopSleep',
  'handlePauseNightSleep',
  'handleSplitNightSegment',
  'handleResumeNightSleep',
] as const;
const handlerNodes: Partial<Record<typeof handlerNames[number], ts.VariableDeclaration>> = {};
const visit = (node: ts.Node): void => {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'loadSleepData') {
    loaderNode = node;
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    const name = node.name.text as typeof handlerNames[number];
    if (handlerNames.includes(name)) handlerNodes[name] = node;
  }
  ts.forEachChild(node, visit);
};
visit(screenAst);
if (!loaderNode) throw new Error('The sleep screen loadSleepData function was not found.');
const loaderJs = ts.transpileModule(`${loaderNode.getText(screenAst)}\nloadSleepData;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const handlerSource = handlerNames.map(name => {
  const node = handlerNodes[name];
  if (!node) throw new Error(`The sleep screen ${name} declaration was not found.`);
  return `const ${node.getText(screenAst)};`;
}).join('\n');
const handlersJs = ts.transpileModule(`${handlerSource}\n({
  begin: beginSleepMutation,
  start: handleStartSleep,
  stop: handleStopSleep,
  pause: handlePauseNightSleep,
  split: handleSplitNightSegment,
});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const resumeJs = ts.transpileModule(
  `const ${handlerNodes.handleResumeNightSleep!.getText(screenAst)};\nhandleResumeNightSleep;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;

const NOW = Date.parse('2026-10-07T06:36:55.000Z');
const SCOPE = 'me|supabase|shared-baby';
class FixedDate extends Date {
  constructor(value?: string | number) {
    super(value ?? NOW);
  }

  static now() {
    return NOW;
  }
}

type Entry = {
  id: string;
  baby_id: string | null;
  user_id: string;
  partner_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes?: number;
  period?: 'day' | 'night';
};
type ReadResult = { success: boolean; entries: Entry[]; error?: string };
type WriteResult = {
  primary: { data: Entry | null; error: Error | null };
  secondary: { data: null; error: Error | null };
};
const started: Entry = {
  id: 'partner-sleep',
  baby_id: 'shared-baby',
  user_id: 'partner',
  partner_id: 'me',
  start_time: '2026-10-07T05:30:00.000Z',
  end_time: null,
  period: 'night',
};
const stopped: Entry = {
  ...started,
  end_time: '2026-10-07T06:30:00.000Z',
  duration_minutes: 60,
};
const previousHistory: Entry[] = [{
  ...stopped,
  id: 'previous-nap',
  start_time: '2026-10-06T12:00:00.000Z',
  end_time: '2026-10-06T13:00:00.000Z',
  period: 'day',
}];
const success = (entries: Entry[]): ReadResult => ({ success: true, entries });
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

function harness(
  initialActive: Entry | null,
  response: ReadResult | (() => Promise<ReadResult>),
  initialHistory: Entry[] = [],
) {
  const state = {
    active: clone(initialActive),
    entries: clone(initialHistory),
    loading: false,
    liveLoaded: Boolean(initialActive),
    refreshing: false,
  };
  const requestId = { current: 0 };
  const scopeRef = { current: SCOPE };
  const mutationRef = { current: { scope: SCOPE, pending: 0 } };
  const activeRef = { current: state.active };
  const periodOverrides = { current: {} as Record<string, 'day' | 'night'> };
  const classifier = (entry: Entry, override?: 'day' | 'night'): Entry => ({
    ...entry,
    period: override ?? entry.period ?? 'day',
  });
  const classifierRef = { current: classifier };
  const nightWindowRef = { current: {} };
  const read = jest.fn(async (): Promise<ReadResult> =>
    typeof response === 'function' ? response() : clone(response),
  );
  const storedPeriod = jest.fn(async (_entry: Entry): Promise<'day' | 'night' | undefined> => undefined);
  const context = {
    Date: FixedDate,
    console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    activeBabyId: started.baby_id,
    activeSleepEntryRef: activeRef,
    activeEntryPeriodOverridesRef: periodOverrides,
    loadSleepDataRequestIdRef: requestId,
    sleepDataScopeKey: SCOPE,
    sleepDataScopeRef: scopeRef,
    sleepMutationRef: mutationRef,
    hasAutoSelectedDateRef: { current: true },
    selectedDate: new FixedDate(),
    nightWindowSettings: nightWindowRef.current,
    nightWindowSettingsRef: nightWindowRef,
    classifySleepEntryRef: classifierRef,
    isStaleActiveSleepEntry: (entry: Entry) => isStaleActiveSleepEntry(entry, NOW),
    findFreshActiveSleepEntry: (entries: Entry[]) => findFreshActiveSleepEntry(entries, NOW),
    loadVisibleSleepEntries: read,
    loadStoredActiveSleepPeriodOverride: storedPeriod,
    classifySleepEntry: classifier,
    isEntryAssignedToDate: jest.fn(() => true),
    getAssignedDateForEntry: jest.fn((entry: Entry, _settings: unknown) => new FixedDate(entry.start_time)),
    selectTab: jest.fn(),
    setSelectedDate: jest.fn(),
    setIsLoading: (value: boolean) => { state.loading = value; },
    setIsLiveStatusLoaded: (value: boolean) => { state.liveLoaded = value; },
    setRefreshing: (value: boolean) => { state.refreshing = value; },
    setPredictionLoading: jest.fn(),
    setActiveSleepEntry: (value: Entry | null | ((previous: Entry | null) => Entry | null)) => {
      state.active = typeof value === 'function' ? value(state.active) : value;
    },
    setSleepEntries: (value: Entry[] | ((previous: Entry[]) => Entry[])) => {
      state.entries = typeof value === 'function' ? value(state.entries) : value;
    },
    t: (key: string) => key,
  };
  const load = runInNewContext(loaderJs, context, { filename: screenPath }) as () => Promise<void>;

  // Model the generation invalidation and committed state of an in-app write.
  // Mutation handler coverage lives separately; these cases prove that a read
  // already in flight cannot undo that committed state.
  const commitMutation = (active: Entry | null, entries: Entry[]) => {
    requestId.current += 1;
    state.active = clone(active);
    activeRef.current = state.active;
    state.entries = clone(entries);
  };
  return {
    state, read, storedPeriod, requestId, scopeRef, mutationRef,
    activeRef, periodOverrides, context, load, commitMutation,
    classifierRef, nightWindowRef,
  };
}

describe('sleep screen server snapshot synchronization', () => {
  it('clears a partner-stopped timer and preserves the finished version of the same entry', async () => {
    const h = harness(started, success([stopped]), [started]);
    await h.load();

    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries).toEqual([stopped]);
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.read).toHaveBeenCalledWith('shared-baby');
    expect(h.state).toMatchObject({ loading: false, liveLoaded: true, refreshing: false });
  });

  it('treats a successful empty result as authoritative for both timer and history', async () => {
    const h = harness(started, success([]), [started, ...previousHistory]);
    await h.load();

    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries).toEqual([]);
    expect(h.read).toHaveBeenCalledTimes(1);
  });

  it('clears a retained 35-hour timer with no baby assignment after a successful refresh', async () => {
    const stale = {
      ...started,
      id: 'older-unassigned-sleep',
      baby_id: null,
      start_time: '2026-10-05T18:40:55.000Z',
    };
    const h = harness(stale, success([stale, stopped]), [stale]);
    await h.load();

    expect(isStaleActiveSleepEntry(stale, NOW)).toBe(true);
    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries).toEqual([stopped]);
  });

  it('starts a confirmed active timer from a single fresh read and applies its stored period', async () => {
    const h = harness(null, success([{ ...started, period: 'day' }]));
    h.storedPeriod.mockResolvedValue('night');
    await h.load();

    expect(h.state.active).toEqual(started);
    expect(h.activeRef.current).toEqual(started);
    expect(h.state.entries).toEqual([started]);
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.storedPeriod).toHaveBeenCalledTimes(1);
  });

  it('retains a valid cached timer and the complete history when a read reports failure', async () => {
    const history = [started, ...previousHistory];
    const h = harness(started, { success: false, entries: [], error: 'offline' }, history);
    await h.load();

    expect(h.state.active).toEqual(started);
    expect(h.activeRef.current).toEqual(started);
    expect(h.state.entries).toEqual(history);
    expect(h.context.console.error).toHaveBeenCalled();
    expect(h.state).toMatchObject({ loading: false, liveLoaded: true, refreshing: false });
  });

  it('retains history and a valid timer when the read throws', async () => {
    const h = harness(started, async () => { throw new Error('network unavailable'); }, previousHistory);
    await h.load();

    expect(h.state.active).toEqual(started);
    expect(h.state.entries).toEqual(previousHistory);
    expect(h.context.console.error).toHaveBeenCalled();
    expect(h.state.loading).toBe(false);
  });

  it('does not mark the initial live status as loaded when its first read fails', async () => {
    const h = harness(null, { success: false, entries: [], error: 'offline' });
    await h.load();

    expect(h.state.liveLoaded).toBe(false);
    expect(h.state.active).toBeNull();
    expect(h.state.entries).toEqual([]);
    expect(h.state.loading).toBe(false);
  });

  it('prevents an older active snapshot from overwriting a newer confirmed partner stop', async () => {
    const older = deferred<ReadResult>();
    const newer = deferred<ReadResult>();
    const h = harness(started, () => older.promise);
    h.read.mockImplementationOnce(() => older.promise).mockImplementationOnce(() => newer.promise);

    const oldLoad = h.load();
    const newLoad = h.load();
    newer.resolve(success([stopped]));
    await newLoad;
    older.resolve(success([started]));
    await oldLoad;

    expect(h.state.active).toBeNull();
    expect(h.state.entries).toEqual([stopped]);
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it('does not let a superseded read finish loading while its replacement is still pending', async () => {
    const older = deferred<ReadResult>();
    const newer = deferred<ReadResult>();
    const h = harness(started, () => older.promise);
    h.read.mockImplementationOnce(() => older.promise).mockImplementationOnce(() => newer.promise);

    const oldLoad = h.load();
    const newLoad = h.load();
    older.resolve(success([]));
    await oldLoad;
    expect(h.state.loading).toBe(true);
    expect(h.state.liveLoaded).toBe(true);
    expect(h.state.active).toEqual(started);
    newer.resolve(success([stopped]));
    await newLoad;
    expect(h.state.loading).toBe(false);
  });

  it('does not apply a previous baby or account snapshot after the data scope changes', async () => {
    const pending = deferred<ReadResult>();
    const h = harness(null, () => pending.promise, previousHistory);
    const load = h.load();
    h.scopeRef.current = 'me|supabase|another-baby';
    pending.resolve(success([started]));
    await load;

    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries).toEqual(previousHistory);
  });

  it('does not read or replace committed state while a sleep mutation is pending', async () => {
    const h = harness(started, success([]), [started, ...previousHistory]);
    h.mutationRef.current.pending = 1;
    await h.load();

    expect(h.read).not.toHaveBeenCalled();
    expect(h.state.active).toEqual(started);
    expect(h.state.entries).toEqual([started, ...previousHistory]);
  });

  it('does not commit a snapshot that resolves while a mutation is pending', async () => {
    const pending = deferred<ReadResult>();
    const h = harness(started, () => pending.promise, [started, ...previousHistory]);
    const load = h.load();
    h.mutationRef.current.pending = 1;
    pending.resolve(success([]));
    await load;

    expect(h.state.active).toEqual(started);
    expect(h.activeRef.current).toEqual(started);
    expect(h.state.entries).toEqual([started, ...previousHistory]);
  });

  it('rejects a late active snapshot after a committed local stop invalidates the request', async () => {
    const pending = deferred<ReadResult>();
    const h = harness(started, () => pending.promise, [started]);
    const load = h.load();
    h.commitMutation(null, [stopped]);
    pending.resolve(success([started]));
    await load;

    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries).toEqual([stopped]);
  });

  it('rejects a late empty snapshot after a committed local start invalidates the request', async () => {
    const pending = deferred<ReadResult>();
    const h = harness(null, () => pending.promise, previousHistory);
    const load = h.load();
    h.commitMutation(started, [started, ...previousHistory]);
    pending.resolve(success([]));
    await load;

    expect(h.state.active).toEqual(started);
    expect(h.activeRef.current).toEqual(started);
    expect(h.state.entries).toEqual([started, ...previousHistory]);
  });

  it('rejects an active snapshot superseded while its period override is being loaded', async () => {
    const period = deferred<'day' | 'night' | undefined>();
    const periodRequested = deferred<void>();
    const h = harness(null, success([started]));
    h.read.mockResolvedValueOnce(success([started])).mockResolvedValueOnce(success([stopped]));
    h.storedPeriod.mockImplementationOnce(() => {
      periodRequested.resolve();
      return period.promise;
    });
    const oldLoad = h.load();
    await periodRequested.promise;
    expect(h.storedPeriod).toHaveBeenCalledTimes(1);

    await h.load();
    period.resolve('night');
    await oldLoad;

    expect(h.state.active).toBeNull();
    expect(h.state.entries).toEqual([stopped]);
  });

  it('keeps every finished segment and exactly one current active entry from the same snapshot', async () => {
    const finishedNightSegment = { ...stopped, id: 'night-first-segment' };
    const h = harness(null, success([previousHistory[0], started, finishedNightSegment]));
    await h.load();

    expect(h.state.active).toEqual(started);
    expect(h.state.entries).toEqual([started, previousHistory[0], finishedNightSegment]);
    expect(h.state.entries.filter(entry => !entry.end_time)).toHaveLength(1);
    expect(h.read).toHaveBeenCalledTimes(1);
  });

  it('uses the current classifier and night settings when a pending snapshot commits', async () => {
    const pending = deferred<ReadResult>();
    const finished = { ...stopped, id: 'finished-night-segment' };
    const h = harness(null, () => pending.promise);
    h.context.hasAutoSelectedDateRef.current = false;
    h.context.isEntryAssignedToDate.mockReturnValue(false);
    const load = h.load();
    const latestClassifier = jest.fn((entry: Entry): Entry => ({ ...entry, period: 'day' }));
    const latestSettings = { configuredAfterReadStarted: true };
    h.classifierRef.current = latestClassifier;
    h.nightWindowRef.current = latestSettings;
    pending.resolve(success([started, finished]));
    await load;

    expect(h.state.active).toEqual({ ...started, period: 'day' });
    expect(h.state.entries).toEqual([{ ...started, period: 'day' }, { ...finished, period: 'day' }]);
    expect(latestClassifier).toHaveBeenCalledTimes(2);
    expect(h.context.getAssignedDateForEntry).toHaveBeenCalledWith({ ...started, period: 'day' }, latestSettings);
    expect(h.context.isEntryAssignedToDate).toHaveBeenCalledWith(
      expect.objectContaining({ period: 'day' }), h.context.selectedDate, latestSettings,
    );
  });
});

type Mutation = { isCurrentScope: () => boolean; finish: () => boolean };
type Handlers = {
  begin: () => Mutation;
  start: (period: 'day' | 'night') => Promise<boolean>;
  stop: (quality: 'good' | 'medium' | 'bad', notes?: string) => Promise<void>;
  pause: () => Promise<void>;
  split: (params: { targetEntry: Entry; splitTime: Date; wakeMinutes: number }) => Promise<{
    firstEntry: Entry; secondEntry: Entry;
  } | null>;
};
const writeOk = (entry: Entry | null): WriteResult => ({
  primary: { data: entry, error: null },
  secondary: { data: null, error: null },
});
const writeFailed = (): WriteResult => ({
  primary: { data: null, error: new Error('write failed') },
  secondary: { data: null, error: null },
});
const activeAgo = (minutes: number, period: 'day' | 'night' = 'day'): Entry => ({
  ...started,
  start_time: new Date(NOW - minutes * 60_000).toISOString(),
  period,
});

function handlerHarness(initialActive: Entry | null) {
  const h = harness(initialActive, success([]), initialActive ? [initialActive, ...previousHistory] : previousHistory);
  const state = Object.assign(h.state, {
    paused: null as { lastPausedEntryId: string; pausedAt: string } | null,
    starting: false,
    stopping: false,
    splitting: false,
  });
  const service = {
    createEntry: jest.fn(async (input: Record<string, unknown>) => writeOk({ ...started, ...input } as Entry)),
    updateEntry: jest.fn(async (_id: string, updates: Record<string, unknown>) =>
      writeOk({ ...initialActive!, ...updates } as Entry)),
    deleteEntry: jest.fn(async (_id: string) => writeOk(null)),
  };
  const native = {
    endSleepActivity: jest.fn(async (..._args: unknown[]) => {}),
    endAllSleepActivities: jest.fn(async () => {}),
  };
  const remember = jest.fn(async (..._args: unknown[]) => {});
  const forget = jest.fn(async (_id: string) => {});
  const reload = jest.fn(async () => {});
  const cancelReminders = jest.fn(async () => {});
  const invalidateCache = jest.fn(async (_key: string) => {});
  const successSplash = jest.fn();
  const splitResult = {
    ok: true as const,
    mode: 'split' as const,
    firstEntry: { ...(initialActive ?? started), end_time: new Date(NOW - 30 * 60_000).toISOString() },
    secondEntry: { ...(initialActive ?? started), id: 'resumed-segment', start_time: new Date(NOW - 20 * 60_000).toISOString() },
    secondIsActive: true,
  };
  const context = {
    ...h.context,
    useCallback: <T,>(callback: T) => callback,
    ensureWritableInCurrentMode: jest.fn(() => true),
    user: { id: 'me' },
    activeBackend: 'supabase',
    activeSleepEntry: clone(initialActive),
    isStartingSleep: false,
    isStoppingSleep: false,
    isSplittingSegment: false,
    sleepEntries: clone(state.entries),
    babyName: 'Test baby',
    sleepService: service,
    Alert: { alert: jest.fn() },
    MIN_PERSISTED_SLEEP_DURATION_MS: 60_000,
    setIsStartingSleep: (value: boolean) => { state.starting = value; },
    setIsStoppingSleep: (value: boolean) => { state.stopping = value; },
    setIsSplittingSegment: (value: boolean) => { state.splitting = value; },
    setPausedNightState: (value: typeof state.paused) => { state.paused = value; },
    getEffectivePartnerId: jest.fn(async () => 'partner'),
    getAssignedDateForEntry: (entry: Entry) => new FixedDate(entry.start_time),
    sanitizeManualDate: (candidate: Date) => candidate,
    splitNightSleepSegment: jest.fn(async (_params: Record<string, unknown>) => splitResult),
    setSelectedDate: jest.fn(),
    selectTab: jest.fn(),
    rememberActiveSleepPeriodOverride: remember,
    forgetActiveSleepPeriodOverride: forget,
    cancelLocalSleepWindowReminders: cancelReminders,
    cancelBabyReminderNotification: jest.fn(async (..._args: unknown[]) => {}),
    predictionRef: { current: null },
    updatePersonalizationAfterNap: jest.fn(async (..._args: unknown[]) => {}),
    setSleepPrediction: jest.fn(),
    setPredictionError: jest.fn(),
    applyNightQualityToSession: jest.fn(async (..._args: unknown[]) => ({ updated: 0, failed: 0 })),
    sleepActivityService: native,
    formatDurationSeconds: (seconds: number) => String(seconds),
    QUALITY_VISUALS: {
      good: { color: 'green', emoji: 'happy' },
      medium: { color: 'orange', emoji: 'neutral' },
      bad: { color: 'red', emoji: 'sad' },
    },
    invalidateCacheAfterAction: invalidateCache,
    loadSleepData: reload,
    loadSleepDataRef: { current: reload },
    showSuccessSplash: successSplash,
  };
  const handlers = runInNewContext(handlersJs, context, { filename: screenPath }) as Handlers;
  const switchScope = () => {
    h.scopeRef.current = 'me|supabase|another-baby';
    h.mutationRef.current = { scope: h.scopeRef.current, pending: 0 };
    const otherBabyEntry = { ...started, id: 'another-baby-sleep', baby_id: 'another-baby' };
    state.active = otherBabyEntry;
    h.activeRef.current = otherBabyEntry;
    state.entries = [otherBabyEntry];
    return otherBabyEntry;
  };
  return {
    ...h, state, context, handlers, service, native, remember, forget,
    reload, cancelReminders, invalidateCache, successSplash, switchScope,
    splitResult,
  };
}

describe('sleep screen confirmed mutation synchronization', () => {
  it('invalidates reads at mutation start and finish, with idempotent finish', () => {
    const h = handlerHarness(started);
    h.state.loading = true;
    h.state.refreshing = true;
    const mutation = h.handlers.begin();

    expect(h.mutationRef.current.pending).toBe(1);
    expect(h.requestId.current).toBe(1);
    expect(h.state.loading).toBe(false);
    expect(h.state.refreshing).toBe(false);
    expect(mutation.isCurrentScope()).toBe(true);
    expect(mutation.finish()).toBe(true);
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(2);
    expect(mutation.finish()).toBe(false);
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(2);
  });

  it('does not decrement or invalidate mutations belonging to a replacement scope', () => {
    const h = handlerHarness(started);
    const oldMutationRef = h.mutationRef.current;
    const mutation = h.handlers.begin();
    h.switchScope();
    h.mutationRef.current.pending = 2;

    expect(mutation.isCurrentScope()).toBe(false);
    expect(mutation.finish()).toBe(true);
    expect(oldMutationRef.pending).toBe(0);
    expect(h.mutationRef.current.pending).toBe(2);
    expect(h.requestId.current).toBe(1);
  });

  it('rejects a stop response from a previous incarnation of the same baby/account scope', async () => {
    const h = handlerHarness(activeAgo(3));
    const oldMutations = h.mutationRef.current;
    const write = deferred<WriteResult>();
    h.service.updateEntry.mockImplementation(() => write.promise);
    const stop = h.handlers.stop('good');
    expect(oldMutations.pending).toBe(1);

    // A -> B -> A restores the same text key with a different scope instance.
    h.scopeRef.current = 'me|supabase|another-baby';
    h.scopeRef.current = SCOPE;
    h.mutationRef.current = { scope: SCOPE, pending: 0 };
    const currentEntry = { ...started, id: 'current-scope-sleep' };
    h.state.active = currentEntry;
    h.activeRef.current = currentEntry;
    h.state.entries = [currentEntry];
    write.resolve(writeOk(stopped));
    await stop;

    expect(h.state.active).toEqual(currentEntry);
    expect(h.activeRef.current).toEqual(currentEntry);
    expect(h.state.entries).toEqual([currentEntry]);
    expect(oldMutations.pending).toBe(0);
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.native.endSleepActivity).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('does not clear a replacement paused night after resume waits across a scope switch or A-B-A', async () => {
    for (const returnToOriginalScope of [false, true]) {
      const h = handlerHarness(null);
      const startedResponse = deferred<boolean>();
      const start = jest.fn(() => startedResponse.promise);
      const originalPaused = { lastPausedEntryId: 'old-paused-segment', pausedAt: new Date(NOW).toISOString() };
      h.state.paused = originalPaused;
      const resume = runInNewContext(resumeJs, {
        ...h.context,
        pausedNightState: originalPaused,
        handleStartSleep: start,
      }, { filename: screenPath }) as () => Promise<void>;
      const operation = resume();
      expect(start).toHaveBeenCalledWith('night');

      h.scopeRef.current = 'me|supabase|another-baby';
      if (returnToOriginalScope) h.scopeRef.current = SCOPE;
      h.mutationRef.current = { scope: h.scopeRef.current, pending: 0 };
      const replacementPaused = { lastPausedEntryId: 'current-paused-segment', pausedAt: new Date(NOW).toISOString() };
      h.state.paused = replacementPaused;
      startedResponse.resolve(true);
      await operation;

      expect(h.state.paused).toEqual(replacementPaused);
    }
  });

  it('commits a confirmed three-minute stop before waiting for the native activity', async () => {
    const entry = activeAgo(3);
    const h = handlerHarness(entry);
    const native = deferred<void>();
    const nativeRequested = deferred<void>();
    h.native.endSleepActivity.mockImplementation(() => {
      nativeRequested.resolve();
      return native.promise;
    });
    const stop = h.handlers.stop('good', 'synthetic note');
    expect(h.mutationRef.current.pending).toBe(1);
    expect(h.requestId.current).toBe(1);
    await nativeRequested.promise;

    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries[0]).toMatchObject({ id: entry.id, end_time: new Date(NOW).toISOString(), duration_minutes: 3 });
    expect(h.state.entries[1]).toEqual(previousHistory[0]);
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(2);
    expect(h.native.endSleepActivity).toHaveBeenCalledWith('good', '180');
    expect(h.forget).not.toHaveBeenCalled();

    native.resolve();
    await stop;
    expect(h.requestId.current).toBe(2);
    expect(h.state.stopping).toBe(false);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it('removes a confirmed sub-minute sleep before waiting for native activity cleanup', async () => {
    const entry = activeAgo(0.5);
    const h = handlerHarness(entry);
    const native = deferred<void>();
    const nativeRequested = deferred<void>();
    h.native.endAllSleepActivities.mockImplementation(() => {
      nativeRequested.resolve();
      return native.promise;
    });
    const stop = h.handlers.stop('medium');
    await nativeRequested.promise;

    expect(h.service.deleteEntry).toHaveBeenCalledWith(entry.id);
    expect(h.service.updateEntry).not.toHaveBeenCalled();
    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries).toEqual(previousHistory);
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(2);
    native.resolve();
    await stop;
    expect(h.state.stopping).toBe(false);
  });

  it('commits a night pause and clears the timer before native activity cleanup', async () => {
    const entry = activeAgo(3, 'night');
    const h = handlerHarness(entry);
    const native = deferred<void>();
    const nativeRequested = deferred<void>();
    h.native.endAllSleepActivities.mockImplementation(() => {
      nativeRequested.resolve();
      return native.promise;
    });
    const pause = h.handlers.pause();
    await nativeRequested.promise;

    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.paused).toEqual({ lastPausedEntryId: entry.id, pausedAt: new Date(NOW).toISOString() });
    expect(h.state.entries[0]).toMatchObject({ id: entry.id, end_time: new Date(NOW).toISOString(), duration_minutes: 3 });
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(2);
    native.resolve();
    await pause;
    expect(h.state.stopping).toBe(false);
  });

  it('commits a confirmed start before awaiting persistence of its period override', async () => {
    const h = handlerHarness(null);
    const storage = deferred<void>();
    const storageRequested = deferred<void>();
    h.remember.mockImplementation(() => {
      storageRequested.resolve();
      return storage.promise;
    });
    const start = h.handlers.start('night');
    expect(h.mutationRef.current.pending).toBe(1);
    await storageRequested.promise;

    expect(h.state.active).toMatchObject({ id: started.id, start_time: new Date(NOW).toISOString(), end_time: null, period: 'night' });
    expect(h.activeRef.current).toEqual(h.state.active);
    expect(h.state.entries).toEqual([h.state.active, ...previousHistory]);
    expect(h.state.liveLoaded).toBe(true);
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(2);
    expect(h.cancelReminders).not.toHaveBeenCalled();
    storage.resolve();
    expect(await start).toBe(true);
    expect(h.state.starting).toBe(false);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it('prevents an actual stop handler from being undone by an already pending active read', async () => {
    const entry = activeAgo(3);
    const h = handlerHarness(entry);
    const oldRead = deferred<ReadResult>();
    const native = deferred<void>();
    const nativeRequested = deferred<void>();
    h.read.mockImplementationOnce(() => oldRead.promise);
    h.native.endSleepActivity.mockImplementation(() => {
      nativeRequested.resolve();
      return native.promise;
    });
    const oldLoad = h.load();
    const stop = h.handlers.stop('good');
    await nativeRequested.promise;
    oldRead.resolve(success([entry]));
    await oldLoad;

    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries[0].end_time).toBe(new Date(NOW).toISOString());
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(3);
    native.resolve();
    await stop;
  });

  it('prevents an actual start handler from being cleared by an already pending empty read', async () => {
    const h = handlerHarness(null);
    const oldRead = deferred<ReadResult>();
    const storage = deferred<void>();
    const storageRequested = deferred<void>();
    h.read.mockImplementationOnce(() => oldRead.promise);
    h.remember.mockImplementation(() => {
      storageRequested.resolve();
      return storage.promise;
    });
    const oldLoad = h.load();
    const start = h.handlers.start('night');
    await storageRequested.promise;
    oldRead.resolve(success([]));
    await oldLoad;

    expect(h.state.active?.id).toBe(started.id);
    expect(h.activeRef.current).toEqual(h.state.active);
    expect(h.state.entries[0]).toEqual(h.state.active);
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(3);
    storage.resolve();
    expect(await start).toBe(true);
  });

  it.each([false, true])('commits a night stop before quality propagation; scope switch is %s', async changeScope => {
    const entry = activeAgo(3, 'night');
    const h = handlerHarness(entry);
    const quality = deferred<{ updated: number; failed: number }>();
    const requested = deferred<void>();
    h.context.applyNightQualityToSession.mockImplementation(() => {
      requested.resolve();
      return quality.promise;
    });
    const stop = h.handlers.stop('good');
    await requested.promise;

    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries[0].end_time).toBe(new Date(NOW).toISOString());
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(2);
    expect(h.native.endSleepActivity).not.toHaveBeenCalled();
    const replacement = changeScope ? h.switchScope() : null;
    quality.resolve({ updated: 1, failed: 0 });
    await stop;
    if (changeScope) {
      expect(h.state.active).toEqual(replacement);
      expect(h.native.endSleepActivity).not.toHaveBeenCalled();
      expect(h.reload).not.toHaveBeenCalled();
      expect(h.successSplash).not.toHaveBeenCalled();
    } else {
      expect(h.native.endSleepActivity).toHaveBeenCalledTimes(1);
      expect(h.reload).toHaveBeenCalledTimes(1);
    }
  });

  it('does not write a start after the scope switches during partner lookup', async () => {
    const h = handlerHarness(null);
    const partner = deferred<string>();
    h.context.getEffectivePartnerId.mockImplementation(() => partner.promise);
    const start = h.handlers.start('night');
    expect(h.mutationRef.current.pending).toBe(1);
    const replacement = h.switchScope();
    partner.resolve('partner');
    expect(await start).toBe(false);

    expect(h.service.createEntry).not.toHaveBeenCalled();
    expect(h.state.active).toEqual(replacement);
    expect(h.state.entries).toEqual([replacement]);
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('reloads after a confirmed split so a partner stop received while the split was pending is not lost', async () => {
    const entry = activeAgo(60, 'night');
    const h = handlerHarness(entry);
    const write = deferred<typeof h.splitResult>();
    const writeRequested = deferred<void>();
    const reloaded = deferred<void>();
    h.context.splitNightSleepSegment.mockImplementation(() => {
      writeRequested.resolve();
      return write.promise;
    });
    const endedResumed = {
      ...h.splitResult.secondEntry,
      end_time: new Date(NOW).toISOString(),
      duration_minutes: 20,
    };
    h.read.mockResolvedValue(success([endedResumed, h.splitResult.firstEntry, ...previousHistory]));
    h.reload.mockImplementation(async () => {
      await h.load();
      reloaded.resolve();
    });
    const split = h.handlers.split({
      targetEntry: entry,
      splitTime: new Date(NOW - 30 * 60_000),
      wakeMinutes: 10,
    });
    await writeRequested.promise;
    expect(h.mutationRef.current.pending).toBe(1);

    // The incoming partner change requests a read while the split is writing.
    await h.load();
    expect(h.read).not.toHaveBeenCalled();
    write.resolve(h.splitResult);
    expect(await split).toMatchObject({
      firstEntry: h.splitResult.firstEntry,
      secondEntry: h.splitResult.secondEntry,
    });
    await reloaded.promise;

    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.state.active).toBeNull();
    expect(h.activeRef.current).toBeNull();
    expect(h.state.entries).toEqual([endedResumed, h.splitResult.firstEntry, ...previousHistory]);
    expect(h.state.splitting).toBe(false);
    expect(h.requestId.current).toBe(3);
  });

  it.each(['start', 'stop', 'pause'] as const)('does not apply a %s response to a changed baby/account scope', async action => {
    const h = handlerHarness(action === 'start' ? null : activeAgo(3, 'night'));
    const database = deferred<WriteResult>();
    const requested = deferred<void>();
    const pendingWrite = () => { requested.resolve(); return database.promise; };
    if (action === 'start') h.service.createEntry.mockImplementation(pendingWrite);
    else h.service.updateEntry.mockImplementation(pendingWrite);

    const operation = action === 'start' ? h.handlers.start('night')
      : action === 'stop' ? h.handlers.stop('good') : h.handlers.pause();
    await requested.promise;
    expect(h.mutationRef.current.pending).toBe(1);
    const replacement = h.switchScope();
    database.resolve(writeOk(action === 'start' ? started : stopped));
    await operation;

    expect(h.state.active).toEqual(replacement);
    expect(h.activeRef.current).toEqual(replacement);
    expect(h.state.entries).toEqual([replacement]);
    expect(h.state.paused).toBeNull();
    expect(h.remember).not.toHaveBeenCalled();
    expect(h.native.endSleepActivity).not.toHaveBeenCalled();
    expect(h.native.endAllSleepActivities).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.mutationRef.current.pending).toBe(0);
  });

  it.each(['start', 'stop', 'pause', 'short-stop'] as const)('preserves the previous state after a failed %s write and requests a fresh read', async action => {
    const entry = action === 'start' ? null : activeAgo(action === 'short-stop' ? 0.5 : 3, 'night');
    const h = handlerHarness(entry);
    const initialEntries = clone(h.state.entries);
    h.service.createEntry.mockResolvedValue(writeFailed());
    h.service.updateEntry.mockResolvedValue(writeFailed());
    h.service.deleteEntry.mockResolvedValue(writeFailed());

    if (action === 'start') expect(await h.handlers.start('night')).toBe(false);
    else if (action === 'pause') await h.handlers.pause();
    else await h.handlers.stop('good');

    expect(h.state.active).toEqual(entry);
    expect(h.activeRef.current).toEqual(entry);
    expect(h.state.entries).toEqual(initialEntries);
    expect(h.state.paused).toBeNull();
    expect(h.mutationRef.current.pending).toBe(0);
    expect(h.requestId.current).toBe(2);
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.context.Alert.alert).toHaveBeenCalled();
  });

  it('does not continue start-related UI work after a scope switch during period persistence', async () => {
    const h = handlerHarness(null);
    const storage = deferred<void>();
    const requested = deferred<void>();
    h.remember.mockImplementation(() => { requested.resolve(); return storage.promise; });
    const operation = h.handlers.start('night');
    await requested.promise;
    const replacement = h.switchScope();
    storage.resolve();
    await operation;

    expect(h.state.active).toEqual(replacement);
    expect(h.state.entries).toEqual([replacement]);
    expect(h.cancelReminders).not.toHaveBeenCalled();
    expect(h.invalidateCache).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.successSplash).not.toHaveBeenCalled();
  });

  it.each(['stop', 'short-stop', 'pause'] as const)('does not continue %s UI work after a scope switch during native cleanup', async action => {
    const h = handlerHarness(activeAgo(action === 'short-stop' ? 0.5 : 3, action === 'pause' ? 'night' : 'day'));
    const native = deferred<void>();
    const requested = deferred<void>();
    const waitForNative = () => { requested.resolve(); return native.promise; };
    if (action === 'stop') h.native.endSleepActivity.mockImplementation(waitForNative);
    else h.native.endAllSleepActivities.mockImplementation(waitForNative);

    const operation = action === 'pause' ? h.handlers.pause() : h.handlers.stop('good');
    await requested.promise;
    const replacement = h.switchScope();
    native.resolve();
    await operation;

    expect(h.state.active).toEqual(replacement);
    expect(h.state.entries).toEqual([replacement]);
    expect(h.forget).not.toHaveBeenCalled();
    expect(h.invalidateCache).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.successSplash).not.toHaveBeenCalled();
  });
});
