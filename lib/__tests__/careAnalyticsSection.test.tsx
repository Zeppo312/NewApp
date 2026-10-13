import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CareAnalyticsSection } from '@/components/CareAnalyticsSection';
import { getBabyCareEntriesForDateRange } from '@/lib/supabase';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';

const mockPush = jest.fn();
let mockFocusCallback: (() => void | (() => void)) | undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockFocusCallback = callback;
    jest.requireActual<typeof import('react')>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@/lib/supabase', () => ({ getBabyCareEntriesForDateRange: jest.fn() }));
jest.mock('@/lib/sleepSharing', () => ({ loadAllVisibleSleepEntries: jest.fn() }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de', localeTag: 'de-DE' }) }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', isDarkBackground: false }) }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: (props: object) => jest.requireActual<typeof import('react')>('react').createElement(jest.requireActual<typeof import('react-native')>('react-native').Text, props) }));
jest.mock('@/components/advisor/CareGlassCard', () => ({ CareGlassCard: ({ children }: { children: React.ReactNode }) => jest.requireActual<typeof import('react')>('react').createElement(jest.requireActual<typeof import('react-native')>('react-native').View, null, children) }));

const careLoad = getBabyCareEntriesForDateRange as jest.Mock;
const sleepLoad = loadAllVisibleSleepEntries as jest.Mock;
const at = (day: number) => new Date(2026, 6, day, 12).toISOString();
const fixture = [11, 12, 13, 21, 22, 23].flatMap((day) => Array.from({ length: day >= 21 ? 2 : 1 }, (_, index) => ({
  id: `feeding-${day}-${index}`, entry_type: 'feeding', feeding_type: 'BREAST', start_time: at(day),
})));
let tree: ReactTestRenderer | undefined;
const flatten = (value: unknown): string => Array.isArray(value) ? value.map(flatten).join('') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const screenText = () => tree!.root.findAllByType(Text).map((node) => flatten(node.props.children)).join('\n');
const button = (label: string) => tree!.root.findAllByType(TouchableOpacity).find((node) => node.findAllByType(Text).some((text) => flatten(text.props.children) === label))!;
const press = async (label: string) => { await act(async () => { button(label).props.onPress(); }); };
const render = async (babyId = 'baby') => { await act(async () => { tree = create(<CareAnalyticsSection babyId={babyId} />); }); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 6, 24, 18));
  jest.clearAllMocks();
  careLoad.mockReset().mockResolvedValue({ data: fixture, error: null });
  sleepLoad.mockReset().mockResolvedValue({ success: true, entries: [] });
});
afterEach(async () => {
  await act(async () => { tree?.unmount(); });
  tree = undefined;
  jest.useRealTimers();
});

it('keeps observation, dated entries, and a working next action together for each metric', async () => {
  await render();
  await press('Mahlzeiten');
  expect(screenText()).toContain('100 % mehr eingetragen');
  expect(screenText()).toContain('Einträge: 6 · Tage: 3');
  expect(screenText()).toContain('Stillen');
  expect(screenText()).toContain('Nächster Schritt');
  await press('Alltag öffnen');
  expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/daily_old');
  await press('Schlaf');
  await press('Schlaf-Tracker öffnen');
  expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/sleep-tracker');
  await press('Windeln');
  await press('Alltag öffnen');
  expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/daily_old');
});

it('lets the user inspect every contributing entry in both periods with bounded pagination', async () => {
  await render();
  await press('Mahlzeiten');
  await press('Alle 6 Einträge ansehen');
  expect(screenText()).toContain('1–5 von 6');
  await press('Weiter');
  expect(screenText()).toContain('6–6 von 6');
  await press('Vorher');
  expect(screenText()).toContain('Stillen');
  expect(screenText()).not.toContain('6–6 von 6');
  await press('Alle 7 Tage ansehen');
  expect(screenText()).toContain('Teilweise erfasst');
  expect(screenText()).toContain('Ohne Einträge: Schlaf, Windeln');
  expect(screenText()).toContain('Heute · Tag läuft noch');
});

it.each(['care', 'sleep', 'throw'])('does not present a %s load failure as missing records and recovers on retry', async (source) => {
  if (source === 'care') careLoad.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  if (source === 'sleep') sleepLoad.mockResolvedValueOnce({ success: false });
  if (source === 'throw') sleepLoad.mockRejectedValueOnce(new Error('offline'));
  await render();
  expect(screenText()).toContain('Nicht alle Einträge konnten geladen werden');
  expect(screenText()).not.toContain('So sind eure Tage erfasst');
  expect(screenText()).not.toContain('Teilweise erfasst');
  await press('Erneut laden');
  expect(screenText()).toContain('So sind eure Tage erfasst');
  expect(screenText()).not.toContain('Nicht alle Einträge konnten geladen werden');
});

it('keeps a previously loaded report when refresh fails instead of replacing its evidence with partial data', async () => {
  await render();
  await press('Mahlzeiten');
  sleepLoad.mockResolvedValueOnce({ success: false });
  await act(async () => { mockFocusCallback?.(); });
  expect(screenText()).toContain('Nicht alle Einträge konnten geladen werden');
  expect(screenText()).toContain('Einträge: 6 · Tage: 3');
  expect(screenText()).toContain('100 % mehr eingetragen');
  await press('Erneut laden');
  expect(screenText()).not.toContain('Nicht alle Einträge konnten geladen werden');
});

it('does not show an empty report during the first fetch or reuse evidence from another child', async () => {
  let resolveCare!: (result: unknown) => void;
  careLoad.mockReturnValueOnce(new Promise((resolve) => { resolveCare = resolve; }));
  await render();
  expect(screenText()).toContain('Bericht wird');
  expect(screenText()).not.toContain('So sind eure Tage erfasst');
  await act(async () => { tree!.update(<CareAnalyticsSection babyId="other" />); });
  await press('Mahlzeiten');
  expect(screenText()).toContain('Einträge: 6 · Tage: 3');
  await act(async () => { resolveCare({ data: [], error: null }); });
  expect(screenText()).toContain('Einträge: 6 · Tage: 3');
  expect(careLoad.mock.calls[1][2]).toBe('other');
});

it('offers all three next actions and shows missing days when a successful fetch is empty', async () => {
  careLoad.mockResolvedValue({ data: [], error: null });
  await render();
  expect(screenText()).toContain('0 von 7 Tagen mit Einträgen');
  expect(screenText()).toContain('Ohne Einträge');
  await press('Mahlzeiten');
  expect(button('Alltag öffnen')).toBeDefined();
  expect(screenText()).toContain('Erfasse den nächsten passenden Eintrag');
});

it('asks for a child before deriving missing days and never loads unscoped family data', async () => {
  await act(async () => { tree = create(<CareAnalyticsSection />); });
  expect(screenText()).toContain('Wähle ein Baby');
  expect(screenText()).not.toContain('So sind eure Tage erfasst');
  expect(careLoad).not.toHaveBeenCalled();
  expect(sleepLoad).not.toHaveBeenCalled();
});
