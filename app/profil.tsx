import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Switch,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Redirect, router, Stack } from 'expo-router';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Header from '@/components/Header';
import TextInputOverlay from '@/components/modals/TextInputOverlay';

import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { LiquidGlassCard, GLASS_OVERLAY, GLASS_OVERLAY_DARK, LAYOUT_PAD } from '@/constants/DesignGuide';

import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useConvex } from '@/contexts/ConvexContext';
import { supabase } from '@/lib/supabase';
import { getBabyInfo, saveBabyInfo } from '@/lib/baby';
import { setLocalProfileName } from '@/lib/localProfile';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfileAvatar, deleteProfileAvatar, deleteUserAccount } from '@/lib/profile';
import { compressImage } from '@/lib/imageCompression';

const { width: screenWidth } = Dimensions.get('window');
const PRIMARY_TEXT = '#7D5A50';
const ACCENT_PURPLE = '#8E4EC6'; // Sleep-Tracker Akzent
const BABY_BLUE = '#87CEEB';
const BABY_PINK = '#FFB3C1';

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const lightenHex = (hex: string, amount = 0.35) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');

  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

const MIN_VALID_PROFILE_DATE_YEAR = 2000;
const MIN_VALID_PROFILE_DATE = new Date(MIN_VALID_PROFILE_DATE_YEAR, 0, 1);

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

  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < MIN_VALID_PROFILE_DATE_YEAR) {
    return null;
  }

  return parsed;
};

