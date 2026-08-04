/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert, ImageBackground, SafeAreaView, StatusBar, Platform, ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, Keyboard, TouchableWithoutFeedback, InputAccessoryView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useConvex } from '@/contexts/ConvexContext';
import { useBackground, type BackgroundPreset } from '@/contexts/BackgroundContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { invalidateUserProfileCache, invalidateUserSettingsCache } from '@/lib/appCache';
import { supabase } from '@/lib/supabase';
import { saveBabyInfo } from '@/lib/baby';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { markPaywallShown, shouldShowPaywall } from '@/lib/paywall';
import { redeemInvitationCodeFixed } from '@/lib/redeemInvitationCodeFixed';
import * as ImagePicker from 'expo-image-picker';
import IOSBottomDatePicker from '@/components/modals/IOSBottomDatePicker';
import { LinkedBabySelectionModal } from '@/components/LinkedBabySelectionModal';
import {
  DEFAULT_ONBOARDING_LOCALE,
  getOnboardingLocaleTag,
  OnboardingTranslationKey,
  translateOnboardingText,
} from '@/lib/onboardingTranslations';

type StepKey =
  | 'firstName'
  | 'lastName'
  | 'role'
  | 'invitation'
  | 'babyStatus'
  | 'dates'
  | 'babyInfo'
  | 'babyPhoto'
  | 'background'
  | 'summary';

const MIN_VALID_PROFILE_DATE_YEAR = 2000;
const MIN_VALID_PROFILE_DATE = new Date(MIN_VALID_PROFILE_DATE_YEAR, 0, 1);
let ACTIVE_ONBOARDING_LOCALE = DEFAULT_ONBOARDING_LOCALE;
let ONBOARDING_LOCALE_TAG = getOnboardingLocaleTag(ACTIVE_ONBOARDING_LOCALE);
const t = (
  key: OnboardingTranslationKey,
  params?: Record<string, string | number>,
) => translateOnboardingText(ACTIVE_ONBOARDING_LOCALE, key, params);

const ONBOARDING_PRESET_OPTIONS: readonly {
  id: BackgroundPreset;
  labelKey: OnboardingTranslationKey;
}[] = [
  { id: 'default', labelKey: 'preset.default' },
  { id: 'verspielt', labelKey: 'preset.playful' },
  { id: 'dunkler', labelKey: 'preset.darker' },
  { id: 'nightmode', labelKey: 'preset.night' },
  { id: 'shadow', labelKey: 'preset.shadow' },
  { id: 'wave', labelKey: 'preset.wave' },
  { id: 'stone', labelKey: 'preset.stone' },
];

const ONBOARDING_STEP_ORDER: StepKey[] = ['firstName', 'lastName', 'role', 'invitation', 'babyStatus', 'dates', 'babyInfo', 'babyPhoto', 'background', 'summary'];

const PRESET_DARK_MODE_MAP: Record<BackgroundPreset, boolean> = {
  default: false,
  verspielt: false,
  dunkler: true,
  nightmode: true,
  shadow: true,
  wave: false,
  stone: true,
};

