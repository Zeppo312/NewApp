import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  usePathname,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View, ActivityIndicator, Alert, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { StartupMessageModal } from '@/components/StartupMessageModal';
import { LottiMomentToast } from '@/components/LottiMomentToast';
import { TermsConsentGate } from '@/components/moderation/TermsConsentGate';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BabyStatusProvider, useBabyStatus } from '@/contexts/BabyStatusContext';
import { ActiveBabyProvider, useActiveBaby } from '@/contexts/ActiveBabyContext';
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { ConvexProvider, useConvex } from '@/contexts/ConvexContext';
import { BackendProvider, useBackend } from '@/contexts/BackendContext';
import { BackgroundProvider } from '@/contexts/BackgroundContext';
import { LocaleProvider, useLocale } from '@/contexts/LocaleContext';
import { getDeviceAppLocale } from '@/lib/localization';
import { useNotifications } from '@/hooks/useNotifications';
import { useSleepWindowNotifications } from '@/hooks/useSleepWindowNotifications';
import { useFeedingReminderNotifications } from '@/hooks/useFeedingReminderNotifications';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useVitaminDReminderNotifications } from '@/hooks/useVitaminDReminderNotifications';
import { initializePersonalization, predictNextSleepWindow, type SleepWindowPrediction } from '@/lib/sleep-window';
import { predictNextFeedingTime, type FeedingPrediction } from '@/lib/feeding-interval';
import { getBabyInfo } from '@/lib/baby';
import { supabase, getAppSettings } from '@/lib/supabase';
import type { SleepEntry } from '@/lib/sleepData';
import type { BabyCareEntry } from '@/lib/supabase';
import {
  invalidatePremiumStatusCache,
  invalidateUserProfileCache,
  preloadAppData,
} from '@/lib/appCache';
import { maybeCleanupCache } from '@/lib/imageCache';
import { invalidateSubscriptionTierCache } from '@/lib/entitlements';
import { markPaywallShown, shouldShowPaywall } from '@/lib/paywall';
import { subscribeToRevenueCatCustomerInfoUpdates } from '@/lib/revenuecat';
import { SleepEntriesService } from '@/lib/services/SleepEntriesService';
import { normalizeBedtimeAnchor } from '@/lib/bedtime';
import { sleepActivityService } from '@/lib/sleepActivityService';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
import { findFreshActiveSleepEntry } from '@/lib/sleepEntryGuards';
import {
  clearShoppingWidget,
  drainShoppingWidgetToggles,
  isShoppingWidgetSupported,
} from '@/lib/shoppingWidget';
import {
  acknowledgeStartupMessage,
  getPendingStartupMessage,
  type StartupMessage,
} from '@/lib/startupMessages';
import { getTermsConsentState } from '@/lib/termsConsent';

// Importieren der Meilenstein-Task-Definition
import { defineMilestoneCheckerTask } from '@/tasks/milestoneCheckerTask';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://a379435f1d8ad0e5df795df00050dd95@o4506394338263040.ingest.us.sentry.io/4509762120056832',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  // Baby- und Familienkontext ist besonders sensibel: keine Standard-PII an
  // Sentry senden und Replays explizit vollständig maskieren.
  sendDefaultPii: false,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
      maskAllVectors: true,
      screenshotStrategy: 'canvas',
    }),
    Sentry.feedbackIntegration(),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Task-Definition früh registrieren. Ohne native Registrierung läuft daraus
// derzeit kein systemischer Background-Fetch.
defineMilestoneCheckerTask();

// Konfiguriere das Verhalten von Benachrichtigungen für die gesamte App
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const PAYWALL_EXCLUDED_PATHS = new Set([
  '/',
  '/paywall',
  '/datenschutz',
  '/impressum',
  '/nutzungsbedingungen',
  '/dsgvo',
]);

