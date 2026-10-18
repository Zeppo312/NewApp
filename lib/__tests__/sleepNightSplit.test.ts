import {
  findNightWakeCandidateForFeeding,
  splitNightSleepSegment,
} from '../sleepNightSplit';
import { DEFAULT_NIGHT_WINDOW_SETTINGS } from '../nightWindowSettings';
import {
  forgetActiveSleepPeriodOverride,
  loadStoredActiveSleepPeriodOverride,
  rememberActiveSleepPeriodOverride,
} from '../sleepPeriodOverrides';
import { sleepActivityService } from '../sleepActivityService';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../sleepPeriodOverrides', () => ({
  loadStoredActiveSleepPeriodOverride: jest.fn().mockResolvedValue(undefined),
  rememberActiveSleepPeriodOverride: jest.fn().mockResolvedValue(undefined),
  forgetActiveSleepPeriodOverride: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../sleepActivityService', () => ({
  sleepActivityService: {
    startSleepActivity: jest.fn().mockResolvedValue('activity-1'),
  },
}));

const USER_ID = 'user-me';
const PARTNER_ID = 'user-partner';

// Referenznacht: Schlaf 03.07. 20:00 bis 04.07. 06:30 (lokal), "jetzt" ist 08:00.
const NOW = new Date(2026, 6, 4, 8, 0);
const NIGHT_START = new Date(2026, 6, 3, 20, 0);
const NIGHT_END = new Date(2026, 6, 4, 6, 30);

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-1',
  user_id: USER_ID,
  baby_id: 'baby-1',
  start_time: NIGHT_START.toISOString(),
  end_time: NIGHT_END.toISOString(),
  duration_minutes: 630,
  notes: null,
  quality: 'good',
  shared_with_user_id: null,
  partner_id: null,
  updated_by: null,
  created_at: NIGHT_START.toISOString(),
  updated_at: NIGHT_START.toISOString(),
  ...overrides,
});

const okResult = <T,>(data: T) => ({
  primary: { data, error: null },
  secondary: { data: null, error: null },
});

const makeService = (entries: unknown[] = [makeEntry()]) => ({
  getEntries: jest.fn().mockResolvedValue({ data: entries, error: null }),
  updateEntry: jest
    .fn()
    .mockImplementation((_id: string, updates: Record<string, unknown>) =>
      Promise.resolve(okResult(makeEntry(updates)))
    ),
  createEntry: jest
    .fn()
    .mockImplementation((input: Record<string, unknown>) =>
      Promise.resolve(okResult({ ...makeEntry(input), id: 'entry-2' }))
    ),
});

type MockService = ReturnType<typeof makeService>;
const asService = (service: MockService) => service as any;

beforeEach(() => {
  jest.clearAllMocks();
  (loadStoredActiveSleepPeriodOverride as jest.Mock).mockResolvedValue(undefined);
});

