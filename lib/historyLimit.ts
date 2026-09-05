/**
 * Upsell-Hinweis für das 7-Tage-Verlaufslimit in Lotti Lite.
 *
 * Wird von den Verlaufsansichten aufgerufen, wenn die Nutzerin vor das
 * Cutoff-Datum (useHistoryCutoff) navigieren will. Die Daten bleiben
 * gespeichert – nur die Ansicht ist im Lite-Tier begrenzt.
 */

import { Alert } from 'react-native';
import type { useRouter } from 'expo-router';

import { LITE_HISTORY_DAYS } from '@/lib/entitlements';

type Router = ReturnType<typeof useRouter>;

export const showHistoryLimitAlert = (router: Router) => {
  Alert.alert(
    'Ältere Einträge freischalten',
    `In Lotti Lite siehst du den Verlauf der letzten ${LITE_HISTORY_DAYS} Tage. Deine älteren Einträge bleiben gespeichert – mit einem Abo sind sie sofort wieder da.`,
    [
      { text: 'Später', style: 'cancel' },
      {
        text: 'Abo ansehen',
        onPress: () => router.push('/paywall?origin=lock_fullHistory' as any),
      },
    ],
  );
};
