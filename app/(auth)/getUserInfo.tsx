import { onboardingColors as brand } from '@/components/onboarding/theme';
/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, ImageBackground, View, TouchableOpacity, TextInput, Alert, StatusBar, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView, Keyboard, InputAccessoryView, BackHandler } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { OnboardingChoice, OnboardingSurface, OnboardingTransition } from '@/components/onboarding/surfaces';
import { LottiMedallion } from '@/components/onboarding/lotti-medallion';
import { ChapterProgress } from '@/components/onboarding/chapter-progress';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useOnboardingStatus } from '@/contexts/OnboardingStatusContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { invalidatePremiumStatusCache, invalidateUserProfileCache, invalidateUserSettingsCache } from '@/lib/appCache';
import { buildInvitationLink, supabase } from '@/lib/supabase';
import { getLinkedBabySelectionOptions, saveBabyInfo } from '@/lib/baby';
import { invalidateFamilyAccess, refreshFamilyAccess } from '@/lib/familySubscriptionAccess';
import { AccountLinkingQrModal } from '@/components/account-linking-qr-modal';
import { translateAccountLinkingText } from '@/lib/accountLinkingTranslations';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@/lib/navigation/useFocusEffect';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { shouldRedirectToPaywallForState, shouldShowPaywall } from '@/lib/paywall';
import { redeemInvitationCodeFixed } from '@/lib/redeemInvitationCodeFixed';
import { SurveyStep, ProductTryout } from '@/components/onboarding/personalized-steps';
import { getPersonalizedStart, getOnboardingNeeds, type OnboardingNeed, type OnboardingChallenge, type OnboardingSupport, type OnboardingHabit } from '@/lib/onboarding-personalization';
import { ValueStep, FeedbackStep, HabitStep, TrialStep } from '@/components/onboarding/value-steps';
import { WellbeingStep, wellbeingCopy } from '@/components/onboarding/wellbeing-step';
import { HealthConsentStep, healthConsentCopy } from '@/components/onboarding/health-consent-step';
import { useDataConsents } from '@/contexts/DataConsentContext';
import { activeDataConsentCopy } from '@/lib/dataConsentCopy';
import { valueCopy } from '@/components/onboarding/value-copy';
import { OnboardingProductMoment } from '@/components/onboarding/product-moment';
import { getOnboardingSteps, getOnboardingDestination, getNextOnboardingIndex, getPreviousOnboardingIndex, getOnboardingChapters } from '@/lib/onboarding-flow';
import IOSBottomDatePicker from '@/components/modals/IOSBottomDatePicker';
import { LinkedBabySelectionModal } from '@/components/LinkedBabySelectionModal';
import {
  DEFAULT_ONBOARDING_LOCALE,
  getOnboardingLocaleTag,
  OnboardingTranslationKey,
  translateOnboardingText,
} from '@/lib/onboardingTranslations';

const MIN_VALID_PROFILE_DATE_YEAR = 2000;
const MIN_VALID_PROFILE_DATE = new Date(MIN_VALID_PROFILE_DATE_YEAR, 0, 1);
let ACTIVE_ONBOARDING_LOCALE = DEFAULT_ONBOARDING_LOCALE;
let ONBOARDING_LOCALE_TAG = getOnboardingLocaleTag(ACTIVE_ONBOARDING_LOCALE);
const t = (
  key: OnboardingTranslationKey,
  params?: Record<string, string | number>,
) => translateOnboardingText(ACTIVE_ONBOARDING_LOCALE, key, params);

