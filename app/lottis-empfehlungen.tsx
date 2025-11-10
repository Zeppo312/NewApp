import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  Linking,
  Image,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import SlideInView from '@/components/animations/SlideInView';
import AnimatedButton from '@/components/animations/AnimatedButton';
import * as ImagePicker from 'expo-image-picker';
import {
  getRecommendations,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  isUserAdmin,
  uploadRecommendationImage,
  LottiRecommendation,
  CreateRecommendationInput,
} from '@/lib/supabase/recommendations';

const TIMELINE_INSET = 8;

export default function LottisEmpfehlungenScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [recommendations, setRecommendations] = useState<LottiRecommendation[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<LottiRecommendation | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageUri, setFormImageUri] = useState<string | null>(null);
  const [formProductLink, setFormProductLink] = useState('');
  const [formDiscountCode, setFormDiscountCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [adminStatus, items] = await Promise.all([
        isUserAdmin(),
        getRecommendations(),
      ]);
      setIsAdmin(adminStatus);
      setRecommendations(items);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormDescription('');
    setFormImageUrl('');
    setFormImageUri(null);
    setFormProductLink('');
    setFormDiscountCode('');
    setModalVisible(true);
  };

  const handleEdit = (item: LottiRecommendation) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDescription(item.description);
    setFormImageUrl(item.image_url || '');
    setFormImageUri(null);
    setFormProductLink(item.product_link);
    setFormDiscountCode(item.discount_code || '');
    setModalVisible(true);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Zugriff auf deine Fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setFormImageUri(result.assets[0].uri);
        setFormImageUrl(''); // Clear URL if user picks an image
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fehler', 'Bild konnte nicht ausgewählt werden.');
    }
  };

  const handleDelete = (item: LottiRecommendation) => {
    Alert.alert(
      'Empfehlung löschen',
      `Möchtest du "${item.title}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecommendation(item.id);
              await loadData();
              Alert.alert('Erfolg', 'Empfehlung wurde gelöscht.');
            } catch (error) {
              Alert.alert('Fehler', 'Empfehlung konnte nicht gelöscht werden.');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formDescription.trim() || !formProductLink.trim()) {
      Alert.alert('Fehler', 'Bitte fülle alle Pflichtfelder aus.');
      return;
    }

    try {
      setIsSaving(true);
      let imageUrl = formImageUrl.trim();

      // Upload image if user picked one
      if (formImageUri) {
        setIsUploadingImage(true);
        try {
          console.log('📤 Starting upload for URI:', formImageUri);
          const fileName = `recommendation-${Date.now()}.jpg`;
          imageUrl = await uploadRecommendationImage(formImageUri, fileName);
          console.log('✅ Upload successful, URL:', imageUrl);
        } catch (error) {
          console.error('❌ Error uploading image:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
          Alert.alert(
            'Upload fehlgeschlagen', 
            `${errorMessage}\n\nTipp: Stelle sicher, dass der "public-images" Bucket in Supabase existiert.`,
            [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Ohne Bild fortfahren', onPress: () => {
                setFormImageUri(null);
                // Continue without image
              }}
            ]
          );
          setIsSaving(false);
          setIsUploadingImage(false);
          return;
        }
        setIsUploadingImage(false);
      }

      const input: CreateRecommendationInput = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        image_url: imageUrl || undefined,
        product_link: formProductLink.trim(),
        discount_code: formDiscountCode.trim() || undefined,
        order_index: editingItem?.order_index || recommendations.length,
      };

      if (editingItem) {
        await updateRecommendation(editingItem.id, input);
      } else {
        await createRecommendation(input);
      }

      await loadData();
      setModalVisible(false);
      Alert.alert('Erfolg', `Empfehlung wurde ${editingItem ? 'aktualisiert' : 'erstellt'}.`);
    } catch (error) {
      console.error('❌ Error saving recommendation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      Alert.alert('Fehler', `Empfehlung konnte nicht gespeichert werden.\n\n${errorMessage}`);
    } finally {
      setIsSaving(false);
      setIsUploadingImage(false);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Fehler', 'Dieser Link kann nicht geöffnet werden.');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Link konnte nicht geöffnet werden.');
    }
  };

  const renderRecommendationCard = (item: LottiRecommendation, index: number) => {
    return (
      <SlideInView
        key={item.id}
        direction={index % 2 === 0 ? 'left' : 'right'}
        delay={300 + index * 100}
        duration={600}
        easing="spring"
      >
        <BlurView intensity={25} tint={colorScheme} style={styles.cardBlur}>
          <LinearGradient
            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.card}>
              {/* Bild */}
              {item.image_url && (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Content */}
              <View style={styles.cardContent}>
                <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.cardDescription}>{item.description}</ThemedText>

                {/* Discount Code */}
                {item.discount_code && (
                  <BlurView intensity={20} tint={colorScheme} style={styles.discountCodeContainer}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.discountCodeGradient}
                    >
                      <IconSymbol name="tag.fill" size={16} color="#8E4EC6" />
                      <ThemedText style={styles.discountCodeLabel}>Rabattcode:</ThemedText>
                      <ThemedText style={styles.discountCodeText}>{item.discount_code}</ThemedText>
                    </LinearGradient>
                  </BlurView>
                )}

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <AnimatedButton onPress={() => handleOpenLink(item.product_link)} scaleValue={0.95}>
                    <BlurView intensity={20} tint="light" style={styles.linkButton}>
                      <LinearGradient
                        colors={['rgba(142,78,198,0.8)', 'rgba(123,63,181,0.9)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.linkButtonGradient}
                      >
                        <IconSymbol name="link" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.linkButtonText}>Zum Produkt</ThemedText>
                      </LinearGradient>
                    </BlurView>
                  </AnimatedButton>

                  {isAdmin && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        style={[styles.adminButton, styles.editButton]}
                        onPress={() => handleEdit(item)}
                      >
                        <BlurView intensity={15} tint="light" style={styles.adminButtonBlur}>
                          <IconSymbol name="pencil" size={20} color="#4A90E2" />
                        </BlurView>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.adminButton, styles.deleteButton]}
                        onPress={() => handleDelete(item)}
                      >
                        <BlurView intensity={15} tint="light" style={styles.adminButtonBlur}>
                          <IconSymbol name="trash" size={20} color="#E74C3C" />
                        </BlurView>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </SlideInView>
    );
  };

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header 
          title="Lottis Empfehlungen" 
          subtitle="Handverlesene Produkte für dich und dein Baby"
          showBackButton={true}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Admin Add Button */}
          {isAdmin && (
            <SlideInView direction="down" delay={100} duration={500} easing="spring">
              <AnimatedButton onPress={handleAddNew} scaleValue={0.95}>
                <LinearGradient
                  colors={['#38A169', '#2F855A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addButton}
                >
                  <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
                  <ThemedText style={styles.addButtonText}>Neue Empfehlung</ThemedText>
                </LinearGradient>
              </AnimatedButton>
            </SlideInView>
          )}

          {/* Loading State */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={styles.loadingText}>Lade Empfehlungen...</ThemedText>
            </View>
          ) : recommendations.length === 0 ? (
            /* Empty State */
            <SlideInView direction="up" delay={200} duration={600}>
              <LiquidGlassCard style={styles.emptyCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                <IconSymbol name="star.fill" size={60} color={theme.accent} />
                <ThemedText style={styles.emptyTitle}>Noch keine Empfehlungen</ThemedText>
                <ThemedText style={styles.emptyDescription}>
                  {isAdmin
                    ? 'Füge die erste Empfehlung hinzu!'
                    : 'Schau bald wieder vorbei für tolle Produktempfehlungen!'}
                </ThemedText>
              </LiquidGlassCard>
            </SlideInView>
          ) : (
            /* Recommendations List */
            <View style={styles.listContainer}>
              {recommendations.map((item, index) => renderRecommendationCard(item, index))}
            </View>
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={80} tint={colorScheme} style={styles.modalBlur}>
              <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                <View style={styles.modalHeader}>
                  <ThemedText style={styles.modalTitle}>
                    {editingItem ? 'Empfehlung bearbeiten' : 'Neue Empfehlung'}
                  </ThemedText>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <IconSymbol name="xmark.circle.fill" size={30} color={theme.tabIconDefault} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Titel *</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.tabIconDefault }]}
                      value={formTitle}
                      onChangeText={setFormTitle}
                      placeholder="z.B. Beste Baby-Tragetasche"
                      placeholderTextColor={theme.tabIconDefault}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Beschreibung *</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        styles.textArea,
                        { color: theme.text, borderColor: theme.tabIconDefault },
                      ]}
                      value={formDescription}
                      onChangeText={setFormDescription}
                      placeholder="Beschreibe das Produkt..."
                      placeholderTextColor={theme.tabIconDefault}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Produktbild</ThemedText>
                    
                    {/* Image Picker Button */}
                    <TouchableOpacity 
                      style={styles.imagePickerButton}
                      onPress={handlePickImage}
                      disabled={isUploadingImage}
                    >
                      <BlurView intensity={15} tint={colorScheme} style={styles.imagePickerBlur}>
                        <LinearGradient
                          colors={['rgba(142,78,198,0.2)', 'rgba(123,63,181,0.15)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.imagePickerGradient}
                        >
                          {formImageUri || (formImageUrl && !formImageUri) ? (
                            <View style={styles.imagePreviewContainer}>
                              <Image
                                source={{ uri: formImageUri || formImageUrl }}
                                style={styles.imagePreview}
                                resizeMode="cover"
                              />
                              <View style={styles.imageChangeOverlay}>
                                <IconSymbol name="photo" size={24} color="#FFFFFF" />
                                <ThemedText style={styles.imageChangeText}>Bild ändern</ThemedText>
                              </View>
                            </View>
                          ) : (
                            <>
                              <IconSymbol name="photo" size={32} color={theme.accent} />
                              <ThemedText style={styles.imagePickerText}>Bild auswählen</ThemedText>
                            </>
                          )}
                        </LinearGradient>
                      </BlurView>
                    </TouchableOpacity>

                    {/* Optional: URL Input */}
                    <View style={styles.orDivider}>
                      <View style={styles.orLine} />
                      <ThemedText style={styles.orText}>oder</ThemedText>
                      <View style={styles.orLine} />
                    </View>
                    
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.tabIconDefault }]}
                      value={formImageUrl}
                      onChangeText={(text) => {
                        setFormImageUrl(text);
                        setFormImageUri(null); // Clear picked image if URL is entered
                      }}
                      placeholder="Bild-URL eingeben (https://...)"
                      placeholderTextColor={theme.tabIconDefault}
                      autoCapitalize="none"
                      keyboardType="url"
                      editable={!formImageUri}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Produkt-Link *</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.tabIconDefault }]}
                      value={formProductLink}
                      onChangeText={setFormProductLink}
                      placeholder="https://..."
                      placeholderTextColor={theme.tabIconDefault}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Rabattcode</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.tabIconDefault }]}
                      value={formDiscountCode}
                      onChangeText={setFormDiscountCode}
                      placeholder="z.B. LOTTI10"
                      placeholderTextColor={theme.tabIconDefault}
                      autoCapitalize="characters"
                    />
                    <ThemedText style={styles.fieldHint}>
                      Optional: Code für Checkout (z.B. LOTTI10 für 10% Rabatt)
                    </ThemedText>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setModalVisible(false)}
                    disabled={isSaving}
                  >
                    <ThemedText style={styles.cancelButtonText}>Abbrechen</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <View style={styles.savingContainer}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <ThemedText style={styles.savingText}>
                          {isUploadingImage ? 'Bild wird hochgeladen...' : 'Speichere...'}
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText style={styles.saveButtonText}>Speichern</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#38A169',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
    borderRadius: 22,
    marginHorizontal: TIMELINE_INSET,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContainer: {
    gap: 16,
  },
  cardBlur: {
    borderRadius: 22,
    overflow: 'hidden',
    marginHorizontal: TIMELINE_INSET,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  cardGradient: {
    borderRadius: 22,
  },
  card: {
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    opacity: 0.85,
    textShadowColor: 'rgba(0,0,0,0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  discountCodeContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.3)',
  },
  discountCodeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  discountCodeLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  discountCodeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8E4EC6',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkButton: {
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1,
    marginRight: 10,
    shadowColor: '#8E4EC6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  linkButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 10,
  },
  adminButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    shadowColor: '#000',
  },
  adminButtonBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  editButton: {
    borderWidth: 1,
    borderColor: 'rgba(74,144,226,0.3)',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.3)',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBlur: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  modalScroll: {
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  fieldHint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 6,
    fontStyle: 'italic',
  },
  imagePickerButton: {
    marginBottom: 12,
  },
  imagePickerBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(142,78,198,0.3)',
  },
  imagePickerGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  imagePickerText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
    opacity: 0.8,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageChangeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageChangeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  orText: {
    paddingHorizontal: 12,
    fontSize: 13,
    opacity: 0.5,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#E9C9B6',
  },
  cancelButtonText: {
    color: '#5C4033',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#8E4EC6',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

