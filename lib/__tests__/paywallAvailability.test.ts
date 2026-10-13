import { getCachedUser } from '../supabase';
import {
  getCachedPremiumStatusResult,
  getCachedUserProfile,
  getCachedUserSettings,
} from '../appCache';
import { shouldRedirectToPaywallForState, shouldShowPaywall } from '../paywall';

jest.mock('../supabase', () => ({
  getCachedUser: jest.fn(),
  supabase: {},
}));
jest.mock('../appCache', () => ({
  getCachedPremiumStatusResult: jest.fn(),
  getCachedUserProfile: jest.fn(),
  getCachedUserSettings: jest.fn(),
}));
jest.mock('../paywallContent', () => ({
  getCachedPaywallContent: jest.fn().mockResolvedValue({ content: {} }),
  getPaywallTrialDays: jest.fn().mockReturnValue(7),
}));

const user = { id: 'parent-1', created_at: '2026-01-01T00:00:00Z' };

describe('automatic paywall availability', () => {
  beforeEach(() => {
    jest.mocked(getCachedUser).mockResolvedValue({ data: { user }, error: null } as any);
    jest.mocked(getCachedPremiumStatusResult).mockResolvedValue({
      status: 'inactive', isPro: false, source: 'revenuecat',
    });
    jest.mocked(getCachedUserProfile).mockResolvedValue({ id: user.id });
    jest.mocked(getCachedUserSettings).mockResolvedValue(null);
  });

  it('opens only when the signed-in account is confirmed inactive', async () => {
    await expect(shouldShowPaywall()).resolves.toMatchObject({ shouldShow: true });
  });

  it('does not mistake a failed Auth network request for a signed-out user', async () => {
    jest.mocked(getCachedUser).mockResolvedValue({
      data: { user: null }, error: new Error('offline'),
    } as any);
    const result = await shouldShowPaywall();
    expect(result).toMatchObject({
      shouldShow: true,
      state: { subscriptionStatus: 'unavailable' },
    });
    expect(shouldRedirectToPaywallForState(result.state)).toBe(false);
  });

  it('still treats a confirmed missing user as inactive', async () => {
    jest.mocked(getCachedUser).mockResolvedValue({
      data: { user: null }, error: null,
    } as any);
    await expect(shouldShowPaywall()).resolves.toMatchObject({ shouldShow: true });
  });

  it('does not redirect when RevenueCat or family access is unavailable', async () => {
    jest.mocked(getCachedPremiumStatusResult).mockResolvedValue({
      status: 'unavailable', isPro: null, source: 'family',
    });
    const result = await shouldShowPaywall();
    expect(result).toMatchObject({
      shouldShow: true,
      state: { subscriptionStatus: 'unavailable' },
    });
    expect(shouldRedirectToPaywallForState(result.state)).toBe(false);
  });

  it('does not interpret a failed profile lookup as a missing access role', async () => {
    jest.mocked(getCachedUserProfile).mockResolvedValue(null);
    const result = await shouldShowPaywall();
    expect(result).toMatchObject({
      shouldShow: true,
      state: { subscriptionStatus: 'unavailable' },
    });
    expect(shouldRedirectToPaywallForState(result.state)).toBe(false);
  });
});
