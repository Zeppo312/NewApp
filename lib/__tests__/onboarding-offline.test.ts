import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedUserProfile, getCachedUserSettings } from '../appCache';
import { getOnboardingCompletionState } from '../onboarding';

jest.mock('../appCache', () => ({
  getCachedUserProfile: jest.fn(),
  getCachedUserSettings: jest.fn(),
}));

const profile = getCachedUserProfile as jest.Mock;
const settings = getCachedUserSettings as jest.Mock;

describe('onboarding completion on an offline cold start', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('retains verified completion for the same user when profile caches are unavailable', async () => {
    profile.mockResolvedValueOnce({ id: 'parent-a', first_name: 'QA' }).mockResolvedValueOnce(null);
    settings.mockResolvedValueOnce({ user_id: 'parent-a' }).mockResolvedValueOnce(null);

    expect(await getOnboardingCompletionState('parent-a')).toBe(true);
    expect(await getOnboardingCompletionState('parent-a')).toBe(true);
    expect(await getOnboardingCompletionState('parent-b')).toBe(false);
  });

  it('revokes a remembered completion when both records are present but incomplete', async () => {
    profile.mockResolvedValueOnce({ id: 'parent-a', first_name: 'QA' })
      .mockResolvedValueOnce({ id: 'parent-a', first_name: '' })
      .mockResolvedValueOnce(null);
    settings.mockResolvedValueOnce({ user_id: 'parent-a' })
      .mockResolvedValueOnce({ user_id: 'parent-a' })
      .mockResolvedValueOnce(null);

    expect(await getOnboardingCompletionState('parent-a')).toBe(true);
    expect(await getOnboardingCompletionState('parent-a')).toBe(false);
    expect(await getOnboardingCompletionState('parent-a')).toBe(false);
  });
});
