jest.mock('../familySubscriptionAccess', () => ({
  clearFamilyAccess: jest.fn(),
  checkFamilyPurchaseAccess: jest.fn().mockResolvedValue('allowed'),
}));

import { REVENUECAT_PLANS } from '../revenuecatProducts';
import { applePackage, googlePackage, customer } from './fixtures/revenuecat';
import { Platform } from 'react-native';
import {
  getRevenueCatConfigurationIssue,
  getRevenueCatPlanPricing,
  getRevenueCatEntitlementStatus,
  getRevenueCatStartupEvidence,
  getTierFromProductId,
  initRevenueCat,
  getRevenueCatSubscriptionSummary,
  getActiveSubscriptionTier,
  purchaseSubscriptionPlan,
  restoreRevenueCatPurchases,
  setRevenueCatSessionUser,
  subscribeToRevenueCatCustomerInfoUpdates,
  isRevenueCatPurchaseCancelled,
} from '../revenuecat';

jest.mock('@/lib/purchasesClient', () => ({
  configure: jest.fn(),
  isConfigured: jest.fn(),
  getAppUserID: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  isAnonymous: jest.fn(),
  invalidateCustomerInfoCache: jest.fn(),
  purchaseSubscriptionOption: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  getProducts: jest.fn(),
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

it('keeps the provider request date and subscription expiry for bounded offline startup', () => {
  const info = { ...customer(REVENUECAT_PLANS[0]), requestDate: new Date(Date.now() - 3_600_000).toISOString() };
  expect(getRevenueCatStartupEvidence(info)).toEqual({ verifiedAt: Date.parse(info.requestDate), subscriptionExpiresAt: Date.parse('2027-01-01T00:00:00Z') });
  expect(getRevenueCatStartupEvidence({ ...info, requestDate: null })).toBeNull();
  expect(getRevenueCatStartupEvidence({ ...info, requestDate: new Date(Date.now() + 60_000).toISOString() })).toBeNull();
  const expired = { ...info, entitlements: { active: { LottiBabyAbo: { ...info.entitlements.active.LottiBabyAbo, expirationDate: '2020-01-01' } } } };
  expect(getRevenueCatStartupEvidence(expired)).toBeNull();
});

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

  it('keeps missing Android configuration unavailable without repeated development warnings', async () => {
    const originalPlatform = Platform.OS;
    const originalKey = process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
    const originalLegacyKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      Platform.OS = 'android';
      process.env.EXPO_PUBLIC_RC_ANDROID_KEY = '';
      delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
      expect(getRevenueCatConfigurationIssue()).toContain('API Key für Android fehlt');
      for (let i = 0; i < 2; i++) {
        await expect(getRevenueCatEntitlementStatus('android-user')).resolves.toMatchObject({
          status: 'unavailable', error: expect.any(Error),
        });
      }
      expect(mockPurchases.getCustomerInfo).not.toHaveBeenCalled();
      expect(mockPurchases.configure).not.toHaveBeenCalled();
      expect(warning).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledTimes(1);
      expect(mockCaptureException).not.toHaveBeenCalled();

      // An empty preferred variable must not hide a valid legacy key.
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = ' goog_android_test_key ';
      mockPurchases.isConfigured.mockResolvedValueOnce(false).mockResolvedValue(true);
      await initRevenueCat('android-user');
      expect(mockPurchases.configure).toHaveBeenCalledWith({
        apiKey: 'goog_android_test_key', appUserID: 'android-user',
      });
    } finally {
      Platform.OS = originalPlatform;
      if (originalKey === undefined) delete process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
      else process.env.EXPO_PUBLIC_RC_ANDROID_KEY = originalKey;
      if (originalLegacyKey === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
      else process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = originalLegacyKey;
      warning.mockRestore();
      info.mockRestore();
    }
  });

  it('treats the existing monthly and yearly products as Standard', () => {
    expect(getTierFromProductId('lottibaby_monthly')).toBe('standard');
    expect(getTierFromProductId('lottibaby_yearly')).toBe('standard');
  });

  it('loads Standard pricing from the existing product IDs', async () => {
    mockPurchases.getOfferings.mockResolvedValue({ all: { default: { availablePackages: [
      {
        identifier: 'lottibaby_monthly', subscriptionPeriod: 'P1M',
        price: 3.79,
        priceString: '3,79 €', currencyCode: 'EUR',
      },
      {
        identifier: 'lottibaby_yearly', subscriptionPeriod: 'P1Y',
        price: 39.99,
        priceString: '39,99 €', currencyCode: 'EUR',
      },
      {
        identifier: 'lottibaby_standard_monthly',
        price: 2.99,
        priceString: '$2.99', currencyCode: 'USD',
      },
    ].map((product) => ({ product })) } } });

    await expect(getRevenueCatPlanPricing('user-b')).resolves.toMatchObject({
      standardMonthly: { price: 3.79, priceString: '3,79 €' },
      standardYearly: { price: 39.99, priceString: '39,99 €' },
    });
    expect(mockPurchases.getProducts).not.toHaveBeenCalled();
  });
});

// Native SDK boundary tests: these do not constitute a real store purchase.
describe('Google purchases, existing subscriptions and account isolation', () => {
  it.each(['family', 'unavailable'] as const)('never starts a store purchase when family access is %s', async status => {
    const familyCheck = jest.requireMock('../familySubscriptionAccess').checkFamilyPurchaseAccess;
    familyCheck.mockResolvedValueOnce(status);
    await expect(purchaseSubscriptionPlan('buyer', 'premium', 'monthly')).rejects.toMatchObject({
      reason: status === 'family' ? 'familySubscription' : 'unavailable',
    });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    expect(mockPurchases.purchaseSubscriptionOption).not.toHaveBeenCalled();
  });

  const originalOS = Platform.OS;
  const plan = REVENUECAT_PLANS[0];
  beforeEach(async () => {
    Object.values(mockPurchases).forEach((mock: any) => mock.mockReset());
    Platform.OS = 'android';
    process.env.EXPO_PUBLIC_RC_ANDROID_KEY = 'goog_fixture';
    process.env.EXPO_PUBLIC_RC_IOS_KEY = 'appl_fixture';
    mockPurchases.isConfigured.mockResolvedValue(true);
    mockPurchases.getAppUserID.mockResolvedValue('buyer');
    mockPurchases.getCustomerInfo.mockResolvedValue(customer());
    mockPurchases.getOfferings.mockResolvedValue({ all: { default: { availablePackages: REVENUECAT_PLANS.map(googlePackage) } } });
    mockPurchases.purchaseSubscriptionOption.mockResolvedValue({ customerInfo: customer(plan) });
    setRevenueCatSessionUser('buyer');
    await initRevenueCat('buyer');
  });
  afterEach(() => { Platform.OS = originalOS; jest.restoreAllMocks(); });

  it.each(REVENUECAT_PLANS)('purchases and recognizes $key with the existing shared entitlement', async (target) => {
    mockPurchases.purchaseSubscriptionOption.mockResolvedValueOnce({ customerInfo: customer(target) });
    await expect(purchaseSubscriptionPlan('buyer', target.tier, target.interval)).resolves.toBe(true);
    expect(mockPurchases.purchaseSubscriptionOption).toHaveBeenCalledWith(expect.objectContaining({ id: target.interval, productId: target.google, isBasePlan: true }));
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    mockPurchases.getCustomerInfo.mockResolvedValue(customer(target));
    await expect(getRevenueCatSubscriptionSummary('buyer')).resolves.toMatchObject({ isActive: true, tier: target.tier, planType: target.interval, store: 'PLAY_STORE', basePlanId: target.interval, willRenew: false });
    await expect(getActiveSubscriptionTier('buyer')).resolves.toBe(target.tier);
    mockPurchases.getCustomerInfo.mockResolvedValue(customer(target, 'PLAY_STORE', true));
    await expect(getRevenueCatSubscriptionSummary('buyer')).resolves.toMatchObject({ tier: target.tier, planType: target.interval });
  });
  it.each(['APP_STORE', 'PLAY_STORE', 'UNKNOWN_STORE'])('blocks new and changed plans while an existing %s subscription is active', async (store) => {
    mockPurchases.getCustomerInfo.mockResolvedValue(customer(plan, store));
    await expect(purchaseSubscriptionPlan('buyer', 'premium', 'yearly')).rejects.toMatchObject({ reason: 'activeSubscription' });
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).rejects.toMatchObject({ reason: 'activeSubscription' });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    expect(mockPurchases.purchaseSubscriptionOption).not.toHaveBeenCalled();
  });
  it('retains Apple access and store on Android, including cancelled renewal', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue(customer(plan, 'APP_STORE'));
    await expect(getRevenueCatSubscriptionSummary('buyer')).resolves.toMatchObject({ isActive: true, tier: 'lite', planType: 'monthly', store: 'APP_STORE', basePlanId: null, willRenew: false });
  });
  it.each(REVENUECAT_PLANS)('keeps Apple family-shared $key usable and blocks a duplicate purchase', async target => {
    Platform.OS = 'ios';
    const info = customer(target, 'APP_STORE');
    info.entitlements.active.LottiBabyAbo = {
      ...info.entitlements.active.LottiBabyAbo,
      ownershipType: 'FAMILY_SHARED',
    } as typeof info.entitlements.active.LottiBabyAbo;
    mockPurchases.getCustomerInfo.mockResolvedValue(info);
    await expect(getRevenueCatSubscriptionSummary('buyer')).resolves.toMatchObject({
      isActive: true, tier: target.tier, store: 'APP_STORE', planType: target.interval,
    });
    await expect(getActiveSubscriptionTier('buyer')).resolves.toBe(target.tier);
    await expect(purchaseSubscriptionPlan('buyer', target.tier, target.interval))
      .rejects.toMatchObject({ reason: 'activeSubscription' });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });
  it('fails closed for missing entitlement bindings, unavailable status and missing offering', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValueOnce({ ...customer(), activeSubscriptions: ['unmapped:monthly'] });
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).rejects.toMatchObject({ reason: 'activeSubscription' });
    mockPurchases.getCustomerInfo.mockRejectedValueOnce(new Error('offline'));
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).rejects.toThrow('offline');
    mockPurchases.getOfferings.mockResolvedValue({ current: { availablePackages: [googlePackage(plan)] }, all: {} });
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).rejects.toMatchObject({ reason: 'unavailable' });
    expect(mockPurchases.purchaseSubscriptionOption).not.toHaveBeenCalled();
  });
  it.each(['test_fixture', 'appl_fixture', 'sk_secret', 'invalid'])('blocks Android configuration %s before reaching the native purchase', async (key) => {
    process.env.EXPO_PUBLIC_RC_ANDROID_KEY = key;
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).rejects.toThrow('goog_');
    expect(mockPurchases.purchaseSubscriptionOption).not.toHaveBeenCalled();
  });
  it('blocks a price that changed since presentation', async () => {
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly', { price: 1, priceString: '$1.00', currencyCode: 'USD' })).rejects.toMatchObject({ reason: 'priceChanged' });
    expect(mockPurchases.purchaseSubscriptionOption).not.toHaveBeenCalled();
  });
  it('does not report an unrelated entitlement or an unactivated/pending purchase as success', async () => {
    mockPurchases.purchaseSubscriptionOption.mockResolvedValueOnce({ customerInfo: customer(REVENUECAT_PLANS[4]) });
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).resolves.toBe(false);
    mockPurchases.purchaseSubscriptionOption.mockResolvedValueOnce({ customerInfo: customer() });
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).resolves.toBe(false);
  });
  it.each([{ userCancelled: true, code: '1' }, { code: '20', message: 'pending payment' }, { code: '2', message: 'network cannot cancel request' }])('propagates native cancellation, pending and errors without granting access: %j', async (error) => {
    mockPurchases.purchaseSubscriptionOption.mockRejectedValueOnce(error);
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).rejects.toEqual(error);
    expect(isRevenueCatPurchaseCancelled(error)).toBe(error.code === '1');
  });
  it('restores active access, returns false without it and propagates restore failure', async () => {
    mockPurchases.restorePurchases.mockResolvedValueOnce(customer(plan));
    await expect(restoreRevenueCatPurchases('buyer')).resolves.toBe(true);
    mockPurchases.restorePurchases.mockResolvedValueOnce(customer());
    await expect(restoreRevenueCatPurchases('buyer')).resolves.toBe(false);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockPurchases.restorePurchases.mockRejectedValueOnce(new Error('restore offline'));
    await expect(restoreRevenueCatPurchases('buyer')).rejects.toThrow('restore offline');
  });
  it.each(REVENUECAT_PLANS)('retains iOS purchasePackage and target recognition for $key', async (target) => {
    Platform.OS = 'ios';
    mockPurchases.getOfferings.mockResolvedValue({ all: { default: { availablePackages: [applePackage(target)] } } });
    mockPurchases.purchasePackage.mockResolvedValueOnce({ customerInfo: customer(target, 'APP_STORE') });
    await expect(purchaseSubscriptionPlan('buyer', target.tier, target.interval)).resolves.toBe(true);
    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(applePackage(target));
    expect(mockPurchases.purchaseSubscriptionOption).not.toHaveBeenCalled();
  });
  it('allows an Apple same-store change but does not call an old entitlement a completed downgrade', async () => {
    Platform.OS = 'ios';
    mockPurchases.getCustomerInfo.mockResolvedValue(customer(REVENUECAT_PLANS[4], 'APP_STORE'));
    mockPurchases.getOfferings.mockResolvedValue({ all: { default: { availablePackages: [applePackage(plan)] } } });
    mockPurchases.purchasePackage.mockResolvedValueOnce({ customerInfo: customer(REVENUECAT_PLANS[4], 'APP_STORE') });
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).resolves.toBe(false);
    expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
  });
  it('prevents a Google subscriber from buying a second subscription on iOS', async () => {
    Platform.OS = 'ios';
    mockPurchases.getCustomerInfo.mockResolvedValue(customer(plan));
    await expect(purchaseSubscriptionPlan('buyer', 'premium', 'yearly')).rejects.toMatchObject({ reason: 'activeSubscription' });
  });
  it('selects the highest mapped tier even with a shared legacy entitlement', async () => {
    const info = customer(REVENUECAT_PLANS[4]);
    info.entitlements.active.LottiBabyLite = { ...customer(plan).entitlements.active.LottiBabyAbo };
    mockPurchases.getCustomerInfo.mockResolvedValue(info);
    await expect(getActiveSubscriptionTier('buyer')).resolves.toBe('premium');
  });
  it('keeps shorter Apple family Premium above longer own Lite on one legacy entitlement', async () => {
    const info = customer(REVENUECAT_PLANS[0], 'APP_STORE');
    const premium = {
      productIdentifier: 'lottibaby_premium_monthly', store: 'APP_STORE',
      isActive: true, ownershipType: 'FAMILY_SHARED', willRenew: true,
      expiresDate: '2026-10-01T12:00:00Z', gracePeriodExpiresDate: null, refundedAt: null,
    };
    mockPurchases.getCustomerInfo.mockResolvedValue({ ...info,
      subscriptionsByProductIdentifier: { [premium.productIdentifier]: premium },
    });
    await expect(getActiveSubscriptionTier('buyer')).resolves.toBe('premium');
    await expect(getRevenueCatSubscriptionSummary('buyer')).resolves.toMatchObject({
      isActive: true, tier: 'premium', productId: premium.productIdentifier,
      store: 'APP_STORE', planType: 'monthly', willRenew: true,
      expiresDate: premium.expiresDate,
    });
  });
  it.each([
    { isActive: false },
    { refundedAt: '2026-09-29T10:00:00Z' },
    { productIdentifier: 'unknown_premium' },
    { store: 'PROMOTIONAL' },
    { store: 'PLAY_STORE' },
  ])('does not promote Lite from an invalid overlapping subscription: %o', async (override) => {
    const info = customer(REVENUECAT_PLANS[0], 'APP_STORE');
    mockPurchases.getCustomerInfo.mockResolvedValue({ ...info,
      subscriptionsByProductIdentifier: { premium: {
        productIdentifier: 'lottibaby_premium_monthly', store: 'APP_STORE',
        isActive: true, refundedAt: null, ...override,
      } },
    });
    await expect(getActiveSubscriptionTier('buyer')).resolves.toBe('lite');
  });
  it('requires a recognized active entitlement before using overlapping subscription metadata', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({ ...customer(),
      subscriptionsByProductIdentifier: { premium: {
        productIdentifier: 'lottibaby_premium_monthly', store: 'APP_STORE', isActive: true,
      } },
    });
    await expect(getActiveSubscriptionTier('buyer')).resolves.toBeNull();
  });
  it('discards in-flight results and queued purchases on account changes', async () => {
    let finish!: (info: any) => void;
    mockPurchases.getCustomerInfo.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const oldStatus = getRevenueCatEntitlementStatus('buyer');
    while (!finish) await Promise.resolve();
    const queuedPurchase = purchaseSubscriptionPlan('buyer', 'lite', 'monthly');
    const rejectedPurchase = expect(queuedPurchase).rejects.toThrow('Konto');
    setRevenueCatSessionUser('other-user');
    finish(customer(plan));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(oldStatus).resolves.toMatchObject({ status: 'unavailable' });
    await rejectedPurchase;
    await initRevenueCat('other-user');
    expect(mockPurchases.logIn).toHaveBeenLastCalledWith('other-user');
    expect(mockPurchases.purchaseSubscriptionOption).not.toHaveBeenCalled();
  });
  it('does not purchase if logout happens while the offerings request is in flight', async () => {
    let finish!: (value: any) => void;
    mockPurchases.getOfferings.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const operation = purchaseSubscriptionPlan('buyer', 'lite', 'monthly');
    const rejected = expect(operation).rejects.toThrow('Konto');
    while (!finish) await Promise.resolve();
    setRevenueCatSessionUser(null);
    setRevenueCatSessionUser('buyer');
    finish({ all: { default: { availablePackages: [googlePackage(plan)] } } });
    await rejected;
    await initRevenueCat('buyer');
    expect(mockPurchases.logOut).toHaveBeenCalledTimes(1);
    expect(mockPurchases.purchaseSubscriptionOption).not.toHaveBeenCalled();
  });
  it('recognizes an expired subscription as inactive and a missing Google base plan as unknown duration', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValueOnce(customer());
    await expect(getRevenueCatSubscriptionSummary('buyer')).resolves.toMatchObject({ isActive: false, tier: null });
    const info = customer(plan);
    mockPurchases.getCustomerInfo.mockResolvedValueOnce({ ...info, entitlements: { active: {
      LottiBabyAbo: { ...info.entitlements.active.LottiBabyAbo, productPlanIdentifier: null },
    } } });
    await expect(getRevenueCatSubscriptionSummary('buyer')).resolves.toMatchObject({ isActive: true, tier: 'lite', planType: 'unknown', basePlanId: null });
  });
  it('blocks listeners and old screens immediately at logout; logging back in re-identifies the account', async () => {
    const listener = jest.fn();
    const dispose = subscribeToRevenueCatCustomerInfoUpdates('buyer', listener);
    await initRevenueCat('buyer');
    const nativeListener = mockPurchases.addCustomerInfoUpdateListener.mock.calls[0][0];
    nativeListener(customer(plan));
    expect(listener).toHaveBeenCalledTimes(1);
    setRevenueCatSessionUser(null);
    nativeListener(customer(plan));
    await expect(purchaseSubscriptionPlan('buyer', 'lite', 'monthly')).rejects.toThrow('Konto');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockPurchases.logOut).toHaveBeenCalledTimes(1);
    setRevenueCatSessionUser('buyer');
    mockPurchases.getAppUserID.mockResolvedValue('$RCAnonymousID:fixture');
    await initRevenueCat('buyer');
    expect(mockPurchases.logIn).toHaveBeenLastCalledWith('buyer');
    dispose();
    expect(mockPurchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(nativeListener);
  });
});
