type NotSupportedError = {
  userCancelled?: boolean;
  message?: string;
  code?: string | number;
};

const notSupportedError: NotSupportedError = {
  code: 'NotSupported',
  message: 'RevenueCat is not supported on web.',
};

const Purchases = {
  configure: () => {},
  isConfigured: async () => true,
  getAppUserID: async () => 'web-user',
  logIn: async () => ({ customerInfo: { entitlements: { active: {} } }, created: false }),
  getOfferings: async () => ({ current: null, all: {} }),
  purchasePackage: async () => {
    throw notSupportedError;
  },
  getCustomerInfo: async () => ({ entitlements: { active: {} } }),
  restorePurchases: async () => ({ entitlements: { active: {} } }),
  addCustomerInfoUpdateListener: () => {},
  removeCustomerInfoUpdateListener: () => true,
};

export default Purchases;
