/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect , useRouter } from 'expo-router';

import CommunityQaFeed from '@/components/community/CommunityQaFeed';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getAppSettings, saveAppSettings, supabase } from '@/lib/supabase';
import {
  CommunityTranslationKey,
  DEFAULT_COMMUNITY_LOCALE,
  translateCommunityText,
} from '@/lib/communityTranslations';

let ACTIVE_COMMUNITY_LOCALE = DEFAULT_COMMUNITY_LOCALE;
const t = (key: CommunityTranslationKey, params?: Record<string, string | number>) =>
  translateCommunityText(ACTIVE_COMMUNITY_LOCALE, key, params);

type ProfileIdentityRecord = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export default function CommunityTabScreen() {
  ACTIVE_COMMUNITY_LOCALE = useLocale().locale;
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const adaptiveColors = useAdaptiveColors();
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const theme = Colors[isDark ? 'dark' : 'light'];

  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [isResolvingIdentity, setIsResolvingIdentity] = useState(false);
  const [isSavingChoice, setIsSavingChoice] = useState(false);
  const [sessionIdentityBypass, setSessionIdentityBypass] = useState(false);
  const [communityAvatarChoice, setCommunityAvatarChoice] = useState<boolean | null>(null);

  const primaryText = isDark ? theme.textPrimary : '#5C4033';
  const secondaryText = isDark ? theme.textSecondary : '#7D5A50';
  const cardBg = isDark ? 'rgba(25,22,20,0.96)' : 'rgba(255,250,245,0.98)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(125,90,80,0.12)';

  const resolveCommunityIdentity = useCallback(async () => {
    if (!user?.id) {
      setShowIdentityPrompt(false);
      return;
    }

    if (sessionIdentityBypass) {
      setShowIdentityPrompt(false);
      return;
    }

    setIsResolvingIdentity(true);
    try {
      const [{ data: settings, error: settingsError }, { data: profile, error: profileError }] = await Promise.all([
        getAppSettings(),
        supabase
          .from('profiles')
          .select('username, first_name, last_name')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      if (settingsError) {
        console.error('Failed to load community identity settings:', settingsError);
        setShowIdentityPrompt(false);
        return;
      }

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Failed to load community profile:', profileError);
        setShowIdentityPrompt(false);
        return;
      }

      const currentMode = settings?.community_identity_mode ?? null;
      const currentAvatarChoice =
        typeof settings?.community_use_avatar === 'boolean' ? settings.community_use_avatar : null;
      const currentProfile = (profile || {}) as ProfileIdentityRecord;
      const hasUsername = !!currentProfile.username?.trim();

      setCommunityAvatarChoice(currentAvatarChoice);

      if (currentMode === 'real_name' && currentAvatarChoice !== null) {
        setShowIdentityPrompt(false);
        return;
      }

      if (hasUsername) {
        if (currentMode !== 'username') {
          const { error: saveError } = await saveAppSettings({ community_identity_mode: 'username' });
          if (saveError) {
            console.error('Failed to persist username community identity mode:', saveError);
            setSessionIdentityBypass(true);
          }
        }
        if (currentAvatarChoice !== null) {
          setShowIdentityPrompt(false);
          return;
        }
      }

      setShowIdentityPrompt(true);
    } catch (error) {
      console.error('Failed to resolve community identity flow:', error);
      setShowIdentityPrompt(false);
    } finally {
      setIsResolvingIdentity(false);
    }
  }, [sessionIdentityBypass, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void resolveCommunityIdentity();
    }, [resolveCommunityIdentity]),
  );

  const handleUseRealName = useCallback(async () => {
    if (communityAvatarChoice === null) {
      Alert.alert(t('common.community'), t('identity.avatarRequired'));
      return;
    }

    setIsSavingChoice(true);
    try {
      const { error } = await saveAppSettings({
        community_identity_mode: 'real_name',
        community_use_avatar: communityAvatarChoice,
      });
      if (error) {
        throw error;
      }
      setShowIdentityPrompt(false);
    } catch (error) {
      console.error('Failed to save real-name community identity:', error);
      Alert.alert(
        t('common.community'),
        t('identity.saveFailed'),
        [
          { text: t('common.retry'), style: 'cancel' },
          {
            text: t('common.continueOnce'),
            onPress: () => {
              setSessionIdentityBypass(true);
              setShowIdentityPrompt(false);
            },
          },
        ],
      );
    } finally {
      setIsSavingChoice(false);
    }
  }, [communityAvatarChoice]);

  const handleSetupUsername = useCallback(() => {
    if (communityAvatarChoice === null) {
      Alert.alert(t('common.community'), t('identity.avatarRequired'));
      return;
    }

    setShowIdentityPrompt(false);
    router.push({
      pathname: '/profil',
      params: {
        focus: 'username',
        communitySetup: 'username',
        communityAvatar: communityAvatarChoice ? 'visible' : 'hidden',
      },
    });
  }, [communityAvatarChoice, router]);

  return (
    <View style={styles.container}>
      <CommunityQaFeed locale={ACTIVE_COMMUNITY_LOCALE} />

      <Modal
        visible={showIdentityPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ThemedText style={[styles.title, { color: primaryText }]}>{t('identity.title')}</ThemedText>
            <ThemedText style={[styles.body, { color: secondaryText }]}>
              {t('identity.description')}
            </ThemedText>

            <View style={styles.preferenceBlock}>
              <ThemedText style={[styles.preferenceTitle, { color: primaryText }]}>
                {t('identity.avatarQuestion')}
              </ThemedText>
              <View style={styles.preferenceRow}>
                <TouchableOpacity
                  style={[
                    styles.preferenceButton,
                    communityAvatarChoice === true && styles.preferenceButtonActive,
                  ]}
                  onPress={() => setCommunityAvatarChoice(true)}
                  activeOpacity={0.85}
                >
                  <ThemedText
                    style={[
                      styles.preferenceButtonText,
                      communityAvatarChoice === true && styles.preferenceButtonTextActive,
                    ]}
                  >
                    {t('identity.avatarYes')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.preferenceButton,
                    communityAvatarChoice === false && styles.preferenceButtonActive,
                  ]}
                  onPress={() => setCommunityAvatarChoice(false)}
                  activeOpacity={0.85}
                >
                  <ThemedText
                    style={[
                      styles.preferenceButtonText,
                      communityAvatarChoice === false && styles.preferenceButtonTextActive,
                    ]}
                  >
                    {t('identity.avatarNo')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isSavingChoice && styles.buttonDisabled]}
              onPress={handleSetupUsername}
              activeOpacity={0.85}
              disabled={isSavingChoice}
            >
              <ThemedText style={styles.primaryButtonText}>{t('identity.setupUsername')}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: cardBorder }, isSavingChoice && styles.buttonDisabled]}
              onPress={() => void handleUseRealName()}
              activeOpacity={0.85}
              disabled={isSavingChoice}
            >
              {isSavingChoice ? (
                <ActivityIndicator size="small" color="#7D5A50" />
              ) : (
                <ThemedText style={[styles.secondaryButtonText, { color: primaryText }]}>
                  {t('identity.useRealName')}
                </ThemedText>
              )}
            </TouchableOpacity>

            {isResolvingIdentity ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#C89F81" />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  preferenceBlock: {
    marginTop: 20,
    gap: 10,
  },
  preferenceTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  preferenceRow: {
    gap: 10,
  },
  preferenceButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,159,129,0.26)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  preferenceButtonActive: {
    backgroundColor: '#C89F81',
    borderColor: '#C89F81',
  },
  preferenceButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6E564B',
    textAlign: 'center',
  },
  preferenceButtonTextActive: {
    color: '#FFFFFF',
  },
  primaryButton: {
    marginTop: 22,
    backgroundColor: '#C89F81',
    borderRadius: 18,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
