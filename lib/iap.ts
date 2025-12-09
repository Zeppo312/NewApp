import { Platform } from 'react-native';

let IAP: typeof import('expo-in-app-purchases') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IAP = require('expo-in-app-purchases');
} catch (err) {
  console.warn('expo-in-app-purchases not available, falling back (web or missing native module)', err);
}

type PurchaseEvent =
  | { type: 'purchased'; productId: string }
  | { type: 'error'; error: string | number | undefined }
  | { type: 'restored'; productId: string };

const listeners = new Set<(event: PurchaseEvent) => void>();

export const PRODUCT_IDS = {
  monthly: 'lottibaby_monthly', // Store product id
  directMonthly: 'lottibaby_monthly',
  trialMonthly: 'lottibaby_monthly',
};

let initialized = false;

const notify = (event: PurchaseEvent) => {
  listeners.forEach(cb => cb(event));
};

export const subscribePurchases = (cb: (event: PurchaseEvent) => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const initIAP = async () => {
  if (Platform.OS === 'web' || !IAP) return;
  if (initialized) return;
  await IAP.connectAsync();
  IAP.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
    if (responseCode === IAP.IAPResponseCode.OK && results) {
      for (const purchase of results) {
        notify({ type: 'purchased', productId: purchase.productId });
        if (!purchase.acknowledged) {
          try {
            await IAP.finishTransactionAsync(purchase, true);
          } catch (err) {
            console.warn('finishTransaction error', err);
          }
        }
      }
    } else if (responseCode === IAP.IAPResponseCode.USER_CANCELED) {
      notify({ type: 'error', error: 'canceled' });
    } else {
      notify({ type: 'error', error: errorCode });
    }
  });
  // Warm product cache; errors are non-fatal.
  try {
    await IAP.getProductsAsync(Object.values(PRODUCT_IDS));
  } catch (err) {
    console.warn('getProductsAsync failed', err);
  }
  initialized = true;
};

export const fetchProducts = async () => {
  if (Platform.OS === 'web' || !IAP) {
    return [];
  }
  await initIAP();
  const { results } = await IAP.getProductsAsync(Object.values(PRODUCT_IDS));
  return results ?? [];
};

export const purchaseProduct = async (productId: string) => {
  if (Platform.OS === 'web' || !IAP) {
    // Fallback for web or missing native module: resolve immediately so UI can continue.
    notify({ type: 'purchased', productId });
    return;
  }
  await initIAP();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('Kauf abgelaufen oder keine Antwort'));
    }, 120000);

    const unsubscribe = subscribePurchases(event => {
      if (event.type === 'purchased' && event.productId === productId) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
      if (event.type === 'error') {
        clearTimeout(timeout);
        unsubscribe();
        reject(new Error(`Kauf fehlgeschlagen: ${event.error ?? 'unbekannt'}`));
      }
    });

    IAP.purchaseItemAsync(productId).catch(err => {
      clearTimeout(timeout);
      unsubscribe();
      reject(err);
    });
  });
};
