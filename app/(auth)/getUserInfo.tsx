import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert, ImageBackground, SafeAreaView, StatusBar, Platform, ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, Keyboard, TouchableWithoutFeedback, InputAccessoryView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useConvex } from '@/contexts/ConvexContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase } from '@/lib/supabase';
import { saveBabyInfo, syncBabiesForLinkedUsers } from '@/lib/baby';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { markPaywallShown, shouldShowPaywall } from '@/lib/paywall';
import { redeemInvitationCodeFixed } from '@/lib/redeemInvitationCodeFixed';
import * as ImagePicker from 'expo-image-picker';

type StepKey =
  | 'firstName'
  | 'lastName'
  | 'role'
  | 'invitation'
  | 'babyStatus'
  | 'dates'
  | 'babyInfo'
  | 'babyPhoto'
  | 'summary';

export default function GetUserInfoScreen() {
  const theme = Colors.light;
  const invitationAccessoryViewID = 'invitation-code-keyboard-accessory';
  const { user } = useAuth();
  const { refreshBabyDetails } = useBabyStatus();
  const { refreshBabies } = useActiveBaby();
  const { syncUser } = useConvex();
  const params = useLocalSearchParams<{ invitationCode?: string }>();
  const prefilledInvitationCode = useMemo(() => {
    if (typeof params?.invitationCode !== 'string') return '';
    return params.invitationCode.replace(/\s+/g, '').toUpperCase();
  }, [params?.invitationCode]);
  const hasPrefilledInvitationCode = prefilledInvitationCode.length > 0;

  const parseSafeDate = (value: unknown): Date | null => {
    if (value === null || value === undefined) return null;
    const parsed = new Date(value as string | number | Date);
    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2000) return null;
    return parsed;
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

  // Einladungscode
  const [invitationCode, setInvitationCode] = useState('');
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'accepted' | 'skipped'>('idle');
  const [isRedeemingInvitation, setIsRedeemingInvitation] = useState(false);
  const [autoRedeemAttempted, setAutoRedeemAttempted] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<{
    partnerName?: string;
    dueDate?: string | null;
    isBabyBorn?: boolean | null;
  } | null>(null);

  // Schrittweise Abfrage
  const stepOrder: StepKey[] = ['firstName', 'lastName', 'role', 'invitation', 'babyStatus', 'dates', 'babyInfo', 'babyPhoto', 'summary'];
  const shouldShowInvitationStep = !hasPrefilledInvitationCode
    || (autoRedeemAttempted && !isRedeemingInvitation && invitationStatus !== 'accepted');
  const onboardingSteps = useMemo<StepKey[]>(() => {
    const baseSteps = shouldShowInvitationStep
      ? stepOrder
      : stepOrder.filter((step) => step !== 'invitation');
    const defaultSteps = isBabyBorn === true
      ? baseSteps
      : baseSteps.filter((step) => step !== 'babyPhoto');

    return invitationStatus === 'accepted'
      ? (shouldShowInvitationStep
        ? ['firstName', 'lastName', 'role', 'invitation', 'summary']
        : ['firstName', 'lastName', 'role', 'summary'])
      : defaultSteps;
  }, [invitationStatus, shouldShowInvitationStep, isBabyBorn]);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = onboardingSteps.length;
  const currentStepKey = onboardingSteps[currentStep];
  const isPartnerFlow = invitationStatus === 'accepted';

  useEffect(() => {
    if (currentStep >= onboardingSteps.length) {
      setCurrentStep(Math.max(0, onboardingSteps.length - 1));
    }
  }, [currentStep, onboardingSteps.length]);

  useEffect(() => {
    if (prefilledInvitationCode) {
      setInvitationCode(prefilledInvitationCode);
    }
  }, [prefilledInvitationCode]);

  // Formatieren eines Datums für die Anzeige
  const formatDate = (date: Date | null) => {
    if (!date) return 'Nicht festgelegt';
    return date.toLocaleDateString('de-DE', {
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
        Alert.alert('Hinweis', 'Bitte melde dich erneut an.');
      }
      return false;
    }

    if (!normalizedCode) {
      setInvitationError('Bitte gib einen Einladungscode ein.');
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

        await syncBabiesForLinkedUsers();

        if (shouldShowSuccessAlert) {
          Alert.alert('Einladung verknüpft', partnerName
            ? `Du bist jetzt mit ${partnerName} verbunden.`
            : 'Einladungscode wurde angenommen.');
        }
        return true;
      } else {
        const errorMessage = result.error?.message || 'Der Einladungscode konnte nicht eingelöst werden.';
        setInvitationError(errorMessage);
        setInvitationStatus('idle');
        if (shouldShowErrorAlert) {
          Alert.alert('Fehler', errorMessage);
        }
        return false;
      }
    } catch (err: any) {
      console.error('Invitation redeem failed:', err);
      const message = err?.message || 'Ein unerwarteter Fehler ist aufgetreten.';
      setInvitationError(message);
      setInvitationStatus('idle');
      if (shouldShowErrorAlert) {
        Alert.alert('Fehler', message);
      }
      return false;
    } finally {
      setIsRedeemingInvitation(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!hasPrefilledInvitationCode || autoRedeemAttempted || !user?.id) {
      return;
    }

    setAutoRedeemAttempted(true);
    void redeemInvitation(prefilledInvitationCode, { showSuccessAlert: false, showErrorAlert: false });
  }, [hasPrefilledInvitationCode, autoRedeemAttempted, user?.id, prefilledInvitationCode, redeemInvitation]);

  const handleRedeemInvitation = async () => {
    await redeemInvitation(invitationCode, { showSuccessAlert: true, showErrorAlert: true });
  };

  // Handler für Änderungen am Geburtstermin
  const handleDueDateChange = (_: any, selectedDate?: Date) => {
    setShowDueDatePicker(Platform.OS === 'ios');
    const validDate = parseSafeDate(selectedDate ?? null);
    if (validDate) {
      setDueDate(validDate);
    }
  };

  // Handler für Änderungen am Geburtsdatum
  const handleBirthDateChange = (_: any, selectedDate?: Date) => {
    setShowBirthDatePicker(Platform.OS === 'ios');
    const validDate = parseSafeDate(selectedDate ?? null);
    if (validDate) {
      setBirthDate(validDate);
    }
  };

  const pickBabyPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Zugriff auf deine Fotos.');
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
        Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
        return;
      }

      setBabyPhotoUrl(base64Data);
    } catch (error) {
      console.error('Error picking baby photo in onboarding:', error);
      Alert.alert('Fehler', 'Das Babyfoto konnte nicht ausgewählt werden.');
    }
  };

  // Speichern der Benutzerdaten in verschiedenen Tabellen
  const saveUserData = async () => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deine Daten zu speichern.');
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
        throw new Error('Profildaten konnten nicht gespeichert werden.');
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
        throw new Error('Benutzereinstellungen konnten nicht überprüft werden.');
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
        throw new Error('Benutzereinstellungen konnten nicht gespeichert werden.');
      }

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
          throw new Error('Baby-Informationen konnten nicht gespeichert werden.');
        }
        await refreshBabyDetails();
      } else {
        await syncBabiesForLinkedUsers();
      }

      await refreshBabies();
      void syncUser();

      // Nach dem Speichern zur entsprechenden Seite navigieren oder Paywall zeigen
      const nextRoute = babyBorn ? '/(tabs)/home' : '/(tabs)/countdown';

      try {
        const { shouldShow } = await shouldShowPaywall();
        if (shouldShow) {
          await markPaywallShown('onboarding');
          router.replace({
            pathname: '/paywall',
            params: { next: nextRoute, origin: 'onboarding' }
          });
          return;
        }
      } catch (paywallError) {
        console.error('Paywall check after onboarding failed:', paywallError);
      }

      router.replace(nextRoute);
    } catch (err) {
      console.error('Failed to save user data:', err);
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Deine Daten konnten nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  // Zum nächsten Schritt gehen
  const goToNextStep = () => {
    switch (currentStepKey) {
      case 'firstName':
        if (!firstName.trim()) {
          Alert.alert('Hinweis', 'Bitte gib deinen Vornamen ein.');
          return;
        }
        break;
      case 'lastName':
        if (!lastName.trim()) {
          Alert.alert('Hinweis', 'Bitte gib deinen Nachnamen ein.');
          return;
        }
        break;
      case 'role':
        if (!userRole) {
          Alert.alert('Hinweis', 'Bitte wähle aus, ob du Mama oder Papa bist.');
          return;
        }
        break;
      case 'babyStatus':
        if (isBabyBorn === null) {
          Alert.alert('Hinweis', 'Bitte gib an, ob dein Baby bereits geboren ist.');
          return;
        }
        break;
      case 'dates':
        if (isBabyBorn === false && !dueDate) {
          Alert.alert('Hinweis', 'Bitte wähle den errechneten Geburtstermin aus.');
          return;
        }
        if (isBabyBorn === true && !birthDate) {
          Alert.alert('Hinweis', 'Bitte gib das Geburtsdatum deines Babys ein.');
          return;
        }
        if (isBabyBorn === null) {
          Alert.alert('Hinweis', 'Bitte gib an, ob dein Baby bereits geboren ist.');
          return;
        }
        break;
      case 'babyInfo':
        break;
      case 'babyPhoto':
        if (wantsBabyPhotoUpload === null) {
          Alert.alert('Hinweis', 'Bitte gib an, ob du ein Babyfoto hochladen möchtest.');
          return;
        }
        if (wantsBabyPhotoUpload === true && !babyPhotoUrl) {
          Alert.alert('Hinweis', 'Bitte wähle ein Babyfoto aus oder antworte mit "Nein".');
          return;
        }
        break;
      default:
        break;
    }

    const nextStep = currentStep + 1;

    if (nextStep >= totalSteps) {
      saveUserData();
      return;
    }

    setCurrentStep(nextStep);
  };

  // Zum vorherigen Schritt gehen
  const goToPreviousStep = () => {
    // Wenn wir beim ersten Schritt sind, können wir nicht zurück
    if (currentStep === 0) {
      return;
    }

    // Zum vorherigen Schritt
    setCurrentStep(currentStep - 1);
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
            <ThemedText style={styles.stepTitle}>Wie ist dein Vorname?</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Dein Vorname"
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
            <ThemedText style={styles.stepTitle}>Wie ist dein Nachname?</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Dein Nachname"
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
            <ThemedText style={styles.stepTitle}>Bist du Mama oder Papa?</ThemedText>
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
                  Mama
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
                  Papa
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
            <ThemedText style={styles.stepTitle}>Hast du einen Einladungscode?</ThemedText>
            <ThemedText style={styles.stepSubtitle}>
              Damit verbindest du dich mit deiner Partnerperson und nutzt gemeinsam dasselbe Baby-Profil.
            </ThemedText>

            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={invitationCode}
              onChangeText={(value) => setInvitationCode(value.replace(/\s+/g, '').toUpperCase())}
              placeholder="CODE (optional)"
              placeholderTextColor={theme.tabIconDefault}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              inputAccessoryViewID={Platform.OS === 'ios' ? invitationAccessoryViewID : undefined}
            />

            {invitationError && (
              <ThemedText style={[styles.summaryLabel, { color: '#B71C1C', marginTop: 8 }]}>
                {invitationError}
              </ThemedText>
            )}

            {invitationStatus === 'accepted' && (
              <ThemedText style={[styles.summaryLabel, { color: theme.accent, marginTop: 8 }]}>
                {invitationInfo?.partnerName
                  ? `Verbunden mit ${invitationInfo.partnerName}`
                  : 'Einladungscode akzeptiert'}
              </ThemedText>
            )}

            <View style={styles.booleanButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.booleanButton,
                  { marginRight: 5 },
                  invitationStatus === 'accepted' && styles.booleanButtonActive,
                ]}
                onPress={handleRedeemInvitation}
                disabled={isRedeemingInvitation}
              >
                <ThemedText
                  style={[
                    styles.booleanButtonText,
                    invitationStatus === 'accepted' && styles.booleanButtonTextActive,
                  ]}
                >
                  {isRedeemingInvitation ? 'Prüfe...' : 'Code einlösen'}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.booleanButton, { marginLeft: 5 }]}
                onPress={() => {
                  if (invitationStatus !== 'accepted') {
                    setInvitationStatus('skipped');
                  }
                  goToNextStep();
                }}
                disabled={isRedeemingInvitation || invitationStatus === 'accepted'}
              >
                <ThemedText style={styles.booleanButtonText}>Ohne Code weiter</ThemedText>
              </TouchableOpacity>
            </View>
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
            <ThemedText style={styles.stepTitle}>Ist dein Baby bereits geboren?</ThemedText>
            <View style={styles.booleanButtonsContainer}>
              <TouchableOpacity
                style={[styles.booleanButton, isBabyBorn === true && styles.booleanButtonActive]}
                onPress={() => {
                  setIsBabyBorn(true);
                  setShowDueDatePicker(false);
                }}
              >
                <ThemedText style={[styles.booleanButtonText, isBabyBorn === true && styles.booleanButtonTextActive]}>Ja</ThemedText>
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
                <ThemedText style={[styles.booleanButtonText, isBabyBorn === false && styles.booleanButtonTextActive]}>Nein</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        );

      case 'dates': { // Datum abhängig vom Baby-Status
        const isBorn = isBabyBorn === true;
        const selectedDate = isBorn ? birthDate : dueDate;
        const title = isBorn ? 'Wann wurde dein Baby geboren?' : 'Wann ist der errechnete Geburtstermin?';
        const placeholder = isBorn ? 'Geburtsdatum auswählen' : 'Geburtstermin auswählen';

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

            {isBorn && showBirthDatePicker && (
              <DateTimePicker
                value={selectedDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleBirthDateChange}
                maximumDate={new Date()}
              />
            )}

            {!isBorn && showDueDatePicker && (
              <DateTimePicker
                value={selectedDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDueDateChange}
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
            <ThemedText style={styles.stepTitle}>Wie heißt dein Baby?</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={babyName}
              onChangeText={setBabyName}
              placeholder="Name deines Babys (optional)"
              placeholderTextColor={theme.tabIconDefault}
              autoFocus
            />

            <ThemedText style={styles.stepSubtitle}>Welches Geschlecht hat dein Baby?</ThemedText>
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
                  Junge
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
                  Mädchen
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
                  Weiß noch nicht
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        );

      case 'babyPhoto': // Babyfoto-Upload (nur wenn Baby bereits geboren ist)
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Image
              source={require('@/assets/images/Baby_Take_Pic.png')}
              style={styles.babyTakePicImage}
              resizeMode="contain"
            />
            <ThemedText style={styles.stepTitle}>Möchtest du ein Bild deines Babys hochladen?</ThemedText>
            <View style={styles.booleanButtonsContainer}>
              <TouchableOpacity
                style={[styles.booleanButton, wantsBabyPhotoUpload === true && styles.booleanButtonActive]}
                onPress={() => setWantsBabyPhotoUpload(true)}
              >
                <ThemedText style={[styles.booleanButtonText, wantsBabyPhotoUpload === true && styles.booleanButtonTextActive]}>Ja</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.booleanButton, wantsBabyPhotoUpload === false && styles.booleanButtonActive]}
                onPress={() => {
                  setWantsBabyPhotoUpload(false);
                  setBabyPhotoUrl(null);
                }}
              >
                <ThemedText style={[styles.booleanButtonText, wantsBabyPhotoUpload === false && styles.booleanButtonTextActive]}>Nein</ThemedText>
              </TouchableOpacity>
            </View>

            {wantsBabyPhotoUpload === true && (
              <View style={styles.photoUploadContainer}>
                {babyPhotoUrl ? (
                  <Image source={{ uri: babyPhotoUrl }} style={styles.onboardingBabyPhoto} />
                ) : (
                  <View style={styles.onboardingPhotoPlaceholder}>
                    <IconSymbol name="photo" size={28} color={theme.tabIconDefault} />
                    <ThemedText style={styles.onboardingPhotoPlaceholderText}>Noch kein Foto ausgewählt</ThemedText>
                  </View>
                )}

                <TouchableOpacity style={styles.photoUploadButton} onPress={pickBabyPhoto}>
                  <ThemedText style={styles.photoUploadButtonText}>
                    {babyPhotoUrl ? 'Foto ändern' : 'Foto auswählen'}
                  </ThemedText>
                </TouchableOpacity>

                {!!babyPhotoUrl && (
                  <TouchableOpacity style={styles.photoRemoveButton} onPress={() => setBabyPhotoUrl(null)}>
                    <ThemedText style={styles.photoRemoveButtonText}>Foto entfernen</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ThemedView>
        );

      case 'summary': // Zusammenfassung und Speichern
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <ThemedText style={styles.stepTitle}>Zusammenfassung</ThemedText>

            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Name:</ThemedText>
              <ThemedText style={styles.summaryValue}>{firstName} {lastName}</ThemedText>
            </View>

            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Rolle:</ThemedText>
              <ThemedText style={styles.summaryValue}>{userRole === 'mama' ? 'Mama' : userRole === 'papa' ? 'Papa' : 'Nicht festgelegt'}</ThemedText>
            </View>

            {invitationStatus === 'accepted' && (
              <>
                <View style={styles.summaryItem}>
                  <ThemedText style={styles.summaryLabel}>Verknüpfung:</ThemedText>
                  <ThemedText style={styles.summaryValue}>
                    {invitationInfo?.partnerName
                      ? `Verbunden mit ${invitationInfo.partnerName}`
                      : 'Partnerkonto verknüpft'}
                  </ThemedText>
                </View>
                {invitationInfo?.dueDate && (
                  <View style={styles.summaryItem}>
                    <ThemedText style={styles.summaryLabel}>Gemeinsamer Termin:</ThemedText>
                    <ThemedText style={styles.summaryValue}>
                      {formatDate(parseSafeDate(invitationInfo.dueDate))}
                    </ThemedText>
                  </View>
                )}
              </>
            )}

            {invitationStatus !== 'accepted' && (
              <>
                <View style={styles.summaryItem}>
                  <ThemedText style={styles.summaryLabel}>Baby geboren:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{isBabyBorn ? 'Ja' : 'Nein'}</ThemedText>
                </View>

                {isBabyBorn === false && (
                  <View style={styles.summaryItem}>
                    <ThemedText style={styles.summaryLabel}>Errechneter Geburtstermin:</ThemedText>
                    <ThemedText style={styles.summaryValue}>{dueDate ? formatDate(dueDate) : 'Nicht festgelegt'}</ThemedText>
                  </View>
                )}

                {isBabyBorn && (
                  <View style={styles.summaryItem}>
                    <ThemedText style={styles.summaryLabel}>Geburtsdatum:</ThemedText>
                    <ThemedText style={styles.summaryValue}>{birthDate ? formatDate(birthDate) : 'Nicht festgelegt'}</ThemedText>
                  </View>
                )}

                <View style={styles.summaryItem}>
                  <ThemedText style={styles.summaryLabel}>Baby-Name:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{babyName || 'Nicht festgelegt'}</ThemedText>
                </View>

                <View style={styles.summaryItem}>
                  <ThemedText style={styles.summaryLabel}>Geschlecht:</ThemedText>
                  <ThemedText style={styles.summaryValue}>
                    {babyGender === 'male' ? 'Junge' : babyGender === 'female' ? 'Mädchen' : 'Noch nicht bekannt'}
                  </ThemedText>
                </View>

                {isBabyBorn && (
                  <View style={styles.summaryItem}>
                    <ThemedText style={styles.summaryLabel}>Babyfoto:</ThemedText>
                    <ThemedText style={styles.summaryValue}>
                      {babyPhotoUrl ? 'Hochgeladen' : 'Nicht hochgeladen'}
                    </ThemedText>
                  </View>
                )}
              </>
            )}

            <ThemedText style={styles.summaryNote}>
              Du kannst diese Informationen später in deinem Profil ändern.
            </ThemedText>
          </ThemedView>
        );

      default:
        return null;
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/Background_Hell.png')}
      style={styles.backgroundImage}
      resizeMode="repeat"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />
          <StatusBar hidden={true} />

          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Willkommen!
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Lass uns dein Profil einrichten
            </ThemedText>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${(currentStep + 1) / totalSteps * 100}%` }]}
              />
            </View>
            <ThemedText style={styles.progressText}>
              Schritt {currentStep + 1} von {totalSteps}
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={styles.loadingText}>Lade Daten...</ThemedText>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={styles.keyboardAvoidingView}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="never"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.content}>
                  {renderCurrentStep()}

                  <View style={styles.buttonsContainer}>
                    {currentStep > 0 && (
                      <TouchableOpacity
                        style={styles.backButton}
                        onPress={goToPreviousStep}
                      >
                        <IconSymbol name="chevron.left" size={20} color={theme.text} />
                        <ThemedText style={styles.backButtonText}>Zurück</ThemedText>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.nextButton, (isSaving || isRedeemingInvitation) && styles.buttonDisabled]}
                      onPress={goToNextStep}
                      disabled={isSaving || isRedeemingInvitation}
                    >
                      <ThemedText style={styles.nextButtonText}>
                        {currentStep === totalSteps - 1 ? (isSaving ? 'Speichern...' : 'Fertig') : 'Weiter'}
                      </ThemedText>
                      {currentStep < totalSteps - 1 && (
                        <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID={invitationAccessoryViewID}>
              <View style={styles.keyboardAccessory}>
                <TouchableOpacity onPress={Keyboard.dismiss} style={styles.keyboardAccessoryButton}>
                  <ThemedText style={styles.keyboardAccessoryButtonText}>Fertig</ThemedText>
                </TouchableOpacity>
              </View>
            </InputAccessoryView>
          )}
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
    paddingTop: 20,
    paddingBottom: 12,
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
    marginBottom: 20,
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
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
  summaryItem: {
    marginBottom: 15,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#7D5A50',
    opacity: 0.8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  summaryNote: {
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#7D5A50',
    opacity: 0.7,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 30,
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
