jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

jest.mock('../appCache', () => ({
  invalidateUserProfileCache: jest.fn(),
}));

import { invalidateUserProfileCache } from '../appCache';
import { supabase } from '../supabase';
import { acceptTerms, getTermsConsentState, TERMS_VERSION } from '../termsConsent';

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockInvalidateUserProfileCache = invalidateUserProfileCache as jest.Mock;
const mockMaybeSingle = jest.fn();

describe('terms consent evidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockRpc.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({ maybeSingle: mockMaybeSingle })),
        })),
      })),
    });
  });

  it('stores the current version only for the authenticated expected user', async () => {
    await expect(acceptTerms('login', 'user-123')).resolves.toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('record_terms_consent', {
      terms_version_param: TERMS_VERSION,
      source_param: 'login',
    });
    expect(mockInvalidateUserProfileCache).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the authenticated user does not match', async () => {
    await expect(acceptTerms('signup', 'other-user')).resolves.toEqual({
      success: false,
      error: 'not_authenticated',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fails closed when the consent write fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({ error: { message: 'database unavailable' } });

    await expect(acceptTerms('gate')).resolves.toEqual({
      success: false,
      error: 'database unavailable',
    });
    expect(mockInvalidateUserProfileCache).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('treats a read error as no consent', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'offline' } });

    await expect(getTermsConsentState()).resolves.toEqual({
      accepted: false,
      acceptedVersion: null,
      acceptedAt: null,
    });
    errorSpy.mockRestore();
  });

  it('accepts only a persisted record for the current terms version', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { accepted_at: '2026-08-20T10:00:00.000Z', terms_version: TERMS_VERSION },
      error: null,
    });

    await expect(getTermsConsentState()).resolves.toEqual({
      accepted: true,
      acceptedVersion: TERMS_VERSION,
      acceptedAt: '2026-08-20T10:00:00.000Z',
    });
  });
});
