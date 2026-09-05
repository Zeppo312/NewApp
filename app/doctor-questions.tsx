import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { DoctorQuestion } from '@/lib/supabase';
import { useDoctorQuestionsService } from '@/hooks/useDoctorQuestionsService';
import Header from '@/components/Header';
import {
  LiquidGlassCard,
  GlassCard,
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK,
  LAYOUT_PAD,
  TEXT_PRIMARY,
  RADIUS,
  PRIMARY,
} from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLocale } from '@/contexts/LocaleContext';
import {
  translateDoctorQuestionsText,
  type DoctorQuestionsTranslationKey,
} from '@/lib/doctorQuestionsTranslations';

export default function DoctorQuestionsScreen() {
  const { locale } = useLocale();
  const t = (key: DoctorQuestionsTranslationKey) => translateDoctorQuestionsText(locale, key);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const { user } = useAuth();
  const { isReadOnlyPreviewMode } = useBabyStatus();
  const service = useDoctorQuestionsService();

  const [questions, setQuestions] = useState<DoctorQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingQuestionId, setIsTogglingQuestionId] = useState<string | null>(null);
  const [isSavingAnswerId, setIsSavingAnswerId] = useState<string | null>(null);
  const [isDeletingQuestionId, setIsDeletingQuestionId] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [editingAnswer, setEditingAnswer] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const answerInputRef = useRef<TextInput>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openQuestions = useMemo(() => questions.filter((q) => !q.is_answered), [questions]);
  const answeredQuestions = useMemo(() => questions.filter((q) => q.is_answered), [questions]);
  const headerSubtitle = isReadOnlyPreviewMode
    ? t('screen.previewSubtitle')
    : t('screen.subtitle');

  const showReadOnlyPreviewAlert = () => {
    Alert.alert(t('preview.alertTitle'), t('preview.description'));
  };

  const ensureWritableInCurrentMode = () => {
    if (!isReadOnlyPreviewMode) return true;
    showReadOnlyPreviewAlert();
    return false;
  };

  useEffect(() => {
    if (user) {
      loadQuestions();
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const showOperationMessage = (message: string) => {
    setOperationMessage(message);
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = setTimeout(() => {
      setOperationMessage(null);
    }, 2500);
  };

  const loadQuestions = async (options?: { silent?: boolean }) => {
    if (!service) {
      if (!options?.silent) {
        setIsLoading(false);
      }
      return;
    }

    try {
      if (!options?.silent) {
        setIsLoading(true);
      }
      const { data, error } = await service.getQuestions();

      if (error) {
        console.error('Error loading doctor questions:', error);
        if (!options?.silent) {
          Alert.alert(t('common.error'), t('error.load'));
        }
        return;
      }

      if (data) {
        setQuestions(data);
      }
    } catch (err) {
      console.error('Failed to load doctor questions:', err);
      if (!options?.silent) {
        Alert.alert(t('common.error'), t('error.load'));
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  };

  const handleSaveQuestion = async () => {
    if (!ensureWritableInCurrentMode()) return;
    if (isSaving) {
      return;
    }

    if (!newQuestion.trim()) {
      Alert.alert(t('common.notice'), t('error.questionRequired'));
      return;
    }

    if (!service) {
      Alert.alert(t('common.error'), t('error.service'));
      return;
    }

    try {
      setIsSaving(true);
      const result = await service.saveQuestion(newQuestion.trim());

      if (result.primary.error) {
        console.error('Error saving doctor question:', result.primary.error);
        Alert.alert(t('common.error'), t('error.saveQuestion'));
        return;
      }

      if (result.primary.data) {
        setNewQuestion('');
        await loadQuestions({ silent: true });
        showOperationMessage(t('feedback.questionSaved'));
      }
    } catch (err) {
      console.error('Failed to save doctor question:', err);
      Alert.alert(t('common.error'), t('error.saveQuestion'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAnswered = async (question: DoctorQuestion) => {
    if (!ensureWritableInCurrentMode()) return;
    if (!service) {
      Alert.alert(t('common.error'), t('error.service'));
      return;
    }

    const nextIsAnswered = !question.is_answered;

    try {
      setIsTogglingQuestionId(question.id);

      const result = await service.updateQuestion(question.id, {
        is_answered: nextIsAnswered,
      });

      if (result.primary.error) {
        console.error('Error updating doctor question:', result.primary.error);
        Alert.alert(t('common.error'), t('error.status'));
        return;
      }

      if (result.primary.data) {
        setQuestions((prev) => prev.map((q) => (q.id === question.id ? result.primary.data! : q)));
      }

      await loadQuestions({ silent: true });
      showOperationMessage(
        nextIsAnswered ? t('feedback.markedAnswered') : t('feedback.markedOpen')
      );
    } catch (err) {
      console.error('Failed to update doctor question:', err);
      Alert.alert(t('common.error'), t('error.status'));
    } finally {
      setIsTogglingQuestionId(null);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!ensureWritableInCurrentMode()) return;
    Alert.alert(t('delete.title'), t('delete.confirm'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!ensureWritableInCurrentMode()) return;
          if (!service) {
            Alert.alert(t('common.error'), t('error.service'));
            return;
          }

          try {
            setIsDeletingQuestionId(questionId);
            const result = await service.deleteQuestion(questionId);

            if (result.primary.error) {
              console.error('Error deleting doctor question:', result.primary.error);
              Alert.alert(t('common.error'), t('error.delete'));
              return;
            }

            setQuestions((prev) => prev.filter((q) => q.id !== questionId));
            if (expandedQuestion === questionId) {
              setExpandedQuestion(null);
            }
            await loadQuestions({ silent: true });
            showOperationMessage(t('feedback.deleted'));
          } catch (err) {
            console.error('Failed to delete doctor question:', err);
            Alert.alert(t('common.error'), t('error.delete'));
          } finally {
            setIsDeletingQuestionId(null);
          }
        },
      },
    ]);
  };

  const toggleExpandQuestion = (questionId: string) => {
    if (expandedQuestion === questionId) {
      setExpandedQuestion(null);
    } else {
      setExpandedQuestion(questionId);
      setEditingAnswer(null);
    }
  };

  const handleStartEditAnswer = (question: DoctorQuestion) => {
    if (!ensureWritableInCurrentMode()) return;
    setEditingAnswer(question.id);
    setAnswerText(question.answer || '');
    setTimeout(() => {
      answerInputRef.current?.focus();
    }, 100);
  };

  const handleSaveAnswer = async (questionId: string) => {
    if (!ensureWritableInCurrentMode()) return;
    if (!service) {
      Alert.alert(t('common.error'), t('error.service'));
      return;
    }

    try {
      setIsSavingAnswerId(questionId);
      const result = await service.updateQuestion(questionId, {
        answer: answerText.trim() || undefined,
      });

      if (result.primary.error) {
        console.error('Error saving answer:', result.primary.error);
        Alert.alert(t('common.error'), t('error.answer'));
        return;
      }

      if (result.primary.data) {
        setQuestions((prev) => prev.map((q) => (q.id === questionId ? result.primary.data! : q)));
        setEditingAnswer(null);
        setAnswerText('');
        Keyboard.dismiss();
      }

      await loadQuestions({ silent: true });
      showOperationMessage(t('feedback.answerSaved'));
    } catch (err) {
      console.error('Failed to save answer:', err);
      Alert.alert(t('common.error'), t('error.answer'));
    } finally {
      setIsSavingAnswerId(null);
    }
  };

  const handleCancelEditAnswer = () => {
    setEditingAnswer(null);
    setAnswerText('');
    Keyboard.dismiss();
  };

  const totalQuestions = questions.length;
  const openCount = openQuestions.length;
  const answeredCount = answeredQuestions.length;

  const renderQuestionCard = (question: DoctorQuestion) => {
    const isExpanded = expandedQuestion === question.id;
    const isToggling = isTogglingQuestionId === question.id;
    const isSavingAnswer = isSavingAnswerId === question.id;
    const isDeleting = isDeletingQuestionId === question.id;
    const isQuestionBusy = isToggling || isSavingAnswer || isDeleting;
    const isQuestionActionDisabled = isQuestionBusy || isReadOnlyPreviewMode;
    const overlayColor = question.is_answered
      ? 'rgba(168,196,162,0.22)'
      : 'rgba(142,78,198,0.18)';

    return (
      <LiquidGlassCard
        key={question.id}
        style={[styles.fullWidthCard, styles.questionCard]}
        intensity={28}
        overlayColor={overlayColor}
        borderColor="rgba(255,255,255,0.35)"
      >
        <TouchableOpacity
          style={styles.questionTop}
          onPress={() => toggleExpandQuestion(question.id)}
          activeOpacity={0.85}
        >
          <View style={styles.questionTitleWrapper}>
            <View
              style={[
                styles.statusBadge,
                question.is_answered ? styles.statusBadgeAnswered : styles.statusBadgeOpen,
              ]}
            >
              <ThemedText
                style={[
                  styles.statusBadgeText,
                  question.is_answered && styles.statusBadgeTextAnswered,
                ]}
              >
                {question.is_answered ? t('question.answered') : t('question.open')}
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.questionText, { color: textPrimary }, question.is_answered && styles.questionTextAnswered]}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {question.question}
            </ThemedText>
          </View>
          <IconSymbol
            name={isExpanded ? 'chevron.up' : 'chevron.down'}
            size={20}
            color={theme.tabIconDefault}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.questionBody}>
            <TouchableOpacity
              style={[
                styles.actionChip,
                question.is_answered && styles.actionChipActive,
                isQuestionActionDisabled && styles.buttonDisabled,
              ]}
              onPress={() => handleToggleAnswered(question)}
              disabled={isQuestionActionDisabled}
              activeOpacity={0.85}
            >
              {isToggling ? (
                <ActivityIndicator size="small" color={question.is_answered ? '#3C7C59' : PRIMARY} />
              ) : (
                <IconSymbol
                  name={question.is_answered ? 'arrow.uturn.backward' : 'checklist'}
                  size={18}
                  color={question.is_answered ? '#3C7C59' : PRIMARY}
                  style={styles.actionChipIcon}
                />
              )}
              <ThemedText
                style={[
                  styles.actionChipText,
                  question.is_answered && styles.actionChipTextActive,
                ]}
              >
                {isToggling
                  ? t('question.updating')
                  : question.is_answered
                    ? t('question.markOpen')
                    : t('question.markAnswered')}
              </ThemedText>
            </TouchableOpacity>

            <View style={styles.answerBlock}>
              <View style={styles.answerHeader}>
                <IconSymbol
                  name="info.circle.fill"
                  size={20}
                  color={theme.accent}
                  style={styles.answerHeaderIcon}
                />
                <ThemedText style={[styles.answerHeaderText, { color: textPrimary }]}>{t('answer.title')}</ThemedText>
              </View>

              {editingAnswer === question.id ? (
                <View style={styles.answerEditor}>
                  <GlassCard style={styles.answerInputWrapper}>
                    <TextInput
                      ref={answerInputRef}
                      style={[styles.answerInput, { color: theme.text }]}
                      placeholder={t('answer.placeholder')}
                      placeholderTextColor={theme.tabIconDefault}
                      value={answerText}
                      onChangeText={setAnswerText}
                      multiline
                      editable={!isReadOnlyPreviewMode}
                    />
                  </GlassCard>
                  <View style={styles.answerButtons}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, isSavingAnswer && styles.buttonDisabled]}
                      onPress={handleCancelEditAnswer}
                      disabled={isSavingAnswer}
                      activeOpacity={0.85}
                    >
                      <IconSymbol
                        name="xmark.circle.fill"
                        size={14}
                        color={TEXT_PRIMARY}
                        style={styles.secondaryButtonIcon}
                      />
                      <ThemedText style={styles.secondaryButtonText}>{t('common.cancel')}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryPill, isQuestionActionDisabled && styles.buttonDisabled]}
                      onPress={() => handleSaveAnswer(question.id)}
                      disabled={isQuestionActionDisabled}
                      activeOpacity={0.85}
                    >
                      {isSavingAnswer ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <IconSymbol
                            name="checklist"
                            size={14}
                            color="#FFFFFF"
                            style={styles.primaryPillIcon}
                          />
                          <ThemedText style={styles.primaryPillText}>{t('common.save')}</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={isReadOnlyPreviewMode && styles.buttonDisabled}
                  onPress={() => handleStartEditAnswer(question)}
                  disabled={isReadOnlyPreviewMode}
                  activeOpacity={0.85}
                >
                  <GlassCard style={styles.answerDisplay}>
                    <ThemedText
                      style={[question.answer ? styles.answerText : styles.answerPlaceholder, { color: question.answer ? textPrimary : textSecondary }]}
                    >
                      {question.answer || t('answer.empty')}
                    </ThemedText>
                  </GlassCard>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.deleteButton, isQuestionActionDisabled && styles.buttonDisabled]}
              onPress={() => handleDeleteQuestion(question.id)}
              disabled={isQuestionActionDisabled}
              activeOpacity={0.85}
            >
              {isDeleting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <ThemedText style={[styles.deleteButtonText, styles.loadingInlineText]}>
                    {t('delete.pending')}
                  </ThemedText>
                </>
              ) : (
                <>
                  <IconSymbol name="trash" size={15} color="#FFFFFF" style={styles.deleteButtonIcon} />
                  <ThemedText style={styles.deleteButtonText}>{t('delete.action')}</ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </LiquidGlassCard>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <Header
            title={t('screen.title')}
            subtitle={headerSubtitle}
            showBackButton
          />
          {isReadOnlyPreviewMode && (
            <View style={styles.readOnlyPreviewBanner}>
              <ThemedText style={styles.readOnlyPreviewTitle}>{t('preview.title')}</ThemedText>
              <ThemedText style={styles.readOnlyPreviewText}>
                {t('preview.description')}
              </ThemedText>
            </View>
          )}
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <GlassCard style={[styles.fullWidthCard, styles.heroCard]}>
              <ThemedText style={[styles.heroTitle, { color: textPrimary }]}>{t('hero.title')}</ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: textSecondary }]}>
                {t('hero.description')}
              </ThemedText>
            </GlassCard>

            <View style={[styles.fullWidthCard, styles.statsRow]}>
              <LiquidGlassCard
                style={[styles.statCard, styles.statCardFirst]}
                intensity={26}
                overlayColor="rgba(142,78,198,0.18)"
                borderColor="rgba(255,255,255,0.35)"
              >
                <View style={styles.statCardInner}>
                  <IconSymbol
                    name="questionmark.circle.fill"
                    size={22}
                    color={PRIMARY}
                    style={styles.statIcon}
                  />
                  <View>
                    <ThemedText style={[styles.statValue, { color: textPrimary }]}>{openCount}</ThemedText>
                    <ThemedText style={[styles.statLabel, { color: textSecondary }]}>{t('stats.open')}</ThemedText>
                  </View>
                </View>
              </LiquidGlassCard>
              <LiquidGlassCard
                style={styles.statCard}
                intensity={26}
                overlayColor="rgba(168,196,162,0.24)"
                borderColor="rgba(255,255,255,0.35)"
              >
                <View style={styles.statCardInner}>
                  <IconSymbol
                    name="checklist"
                    size={22}
                    color="#3C7C59"
                    style={styles.statIcon}
                  />
                  <View>
                    <ThemedText style={[styles.statValue, { color: textPrimary }]}>{answeredCount}</ThemedText>
                    <ThemedText style={[styles.statLabel, { color: textSecondary }]}>{t('stats.answered')}</ThemedText>
                  </View>
                </View>
              </LiquidGlassCard>
            </View>

            <GlassCard style={[styles.fullWidthCard, styles.newQuestionCard]}>
              <View style={styles.newQuestionHeader}>
                <IconSymbol
                  name="doc.text.fill"
                  size={20}
                  color={PRIMARY}
                  style={styles.newQuestionHeaderIcon}
                />
                <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>{t('new.title')}</ThemedText>
              </View>
              <ThemedText style={[styles.cardSubtitle, { color: textSecondary }]}>
                {t('new.description')}
              </ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder={t('new.placeholder')}
                  placeholderTextColor={theme.tabIconDefault}
                  value={newQuestion}
                  onChangeText={setNewQuestion}
                  multiline
                  editable={!isReadOnlyPreviewMode}
                />
              </View>
              <LiquidGlassCard
                style={[styles.primaryButton, (isSaving || isReadOnlyPreviewMode) && styles.buttonDisabled]}
                intensity={28}
                overlayColor="rgba(142,78,198,0.32)"
                borderColor="rgba(255,255,255,0.35)"
                onPress={isSaving || isReadOnlyPreviewMode ? undefined : handleSaveQuestion}
                activeOpacity={isSaving || isReadOnlyPreviewMode ? 1 : 0.85}
              >
                <View style={styles.primaryButtonInner}>
                  {isSaving ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <ThemedText style={[styles.primaryButtonText, styles.loadingInlineText]}>
                        {t('new.saving')}
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <IconSymbol
                        name="paperplane.fill"
                        size={20}
                        color="#FFFFFF"
                        style={styles.primaryButtonIcon}
                      />
                      <ThemedText style={styles.primaryButtonText}>{t('new.save')}</ThemedText>
                    </>
                  )}
                </View>
              </LiquidGlassCard>
            </GlassCard>

            {operationMessage ? (
              <GlassCard style={[styles.fullWidthCard, styles.feedbackCard]}>
                <View style={styles.feedbackInner}>
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={18}
                    color="#3C7C59"
                    style={styles.feedbackIcon}
                  />
                  <ThemedText style={[styles.feedbackText, { color: textPrimary }]}>
                    {operationMessage}
                  </ThemedText>
                </View>
              </GlassCard>
            ) : null}

            {isLoading ? (
              <LiquidGlassCard
                style={[styles.fullWidthCard, styles.loadingCard]}
                intensity={26}
                overlayColor={glassOverlay}
                borderColor="rgba(255,255,255,0.35)"
              >
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.accent} />
                  <ThemedText style={[styles.loadingText, { color: textPrimary }]}>
                    {t('state.loading')}
                  </ThemedText>
                </View>
              </LiquidGlassCard>
            ) : totalQuestions === 0 ? (
              <LiquidGlassCard
                style={[styles.fullWidthCard, styles.emptyCard]}
                intensity={26}
                overlayColor={glassOverlay}
                borderColor="rgba(255,255,255,0.35)"
              >
                <View style={styles.emptyState}>
                  <IconSymbol
                    name="lightbulb.fill"
                    size={44}
                    color={theme.tabIconDefault}
                    style={styles.emptyIcon}
                  />
                  <ThemedText style={[styles.emptyTitle, { color: textPrimary }]}>{t('state.emptyTitle')}</ThemedText>
                  <ThemedText style={[styles.emptySubtitle, { color: textSecondary }]}>
                    {t('state.emptyDescription')}
                  </ThemedText>
                </View>
              </LiquidGlassCard>
            ) : (
              <View style={styles.questionsSection}>
                {openQuestions.length > 0 && (
                  <>
                    <LiquidGlassCard
                      style={[styles.fullWidthCard, styles.sectionInfoCard]}
                      intensity={28}
                      overlayColor="rgba(142,78,198,0.2)"
                      borderColor="rgba(255,255,255,0.35)"
                    >
                      <View style={styles.sectionInfoInner}>
                        <IconSymbol
                          name="questionmark.circle.fill"
                          size={24}
                          color={PRIMARY}
                          style={styles.sectionInfoIcon}
                        />
                        <View>
                          <ThemedText style={[styles.sectionInfoTitle, { color: textPrimary }]}>{t('stats.open')}</ThemedText>
                          <ThemedText style={[styles.sectionInfoCaption, { color: textSecondary }]}>
                            {t('section.openDescription')}
                          </ThemedText>
                        </View>
                      </View>
                    </LiquidGlassCard>
                    {openQuestions.map(renderQuestionCard)}
                  </>
                )}

                {answeredQuestions.length > 0 && (
                  <>
                    <LiquidGlassCard
                      style={[styles.fullWidthCard, styles.sectionInfoCard]}
                      intensity={28}
                      overlayColor="rgba(168,196,162,0.26)"
                      borderColor="rgba(255,255,255,0.35)"
                    >
                      <View style={styles.sectionInfoInner}>
                        <IconSymbol
                          name="checklist"
                          size={24}
                          color="#3C7C59"
                          style={styles.sectionInfoIcon}
                        />
                        <View>
                          <ThemedText style={[styles.sectionInfoTitle, { color: textPrimary }]}>{t('section.answeredTitle')}</ThemedText>
                          <ThemedText style={[styles.sectionInfoCaption, { color: textSecondary }]}>
                            {t('section.answeredDescription')}
                          </ThemedText>
                        </View>
                      </View>
                    </LiquidGlassCard>
                    {answeredQuestions.map(renderQuestionCard)}
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 18,
    paddingBottom: 56,
  },
  readOnlyPreviewBanner: {
    marginHorizontal: LAYOUT_PAD,
    marginTop: 10,
    marginBottom: -2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(255, 248, 225, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(229, 180, 77, 0.45)',
  },
  readOnlyPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8A5A00',
    marginBottom: 4,
  },
  readOnlyPreviewText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#8A5A00',
  },
  fullWidthCard: {
  },
  heroCard: {
    paddingVertical: 22,
    paddingHorizontal: 22,
    marginBottom: 12,
    borderRadius: RADIUS,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(125,90,80,0.78)',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS,
  },
  statCardFirst: {
    marginRight: 12,
  },
  statCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  statIcon: {
    marginRight: 14,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(125,90,80,0.8)',
  },
  newQuestionCard: {
    padding: 22,
    borderRadius: RADIUS,
    marginTop: 8,
  },
  newQuestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  newQuestionHeaderIcon: {
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(125,90,80,0.75)',
    lineHeight: 18,
    marginBottom: 14,
  },
  inputWrapper: {
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.28)',
    padding: 14,
    minHeight: 96,
  },
  textInput: {
    backgroundColor: 'transparent',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 68,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: RADIUS,
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  primaryButtonIcon: {
    marginRight: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  loadingInlineText: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  feedbackCard: {
    marginTop: 12,
    marginBottom: 10,
    borderRadius: RADIUS,
  },
  feedbackInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  feedbackIcon: {
    marginRight: 10,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingCard: {
    borderRadius: RADIUS,
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    marginTop: 10,
  },
  emptyCard: {
    borderRadius: RADIUS,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: TEXT_PRIMARY,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(125,90,80,0.75)',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  questionsSection: {
    marginTop: 12,
    marginBottom: 32,
  },
  sectionInfoCard: {
    borderRadius: RADIUS,
    marginBottom: 12,
  },
  sectionInfoInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  sectionInfoIcon: {
    marginRight: 14,
  },
  sectionInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  sectionInfoCaption: {
    fontSize: 12,
    color: 'rgba(125,90,80,0.65)',
    marginTop: 4,
  },
  questionCard: {
    borderRadius: RADIUS,
    marginBottom: 12,
  },
  questionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  questionTitleWrapper: {
    flex: 1,
    paddingRight: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  statusBadgeOpen: {
    backgroundColor: 'rgba(142,78,198,0.16)',
  },
  statusBadgeAnswered: {
    backgroundColor: 'rgba(168,196,162,0.28)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY,
  },
  statusBadgeTextAnswered: {
    color: '#3C7C59',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  questionTextAnswered: {
    opacity: 0.75,
    textDecorationLine: 'line-through',
  },
  questionBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.35)',
    backgroundColor: 'rgba(255,255,255,0.38)',
    marginBottom: 16,
  },
  actionChipActive: {
    borderColor: 'rgba(60,124,89,0.55)',
    backgroundColor: 'rgba(168,196,162,0.32)',
  },
  actionChipIcon: {
    marginRight: 8,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },
  actionChipTextActive: {
    color: '#2F5F46',
  },
  answerBlock: {
    marginBottom: 18,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  answerHeaderIcon: {
    marginRight: 8,
  },
  answerHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  answerEditor: {
    marginTop: 6,
  },
  answerInputWrapper: {
    borderRadius: RADIUS,
  },
  answerInput: {
    minHeight: 100,
    padding: 16,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
    backgroundColor: 'transparent',
  },
  answerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginRight: 10,
  },
  secondaryButtonIcon: {
    marginRight: 6,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  primaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: PRIMARY,
  },
  primaryPillIcon: {
    marginRight: 6,
  },
  primaryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  answerDisplay: {
    padding: 16,
    minHeight: 96,
    borderRadius: RADIUS,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_PRIMARY,
  },
  answerPlaceholder: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(125,90,80,0.6)',
    fontStyle: 'italic',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.88)',
  },
  deleteButtonIcon: {
    marginRight: 8,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
