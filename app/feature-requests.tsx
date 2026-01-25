import React, { useState, useEffect } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  saveFeatureRequest,
  getFeatureRequests,
  deleteFeatureRequest,
  type FeatureRequest,
} from '@/lib/supabase';

type Category = 'feature' | 'improvement' | 'bug-fix';
type Priority = 'low' | 'medium' | 'high';

const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: 'feature', label: 'Neues Feature', icon: 'sparkles' },
  { value: 'improvement', label: 'Verbesserung', icon: 'arrow.up.circle' },
  { value: 'bug-fix', label: 'Fehler beheben', icon: 'ladybug' },
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Niedrig', color: '#3A9E8C' },
  { value: 'medium', label: 'Mittel', color: '#E9C9B6' },
  { value: 'high', label: 'Hoch', color: '#FF6B6B' },
];

export default function FeatureRequestsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('feature');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<FeatureRequest[]>([]);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setIsLoading(true);
    const { data, error } = await getFeatureRequests();
    if (error) {
      console.error('Error loading feature requests:', error);
    } else {
      setRequests(data || []);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Titel ein.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Fehler', 'Bitte gib eine Beschreibung ein.');
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await saveFeatureRequest({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
    });

    setIsSubmitting(false);

    if (error) {
      console.error('Error saving feature request:', error);
      Alert.alert('Fehler', 'Dein Vorschlag konnte nicht gespeichert werden. Bitte versuche es später erneut.');
    } else {
      Alert.alert('Erfolg', 'Vielen Dank für deinen Verbesserungsvorschlag!');
      setTitle('');
      setDescription('');
      setCategory('feature');
      setPriority('medium');
      loadRequests();
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Vorschlag löschen',
      'Möchtest du diesen Vorschlag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteFeatureRequest(id);
            if (error) {
              Alert.alert('Fehler', 'Der Vorschlag konnte nicht gelöscht werden.');
            } else {
              loadRequests();
            }
          },
        },
      ]
    );
  };

  const getCategoryInfo = (cat: Category) => {
    return CATEGORIES.find((c) => c.value === cat) || CATEGORIES[0];
  };

  const getPriorityInfo = (prio: Priority) => {
    return PRIORITIES.find((p) => p.value === prio) || PRIORITIES[1];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />

          <Header
            title="Verbesserungen"
            subtitle="Deine Ideen für die App"
            showBackButton
            onBackPress={() => router.push('/more')}
          />

          <ScrollView contentContainerStyle={styles.content}>
            {/* Formular */}
            <LiquidGlassCard style={styles.card} intensity={26} overlayColor={GLASS_OVERLAY}>
              <ThemedText style={styles.sectionTitle}>Neuer Vorschlag</ThemedText>

              <ThemedText style={styles.label}>Titel</ThemedText>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Kurze Beschreibung deiner Idee"
                placeholderTextColor="rgba(0,0,0,0.35)"
                style={styles.input}
                autoCorrect={true}
                autoCapitalize="sentences"
                returnKeyType="next"
              />

              <ThemedText style={styles.label}>Kategorie</ThemedText>
              <View style={styles.categoryContainer}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryButton,
                      category === cat.value && styles.categoryButtonActive,
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <IconSymbol
                      name={cat.icon}
                      size={20}
                      color={category === cat.value ? '#fff' : theme.accent}
                    />
                    <ThemedText
                      style={[
                        styles.categoryButtonText,
                        category === cat.value && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={styles.label}>Priorität</ThemedText>
              <View style={styles.priorityContainer}>
                {PRIORITIES.map((prio) => (
                  <TouchableOpacity
                    key={prio.value}
                    style={[
                      styles.priorityButton,
                      priority === prio.value && { backgroundColor: prio.color },
                    ]}
                    onPress={() => setPriority(prio.value)}
                  >
                    <ThemedText
                      style={[
                        styles.priorityButtonText,
                        priority === prio.value && styles.priorityButtonTextActive,
                      ]}
                    >
                      {prio.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={styles.label}>Beschreibung</ThemedText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Was genau möchtest du verbessert haben? Je detaillierter, desto besser können wir deinen Vorschlag umsetzen."
                placeholderTextColor="rgba(0,0,0,0.35)"
                style={[styles.input, styles.textarea]}
                multiline
                textAlignVertical="top"
                autoCorrect={true}
                autoCapitalize="sentences"
              />

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.9}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#5C4033" />
                ) : (
                  <ThemedText style={styles.submitButtonText}>Vorschlag einreichen</ThemedText>
                )}
              </TouchableOpacity>
            </LiquidGlassCard>

            {/* Liste der Vorschläge */}
            <LiquidGlassCard style={styles.card} intensity={26} overlayColor={GLASS_OVERLAY}>
              <ThemedText style={styles.sectionTitle}>Deine Vorschläge</ThemedText>

              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={theme.accent} />
                </View>
              ) : requests.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="tray" size={40} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyText}>
                    Du hast noch keine Vorschläge eingereicht.
                  </ThemedText>
                </View>
              ) : (
                requests.map((request, index) => {
                  const categoryInfo = getCategoryInfo(request.category);
                  const priorityInfo = getPriorityInfo(request.priority);

                  return (
                    <View
                      key={request.id}
                      style={[styles.requestItem, index === 0 && styles.requestItemFirst]}
                    >
                      <View style={styles.requestHeader}>
                        <View style={styles.requestHeaderLeft}>
                          <IconSymbol name={categoryInfo.icon} size={20} color={theme.accent} />
                          <ThemedText style={styles.requestTitle}>{request.title}</ThemedText>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(request.id)}>
                          <IconSymbol name="trash" size={18} color="#FF6B6B" />
                        </TouchableOpacity>
                      </View>

                      <ThemedText style={styles.requestDescription}>
                        {request.description}
                      </ThemedText>

                      <View style={styles.requestFooter}>
                        <View style={styles.requestTags}>
                          <View
                            style={[styles.priorityTag, { backgroundColor: priorityInfo.color }]}
                          >
                            <ThemedText style={styles.priorityTagText}>
                              {priorityInfo.label}
                            </ThemedText>
                          </View>
                          <View style={styles.categoryTag}>
                            <ThemedText style={styles.categoryTagText}>
                              {categoryInfo.label}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.requestDate}>
                          {formatDate(request.created_at)}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })
              )}
            </LiquidGlassCard>
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
  },
  card: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  label: {
    fontSize: 13,
    opacity: 0.85,
    paddingHorizontal: 16,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    fontSize: 15,
    color: '#5C4033',
  },
  textarea: {
    minHeight: 120,
  },
  categoryContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 6,
  },
  categoryButtonActive: {
    backgroundColor: '#3A9E8C',
    borderColor: '#3A9E8C',
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C4033',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  priorityContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
  },
  priorityButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C4033',
  },
  priorityButtonTextActive: {
    color: '#fff',
  },
  submitButton: {
    marginHorizontal: 16,
    marginBottom: 18,
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#E9C9B6',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#5C4033',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  requestItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  requestItemFirst: {
    borderTopWidth: 0,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  requestDescription: {
    fontSize: 14,
    opacity: 0.85,
    marginBottom: 12,
    lineHeight: 20,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestTags: {
    flexDirection: 'row',
    gap: 6,
  },
  priorityTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(58, 158, 140, 0.15)',
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3A9E8C',
  },
  requestDate: {
    fontSize: 11,
    opacity: 0.6,
  },
});
