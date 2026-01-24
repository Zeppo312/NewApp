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
  configure: async () => {},
  getOfferings: async () => ({ current: null, all: {} }),
  purchasePackage: async () => {
    throw notSupportedError;
  },
  getCustomerInfo: async () => ({ entitlements: { active: {} } }),
  restorePurchases: async () => ({ entitlements: { active: {} } }),
};

export default Purchases;

