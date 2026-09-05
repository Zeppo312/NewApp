import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { LAYOUT_PAD } from '@/constants/DesignGuide';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useChatAudioPlayback } from '@/hooks/useChatAudioPlayback';
import { getCachedUserProfile, invalidateUserProfileCache } from '@/lib/appCache';
import { getChatAudioPlayableSource } from '@/lib/chatAudio';
import { formatAudioDuration } from '@/lib/chatMessages';
import {
  getModerationReports,
  moderationAskReporter,
  moderationDeleteContent,
  moderationRemoveContentAndSuspendUser,
  moderationResolveReport,
  moderationSuspendUser,
  moderationUnsuspendUser,
  type ModerationReport,
  type ReportStatus,
} from '@/lib/moderation';
import {
  translateModerationText,
  type ModerationTranslationKey,
} from '@/lib/moderationTranslations';

const STATUS_FILTERS: { status: ReportStatus; labelKey: ModerationTranslationKey }[] = [
  { status: 'open', labelKey: 'admin.filterOpen' },
  { status: 'resolved', labelKey: 'admin.filterResolved' },
  { status: 'dismissed', labelKey: 'admin.filterDismissed' },
];

export default function ModerationAdminScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { locale, localeTag } = useLocale();

  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReportStatus>('open');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [followUpReport, setFollowUpReport] = useState<ModerationReport | null>(null);
  const [followUpText, setFollowUpText] = useState('');
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [failedImageIds, setFailedImageIds] = useState<string[]>([]);

  // Gemeldete Sprachnachrichten: die Edge Function gibt eine signierte URL nur
  // frei, wenn zu genau dieser Nachricht eine offene Meldung vorliegt.
  const directAudio = useChatAudioPlayback('direct');
  const groupAudio = useChatAudioPlayback('group');

  const t = useCallback(
    (key: ModerationTranslationKey, params?: Record<string, string | number>) =>
      translateModerationText(locale, key, params),
    [locale],
  );

  const textPrimary = isDark ? theme.textPrimary : '#5C4033';
  const textSecondary = isDark ? theme.textSecondary : '#7D5A50';
  const cardColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)';
  const cardBorderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(125,90,80,0.08)';
  const dangerColor = isDark ? '#E88F84' : '#C4645A';

  useEffect(() => {
    let mounted = true;

    if (!user) {
      setIsAdmin(false);
      setIsAuthorizing(false);
      return () => {
        mounted = false;
      };
    }

    const loadAdminState = async () => {
      try {
        await invalidateUserProfileCache();
        const profile = await getCachedUserProfile();
        if (!mounted) return;
        setIsAdmin(profile?.is_admin === true);
      } catch (error) {
        console.error('Failed to load moderation admin state:', error);
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setIsAuthorizing(false);
      }
    };

    void loadAdminState();

    return () => {
      mounted = false;
    };
  }, [user]);

  const loadReports = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    const list = await getModerationReports(statusFilter);
    setReports(list);
    setIsLoading(false);
  }, [isAdmin, statusFilter]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  /**
   * Übersetzt die Serverfehler der Moderations-RPCs in etwas Lesbares.
   * Der unbekannte Rest wird angehängt, damit im Admin-Bereich nichts
   * stillschweigend verschluckt wird.
   */
  const describeError = useCallback(
    (detail?: string) => {
      if (!detail) return t('admin.actionFailed');

      if (detail.includes('cannot ask yourself')) return t('admin.followUpSelf');
      if (detail.includes('moderator role required')) return t('admin.errorNoPermission');
      if (
        detail.includes('schema cache') ||
        detail.includes('Could not find the function') ||
        detail.includes('does not exist')
      ) {
        return t('admin.errorRpcMissing');
      }

      return `${t('admin.actionFailed')}\n\n${t('admin.errorDetail', { detail })}`;
    },
    [t],
  );

  const runAction = useCallback(
    async (reportId: string, action: () => Promise<{ success: boolean; error?: string }>) => {
      setPendingReportId(reportId);
      const result = await action();
      setPendingReportId(null);

      if (!result.success) {
        Alert.alert(t('common.error'), describeError(result.error));
        return;
      }

      await loadReports();
    },
    [describeError, loadReports, t],
  );

  const handleDeleteContent = useCallback(
    (report: ModerationReport) => {
      Alert.alert(t('admin.deleteConfirmTitle'), t('admin.deleteConfirmMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.deleteContent'),
          style: 'destructive',
          onPress: () =>
            void runAction(report.id, () =>
              moderationDeleteContent(report.target_type, report.target_id),
            ),
        },
      ]);
    },
    [runAction, t],
  );

  const handleSuspend = useCallback(
    (report: ModerationReport) => {
      if (!report.reported_user_id) return;
      const reportedUserId = report.reported_user_id;

      Alert.alert(t('admin.suspendConfirmTitle'), t('admin.suspendConfirmMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.suspendUser'),
          style: 'destructive',
          onPress: () =>
            void runAction(report.id, () =>
              moderationSuspendUser(reportedUserId, `report:${report.id}`),
            ),
        },
      ]);
    },
    [runAction, t],
  );

  const handleRemoveAndSuspend = useCallback(
    (report: ModerationReport) => {
      if (!report.reported_user_id) return;

      Alert.alert(
        t('admin.removeAndSuspendConfirmTitle'),
        t('admin.removeAndSuspendConfirmMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('admin.removeAndSuspend'),
            style: 'destructive',
            onPress: () =>
              void runAction(report.id, () =>
                moderationRemoveContentAndSuspendUser(report.id, `report:${report.id}`),
              ),
          },
        ],
      );
    },
    [runAction, t],
  );

  const handleDismiss = useCallback(
    (report: ModerationReport) => {
      Alert.alert(t('admin.dismissConfirmTitle'), t('admin.dismissConfirmMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.dismiss'),
          onPress: () => void runAction(report.id, () => moderationResolveReport(report.id, 'dismissed')),
        },
      ]);
    },
    [runAction, t],
  );

  const handleSendFollowUp = useCallback(async () => {
    if (!followUpReport) return;

    const message = followUpText.trim();
    if (!message) {
      Alert.alert(t('common.error'), t('admin.followUpEmpty'));
      return;
    }

    setIsSendingFollowUp(true);
    const result = await moderationAskReporter(followUpReport.id, message);
    setIsSendingFollowUp(false);

    if (!result.success) {
      Alert.alert(t('common.error'), describeError(result.error));
      return;
    }

    setFollowUpReport(null);
    setFollowUpText('');
    await loadReports();
    Alert.alert(t('admin.followUpSuccessTitle'), t('admin.followUpSuccessMessage'));
  }, [describeError, followUpReport, followUpText, loadReports, t]);

  const handleToggleAudio = useCallback(
    async (report: ModerationReport) => {
      const isDirect = report.target_type === 'direct_message';
      const scope = isDirect ? 'direct' : 'group';
      const playback = isDirect ? directAudio : groupAudio;

      // Der Playback-Hook protokolliert Fehler nur intern. Beim ersten Start
      // deshalb selbst auflösen: das füllt den lokalen Cache und liefert eine
      // echte Fehlermeldung, wenn die Edge Function den Zugriff verweigert.
      if (playback.activeMessageId !== report.target_id) {
        try {
          await getChatAudioPlayableSource(scope, report.target_id);
        } catch (error) {
          console.error('Failed to resolve reported voice message:', error);
          Alert.alert(t('common.error'), t('admin.mediaVoiceFailed'));
          return;
        }
      }

      await playback.togglePlayback({
        id: report.target_id,
        message_type: 'voice',
        audio_duration_ms: null,
      });
    },
    [directAudio, groupAudio, t],
  );

  const reasonLabel = useCallback(
    (report: ModerationReport) => {
      if (report.reason === 'auto_filter') return t('admin.autoFilter');
      return t(`report.reason.${report.reason}` as ModerationTranslationKey);
    },
    [t],
  );

  const renderBody = () => {
    if (isAuthorizing) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      );
    }

    if (!isAdmin) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
          <IconSymbol name="lock.shield" size={30} color={textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: textPrimary }]}>
            {t('admin.accessDenied')}
          </ThemedText>
        </View>
      );
    }

    return (
      <>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.status;
            return (
              <TouchableOpacity
                key={filter.status}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.accent : cardColor,
                    borderColor: isActive ? theme.accent : cardBorderColor,
                  },
                ]}
                onPress={() => setStatusFilter(filter.status)}
                activeOpacity={0.85}
              >
                <ThemedText
                  style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : textSecondary }]}
                >
                  {t(filter.labelKey)}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={[styles.centerStateText, { color: textSecondary }]}>
              {t('admin.loading')}
            </ThemedText>
          </View>
        ) : reports.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
            <ThemedText style={[styles.emptyTitle, { color: textPrimary }]}>
              {t('admin.empty')}
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: textSecondary }]}>
              {t('admin.emptyHint')}
            </ThemedText>
          </View>
        ) : (
          reports.map((report) => {
            const isPending = pendingReportId === report.id;
            const createdAt = new Date(report.created_at);
            const createdLabel = Number.isNaN(createdAt.getTime())
              ? ''
              : `${createdAt.toLocaleDateString(localeTag)} ${createdAt.toLocaleTimeString(localeTag, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`;

            return (
              <View
                key={report.id}
                style={[styles.reportCard, { backgroundColor: cardColor, borderColor: cardBorderColor }]}
              >
                <View style={styles.reportHeader}>
                  <ThemedText style={[styles.reportType, { color: textPrimary }]}>
                    {t(`target.${report.target_type}` as ModerationTranslationKey)}
                  </ThemedText>
                  <ThemedText style={[styles.reportTime, { color: textSecondary }]}>
                    {createdLabel}
                  </ThemedText>
                </View>

                <ThemedText style={[styles.reportMeta, { color: textSecondary }]}>
                  {t('admin.reasonLabel')}: {reasonLabel(report)}
                </ThemedText>
                <ThemedText style={[styles.reportMeta, { color: textSecondary }]}>
                  {t('admin.reportedBy', { name: report.reporter_name })}
                </ThemedText>

                <View style={styles.reportedUserRow}>
                  <ThemedText style={[styles.reportedUser, { color: textPrimary }]} numberOfLines={1}>
                    {report.reported_user_name}
                  </ThemedText>
                  {report.reported_user_suspended ? (
                    <View style={[styles.badge, { backgroundColor: dangerColor }]}>
                      <ThemedText style={styles.badgeText}>{t('admin.suspendedBadge')}</ThemedText>
                    </View>
                  ) : null}
                </View>

                {report.reported_user_open_reports > 1 ? (
                  <ThemedText style={[styles.reportMeta, { color: dangerColor }]}>
                    {t('admin.openReportsForUser', { count: report.reported_user_open_reports })}
                  </ThemedText>
                ) : null}

                <ThemedText style={[styles.contentLabel, { color: textSecondary }]}>
                  {t('admin.contentLabel')}
                </ThemedText>
                <ThemedText style={[styles.snapshot, { color: textPrimary }]}>
                  {report.target_snapshot?.trim() || t('admin.noSnapshot')}
                </ThemedText>

                {report.media_url ? (
                  <View style={styles.mediaBlock}>
                    <ThemedText style={[styles.contentLabel, { color: textSecondary }]}>
                      {t('admin.mediaImage')}
                    </ThemedText>
                    {failedImageIds.includes(report.id) ? (
                      <ThemedText style={[styles.details, { color: dangerColor }]}>
                        {t('admin.mediaImageFailed')}
                      </ThemedText>
                    ) : (
                      <Image
                        source={{ uri: report.media_url }}
                        style={[styles.mediaImage, { borderColor: cardBorderColor }]}
                        resizeMode="cover"
                        accessibilityLabel={t('admin.mediaImage')}
                        onError={() =>
                          setFailedImageIds((current) =>
                            current.includes(report.id) ? current : [...current, report.id],
                          )
                        }
                      />
                    )}
                  </View>
                ) : null}

                {report.audio_storage_path ? (
                  <View style={styles.mediaBlock}>
                    <ThemedText style={[styles.contentLabel, { color: textSecondary }]}>
                      {t('admin.mediaVoice')}
                    </ThemedText>
                    {(() => {
                      const playback =
                        report.target_type === 'direct_message' ? directAudio : groupAudio;
                      const isActive = playback.activeMessageId === report.target_id;
                      const isLoadingAudio = playback.loadingMessageId === report.target_id;
                      const isPlayingThis = isActive && playback.isPlaying;

                      return (
                        <TouchableOpacity
                          style={[
                            styles.audioButton,
                            { backgroundColor: cardColor, borderColor: cardBorderColor },
                          ]}
                          onPress={() => void handleToggleAudio(report)}
                          activeOpacity={0.85}
                          disabled={isLoadingAudio}
                        >
                          {isLoadingAudio ? (
                            <ActivityIndicator size="small" color={theme.accent} />
                          ) : (
                            <IconSymbol
                              name={isPlayingThis ? 'pause.fill' : 'play.fill'}
                              size={20}
                              color={theme.accent}
                            />
                          )}
                          <ThemedText style={[styles.audioButtonText, { color: textPrimary }]}>
                            {isPlayingThis ? t('admin.mediaVoicePause') : t('admin.mediaVoicePlay')}
                          </ThemedText>
                          {isActive ? (
                            <ThemedText style={[styles.audioTime, { color: textSecondary }]}>
                              {formatAudioDuration(playback.currentTime * 1000)}
                            </ThemedText>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                ) : null}

                {report.details ? (
                  <ThemedText style={[styles.details, { color: textSecondary }]}>
                    {report.details}
                  </ThemedText>
                ) : null}

                {report.follow_up_at ? (
                  <View style={[styles.followUpNote, { borderColor: cardBorderColor }]}>
                    <IconSymbol name="bubble.right" size={14} color={textSecondary} />
                    <View style={styles.followUpNoteText}>
                      <ThemedText style={[styles.followUpNoteTitle, { color: textSecondary }]}>
                        {t('admin.followUpSent', {
                          date: new Date(report.follow_up_at).toLocaleDateString(localeTag),
                        })}
                      </ThemedText>
                      {report.follow_up_message ? (
                        <ThemedText style={[styles.followUpNoteBody, { color: textSecondary }]}>
                          {report.follow_up_message}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {isPending ? (
                  <ActivityIndicator style={styles.pendingSpinner} color={theme.accent} />
                ) : (
                  <View style={styles.actionRow}>
                    {report.reported_user_id &&
                    !report.reported_user_suspended &&
                    report.status === 'open' ? (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: dangerColor }]}
                        onPress={() => handleRemoveAndSuspend(report)}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={styles.actionButtonText}>
                          {t('admin.removeAndSuspend')}
                        </ThemedText>
                      </TouchableOpacity>
                    ) : null}

                    {report.target_type !== 'profile' && report.status === 'open' ? (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: dangerColor }]}
                        onPress={() => handleDeleteContent(report)}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={styles.actionButtonText}>
                          {t('admin.deleteContent')}
                        </ThemedText>
                      </TouchableOpacity>
                    ) : null}

                    {report.reported_user_id && report.status !== 'open' ? (
                      report.reported_user_suspended ? (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: theme.accent }]}
                          onPress={() =>
                            void runAction(report.id, () =>
                              moderationUnsuspendUser(report.reported_user_id as string),
                            )
                          }
                          activeOpacity={0.85}
                        >
                          <ThemedText style={styles.actionButtonText}>
                            {t('admin.unsuspendUser')}
                          </ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: dangerColor }]}
                          onPress={() => handleSuspend(report)}
                          activeOpacity={0.85}
                        >
                          <ThemedText style={styles.actionButtonText}>
                            {t('admin.suspendUser')}
                          </ThemedText>
                        </TouchableOpacity>
                      )
                    ) : null}

                    {report.status === 'open' ? (
                      report.reporter_id && report.reporter_id !== user?.id ? (
                        <TouchableOpacity
                          style={[styles.actionButtonOutline, { borderColor: theme.accent }]}
                          onPress={() => {
                            setFollowUpReport(report);
                            setFollowUpText('');
                          }}
                          activeOpacity={0.85}
                        >
                          <ThemedText style={[styles.actionButtonOutlineText, { color: theme.accent }]}>
                            {t('admin.followUp')}
                          </ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <ThemedText style={[styles.followUpUnavailable, { color: textSecondary }]}>
                          {report.reporter_id === user?.id
                            ? t('admin.followUpSelf')
                            : t('admin.followUpUnavailable')}
                        </ThemedText>
                      )
                    ) : null}

                    {report.status === 'open' ? (
                      <TouchableOpacity
                        style={[styles.actionButtonOutline, { borderColor: cardBorderColor }]}
                        onPress={() => handleDismiss(report)}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={[styles.actionButtonOutlineText, { color: textSecondary }]}>
                          {t('admin.dismiss')}
                        </ThemedText>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <Header title={t('admin.title')} subtitle={t('admin.subtitle')} showBackButton />
          <ScrollView contentContainerStyle={styles.content}>{renderBody()}</ScrollView>
        </SafeAreaView>

        <Modal
          visible={!!followUpReport}
          transparent
          animationType="fade"
          onRequestClose={() => setFollowUpReport(null)}
        >
          <View
            style={[
              styles.modalOverlay,
              { backgroundColor: isDark ? 'rgba(12,12,16,0.72)' : 'rgba(92,64,51,0.34)' },
            ]}
          >
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: isDark ? '#1E1B22' : '#FFF8F4',
                  borderColor: cardBorderColor,
                },
              ]}
            >
              <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
                {t('admin.followUpTitle', { name: followUpReport?.reporter_name ?? '' })}
              </ThemedText>
              <ThemedText style={[styles.modalHint, { color: textSecondary }]}>
                {t('admin.followUpHint')}
              </ThemedText>

              <TextInput
                style={[
                  styles.modalInput,
                  { backgroundColor: cardColor, borderColor: cardBorderColor, color: textPrimary },
                ]}
                value={followUpText}
                onChangeText={setFollowUpText}
                placeholder={t('admin.followUpPlaceholder')}
                placeholderTextColor={textSecondary}
                multiline
                maxLength={1000}
                editable={!isSendingFollowUp}
                autoFocus
              />

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.actionButtonOutline, styles.modalButton, { borderColor: cardBorderColor }]}
                  onPress={() => setFollowUpReport(null)}
                  activeOpacity={0.85}
                  disabled={isSendingFollowUp}
                >
                  <ThemedText style={[styles.actionButtonOutlineText, { color: textSecondary }]}>
                    {t('common.cancel')}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.modalButton,
                    { backgroundColor: theme.accent },
                    (!followUpText.trim() || isSendingFollowUp) && styles.buttonDisabled,
                  ]}
                  onPress={() => void handleSendFollowUp()}
                  activeOpacity={0.85}
                  disabled={!followUpText.trim() || isSendingFollowUp}
                >
                  {isSendingFollowUp ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.actionButtonText}>{t('admin.followUpSend')}</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    gap: 12,
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reportCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  reportType: {
    fontSize: 16,
    fontWeight: '800',
  },
  reportTime: {
    fontSize: 12,
  },
  reportMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
  reportedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  reportedUser: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  contentLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 10,
  },
  snapshot: {
    fontSize: 14,
    lineHeight: 20,
  },
  details: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontStyle: 'italic',
  },
  pendingSpinner: {
    marginTop: 14,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    borderRadius: 16,
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonOutline: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonOutlineText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  mediaBlock: {
    marginTop: 4,
  },
  mediaImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 52,
    marginTop: 6,
  },
  audioButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  audioTime: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  followUpUnavailable: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    alignSelf: 'center',
  },
  followUpNote: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  followUpNoteText: {
    flex: 1,
  },
  followUpNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  followUpNoteBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalSheet: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  modalHint: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  modalInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 110,
    textAlignVertical: 'top',
    marginTop: 14,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
  },
});