describe('findNightWakeCandidateForFeeding', () => {
  const detect = (service: MockService, params: Record<string, unknown> = {}) =>
    findNightWakeCandidateForFeeding({
      service: asService(service),
      userId: USER_ID,
      babyId: 'baby-1',
      feedingStart: new Date(2026, 6, 4, 2, 0),
      feedingEnd: new Date(2026, 6, 4, 2, 12),
      nightWindowSettings: DEFAULT_NIGHT_WINDOW_SETTINGS,
      now: NOW,
      ...params,
    });

  it('erkennt eine Flasche mitten im abgeschlossenen Nacht-Segment', async () => {
    const result = await detect(makeService());
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.targetIsActive).toBe(false);
    expect(result.suggestedWakeMinutes).toBe(12);
    expect(result.truncateOnly).toBe(false);
    // 02:00 bis 06:30 sind 270 Minuten, minus 1 Minute Rand
    expect(result.maxSplitWakeMinutes).toBe(269);
  });

  it('nutzt 10 Minuten Default ohne Fütterende und 5 Minuten Minimum bei kurzer Fütterung', async () => {
    const noEnd = await detect(makeService(), { feedingEnd: null });
    expect(noEnd.eligible && noEnd.suggestedWakeMinutes).toBe(10);

    const shortFeed = await detect(makeService(), {
      feedingEnd: new Date(2026, 6, 4, 2, 2),
    });
    expect(shortFeed.eligible && shortFeed.suggestedWakeMinutes).toBe(5);
  });

  it('überspringt Fütterungen in einer bestehenden Wachlücke', async () => {
    const service = makeService([
      makeEntry({ id: 'a', end_time: new Date(2026, 6, 4, 1, 55).toISOString() }),
      makeEntry({ id: 'b', start_time: new Date(2026, 6, 4, 2, 10).toISOString() }),
    ]);
    const result = await detect(service);
    expect(result).toEqual({ eligible: false, reason: 'no-containing-night-segment' });
  });

  it('überspringt Fütterungen an der Segmentgrenze (1-Minuten-Rand)', async () => {
    const result = await detect(makeService(), {
      feedingStart: new Date(NIGHT_START.getTime() + 30 * 1000),
      feedingEnd: null,
    });
    expect(result).toEqual({ eligible: false, reason: 'no-containing-night-segment' });
  });

  it('überspringt Tagschlaf (Nap)', async () => {
    const service = makeService([
      makeEntry({
        start_time: new Date(2026, 6, 4, 12, 30).toISOString(),
        end_time: new Date(2026, 6, 4, 13, 30).toISOString(),
      }),
    ]);
    const result = await detect(service, {
      feedingStart: new Date(2026, 6, 4, 13, 0),
      feedingEnd: null,
      now: new Date(2026, 6, 4, 14, 0),
    });
    expect(result).toEqual({ eligible: false, reason: 'no-containing-night-segment' });
  });

  it('überspringt Fütterungen älter als 24 Stunden ohne Entries zu laden', async () => {
    const service = makeService();
    const result = await detect(service, {
      feedingStart: new Date(2026, 6, 1, 2, 0),
    });
    expect(result).toEqual({ eligible: false, reason: 'too-old' });
    expect(service.getEntries).not.toHaveBeenCalled();
  });

  it('erlaubt abgeschlossene Partner-Segmente, blockt aktive', async () => {
    const completed = await detect(makeService([makeEntry({ user_id: PARTNER_ID })]));
    expect(completed.eligible).toBe(true);

    const active = await detect(
      makeService([makeEntry({ user_id: PARTNER_ID, end_time: null })])
    );
    expect(active).toEqual({ eligible: false, reason: 'partner-active' });
  });

  it('begrenzt maxSplitWakeMinutes bei aktivem Segment auf jetzt', async () => {
    const service = makeService([makeEntry({ end_time: null })]);
    const result = await detect(service, {
      feedingStart: new Date(2026, 6, 4, 7, 30),
      feedingEnd: null,
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.targetIsActive).toBe(true);
    // 07:30 bis 08:00 sind 30 Minuten, minus 1 Minute Rand
    expect(result.maxSplitWakeMinutes).toBe(29);
  });

  it('bietet truncateOnly kurz vor Segmentende, überspringt frische Fütterung bei aktivem Schlaf', async () => {
    const nearEnd = await detect(makeService(), {
      feedingStart: new Date(2026, 6, 4, 6, 27),
      feedingEnd: null,
    });
    expect(nearEnd.eligible && nearEnd.truncateOnly).toBe(true);

    const freshActive = await detect(makeService([makeEntry({ end_time: null })]), {
      feedingStart: new Date(2026, 6, 4, 7, 58),
      feedingEnd: null,
    });
    expect(freshActive).toEqual({ eligible: false, reason: 'no-containing-night-segment' });
  });
});

