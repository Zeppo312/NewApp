import {FormField, FormSheet} from '@/components/ui/form-sheet';
import React from 'react';
import { Modal, Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ActivityInputModal from '@/components/ActivityInputModal';
import { fetchDiaperInventoryItems, fetchFormulaInventoryItems } from '@/lib/shopping';
import { fetchRecipes } from '@/lib/recipes';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { DialogActions } from '@/components/ui/dialog-actions';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ activeBabyId: 'parent-baby' }) }));
// Keep this input-only suite independent of live auth, billing and local storage providers.
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'parent' } }) }));
jest.mock('@/hooks/useActivityDraft', () => ({ useActivityDraft: () => ({ ready: true }) }));
jest.mock('@/lib/localReadSnapshots', () => ({ backendHost: () => 'test' }));
jest.mock('@/lib/localHealthStorage', () => ({ localHealthAllowed: () => true, localHealthGeneration: () => 0 }));
jest.mock('@/lib/supabase', () => ({ getBabyCareEntriesForDate: jest.fn() }));
jest.mock('@/components/ui/glass-sheet-surface', () => ({ GlassSheetSurface: jest.requireActual('react-native').View }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 16, left: 0 }) }));
jest.mock('@/lib/entitlements', () => ({ useFeatureAccess: () => ({ hasAccess: true }), useHistoryCutoff: () => null, isBeforeHistoryCutoff: () => false }));
jest.mock('@/lib/shopping', () => ({ fetchDiaperInventoryItems: jest.fn(), fetchFormulaInventoryItems: jest.fn(), computeTotalQuantity: () => 0 }));
jest.mock('@/lib/recipes', () => ({ fetchRecipes: jest.fn() }));
jest.mock('@/components/modals/TextInputOverlay', () => () => null);
jest.mock('@/components/ui/DateTimePicker', () => ({ __esModule: true, default: jest.fn(() => null) }));
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchDiaperInventoryItems).mockResolvedValue({ data: [], error: null });
  jest.mocked(fetchFormulaInventoryItems).mockResolvedValue({ data: [], error: null });
  jest.mocked(fetchRecipes).mockResolvedValue({ data: [], error: null });
});
afterEach(() => { if (tree) act(() => tree.unmount()); });
it.each(['feeding_bottle', 'feeding_solids', 'diaper_wet'])('does not fetch parent resources for restricted %s input', async subtype => {
  await act(async () => { tree = create(<ActivityInputModal visible restricted activityType={subtype.startsWith('diaper') ? 'diaper' : 'feeding'}
    initialSubType={subtype} hiddenSubTypes={['feeding_breast', 'feeding_pump', 'feeding_water']} onClose={() => {}} onSave={() => {}} />); });
  expect(fetchDiaperInventoryItems).not.toHaveBeenCalled();
  expect(fetchFormulaInventoryItems).not.toHaveBeenCalled();
  expect(fetchRecipes).not.toHaveBeenCalled();
  const labels = tree.root.findAllByType(Text).map(n => n.props.children).filter(x => typeof x === 'string').join(' ');
  expect(labels).not.toContain('BLW-Rezepte');
});
it('preserves inventory fetching for normal parent inputs', async () => {
  await act(async () => { tree = create(<ActivityInputModal visible activityType="diaper" initialSubType="diaper_wet" onClose={() => {}} onSave={() => {}} />); });
  expect(fetchDiaperInventoryItems).toHaveBeenCalled();
});

it('keeps a cancelled native time picker draft out of the saved activity', async () => {
  const onSave = jest.fn().mockResolvedValue({ status: 'confirmed', entryId: 'saved' });
  const original = new Date('2026-10-12T12:00:00Z');
  await act(async () => { tree = create(<ActivityInputModal visible restricted activityType="diaper"
    initialSubType="diaper_wet" date={original} initialData={{ id: 'entry-1', start_time: original.toISOString(), diaper_type: 'WET' }}
    onClose={() => {}} onSave={onSave} />); });
  const open = () => act(() => tree.root.findAllByType(FormField).find(node => node.props.label === 'Start')!.props.onPress());
  open();
  act(() => tree.root.findByType(DateTimePicker).props.onChange({}, new Date('2026-10-12T13:00:00Z')));
  const picker = tree.root.findAllByType(FormSheet).find(node => node.props.visible && node.props.title === 'Start')!.findByType(Modal)!;
  act(() => picker.findByType(DialogActions).props.onCancel());
  open();
  expect(tree.root.findByType(DateTimePicker).props.value).toEqual(original);
  act(() => tree.root.findAllByType(FormSheet).find(node => node.props.visible && node.props.title === 'Start')!.findByType(Modal)!.props.onRequestClose());
  await act(async () => { await tree.root.findByType(DialogActions).props.onConfirm(); });
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ start_time: original.toISOString() }), expect.anything());
});
