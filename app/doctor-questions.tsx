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
import { BackButton } from '@/components/BackButton';

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
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View style={styles.backButtonContainer}>
                <BackButton />
              </View>
              <ThemedText type="title" style={styles.title}>
                Fragen für den Frauenarzt
              </ThemedText>
            </View>

            <ThemedView style={styles.inputContainer} lightColor={theme.card} darkColor={theme.card}>
              <ThemedText style={styles.inputLabel}>
                Neue Frage hinzufügen
              </ThemedText>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Was möchtest du deinen Frauenarzt fragen?"
                placeholderTextColor={theme.tabIconDefault}
                value={newQuestion}
                onChangeText={setNewQuestion}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.accent }]}
                onPress={handleSaveQuestion}
                disabled={isSaving || !newQuestion.trim()}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>
                    Frage speichern
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ThemedView>

            <ThemedText style={styles.sectionTitle}>
              Deine gespeicherten Fragen
            </ThemedText>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
                <ThemedText style={styles.loadingText}>Fragen werden geladen...</ThemedText>
              </View>
            ) : questions.length === 0 ? (
              <ThemedView style={styles.emptyState} lightColor={theme.card} darkColor={theme.card}>
                <IconSymbol name="questionmark.circle" size={40} color={theme.tabIconDefault} />
                <ThemedText style={styles.emptyStateText}>
                  Noch keine Fragen gespeichert
                </ThemedText>
                <ThemedText style={styles.emptyStateSubtext}>
                  Füge deine erste Frage hinzu, die du deinem Frauenarzt stellen möchtest.
                </ThemedText>
              </ThemedView>
            ) : (
              <View style={styles.questionsList}>
                {questions.map((question) => (
                  <ThemedView
                    key={question.id}
                    style={styles.questionItem}
                    lightColor={theme.card}
                    darkColor={theme.card}
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
                                <TouchableOpacity
                                  style={[styles.answerButton, { backgroundColor: '#FF6B6B' }]}
                                  onPress={handleCancelEditAnswer}
                                >
                                  <ThemedText style={styles.answerButtonText}>Abbrechen</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.answerButton, { backgroundColor: Colors.light.success }]}
                                  onPress={() => handleSaveAnswer(question.id)}
                                >
                                  <ThemedText style={styles.answerButtonText}>Speichern</ThemedText>
                                </TouchableOpacity>
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
                  </ThemedView>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
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
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  backButtonContainer: {
    position: 'absolute',
    left: 0,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7D5A50',
    textAlign: 'center',
  },
  inputContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#7D5A50',
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
  emptyState: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
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
  questionItem: {
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
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
  },
  answerButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  answerButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
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
