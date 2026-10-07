import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import SubscriptionScreen from '../../app/subscription';
import type { FamilyAccess } from '../familySubscriptionAccess';
import { getRevenueCatSubscriptionSummary } from '../revenuecat';

const mockUser = { id: 'partner' };
let mockFamily: FamilyAccess;
jest.mock('react-native-purchases', () => ({ __esModule: true, default: { showManageSubscriptions: jest.fn() } }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, session: {} }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/hooks/useFamilySubscriptionAccess', () => ({ useFamilySubscriptionAccess: () => mockFamily }));
jest.mock('../familySubscriptionAccess', () => ({ refreshFamilyAccess: jest.fn(), hasCheckedFamilyAccess: () => true }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null }, Redirect: () => null, useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/Header', () => () => null);
jest.mock('@/components/SubscriptionCancellationFeedbackModal', () => ({ SubscriptionCancellationFeedbackModal: () => null }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: require('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: require('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/constants/DesignGuide', () => ({ LiquidGlassCard: require('react-native').View, LAYOUT_PAD: 16 }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('../appCache', () => ({ getCachedUserProfile: jest.fn().mockResolvedValue({}), invalidatePremiumStatusCache: jest.fn() }));
jest.mock('../entitlements', () => ({ invalidateSubscriptionTierCache: jest.fn() }));
jest.mock('../subscriptionCancellationFeedback', () => ({ saveSubscriptionCancellationFeedback: jest.fn() }));
jest.mock('../revenuecat', () => ({
  getRevenueCatSubscriptionSummary: jest.fn(), hasRevenueCatEntitlement: jest.fn().mockResolvedValue(false),
  restoreRevenueCatPurchases: jest.fn(),
}));

describe('family subscription display', () => {
  let tree: ReactTestRenderer;
  const text = () => JSON.stringify(tree.toJSON());
  const mount = async () => { await act(async () => { tree = create(<SubscriptionScreen />); }); };
  beforeEach(() => {
    mockFamily = { status: 'active', userId: 'partner', tier: 'premium', expiresAt: '2026-10-12T12:00:00Z', validUntil: Date.now() + 300_000 };
    jest.mocked(getRevenueCatSubscriptionSummary).mockResolvedValue({ isActive: false } as any);
  });
  afterEach(() => { act(() => tree?.unmount()); });

  it('shows the shared plan without a purchase, renewal promise or store management', async () => {
    await mount();
    expect(text()).toContain('Premium · Familienabo');
    expect(text()).toContain('Aktiv über dein Familienabo');
    expect(text()).toContain('Zugang bis');
    expect(text()).toContain('Zugang aktualisieren');
    expect(text()).not.toContain('Abo im Store verwalten');
    expect(text()).not.toContain('Alle Abos ansehen');
    expect(text()).not.toContain('verlängert sich automatisch');
  });

  it('preserves management of an additional own subscription and explains that it keeps billing', async () => {
    jest.mocked(getRevenueCatSubscriptionSummary).mockResolvedValue({
      isActive: true, tier: 'lite', store: 'PLAY_STORE', planType: 'monthly',
      expiresDate: '2026-10-12', willRenew: true,
    } as any);
    await mount();
    expect(text()).toContain('Premium · Familienabo');
    expect(text()).toContain('Abo im Store verwalten');
    expect(text()).toContain('nicht automatisch gekündigt');
    expect(text()).not.toContain('Alle Abos ansehen');
  });

  it('shows an unavailable verification without claiming the account has no subscription', async () => {
    mockFamily = { status: 'unavailable', userId: 'partner' };
    await mount();
    expect(text()).toContain('Zugang derzeit nicht bestätigt');
    expect(text()).not.toContain('Derzeit kein aktives Abo');
    expect(text()).not.toContain('Abo auswählen');
  });
});
