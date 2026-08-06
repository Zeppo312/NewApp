import {
  getRevenueCatEntitlementStatus,
  initRevenueCat,
} from '../revenuecat';

jest.mock('@/lib/purchasesClient', () => ({
  configure: jest.fn(),
  isConfigured: jest.fn(),
  getAppUserID: jest.fn(),
  logIn: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null },
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('abcdef1234567890'),
}));

jest.mock('@sentry/react-native', () => ({
  withScope: (callback: (scope: any) => void) => callback({
    setTag: jest.fn(),
    setContext: jest.fn(),
  }),
  captureException: jest.fn(),
}));

const mockPurchases = jest.requireMock('@/lib/purchasesClient');
const { captureException: mockCaptureException } =
  jest.requireMock('@sentry/react-native');

describe('RevenueCat initialization and status', () => {
  beforeAll(() => {
    process.env.EXPO_PUBLIC_RC_IOS_KEY = 'appl_test_key';
  });

  beforeEach(() => {
    Object.values(mockPurchases).forEach((mock: any) => mock.mockReset());
    mockCaptureException.mockReset();
    mockPurchases.isConfigured.mockResolvedValue(true);
    mockPurchases.getAppUserID.mockResolvedValue('user-b');
    mockPurchases.logIn.mockResolvedValue({
      customerInfo: { entitlements: { active: {} } },
      created: false,
    });
  });

  it('serializes concurrent initialization and switches users with logIn', async () => {
    mockPurchases.isConfigured
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(true);
    mockPurchases.getAppUserID.mockResolvedValue('user-a');
    mockPurchases.logIn.mockResolvedValue({
      customerInfo: { entitlements: { active: {} } },
      created: false,
    });

    await Promise.all([
      initRevenueCat('user-a'),
      initRevenueCat('user-a'),
    ]);

    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: 'appl_test_key',
      appUserID: 'user-a',
    });

    await initRevenueCat('user-b');
    expect(mockPurchases.logIn).toHaveBeenCalledWith('user-b');
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable instead of inactive on a technical error', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' });
    await initRevenueCat('user-b');
    mockPurchases.getCustomerInfo.mockRejectedValueOnce(error);

    await expect(getRevenueCatEntitlementStatus('user-b')).resolves.toEqual({
      status: 'unavailable',
      error,
    });
    expect(mockCaptureException).toHaveBeenCalledWith(error);
    warning.mockRestore();
  });
});
