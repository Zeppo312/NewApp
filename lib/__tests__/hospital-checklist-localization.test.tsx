import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ChecklistScreen from '@/app/(tabs)/explore';
import { ChecklistCategory } from '@/components/ChecklistCategory';
import { getHospitalChecklist, toggleChecklistItem, type ChecklistItem } from '@/lib/supabase';
import {
  getHospitalChecklistCategories,
  getHospitalChecklistDefaultItems,
  type PregnancyChecklistLocale,
} from '@/lib/pregnancyChecklistTranslations';

let mockLocale: PregnancyChecklistLocale = 'en';
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: mockLocale }) }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  getHospitalChecklist: jest.fn(),
  toggleChecklistItem: jest.fn(),
  addChecklistItem: jest.fn(),
  deleteChecklistItem: jest.fn(),
  supabaseUrl: 'https://test.supabase.co',
}));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
jest.mock('@/components/Header', () => () => null);
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ChecklistCategory', () => ({ ChecklistCategory: () => null }));
jest.mock('@/components/AddChecklistItem', () => ({ AddChecklistItem: () => null }));
jest.mock('@/components/ProgressCircle', () => ({ ProgressCircle: () => null }));
jest.mock('@/constants/DesignGuide', () => ({ LiquidGlassCard: jest.requireActual('react-native').View }));

let tree: ReactTestRenderer;
let storedItems: ChecklistItem[];

beforeEach(() => {
  jest.clearAllMocks();
  storedItems = getHospitalChecklistDefaultItems('de').map((item, position) => ({
    id: item.id,
    user_id: 'test-user',
    item_name: item.name,
    category: getHospitalChecklistCategories('de').find(category => category.id === item.categoryId)!.label,
    notes: item.notes,
    position,
    is_checked: true,
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-10T10:00:00Z',
  }));
  jest.mocked(getHospitalChecklist).mockResolvedValue({ data: storedItems, error: null });
  jest.mocked(toggleChecklistItem).mockImplementation(async (id, is_checked) => ({
    data: { ...storedItems.find(item => item.id === id)!, is_checked },
    error: null,
  }));
});

afterEach(() => { if (tree) act(() => tree.unmount()); });

function expectLocalizedChecklist(locale: PregnancyChecklistLocale, uncheckedIds: string[]) {
  const groups = tree.root.findAllByType(ChecklistCategory);
  expect(groups.map(group => group.props.title)).toEqual(getHospitalChecklistCategories(locale).map(category => category.label));
  const items = groups.flatMap(group => group.props.items) as ChecklistItem[];
  expect(items).toHaveLength(storedItems.length);
  for (const expected of getHospitalChecklistDefaultItems(locale)) {
    expect(items.find(item => item.id === expected.id)).toMatchObject({
      item_name: expected.name,
      notes: expected.notes,
      is_checked: !uncheckedIds.includes(expected.id),
    });
  }
}

it.each(['de', 'en', 'es'] as const)('keeps category, name and notes in %s when unchecking and rechecking stored German items', async locale => {
  mockLocale = locale;
  await act(async () => { tree = create(<ChecklistScreen />); });
  expectLocalizedChecklist(locale, []);

  const unchecked: string[] = [];
  for (const id of ['bodysuits', 'babyHats', 'toothbrush']) {
    const group = tree.root.findAllByType(ChecklistCategory).find(group => group.props.items.some((item: ChecklistItem) => item.id === id))!;
    await act(async () => { await group.props.onToggleItem(id, false); });
    unchecked.push(id);
    expectLocalizedChecklist(locale, unchecked);
  }

  await act(async () => {
    await tree.root.findAllByType(ChecklistCategory)[2].props.onToggleItem('bodysuits', true);
  });
  expectLocalizedChecklist(locale, ['babyHats', 'toothbrush']);
});

it('preserves both changes when two toggle responses arrive out of order', async () => {
  mockLocale = 'en';
  await act(async () => { tree = create(<ChecklistScreen />); });
  const pending = new Map<string, () => void>();
  jest.mocked(toggleChecklistItem).mockImplementation((id, is_checked) => new Promise(resolve => {
    pending.set(id, () => resolve({ data: { ...storedItems.find(item => item.id === id)!, is_checked }, error: null }));
  }));
  const onToggle = tree.root.findAllByType(ChecklistCategory)[2].props.onToggleItem;
  const first = onToggle('bodysuits', false);
  const second = onToggle('babyHats', false);
  await act(async () => { pending.get('babyHats')!(); await second; });
  await act(async () => { pending.get('bodysuits')!(); await first; });
  expectLocalizedChecklist('en', ['bodysuits', 'babyHats']);
});
