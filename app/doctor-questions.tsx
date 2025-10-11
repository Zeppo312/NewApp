import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getDoctorQuestions, saveDoctorQuestion, updateDoctorQuestion, deleteDoctorQuestion, DoctorQuestion } from '@/lib/supabase';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD, TIMELINE_INSET, TEXT_PRIMARY, RADIUS } from '@/constants/DesignGuide';

export default function DoctorQuestionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<DoctorQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [editingAnswer, setEditingAnswer] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState<string>('');
  const answerInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (user) {
      loadQuestions();
    }
  }, [user]);

  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await getDoctorQuestions();

      if (error) {
        console.error('Error loading doctor questions:', error);
        Alert.alert('Fehler', 'Fragen konnten nicht geladen werden.');
        return;
      }

      if (data) {
        setQuestions(data);
      }
    } catch (err) {
      console.error('Failed to load doctor questions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!newQuestion.trim()) {
      Alert.alert('Hinweis', 'Bitte gib eine Frage ein.');
      return;
    }

    try {
      setIsSaving(true);
      const { data, error } = await saveDoctorQuestion(newQuestion.trim());

      if (error) {
        console.error('Error saving doctor question:', error);
        Alert.alert('Fehler', 'Frage konnte nicht gespeichert werden.');
        return;
      }

      if (data) {
        setQuestions([data, ...questions]);
        setNewQuestion('');
        Alert.alert('Erfolg', 'Deine Frage wurde gespeichert.');
      }
    } catch (err) {
      console.error('Failed to save doctor question:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAnswered = async (question: DoctorQuestion) => {
    try {
      const { data, error } = await updateDoctorQuestion(question.id, {
        is_answered: !question.is_answered
      });

      if (error) {
        console.error('Error updating doctor question:', error);
        Alert.alert('Fehler', 'Status konnte nicht aktualisiert werden.');
        return;
      }

      if (data) {
        setQuestions(questions.map(q => q.id === question.id ? data : q));
      }
    } catch (err) {
      console.error('Failed to update doctor question:', err);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    Alert.alert(
      'Frage löschen',
      'Möchtest du diese Frage wirklich löschen?',
      [
        {
          text: 'Abbrechen',
          style: 'cancel'
        },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteDoctorQuestion(questionId);

              if (error) {
                console.error('Error deleting doctor question:', error);
                Alert.alert('Fehler', 'Frage konnte nicht gelöscht werden.');
                return;
              }

              setQuestions(questions.filter(q => q.id !== questionId));
            } catch (err) {
              console.error('Failed to delete doctor question:', err);
            }
          }
        }
      ]
    );
  };

  const toggleExpandQuestion = (questionId: string) => {
    if (expandedQuestion === questionId) {
      setExpandedQuestion(null);
    } else {
      setExpandedQuestion(questionId);
      // Wenn wir eine Frage erweitern, setzen wir den Bearbeitungsmodus zurück
      setEditingAnswer(null);
    }
  };

  const handleStartEditAnswer = (question: DoctorQuestion) => {
    setEditingAnswer(question.id);
    setAnswerText(question.answer || '');
    // Fokus auf das Textfeld setzen, sobald es gerendert wird
    setTimeout(() => {
      if (answerInputRef.current) {
        answerInputRef.current.focus();
      }
    }, 100);
  };

  const handleSaveAnswer = async (questionId: string) => {
    try {
      const { data, error } = await updateDoctorQuestion(questionId, {
        answer: answerText.trim() || null
      });

      if (error) {
        console.error('Error saving answer:', error);
        Alert.alert('Fehler', 'Antwort konnte nicht gespeichert werden.');
        return;
      }

      if (data) {
        setQuestions(questions.map(q => q.id === questionId ? data : q));
        setEditingAnswer(null);
        Keyboard.dismiss();
      }
    } catch (err) {
      console.error('Failed to save answer:', err);
    }
  };

  const handleCancelEditAnswer = () => {
    setEditingAnswer(null);
    setAnswerText('');
    Keyboard.dismiss();
  };

  // Keine Bildschirmabmessungen mehr nötig, da ThemedBackground diese intern verwaltet

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          <Header 
            title="Fragen für den Frauenarzt" 
            showBackButton 
          />
          <ScrollView contentContainerStyle={styles.scrollContent}>

            <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
              <View style={styles.cardInnerCenter}>
                <ThemedText style={[styles.inputLabel, styles.centerText, { color: TEXT_PRIMARY }]}>Neue Frage hinzufügen</ThemedText>
                <TextInput
                  style={[styles.textInput, { color: theme.text, alignSelf: 'stretch' }]}
                  placeholder="Was möchtest du deinen Frauenarzt fragen?"
                  placeholderTextColor={theme.tabIconDefault}
                  value={newQuestion}
                  onChangeText={setNewQuestion}
                  multiline
                  numberOfLines={3}
                />
                <LiquidGlassCard
                  style={[styles.actionCard, styles.fullWidthCard]}
                  intensity={24}
                  overlayColor={'rgba(142,78,198,0.32)'}
                  borderColor={'rgba(255,255,255,0.7)'}
                  onPress={handleSaveQuestion}
                >
                  <View style={styles.actionCardInner}>
                    {isSaving ? (
                      <ActivityIndicator size="small" color={'#FFFFFF'} />
                    ) : (
                      <>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(142,78,198,0.9)' }]}>
                          <IconSymbol name="paperplane.fill" size={24} color="#FFFFFF" />
                        </View>
                        <ThemedText style={styles.actionTitle}>Frage speichern</ThemedText>
                        <ThemedText style={styles.actionDesc}>Absenden</ThemedText>
                      </>
                    )}
                  </View>
                </LiquidGlassCard>
              </View>
            </LiquidGlassCard>

            <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
              <ThemedText style={[styles.sectionTitle, styles.centerText]}>Deine gespeicherten Fragen</ThemedText>
            </LiquidGlassCard>

            {isLoading ? (
              <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.accent} />
                  <ThemedText style={[styles.loadingText, { color: TEXT_PRIMARY }]}>Fragen werden geladen...</ThemedText>
                </View>
              </LiquidGlassCard>
            ) : questions.length === 0 ? (
              <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                <View style={styles.emptyState}>
                  <IconSymbol name="questionmark.circle" size={40} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.emptyStateText, { color: TEXT_PRIMARY }]}>Noch keine Fragen gespeichert</ThemedText>
                  <ThemedText style={[styles.emptyStateSubtext, { color: TEXT_PRIMARY }]}>Füge deine erste Frage hinzu, die du deinem Frauenarzt stellen möchtest.</ThemedText>
                </View>
              </LiquidGlassCard>
            ) : (
              <View style={styles.questionsList}>
                {questions.map((question) => (
                  <LiquidGlassCard
                    key={question.id}
                    style={[styles.fullWidthCard, styles.glassCard]}
                    intensity={26}
                    overlayColor={question.is_answered ? 'rgba(168,196,162,0.32)' : GLASS_OVERLAY}
                  >
                    <TouchableOpacity
                      style={styles.questionHeader}
                      onPress={() => toggleExpandQuestion(question.id)}
                    >
                      <View style={styles.questionTitleContainer}>
                        <TouchableOpacity
                          onPress={() => handleToggleAnswered(question)}
                          style={styles.checkboxContainer}
                        >
                          <IconSymbol
                            name={question.is_answered ? "checkmark.circle.fill" : "circle"}
                            size={24}
                            color={question.is_answered ? Colors.light.success : theme.tabIconDefault}
                          />
                        </TouchableOpacity>
                        <ThemedText
                          style={[
                            styles.questionText,
                            question.is_answered && styles.answeredQuestion
                          ]}
                          numberOfLines={expandedQuestion === question.id ? undefined : 2}
                        >
                          {question.question}
                        </ThemedText>
                      </View>
                      <IconSymbol
                        name={expandedQuestion === question.id ? "chevron.up" : "chevron.down"}
                        size={20}
                        color={theme.tabIconDefault}
                      />
                    </TouchableOpacity>

                    {expandedQuestion === question.id && (
                      <View style={styles.questionActions}>
                        {/* Antwort-Bereich */}
                        <View style={styles.answerSection}>
                          <View style={styles.answerHeader}>
                            <IconSymbol name="text.bubble" size={20} color={theme.accent} />
                            <ThemedText style={styles.answerHeaderText}>Antwort des Arztes</ThemedText>
                          </View>

                          {editingAnswer === question.id ? (
                            <View style={styles.answerEditContainer}>
                              <TextInput
                                ref={answerInputRef}
                                style={[styles.answerInput, { color: theme.text }]}
                                placeholder="Antwort des Arztes eingeben..."
                                placeholderTextColor={theme.tabIconDefault}
                                value={answerText}
                                onChangeText={setAnswerText}
                                multiline
                                numberOfLines={3}
                              />
                              <View style={styles.answerEditButtons}>
                                <LiquidGlassCard
                                  style={styles.pillGlassButton}
                                  intensity={24}
                                  overlayColor={'rgba(255,107,107,0.28)'}
                                  borderColor={'rgba(255,255,255,0.7)'}
                                  onPress={handleCancelEditAnswer}
                                >
                                  <View style={styles.pillInner}>
                                    <IconSymbol name="xmark" size={14} color="#FFFFFF" />
                                    <ThemedText style={styles.pillText}>Abbrechen</ThemedText>
                                  </View>
                                </LiquidGlassCard>
                                <LiquidGlassCard
                                  style={styles.pillGlassButton}
                                  intensity={24}
                                  overlayColor={'rgba(168,196,162,0.32)'}
                                  borderColor={'rgba(255,255,255,0.7)'}
                                  onPress={() => handleSaveAnswer(question.id)}
                                >
                                  <View style={styles.pillInner}>
                                    <IconSymbol name="checkmark" size={14} color="#FFFFFF" />
                                    <ThemedText style={styles.pillText}>Speichern</ThemedText>
                                  </View>
                                </LiquidGlassCard>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.answerDisplay}
                              onPress={() => handleStartEditAnswer(question)}
                            >
                              {question.answer ? (
                                <ThemedText style={styles.answerText}>{question.answer}</ThemedText>
                              ) : (
                                <ThemedText style={styles.noAnswerText}>Noch keine Antwort gespeichert. Tippe hier, um eine Antwort hinzuzufügen.</ThemedText>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Aktions-Buttons */}
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}
                          onPress={() => handleDeleteQuestion(question.id)}
                        >
                          <ThemedText style={styles.actionButtonText}>
                            Frage löschen
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    )}
                  </LiquidGlassCard>
                ))}
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
    paddingTop: 10,
    paddingBottom: 40,
  },
  fullWidthCard: {
    marginHorizontal: TIMELINE_INSET,
  },
  glassCard: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  centerText: { textAlign: 'center' },
  cardInnerCenter: { alignItems: 'center' },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Action card styles (like Wehe starten)
  actionCard: { borderRadius: RADIUS, overflow: 'hidden', marginTop: 12 },
  actionCardInner: { alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 96 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  actionTitle: { fontSize: 15, fontWeight: '800', color: '#7D5A50' },
  actionDesc: { fontSize: 12, opacity: 0.9, color: '#7D5A50' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#7D5A50',
    paddingHorizontal: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyState: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  questionsList: {
    marginBottom: 20,
  },
  questionItem: {},
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  questionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  checkboxContainer: {
    padding: 5,  // Vergrößert den Klickbereich
    marginLeft: -5,
    marginRight: 7,
  },
  questionText: {
    fontSize: 16,
    flex: 1,
  },
  answeredQuestion: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  questionActions: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  answerSection: {
    marginBottom: 16,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  answerHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#7D5A50',
  },
  answerDisplay: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    minHeight: 60,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noAnswerText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#999',
  },
  answerEditContainer: {
    marginBottom: 8,
  },
  answerInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  answerEditButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  pillGlassButton: { borderRadius: RADIUS, overflow: 'hidden' },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12 },
  pillText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionButton: {
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