describe('splitNightSleepSegment', () => {
  const splitTime = new Date(2026, 6, 4, 2, 0);

  const run = (service: MockService, params: Record<string, unknown> = {}) =>
    splitNightSleepSegment({
      service: asService(service),
      userId: USER_ID,
      targetEntry: makeEntry() as any,
      splitTime,
      wakeMinutes: 12,
      now: NOW,
      ...params,
    });

  it('teilt ein abgeschlossenes Segment in zwei Teile', async () => {
    const service = makeService();
    const result = await run(service);

    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== 'split') return;

    expect(service.updateEntry).toHaveBeenCalledWith('entry-1', {
      end_time: splitTime.toISOString(),
      duration_minutes: 360, // 20:00 bis 02:00
    });
    expect(service.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        start_time: new Date(2026, 6, 4, 2, 12).toISOString(),
        end_time: NIGHT_END.toISOString(),
        duration_minutes: 258, // 02:12 bis 06:30
        quality: 'good',
      })
    );
    expect(result.secondIsActive).toBe(false);
    expect(sleepActivityService.startSleepActivity).not.toHaveBeenCalled();
  });

  it('truncate beendet das Segment ohne zweites Entry', async () => {
    const service = makeService();
    const result = await run(service, { mode: 'truncate', wakeMinutes: 0 });

    expect(result.ok && result.mode).toBe('truncated');
    expect(service.updateEntry).toHaveBeenCalledTimes(1);
    expect(service.createEntry).not.toHaveBeenCalled();
  });

  it('rollt das Update zurück, wenn das zweite Entry nicht angelegt werden kann', async () => {
    const service = makeService();
    service.createEntry.mockResolvedValueOnce({
      primary: { data: null, error: { message: 'insert failed' } },
      secondary: { data: null, error: null },
    });

    const result = await run(service);

    expect(result).toMatchObject({ ok: false, reason: 'create-failed' });
    expect(service.updateEntry).toHaveBeenCalledTimes(2);
    expect(service.updateEntry).toHaveBeenLastCalledWith('entry-1', {
      end_time: NIGHT_END.toISOString(),
      duration_minutes: 630,
    });
  });

  it('behandelt aktives Segment: zweites Entry aktiv, Override + Live Activity', async () => {
    const service = makeService();
    const result = await run(service, {
      targetEntry: makeEntry({ end_time: null, duration_minutes: null }) as any,
      splitTime: new Date(2026, 6, 4, 7, 0),
      wakeMinutes: 10,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== 'split') return;
    expect(result.secondIsActive).toBe(true);
    expect(service.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ end_time: null, duration_minutes: null })
    );
    expect(rememberActiveSleepPeriodOverride).toHaveBeenCalledWith(
      'entry-2',
      'night',
      expect.any(String)
    );
    expect(forgetActiveSleepPeriodOverride).toHaveBeenCalledWith('entry-1');
    expect(sleepActivityService.startSleepActivity).toHaveBeenCalled();
  });

  it('legt bei Partner-Segmenten das zweite Entry mit partner_id des Owners an', async () => {
    const service = makeService();
    const result = await run(service, {
      targetEntry: makeEntry({ user_id: PARTNER_ID }) as any,
    });

    expect(result.ok).toBe(true);
    expect(service.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, partner_id: PARTNER_ID })
    );
  });

  it('blockt aktive Partner-Segmente ohne Datenbankzugriff', async () => {
    const service = makeService();
    const result = await run(service, {
      targetEntry: makeEntry({ user_id: PARTNER_ID, end_time: null }) as any,
    });

    expect(result).toMatchObject({ ok: false, reason: 'partner-active' });
    expect(service.updateEntry).not.toHaveBeenCalled();
    expect(service.createEntry).not.toHaveBeenCalled();
  });

  it('lehnt zu lange Wachphasen und ungültige Split-Zeiten ab', async () => {
    const service = makeService();

    const tooLong = await run(service, {
      splitTime: new Date(2026, 6, 4, 6, 25),
      wakeMinutes: 10,
    });
    expect(tooLong).toMatchObject({ ok: false, reason: 'wake-too-long' });

    const beforeStart = await run(service, {
      splitTime: new Date(2026, 6, 3, 19, 0),
    });
    expect(beforeStart).toMatchObject({ ok: false, reason: 'invalid-split-time' });

    expect(service.updateEntry).not.toHaveBeenCalled();
  });
});
