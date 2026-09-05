import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { LAYOUT_PAD } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocale } from '@/contexts/LocaleContext';
import { getBlockedUsers, unblockUser, type BlockedUser } from '@/lib/moderation';
import {
  translateModerationText,
  type ModerationTranslationKey,
} from '@/lib/moderationTranslations';

export default function BlockedUsersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme];
  const { locale, localeTag } = useLocale();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const t = useCallback(
    (key: ModerationTranslationKey, params?: Record<string, string | number>) =>
      translateModerationText(locale, key, params),
    [locale],
  );

  const textPrimary = isDark ? theme.textPrimary : '#5C4033';
  const textSecondary = isDark ? theme.textSecondary : '#7D5A50';
  const cardColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)';
  const cardBorderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(125,90,80,0.08)';

  const loadList = useCallback(async () => {
    setIsLoading(true);
    const list = await getBlockedUsers();
    setBlockedUsers(list);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadList();
    }, [loadList]),
  );

  const handleUnblock = useCallback(
    (target: BlockedUser) => {
      Alert.alert(
        t('unblock.confirmTitle'),
        t('unblock.confirmMessage', { name: target.name?.trim() || t('blocked.unknownName') }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('unblock.confirm'),
            onPress: async () => {
              setPendingUserId(target.id);
              const result = await unblockUser(target.id);
              setPendingUserId(null);

              if (!result.success) {
                Alert.alert(t('common.error'), t('unblock.failedMessage'));
                return;
              }

              setBlockedUsers((current) => current.filter((entry) => entry.id !== target.id));
            },
          },
        ],
      );
    },
    [t],
  );

  const displayName = useCallback(
    (entry: BlockedUser) => entry.name?.trim() || t('blocked.unknownName'),
    [t],
  );

  const formatBlockedSince = useCallback(
    (value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return t('blocked.since', { date: date.toLocaleDateString(localeTag) });
    },
    [localeTag, t],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <Header title={t('blocked.title')} subtitle={t('blocked.subtitle')} showBackButton />

          <ScrollView contentContainerStyle={styles.content}>
            {isLoading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={theme.accent} />
                <ThemedText style={[styles.centerStateText, { color: textSecondary }]}>
                  {t('blocked.loading')}
                </ThemedText>
              </View>
            ) : blockedUsers.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
                <IconSymbol name="hand.raised.fill" size={30} color={textSecondary} />
                <ThemedText style={[styles.emptyTitle, { color: textPrimary }]}>
                  {t('blocked.empty')}
                </ThemedText>
                <ThemedText style={[styles.emptyText, { color: textSecondary }]}>
                  {t('blocked.emptyHint')}
                </ThemedText>
              </View>
            ) : (
              <>
                <ThemedText style={[styles.countLabel, { color: textSecondary }]}>
                  {t('blocked.count', { count: blockedUsers.length })}
                </ThemedText>

                {blockedUsers.map((entry) => (
                  <View
                    key={entry.id}
                    style={[styles.userCard, { backgroundColor: cardColor, borderColor: cardBorderColor }]}
                  >
                    {entry.avatar_url ? (
                      <Image source={{ uri: entry.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#3D3330' : '#F3ECE7' }]}>
                        {entry.name?.trim() ? (
                          <ThemedText style={[styles.avatarInitial, { color: theme.accent }]}>
                            {entry.name.trim().charAt(0).toUpperCase()}
                          </ThemedText>
                        ) : (
                          <IconSymbol name="person.fill" size={20} color={theme.accent} />
                        )}
                      </View>
                    )}

                    <View style={styles.userMeta}>
                      <ThemedText style={[styles.userName, { color: textPrimary }]} numberOfLines={1}>
                        {displayName(entry)}
                      </ThemedText>
                      <ThemedText style={[styles.userSince, { color: textSecondary }]}>
                        {entry.name?.trim()
                          ? formatBlockedSince(entry.created_at)
                          : `${t('blocked.unknownHint')} · ${formatBlockedSince(entry.created_at)}`}
                      </ThemedText>
                    </View>

                    <TouchableOpacity
                      style={[styles.unblockButton, { backgroundColor: theme.accent }]}
                      onPress={() => handleUnblock(entry)}
                      disabled={pendingUserId === entry.id}
                      activeOpacity={0.85}
                    >
                      {pendingUserId === entry.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ThemedText style={styles.unblockButtonText}>{t('blocked.action')}</ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 10,
    gap: 10,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  centerStateText: {
    fontSize: 15,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  countLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '700',
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  userSince: {
    fontSize: 13,
  },
  unblockButton: {
    minWidth: 96,
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  unblockButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