// Wrapper-Komponente, die den AuthProvider verwendet
function RootLayoutNav() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const { loading, user, signOut } = useAuth();
  const { isLocaleReady, locale } = useLocale();
  const layoutCopy = locale === 'en'
    ? { error: 'Error', startupFailed: 'The message could not be confirmed. Please try again.', loading: 'Loading …' }
    : locale === 'es'
      ? { error: 'Error', startupFailed: 'No se pudo confirmar el mensaje. Inténtalo de nuevo.', loading: 'Cargando …' }
      : { error: 'Fehler', startupFailed: 'Die Nachricht konnte gerade nicht bestätigt werden. Bitte versuche es erneut.', loading: 'Lade …' };
  const userId = user?.id ?? null;
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const { isResolved: isBabyStatusResolved } = useBabyStatus();
  const { requestPermissions, expoPushToken } = useNotifications();
  const { activeBabyId } = useActiveBaby();
  const { activeBackend } = useBackend();
  const { convexClient } = useConvex();
  const [sleepPrediction, setSleepPrediction] = useState<SleepWindowPrediction | null>(null);
  const [hasActiveSleepEntry, setHasActiveSleepEntry] = useState(false);
  const [feedingPrediction, setFeedingPrediction] = useState<FeedingPrediction | null>(null);
  const [hasActiveFeedingEntry, setHasActiveFeedingEntry] = useState(false);
  const { preferences: notifPrefs, isLoaded: notificationPreferencesLoaded } = useNotificationPreferences();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSettingsLoaded, setNotificationSettingsLoaded] = useState(false);
  const [appStateRevision, setAppStateRevision] = useState(0);
  const paywallCheckInFlight = useRef(false);
  const startupMessageCheckInFlight = useRef(false);
  const primarySegment = typeof segments[0] === 'string' ? segments[0] : null;
  const isLegalConsentRoute = pathname === '/nutzungsbedingungen' || pathname === '/datenschutz';
  const shouldSkipGlobalPaywallCheck = useMemo(() => {
    if (!pathname || PAYWALL_EXCLUDED_PATHS.has(pathname)) {
      return true;
    }

    return primarySegment === '(auth)' || primarySegment === 'auth';
  }, [pathname, primarySegment]);
  const shouldSkipStartupMessageCheck = useMemo(() => {
    if (!pathname) {
      return true;
    }

    if (primarySegment === '(auth)' || primarySegment === 'auth') {
      return true;
    }

    return pathname === '/paywall';
  }, [pathname, primarySegment]);
  const sleepEntriesService = useMemo(() => {
    if (!userId) return null;
    return new SleepEntriesService(activeBackend, convexClient, userId);
  }, [activeBackend, convexClient, userId]);
  const [startupMessage, setStartupMessage] = useState<StartupMessage | null>(null);
  const [isAcknowledgingStartupMessage, setIsAcknowledgingStartupMessage] = useState(false);
  const [termsConsent, setTermsConsent] = useState<{
    userId: string | null;
    accepted: boolean;
  }>({ userId: null, accepted: false });

  const refreshPaywallState = useCallback(async () => {
    await invalidateUserProfileCache();
    setAppStateRevision((prev) => prev + 1);
  }, []);

  const handleRevenueCatCustomerInfoUpdate = useCallback(async () => {
    invalidateSubscriptionTierCache();
    await invalidatePremiumStatusCache();
    setAppStateRevision((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // RevenueCat aktualisiert CustomerInfo beim Aktivieren selbst. Den
        // last-known-active Cache behalten wir bis zu diesem Update bei.
        void refreshPaywallState();
      }
    });

    return () => {
      sub.remove();
    };
  }, [refreshPaywallState]);

  useEffect(() => {
    if (!userId) return;

    return subscribeToRevenueCatCustomerInfoUpdates(userId, () => {
      void handleRevenueCatCustomerInfoUpdate();
    });
  }, [handleRevenueCatCustomerInfoUpdate, userId]);

  // Im Home-Screen-Widget abgehakte Einkäufe nach Supabase nachziehen — auch
  // dann, wenn die Einkaufsliste selbst gar nicht geöffnet wird.
  useEffect(() => {
    if (!isShoppingWidgetSupported()) return undefined;

    if (!userId || !activeBabyId) {
      void clearShoppingWidget();
      return undefined;
    }

    let inFlight = false;
    const drain = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await drainShoppingWidgetToggles(activeBabyId, { locale });
      } catch (error) {
        console.warn('Failed to sync shopping widget toggles:', error);
      } finally {
        inFlight = false;
      }
    };

    void drain();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void drain();
    });

    return () => {
      sub.remove();
    };
  }, [activeBabyId, locale, userId]);

  useEffect(() => {
    if (loading || !userId || !isBabyStatusResolved || shouldSkipGlobalPaywallCheck) {
      return;
    }

    if (paywallCheckInFlight.current) return;

    let cancelled = false;
    paywallCheckInFlight.current = true;

    const checkGlobalPaywallGate = async () => {
      try {
        const { shouldShow, state } = await shouldShowPaywall();
        if (!shouldShow || cancelled || !pathname) return;

        await markPaywallShown(pathname);
        if (cancelled) return;

        router.replace({
          pathname: '/paywall',
          params: {
            next: pathname,
            origin: pathname,
            trialExpired: state.isTrialExpired ? '1' : '0',
          },
        });
      } catch (error) {
        console.error('Global paywall check failed:', error);
      } finally {
        paywallCheckInFlight.current = false;
      }
    };

    void checkGlobalPaywallGate();

    return () => {
      cancelled = true;
      paywallCheckInFlight.current = false;
    };
  }, [appStateRevision, isBabyStatusResolved, loading, pathname, router, shouldSkipGlobalPaywallCheck, userId]);

  useEffect(() => {
    if (loading || !userId || !isBabyStatusResolved || shouldSkipStartupMessageCheck) {
      if (!userId) {
        setStartupMessage(null);
      }
      return;
    }

    if (startupMessageCheckInFlight.current || isAcknowledgingStartupMessage) return;

    let cancelled = false;
    startupMessageCheckInFlight.current = true;

    const checkStartupMessage = async () => {
      try {
        const nextMessage = await getPendingStartupMessage();
        if (cancelled) return;
        setStartupMessage(nextMessage);
      } catch (error) {
        console.error('Startup message check failed:', error);
      } finally {
        startupMessageCheckInFlight.current = false;
      }
    };

    void checkStartupMessage();

    return () => {
      cancelled = true;
      startupMessageCheckInFlight.current = false;
    };
  }, [
    appStateRevision,
    isAcknowledgingStartupMessage,
    isBabyStatusResolved,
    loading,
    shouldSkipStartupMessageCheck,
    userId,
  ]);

  // EULA-Gate: Bestandsnutzer ohne aktuelle Zustimmung müssen bestätigen,
  // bevor sie Community und Chat weiter nutzen können (App Store Guideline 1.2).
  useEffect(() => {
    if (loading || !userId || primarySegment === '(auth)' || primarySegment === 'auth' || isLegalConsentRoute) {
      return;
    }

    let cancelled = false;

    void getTermsConsentState().then((state) => {
      if (cancelled) return;
      setTermsConsent({ userId, accepted: state.accepted });
    });

    return () => {
      cancelled = true;
    };
  }, [appStateRevision, isLegalConsentRoute, loading, primarySegment, userId]);

  const handleStartupMessageConfirm = useCallback(async () => {
    if (!startupMessage || isAcknowledgingStartupMessage) {
      return;
    }

    const confirmedMessageId = startupMessage.id;
    setIsAcknowledgingStartupMessage(true);

    try {
      await acknowledgeStartupMessage(confirmedMessageId);
      setStartupMessage((current) =>
        current?.id === confirmedMessageId ? null : current,
      );
    } catch (error) {
      console.error('Failed to acknowledge startup message:', error);
      Alert.alert(
        layoutCopy.error,
        layoutCopy.startupFailed,
      );
    } finally {
      setIsAcknowledgingStartupMessage(false);
    }
  }, [isAcknowledgingStartupMessage, startupMessage]);

  useEffect(() => {
    if (!userId) {
      setNotificationsEnabled(false);
      setNotificationSettingsLoaded(false);
      return;
    }

    let mounted = true;
    setNotificationSettingsLoaded(false);

    const loadNotificationSetting = async () => {
      try {
        const { data, error } = await getAppSettings();
        if (!mounted) return;

        if (error) {
          console.error('Fehler beim Laden von notifications_enabled:', error);
          setNotificationsEnabled(true);
        } else {
          setNotificationsEnabled(data?.notifications_enabled !== false);
        }
      } catch (error) {
        if (mounted) {
          console.error('Fehler beim Laden von notifications_enabled:', error);
          setNotificationsEnabled(true);
        }
      } finally {
        if (mounted) setNotificationSettingsLoaded(true);
      }
    };

    void loadNotificationSetting();

    const channel = supabase
      .channel(`user-settings-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const nextValue = (payload.new as { notifications_enabled?: unknown } | null)
            ?.notifications_enabled;
          if (typeof nextValue === 'boolean') {
            setNotificationsEnabled(nextValue);
            setNotificationSettingsLoaded(true);
            return;
          }
          void loadNotificationSetting();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    initializePersonalization(activeBabyId ?? undefined).catch((error) => {
      console.error('Fehler beim Initialisieren der Sleep-Personalisierung:', error);
    });
  }, [userId, activeBabyId]);

  // Registriere Push-Notifications, wenn der Benutzer angemeldet ist
  useEffect(() => {
    if (userId && notificationSettingsLoaded && notificationsEnabled) {
      // Push-Token registrieren für Remote-Notifications
      requestPermissions().catch(error => {
        console.error('Fehler beim Registrieren von Push-Notifications:', error);
      });
    }
  }, [userId, notificationSettingsLoaded, notificationsEnabled, requestPermissions]);

  // Sleep Window Prediction für Benachrichtigungen berechnen
  useEffect(() => {
    if (!userId || !activeBabyId || !sleepEntriesService) {
      setSleepPrediction(null);
      setHasActiveSleepEntry(false);
      return;
    }

    const loadSleepPrediction = async () => {
      try {
        // Baby-Info laden
        const { data: babyInfo, error: babyError } = await getBabyInfo(activeBabyId);
        if (babyError || !babyInfo?.birth_date) {
          setSleepPrediction(null);
          return;
        }

        // Sichtbare Einträge (inkl. Partner) über denselben Service wie im Sleep Tracker laden
        const { data: entries, error } = await sleepEntriesService.getEntries(activeBabyId ?? undefined);

        if (error) {
          console.error('Fehler beim Laden der Schlafeinträge für Prediction:', error);
          setSleepPrediction(null);
          return;
        }

        const hasActiveEntry = Boolean(findFreshActiveSleepEntry(entries || []));
        setHasActiveSleepEntry(hasActiveEntry);
        if (hasActiveEntry) {
          // Während ein Sleep-Timer läuft, keine Schlafenszeit-Erinnerung planen.
          setSleepPrediction(null);
          return;
        }

        // Prediction berechnen
        const anchorBedtime = normalizeBedtimeAnchor(
          (babyInfo as { preferred_bedtime?: string | null }).preferred_bedtime
        );
        const prediction = await predictNextSleepWindow({
          userId,
          babyId: activeBabyId ?? undefined,
          birthdate: babyInfo.birth_date,
          entries: (entries || []) as SleepEntry[],
          anchorBedtime,
        });

        // Nur setzen, wenn Confidence ausreichend ist
        // Der Hook prüft confidence >= 0.6, gleiche Schwelle hier
        if (prediction && prediction.confidence >= 0.6) {
          setSleepPrediction(prediction);
        } else {
          setSleepPrediction(null);
        }
      } catch (error) {
        console.error('Fehler beim Berechnen der Sleep Prediction:', error);
        setSleepPrediction(null);
      }
    };

    loadSleepPrediction();

    // Alle 5 Minuten aktualisieren
    const interval = setInterval(loadSleepPrediction, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, activeBabyId, sleepEntriesService]);

  // Feeding Prediction für Benachrichtigungen berechnen
  useEffect(() => {
    if (!userId || !activeBabyId) {
      setFeedingPrediction(null);
      setHasActiveFeedingEntry(false);
      return;
    }

    let cancelled = false;

    const loadFeedingPrediction = async () => {
      try {
        // Baby-Info laden
        const { data: babyInfo, error: babyError } = await getBabyInfo(activeBabyId);
        if (cancelled) return;

        if (babyError || !babyInfo?.birth_date) {
          setHasActiveFeedingEntry(false);
          setFeedingPrediction(null);
          return;
        }

        // Fütterungseinträge der letzten 7 Tage laden
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: entries, error } = await supabase
          .from('baby_care_entries')
          .select('*')
          .eq('baby_id', activeBabyId)
          .eq('entry_type', 'feeding')
          .gte('start_time', sevenDaysAgo.toISOString())
          .order('start_time', { ascending: false });

        if (cancelled) return;

        if (error) {
          console.error('Fehler beim Laden der Feeding-Einträge für Prediction:', error);
          setFeedingPrediction(null);
          return;
        }

        const hasOpenFeeding = (entries || []).some((entry) => entry.end_time == null);
        setHasActiveFeedingEntry(hasOpenFeeding);

        if (hasOpenFeeding) {
          setFeedingPrediction(null);
          return;
        }

        const prediction = predictNextFeedingTime({
          babyBirthDate: babyInfo.birth_date,
          recentFeedings: (entries || []) as BabyCareEntry[],
        });

        setFeedingPrediction(prediction);
      } catch (error) {
        console.error('Fehler beim Berechnen der Feeding Prediction:', error);
        setFeedingPrediction(null);
      }
    };

    void loadFeedingPrediction();

    // Alle 5 Minuten aktualisieren
    const interval = setInterval(loadFeedingPrediction, 5 * 60 * 1000);

    const channel = supabase
      .channel(`feeding-reminder-prediction-${userId}-${activeBabyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'baby_care_entries',
          filter: `baby_id=eq.${activeBabyId}`,
        },
        (payload) => {
          const nextRow = payload.new as { entry_type?: unknown } | null;
          const previousRow = payload.old as { entry_type?: unknown } | null;
          const entryType = nextRow?.entry_type ?? previousRow?.entry_type;
          if (entryType !== 'feeding') return;
          void loadFeedingPrediction();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId, activeBabyId]);

  // Live Activity nach App-Start / Update wiederherstellen
  useEffect(() => {
    if (!userId || !sleepActivityService.isLiveActivitySupported()) return;

    let cancelled = false;

    const restoreLiveActivity = async () => {
      try {
        const existing = await sleepActivityService.restoreCurrentActivity();
        if (cancelled) return;

        // DB-Zustand laden
        const { success, entries } = await loadAllVisibleSleepEntries();
        if (cancelled || !success || !entries) return;

        const activeEntry = findFreshActiveSleepEntry(entries);

        // Kein aktiver Schlaf in DB → stale Activity beenden
        if (!activeEntry?.start_time) {
          if (existing?.isTracking) {
            await sleepActivityService.endAllSleepActivities();
          }
          return;
        }

        const startDate = new Date(activeEntry.start_time);
        if (!Number.isFinite(startDate.getTime())) return;

        // Prüfe ob bestehende Activity zur richtigen Session gehört
        if (existing?.isTracking) {
          const existingStart = new Date(existing.startTime).getTime();
          const dbStart = startDate.getTime();
          // Gleiche Session (Toleranz 2s) → nichts zu tun
          if (Number.isFinite(existingStart) && Math.abs(existingStart - dbStart) < 2000) {
            return;
          }
          // Falsche Session → beenden und neu starten
          await sleepActivityService.endAllSleepActivities();
          if (cancelled) return;
        }

        // Baby-Name für die Live Activity laden
        let babyName: string | undefined;
        if (activeBabyId) {
          try {
            const { data: babyInfo } = await getBabyInfo(activeBabyId);
            babyName = babyInfo?.name || undefined;
          } catch { /* Name ist optional */ }
        }

        await sleepActivityService.startSleepActivity(startDate, babyName);
      } catch (error) {
        console.error('Failed to restore live activity on app start:', error);
      }
    };

    void restoreLiveActivity();

    return () => { cancelled = true; };
  }, [userId, activeBabyId]);

  // Sleep Window Notifications Hook (läuft unabhängig vom Screen)
  useSleepWindowNotifications(
    sleepPrediction,
    notificationSettingsLoaded &&
      notificationPreferencesLoaded &&
      notificationsEnabled &&
      notifPrefs.sleepWindowReminder,
    userId,
    activeBabyId,
    expoPushToken,
    hasActiveSleepEntry
  );

  // Feeding Reminder Notifications Hook
  useFeedingReminderNotifications(
    feedingPrediction,
    notificationSettingsLoaded &&
      notificationPreferencesLoaded &&
      notificationsEnabled &&
      notifPrefs.feedingReminder,
    userId,
    activeBabyId,
    expoPushToken,
    hasActiveFeedingEntry
  );

  useVitaminDReminderNotifications(
    notificationSettingsLoaded &&
      notificationPreferencesLoaded &&
      notificationsEnabled &&
      notifPrefs.vitaminDReminder,
    notifPrefs.vitaminDReminderHour,
    notifPrefs.vitaminDReminderMinute,
    userId,
  );

  // Wir verwenden jetzt die index.tsx Datei als Einstiegspunkt, die die Weiterleitung basierend auf dem Auth-Status übernimmt
  useEffect(() => {
    if (!loading) {
      console.log('Layout: Auth loading complete, setting initial route');
      // Wir setzen die initiale Route auf den Root-Pfad, der dann zur richtigen Route weiterleitet
      setInitialRoute('index');
    }
  }, [loading]);

  // Splash-Screen erst ausblenden, wenn Auth UND Baby-Status aufgelöst sind.
  // Verhindert das kurze Aufblitzen des Schwangerschafts-Modus beim App-Start.
  useEffect(() => {
    if (!loading && isBabyStatusResolved && isLocaleReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading, isBabyStatusResolved, isLocaleReady]);

  // Zeige einen Ladeindikator, während der Authentifizierungsstatus geprüft wird
  if (loading || !initialRoute || !isLocaleReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
        <View style={{ marginTop: 20 }}>
          <Text style={{ marginTop: 10, color: '#7D5A50' }}>{layoutCopy.loading}</Text>
          <StatusBar hidden={true} />
        </View>
      </View>
    );
  }

  // Wenn der Benutzer angemeldet ist, zur Hauptapp navigieren, sonst zum Login-Screen
  // Anpassen der Themes, um den weißen Banner zu entfernen
  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: 'transparent',
    },
  };

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: 'transparent',
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? customDarkTheme : customLightTheme}>
        <Stack
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'slide_from_right'
          }}
        >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="community" />
        <Stack.Screen name="groups/index" />
        <Stack.Screen name="groups/[groupId]" />
        <Stack.Screen name="chat/[userId]" />
        <Stack.Screen name="group-chat/[groupId]" />
        <Stack.Screen name="paywall" />
        <Stack.Screen name="dsgvo" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="lottis-fuersorge" />
        <Stack.Screen name="frag-lotti" />
        <Stack.Screen name="paywall-access-admin" />
        <Stack.Screen name="paywall-content-admin" />
        <Stack.Screen name="startup-message-admin" />
        <Stack.Screen name="pregnancy-stats" />
        <Stack.Screen name="pregnancy-briefing" />
        <Stack.Screen name="shopping-list" />
        <Stack.Screen name="loyalty-cards" />
        <Stack.Screen name="prints-shop" />
        <Stack.Screen name="pregnancy-setup" />
        <Stack.Screen name="milestones" />
        <Stack.Screen name="wochenmoment" />
        <Stack.Screen name="admin-dashboard" />
        <Stack.Screen name="blocked-users" />
        <Stack.Screen name="moderation-admin" />
        <Stack.Screen name="account-linking" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="auth/reset-password" />
      </Stack>
      <StartupMessageModal
        visible={Boolean(startupMessage)}
        message={startupMessage}
        isSubmitting={isAcknowledgingStartupMessage}
        onConfirm={() => {
          void handleStartupMessageConfirm();
        }}
      />
      <TermsConsentGate
        visible={
          Boolean(userId) &&
          primarySegment !== '(auth)' &&
          primarySegment !== 'auth' &&
          !isLegalConsentRoute &&
          (termsConsent.userId !== userId || !termsConsent.accepted)
        }
        locale={locale}
        onAccepted={() => setTermsConsent({ userId: userId ?? null, accepted: true })}
        onSignOut={() => {
          void signOut();
        }}
      />
      <LottiMomentToast />
      <ImageCacheMaintenance />
      <StatusBar hidden={true} />
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Preload der App-Daten laeuft bewusst unterhalb des AuthProvider: die Session
// ist dann bereits aufgeloest und die User-ID wird direkt durchgereicht, statt
// erneut getUser() aufzurufen. Rendert nichts und blockiert nichts.
function AppDataPreloader() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const preloadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      // Nach einem Logout erneut vorladen, auch wenn sich derselbe Nutzer
      // danach wieder anmeldet.
      preloadedUserIdRef.current = null;
      return;
    }

    if (preloadedUserIdRef.current === userId) return;
    preloadedUserIdRef.current = userId;

    void preloadAppData(userId).catch((preloadError) => {
      console.warn('Preload warning (non-critical):', preloadError);
    });
  }, [loading, userId]);

  return null;
}

