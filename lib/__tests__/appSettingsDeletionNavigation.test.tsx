import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Screen from '@/app/app-settings';
import DsgvoScreen from '@/app/dsgvo';
import { getAppSettings } from '@/lib/supabase';
import { translateAppSettingsText } from '@/lib/appSettingsTranslations';

let mockLocale: 'de' | 'en' | 'es' = 'de';
let mockHealthAllowed = false;
const mockPush = jest.fn();
const mockUser = { id: 'synthetic-user' };
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, Redirect: () => null, useLocalSearchParams: () => ({}), useRouter: () => ({ push: mockPush, canGoBack: () => true, back: jest.fn() }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, session: { user: mockUser }, signOut: jest.fn() }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: mockLocale, localeTag: mockLocale, preference: mockLocale, setPreference: jest.fn() }) }));
jest.mock('@/contexts/DataConsentContext', () => ({ useDataConsents: () => ({ mode: 'active', healthAllowed: mockHealthAllowed }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ activeBabyId: null }) }));
jest.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ autoDarkModeEnabled: false, autoDarkModeStartTime: '21:00', autoDarkModeEndTime: '06:00' }) }));
jest.mock('@/contexts/BackgroundContext', () => ({ useBackground: () => ({ selectedBackground: 'default', backgroundSource: 'preset', hasCustomBackground: false, isDarkBackground: false }) }));
jest.mock('@/hooks/useNotificationPreferences', () => ({ useNotificationPreferences: () => ({ preferences: {} }) }));
jest.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ requestPermissions: jest.fn() }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/lib/supabase', () => ({ getAppSettings: jest.fn(), saveAppSettings: jest.fn() }));
jest.mock('@/lib/appCache', () => ({ getCachedUserProfile: async () => null }));
jest.mock('@/lib/dataExport', () => ({ exportUserData: jest.fn() }));
jest.mock('@/lib/entitlements', () => ({ hasFeatureAccess: () => false }));
jest.mock('@/lib/sleepActivityService', () => ({ sleepActivityService: { isLiveActivitySupported: () => false } }));
jest.mock('@/lib/sleepSharing', () => ({ loadAllVisibleSleepEntries: jest.fn() }));
jest.mock('@/lib/nightWindowSettings', () => ({ DEFAULT_NIGHT_WINDOW_SETTINGS: { startTime: '19:00', endTime: '07:00' }, loadNightWindowSettings: async () => ({ startTime: '19:00', endTime: '07:00' }) }));
jest.mock('@/lib/voiceLog/access', () => ({ fetchVoiceLogAccess: async () => false }));
jest.mock('@/lib/voiceLog/floatingButton', () => ({ DEFAULT_FLOATING_VOICE_BUTTON_COLOR: 'purple', FLOATING_VOICE_BUTTON_COLORS: [{ id: 'purple', color: '#665086' }], readFloatingVoiceButtonEnabled: async () => false, readFloatingVoiceButtonColor: async () => 'purple' }));
jest.mock('@/components/Header', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ui/DateTimePicker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/constants/DesignGuide', () => ({ LiquidGlassCard: jest.requireActual('react-native').View, LAYOUT_PAD: 20, GLASS_OVERLAY: '#fff' }));
jest.mock('@/components/privacy/DataConsentPanel', () => ({ ConsentCard: jest.requireActual('react-native').View, ConsentPage: jest.requireActual('react-native').View, consentStyles: {}, useConsentColors: () => ({ error: '#a52d31', secondary: '#333', text: '#000' }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));

let tree: ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); (getAppSettings as jest.Mock).mockResolvedValue({ data: null, error: null }); });
afterEach(() => { act(() => tree?.unmount()); });

describe.each(['de', 'en', 'es'] as const)('%s deletion settings', locale => {
  it.each([false, true])('offers separate direct routes with health consent=%s and no premium features', async health => {
    mockLocale = locale; mockHealthAllowed = health;
    await act(async () => { tree = create(<Screen />); });
    for (const [key, href] of [['data.deleteAccountTitle', '/account-deletion'], ['data.deleteTitle', '/account-deletion?scope=data']] as const) {
      const label = translateAppSettingsText(locale, key);
      const button = tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
      expect(button.props.disabled).not.toBe(true);
      act(() => button.props.onPress());
      expect(mockPush).toHaveBeenLastCalledWith(href);
    }
  });
});
it('leaves both routes available while full settings never finish loading', async () => {
  mockHealthAllowed = true; mockLocale = 'de';
  (getAppSettings as jest.Mock).mockReturnValue(new Promise(() => {}));
  await act(async () => { tree = create(<Screen />); });
  const button = tree.root.findAll(n => n.props.accessibilityLabel === 'Konto löschen' && typeof n.props.onPress === 'function')[0];
  act(() => button.props.onPress()); expect(mockPush).toHaveBeenCalledWith('/account-deletion');
});
it('keeps the existing account and data route from the hard paywall linked to account deletion', async () => {
  mockLocale = 'de';
  await act(async () => { tree = create(<DsgvoScreen />); });
  const button = tree.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => c.props.children === 'Konto & Daten löschen').length > 0)[0];
  act(() => button.props.onPress()); expect(mockPush).toHaveBeenCalledWith('/account-deletion');
});
