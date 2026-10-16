import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasFinishedOnboardingBefore } from '../onboarding';

const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn();
jest.mock('../appCache', () => ({ getCachedUserProfile: jest.fn(), getCachedUserSettings: jest.fn() }));
jest.mock('../supabase', () => ({
  supabase: { from: () => ({ select: (...args: unknown[]) => { mockSelect(...args); return { eq: () => ({ maybeSingle: mockMaybeSingle }) }; } }) },
}));

describe('existing account check before the health consent', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('reads only the role from profiles and treats a missing role as a new account', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await hasFinishedOnboardingBefore('parent-a')).toBe(false);
    expect(mockSelect).toHaveBeenCalledWith('user_role');
    // Apple sign-in fills the name before onboarding; the role is only saved at the end.
    mockMaybeSingle.mockResolvedValueOnce({ data: { user_role: null }, error: null });
    expect(await hasFinishedOnboardingBefore('parent-a')).toBe(false);
  });

  it('recognizes a finished onboarding by role, answers or the remembered completion', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { user_role: 'mama' }, error: null });
    expect(await hasFinishedOnboardingBefore('parent-a')).toBe(true);
    expect(await hasFinishedOnboardingBefore('parent-a', true)).toBe(true);
    await AsyncStorage.setItem('onboarding_complete_v1:parent-b', '1');
    expect(await hasFinishedOnboardingBefore('parent-b')).toBe(true);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it('falls back to the blocking consent screen when the profile cannot be read', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    expect(await hasFinishedOnboardingBefore('parent-a')).toBe(true);
    mockMaybeSingle.mockRejectedValueOnce(new Error('offline'));
    expect(await hasFinishedOnboardingBefore('parent-a')).toBe(true);
  });
});