export default function GetUserInfoScreen() {
  ACTIVE_ONBOARDING_LOCALE = useLocale().locale;
  ONBOARDING_LOCALE_TAG = getOnboardingLocaleTag(ACTIVE_ONBOARDING_LOCALE);
  const theme = Colors.light;
  const invitationAccessoryViewID = 'invitation-code-keyboard-accessory';
  const { user } = useAuth();
  const { refreshBabyDetails } = useBabyStatus();
  const { refreshBabies } = useActiveBaby();
  const { syncUser } = useConvex();
  const {
    selectedBackground,
    backgroundSource,
    hasCustomBackground,
    isDarkBackground,
    setPresetBackground,
    pickAndSaveBackground,
    setBackgroundMode,
  } = useBackground();
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
  const [lastName, setLastName] = useState('');
  const [userRole, setUserRole] = useState<'mama' | 'papa' | ''>('');

  // Baby-Informationen
  const [babyName, setBabyName] = useState('');
  const [babyGender, setBabyGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isBabyBorn, setIsBabyBorn] = useState<boolean | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [wantsBabyPhotoUpload, setWantsBabyPhotoUpload] = useState<boolean | null>(null);
  const [babyPhotoUrl, setBabyPhotoUrl] = useState<string | null>(null);
  // Gewicht und Größe werden in dieser Version nicht verwendet, aber für zukünftige Erweiterungen vorbereitet
  const [babyWeight] = useState('');
  const [babyHeight] = useState('');

  // UI-Status
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [isPickingBackground, setIsPickingBackground] = useState(false);

  // Einladungscode
  const [invitationCode, setInvitationCode] = useState(prefilledInvitationCode);
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

  // Schrittweise Abfrage
  const shouldShowInvitationStep = !hasPrefilledInvitationCode
    || (!isRedeemingInvitation && invitationStatus !== 'accepted' && invitationError !== null);
  const onboardingSteps = useMemo<StepKey[]>(() => {
    const baseSteps = shouldShowInvitationStep
      ? ONBOARDING_STEP_ORDER
      : ONBOARDING_STEP_ORDER.filter((step) => step !== 'invitation');
    const defaultSteps = isBabyBorn === true
      ? baseSteps
      : baseSteps.filter((step) => step !== 'babyPhoto');

    return invitationStatus === 'accepted'
      ? (shouldShowInvitationStep
        ? ['firstName', 'lastName', 'role', 'invitation', 'background', 'summary']
        : ['firstName', 'lastName', 'role', 'background', 'summary'])
      : defaultSteps;
  }, [invitationStatus, shouldShowInvitationStep, isBabyBorn]);
  const [currentStep, setCurrentStep] = useState(0);
  const boundedCurrentStep = Math.min(currentStep, Math.max(0, onboardingSteps.length - 1));
  const totalSteps = onboardingSteps.length;
  const currentStepKey = onboardingSteps[boundedCurrentStep];
  const isPartnerFlow = invitationStatus === 'accepted';

  // Bei Schrittwechsel nach oben scrollen
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [boundedCurrentStep]);

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
    options?: { showSuccessAlert?: boolean; showErrorAlert?: boolean }
  ) => {
    const normalizedCode = rawCode.replace(/\s+/g, '').toUpperCase();
    const shouldShowSuccessAlert = options?.showSuccessAlert ?? true;
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
          setPendingBabySelection({
            linkedUserId: result.linkedUserId,
            linkedUserName: partnerName || null,
          });
        }

        if (shouldShowSuccessAlert && !result.linkedUserId) {
          Alert.alert(t('invitation.linkedTitle'), partnerName
            ? t('invitation.linkedWith', { name: partnerName })
            : t('invitation.accepted'));
        }
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
      setIsRedeemingInvitation(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!hasPrefilledInvitationCode || autoRedeemAttemptedRef.current || !user?.id) {
      return;
    }

    autoRedeemAttemptedRef.current = true;
    void redeemInvitation(prefilledInvitationCode, { showSuccessAlert: false, showErrorAlert: false });
  }, [hasPrefilledInvitationCode, user?.id, prefilledInvitationCode, redeemInvitation]);

  const handleRedeemInvitation = async () => {
    await redeemInvitation(invitationCode, { showSuccessAlert: true, showErrorAlert: true });
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

  const pickBabyPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('photo.permissionTitle'), t('photo.permissionMessage'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      let base64Data: string | null = null;

      if (asset.base64) {
        base64Data = `data:image/jpeg;base64,${asset.base64}`;
      } else if (asset.uri) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        base64Data = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      if (!base64Data) {
        Alert.alert(t('common.error'), t('photo.processFailed'));
        return;
      }

      setBabyPhotoUrl(base64Data);
    } catch (error) {
      console.error('Error picking baby photo in onboarding:', error);
      Alert.alert(t('common.error'), t('photo.selectFailed'));
    }
  };

  const handleSelectPresetBackground = async (preset: BackgroundPreset) => {
    await setPresetBackground(preset);
    await setBackgroundMode(PRESET_DARK_MODE_MAP[preset]);
  };

  const handlePickCustomBackground = async () => {
    if (isPickingBackground) return;

    try {
      setIsPickingBackground(true);
      const result = await pickAndSaveBackground();

      if (result.error) {
        console.error('Background selection failed:', result.error);
        Alert.alert(t('common.error'), t('background.selectFailed'));
        return;
      }

      if (result.success && result.needsModeSelection) {
        Alert.alert(
          t('background.brightnessTitle'),
          t('background.brightnessMessage'),
          [
            {
              text: t('common.light'),
              onPress: () => {
                void setBackgroundMode(false);
              },
            },
            {
              text: t('common.dark'),
              onPress: () => {
                void setBackgroundMode(true);
              },
            },
          ],
        );
      }
    } catch (error) {
      console.error('Error picking onboarding background:', error);
      Alert.alert(t('common.error'), t('background.selectFailed'));
    } finally {
      setIsPickingBackground(false);
    }
  };

  // Speichern der Benutzerdaten in verschiedenen Tabellen
  const saveUserData = async () => {
    try {
      if (!user) {
        Alert.alert(t('common.notice'), t('save.signIn'));
        return;
      }

      setIsSaving(true);
      const partnerFlow = invitationStatus === 'accepted';
      const babyBorn = partnerFlow
        ? Boolean(invitationInfo?.isBabyBorn ?? isBabyBorn ?? false)
        : isBabyBorn === true;
      const safeDueDateIso = toSafeIsoString(dueDate);
      const safeBirthDateIso = toSafeIsoString(birthDate);
      const calculatedDueDate = partnerFlow
        ? (invitationInfo?.dueDate ?? safeDueDateIso)
        : (!babyBorn ? safeDueDateIso : null);
      const calculatedBirthDate = partnerFlow
        ? null
        : (babyBorn ? safeBirthDateIso : null);

      // Speichern der Profildaten (Vorname, Nachname, Rolle)
      const profileResult = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
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
          photo_url: babyBorn ? babyPhotoUrl : null,
        };

        const { error: babyError } = await saveBabyInfo(babyInfo);

        if (babyError) {
          console.error('Error saving baby info:', babyError);
          throw new Error(t('save.babyFailed'));
        }
        await refreshBabyDetails();
      }

      await refreshBabies();
      void syncUser();

      // Nach dem Speichern zur entsprechenden Seite navigieren oder Paywall zeigen
      const nextRoute = babyBorn ? '/(tabs)/home' : '/(tabs)/countdown';

      try {
        const { shouldShow, state } = await shouldShowPaywall();
        if (shouldShow) {
          await markPaywallShown('onboarding');
          router.replace({
            pathname: '/paywall',
            params: {
              next: nextRoute,
              origin: 'onboarding',
              trialExpired: state.isTrialExpired ? '1' : '0',
            },
          });
          return;
        }
      } catch (paywallError) {
        console.error('Paywall check after onboarding failed:', paywallError);
      }

      router.replace(nextRoute);
    } catch (err) {
      console.error('Failed to save user data:', err);
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('save.allFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // Zum nächsten Schritt gehen
  const goToNextStep = () => {
    switch (currentStepKey) {
      case 'firstName':
        if (!firstName.trim()) {
          Alert.alert(t('common.notice'), t('validation.firstName'));
          return;
        }
        break;
      case 'lastName':
        if (!lastName.trim()) {
          Alert.alert(t('common.notice'), t('validation.lastName'));
          return;
        }
        break;
      case 'role':
        if (!userRole) {
          Alert.alert(t('common.notice'), t('validation.role'));
          return;
        }
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
      case 'babyInfo':
        break;
      case 'babyPhoto':
        if (wantsBabyPhotoUpload === null) {
          Alert.alert(t('common.notice'), t('validation.photoChoice'));
          return;
        }
        if (wantsBabyPhotoUpload === true && !babyPhotoUrl) {
          Alert.alert(t('common.notice'), t('validation.photoRequired'));
          return;
        }
        break;
      default:
        break;
    }

    const nextStep = boundedCurrentStep + 1;

    if (nextStep >= totalSteps) {
      saveUserData();
      return;
    }

    setCurrentStep(nextStep);
  };

  // Zum vorherigen Schritt gehen
  const goToPreviousStep = () => {
    // Wenn wir beim ersten Schritt sind, können wir nicht zurück
    if (boundedCurrentStep === 0) {
      return;
    }

    // Zum vorherigen Schritt
    setCurrentStep(boundedCurrentStep - 1);
  };

  // Render-Funktion für den aktuellen Schritt
  const renderCurrentStep = () => {
    switch (currentStepKey) {
      case 'firstName': // Vorname
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/BabyThinking.png')}
              style={styles.babyImageSmall}
              resizeMode="contain"
            />
            <ThemedText style={styles.stepTitle}>{t('firstName.title')}</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('firstName.placeholder')}
              placeholderTextColor={theme.tabIconDefault}
              autoFocus
            />
          </ThemedView>
        );

      case 'lastName': // Nachname
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/BabyThinking.png')}
              style={styles.babyImageSmall}
              resizeMode="contain"
            />
            <ThemedText style={styles.stepTitle}>{t('lastName.title')}</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('lastName.placeholder')}
              placeholderTextColor={theme.tabIconDefault}
              autoFocus
            />
          </ThemedView>
        );

      case 'role': // Mama oder Papa
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/MamaPapaBaby.png')}
              style={styles.babyImageSmall}
              resizeMode="contain"
            />
            <ThemedText style={styles.stepTitle}>{t('role.title')}</ThemedText>
            <View style={styles.roleButtonsContainer}>
              <TouchableOpacity
                style={[styles.roleButton, userRole === 'mama' && styles.roleButtonActive]}
                onPress={() => setUserRole('mama')}
              >
                <IconSymbol
                  name="person.fill"
                  size={24}
                  color={userRole === 'mama' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.roleButtonText, userRole === 'mama' && styles.roleButtonTextActive]}>
                  {t('role.mama')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleButton, userRole === 'papa' && styles.roleButtonActive]}
                onPress={() => setUserRole('papa')}
              >
                <IconSymbol
                  name="person.fill"
                  size={24}
                  color={userRole === 'papa' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.roleButtonText, userRole === 'papa' && styles.roleButtonTextActive]}>
                  {t('role.papa')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        );

      case 'invitation': // Einladungscode
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/BabyBirth.png')}
              style={styles.babyImageSmall}
              resizeMode="contain"
            />
            {invitationStatus === 'accepted' ? (
              <>
                <ThemedText style={styles.stepTitle}>{t('invitation.successTitle')}</ThemedText>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(157,190,187,0.15)' }]}>
                      <IconSymbol name="checkmark.circle.fill" size={18} color="#9DBEBB" />
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
                          <IconSymbol name="calendar" size={18} color="#8E4EC6" />
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
                </View>
                <ThemedText style={styles.invitationSkipNote}>
                  {t('invitation.continueSummary')}
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText style={styles.stepTitle}>{t('invitation.title')}</ThemedText>
                <ThemedText style={[styles.stepSubtitle, { textAlign: 'center', marginTop: 0, marginBottom: 16 }]}>
                  {t('invitation.description')}
                </ThemedText>

                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={invitationCode}
                  onChangeText={(value) => setInvitationCode(value.replace(/\s+/g, '').toUpperCase())}
                  placeholder={t('invitation.placeholder')}
                  placeholderTextColor={theme.tabIconDefault}
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

                <View style={[styles.booleanButtonsContainer, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={[styles.booleanButton, { marginRight: 5 }]}
                    onPress={handleRedeemInvitation}
                    disabled={isRedeemingInvitation}
                  >
                    <ThemedText style={styles.booleanButtonText}>
                      {isRedeemingInvitation ? t('invitation.checking') : t('invitation.redeem')}
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.booleanButton, { marginLeft: 5 }]}
                    onPress={() => {
                      setInvitationStatus('skipped');
                      goToNextStep();
                    }}
                    disabled={isRedeemingInvitation}
                  >
                    <ThemedText style={styles.booleanButtonText}>{t('invitation.skip')}</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ThemedView>
        );

      case 'babyStatus': // Baby bereits geboren?
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/babyborn.png')}
              style={styles.babyImage}
              resizeMode="contain"
            />
            <ThemedText style={styles.stepTitle}>{t('babyStatus.title')}</ThemedText>
            <View style={styles.booleanButtonsContainer}>
              <TouchableOpacity
                style={[styles.booleanButton, isBabyBorn === true && styles.booleanButtonActive]}
                onPress={() => {
                  setIsBabyBorn(true);
                  setShowDueDatePicker(false);
                }}
              >
                <ThemedText style={[styles.booleanButtonText, isBabyBorn === true && styles.booleanButtonTextActive]}>{t('common.yes')}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.booleanButton, isBabyBorn === false && styles.booleanButtonActive]}
                onPress={() => {
                  setIsBabyBorn(false);
                  setShowBirthDatePicker(false);
                  setWantsBabyPhotoUpload(null);
                  setBabyPhotoUrl(null);
                }}
              >
                <ThemedText style={[styles.booleanButtonText, isBabyBorn === false && styles.booleanButtonTextActive]}>{t('common.no')}</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
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
        const title = isBorn ? t('dates.birthQuestion') : t('dates.dueQuestion');
        const placeholder = isBorn ? t('dates.chooseBirth') : t('dates.chooseDue');

        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/BabyBirth.png')}
              style={styles.babyImageSmall}
              resizeMode="contain"
            />
            <ThemedText style={styles.stepTitle}>{title}</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => (isBorn ? setShowBirthDatePicker(true) : setShowDueDatePicker(true))}
            >
              <ThemedText style={styles.dateButtonText}>
                {selectedDate ? formatDate(selectedDate) : placeholder}
              </ThemedText>
              <IconSymbol name="calendar" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>

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
          </ThemedView>
        );
      }

      case 'babyInfo': // Baby-Informationen (Name, Geschlecht)
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/BabyName.png')}
              style={styles.babyImageSmall}
              resizeMode="contain"
            />
            <ThemedText style={styles.stepTitle}>{t('babyInfo.title')}</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={babyName}
              onChangeText={setBabyName}
              placeholder={t('babyInfo.namePlaceholder')}
              placeholderTextColor={theme.tabIconDefault}
              autoFocus
            />

            <ThemedText style={styles.stepSubtitle}>{t('babyInfo.genderQuestion')}</ThemedText>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[styles.genderButton, babyGender === 'male' && styles.genderButtonActive]}
                onPress={() => setBabyGender('male')}
              >
                <IconSymbol
                  name="person.fill"
                  size={24}
                  color={babyGender === 'male' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.genderButtonText, babyGender === 'male' && styles.genderButtonTextActive]}>
                  {t('babyInfo.boy')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.genderButton, babyGender === 'female' && styles.genderButtonActive]}
                onPress={() => setBabyGender('female')}
              >
                <IconSymbol
                  name="person.fill"
                  size={24}
                  color={babyGender === 'female' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.genderButtonText, babyGender === 'female' && styles.genderButtonTextActive]}>
                  {t('babyInfo.girl')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.genderButton, babyGender === 'unknown' && styles.genderButtonActive]}
                onPress={() => setBabyGender('unknown')}
              >
                <IconSymbol
                  name="questionmark.circle"
                  size={24}
                  color={babyGender === 'unknown' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.genderButtonText, babyGender === 'unknown' && styles.genderButtonTextActive]}>
                  {t('babyInfo.unknown')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        );

      case 'babyPhoto': // Babyfoto-Upload (nur wenn Baby bereits geboren ist)
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/Baby_Take_Pic.gif')}
              style={styles.babyTakePicImage}
              resizeMode="contain"
            />
            <ThemedText style={styles.stepTitle}>{t('babyPhoto.title')}</ThemedText>
            <View style={styles.booleanButtonsContainer}>
              <TouchableOpacity
                style={[styles.booleanButton, wantsBabyPhotoUpload === true && styles.booleanButtonActive]}
                onPress={() => setWantsBabyPhotoUpload(true)}
              >
                <ThemedText style={[styles.booleanButtonText, wantsBabyPhotoUpload === true && styles.booleanButtonTextActive]}>{t('common.yes')}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.booleanButton, wantsBabyPhotoUpload === false && styles.booleanButtonActive]}
                onPress={() => {
                  setWantsBabyPhotoUpload(false);
                  setBabyPhotoUrl(null);
                }}
              >
                <ThemedText style={[styles.booleanButtonText, wantsBabyPhotoUpload === false && styles.booleanButtonTextActive]}>{t('common.no')}</ThemedText>
              </TouchableOpacity>
            </View>

            {wantsBabyPhotoUpload === true && (
              <View style={styles.photoUploadContainer}>
                {babyPhotoUrl ? (
                  <Image source={{ uri: babyPhotoUrl }} style={styles.onboardingBabyPhoto} />
                ) : (
                  <View style={styles.onboardingPhotoPlaceholder}>
                    <IconSymbol name="photo" size={28} color={theme.tabIconDefault} />
                    <ThemedText style={styles.onboardingPhotoPlaceholderText}>{t('babyPhoto.noneSelected')}</ThemedText>
                  </View>
                )}

                <TouchableOpacity style={styles.photoUploadButton} onPress={pickBabyPhoto}>
                  <ThemedText style={styles.photoUploadButtonText}>
                    {babyPhotoUrl ? t('babyPhoto.change') : t('babyPhoto.choose')}
                  </ThemedText>
                </TouchableOpacity>

                {!!babyPhotoUrl && (
                  <TouchableOpacity style={styles.photoRemoveButton} onPress={() => setBabyPhotoUrl(null)}>
                    <ThemedText style={styles.photoRemoveButtonText}>{t('babyPhoto.remove')}</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ThemedView>
        );

      case 'background': // Hintergrundauswahl
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <ThemedText style={styles.stepTitle}>{t('background.title')}</ThemedText>
            <ThemedText style={[styles.stepSubtitle, { textAlign: 'center', marginTop: 0, marginBottom: 14 }]}>
              {t('background.description')}
            </ThemedText>

            <View style={styles.onboardingBackgroundPreviewContainer}>
              <Image
                source={backgroundSource}
                style={styles.onboardingBackgroundPreview}
                resizeMode={hasCustomBackground ? 'cover' : 'repeat'}
              />
              <View style={styles.onboardingBackgroundPreviewOverlay}>
                <ThemedText style={styles.onboardingBackgroundPreviewLabel}>
                  {selectedBackground === 'custom'
                    ? t('background.customPreview', {
                        mode: isDarkBackground ? t('background.modeDark') : t('background.modeLight'),
                      })
                    : t(ONBOARDING_PRESET_OPTIONS.find((option) => option.id === selectedBackground)?.labelKey
                      ?? 'preset.default')}
                </ThemedText>
              </View>
            </View>

            <View style={styles.onboardingBackgroundPresetRow}>
              {ONBOARDING_PRESET_OPTIONS.map((option) => {
                const isSelected = selectedBackground === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.onboardingBackgroundPresetButton,
                      isSelected && styles.onboardingBackgroundPresetButtonActive,
                    ]}
                    onPress={() => {
                      void handleSelectPresetBackground(option.id);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.onboardingBackgroundPresetButtonLabel,
                        isSelected && styles.onboardingBackgroundPresetButtonLabelActive,
                      ]}
                    >
                      {t(option.labelKey)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.onboardingBackgroundActionButton, isPickingBackground && styles.buttonDisabled]}
              onPress={handlePickCustomBackground}
              disabled={isPickingBackground}
            >
              {isPickingBackground ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol name="photo" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.onboardingBackgroundActionButtonText}>{t('background.chooseCustom')}</ThemedText>
                </>
              )}
            </TouchableOpacity>

            {hasCustomBackground && (
              <TouchableOpacity
                style={styles.onboardingBackgroundModeButton}
                onPress={() => {
                  void setBackgroundMode(!isDarkBackground);
                }}
              >
                <IconSymbol name={isDarkBackground ? 'sun.max' : 'moon'} size={18} color="#7D5A50" />
                <ThemedText style={styles.onboardingBackgroundModeButtonText}>
                  {isDarkBackground ? t('background.textModeLight') : t('background.textModeDark')}
                </ThemedText>
              </TouchableOpacity>
            )}
          </ThemedView>
        );

      case 'summary': // Zusammenfassung und Speichern
        return (
          <ThemedView style={[styles.stepContainer, styles.summaryStepContainer]} lightColor="#FFFFFF" darkColor="#FFFFFF">
            {/* Baby-Foto oder Illustration */}
            {!isPartnerFlow && babyPhotoUrl ? (
              <View style={styles.summaryPhotoSection}>
                <Image source={{ uri: babyPhotoUrl }} style={styles.summaryBabyPhoto} />
                {babyName ? <ThemedText style={styles.summaryBabyName}>{babyName}</ThemedText> : null}
              </View>
            ) : (
              <Image
                source={require('@/assets/images/BabyBirth.png')}
                style={styles.babyImageSmall}
                resizeMode="contain"
              />
            )}

            <ThemedText style={styles.stepTitle}>{t('summary.title')}</ThemedText>

            <View style={styles.infoCard}>
              {/* Name */}
              <View style={styles.infoRow}>
                <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(157,190,187,0.15)' }]}>
                  <IconSymbol name="person.fill" size={18} color="#9DBEBB" />
                </View>
                <View style={styles.infoRowContent}>
                  <ThemedText style={styles.infoRowLabel}>{t('summary.name')}</ThemedText>
                  <ThemedText style={styles.infoRowValue}>{firstName} {lastName}</ThemedText>
                </View>
              </View>

              <View style={styles.infoCardDivider} />

              {/* Rolle */}
              <View style={styles.infoRow}>
                <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(232,160,191,0.15)' }]}>
                  <IconSymbol name="heart.fill" size={18} color="#E8A0BF" />
                </View>
                <View style={styles.infoRowContent}>
                  <ThemedText style={styles.infoRowLabel}>{t('summary.role')}</ThemedText>
                  <ThemedText style={styles.infoRowValue}>
                    {userRole === 'mama'
                      ? t('role.mama')
                      : userRole === 'papa'
                        ? t('role.papa')
                        : t('common.notSet')}
                  </ThemedText>
                </View>
              </View>

              {/* Partner-Flow */}
              {isPartnerFlow && (
                <>
                  <View style={styles.infoCardDivider} />
                  <View style={styles.infoRow}>
                    <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(142,78,198,0.12)' }]}>
                      <IconSymbol name="person.2.fill" size={16} color="#8E4EC6" />
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
                          <IconSymbol name="calendar" size={18} color="#8E4EC6" />
                        </View>
                        <View style={styles.infoRowContent}>
                          <ThemedText style={styles.infoRowLabel}>{t('summary.sharedDueDate')}</ThemedText>
                          <ThemedText style={styles.infoRowValue}>
                            {formatDate(parseSafeDate(invitationInfo.dueDate))}
                          </ThemedText>
                        </View>
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Normaler Flow */}
              {!isPartnerFlow && (
                <>
                  <View style={styles.infoCardDivider} />
                  <View style={styles.infoRow}>
                    <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(142,78,198,0.12)' }]}>
                      <IconSymbol name="calendar" size={18} color="#8E4EC6" />
                    </View>
                    <View style={styles.infoRowContent}>
                      <ThemedText style={styles.infoRowLabel}>
                        {isBabyBorn ? t('summary.birthDate') : t('summary.dueDate')}
                      </ThemedText>
                      <ThemedText style={styles.infoRowValue}>
                        {isBabyBorn
                          ? (birthDate ? formatDate(birthDate) : t('common.notSet'))
                          : (dueDate ? formatDate(dueDate) : t('common.notSet'))}
                      </ThemedText>
                    </View>
                  </View>

                  {babyName ? (
                    <>
                      <View style={styles.infoCardDivider} />
                      <View style={styles.infoRow}>
                        <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(232,160,191,0.15)' }]}>
                          <IconSymbol name="star.fill" size={18} color="#E8A0BF" />
                        </View>
                        <View style={styles.infoRowContent}>
                          <ThemedText style={styles.infoRowLabel}>{t('summary.babyName')}</ThemedText>
                          <ThemedText style={styles.infoRowValue}>{babyName}</ThemedText>
                        </View>
                      </View>
                    </>
                  ) : null}

                  <View style={styles.infoCardDivider} />
                  <View style={styles.infoRow}>
                    <View style={[styles.infoRowIcon, { backgroundColor: 'rgba(157,190,187,0.15)' }]}>
                      <IconSymbol name={babyGender === 'unknown' ? 'questionmark.circle' : 'person.fill'} size={18} color="#9DBEBB" />
                    </View>
                    <View style={styles.infoRowContent}>
                      <ThemedText style={styles.infoRowLabel}>{t('summary.gender')}</ThemedText>
                      <ThemedText style={styles.infoRowValue}>
                        {babyGender === 'male'
                          ? t('babyInfo.boy')
                          : babyGender === 'female'
                            ? t('babyInfo.girl')
                            : t('summary.genderUnknown')}
                      </ThemedText>
                    </View>
                  </View>
                </>
              )}
            </View>

          </ThemedView>
        );

      default:
        return null;
    }
  };

  return (
    <ImageBackground
      source={backgroundSource}
      style={styles.backgroundImage}
      resizeMode={hasCustomBackground ? 'cover' : 'repeat'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />
          <StatusBar hidden={true} />

          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              {t('screen.title')}
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {t('screen.subtitle')}
            </ThemedText>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${(boundedCurrentStep + 1) / totalSteps * 100}%` }]}
              />
            </View>
            <ThemedText style={styles.progressText}>
              {t('screen.progress', { current: boundedCurrentStep + 1, total: totalSteps })}
            </ThemedText>
          </View>

          {isLoading ? (
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
                keyboardShouldPersistTaps="never"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.content}>
                  {renderCurrentStep()}
                </View>
              </ScrollView>

              <View style={styles.footerContainer}>
                {currentStepKey === 'summary' && (
                  <ThemedText style={styles.footerSummaryNote} allowFontScaling={false}>
                    {t('screen.changeLater')}
                  </ThemedText>
                )}

                <View style={styles.buttonsContainer}>
                  {boundedCurrentStep > 0 && (
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={goToPreviousStep}
                    >
                      <IconSymbol name="chevron.left" size={20} color={theme.text} />
                      <ThemedText style={styles.backButtonText}>{t('common.back')}</ThemedText>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.nextButton, (isSaving || isRedeemingInvitation) && styles.buttonDisabled]}
                    onPress={goToNextStep}
                    disabled={isSaving || isRedeemingInvitation}
                  >
                    <ThemedText style={styles.nextButtonText}>
                      {boundedCurrentStep === totalSteps - 1
                        ? (isSaving ? t('common.saving') : t('common.done'))
                        : t('common.next')}
                    </ThemedText>
                    {boundedCurrentStep < totalSteps - 1 && (
                      <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
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
              setPendingBabySelection(null);
              await Promise.allSettled([
                refreshBabies(),
                refreshBabyDetails(),
              ]);
            }}
          />
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#7D5A50',
  },
  subtitle: {
    fontSize: 18,
    color: '#7D5A50',
    opacity: 0.8,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9DBEBB',
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#7D5A50',
  },
  content: {
    paddingHorizontal: 20,
  },
  stepContainer: {
    padding: 20,
    borderRadius: 22,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryStepContainer: {
    paddingTop: 12,
    paddingBottom: 28,
  },
  babyImage: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    marginBottom: 20,
  },
  babyImageSmall: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 12,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#7D5A50',
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    marginTop: 20,
    marginBottom: 10,
    color: '#7D5A50',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 14,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#7D5A50',
  },
  booleanButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  booleanButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 14,
    marginHorizontal: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  booleanButtonActive: {
    backgroundColor: '#9DBEBB',
    borderColor: '#9DBEBB',
  },
  booleanButtonText: {
    fontSize: 16,
    color: '#7D5A50',
  },
  booleanButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  roleButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 1,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 14,
    marginHorizontal: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  roleButtonActive: {
    backgroundColor: '#9DBEBB',
    borderColor: '#9DBEBB',
  },
  roleButtonText: {
    fontSize: 16,
    marginTop: 5,
    color: '#7D5A50',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  genderButton: {
    width: '30%',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  genderButtonActive: {
    backgroundColor: '#9DBEBB',
    borderColor: '#9DBEBB',
  },
  genderButtonText: {
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
    color: '#7D5A50',
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  photoUploadContainer: {
    marginTop: 14,
    alignItems: 'center',
  },
  babyTakePicImage: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  onboardingBabyPhoto: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 12,
  },
  onboardingPhotoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: '#E9C9B6',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  onboardingPhotoPlaceholderText: {
    fontSize: 12,
    color: '#7D5A50',
    textAlign: 'center',
    marginTop: 6,
  },
  photoUploadButton: {
    backgroundColor: '#9DBEBB',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  photoUploadButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  photoRemoveButton: {
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  photoRemoveButtonText: {
    color: '#7D5A50',
    fontSize: 13,
    fontWeight: '600',
  },
  onboardingBackgroundPreviewContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 140,
    marginBottom: 12,
    position: 'relative',
  },
  onboardingBackgroundPreview: {
    width: '100%',
    height: '100%',
  },
  onboardingBackgroundPreviewOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  onboardingBackgroundPreviewLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  onboardingBackgroundPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  onboardingBackgroundPresetButton: {
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  onboardingBackgroundPresetButtonActive: {
    backgroundColor: '#9DBEBB',
    borderColor: '#9DBEBB',
  },
  onboardingBackgroundPresetButtonLabel: {
    color: '#7D5A50',
    fontSize: 13,
    fontWeight: '600',
  },
  onboardingBackgroundPresetButtonLabelActive: {
    color: '#FFFFFF',
  },
  onboardingBackgroundActionButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#9DBEBB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  onboardingBackgroundActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  onboardingBackgroundModeButton: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9C9B6',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  onboardingBackgroundModeButtonText: {
    color: '#7D5A50',
    fontWeight: '600',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: 'rgba(247,239,229,0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(233,201,182,0.5)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  infoRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoRowContent: {
    flex: 1,
  },
  infoRowLabel: {
    fontSize: 12,
    color: '#7D5A50',
    opacity: 0.65,
    marginBottom: 1,
  },
  infoRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
  },
  infoCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(125,90,80,0.12)',
    marginHorizontal: 14,
  },
  invitationSkipNote: {
    fontSize: 14,
    color: '#9DBEBB',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#B71C1C',
    marginTop: 8,
  },
  summaryPhotoSection: {
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryBabyPhoto: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(157,190,187,0.5)',
  },
  summaryBabyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    marginTop: 6,
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  footerSummaryNote: {
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    color: '#7D5A50',
    opacity: 0.75,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFCCCB', // Pastellrot
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 5,
    color: '#7D5A50',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9DBEBB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    minWidth: 120,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  keyboardAccessory: {
    backgroundColor: '#F3E6DA',
    borderTopWidth: 1,
    borderTopColor: '#E9C9B6',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyboardAccessoryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  keyboardAccessoryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7D5A50',
  },
});
