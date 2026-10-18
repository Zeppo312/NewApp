import React from 'react';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import GetUserInfoScreen from '../../app/(auth)/getUserInfo';
import IOSBottomDatePicker from '@/components/modals/IOSBottomDatePicker';
import { SurveyStep, ProductTryout } from '@/components/onboarding/personalized-steps';
import { FeedbackStep, HabitStep, TrialStep } from '@/components/onboarding/value-steps';
import { valueCopy } from '@/components/onboarding/value-copy';
import { OnboardingProductMoment } from '@/components/onboarding/product-moment';
import { getOnboardingDestination } from '../onboarding-flow';
import { getOnboardingNeeds, getPersonalizedStart, type OnboardingAnswers, type OnboardingNeed } from '../onboarding-personalization';
import { translateOnboardingText, type OnboardingLocale, type OnboardingTranslationKey } from '../onboardingTranslations';

// Each integration case traverses the full screen on a shared development host.
jest.setTimeout(30_000);

let mockLocale: OnboardingLocale = 'de';
const mockLegacyAnswers: OnboardingAnswers & { start: 'memories' } = {
  version: 1, need: 'memories', start: 'memories', challenge: 'remember', support: 'solo',
};
const mockUser: { id: string; user_metadata: { onboarding_preferences?: typeof mockLegacyAnswers } } = {
  id: 'f04-synthetic-user', user_metadata: {},
};
const mockReplace = jest.fn();
const mockUpdateUser = jest.fn();
const mockSaveBaby = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue(true);
const mockProfile = jest.fn();
const mockSettingsRead = jest.fn();
const mockSettingsWrite = jest.fn();
const mockPaywall = jest.fn();

