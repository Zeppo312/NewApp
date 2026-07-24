import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CachedImage } from '@/components/CachedImage';
import { BlurView } from 'expo-blur';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
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
import { saveAppSettings, supabase } from '@/lib/supabase';
import { setLocalProfileName } from '@/lib/localProfile';
import * as ImagePicker from 'expo-image-picker';
import {
  deleteProfileAvatar,
  deleteUserAccount,
  getAccountDeletionRequirements,
  uploadProfileAvatar,
} from '@/lib/profile';
import {
  getSubscriptionManagementStoreLabel,
  openSubscriptionManagement,
} from '@/lib/subscriptionManagement';
import {
  DEFAULT_PROFILE_LOCALE,
  ProfileTranslationKey,
  translateProfileText,
} from '@/lib/profileTranslations';

const PRIMARY_TEXT = '#7D5A50';
const ACCENT_PURPLE = '#8E4EC6'; // Sleep-Tracker Akzent
const BABY_BLUE = '#87CEEB';
const ACTIVE_PROFILE_LOCALE = DEFAULT_PROFILE_LOCALE;
const t = (
  key: ProfileTranslationKey,
  params?: Record<string, string | number>,
) => translateProfileText(ACTIVE_PROFILE_LOCALE, key, params);

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

export default function ProfilScreen() {
  const params = useLocalSearchParams<{
    focus?: string | string[];
    communitySetup?: string | string[];
    communityAvatar?: string | string[];
  }>();
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
  const loadingAccent = adaptiveColors.accent;
  const saveCardBackground = isDark ? toRgba(accentPurple, 0.22) : 'rgba(220,200,255,0.6)';
  const securityCardBackground = isDark ? toRgba(babyBlue, 0.2) : 'rgba(135,206,235,0.45)';
  const dangerCardBackground = isDark ? 'rgba(255,107,107,0.22)' : 'rgba(255,130,130,0.5)';
  const actionDisabledBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(168,168,168,0.5)';
  const { user, session, signOut } = useAuth();
  const requestedFocus = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  const communitySetup = Array.isArray(params.communitySetup) ? params.communitySetup[0] : params.communitySetup;
  const communityAvatarParam = Array.isArray(params.communityAvatar)
    ? params.communityAvatar[0]
    : params.communityAvatar;
  const shouldCompleteCommunityUsername = communitySetup === 'username';

  // Benutzerinformationen
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [userRole, setUserRole]   = useState<'mama' | 'papa' | ''>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [communityUseAvatar, setCommunityUseAvatar] = useState(true);

  // UI
  const [isLoading, setIsLoading]                   = useState(true);
  const [isSaving, setIsSaving]                     = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar]     = useState(false);
  const [isDeletingProfile, setIsDeletingProfile]   = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailOverlayVisible, setEmailOverlayVisible] = useState(false);
  const [emailOverlayValue, setEmailOverlayValue] = useState('');
  const latestLoadRequestIdRef = useRef(0);
  const usernameInputRef = useRef<TextInput>(null);

  const loadUserData = useCallback(async () => {
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

      const [{ data: profileData, error: profileError }, { data: settingsData, error: settingsError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name, last_name, username, user_role, avatar_url')
          .eq('id', userId)
          .single(),
        supabase
          .from('user_settings')
          .select('community_use_avatar')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!profileError && profileData) {
        if (requestId !== latestLoadRequestIdRef.current) return;
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
        setUsername(profileData.username || '');
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

      if (!settingsError && requestId === latestLoadRequestIdRef.current) {
        if (typeof settingsData?.community_use_avatar === 'boolean') {
          setCommunityUseAvatar(settingsData.community_use_avatar);
        } else if (communityAvatarParam === 'hidden') {
          setCommunityUseAvatar(false);
        } else if (communityAvatarParam === 'visible') {
          setCommunityUseAvatar(true);
        }
      }

    } catch (e) {
      console.error(e);
      if (requestId === latestLoadRequestIdRef.current) {
        Alert.alert(t('common.error'), t('load.failed'));
      }
    } finally {
      if (requestId === latestLoadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [communityAvatarParam, user]);

  useEffect(() => {
    if (user) loadUserData();
    else setIsLoading(false);
  }, [loadUserData, user]);

  useEffect(() => {
    if (requestedFocus !== 'username' || isLoading) return;

    const timeout = setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 350);

    return () => clearTimeout(timeout);
  }, [isLoading, requestedFocus]);

  const pickAvatarImage = async () => {
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
      Alert.alert(t('common.error'), t('photo.pickFailed'));
    }
  };

  const removeAvatarImage = (markRemoved = true) => {
    setAvatarPreview(null);
    setAvatarBase64(null);
    setAvatarUrl(null);
    setAvatarRemoved(markRemoved);
  };

  const handleAvatarDeletePress = () => {
    if (!avatarUrl || isDeletingAvatar) return;
    const urlToDelete = avatarUrl;
    Alert.alert(
      t('photo.deleteTitle'),
      t('photo.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteAvatarFromServer(urlToDelete) },
      ],
    );
  };

  const deleteAvatarFromServer = async (url: string) => {
    try {
      setIsDeletingAvatar(true);
      const { error } = await deleteProfileAvatar(url);
      if (error) throw error;
      removeAvatarImage(false);
      Alert.alert(t('photo.deletedTitle'), t('photo.deletedMessage'));
    } catch (error) {
      console.error('Error deleting profile avatar:', error);
      Alert.alert(t('common.error'), t('photo.deleteFailed'));
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const handleDeleteProfileRequest = () => {
    if (isDeletingProfile) return;
    void confirmDeleteProfileRequest();
  };

  const confirmDeleteProfileRequest = async () => {
    try {
      const { data: requirements, error } = await getAccountDeletionRequirements();
      if (error) throw error;

      Alert.alert(
        t('delete.title'),
        t('delete.confirmMessage', {
          warning: t('delete.subscriptionWarning', {
            store: getSubscriptionManagementStoreLabel(),
            apple: requirements?.hasAppleSignIn ? t('delete.appleWarning') : '',
          }),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('delete.manageSubscription'), onPress: () => void openSubscriptionManagement() },
          { text: t('common.delete'), style: 'destructive', onPress: deleteProfileAndSignOut },
        ],
      );
    } catch (error: any) {
      console.error('Failed to load profile deletion requirements:', error);
      Alert.alert(
        t('common.error'),
        error?.message || t('delete.warningFailed'),
      );
    }
  };

  const deleteProfileAndSignOut = async () => {
    if (!user) {
      Alert.alert(t('common.notice'), t('delete.signIn'));
      return;
    }
    try {
      setIsDeletingProfile(true);
      const { error } = await deleteUserAccount({ avatarUrl });
      if (error) throw error;
      setIsDeletingProfile(false);
      Alert.alert(
        t('delete.deletedTitle'),
        t('delete.deletedMessage'),
        [
          {
            text: t('common.ok'),
            onPress: async () => {
              await signOut();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('Error deleting profile:', error);
      setIsDeletingProfile(false);
      Alert.alert(t('common.error'), error?.message || t('delete.failed'));
    }
  };

  const sendPasswordResetEmail = async () => {
    if (!user?.email) {
      Alert.alert(t('common.error'), t('password.emailMissing'));
      return;
    }
    if (isSendingPasswordReset) return;

    try {
      setIsSendingPasswordReset(true);
      const redirectTo = Linking.createURL('auth/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
      if (error) throw error;

      Alert.alert(
        t('password.sentTitle'),
        t('password.sentMessage'),
      );
    } catch (error: any) {
      console.error('Failed to send password reset email:', error);
      Alert.alert(
        t('common.error'),
        error?.message || t('password.sendFailed'),
      );
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const handlePasswordChangePress = () => {
    if (!user?.email) {
      Alert.alert(t('common.error'), t('password.emailMissing'));
      return;
    }

    Alert.alert(
      t('password.title'),
      t('password.confirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('password.send'), onPress: sendPasswordResetEmail },
      ],
    );
  };

  const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const requestEmailChange = (nextEmailRaw: string) => {
    if (!user) {
      Alert.alert(t('common.notice'), t('email.signIn'));
      return;
    }

    const nextEmail = nextEmailRaw.trim().toLowerCase();
    if (!nextEmail) {
      Alert.alert(t('common.notice'), t('email.required'));
      return;
    }
    if (!isLikelyEmail(nextEmail)) {
      Alert.alert(t('common.notice'), t('email.invalid'));
      return;
    }
    if (user.email && nextEmail === user.email.trim().toLowerCase()) {
      Alert.alert(t('common.notice'), t('email.unchanged'));
      return;
    }

    setEmailOverlayVisible(false);

    Alert.alert(
      t('email.confirmTitle'),
      t('email.confirmMessage', { email: nextEmail }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => {
            setEmailOverlayValue(nextEmail);
            setEmailOverlayVisible(true);
          },
        },
        {
          text: t('email.change'),
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
        t('email.almostDoneTitle'),
        t('email.almostDoneMessage', { email: nextEmail }),
      );
    } catch (error: any) {
      console.error('Failed to update email:', error);
      Alert.alert(
        t('common.error'),
        error?.message || t('email.changeFailed'),
      );
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const saveUserData = async () => {
    if (!user) {
      Alert.alert(t('common.notice'), t('save.signIn'));
      return;
    }

    if (shouldCompleteCommunityUsername && !username.trim()) {
      Alert.alert(t('community.usernameRequiredTitle'), t('community.usernameRequiredMessage'));
      usernameInputRef.current?.focus();
      return;
    }

    setIsSaving(true);

    let finalAvatarUrl = avatarUrl;
    const trimmedUsername = username.trim();

    try {
      if (avatarBase64) {
        const uploadResult = await uploadProfileAvatar(avatarBase64);
        if (uploadResult.error) throw uploadResult.error;
        finalAvatarUrl = uploadResult.url;
      } else if (avatarRemoved) {
        finalAvatarUrl = null;
      }

      // profiles upsert
      const { data: existingProfile } = await supabase
        .from('profiles').select('id').eq('id', user.id).maybeSingle();

      let profileResult;
      if (existingProfile?.id) {
        profileResult = await supabase.from('profiles').update({
          first_name: firstName,
          last_name: lastName,
          username: trimmedUsername || null,
          user_role: userRole,
          avatar_url: finalAvatarUrl || null,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      } else {
        profileResult = await supabase.from('profiles').insert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          username: trimmedUsername || null,
          user_role: userRole,
          avatar_url: finalAvatarUrl || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (profileResult.error) throw profileResult.error;
      await setLocalProfileName(user.id, firstName, lastName);

      const nextIdentityMode = trimmedUsername ? 'username' : 'real_name';
      const nextCommunityUseAvatar =
        shouldCompleteCommunityUsername && communityAvatarParam
          ? communityAvatarParam !== 'hidden'
          : communityUseAvatar;
      const { error: settingsError } = await saveAppSettings({
        community_identity_mode: nextIdentityMode,
        community_use_avatar: nextCommunityUseAvatar,
      });
      if (settingsError) throw settingsError;

      Alert.alert(t('save.successTitle'), t('save.successMessage'), [
        { text: t('common.ok'), onPress: () => router.push(shouldCompleteCommunityUsername ? '/community' : '/more') },
      ]);
    } catch (e: any) {
      console.error(e);
      Alert.alert(t('common.error'), e?.message || t('save.failed'));
    } finally {
      setIsSaving(false);
      setAvatarUrl(finalAvatarUrl || null);
      setAvatarPreview(finalAvatarUrl || null);
      setAvatarBase64(null);
      setAvatarRemoved(false);
    }
  };

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const profileDisplayName = fullName || username.trim() || t('hero.fallbackName');
  const avatarInitials = [firstName.trim().charAt(0), lastName.trim().charAt(0)]
    .filter(Boolean)
    .join('')
    .toUpperCase();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden />

          <Header
            title={t('screen.title')}
            subtitle={t('screen.subtitle')}
            showBackButton
            onBackPress={() => router.push(shouldCompleteCommunityUsername ? '/community' : '/more')}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={loadingAccent} />
                <ThemedText style={[styles.loadingText, { color: textPrimary }]}>
                  {t('screen.loading')}
                </ThemedText>
              </View>
            ) : (
              <>
                <LiquidGlassCard
                  style={[
                    styles.heroCard,
                    isDark && { backgroundColor: 'rgba(0,0,0,0.35)' },
                  ]}
                  intensity={30}
                  overlayColor={glassOverlay}
                  borderColor={glassBorder}
                >
                  <View style={styles.heroGlow} pointerEvents="none" />
                  <ThemedText style={[styles.heroEyebrow, { color: accentPurple }]}>
                    {t('hero.eyebrow')}
                  </ThemedText>
                  <View style={styles.avatarSelector}>
                    <TouchableOpacity
                      style={[
                        styles.avatarPreviewWrapper,
                        {
                          backgroundColor: glassSurface,
                          borderColor: accentPurple,
                          boxShadow: `0 10px 28px ${toRgba(accentPurple, isDark ? 0.24 : 0.18)}`,
                        },
                      ]}
                      onPress={pickAvatarImage}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={t('photo.editA11y')}
                    >
                      {avatarPreview ? (
                        <CachedImage
                          uri={avatarPreview}
                          style={styles.avatarPreviewImage}
                          showLoader={false}
                        />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: glassSurfaceSoft, borderColor: glassBorder }]}>
                          {avatarInitials ? (
                            <ThemedText style={[styles.avatarInitials, { color: textPrimary }]}>
                              {avatarInitials}
                            </ThemedText>
                          ) : (
                            <IconSymbol name="person.fill" size={42} color={accentPurple} />
                          )}
                        </View>
                      )}
                      <View style={[styles.avatarEditBadge, { backgroundColor: accentPurple, borderColor: glassBorderStrong }]}>
                        <IconSymbol name="camera" size={15} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                    <ThemedText style={[styles.heroName, { color: textPrimary }]} numberOfLines={1}>
                      {profileDisplayName}
                    </ThemedText>
                    <ThemedText style={[styles.heroDescription, { color: textSecondary }]}>
                      {t('hero.description')}
                    </ThemedText>
                    <View style={styles.avatarActions}>
                      <TouchableOpacity
                        style={[styles.avatarActionButton, { backgroundColor: glassSurfaceButton, borderColor: glassBorder }]}
                        onPress={pickAvatarImage}
                      >
                        <IconSymbol name="photo" size={17} color={accentPurple} />
                        <ThemedText style={[styles.avatarActionText, { color: textPrimary }]}>
                          {avatarPreview ? t('photo.change') : t('photo.choose')}
                        </ThemedText>
                      </TouchableOpacity>
                      {!!avatarPreview && (
                        <TouchableOpacity
                          style={[styles.avatarActionButton, { backgroundColor: glassSurfaceButton, borderColor: glassBorder }]}
                          onPress={() => removeAvatarImage()}
                        >
                          <IconSymbol name="xmark" size={17} color={textSecondary} />
                          <ThemedText style={[styles.avatarActionText, { color: textPrimary }]}>
                            {t('photo.remove')}
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                      {!!avatarUrl && (
                        <TouchableOpacity
                          style={[styles.avatarActionButton, styles.avatarDeleteButton]}
                          onPress={handleAvatarDeletePress}
                          disabled={isDeletingAvatar}
                        >
                          {isDeletingAvatar ? (
                            <ActivityIndicator size="small" color="#FF6B6B" />
                          ) : (
                            <ThemedText style={[styles.avatarActionText, styles.avatarDeleteText]}>
                              {t('photo.delete')}
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </LiquidGlassCard>

                <LiquidGlassCard
                  style={[styles.sectionCard, isDark && { backgroundColor: 'rgba(0,0,0,0.35)' }]}
                  intensity={26}
                  overlayColor={glassOverlay}
                  borderColor={glassBorder}
                >
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: toRgba(accentPurple, isDark ? 0.22 : 0.12) }]}>
                      <IconSymbol name="person.text.rectangle" size={22} color={accentPurple} />
                    </View>
                    <View style={styles.sectionHeaderText}>
                      <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                        {t('section.personal')}
                      </ThemedText>
                      <ThemedText style={[styles.sectionSubtitle, { color: textSecondary }]}>
                        {t('section.personalDescription')}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.cardInner}>
                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>{t('field.email')}</ThemedText>
                      <TextInput
                        style={[
                          styles.inputGlass,
                          styles.inputDisabled,
                          { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary },
                        ]}
                        value={email}
                        editable={false}
                        placeholder={t('field.emailPlaceholder')}
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
                          <ThemedText style={[styles.inlineActionText, { color: textPrimary }]}>
                            {t('email.change')}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                      {!!user?.new_email && user?.new_email !== user?.email && (
                        <ThemedText style={[styles.helperText, { color: textPrimary }]}>
                          {t('email.pending', { email: user.new_email })}
                        </ThemedText>
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>{t('field.firstName')}</ThemedText>
                      <TextInput
                        style={[styles.inputGlass, { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary }]}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder={t('field.firstNamePlaceholder')}
                        placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>{t('field.lastName')}</ThemedText>
                      <TextInput
                        style={[styles.inputGlass, { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary }]}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder={t('field.lastNamePlaceholder')}
                        placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                      />
                    </View>

                  </View>
                </LiquidGlassCard>

                <LiquidGlassCard
                  style={[styles.sectionCard, isDark && { backgroundColor: 'rgba(0,0,0,0.35)' }]}
                  intensity={26}
                  overlayColor={glassOverlay}
                  borderColor={glassBorder}
                >
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: toRgba(accentPurple, isDark ? 0.22 : 0.12) }]}>
                      <IconSymbol name="person.2.fill" size={22} color={accentPurple} />
                    </View>
                    <View style={styles.sectionHeaderText}>
                      <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                        {t('section.community')}
                      </ThemedText>
                      <ThemedText style={[styles.sectionSubtitle, { color: textSecondary }]}>
                        {t('section.communityDescription')}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.cardInner}>
                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>{t('field.username')}</ThemedText>
                      {shouldCompleteCommunityUsername ? (
                        <ThemedText style={[styles.helperText, { color: accentPurple }]}>
                          {t('community.usernameHint')}
                        </ThemedText>
                      ) : null}
                      <TextInput
                        ref={usernameInputRef}
                        style={[styles.inputGlass, { borderColor: glassBorder, backgroundColor: glassSurface, color: textPrimary }]}
                        value={username}
                        onChangeText={setUsername}
                        placeholder={t('field.usernamePlaceholder')}
                        placeholderTextColor={isDark ? '#CFC7BC' : '#9BA0A6'}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>
                        {t('community.avatarLabel')}
                      </ThemedText>
                      <View
                        style={[
                          styles.preferenceToggleRow,
                          { borderColor: glassBorder, backgroundColor: glassSurfaceButton },
                        ]}
                      >
                        <View style={styles.preferenceToggleTextWrap}>
                          <ThemedText style={[styles.preferenceToggleTitle, { color: textPrimary }]}>
                            {t('community.avatarTitle')}
                          </ThemedText>
                          <ThemedText style={[styles.helperText, { color: textSecondary }]}>
                            {t('community.avatarDescription')}
                          </ThemedText>
                        </View>
                        <Switch
                          value={communityUseAvatar}
                          onValueChange={setCommunityUseAvatar}
                          trackColor={{ false: '#D9CEC7', true: accentPurple }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={[styles.label, { color: textPrimary }]}>{t('field.role')}</ThemedText>
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
                            {t('field.roleMama')}
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
                            {t('field.rolePapa')}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </LiquidGlassCard>

                <LiquidGlassCard
                  style={[
                    styles.sectionCard,
                    isDark && { backgroundColor: 'rgba(0,0,0,0.35)' },
                  ]}
                  intensity={26}
                  overlayColor={glassOverlay}
                  borderColor={glassBorder}
                >
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: toRgba(babyBlue, isDark ? 0.22 : 0.18) }]}>
                      <IconSymbol name="figure.child" size={22} color={babyBlue} />
                    </View>
                    <View style={styles.sectionHeaderText}>
                      <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                        {t('section.baby')}
                      </ThemedText>
                      <ThemedText style={[styles.sectionSubtitle, { color: textSecondary }]}>
                        {t('section.babyDescription')}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.cardInner}>
                    <ThemedText style={[styles.sectionHelperText, { color: textSecondary }]}>
                      {t('baby.description')}
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.sectionLinkButton, { borderColor: glassBorder, backgroundColor: glassSurfaceButton }]}
                      onPress={() => router.push('/(tabs)/baby?edit=1')}
                      activeOpacity={0.9}
                    >
                      <IconSymbol name="person.fill" size={20} color={textPrimary} />
                      <ThemedText style={[styles.sectionLinkButtonText, { color: textPrimary }]}>
                        {t('baby.open')}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </LiquidGlassCard>

                <TouchableOpacity
                  onPress={saveUserData}
                  activeOpacity={0.9}
                  disabled={isSaving}
                  style={styles.actionTouchable}
                >
                  <BlurView intensity={24} tint={isDark ? 'dark' : 'light'} style={styles.actionBlur}>
                    <View
                      style={[
                        styles.actionCard,
                        styles.primaryActionCard,
                        { backgroundColor: isSaving ? actionDisabledBackground : saveCardBackground, borderColor: glassBorderStrong },
                      ]}
                    >
                      <View style={[styles.actionIconWrap, { backgroundColor: accentPurple }]}>
                        {isSaving ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <IconSymbol name="checkmark" size={26} color="#FFFFFF" />
                        )}
                      </View>
                      <View style={styles.actionTextWrap}>
                        <ThemedText style={[styles.actionTitle, { color: textPrimary }]}>
                          {isSaving ? t('save.loading') : t('save.title')}
                        </ThemedText>
                        <ThemedText style={[styles.actionSub, { color: textSecondary }]}>
                          {t('save.description')}
                        </ThemedText>
                      </View>
                      {!isSaving && <IconSymbol name="chevron.right" size={22} color={textSecondary} />}
                    </View>
                  </BlurView>
                </TouchableOpacity>

                <View style={styles.securitySection}>
                  <ThemedText style={[styles.securityTitle, { color: textPrimary }]}>
                    {t('section.security')}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={handlePasswordChangePress}
                    activeOpacity={0.9}
                    disabled={isSendingPasswordReset}
                    style={styles.actionTouchable}
                  >
                    <BlurView intensity={24} tint={isDark ? 'dark' : 'light'} style={styles.actionBlur}>
                      <View
                        style={[
                          styles.actionCard,
                          { backgroundColor: isSendingPasswordReset ? actionDisabledBackground : securityCardBackground, borderColor: glassBorder },
                        ]}
                      >
                        <View style={[styles.actionIconWrap, { backgroundColor: babyBlue }]}>
                          {isSendingPasswordReset ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <IconSymbol name="lock.shield" size={24} color="#FFFFFF" />
                          )}
                        </View>
                        <View style={styles.actionTextWrap}>
                          <ThemedText style={[styles.actionTitle, { color: textPrimary }]}>
                            {isSendingPasswordReset ? t('password.loading') : t('password.title')}
                          </ThemedText>
                          <ThemedText style={[styles.actionSub, { color: textSecondary }]}>
                            {t('password.description')}
                          </ThemedText>
                        </View>
                        {!isSendingPasswordReset && <IconSymbol name="chevron.right" size={22} color={textSecondary} />}
                      </View>
                    </BlurView>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleDeleteProfileRequest}
                    activeOpacity={0.9}
                    disabled={isDeletingProfile}
                    style={styles.actionTouchable}
                  >
                    <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={styles.actionBlur}>
                      <View
                        style={[
                          styles.actionCard,
                          styles.dangerCard,
                          { backgroundColor: dangerCardBackground },
                        ]}
                      >
                        <View style={[styles.actionIconWrap, { backgroundColor: '#FF6B6B', borderColor: glassBorderStrong }]}>
                          {isDeletingProfile ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <IconSymbol name="trash.fill" size={24} color="#FFFFFF" />
                          )}
                        </View>
                        <View style={styles.actionTextWrap}>
                          <ThemedText style={[styles.actionTitle, styles.dangerText, { color: '#FF6B6B' }]}>
                            {isDeletingProfile ? t('delete.loading') : t('delete.title')}
                          </ThemedText>
                          <ThemedText style={[styles.actionSub, styles.dangerSub, { color: textSecondary }]}>
                            {t('delete.description')}
                          </ThemedText>
                        </View>
                        {!isDeletingProfile && <IconSymbol name="chevron.right" size={22} color="#FF6B6B" />}
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
        label={t('email.overlayLabel')}
        value={emailOverlayValue}
        placeholder={t('email.overlayPlaceholder')}
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
  safeArea: { flex: 1 },

  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 140,
    paddingTop: 12,
  },

  loadingContainer: { padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: PRIMARY_TEXT },

  heroCard: { marginBottom: 16, borderRadius: 28, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -115,
    right: -55,
    backgroundColor: 'rgba(142,78,198,0.14)',
  },
  heroEyebrow: {
    paddingTop: 22,
    paddingHorizontal: 24,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  heroName: {
    maxWidth: '90%',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroDescription: {
    maxWidth: 300,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  sectionCard: { marginBottom: 16, borderRadius: 22, overflow: 'hidden' },
  sectionHeader: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1, gap: 2 },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: PRIMARY_TEXT,
  },
  sectionSubtitle: { fontSize: 12, lineHeight: 17 },
  cardInner: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionHelperText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  sectionLinkButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sectionLinkButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  formGroup: { marginBottom: 18 },

  label: { fontSize: 13, marginBottom: 8, color: PRIMARY_TEXT, fontWeight: '700', letterSpacing: 0.15 },

  inputGlass: {
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    color: '#333',
  },
  inputDisabled: {
    opacity: 0.82,
  },

  avatarSelector: {
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 7,
  },
  avatarPreviewWrapper: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    borderWidth: 3,
  },
  avatarPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    backgroundColor: '#D8D8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 34, fontWeight: '800', letterSpacing: 0.5 },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
  },
  avatarActionButton: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  avatarActionText: {
    color: '#8E4EC6',
    fontSize: 13,
    fontWeight: '700',
  },
  avatarDeleteButton: { paddingHorizontal: 8 },
  avatarDeleteText: {
    color: '#FF6B6B',
  },

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

  preferenceToggleRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  preferenceToggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  preferenceToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  actionTouchable: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
  },
  actionBlur: { borderRadius: 22, overflow: 'hidden' },
  actionCard: {
    borderRadius: 22,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    minHeight: 82,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  primaryActionCard: { minHeight: 88 },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    boxShadow: '0 5px 14px rgba(0,0,0,0.10)',
  },
  actionTextWrap: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 16, lineHeight: 20, fontWeight: '800', color: PRIMARY_TEXT },
  actionSub: { fontSize: 12, lineHeight: 17, color: PRIMARY_TEXT },
  securitySection: { paddingTop: 14 },
  securityTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  dangerCard: {
    borderColor: 'rgba(255,107,107,0.6)',
  },
  dangerText: {
    color: '#FF6B6B',
  },
  dangerSub: {
    color: PRIMARY_TEXT,
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
