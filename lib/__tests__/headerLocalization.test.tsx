import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Header from '@/components/Header';
import type { AppLocale } from '../localization';

let mockLocale: AppLocale = 'de';
const mockGoBack = jest.fn();
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: mockLocale }) }));
jest.mock('@/contexts/NavigationContext', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ hasCustomBackground: false }) }));
jest.mock('@/hooks/useReduceTransparency', () => ({ useReduceTransparency: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('@/components/BabySwitcherButton', () => () => null);
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ui/period-navigation-button', () => ({
  PeriodNavigationButton: jest.requireActual('@/components/ui/period-navigation-button-fallback').PeriodNavigationButtonFallback,
}));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));

let tree: ReactTestRenderer;
afterEach(() => { act(() => tree?.unmount()); jest.clearAllMocks(); });
const backButton = () => tree.root.findAll((node) =>
  node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
)[0];

it.each([['de', 'Zurück'], ['en', 'Back'], ['es', 'Atrás']] as const)(
  'labels the real header back button in %s', (locale, label) => {
    mockLocale = locale;
    act(() => { tree = create(<Header title="Settings" showBackButton />); });
    expect(backButton().props.accessibilityLabel).toBe(label);
    act(() => backButton().props.onPress());
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  },
);

it('updates the mounted header when the app language changes', () => {
  mockLocale = 'de';
  act(() => { tree = create(<Header title="Einstellungen" showBackButton />); });
  mockLocale = 'es';
  act(() => tree.update(<Header title="Ajustes" showBackButton />));
  expect(backButton().props.accessibilityLabel).toBe('Atrás');
});

it('retains an explicit accessible label and custom back action', () => {
  mockLocale = 'en';
  const onBackPress = jest.fn();
  act(() => { tree = create(<Header title="Details" showBackButton backAccessibilityLabel="Close details" onBackPress={onBackPress} />); });
  expect(backButton().props.accessibilityLabel).toBe('Close details');
  act(() => backButton().props.onPress());
  expect(onBackPress).toHaveBeenCalledTimes(1);
  expect(mockGoBack).not.toHaveBeenCalled();
});