// Bild-Cache-Pflege. Diese Komponente wird bewusst erst im gerenderten Baum
// von RootLayoutNav gemountet, also hinter dem echten Ready-Gate (Auth, Route,
// Locale aufgeloest). Damit konkurriert die Dateisystemarbeit nicht mehr mit
// der Provider-Initialisierung. Zweiter Ausloeser ist der Wechsel in den
// Hintergrund. Die Drosselung auf einen Lauf pro Tag steckt in
// maybeCleanupCache().
function ImageCacheMaintenance() {
  useEffect(() => {
    const runCleanup = () => {
      void maybeCleanupCache()
        .then((result) => {
          if (!result.skipped && result.removed > 0) {
            console.log(
              `Image cache cleanup: ${result.removed} files removed, ${result.freedMB.toFixed(2)} MB freed`
            );
          }
        })
        .catch(() => {
          // imageCache ist optional
        });
    };

    // Erster Lauf erst im Leerlauf nach dem ersten sichtbaren Frame. Der
    // Mount liegt zwar hinter dem Ready-Gate, faellt aber noch mit dem
    // Splash-Hide zusammen - an einem Tag mit tatsaechlich faelliger
    // Bereinigung wuerde die Dateisystemarbeit sonst damit konkurrieren.
    // Ohne requestIdleCallback bleibt der Background-Wechsel als Ausloeser.
    const idleApi = globalThis as unknown as {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleHandle = idleApi.requestIdleCallback?.(runCleanup, { timeout: 10000 });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        runCleanup();
      }
    });

    return () => {
      if (idleHandle !== undefined) {
        idleApi.cancelIdleCallback?.(idleHandle);
      }
      appStateSubscription.remove();
    };
  }, []);

  return null;
}

