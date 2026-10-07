import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { usePremiumFeatureAccess } from '../premiumFeatureAccess';
import { getCachedUserProfile } from '../appCache';

let mockUserId = 'partner';
let mockTier: 'standard' | 'premium' = 'standard';
let mockSubscriptionUserId = 'partner';
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUserId } }) }));
jest.mock('@/contexts/SubscriptionAccessContext', () => ({
  useSubscriptionAccess: () => ({
    userId: mockSubscriptionUserId,
    tier: mockTier,
    policy: jest.requireActual('../subscriptionFeaturePolicy').DEFAULT_SUBSCRIPTION_FEATURE_POLICY,
  }),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../appCache', () => ({ getCachedUserProfile: jest.fn() }));

function Probe() {
  return <Text>{String(usePremiumFeatureAccess('fuersorge'))}</Text>;
}

describe('premium feature access during family subscription changes', () => {
  let tree: ReactTestRenderer;
  const render = async () => { await act(async () => { tree = create(<Probe />); }); };
  beforeEach(() => {
    mockUserId = 'partner';
    mockSubscriptionUserId = 'partner';
    mockTier = 'standard';
    jest.mocked(getCachedUserProfile).mockResolvedValue({ is_admin: false, paywall_access_role: null } as any);
  });
  afterEach(() => { act(() => tree?.unmount()); });

  it('unlocks when family Premium arrives and locks again when it expires without refocusing', async () => {
    await render();
    expect(JSON.stringify(tree.toJSON())).toContain('false');

    mockTier = 'premium';
    await act(async () => { tree.update(<Probe />); });
    expect(JSON.stringify(tree.toJSON())).toContain('true');

    mockTier = 'standard';
    await act(async () => { tree.update(<Probe />); });
    expect(JSON.stringify(tree.toJSON())).toContain('false');
  });

  it('does not show the previous account’s Premium while the new account loads', async () => {
    mockTier = 'premium';
    await render();
    mockUserId = 'other';
    await act(async () => { tree.update(<Probe />); });
    expect(JSON.stringify(tree.toJSON())).toContain('null');
  });
});
