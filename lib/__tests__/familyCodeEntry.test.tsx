import { isPaywallExcludedPath } from '../paywallRoutes';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import AccountLinkingScreen from '../../app/(tabs)/account-linking';

const mockUser = { id: 'unpaid-partner' };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ refreshBabies: jest.fn() }) }));
jest.mock('@/contexts/BabyStatusContext', () => ({ useBabyStatus: () => ({ refreshBabyDetails: jest.fn() }) }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/lib/entitlements', () => ({ useFeatureAccess: () => ({ hasAccess: false }) }));
jest.mock('@/lib/familySubscriptionAccess', () => ({ invalidateFamilyAccess: jest.fn(), refreshFamilyAccess: jest.fn() }));
jest.mock('@/lib/redeemInvitationCodeFixed', () => ({ redeemInvitationCodeFixed: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  getUserInvitations: jest.fn().mockResolvedValue({ success: true, invitations: [] }),
  getLinkedUsers: jest.fn().mockResolvedValue({ success: true, linkedUsers: [{ linkId: 'legacy', firstName: 'Partner' }] }),
  createInvitationLink: jest.fn(), buildInvitationLink: jest.fn(), deactivateAccountLink: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/Header', () => () => null);
jest.mock('@/components/LinkedBabySelectionModal', () => ({ LinkedBabySelectionModal: () => null }));
jest.mock('@/components/account-linking-qr-modal', () => ({ AccountLinkingQrModal: () => null }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/constants/DesignGuide', () => ({ LiquidGlassCard: jest.requireActual('react-native').View, LAYOUT_PAD: 16 }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));

it('renders code entry and reinvitation guidance for a partner without feature access', async () => {
  let tree!: ReactTestRenderer;
  try {
    await act(async () => { tree = create(<AccountLinkingScreen />); });
    expect(tree.root.findByType(TextInput).props.maxLength).toBeGreaterThanOrEqual(32);
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Code einlösen');
    expect(text).toContain('kein eigenes Abo');
    expect(text).toContain('Deaktiviert die alte Verbindung');
  } finally { act(() => tree?.unmount()); }
});

 it('allows both invitation entry routes without exempting paid feature pages', () => {
   expect(isPaywallExcludedPath('/invite')).toBe(true);
   expect(isPaywallExcludedPath('/account-linking')).toBe(true);
   expect(isPaywallExcludedPath('/frag-lotti')).toBe(false);
   expect(isPaywallExcludedPath('/home')).toBe(false);
 });