// Hauptkomponente, die den AuthProvider einrichtet
export default Sentry.wrap(function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [appIsReady, setAppIsReady] = useState(false);
  const deviceLocale = getDeviceAppLocale();
  const preparingText = deviceLocale === 'en' ? 'Loading app …' : deviceLocale === 'es' ? 'Cargando la app …' : 'App wird geladen …';

  // Vor dem Mount wird nur noch auf die Schriftarten gewartet. Kein Preload und
  // kein Netzwerkaufruf: der Auth-Start soll nicht dahinter eingereiht werden.
  // Ein Font-Fehler darf die App nicht dauerhaft im Ladezustand festhalten.
  useEffect(() => {
    if (loaded || fontError) {
      if (fontError) {
        console.warn('Font loading failed, continuing with system fonts:', fontError);
      }
      setAppIsReady(true);
    }
  }, [loaded, fontError]);

  // Splash-Screen wird in RootLayoutNav ausgeblendet, sobald Auth + Baby-Status resolved sind.
  // Dadurch wird verhindert, dass der falsche Modus kurz aufblitzt.

  // Anzeigen eines Ladeindikators, wenn die App noch nicht bereit ist
  if (!appIsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
        <Text style={{ marginTop: 10, color: '#7D5A50' }}>{preparingText}</Text>
      </View>
    );
  }

  // Umschließen der App mit dem AuthProvider und BabyStatusProvider
  // ConvexProvider und BackendProvider für Dual-Backend-Architektur hinzugefügt
  return (
    <AuthProvider>
      <AppDataPreloader />
      <LocaleProvider>
        <ConvexProvider>
          <BackendProvider>
            <BackgroundProvider>
              <AppThemeProvider>
                <NavigationProvider>
                  <ActiveBabyProvider>
                    <BabyStatusProvider>
                      <RootLayoutNav />
                    </BabyStatusProvider>
                  </ActiveBabyProvider>
                </NavigationProvider>
              </AppThemeProvider>
            </BackgroundProvider>
          </BackendProvider>
        </ConvexProvider>
      </LocaleProvider>
    </AuthProvider>
  );
});