export default function GetUserInfoScreen() {
  ACTIVE_ONBOARDING_LOCALE = useLocale().locale;
  ONBOARDING_LOCALE_TAG = getOnboardingLocaleTag(ACTIVE_ONBOARDING_LOCALE);
  const theme = Colors.light;
  const invitationAccessoryViewID = 'invitation-code-keyboard-accessory';
  const { user, signOut } = useAuth();
  const consent = useDataConsents();
  const { refreshBabyDetails } = useBabyStatus();
  const { refreshBabies, activeBaby } = useActiveBaby();
  const { refresh: refreshOnboardingStatus } = useOnboardingStatus();
  const params = useLocalSearchParams<{ invitationCode?: string }>();
  const prefilledInvitationCode = typeof params.invitationCode === 'string'
    ? params.invitationCode.replace(/\s+/g, '').toUpperCase()
    : '';
  const hasPrefilledInvitationCode = prefilledInvitationCode.length > 0;

  const parseSafeDate = (value: unknown): Date | null => {
    if (value === null || value === undefined) return null;

    let parsed: Date;
    if (value instanceof Date) {
      parsed = new Date(value.getTime());
    } else if (typeof value === 'number') {
      const timestamp = Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
      parsed = new Date(timestamp);
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (/^-?\d+$/.test(trimmed)) {
        const numericValue = Number(trimmed);
        const timestamp = Math.abs(numericValue) < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
        parsed = new Date(timestamp);
      } else {
        parsed = new Date(trimmed);
      }
    } else {
      return null;
    }

    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < MIN_VALID_PROFILE_DATE_YEAR) return null;
    return parsed;
  };

  const getSafePickerDate = (value: unknown, fallback: Date, maximumDate?: Date): Date => {
    const parsed = parseSafeDate(value) ?? fallback;
    const candidate = new Date(parsed.getTime());

    if (candidate < MIN_VALID_PROFILE_DATE) {
      return new Date(MIN_VALID_PROFILE_DATE.getTime());
    }
    if (maximumDate && candidate > maximumDate) {
      return new Date(maximumDate.getTime());
    }
    return candidate;
  };

  const toSafeIsoString = (value: Date | null): string | null => {
    const parsed = parseSafeDate(value);
    return parsed ? parsed.toISOString() : null;
  };

  // Benutzerinformationen
  const [firstName, setFirstName] = useState('');
  const [userRole, setUserRole] = useState<'mama' | 'papa' | ''>('');

  // Baby-Informationen
  const [babyName, setBabyName] = useState('');
  const babyGender = 'unknown' as const;
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isBabyBorn, setIsBabyBorn] = useState<boolean | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  // Gewicht und Größe werden in dieser Version nicht verwendet, aber für zukünftige Erweiterungen vorbereitet
  const [babyWeight] = useState('');
  const [babyHeight] = useState('');

  // UI-Status
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);

  // Einladungscode
  const [invitationCode, setInvitationCode] = useState(prefilledInvitationCode);
  const [showInvitation, setShowInvitation] = useState(hasPrefilledInvitationCode);
  const [showScanner, setShowScanner] = useState(false);
  const finishInvitationRequested = useRef(false);
  const redemptionInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const [need, setNeed] = useState<OnboardingNeed | null>(null);
  const [challenge, setChallenge] = useState<OnboardingChallenge | null>(null);
  const [demoCompleted, setDemoCompleted] = useState(false);
  const [wellbeing, setWellbeing] = useState<{ mood: number | null; energy: number | null }>({ mood: null, energy: null });
  const [habit, setHabit] = useState<OnboardingHabit | null>(null);
  const [support, setSupport] = useState<OnboardingSupport | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'accepted' | 'skipped'>('idle');
  const [isRedeemingInvitation, setIsRedeemingInvitation] = useState(false);
  const autoRedeemAttemptedRef = useRef(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<{
    partnerName?: string;
    dueDate?: string | null;
    isBabyBorn?: boolean | null;
  } | null>(null);
  const [pendingBabySelection, setPendingBabySelection] = useState<{
    linkedUserId: string;
    linkedUserName?: string | null;
  } | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // Gesundheits-Einwilligung als eigener Schritt, sobald sie fehlt. Einmal
  // aufgenommen bleibt der Schritt in der Liste, damit sich Indizes nicht verschieben.
  const needsHealthConsent = consent.mode !== 'preview' && !consent.healthAllowed;
  const [askHealthConsent, setAskHealthConsent] = useState(needsHealthConsent);
  if (needsHealthConsent && !askHealthConsent) setAskHealthConsent(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);

  // Schrittweise Abfrage
  const shouldShowInvitationStep = showInvitation
    || (!isRedeemingInvitation && invitationStatus !== 'accepted' && invitationError !== null);
  const onboardingSteps = useMemo(
    () => getOnboardingSteps(shouldShowInvitationStep, invitationStatus === 'accepted', Platform.OS === 'ios', askHealthConsent),
    [invitationStatus, shouldShowInvitationStep, askHealthConsent],
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [helpful, setHelpful] = useState(false);
  const boundedCurrentStep = Math.min(currentStep, Math.max(0, onboardingSteps.length - 1));
  const totalSteps = onboardingSteps.length;
  const currentStepKey = onboardingSteps[boundedCurrentStep];
  const isPartnerFlow = invitationStatus === 'accepted';
  const momentBabyBorn = isPartnerFlow
    ? (activeBaby ? Boolean(activeBaby.birth_date) : Boolean(invitationInfo?.isBabyBorn ?? isBabyBorn))
    : isBabyBorn === true;

  const selectedStart = getPersonalizedStart(momentBabyBorn, need);
  useEffect(() => { setHabit(null); setDemoCompleted(false); setHelpful(false); }, [selectedStart]);
  useEffect(() => {
    if (need && !getOnboardingNeeds(momentBabyBorn).includes(need)) setNeed(null);
  }, [momentBabyBorn, need]);

  // Bei Schrittwechsel nach oben scrollen – am Schlüssel, nicht am Index: „Ohne Code weiter"
  // tauscht die Einladung gegen den nächsten Schritt aus, ohne dass sich der Index ändert.
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentStepKey]);

  // Formatieren eines Datums für die Anzeige
  const formatDate = (date: Date | null) => {
    if (!date) return t('common.notSet');
    return date.toLocaleDateString(ONBOARDING_LOCALE_TAG, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const redeemInvitation = useCallback(async (
    rawCode: string,
    options?: { showErrorAlert?: boolean }
  ) => {
    if (redemptionInFlight.current) return false;
    const normalizedCode = rawCode.replace(/\s+/g, '').toUpperCase();
    const shouldShowErrorAlert = options?.showErrorAlert ?? true;

    if (!user?.id) {
      if (shouldShowErrorAlert) {
        Alert.alert(t('common.notice'), t('invitation.signInAgain'));
      }
      return false;
    }

    if (!normalizedCode) {
      setInvitationError(t('invitation.enterCode'));
      return false;
    }

    redemptionInFlight.current = true;
    setInvitationCode(normalizedCode);
    setInvitationError(null);
    setIsRedeemingInvitation(true);

    try {
      const result = await redeemInvitationCodeFixed(user.id, normalizedCode);

      if (result.success) {
        const partnerName = result.creatorInfo
          ? `${result.creatorInfo.firstName ?? ''} ${result.creatorInfo.lastName ?? ''}`.trim()
          : undefined;

        const syncedDueDate = parseSafeDate(result.syncedData?.dueDate ?? null);
        const syncedDueDateIso = syncedDueDate?.toISOString() ?? null;

        if (syncedDueDate) {
          setDueDate(syncedDueDate);
        }

        if (typeof result.syncedData?.isBabyBorn === 'boolean') {
          setIsBabyBorn(result.syncedData.isBabyBorn);
        }

        setInvitationStatus('accepted');
        setInvitationInfo({
          partnerName: partnerName || undefined,
          dueDate: syncedDueDateIso,
          isBabyBorn: result.syncedData?.isBabyBorn ?? null,
        });

        if (result.linkedUserId) {
          const selection = await getLinkedBabySelectionOptions(user.id, result.linkedUserId);
          // Only skip a choice when there is nothing to choose or one baby
          // already shared by the invitation RPC. Never silently change sharing.
          const babies = selection.data ?? [];
          if (selection.error || babies.length > 1 || (babies.length === 1 && !babies[0].is_shared_between_accounts)) {
            setPendingBabySelection({
              linkedUserId: result.linkedUserId,
              linkedUserName: partnerName || null,
            });
          }
        }
        finishInvitationRequested.current = true;
        return true;
      } else {
        const errorMessage = t('invitation.redeemFailed');
        if (result.error?.message) {
          console.error('Invitation redeem response:', result.error.message);
        }
        setInvitationError(errorMessage);
        setInvitationStatus('idle');
        if (shouldShowErrorAlert) {
          Alert.alert(t('common.error'), errorMessage);
        }
        return false;
      }
    } catch (err: any) {
      console.error('Invitation redeem failed:', err);
      const message = t('invitation.unexpectedError');
      setInvitationError(message);
      setInvitationStatus('idle');
      if (shouldShowErrorAlert) {
        Alert.alert(t('common.error'), message);
      }
      return false;
    } finally {
      redemptionInFlight.current = false;
      setIsRedeemingInvitation(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!hasPrefilledInvitationCode || autoRedeemAttemptedRef.current || !user?.id
      || currentStepKey !== 'invitation' || !firstName.trim() || !userRole) {
      return;
    }

    autoRedeemAttemptedRef.current = true;
    void redeemInvitation(prefilledInvitationCode, { showErrorAlert: false });
  }, [hasPrefilledInvitationCode, user?.id, prefilledInvitationCode, redeemInvitation, currentStepKey, firstName, userRole]);

  const handleRedeemInvitation = async () => {
    Keyboard.dismiss();
    await redeemInvitation(invitationCode);
  };

  // Handler für Änderungen am Geburtstermin
  const handleDueDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDueDatePicker(false);
    }
    if (event?.type === 'dismissed') return;
    const validDate = parseSafeDate(selectedDate ?? null);
    if (validDate) {
      setDueDate(validDate);
    }
  };
  const handleDueDateConfirmIOS = (selectedDate: Date) => {
    const validDate = parseSafeDate(selectedDate);
    if (validDate) {
      setDueDate(validDate);
    }
    setShowDueDatePicker(false);
  };

  // Handler für Änderungen am Geburtsdatum
  const handleBirthDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowBirthDatePicker(false);
    }
    if (event?.type === 'dismissed') return;
    const validDate = parseSafeDate(selectedDate ?? null);
    if (validDate) {
      setBirthDate(validDate);
    }
  };
  const handleBirthDateConfirmIOS = (selectedDate: Date) => {
    const validDate = parseSafeDate(selectedDate);
    if (validDate) {
      setBirthDate(validDate);
    }
    setShowBirthDatePicker(false);
  };

  // Speichern der Benutzerdaten in verschiedenen Tabellen
  const saveUserData = async () => {
    if (saveInFlight.current) return;
    try {
      if (!user) {
        Alert.alert(t('common.notice'), t('save.signIn'));
        return;
      }

      const partnerFlow = invitationStatus === 'accepted';
      if (!firstName.trim() || !userRole || (!partnerFlow && (!need || !challenge || !support))) {
        Alert.alert(t('common.notice'), t('survey.choose'));
        setCurrentStep(onboardingSteps.indexOf(!firstName.trim() ? 'firstName' : !userRole ? 'role' : !need ? 'needs' : !challenge ? 'challenge' : 'support'));
        return;
      }
      saveInFlight.current = true;
      setIsSaving(true);
      const babyBorn = momentBabyBorn;
      const safeDueDateIso = toSafeIsoString(dueDate);
      const safeBirthDateIso = toSafeIsoString(birthDate);
      const calculatedDueDate = partnerFlow
        ? (invitationInfo?.dueDate ?? safeDueDateIso)
        : (!babyBorn ? safeDueDateIso : null);
      const calculatedBirthDate = partnerFlow
        ? null
        : (babyBorn ? safeBirthDateIso : null);

      // Nur abgefragte Profildaten speichern; vorhandenen Nachnamen beibehalten.
      const profileResult = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: firstName.trim(),
          user_role: userRole,
          updated_at: new Date().toISOString()
        });

      if (profileResult.error) {
        console.error('Error saving profile data:', profileResult.error);
        throw new Error(t('save.profileFailed'));
      }

      // Speichern der Benutzereinstellungen (Geburtstermin, Baby geboren)
      // Zuerst prüfen, ob bereits ein Eintrag existiert
      const { data: existingSettings, error: fetchError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing settings:', fetchError);
        throw new Error(t('save.settingsCheckFailed'));
      }

      let settingsResult;

      if (existingSettings && existingSettings.id) {
        // The invitation already synchronized these settings. Preserve them,
        // including notification/theme preferences, in the shortened flow.
        if (partnerFlow) {
          settingsResult = { error: null };
        } else {
          // Wenn ein Eintrag existiert, aktualisieren wir diesen
          settingsResult = await supabase
            .from('user_settings')
            .update({
              due_date: calculatedDueDate,
              is_baby_born: babyBorn,
              theme: 'light', // Standard-Theme
              notifications_enabled: true, // Benachrichtigungen standardmäßig aktiviert
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSettings.id);
        }
      } else {
        // Wenn kein Eintrag existiert, erstellen wir einen neuen
        settingsResult = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            due_date: calculatedDueDate,
            is_baby_born: babyBorn,
            theme: 'light', // Standard-Theme
            notifications_enabled: true, // Benachrichtigungen standardmäßig aktiviert
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      if (settingsResult.error) {
        console.error('Error saving user settings:', settingsResult.error);
        throw new Error(t('save.settingsFailed'));
      }

      if (!partnerFlow) {
        const { error: answersError } = await supabase.auth.updateUser({
          data: { onboarding_preferences: { version: 1, need, challenge, support, habit, wellbeing } },
        });
        if (answersError) throw new Error(t('save.profileFailed'));
      }

      await Promise.all([
        invalidateUserProfileCache(),
        invalidateUserSettingsCache(),
      ]);

      if (!partnerFlow) {
        // Speichern der Baby-Informationen (Name, Geschlecht, Geburtsdatum, Gewicht, Größe)
        const babyInfo = {
          name: babyName,
          baby_gender: babyGender,
          birth_date: calculatedBirthDate,
          weight: babyWeight,
          height: babyHeight,
        };

        const { error: babyError } = await saveBabyInfo(babyInfo);

        if (babyError) {
          console.error('Error saving baby info:', babyError);
          throw new Error(t('save.babyFailed'));
        }
        await refreshBabyDetails();
      }

      await refreshBabies();
      if (partnerFlow) {
        await refreshBabyDetails();
        invalidateFamilyAccess(user.id);
        await Promise.all([refreshFamilyAccess(user.id, { force: true }), invalidatePremiumStatusCache()]);
      }
      if (!await refreshOnboardingStatus()) throw new Error(t('save.allFailed'));


      // Nach dem Speichern zur entsprechenden Seite navigieren oder Paywall zeigen
      const nextRoute = getOnboardingDestination(babyBorn, partnerFlow ? undefined : selectedStart);

      let requiresSubscription = false;
      try {
        const { state } = await shouldShowPaywall(undefined, user.id);
        requiresSubscription = shouldRedirectToPaywallForState(state);
      } catch (paywallError) {
        console.error('Paywall check after onboarding failed:', paywallError);
      }

      // Unknown access is handled by the root recovery gate at nextRoute.
      // A connection error must never send an existing subscriber to checkout.
      if (requiresSubscription) {
        router.replace({
          pathname: '/paywall',
          params: { next: nextRoute, origin: 'onboarding', trialExpired: '1' },
        });
        return;
      }

      router.replace(nextRoute);
    } catch (err) {
      console.error('Failed to save user data:', err);
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('save.allFailed'));
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!finishInvitationRequested.current || invitationStatus !== 'accepted'
      || isRedeemingInvitation || pendingBabySelection) return;
    finishInvitationRequested.current = false;
    void saveUserData();
    // A failed save remains on the accepted invitation and can be retried
    // with the footer, without redeeming the single-use code again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationStatus, isRedeemingInvitation, pendingBabySelection]);

  const grantHealthConsent = async () => {
    if (isSavingConsent) return;
    setConsentError(false);
    setIsSavingConsent(true);
    try {
      await consent.decide('health', 'granted', ACTIVE_ONBOARDING_LOCALE);
      setCurrentStep(boundedCurrentStep + 1);
    } catch (error) {
      console.error('Failed to save health consent:', error);
      setConsentError(true);
    } finally {
      setIsSavingConsent(false);
    }
  };

  const declineHealthConsent = () => {
    const c = healthConsentCopy(ACTIVE_ONBOARDING_LOCALE);
    Alert.alert(c.declineTitle, c.declineBody, [
      { text: c.back, style: 'cancel' },
      { text: activeDataConsentCopy[ACTIVE_ONBOARDING_LOCALE].signOut, style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  // Zum nächsten Schritt gehen
  const goToNextStep = () => {
    switch (currentStepKey) {
      case 'healthConsent':
        if (!consent.healthAllowed) {
          if (consentChecked) void grantHealthConsent();
          return;
        }
        break;
      case 'firstName':
        if (!firstName.trim()) {
          Alert.alert(t('common.notice'), t('validation.firstName'));
          return;
        }
        break;
      case 'role':
        if (!userRole) {
          Alert.alert(t('common.notice'), t('validation.role'));
          return;
        }
        break;
      case 'invitation':
        if (!firstName.trim() || !userRole) { setCurrentStep(onboardingSteps.indexOf(!firstName.trim() ? 'firstName' : 'role')); return; }
        break;
      case 'babyStatus':
        if (isBabyBorn === null) {
          Alert.alert(t('common.notice'), t('validation.babyStatus'));
          return;
        }
        break;
      case 'dates':
        if (isBabyBorn === false && !dueDate) {
          Alert.alert(t('common.notice'), t('validation.dueDate'));
          return;
        }
        if (isBabyBorn === true && !birthDate) {
          Alert.alert(t('common.notice'), t('validation.birthDate'));
          return;
        }
        if (isBabyBorn === null) {
          Alert.alert(t('common.notice'), t('validation.babyStatus'));
          return;
        }
        break;
      case 'needs':
      case 'challenge':
      case 'support':
        if ((currentStepKey === 'needs' && !need) || (currentStepKey === 'challenge' && !challenge) || (currentStepKey === 'support' && !support)) {
          Alert.alert(t('common.notice'), t('survey.choose')); return;
        }
        break;
      default:
        break;
    }

    Keyboard.dismiss();
    const nextStep = getNextOnboardingIndex(onboardingSteps, boundedCurrentStep, demoCompleted);

    if (nextStep >= totalSteps) {
      saveUserData();
      return;
    }

    setCurrentStep(nextStep);
  };

  // Zum vorherigen Schritt gehen
  const goToPreviousStep = useCallback(() => {
    if (showScanner) { setShowScanner(false); return; }
    // Wenn wir beim ersten Schritt sind, können wir nicht zurück
    if (boundedCurrentStep === 0) {
      return;
    }

    // Zum vorherigen Schritt
    setCurrentStep(getPreviousOnboardingIndex(onboardingSteps, boundedCurrentStep, demoCompleted));
  }, [boundedCurrentStep, onboardingSteps, demoCompleted, showScanner]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSaving || isSavingConsent || isRedeemingInvitation || pendingBabySelection) return true;
      if (boundedCurrentStep === 0) return false;
      goToPreviousStep();
      return true;
    });
    return () => subscription.remove();
  }, [boundedCurrentStep, goToPreviousStep, isSaving, isSavingConsent, isRedeemingInvitation, pendingBabySelection]));

  // Render-Funktion für den aktuellen Schritt
  const renderCurrentStep = () => {
    switch (currentStepKey) {
      case 'welcome':
      case 'sharedValue':
        return <ValueStep kind={currentStepKey} locale={ACTIVE_ONBOARDING_LOCALE} need={selectedStart}
          dueDate={isPartnerFlow ? parseSafeDate(invitationInfo?.dueDate) : dueDate}
          babyName={isPartnerFlow ? activeBaby?.name : babyName} challenge={challenge ?? 'remember'} support={support ?? 'solo'} />;
      case 'firstName':
        return <View style={styles.stepContainer}>
          <ThemedText style={styles.stepTitle}>{t('flow.nameLabel')}</ThemedText>
          <ThemedText style={styles.description}>{t('flow.youBody')}</ThemedText>
          <View style={styles.questionArea}><LottiMedallion pose="thinking" float style={styles.medallion} /><OnboardingSurface style={{ padding: 20 }}>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
              placeholder={t('firstName.placeholder')} placeholderTextColor={brand.muted}
              accessibilityLabel={t('flow.nameLabel')} textContentType="givenName" autoComplete="given-name"
              autoCapitalize="words" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
          </OnboardingSurface></View>
        </View>;
      case 'role':
        return <View style={styles.stepContainer}>
          <ThemedText style={styles.stepTitle}>{t('flow.roleLabel')}</ThemedText>
          <View style={styles.questionArea}>
            <LottiMedallion pose="waving" float style={styles.medallion} />
            {(['mama', 'papa'] as const).map(role => <OnboardingChoice key={role} selected={userRole === role}
              accessibilityLabel={t(`role.${role}`)} onPress={() => setUserRole(role)} contentStyle={styles.roleChoice}>
              <View style={styles.roleIcon}><IconSymbol name="person.fill" size={22} color={brand.accentText} /></View>
              <ThemedText style={[styles.roleButtonText, userRole === role && styles.roleButtonTextActive]}>{t(`role.${role}`)}</ThemedText>
              <View style={{ flex: 1 }} /><IconSymbol name={userRole === role ? 'checkmark.circle.fill' : 'circle'} size={24} color={brand.accentText} />
            </OnboardingChoice>)}
            {!hasPrefilledInvitationCode && invitationStatus !== 'accepted' && <TouchableOpacity accessibilityRole="button" style={styles.textLink}
              onPress={() => {
                Keyboard.dismiss();
                setShowInvitation(true);
                if (!userRole) { Alert.alert(t('common.notice'), t('validation.role')); return; }
                // Das Einlösen synchronisiert Gesundheitsdaten: erst die Einwilligung.
                setCurrentStep(getOnboardingSteps(true, false, false, askHealthConsent).indexOf(askHealthConsent ? 'healthConsent' : 'invitation'));
              }}>
              <ThemedText style={styles.linkText}>{t('flow.inviteLink')}</ThemedText><IconSymbol name="arrow.right" size={16} color={brand.accentText} />
            </TouchableOpacity>}
          </View>
        </View>;

      case 'healthConsent':
        return <HealthConsentStep locale={ACTIVE_ONBOARDING_LOCALE} checked={consentChecked} granted={consent.healthAllowed}
          error={consentError} busy={isSavingConsent || consent.busy}
          onToggle={() => { setConsentError(false); setConsentChecked(value => !value); }} onDecline={declineHealthConsent} />;

      case 'invitation': // Einladungscode
        return (
          <View style={styles.stepContainer}>
            {invitationStatus === 'accepted' ? (
              <>
                <LottiMedallion pose="heart" float style={styles.medallion} />
                <ThemedText style={[styles.stepTitle, styles.centeredText]}>{t('invitation.successTitle')}</ThemedText>
                <View style={styles.infoCardContainer}><OnboardingSurface style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoRowIcon, { backgroundColor: brand.softAccent }]}>
                      <IconSymbol name="checkmark.circle.fill" size={18} color={brand.accentText} />
                    </View>
                    <View style={styles.infoRowContent}>
                      <ThemedText style={styles.infoRowLabel}>{t('invitation.partner')}</ThemedText>
                      <ThemedText style={styles.infoRowValue}>
                        {invitationInfo?.partnerName || t('invitation.linked')}
                      </ThemedText>
                    </View>
                  </View>
                  {invitationInfo?.dueDate && (
                    <>
                      <View style={styles.infoCardDivider} />
                      <View style={styles.infoRow}>
                        <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(142,78,198,0.12)' }]}>
                          <IconSymbol name="calendar" size={18} color={brand.accentText} />
                        </View>
                        <View style={styles.infoRowContent}>
                          <ThemedText style={styles.infoRowLabel}>{t('invitation.dueDate')}</ThemedText>
                          <ThemedText style={styles.infoRowValue}>
                            {formatDate(parseSafeDate(invitationInfo.dueDate))}
                          </ThemedText>
                        </View>
                      </View>
                    </>
                  )}
                  <View style={styles.infoCardDivider} />
                  <View style={styles.infoRow}>
                    <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(232,160,191,0.15)' }]}>
                      <IconSymbol name="heart.fill" size={18} color="#E8A0BF" />
                    </View>
                    <View style={styles.infoRowContent}>
                      <ThemedText style={styles.infoRowLabel}>{t('invitation.babyData')}</ThemedText>
                      <ThemedText style={styles.infoRowValue}>{t('invitation.sharedSelection')}</ThemedText>
                    </View>
                  </View>
                </OnboardingSurface></View>
                <ThemedText style={[styles.invitationSkipNote, styles.centeredText]}>
                  {t('invitation.continuePreview')}
                </ThemedText>
              </>
            ) : (
              <>
                <LottiMedallion pose="kiss" float style={styles.medallion} />
                <ThemedText style={[styles.stepTitle, styles.centeredText]}>{t('invitation.title')}</ThemedText>
                <ThemedText style={[styles.description, styles.centeredText]}>{t('flow.inviteBody')}</ThemedText>

                <OnboardingSurface style={styles.inviteCard}>
                  <TextInput
                    style={[styles.input, styles.codeInput, !!invitationCode && styles.codeInputFilled]}
                    value={invitationCode}
                    editable={!isRedeemingInvitation && !isSaving}
                    accessibilityLabel={t('invitation.title')}
                    onChangeText={(value) => setInvitationCode(value.replace(/\s+/g, '').toUpperCase())}
                    placeholder={t('invitation.placeholder')}
                    placeholderTextColor={brand.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    inputAccessoryViewID={Platform.OS === 'ios' ? invitationAccessoryViewID : undefined}
                  />

                  {invitationError && (
                    <ThemedText style={styles.errorText}>
                      {invitationError}
                    </ThemedText>
                  )}

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.redeemButton, (isRedeemingInvitation || !invitationCode) && styles.buttonDisabled]}
                    onPress={handleRedeemInvitation}
                    disabled={isRedeemingInvitation || !invitationCode}
                  >
                    {isRedeemingInvitation && <ActivityIndicator color={brand.white} />}
                    <ThemedText style={styles.redeemButtonText}>
                      {isRedeemingInvitation ? t('invitation.checking') : t('invitation.redeem')}
                    </ThemedText>
                  </TouchableOpacity>

                  <View style={styles.orRow}><View style={styles.orLine} /></View>

                  <TouchableOpacity accessibilityRole="button" style={styles.scanButton}
                    disabled={isRedeemingInvitation || isSaving}
                    onPress={() => { Keyboard.dismiss(); setShowScanner(true); }}>
                    <IconSymbol name="qrcode.viewfinder" size={22} color={brand.accentText} />
                    <ThemedText style={styles.scanButtonText}>{translateAccountLinkingText(ACTIVE_ONBOARDING_LOCALE, 'qr.scan')}</ThemedText>
                  </TouchableOpacity>
                </OnboardingSurface>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.textLink}
                  onPress={() => {
                    setInvitationStatus('skipped');
                    setInvitationError(null);
                    setShowInvitation(false);
                    setCurrentStep(getOnboardingSteps(false, false).indexOf(!firstName.trim() ? 'firstName' : !userRole ? 'role' : 'babyStatus'));
                  }}
                  disabled={isRedeemingInvitation}
                >
                  <ThemedText style={styles.linkText}>{t('flow.continueSolo')}</ThemedText>
                  <IconSymbol name="arrow.right" size={16} color={brand.accentText} />
                </TouchableOpacity>
              </>
            )}
          </View>
        );

      case 'babyStatus':
        return (
          <View style={styles.stepContainer}>
            <ThemedText style={styles.stepTitle}>{t('flow.stageTitle')}</ThemedText>
            <ThemedText style={styles.description}>{t('flow.stageBody')}</ThemedText>
            <View style={styles.stageOptions}>
              {[false, true].map(born => (
                <OnboardingChoice key={String(born)} selected={isBabyBorn === born} tone={born ? brand.softAccent : 'rgba(255,205,206,0.25)'}
                  accessibilityLabel={t(born ? 'flow.born' : 'flow.expecting')}
                  accessibilityHint={t(born ? 'flow.bornDetail' : 'flow.expectingDetail')}
                  contentStyle={styles.stageOption}
                  onPress={() => { setIsBabyBorn(born); setShowDueDatePicker(false); setShowBirthDatePicker(false); }}>
                  <LottiMedallion pose={born ? 'bottle' : 'blanket'} size="small" style={styles.stageMedallion} />
                  <View style={styles.stageCopy}>
                    <ThemedText style={styles.stageTitle}>{t(born ? 'flow.born' : 'flow.expecting')}</ThemedText>
                    <ThemedText style={styles.stageDetail}>{t(born ? 'flow.bornDetail' : 'flow.expectingDetail')}</ThemedText>
                  </View>
                  <IconSymbol name={isBabyBorn === born ? 'checkmark.circle.fill' : 'circle'} size={24} color={brand.accentText} />
                </OnboardingChoice>
              ))}
            </View>
          </View>
        );

      case 'dates': { // Datum abhängig vom Baby-Status
        const isBorn = isBabyBorn === true;
        const selectedDate = isBorn ? birthDate : dueDate;
        const maxBirthDate = new Date();
        const defaultDueDate = new Date(maxBirthDate.getTime());
        defaultDueDate.setDate(defaultDueDate.getDate() + 280);
        const maxDueDate = new Date(maxBirthDate.getTime());
        maxDueDate.setFullYear(maxDueDate.getFullYear() + 2);
        const birthDatePickerValue = getSafePickerDate(selectedDate, maxBirthDate, maxBirthDate);
        const dueDatePickerValue = getSafePickerDate(selectedDate, defaultDueDate, maxDueDate);
        const title = t('flow.detailsTitle');
        const placeholder = isBorn ? t('dates.chooseBirth') : t('dates.chooseDue');

        return (
          <View style={styles.stepContainer}>
            <ThemedText style={styles.stepTitle}>{title}</ThemedText>
            <ThemedText style={styles.description}>{t(isBorn ? 'flow.birthReason' : 'flow.dueReason')}</ThemedText>
            <OnboardingSurface style={{ padding: 20 }}>
            <ThemedText style={styles.fieldLabel}>{t(isBorn ? 'flow.birthLabel' : 'flow.dueLabel')}</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              accessibilityRole="button"
              accessibilityLabel={placeholder}
              onPress={() => (isBorn ? setShowBirthDatePicker(true) : setShowDueDatePicker(true))}
            >
              <ThemedText style={styles.dateButtonText}>
                {selectedDate ? formatDate(selectedDate) : placeholder}
              </ThemedText>
              <IconSymbol name="calendar" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>

            <ThemedText style={styles.fieldLabel}>{t('flow.babyNameLabel')}</ThemedText>
            <TextInput style={styles.input} value={babyName} onChangeText={setBabyName}
              placeholder={t('babyInfo.namePlaceholder')} placeholderTextColor={brand.muted}
              accessibilityLabel={t('flow.babyNameLabel')} autoCapitalize="words" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
            <ThemedText style={styles.optionalHint}>{t('flow.optional')}</ThemedText>
            </OnboardingSurface>
            <View style={styles.datesVisual}>
              <LottiMedallion pose={isBorn ? 'teddy' : 'peeking'} float />
            </View>

            {isBorn && showBirthDatePicker && Platform.OS !== 'ios' && (
              <DateTimePicker
                value={birthDatePickerValue}
                mode="date"
                display="default"
                themeVariant="light"
                onChange={handleBirthDateChange}
                minimumDate={MIN_VALID_PROFILE_DATE}
                maximumDate={maxBirthDate}
              />
            )}

            {!isBorn && showDueDatePicker && Platform.OS !== 'ios' && (
              <DateTimePicker
                value={dueDatePickerValue}
                mode="date"
                display="default"
                themeVariant="light"
                onChange={handleDueDateChange}
                minimumDate={MIN_VALID_PROFILE_DATE}
                maximumDate={maxDueDate}
              />
            )}
            {isBorn && Platform.OS === 'ios' && (
              <IOSBottomDatePicker
                visible={showBirthDatePicker}
                title={t('dates.chooseBirth')}
                value={birthDatePickerValue}
                mode="date"
                minimumDate={MIN_VALID_PROFILE_DATE}
                maximumDate={maxBirthDate}
                confirmLabel={t('common.done')}
                cancelLabel={t('common.cancel')}
                locale={ONBOARDING_LOCALE_TAG}
                onClose={() => setShowBirthDatePicker(false)}
                onConfirm={handleBirthDateConfirmIOS}
                initialVariant="calendar"
              />
            )}
            {!isBorn && Platform.OS === 'ios' && (
              <IOSBottomDatePicker
                visible={showDueDatePicker}
                title={t('dates.chooseDue')}
                value={dueDatePickerValue}
                mode="date"
                minimumDate={MIN_VALID_PROFILE_DATE}
                maximumDate={maxDueDate}
                confirmLabel={t('common.done')}
                cancelLabel={t('common.cancel')}
                locale={ONBOARDING_LOCALE_TAG}
                onClose={() => setShowDueDatePicker(false)}
                onConfirm={handleDueDateConfirmIOS}
                initialVariant="calendar"
              />
            )}
          </View>
        );
      }

      case 'mood':
      case 'energy':
        return <WellbeingStep key={currentStepKey} locale={ACTIVE_ONBOARDING_LOCALE} kind={currentStepKey} value={wellbeing[currentStepKey]} onChange={value => setWellbeing(previous => ({ ...previous, [currentStepKey]: value }))} />;
      case 'needs':
        return <SurveyStep locale={ACTIVE_ONBOARDING_LOCALE} kind="needs" isBabyBorn={momentBabyBorn} value={need} onSelect={value => setNeed(value as OnboardingNeed)} />;
      case 'challenge':
        return <SurveyStep locale={ACTIVE_ONBOARDING_LOCALE} kind="challenge" isBabyBorn={momentBabyBorn} value={challenge} onSelect={value => setChallenge(value as OnboardingChallenge)} />;
      case 'support':
        return <SurveyStep locale={ACTIVE_ONBOARDING_LOCALE} kind="support" isBabyBorn={momentBabyBorn} value={support} onSelect={value => setSupport(value as OnboardingSupport)} />;
      case 'productMoment':
        return <ProductTryout onCompletionChange={setDemoCompleted} key={selectedStart} locale={ACTIVE_ONBOARDING_LOCALE} need={selectedStart} dueDate={isPartnerFlow ? parseSafeDate(invitationInfo?.dueDate) : dueDate} />;
      case 'feedback':
        return <FeedbackStep locale={ACTIVE_ONBOARDING_LOCALE} helpful={helpful} onHelpful={() => setHelpful(true)} onChooseAnother={() => { setHelpful(false); setCurrentStep(onboardingSteps.indexOf('needs')); }} />;
      case 'habit':
        return <HabitStep locale={ACTIVE_ONBOARDING_LOCALE} need={selectedStart} habit={habit} onSelect={setHabit} />;
      case 'plan':
        return (
          <OnboardingProductMoment wellbeing={wellbeing} habit={habit}
            selectedStart={selectedStart}
            support={support ?? 'later'}
            locale={ACTIVE_ONBOARDING_LOCALE}
            isBabyBorn={momentBabyBorn}
            isPartner={isPartnerFlow}
            babyName={isPartnerFlow ? activeBaby?.name : babyName}
            partnerName={invitationInfo?.partnerName}
            dueDate={isPartnerFlow ? parseSafeDate(invitationInfo?.dueDate) : dueDate}
          />
        );
      case 'trial':
        return <TrialStep locale={ACTIVE_ONBOARDING_LOCALE} />;

      default:
        return null;
    }
  };

  const answerMissing = currentStepKey === 'firstName' ? !firstName.trim()
    : currentStepKey === 'role' ? !userRole
    : currentStepKey === 'healthConsent' ? !consent.healthAllowed && !consentChecked
    : currentStepKey === 'babyStatus' ? isBabyBorn === null
    : currentStepKey === 'dates' ? !(isBabyBorn ? birthDate : dueDate)
    : currentStepKey === 'needs' ? !need
    : currentStepKey === 'challenge' ? !challenge
    : currentStepKey === 'support' ? !support
    : false;
  const chapterProgress = getOnboardingChapters(onboardingSteps, boundedCurrentStep);
  const continueDisabled = answerMissing || isSaving || isSavingConsent || isRedeemingInvitation || Boolean(pendingBabySelection)
    || (currentStepKey === 'invitation' && invitationStatus !== 'accepted');

  return (
    <ImageBackground source={require('@/assets/images/heller-background.png')} resizeMode="cover" style={styles.backgroundImage}>
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />
          <StatusBar barStyle="dark-content" />
          <View style={styles.header}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.back')}
              disabled={boundedCurrentStep === 0 || isSaving || isSavingConsent || isRedeemingInvitation || Boolean(pendingBabySelection)}
              style={[styles.backButton, boundedCurrentStep === 0 && { opacity: 0 }]} onPress={goToPreviousStep}>
              <IconSymbol name="chevron.left" size={20} color={brand.secondary} />
            </TouchableOpacity>
            <ChapterProgress chapters={chapterProgress.chapters} hidden={currentStepKey === 'welcome'}
              label={chapterProgress.active ? t(`chapter.${chapterProgress.active}`) : null}
              accessibilityLabel={chapterProgress.active
                ? t('chapter.progress', { chapter: t(`chapter.${chapterProgress.active}`), current: chapterProgress.activeIndex + 1, total: chapterProgress.chapters.length })
                : t('screen.progress', { current: boundedCurrentStep + 1, total: totalSteps })} />
            <View style={styles.headerSpacer} />
          </View>

          {showScanner ? (
            <AccountLinkingQrModal code={null} invitationLink={buildInvitationLink('')}
              locale={ACTIVE_ONBOARDING_LOCALE} isDark={false}
              onClose={() => setShowScanner(false)}
              onScanned={code => { setShowScanner(false); void redeemInvitation(code); }} />
          ) : isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={styles.loadingText}>{t('screen.loading')}</ThemedText>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={styles.keyboardAvoidingView}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                alwaysBounceVertical={false}
              >
                <View style={styles.content}>
                  <OnboardingTransition key={currentStepKey}>{renderCurrentStep()}</OnboardingTransition>
                </View>
              </ScrollView>

              <View style={styles.footerContainer}>
                <View style={styles.buttonsContainer}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={[styles.nextButton, continueDisabled && styles.buttonDisabled]}
                    onPress={goToNextStep}
                    disabled={continueDisabled}
                    accessibilityState={{ disabled: continueDisabled }}
                    accessibilityRole="button"
                  >
                    <ThemedText style={styles.nextButtonText}>
                      {boundedCurrentStep === totalSteps - 1
                        ? (isSaving ? t('common.saving') : currentStepKey === 'trial' ? valueCopy(ACTIVE_ONBOARDING_LOCALE).trialCta : isPartnerFlow ? t('invitation.openApp') : t(momentBabyBorn ? (selectedStart === 'sleep' ? 'flow.startSleep' : 'flow.startDaily') : (selectedStart === 'checklist' ? 'flow.startChecklist' : 'flow.startPregnancy')))
                        : currentStepKey === 'healthConsent' && !consent.healthAllowed ? (isSavingConsent ? activeDataConsentCopy[ACTIVE_ONBOARDING_LOCALE].saving : healthConsentCopy(ACTIVE_ONBOARDING_LOCALE).cta)
                        : (currentStepKey === 'mood' || currentStepKey === 'energy') && wellbeing[currentStepKey] === null ? wellbeingCopy(ACTIVE_ONBOARDING_LOCALE).skip : currentStepKey === 'welcome' ? valueCopy(ACTIVE_ONBOARDING_LOCALE).welcomeCta : t(currentStepKey === 'productMoment' && !demoCompleted ? 'survey.skipDemo' : 'common.next')}
                    </ThemedText>
                    {isSaving && boundedCurrentStep === totalSteps - 1 && <ActivityIndicator color={brand.white} />}
                    {boundedCurrentStep < totalSteps - 1 && (
                      <IconSymbol name="chevron.right" size={20} color={brand.white} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID={invitationAccessoryViewID}>
              <View style={styles.keyboardAccessory}>
                <TouchableOpacity onPress={Keyboard.dismiss} style={styles.keyboardAccessoryButton}>
                  <ThemedText style={styles.keyboardAccessoryButtonText}>{t('common.done')}</ThemedText>
                </TouchableOpacity>
              </View>
            </InputAccessoryView>
          )}

          <LinkedBabySelectionModal
            visible={Boolean(pendingBabySelection)}
            currentUserId={user?.id}
            linkedUserId={pendingBabySelection?.linkedUserId}
            linkedUserName={pendingBabySelection?.linkedUserName}
            locale={ACTIVE_ONBOARDING_LOCALE}
            onApplied={async () => {
              await Promise.allSettled([
                refreshBabies(),
                refreshBabyDetails(),
              ]);
              setPendingBabySelection(null);
            }}
          />
        </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  medallion: { marginBottom: 20 },
  datesVisual: { flexGrow: 1, justifyContent: 'center', paddingVertical: 28 },
  stageMedallion: { margin: 6 },
  stageCopy: { flex: 1, gap: 4 },
  roleIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)', backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  backgroundImage: { flex: 1, backgroundColor: brand.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10, gap: 16 },
  stepCount: { width: 46, textAlign: 'right', color: brand.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  headerSpacer: { width: 44 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, flexShrink: 0, paddingHorizontal: 24, width: '100%', maxWidth: 540, alignSelf: 'center' },
  stepContainer: { flexGrow: 1, flexShrink: 0, paddingVertical: 14 },
  questionArea: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', gap: 16, paddingVertical: 36 },
  roleChoice: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 18, minHeight: 80 },
  stepTitle: { fontSize: 32, lineHeight: 39, letterSpacing: -0.5, fontWeight: '700', color: brand.text, marginBottom: 14 },
  description: { color: brand.secondary, fontSize: 17, lineHeight: 25, marginBottom: 24 },
  fieldLabel: { color: brand.secondary, fontSize: 15, fontWeight: '600', marginTop: 8, marginBottom: 10 },
  stepSubtitle: { color: brand.secondary, fontSize: 16, lineHeight: 24 },
  input: { minHeight: 56, borderWidth: 1, borderColor: 'rgba(255,255,255,0.82)', borderRadius: 16, borderCurve: 'continuous', paddingHorizontal: 18, paddingVertical: 14, fontSize: 18, color: brand.text, backgroundColor: 'rgba(255,255,255,0.24)' },
  optionalHint: { color: brand.muted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  roleButtonsContainer: { flexDirection: 'row', gap: 12 },
  roleButton: { flex: 1, minHeight: 56, borderWidth: 1.5, borderColor: brand.border, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.55)', padding: 12 },
  roleButtonActive: { borderColor: brand.accent, backgroundColor: brand.selected },
  roleButtonText: { color: brand.secondary, fontSize: 17, fontWeight: '600' },
  roleButtonTextActive: { color: brand.accentText },
  textLink: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  linkText: { color: brand.accentText, fontSize: 14, lineHeight: 21 },
  stageOptions: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', gap: 16, paddingVertical: 24 },
  stageOption: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, minHeight: 112 },
  stageSelected: { borderColor: brand.accent, backgroundColor: brand.selected },
  stageIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: brand.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  stageTitle: { color: brand.text, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  stageDetail: { color: brand.secondary, fontSize: 15, lineHeight: 23 },
  dateButton: { minHeight: 58, borderWidth: 1, borderColor: 'rgba(255,255,255,0.82)', borderRadius: 16, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, gap: 12, backgroundColor: 'rgba(255,255,255,0.24)' },
  dateButtonText: { flex: 1, color: brand.secondary, fontSize: 17, lineHeight: 24 },
  keyboardAvoidingView: { flex: 1 }, scrollView: { flex: 1 }, scrollContent: { flexGrow: 1, paddingBottom: 16 },
  footerContainer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 8, backgroundColor: 'transparent', width: '100%', maxWidth: 540, alignSelf: 'center' },
  footerHint: { color: brand.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 8 },
  buttonsContainer: { paddingVertical: 6 },
  nextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: brand.accent, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', minHeight: 60, padding: 16, borderRadius: 30, boxShadow: '0 8px 22px rgba(94,61,179,0.24)' },
  nextButtonText: { flexShrink: 1, textAlign: 'center', color: brand.white, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  buttonDisabled: { opacity: 0.45 },
  centeredText: { textAlign: 'center' },
  inviteCard: { padding: 18, gap: 12 },
  codeInput: { textAlign: 'center' },
  codeInputFilled: { fontSize: 20, letterSpacing: 2, fontWeight: '600', fontVariant: ['tabular-nums'] },
  redeemButton: { flexDirection: 'row', gap: 8, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: brand.accent },
  redeemButtonText: { color: brand.white, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  orRow: { paddingVertical: 2 }, orLine: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(125,90,80,0.22)' },
  scanButton: { flexDirection: 'row', gap: 10, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.4)' },
  scanButtonText: { color: brand.accentText, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  infoCardContainer: { marginTop: 12 },
  infoCard: { padding: 0 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  infoRowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  infoRowContent: { flex: 1 },
  infoRowLabel: { color: brand.muted, fontSize: 12, marginBottom: 3 },
  infoRowValue: { color: brand.secondary, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  infoCardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: brand.border, marginHorizontal: 16 },
  invitationSkipNote: { color: brand.accentText, fontSize: 14, lineHeight: 22, marginTop: 16 },
  errorText: { color: '#B44F5F', fontSize: 14, lineHeight: 21, marginTop: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }, loadingText: { marginTop: 10 },
  keyboardAccessory: { backgroundColor: brand.background, alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  keyboardAccessoryButton: { padding: 10 }, keyboardAccessoryButtonText: { color: brand.accentText, fontSize: 16, fontWeight: '600' },
});
