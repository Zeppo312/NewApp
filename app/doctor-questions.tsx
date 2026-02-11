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

export default function DoctorQuestionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const { user } = useAuth();
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
          Alert.alert('Fehler', 'Fragen konnten nicht geladen werden.');
        }
        return;
      }

      if (data) {
        setQuestions(data);
      }
    } catch (err) {
      console.error('Failed to load doctor questions:', err);
      if (!options?.silent) {
        Alert.alert('Fehler', 'Fragen konnten nicht geladen werden.');
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  };

  const handleSaveQuestion = async () => {
    if (isSaving) {
      return;
    }

    if (!newQuestion.trim()) {
      Alert.alert('Hinweis', 'Bitte gib eine Frage ein.');
      return;
    }

    if (!service) {
      Alert.alert('Fehler', 'Service nicht verfügbar.');
      return;
    }

    try {
      setIsSaving(true);
      const result = await service.saveQuestion(newQuestion.trim());

      if (result.primary.error) {
        console.error('Error saving doctor question:', result.primary.error);
        Alert.alert('Fehler', 'Frage konnte nicht gespeichert werden.');
        return;
      }

      if (result.primary.data) {
        setNewQuestion('');
        await loadQuestions({ silent: true });
        showOperationMessage('Frage gespeichert.');
      }
    } catch (err) {
      console.error('Failed to save doctor question:', err);
      Alert.alert('Fehler', 'Frage konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAnswered = async (question: DoctorQuestion) => {
    if (!service) {
      Alert.alert('Fehler', 'Service nicht verfügbar.');
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
        Alert.alert('Fehler', 'Status konnte nicht aktualisiert werden.');
        return;
      }

      if (result.primary.data) {
        setQuestions((prev) => prev.map((q) => (q.id === question.id ? result.primary.data! : q)));
      }

      await loadQuestions({ silent: true });
      showOperationMessage(
        nextIsAnswered ? 'Frage als beantwortet markiert.' : 'Frage als offen markiert.'
      );
    } catch (err) {
      console.error('Failed to update doctor question:', err);
      Alert.alert('Fehler', 'Status konnte nicht aktualisiert werden.');
    } finally {
      setIsTogglingQuestionId(null);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    Alert.alert('Frage löschen', 'Möchtest du diese Frage wirklich löschen?', [
      {
        text: 'Abbrechen',
        style: 'cancel',
      },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          if (!service) {
            Alert.alert('Fehler', 'Service nicht verfügbar.');
            return;
          }

          try {
            setIsDeletingQuestionId(questionId);
            const result = await service.deleteQuestion(questionId);

            if (result.primary.error) {
              console.error('Error deleting doctor question:', result.primary.error);
              Alert.alert('Fehler', 'Frage konnte nicht gelöscht werden.');
              return;
            }

            setQuestions((prev) => prev.filter((q) => q.id !== questionId));
            if (expandedQuestion === questionId) {
              setExpandedQuestion(null);
            }
            await loadQuestions({ silent: true });
            showOperationMessage('Frage gelöscht.');
          } catch (err) {
            console.error('Failed to delete doctor question:', err);
            Alert.alert('Fehler', 'Frage konnte nicht gelöscht werden.');
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
    setEditingAnswer(question.id);
    setAnswerText(question.answer || '');
    setTimeout(() => {
      answerInputRef.current?.focus();
    }, 100);
  };

  const handleSaveAnswer = async (questionId: string) => {
    if (!service) {
      Alert.alert('Fehler', 'Service nicht verfügbar.');
      return;
    }

    try {
      setIsSavingAnswerId(questionId);
      const result = await service.updateQuestion(questionId, {
        answer: answerText.trim() || undefined,
      });

      if (result.primary.error) {
        console.error('Error saving answer:', result.primary.error);
        Alert.alert('Fehler', 'Antwort konnte nicht gespeichert werden.');
        return;
      }

      if (result.primary.data) {
        setQuestions((prev) => prev.map((q) => (q.id === questionId ? result.primary.data! : q)));
        setEditingAnswer(null);
        setAnswerText('');
        Keyboard.dismiss();
      }

      await loadQuestions({ silent: true });
      showOperationMessage('Antwort gespeichert.');
    } catch (err) {
      console.error('Failed to save answer:', err);
      Alert.alert('Fehler', 'Antwort konnte nicht gespeichert werden.');
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
                {question.is_answered ? 'Beantwortet' : 'Offen'}
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
                isToggling && styles.buttonDisabled,
              ]}
              onPress={() => handleToggleAnswered(question)}
              disabled={isQuestionBusy}
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
                  ? 'Wird aktualisiert...'
                  : question.is_answered
                    ? 'Als offen markieren'
                    : 'Als beantwortet markieren'}
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
                <ThemedText style={[styles.answerHeaderText, { color: textPrimary }]}>Antwort vom Arzt</ThemedText>
              </View>

              {editingAnswer === question.id ? (
                <View style={styles.answerEditor}>
                  <GlassCard style={styles.answerInputWrapper}>
                    <TextInput
                      ref={answerInputRef}
                      style={[styles.answerInput, { color: theme.text }]}
                      placeholder="Notiere hier die Antwort oder eigene Gedanken..."
                      placeholderTextColor={theme.tabIconDefault}
                      value={answerText}
                      onChangeText={setAnswerText}
                      multiline
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
                      <ThemedText style={styles.secondaryButtonText}>Abbrechen</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryPill, isSavingAnswer && styles.buttonDisabled]}
                      onPress={() => handleSaveAnswer(question.id)}
                      disabled={isSavingAnswer}
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
                          <ThemedText style={styles.primaryPillText}>Speichern</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleStartEditAnswer(question)}
                  activeOpacity={0.85}
                >
                  <GlassCard style={styles.answerDisplay}>
                    <ThemedText
                      style={[question.answer ? styles.answerText : styles.answerPlaceholder, { color: question.answer ? textPrimary : textSecondary }]}
                    >
                      {question.answer ||
                        'Tippe, um eine Antwort zu hinterlegen oder Notizen zu ergänzen.'}
                    </ThemedText>
                  </GlassCard>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
              onPress={() => handleDeleteQuestion(question.id)}
              disabled={isQuestionBusy}
              activeOpacity={0.85}
            >
              {isDeleting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <ThemedText style={[styles.deleteButtonText, styles.loadingInlineText]}>
                    Lösche...
                  </ThemedText>
                </>
              ) : (
                <>
                  <IconSymbol name="trash" size={15} color="#FFFFFF" style={styles.deleteButtonIcon} />
                  <ThemedText style={styles.deleteButtonText}>Frage löschen</ThemedText>
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
            title="Fragen für den Frauenarzt"
            subtitle="Alles Wichtige für den nächsten Termin"
            showBackButton
          />
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <GlassCard style={[styles.fullWidthCard, styles.heroCard]}>
              <ThemedText style={[styles.heroTitle, { color: textPrimary }]}>Alles parat für den nächsten Besuch</ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: textSecondary }]}>
                Sammle Fragen, halte Antworten fest und geh entspannt in deinen Termin.
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
                    <ThemedText style={[styles.statLabel, { color: textSecondary }]}>Offene Fragen</ThemedText>
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
                    <ThemedText style={[styles.statLabel, { color: textSecondary }]}>Beantwortet</ThemedText>
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
                <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>Neue Frage notieren</ThemedText>
              </View>
              <ThemedText style={[styles.cardSubtitle, { color: textSecondary }]}>
                Formuliere kurz und klar, damit du beim Termin nichts vergisst.
              </ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Was möchtest du beim nächsten Besuch ansprechen?"
                  placeholderTextColor={theme.tabIconDefault}
                  value={newQuestion}
                  onChangeText={setNewQuestion}
                  multiline
                />
              </View>
              <LiquidGlassCard
                style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                intensity={28}
                overlayColor="rgba(142,78,198,0.32)"
                borderColor="rgba(255,255,255,0.35)"
                onPress={isSaving ? undefined : handleSaveQuestion}
                activeOpacity={isSaving ? 1 : 0.85}
              >
                <View style={styles.primaryButtonInner}>
                  {isSaving ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <ThemedText style={[styles.primaryButtonText, styles.loadingInlineText]}>
                        Speichere...
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
                      <ThemedText style={styles.primaryButtonText}>Frage sichern</ThemedText>
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
                    Fragen werden geladen...
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
                  <ThemedText style={[styles.emptyTitle, { color: textPrimary }]}>Noch keine Fragen gespeichert</ThemedText>
                  <ThemedText style={[styles.emptySubtitle, { color: textSecondary }]}>
                    Notiere spontan auftauchende Gedanken direkt hier, damit nichts verloren geht.
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
                          <ThemedText style={[styles.sectionInfoTitle, { color: textPrimary }]}>Offene Fragen</ThemedText>
                          <ThemedText style={[styles.sectionInfoCaption, { color: textSecondary }]}>
                            Kläre diese Punkte beim nächsten Termin.
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
                          <ThemedText style={[styles.sectionInfoTitle, { color: textPrimary }]}>Bereits beantwortet</ThemedText>
                          <ThemedText style={[styles.sectionInfoCaption, { color: textSecondary }]}>
                            Ergänze Notizen oder markiere erneut als offen.
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