export default function ProfilScreen() {
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;

  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const glassBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)';
  const glassBorderStrong = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.85)';
  const glassSurface = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)';
  const glassSurfaceSoft = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)';
  const glassSurfaceButton = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.5)';
  const accentPurple = isDark ? lightenHex(ACCENT_PURPLE) : ACCENT_PURPLE;
  const babyBlue = isDark ? lightenHex(BABY_BLUE) : BABY_BLUE;
  const babyPink = isDark ? lightenHex(BABY_PINK) : BABY_PINK;
  const loadingAccent = adaptiveColors.accent;
  const saveCardBackground = isDark ? toRgba(accentPurple, 0.22) : 'rgba(220,200,255,0.6)';
  const securityCardBackground = isDark ? toRgba(babyBlue, 0.2) : 'rgba(135,206,235,0.45)';
  const dangerCardBackground = isDark ? 'rgba(255,107,107,0.22)' : 'rgba(255,130,130,0.5)';
  const actionDisabledBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(168,168,168,0.5)';
  const { user, session, signOut } = useAuth();
  const { refreshBabyDetails } = useBabyStatus();
  const { activeBabyId, refreshBabies } = useActiveBaby();
  const { syncUser } = useConvex();

  // Benutzerinformationen
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [userRole, setUserRole]   = useState<'mama' | 'papa' | ''>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  // Baby-Informationen
  const [babyName, setBabyName]         = useState('');
  const [babyGender, setBabyGender]     = useState<'male' | 'female' | ''>('');
  const [isBabyBornForActiveBaby, setIsBabyBornForActiveBaby] = useState(false);
  const [dueDate, setDueDate]           = useState<Date | null>(null);
  const [birthDate, setBirthDate]       = useState<Date | null>(null);
  const [babyWeight, setBabyWeight]     = useState('');
  const [babyHeight, setBabyHeight]     = useState('');
  const [babyPhotoUrl, setBabyPhotoUrl] = useState<string | null>(null);
  const [babyPhotoPreview, setBabyPhotoPreview] = useState<string | null>(null);
  const [babyPhotoBase64, setBabyPhotoBase64] = useState<string | null>(null);
  const [babyPhotoRemoved, setBabyPhotoRemoved] = useState(false);

  // UI
  const [isLoading, setIsLoading]                   = useState(true);
  const [showDueDatePicker, setShowDueDatePicker]   = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [isSaving, setIsSaving]                     = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar]     = useState(false);
  const [isDeletingProfile, setIsDeletingProfile]   = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailOverlayVisible, setEmailOverlayVisible] = useState(false);
  const [emailOverlayValue, setEmailOverlayValue] = useState('');
  const latestLoadRequestIdRef = useRef(0);

  useEffect(() => {
    if (user) loadUserData();
    else setIsLoading(false);
  }, [user, activeBabyId]);

  const loadUserData = async () => {
    const requestId = ++latestLoadRequestIdRef.current;
    try {
      setIsLoading(true);

      if (!user) {
        if (requestId === latestLoadRequestIdRef.current) {
          setIsLoading(false);
        }
        return;
      }

      const userId = user.id;

      if (user.email) setEmail(user.email);

      // Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, user_role, avatar_url')
        .eq('id', userId)
        .single();

      if (!profileError && profileData) {
        if (requestId !== latestLoadRequestIdRef.current) return;
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
        setUserRole((profileData.user_role as any) || '');
        setAvatarUrl(profileData.avatar_url || null);
        setAvatarPreview(profileData.avatar_url || null);
        setAvatarRemoved(false);
        await setLocalProfileName(
          userId,
          profileData.first_name || '',
          profileData.last_name || '',
        );
      }

      // Settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('due_date, is_baby_born')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestId !== latestLoadRequestIdRef.current) return;
      setDueDate(parseSafeDate(settingsData?.due_date));

      // Baby info
      const { data: babyData } = await getBabyInfo(activeBabyId ?? undefined);
      if (requestId !== latestLoadRequestIdRef.current) return;
      if (babyData) {
        const parsedBirthDate = parseSafeDate(babyData.birth_date);
        setBabyName(babyData.name || '');
        setBabyGender(babyData.baby_gender || '');
        setBabyWeight(babyData.weight || '');
        setBabyHeight(babyData.height || '');
        setBabyPhotoUrl(babyData.photo_url || null);
        setBabyPhotoPreview(babyData.photo_url || null);
        setBabyPhotoBase64(null);
        setBabyPhotoRemoved(false);
        setBirthDate(parsedBirthDate);
        setIsBabyBornForActiveBaby(Boolean(parsedBirthDate));
      } else {
        setBabyName('');
        setBabyGender('');
        setBabyWeight('');
        setBabyHeight('');
        setBabyPhotoUrl(null);
        setBabyPhotoPreview(null);
        setBabyPhotoBase64(null);
        setBabyPhotoRemoved(false);
        setBirthDate(null);
        setIsBabyBornForActiveBaby(false);
      }
    } catch (e) {
      console.error(e);
      if (requestId === latestLoadRequestIdRef.current) {
        Alert.alert('Fehler', 'Deine Daten konnten nicht geladen werden.');
      }
    } finally {
      if (requestId === latestLoadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const pickAvatarImage = async () => {
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

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64String = asset.base64;

        if (!base64String && asset.uri) {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          base64String = await new Promise<string | null>((resolve, reject) => {
            reader.onload = () => {
              resolve(reader.result as string);
            };
            reader.onerror = () => reject(null);
            reader.readAsDataURL(blob);
          });
        }

        setAvatarPreview(asset.uri || avatarUrl);
        setAvatarBase64(base64String || null);
        setAvatarRemoved(false);
      }
    } catch (error) {
      console.error('Error picking avatar image:', error);
      Alert.alert('Fehler', 'Das Profilbild konnte nicht ausgewählt werden.');
    }
  };

  const removeAvatarImage = (markRemoved = true) => {
    setAvatarPreview(null);
    setAvatarBase64(null);
    setAvatarUrl(null);
    setAvatarRemoved(markRemoved);
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
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64Data: string | null = null;

        if (asset.base64) {
          base64Data = `data:image/jpeg;base64,${asset.base64}`;
        } else if (asset.uri) {
          try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const reader = new FileReader();
            base64Data = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error('Fehler bei der Bildkonvertierung:', error);
            Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
            return;
          }
        }

        if (!base64Data) {
          Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
          return;
        }

        setBabyPhotoPreview(base64Data);
        setBabyPhotoBase64(base64Data);
        setBabyPhotoUrl(null);
        setBabyPhotoRemoved(false);
      }
    } catch (error) {
      console.error('Error picking baby photo:', error);
      Alert.alert('Fehler', 'Das Babyfoto konnte nicht ausgewählt werden.');
    }
  };

  const removeBabyPhoto = () => {
    setBabyPhotoPreview(null);
    setBabyPhotoBase64(null);
    setBabyPhotoUrl(null);
    setBabyPhotoRemoved(true);
  };

  const handleAvatarDeletePress = () => {
    if (!avatarUrl || isDeletingAvatar) return;
    const urlToDelete = avatarUrl;
    Alert.alert(
      'Profilbild löschen',
      'Möchtest du dein aktuelles Profilbild wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => deleteAvatarFromServer(urlToDelete) },
      ],
    );
  };

  const deleteAvatarFromServer = async (url: string) => {
    try {
      setIsDeletingAvatar(true);
      const { error } = await deleteProfileAvatar(url);
      if (error) throw error;
      removeAvatarImage(false);
      Alert.alert('Profilbild gelöscht', 'Dein Profilbild wurde entfernt.');
    } catch (error) {
      console.error('Error deleting profile avatar:', error);
      Alert.alert('Fehler', 'Das Profilbild konnte nicht gelöscht werden.');
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const handleDeleteProfileRequest = () => {
    if (isDeletingProfile) return;
    Alert.alert(
      'Profil & Konto löschen',
      'Möchtest du dein Profil und dein Konto wirklich löschen? Alle gespeicherten Daten werden dauerhaft entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: deleteProfileAndSignOut },
      ],
    );
  };

  const deleteProfileAndSignOut = async () => {
    if (!user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um dein Profil zu löschen.');
      return;
    }
    try {
      setIsDeletingProfile(true);
      const { error } = await deleteUserAccount({ avatarUrl });
      if (error) throw error;
      setIsDeletingProfile(false);
      Alert.alert(
        'Konto gelöscht',
        'Dein Profil und Konto wurden gelöscht. Du wirst jetzt abgemeldet.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await signOut();
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error deleting profile:', error);
      setIsDeletingProfile(false);
      Alert.alert('Fehler', 'Dein Profil konnte nicht gelöscht werden.');
    }
  };

  const sendPasswordResetEmail = async () => {
    if (!user?.email) {
      Alert.alert('Fehler', 'Keine E-Mail-Adresse gefunden.');
      return;
    }
    if (isSendingPasswordReset) return;

    try {
      setIsSendingPasswordReset(true);
      const redirectTo = Linking.createURL('auth/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
      if (error) throw error;

      Alert.alert(
        'E-Mail gesendet',
        'Wir haben dir eine E-Mail mit einem Link zum Ändern deines Passworts geschickt. Bitte prüfe deinen Posteingang (ggf. auch Spam).',
      );
    } catch (error: any) {
      console.error('Failed to send password reset email:', error);
      Alert.alert(
        'Fehler',
        error?.message || 'Die E-Mail zum Passwort-Reset konnte nicht gesendet werden.',
      );
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const handlePasswordChangePress = () => {
    if (!user?.email) {
      Alert.alert('Fehler', 'Keine E-Mail-Adresse gefunden.');
      return;
    }

    Alert.alert(
      'Passwort ändern',
      'Wir senden dir eine Bestätigungs-E-Mail mit einem Link zum Ändern deines Passworts.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'E-Mail senden', onPress: sendPasswordResetEmail },
      ],
    );
  };

  const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const requestEmailChange = (nextEmailRaw: string) => {
    if (!user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um deine E-Mail zu ändern.');
      return;
    }

    const nextEmail = nextEmailRaw.trim().toLowerCase();
    if (!nextEmail) {
      Alert.alert('Hinweis', 'Bitte gib eine E-Mail-Adresse ein.');
      return;
    }
    if (!isLikelyEmail(nextEmail)) {
      Alert.alert('Hinweis', 'Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    if (user.email && nextEmail === user.email.trim().toLowerCase()) {
      Alert.alert('Hinweis', 'Diese E-Mail ist bereits hinterlegt.');
      return;
    }

    setEmailOverlayVisible(false);

    Alert.alert(
      'E-Mail ändern',
      `Möchtest du deine E-Mail-Adresse auf\n${nextEmail}\nändern?\n\nWir senden dir eine Bestätigungs-E-Mail an die neue Adresse.`,
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
          onPress: () => {
            setEmailOverlayValue(nextEmail);
            setEmailOverlayVisible(true);
          },
        },
        {
          text: 'E-Mail ändern',
          onPress: () => updateEmail(nextEmail),
        },
      ],
    );
  };

  const updateEmail = async (nextEmail: string) => {
    if (!user) return;
    if (isUpdatingEmail) return;

    try {
      setIsUpdatingEmail(true);
      const emailRedirectTo = Linking.createURL('auth/callback');
      const { error } = await supabase.auth.updateUser(
        { email: nextEmail },
        { emailRedirectTo },
      );
      if (error) throw error;

      Alert.alert(
        'Fast fertig',
        `Wir haben dir eine Bestätigungs-E-Mail an ${nextEmail} gesendet.\n\nBitte öffne den Link in der E-Mail, um die Änderung abzuschließen.`,
      );
    } catch (error: any) {
      console.error('Failed to update email:', error);
      Alert.alert(
        'Fehler',
        error?.message || 'Die E-Mail konnte nicht geändert werden. Bitte versuche es später erneut.',
      );
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const saveUserData = async () => {
    if (!user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um deine Daten zu speichern.');
      return;
    }

    setIsSaving(true);

    let finalAvatarUrl = avatarUrl;
    let finalBabyPhoto = babyPhotoUrl;
    const dueDateForSave = parseSafeDate(dueDate);
    const birthDateForSave = parseSafeDate(birthDate);

    try {
      if (avatarBase64) {
        const uploadResult = await uploadProfileAvatar(avatarBase64);
        if (uploadResult.error) throw uploadResult.error;
        finalAvatarUrl = uploadResult.url;
      } else if (avatarRemoved) {
        finalAvatarUrl = null;
      }

      if (babyPhotoBase64) {
        // Babyfotos ebenfalls verkleinern (max ~900px, moderat komprimiert)
        const { dataUrl } = await compressImage(
          { base64: babyPhotoBase64 },
          { maxDimension: 900, quality: 0.65 }
        );
        finalBabyPhoto = dataUrl;
      } else if (babyPhotoRemoved) {
        finalBabyPhoto = null;
      }

      // profiles upsert
      const { data: existingProfile } = await supabase
        .from('profiles').select('id').eq('id', user.id).maybeSingle();

      let profileResult;
      if (existingProfile?.id) {
        profileResult = await supabase.from('profiles').update({
          first_name: firstName,
          last_name: lastName,
          user_role: userRole,
          avatar_url: finalAvatarUrl || null,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      } else {
        profileResult = await supabase.from('profiles').insert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          user_role: userRole,
          avatar_url: finalAvatarUrl || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (profileResult.error) throw profileResult.error;
      await setLocalProfileName(user.id, firstName, lastName);

      // user_settings upsert
      const { data: existingSettings } = await supabase
        .from('user_settings').select('id').eq('user_id', user.id).maybeSingle();

      let settingsResult;
      const base = {
        due_date: dueDateForSave ? dueDateForSave.toISOString() : null,
        is_baby_born: isBabyBornForActiveBaby,
        theme: 'light',
        notifications_enabled: true,
        updated_at: new Date().toISOString(),
      };
      if (existingSettings?.id) {
        settingsResult = await supabase.from('user_settings')
          .update(base).eq('id', existingSettings.id);
      } else {
        settingsResult = await supabase.from('user_settings')
          .insert({ user_id: user.id, ...base });
      }
      if (settingsResult.error) throw settingsResult.error;

      // baby info
      const { error: babyError } = await saveBabyInfo(
        {
          name: babyName,
          baby_gender: babyGender,
          birth_date: isBabyBornForActiveBaby && birthDateForSave ? birthDateForSave.toISOString() : null,
          weight: babyWeight,
          height: babyHeight,
          photo_url: finalBabyPhoto,
        },
        activeBabyId ?? undefined
      );
      if (babyError) throw babyError;
      await refreshBabyDetails();
      await refreshBabies();
      void syncUser();

      Alert.alert('Erfolg', 'Deine Daten wurden erfolgreich gespeichert.', [
        { text: 'OK', onPress: () => router.push('/more') },
      ]);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Fehler', e?.message || 'Deine Daten konnten nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
      setAvatarUrl(finalAvatarUrl || null);
      setAvatarPreview(finalAvatarUrl || null);
      setAvatarBase64(null);
      setAvatarRemoved(false);
      setBabyPhotoUrl(finalBabyPhoto || null);
      setBabyPhotoPreview(finalBabyPhoto || null);
      setBabyPhotoBase64(null);
      setBabyPhotoRemoved(false);
    }
  };

  const formatDate = (date: Date | null) => {
    const parsed = parseSafeDate(date);
    return !parsed
      ? 'Nicht festgelegt'
      : parsed.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleDueDateChange = (_: any, selectedDate?: Date) => {
    setShowDueDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDueDate(parseSafeDate(selectedDate));
  };
  const handleBirthDateChange = (_: any, selectedDate?: Date) => {
    setShowBirthDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const safeDate = parseSafeDate(selectedDate);
      setBirthDate(safeDate);
      setIsBabyBornForActiveBaby(Boolean(safeDate));
    }
  };
  const handleBabyBornChange = (value: boolean) => {
    setIsBabyBornForActiveBaby(value);
    if (!value) setBirthDate(null);
  };
  const dueDateForDisplay = parseSafeDate(dueDate);
  const birthDateForDisplay = parseSafeDate(birthDate);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden />

          <Header
            title="Profil"
            subtitle="Persönliche Daten und Babyinfos"
            showBackButton
            onBackPress={() => router.push('/more')}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={loadingAccent} />
                <ThemedText style={[styles.loadingText, { color: textPrimary }]}>Lade Daten...</ThemedText>
              </View>
            ) : (
              <>
                {/* Persönliche Daten */}
                <LiquidGlassCard
                  style={[
                    styles.sectionCard,
                    isDark && { backgroundColor: 'rgba(0,0,0,0.35)' },
                  ]}
                  intensity={26}
                  overlayColor={glassOverlay}
                  borderColor={glassBorder}
                >
                  <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Persönliche Daten</ThemedText>
                  <View style={styles.avatarSelector}>
                    <TouchableOpacity
                      style={[
                        styles.avatarPreviewWrapper,
                        { backgroundColor: glassSurface, borderColor: glassBorderStrong, borderWidth: 1.5 },
                      ]}
                      onPress={pickAvatarImage}
                      activeOpacity={0.8}
                    >
                      {avatarPreview ? (
                        <CachedImage
                          uri={avatarPreview}
                          style={styles.avatarPreviewImage}
                          showLoader={false}
                        />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: glassSurfaceSoft, borderColor: glassBorder }]}>
                          <IconSymbol name="camera" size={30} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={styles.avatarActions}>
                      <TouchableOpacity style={styles.avatarActionButton} onPress={pickAvatarImage}>
                        <ThemedText style={[styles.avatarActionText, { color: textPrimary }]}>Foto wählen</ThemedText>
                      </TouchableOpacity>
                      {!!avatarPreview && (
                        <TouchableOpacity style={styles.avatarActionButton} onPress={() => removeAvatarImage()}>
                          <ThemedText style={[styles.avatarActionText, { color: textPrimary }]}>Foto entfernen</ThemedText>
                        </TouchableOpacity>
                      )}
                      {!!avatarUrl && (
                        <TouchableOpacity
                          style={styles.avatarActionButton}
                          onPress={handleAvatarDeletePress}
                          disabled={isDeletingAvatar}
                        >
                          {isDeletingAvatar ? (
                            <ActivityIndicator size="small" color="#FF6B6B" />
                          ) : (
                            <ThemedText style={[styles.avatarActionText, styles.avatarDeleteText]}>
                              Foto löschen
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardInner}>
                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>E-Mail</ThemedText>
                      <TextInput
                        style={[
                          styles.inputGlass,
                          styles.inputDisabled,
                          { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary },
                        ]}
                        value={email}
                        editable={false}
                        placeholder="Deine E-Mail-Adresse"
                        placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                      />
                      <View style={styles.inlineActions}>
                        <TouchableOpacity
                          style={[
                            styles.inlineActionButton,
                            { borderColor: glassBorder, backgroundColor: glassSurfaceSoft },
                          ]}
                          onPress={() => {
                            setEmailOverlayValue(user?.new_email || '');
                            setEmailOverlayVisible(true);
                          }}
                          activeOpacity={0.9}
                          disabled={isUpdatingEmail}
                        >
                          {isUpdatingEmail ? (
                            <ActivityIndicator size="small" color={accentPurple} />
                          ) : (
                            <IconSymbol name="envelope.fill" size={18} color={accentPurple} />
                          )}
                          <ThemedText style={[styles.inlineActionText, { color: textPrimary }]}>E-Mail ändern</ThemedText>
                        </TouchableOpacity>
                      </View>
                      {!!user?.new_email && user?.new_email !== user?.email && (
                        <ThemedText style={[styles.helperText, { color: textPrimary }]}>
                          Neue E-Mail ausstehend: {user.new_email} (bitte bestätigen)
                        </ThemedText>
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>Vorname</ThemedText>
                      <TextInput
                        style={[styles.inputGlass, { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary }]}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="Dein Vorname"
                        placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>Nachname</ThemedText>
                      <TextInput
                        style={[styles.inputGlass, { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary }]}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Dein Nachname"
                        placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>Rolle</ThemedText>
                      <View style={styles.duoRow}>
                        <TouchableOpacity
                          style={[
                            styles.pickButton,
                            { borderColor: glassBorder, backgroundColor: glassSurfaceButton },
                            userRole === 'mama' && [styles.pickButtonActive, { backgroundColor: accentPurple, borderColor: glassBorderStrong }],
                          ]}
                          onPress={() => setUserRole('mama')}
                          activeOpacity={0.9}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={24}
                            color={userRole === 'mama' ? '#FFFFFF' : textSecondary}
                          />
                          <ThemedText
                            style={[
                              styles.pickButtonText,
                              { color: textSecondary },
                              userRole === 'mama' && styles.pickButtonTextActive,
                            ]}
                          >
                            Mama
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.pickButton,
                            { borderColor: glassBorder, backgroundColor: glassSurfaceButton },
                            userRole === 'papa' && [styles.pickButtonActive, { backgroundColor: accentPurple, borderColor: glassBorderStrong }],
                          ]}
                          onPress={() => setUserRole('papa')}
                          activeOpacity={0.9}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={24}
                            color={userRole === 'papa' ? '#FFFFFF' : textSecondary}
                          />
                          <ThemedText
                            style={[
                              styles.pickButtonText,
                              { color: textSecondary },
                              userRole === 'papa' && styles.pickButtonTextActive,
                            ]}
                          >
                            Papa
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </LiquidGlassCard>

                {/* Baby-Infos */}
                <LiquidGlassCard
                  style={[
                    styles.sectionCard,
                    isDark && { backgroundColor: 'rgba(0,0,0,0.35)' },
                  ]}
                  intensity={26}
                  overlayColor={glassOverlay}
                  borderColor={glassBorder}
                >
                  <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Baby-Informationen</ThemedText>
                  <View style={styles.cardInner}>
                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>Babyfoto</ThemedText>
                      <View style={styles.babyPhotoSelector}>
                        {babyPhotoPreview ? (
                          <CachedImage uri={babyPhotoPreview} style={styles.babyPhotoPreview} showLoader={false} />
                        ) : (
                          <View style={[styles.babyPhotoPlaceholder, { backgroundColor: glassSurfaceSoft, borderColor: glassBorder }]}>
                            <IconSymbol name="person.fill" size={40} color="#FFFFFF" />
                          </View>
                        )}
                        <View style={styles.babyPhotoActions}>
                          <TouchableOpacity
                            style={[styles.babyPhotoActionButton, { borderColor: glassBorder, backgroundColor: glassSurfaceSoft }]}
                            onPress={pickBabyPhoto}
                            activeOpacity={0.9}
                            disabled={isSaving}
                          >
                            <ThemedText style={[styles.babyPhotoActionText, { color: textPrimary }]}>Foto wählen</ThemedText>
                          </TouchableOpacity>
                          {!!babyPhotoPreview && (
                            <TouchableOpacity
                              style={[styles.babyPhotoActionButton, { borderColor: glassBorder, backgroundColor: glassSurfaceSoft }]}
                              onPress={removeBabyPhoto}
                              activeOpacity={0.9}
                              disabled={isSaving}
                            >
                              <ThemedText style={[styles.babyPhotoActionText, { color: textPrimary }]}>Foto entfernen</ThemedText>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>Errechneter Geburtstermin</ThemedText>
                      <TouchableOpacity
                        style={[styles.dateButtonGlass, { borderColor: glassBorder, backgroundColor: glassSurface, shadowColor: 'transparent' }]}
                        onPress={() => setShowDueDatePicker(true)}
                        activeOpacity={0.9}
                      >
                        <ThemedText style={[styles.dateButtonText, { color: textPrimary }]}>
                          {dueDateForDisplay ? formatDate(dueDateForDisplay) : 'Geburtstermin auswählen'}
                        </ThemedText>
                        <IconSymbol name="calendar" size={20} color={textSecondary} />
                      </TouchableOpacity>
                      {showDueDatePicker && (
                        <DateTimePicker
                          value={dueDateForDisplay || new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'compact' : 'default'}
                          onChange={handleDueDateChange}
                          minimumDate={MIN_VALID_PROFILE_DATE}
                        />
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>Baby bereits geboren?</ThemedText>
                      <View style={styles.switchContainer}>
                        <ThemedText style={[styles.switchLabel, { color: textPrimary }]}>
                          {isBabyBornForActiveBaby ? 'Ja' : 'Nein'}
                        </ThemedText>
                        <Switch
                          value={isBabyBornForActiveBaby}
                          onValueChange={handleBabyBornChange}
                          disabled={isSaving}
                          trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                          thumbColor={isBabyBornForActiveBaby ? '#FFFFFF' : '#F4F4F4'}
                          ios_backgroundColor="#D1D1D6"
                        />
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>Name des Babys</ThemedText>
                      <TextInput
                        style={[styles.inputGlass, { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary }]}
                        value={babyName}
                        onChangeText={setBabyName}
                        placeholder="Name deines Babys"
                        placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>Geschlecht</ThemedText>
                      <View style={styles.duoRow}>
                        <TouchableOpacity
                          style={[
                            styles.pickButton,
                            { borderColor: glassBorder, backgroundColor: glassSurfaceButton },
                            babyGender === 'male' && [styles.pickButtonActive, { backgroundColor: babyBlue, borderColor: glassBorderStrong }],
                          ]}
                          onPress={() => setBabyGender('male')}
                          activeOpacity={0.9}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={24}
                            color={babyGender === 'male' ? '#FFFFFF' : textSecondary}
                          />
                          <ThemedText
                            style={[
                              styles.pickButtonText,
                              { color: textSecondary },
                              babyGender === 'male' && styles.pickButtonTextActive,
                            ]}
                          >
                            Junge
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.pickButton,
                            { borderColor: glassBorder, backgroundColor: glassSurfaceButton },
                            babyGender === 'female' && [styles.pickButtonActive, { backgroundColor: babyPink, borderColor: glassBorderStrong }],
                          ]}
                          onPress={() => setBabyGender('female')}
                          activeOpacity={0.9}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={24}
                            color={babyGender === 'female' ? '#FFFFFF' : textSecondary}
                          />
                          <ThemedText
                            style={[
                              styles.pickButtonText,
                              { color: textSecondary },
                              babyGender === 'female' && styles.pickButtonTextActive,
                            ]}
                          >
                            Mädchen
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {isBabyBornForActiveBaby && (
                      <>
                        <View style={styles.formGroup}>
                          <ThemedText style={[styles.label, { color: textPrimary }]}>Geburtsdatum</ThemedText>
                          <TouchableOpacity
                            style={[
                              styles.dateButtonGlass,
                              { borderColor: glassBorder, backgroundColor: glassSurface, shadowColor: 'transparent' },
                            ]}
                            onPress={() => setShowBirthDatePicker(true)}
                            activeOpacity={0.9}
                          >
                            <ThemedText style={[styles.dateButtonText, { color: textPrimary }]}>
                              {birthDateForDisplay ? formatDate(birthDateForDisplay) : 'Geburtsdatum auswählen'}
                            </ThemedText>
                            <IconSymbol name="calendar" size={20} color={textSecondary} />
                          </TouchableOpacity>
                          {showBirthDatePicker && (
                            <DateTimePicker
                              value={birthDateForDisplay || new Date()}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'compact' : 'default'}
                              onChange={handleBirthDateChange}
                              minimumDate={MIN_VALID_PROFILE_DATE}
                              maximumDate={new Date()}
                            />
                          )}
                        </View>

                        <View style={styles.formRow2}>
                          <View style={[styles.formGroup, { flex: 1 }]}>
                            <ThemedText style={[styles.label, { color: textPrimary }]}>Geburtsgewicht (g)</ThemedText>
                            <TextInput
                              style={[
                                styles.inputGlass,
                                styles.numeric,
                                { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary },
                              ]}
                              value={babyWeight}
                              onChangeText={setBabyWeight}
                              placeholder="z.B. 3500"
                              placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                              keyboardType="numeric"
                            />
                          </View>

                          <View style={[styles.formGroup, { flex: 1 }]}>
                            <ThemedText style={[styles.label, { color: textPrimary }]}>Größe (cm)</ThemedText>
                            <TextInput
                              style={[
                                styles.inputGlass,
                                styles.numeric,
                                { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary },
                              ]}
                              value={babyHeight}
                              onChangeText={setBabyHeight}
                              placeholder="z.B. 52"
                              placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </LiquidGlassCard>

                {/* Speichern – im Action-Card Look */}
                <View>
                  <TouchableOpacity
                    onPress={saveUserData}
                    activeOpacity={0.9}
                    disabled={isSaving}
                    style={{ borderRadius: 22, overflow: 'hidden', marginTop: 12 }}
                  >
                    <BlurView intensity={24} tint={isDark ? 'dark' : 'light'} style={{ borderRadius: 22, overflow: 'hidden' }}>
                      <View
                        style={[
                          styles.saveCard,
                          { backgroundColor: isSaving ? actionDisabledBackground : saveCardBackground },
                        ]}
                      >
                        <View style={[styles.saveIconWrap, { backgroundColor: accentPurple }]}>
                          {isSaving ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <IconSymbol name="tray.and.arrow.down.fill" size={26} color="#FFFFFF" />
                          )}
                        </View>
                        <ThemedText style={[styles.saveTitle, { color: textPrimary }]}>
                          {isSaving ? 'Speichern…' : 'Änderungen speichern'}
                        </ThemedText>
                        <ThemedText style={[styles.saveSub, { color: textPrimary }]}>Deine Daten sicher aktualisieren</ThemedText>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                </View>

                {/* Sicherheit */}
                <View>
                  <TouchableOpacity
                    onPress={handlePasswordChangePress}
                    activeOpacity={0.9}
                    disabled={isSendingPasswordReset}
                    style={{ borderRadius: 22, overflow: 'hidden', marginTop: 12 }}
                  >
                    <BlurView intensity={24} tint={isDark ? 'dark' : 'light'} style={{ borderRadius: 22, overflow: 'hidden' }}>
                      <View
                        style={[
                          styles.saveCard,
                          { backgroundColor: isSendingPasswordReset ? actionDisabledBackground : securityCardBackground },
                        ]}
                      >
                        <View style={[styles.saveIconWrap, { backgroundColor: babyBlue }]}>
                          {isSendingPasswordReset ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <ThemedText style={{ fontSize: 24, color: '#FFFFFF' }}>🔑</ThemedText>
                          )}
                        </View>
                        <ThemedText style={[styles.saveTitle, { color: textPrimary }]}>
                          {isSendingPasswordReset ? 'Sende E-Mail…' : 'Passwort ändern'}
                        </ThemedText>
                        <ThemedText style={[styles.saveSub, { color: textPrimary }]}>Bestätigungslink per E-Mail</ThemedText>
                      </View>
                    </BlurView>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleDeleteProfileRequest}
                    activeOpacity={0.9}
                    disabled={isDeletingProfile}
                    style={{ borderRadius: 22, overflow: 'hidden', marginTop: 12 }}
                  >
                    <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={{ borderRadius: 22, overflow: 'hidden' }}>
                      <View
                        style={[
                          styles.saveCard,
                          styles.dangerCard,
                          { backgroundColor: dangerCardBackground },
                        ]}
                      >
                        <View style={[styles.saveIconWrap, { backgroundColor: '#FF6B6B', borderColor: glassBorderStrong }]}>
                          {isDeletingProfile ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <IconSymbol name="trash.fill" size={24} color="#FFFFFF" />
                          )}
                        </View>
                        <ThemedText style={[styles.saveTitle, styles.dangerText, { color: '#FF6B6B' }]}>
                          {isDeletingProfile ? 'Profil wird gelöscht…' : 'Profil & Konto löschen'}
                        </ThemedText>
                        <ThemedText style={[styles.saveSub, styles.dangerSub, { color: textPrimary }]}>
                          Entfernt Profil, Konto und alle Daten dauerhaft
                        </ThemedText>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>

      <TextInputOverlay
        visible={emailOverlayVisible}
        label="Neue E-Mail-Adresse"
        value={emailOverlayValue}
        placeholder="deine@email.de"
        keyboardType="email-address"
        inputMode="email"
        accentColor={accentPurple}
        onClose={() => setEmailOverlayVisible(false)}
        onSubmit={(next) => requestEmailChange(next)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },

  // Scroll rhythm wie Sleep-Tracker
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 140,
    paddingTop: 10,
  },

  loadingContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: PRIMARY_TEXT },

  sectionCard: { marginBottom: 16, borderRadius: 22, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
    color: PRIMARY_TEXT,
    textAlign: 'center',
  },
  cardInner: { paddingHorizontal: 20, paddingBottom: 16 },

  formGroup: { marginBottom: 16 },
  formRow2: { flexDirection: 'row', gap: 12 },

  label: { fontSize: 14, marginBottom: 8, color: PRIMARY_TEXT, fontWeight: '700' },

  // Glas-Inputs wie Sleep-Tracker
  inputGlass: {
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: 'rgba(200,200,200,0.35)',
  },
  numeric: { fontVariant: ['tabular-nums'] },

  babyPhotoSelector: {
    alignItems: 'center',
    marginBottom: 8,
  },
  babyPhotoPreview: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 12,
  },
  babyPhotoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  babyPhotoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  babyPhotoActionButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
    marginBottom: 8,
  },
  babyPhotoActionText: {
    color: ACCENT_PURPLE,
    fontWeight: '700',
  },

  avatarSelector: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPreviewWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarPreviewImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D8D8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarActionButton: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  avatarActionText: {
    color: '#8E4EC6',
    fontWeight: '700',
  },
  avatarDeleteText: {
    color: '#FF6B6B',
  },

  // Glas-DateButton
  dateButtonGlass: {
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  dateButtonText: { fontSize: 16, color: '#333' },

  // Duo-Buttons (Rolle/Geschlecht) – Sleep-Tracker Look
  duoRow: { flexDirection: 'row', gap: 8 },
  pickButton: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pickButtonActive: {
    backgroundColor: ACCENT_PURPLE,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  pickButtonText: { fontSize: 16, color: '#7D7D85', fontWeight: '700' },
  pickButtonTextActive: { color: '#FFFFFF', fontWeight: '800' },

  // Switch
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16, color: PRIMARY_TEXT, fontWeight: '700' },

  // Save Action-Card (wie Sleep-Tracker Karten)
  saveCard: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  saveIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 4,
  },
  saveTitle: { fontSize: 16, fontWeight: '800', color: PRIMARY_TEXT, marginBottom: 4 },
  saveSub: { fontSize: 11, color: PRIMARY_TEXT, opacity: 0.8 },
  dangerCard: {
    borderColor: 'rgba(255,107,107,0.6)',
  },
  dangerText: {
    color: '#FF6B6B',
  },
  dangerSub: {
    color: PRIMARY_TEXT,
    opacity: 0.9,
  },
  inlineActions: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  inlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  inlineActionText: {
    color: ACCENT_PURPLE,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: PRIMARY_TEXT,
    opacity: 0.8,
  },
});
