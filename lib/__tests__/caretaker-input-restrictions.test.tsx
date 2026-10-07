import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ActivityInputModal from '@/components/ActivityInputModal';
import { fetchDiaperInventoryItems, fetchFormulaInventoryItems } from '@/lib/shopping';
import { fetchRecipes } from '@/lib/recipes';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ activeBabyId: 'parent-baby' }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 16, left: 0 }) }));
jest.mock('@/lib/entitlements', () => ({ useFeatureAccess: () => ({ hasAccess: true }) }));
jest.mock('@/lib/shopping', () => ({ fetchDiaperInventoryItems: jest.fn(), fetchFormulaInventoryItems: jest.fn(), computeTotalQuantity: () => 0 }));
jest.mock('@/lib/recipes', () => ({ fetchRecipes: jest.fn() }));
jest.mock('@/components/modals/TextInputOverlay', () => () => null);
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
