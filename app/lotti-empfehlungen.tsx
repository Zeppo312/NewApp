import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD, RADIUS } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  LottiRecommendation,
  addLottiRecommendation,
  deleteLottiRecommendation,
  getLottiRecommendations,
} from '@/lib/supabase/recommendations';

const TIMELINE_INSET = 8;

const emptyFormState = {
  title: '',
  description: '',
  imageUrl: '',
  productUrl: '',
};

type FormState = typeof emptyFormState;

export default function LottiRecommendationsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const inputBackground = colorScheme === 'dark' ? theme.cardDark : '#FFFFFF';
  const mutedSurface = colorScheme === 'dark' ? theme.cardDark : '#F7EFE5';

  const [recommendations, setRecommendations] = useState<LottiRecommendation[]>([]);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    try {
      setErrorMessage(null);
      const { data, error } = await getLottiRecommendations();
      if (error) throw error;
      setRecommendations(data ?? []);
    } catch (error) {
      console.error('Error loading recommendations', error);
      setErrorMessage('Die Empfehlungen konnten nicht geladen werden. Bitte versuche es erneut.');
    }
  }, []);

  const evaluateAdminStatus = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data?.user_role === 'admin') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin role', error);
      setIsAdmin(false);
    }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([evaluateAdminStatus(), loadRecommendations()]);
      setIsLoading(false);
    };

    load();
  }, [evaluateAdminStatus, loadRecommendations]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRecommendations();
    setIsRefreshing(false);
  }, [loadRecommendations]);

  const updateFormField = useCallback((field: keyof FormState, value: string) => {
    setFormState(current => ({ ...current, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(emptyFormState);
  }, []);

  const handleAddRecommendation = useCallback(async () => {
    if (!formState.title.trim() || !formState.description.trim()) {
      Alert.alert('Hinweis', 'Bitte gib mindestens einen Titel und eine Beschreibung ein.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await addLottiRecommendation({
        title: formState.title,
        description: formState.description,
        imageUrl: formState.imageUrl,
        productUrl: formState.productUrl,
      });

      if (error) throw error;

      await loadRecommendations();
      resetForm();
      Alert.alert('Erfolg', 'Die Empfehlung wurde hinzugefügt.');
    } catch (error) {
      console.error('Error adding recommendation', error);
      Alert.alert('Fehler', 'Die Empfehlung konnte nicht gespeichert werden.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formState, loadRecommendations, resetForm]);

  const confirmDeleteRecommendation = useCallback((id: string) => {
    Alert.alert(
      'Empfehlung entfernen',
      'Möchtest du diese Empfehlung wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteLottiRecommendation(id);
              if (error) throw error;
              await loadRecommendations();
              Alert.alert('Entfernt', 'Die Empfehlung wurde gelöscht.');
            } catch (error) {
              console.error('Error deleting recommendation', error);
              Alert.alert('Fehler', 'Die Empfehlung konnte nicht gelöscht werden.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [loadRecommendations]);

  const handleOpenLink = useCallback(async (url?: string | null) => {
    if (!url) {
      Alert.alert('Hinweis', 'Für dieses Produkt ist kein Link hinterlegt.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Fehler', 'Der Link kann nicht geöffnet werden.');
      }
    } catch (error) {
      console.error('Error opening link', error);
      Alert.alert('Fehler', 'Der Link konnte nicht geöffnet werden.');
    }
  }, []);

  const hasRecommendations = recommendations.length > 0;

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header
          title="Lottis Empfehlungen"
          subtitle="Handverlesene Produkte für dich"
          showBackButton
          onBackPress={() => router.back()}
        />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade Empfehlungen…</ThemedText>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                tintColor={theme.accent}
                colors={[theme.accent]}
                refreshing={isRefreshing}
                onRefresh={onRefresh}
              />
            }
          >
            {errorMessage && (
              <LiquidGlassCard style={styles.errorCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </LiquidGlassCard>
            )}

            {isAdmin && (
              <LiquidGlassCard style={styles.formCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                <ThemedText style={styles.sectionTitle}>Neue Empfehlung hinzufügen</ThemedText>

                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>Titel</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBackground }]}
                    placeholder="Produktname"
                    placeholderTextColor={theme.tabIconDefault}
                    value={formState.title}
                    onChangeText={text => updateFormField('title', text)}
                    autoCapitalize="sentences"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>Beschreibung</ThemedText>
                  <TextInput
                    style={[styles.input, styles.multilineInput, { backgroundColor: inputBackground }]}
                    placeholder="Warum ist dieses Produkt besonders hilfreich?"
                    placeholderTextColor={theme.tabIconDefault}
                    value={formState.description}
                    onChangeText={text => updateFormField('description', text)}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={styles.inputGroupHalf}>
                    <ThemedText style={styles.inputLabel}>Bild-URL</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground }]}
                      placeholder="https://…"
                      placeholderTextColor={theme.tabIconDefault}
                      value={formState.imageUrl}
                      onChangeText={text => updateFormField('imageUrl', text)}
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.inputGroupHalf}>
                    <ThemedText style={styles.inputLabel}>Produkt-Link</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackground }]}
                      placeholder="https://…"
                      placeholderTextColor={theme.tabIconDefault}
                      value={formState.productUrl}
                      onChangeText={text => updateFormField('productUrl', text)}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.addButton, isSubmitting && styles.addButtonDisabled]}
                  onPress={handleAddRecommendation}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.addButtonContent}>
                      <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.addButtonText}>Empfehlung speichern</ThemedText>
                    </View>
                  )}
                </TouchableOpacity>
              </LiquidGlassCard>
            )}

            <ThemedText style={styles.sectionTitle}>Unsere Favoriten</ThemedText>

            {hasRecommendations ? (
              recommendations.map(item => (
                <LiquidGlassCard key={item.id} style={styles.recommendationCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.recommendationImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.placeholderImage, { backgroundColor: mutedSurface }]}>
                      <IconSymbol name="sparkles" size={32} color={theme.accent} />
                    </View>
                  )}

                  <View style={styles.recommendationContent}>
                    <ThemedText style={styles.recommendationTitle}>{item.title}</ThemedText>
                    <ThemedText style={styles.recommendationDescription}>{item.description}</ThemedText>

                    <TouchableOpacity
                      style={[styles.linkButton, { backgroundColor: theme.accent }]}
                      onPress={() => handleOpenLink(item.product_url)}
                      activeOpacity={0.85}
                    >
                      <ThemedText style={styles.linkButtonText}>Zum Produkt</ThemedText>
                      <IconSymbol name="arrow.up.right" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => confirmDeleteRecommendation(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <IconSymbol name="trash" size={18} color={theme.error} />
                    </TouchableOpacity>
                  )}
                </LiquidGlassCard>
              ))
            ) : (
              <LiquidGlassCard style={styles.emptyStateCard} intensity={24} overlayColor={GLASS_OVERLAY}>
                <IconSymbol name="star" size={28} color={theme.accent} />
                <ThemedText style={styles.emptyStateTitle}>Noch keine Empfehlungen</ThemedText>
                <ThemedText style={styles.emptyStateText}>
                  Schau später wieder vorbei. Hier findest du bald handverlesene Produkte aus dem LottiBaby-Team.
                </ThemedText>
              </LiquidGlassCard>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: TIMELINE_INSET,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
  },
  errorCard: {
    borderRadius: RADIUS,
    padding: 16,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  formCard: {
    borderRadius: RADIUS,
    padding: 18,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputGroupHalf: {
    flex: 1,
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2F2F35',
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  addButton: {
    borderRadius: 18,
    backgroundColor: '#7D5A50',
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  recommendationCard: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    padding: 0,
  },
  recommendationImage: {
    width: '100%',
    height: 190,
  },
  placeholderImage: {
    width: '100%',
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationContent: {
    padding: 18,
    gap: 12,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  recommendationDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 12,
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emptyStateCard: {
    borderRadius: RADIUS,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