// Only external services and native rendering surfaces are replaced. The screen,
// personalization, flow, copy, survey, demos and plan are the real product modules.
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: mockLocale }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ refreshBabies: mockRefresh, activeBaby: null }) }));
jest.mock('@/contexts/BabyStatusContext', () => ({ useBabyStatus: () => ({ refreshBabyDetails: mockRefresh }) }));
jest.mock('@/contexts/OnboardingStatusContext', () => ({ useOnboardingStatus: () => ({ refresh: mockRefresh }) }));
jest.mock('@/lib/appCache', () => ({ invalidateUserProfileCache: jest.fn(), invalidateUserSettingsCache: jest.fn(), invalidatePremiumStatusCache: jest.fn() }));
jest.mock('@/lib/familySubscriptionAccess', () => ({ invalidateFamilyAccess: jest.fn(), refreshFamilyAccess: jest.fn() }));
jest.mock('@/lib/redeemInvitationCodeFixed', () => ({ redeemInvitationCodeFixed: jest.fn() }));
jest.mock('@/lib/baby', () => ({ saveBabyInfo: (...args: unknown[]) => mockSaveBaby(...args), getLinkedBabySelectionOptions: jest.fn() }));
jest.mock('@/lib/paywall', () => ({
  shouldShowPaywall: (...args: unknown[]) => mockPaywall(...args),
  shouldRedirectToPaywallForState: jest.requireActual('../paywallDecision').shouldRedirectToPaywallForState,
}));
jest.mock('@/lib/supabase', () => ({
  buildInvitationLink: () => 'com.lottibaby.app://invite?code=',
  supabase: {
    auth: { updateUser: (...args: unknown[]) => mockUpdateUser(...args) },
    from: (table: string) => table === 'profiles' ? { upsert: mockProfile } : {
      select: () => ({ eq: () => ({ maybeSingle: mockSettingsRead }) }),
      insert: mockSettingsWrite, update: () => ({ eq: mockSettingsWrite }),
    },
  },
}));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null }, router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/onboarding/surfaces', () => ({
  OnboardingSurface: jest.requireActual('react-native').View,
  OnboardingTransition: jest.requireActual('react-native').View,
  OnboardingChoice: jest.requireActual('react-native').TouchableOpacity,
}));
jest.mock('@/components/modals/IOSBottomDatePicker', () => () => null);
jest.mock('@/components/ui/DateTimePicker', () => () => null);
jest.mock('@/components/LinkedBabySelectionModal', () => ({ LinkedBabySelectionModal: () => null }));
jest.mock('@/components/account-linking-qr-modal', () => ({ AccountLinkingQrModal: () => null }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', hasCustomBackground: false, isDarkBackground: false }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => false, cubicBezier: () => 'ease-out' }));

let tree: ReactTestRenderer;
const t = (key: OnboardingTranslationKey) => translateOnboardingText(mockLocale, key);
const text = () => tree.root.findAllByType(Text).map(node => node.props.children).flat().join(' ');
const footer = () => tree.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
  !node.props.accessibilityLabel && typeof node.props.accessibilityState?.disabled === 'boolean' && node.props.accessibilityRole === 'button')!;
const next = async () => {
  expect(footer().props.disabled).not.toBe(true);
  await act(async () => { await footer().props.onPress(); });
};
const press = async (label: string) => {
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.props.accessibilityLabel === label || node.findAllByType(Text).some(child => child.props.children === label));
  expect(button).toBeDefined();
  await act(async () => { await button!.props.onPress(); });
};
const openNeeds = async (born: boolean) => {
  await act(async () => { tree = create(<GetUserInfoScreen />); });
  await next();
  act(() => tree.root.findByType(TextInput).props.onChangeText('F04 QA'));
  await next();
  await press(t('role.papa'));
  await next();
  await press(t(born ? 'flow.born' : 'flow.expecting'));
  await next();
  act(() => tree.root.findByType(IOSBottomDatePicker).props.onConfirm(new Date(born ? 2026 : 2027, 0, 1)));
  await next();
  await next(); // Optional mood.
  await next(); // Optional energy.
  expect(tree.root.findByType(SurveyStep).props.kind).toBe('needs');
};
const openDemo = async (need: OnboardingNeed) => {
  await press(t(`flow.${need}`));
  await next();
  await press(t('survey.remember'));
  await next();
  await press(t('survey.solo'));
  await next(); // Shared value.
  await next();
  expect(tree.root.findByType(ProductTryout).props.need).toBe(need);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'de';
  mockUser.user_metadata = {};
  mockProfile.mockResolvedValue({ error: null });
  mockSettingsRead.mockResolvedValue({ data: { id: 'f04-settings' }, error: null });
  mockSettingsWrite.mockResolvedValue({ error: null });
  mockSaveBaby.mockResolvedValue({ error: null });
  mockUpdateUser.mockResolvedValue({ error: null });
  mockPaywall.mockResolvedValue({ state: { subscriptionStatus: 'active', accessReason: 'family_subscription' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); });

it.each([true, false])('offers only available needs in baby mode=%s', born => {
  expect(getOnboardingNeeds(born)).toEqual(born ? ['sleep', 'daily'] : ['overview', 'checklist']);
});

it.each([true, false])('resolves a legacy need to the normal personalized fallback in baby mode=%s', born => {
  const start = getPersonalizedStart(born, mockLegacyAnswers.need);
  expect(start).toBe(born ? 'daily' : 'overview');
  const destination = born ? '/(tabs)/daily_old' : '/(tabs)/pregnancy-home';
  expect(getOnboardingDestination(born, start)).toBe(destination);
  expect(getPersonalizedStart(born, null)).toBe(start);
});

it.each([true, false])('resolves a legacy start directly without the diary redirect in baby mode=%s', born => {
  expect(getOnboardingDestination(born, mockLegacyAnswers.start))
    .toBe(born ? '/(tabs)/daily_old' : '/(tabs)/pregnancy-home');
});

it.each([
  ['de', 'Schlaf und Mahlzeiten festhalten – und später wiederfinden. Schon in der Schwangerschaft begleitet dich deine Wochenübersicht.'],
  ['en', 'Record sleep and meals to find again later. During pregnancy, start with your weekly overview.'],
  ['es', 'Registra el sueño y las comidas para volver a encontrarlos. Durante el embarazo, empieza con tu resumen semanal.'],
] as const)('shows an accurate welcome in %s even with saved legacy preferences', async (locale, expected) => {
  mockLocale = locale;
  mockUser.user_metadata = { onboarding_preferences: mockLegacyAnswers };
  await act(async () => { tree = create(<GetUserInfoScreen />); });
  expect(text()).toContain(expected);
  expect(text()).not.toMatch(/kleine Erinnerungen|little memories|pequeños recuerdos/);
});

const goals = [
  { born: true, need: 'sleep', route: '/(tabs)/sleep-tracker' },
  { born: true, need: 'daily', route: '/(tabs)/daily_old' },
  { born: false, need: 'overview', route: '/(tabs)/pregnancy-home' },
  { born: false, need: 'checklist', route: '/(tabs)/explore' },
] as const;
describe.each(['de', 'en', 'es'] as const)('%s actual onboarding wiring', locale => {
  it.each(goals)('finishes $need via the free-week explanation and the matching route (baby=$born)', async ({ born, need, route }) => {
    mockLocale = locale;
    await openNeeds(born);
    const labels = tree.root.findAllByType(TouchableOpacity).map(node => node.props.accessibilityLabel);
    expect(labels).not.toContain(t('flow.memories'));
    expect(labels).toContain(t(born ? 'flow.sleep' : 'flow.overview'));
    expect(labels).toContain(t(born ? 'flow.daily' : 'flow.checklist'));
    expect(tree.root.findByType(SurveyStep).props.value).toBeNull();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    await openDemo(need);
    await next(); // Skip the demo: no feedback about an unused feature.
    expect(tree.root.findAllByType(FeedbackStep)).toHaveLength(0);
    expect(tree.root.findByType(HabitStep).props.need).toBe(need);
    await next();
    expect(tree.root.findByType(OnboardingProductMoment).props.selectedStart).toBe(need);
    expect(text()).not.toContain(t('flow.startMemories'));
    await next();
    expect(tree.root.findAllByType(TrialStep)).toHaveLength(1);
    expect(footer().findAllByType(Text).map(node => node.props.children)).toContain(valueCopy(locale).trialCta);
    expect(mockReplace).not.toHaveBeenCalled();
    await next();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(route);
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { onboarding_preferences: {
      version: 1, need, challenge: 'remember', support: 'solo', habit: null, wellbeing: { mood: null, energy: null },
    } } });
    expect(mockSaveBaby).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

it.each([true, false])('clears a stale in-memory memories answer and shows the fallback without diary copy (baby=%s)', async born => {
  mockUser.user_metadata = { onboarding_preferences: mockLegacyAnswers };
  await openNeeds(born);
  // Saved preferences are not rehydrated by this screen. Also simulate a stale
  // answer from a previously mounted screen through its real survey callback.
  expect(tree.root.findByType(SurveyStep).props.value).toBeNull();
  act(() => tree.root.findByType(SurveyStep).props.onSelect(mockLegacyAnswers.need));
  expect(tree.root.findByType(SurveyStep).props.value).toBeNull();
  expect(footer().props.disabled).toBe(true);
  await openDemo(born ? 'daily' : 'overview');
  expect(text()).not.toMatch(/Tagebuch|erste.*Geschichte/);
  await next();
  await next();
  expect(tree.root.findByType(OnboardingProductMoment).props.selectedStart).toBe(born ? 'daily' : 'overview');
  expect(text()).not.toMatch(/Tagebuch|erste.*Geschichte/);
  await next(); // Free week.
  await next();
  expect(mockReplace).toHaveBeenCalledWith(born ? '/(tabs)/daily_old' : '/(tabs)/pregnancy-home');
});

it('preserves back/next, completed-demo feedback, changing goals and the paywall destination', async () => {
  await openNeeds(true);
  await openDemo('daily');
  await next();
  await press(t('common.back'));
  expect(tree.root.findByType(ProductTryout).props.need).toBe('daily');
  await press(t('survey.feedingAction'));
  await next();
  expect(tree.root.findAllByType(FeedbackStep)).toHaveLength(1);
  act(() => tree.root.findByType(FeedbackStep).props.onChooseAnother());
  expect(tree.root.findByType(SurveyStep).props.kind).toBe('needs');
  await openDemo('sleep');
  await next();
  act(() => tree.root.findByType(HabitStep).props.onSelect('quiet_moment'));
  await next();
  expect(tree.root.findByType(OnboardingProductMoment).props.habit).toBe('quiet_moment');
  mockPaywall.mockResolvedValue({ state: { subscriptionStatus: 'inactive', accessReason: 'none' } });
  await next();
  expect(tree.root.findAllByType(TrialStep)).toHaveLength(1);
  await next();
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/paywall', params: {
    next: '/(tabs)/sleep-tracker', origin: 'onboarding', trialExpired: '1',
  } });
});
