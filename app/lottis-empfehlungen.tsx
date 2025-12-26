import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Clipboard,
  Switch,
  Animated,
  Easing,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
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
  updateRecommendationsOrder,
  LottiRecommendation,
  CreateRecommendationInput,
} from '@/lib/supabase/recommendations';

const TIMELINE_INSET = 8;

function WiggleView({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, {
          toValue: 1,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: -1,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [enabled, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1.2deg', '1.2deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      {children}
    </Animated.View>
  );
}

export default function LottisEmpfehlungenScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [recommendations, setRecommendations] = useState<LottiRecommendation[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<LottiRecommendation | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageUri, setFormImageUri] = useState<string | null>(null);
  const [formProductLink, setFormProductLink] = useState('');
  const [formButtonText, setFormButtonText] = useState('Zum Produkt');
  const [formIsFavorite, setFormIsFavorite] = useState(false);
  const [formDiscountCode, setFormDiscountCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
    setFormButtonText('Zum Produkt');
    setFormIsFavorite(false);
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
    setFormButtonText(item.button_text?.trim() || 'Zum Produkt');
    setFormIsFavorite(item.is_favorite ?? false);
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

      const buttonText = formButtonText.trim() || 'Zum Produkt';
      const input: CreateRecommendationInput = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        image_url: imageUrl || undefined,
        product_link: formProductLink.trim(),
        button_text: buttonText,
        is_favorite: formIsFavorite,
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

  const handleCopyDiscountCode = async (code: string) => {
    try {
      await Clipboard.setString(code);
      setCopiedCode(code);
      
      // Feedback anzeigen
      Alert.alert(
        '✅ Kopiert!',
        `Der Rabattcode "${code}" wurde in die Zwischenablage kopiert.`,
        [{ text: 'OK', style: 'default' }]
      );

      // Reset nach 3 Sekunden
      setTimeout(() => {
        setCopiedCode(null);
      }, 3000);
    } catch (error) {
      Alert.alert('Fehler', 'Code konnte nicht kopiert werden.');
    }
  };

  const renderRecommendationCard = (item: LottiRecommendation, index: number) => {
    const buttonText = item.button_text?.trim() || 'Zum Produkt';
    return (
      <SlideInView
        direction={index % 2 === 0 ? 'left' : 'right'}
        delay={300 + index * 100}
        duration={600}
        easing="spring"
      >
        <View style={styles.cardWrapper}>
          {/* Lottis Favorit Badge */}
          {item.is_favorite && (
            <View style={styles.favoriteBadgeWrapper} pointerEvents="none">
              <View style={styles.favoritePin}>
                <View style={styles.favoritePinHead} />
                <View style={styles.favoritePinStem} />
              </View>
              <View style={styles.favoriteBadge}>
                <ThemedText style={styles.favoriteBadgeText}>Lottis Favorit</ThemedText>
              </View>
            </View>
          )}
          <BlurView intensity={40} tint="light" style={styles.cardBlur}>
            <LinearGradient
              colors={['rgba(245,238,224,0.3)', 'rgba(232,219,247,0.4)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.cardGradient}
            >
              <View style={styles.card}>
                {/* Produktbild - überlappend */}
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
                  {/* Baby-Symbol über Titel */}
                  <View style={styles.titleIconContainer}>
                    <IconSymbol name="heart.fill" size={18} color="#5E3DB3" />
                  </View>

                  <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
                  <ThemedText style={styles.cardDescription}>{item.description}</ThemedText>

                  {/* Rabattcode mit Sparkles */}
                  {item.discount_code && (
                    <TouchableOpacity 
                      onPress={() => handleCopyDiscountCode(item.discount_code!)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.discountCodeContainer}>
                        <View style={styles.discountCodeInner}>
                          <ThemedText style={styles.sparkle}>✨</ThemedText>
                          <ThemedText style={styles.discountCodeLabel}>
                            Rabattcode:
                          </ThemedText>
                          <ThemedText style={styles.discountCodeText}>
                            {item.discount_code}
                          </ThemedText>
                          <ThemedText style={styles.sparkle}>✨</ThemedText>
                          {copiedCode === item.discount_code && (
                            <View style={styles.copiedIndicator}>
                              <IconSymbol name="checkmark.circle.fill" size={16} color="#38A169" />
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Zum Produkt Button */}
                  <AnimatedButton onPress={() => handleOpenLink(item.product_link)} scaleValue={0.96}>
                    <LinearGradient
                      colors={['#5E3DB3', '#7B4BC7']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.linkButton}
                    >
                      <IconSymbol name="arrow.right.circle.fill" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.linkButtonText}>{buttonText}</ThemedText>
                    </LinearGradient>
                  </AnimatedButton>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        style={[styles.adminButton, styles.editButton]}
                        onPress={() => handleEdit(item)}
                      >
                        <IconSymbol name="pencil.circle.fill" size={26} color="#5E3DB3" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.adminButton, styles.deleteButton]}
                        onPress={() => handleDelete(item)}
                      >
                        <IconSymbol name="trash.circle.fill" size={26} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </BlurView>
        </View>
      </SlideInView>
    );
  };

  const handleDragEnd = async (data: LottiRecommendation[]) => {
    if (!isAdmin) {
      setIsReordering(false);
      return;
    }

    const previous = recommendations;
    const reordered = data.map((item, index) => ({
      ...item,
      order_index: index,
    }));
    setRecommendations(reordered);
    setIsReordering(false);

    try {
      const updates = reordered.map((item, index) => ({
        id: item.id,
        order_index: index,
      }));
      await updateRecommendationsOrder(updates);
    } catch (error) {
      console.error('Error updating recommendations order:', error);
      setRecommendations(previous);
      Alert.alert('Fehler', 'Reihenfolge konnte nicht gespeichert werden.');
    }
  };

  const listData = useMemo(
    () => (isLoading ? [] : recommendations),
    [isLoading, recommendations]
  );

  const renderListHeader = () => (
    <>
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
    </>
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <ThemedText style={styles.loadingText}>Lade Empfehlungen...</ThemedText>
        </View>
      );
    }

    return (
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

        <DraggableFlatList
          data={listData}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyState}
          onDragBegin={() => setIsReordering(true)}
          onDragEnd={({ data }) => handleDragEnd(data)}
          renderItem={({ item, index, drag, isActive }: RenderItemParams<LottiRecommendation>) => (
            <ScaleDecorator>
              <WiggleView enabled={isAdmin && isReordering && !isActive}>
                <TouchableOpacity
                  activeOpacity={1}
                  delayLongPress={220}
                  disabled={!isAdmin}
                  onLongPress={() => {
                    if (!isAdmin) return;
                    drag();
                  }}
                  style={isActive ? styles.draggingCard : undefined}
                >
                  {renderRecommendationCard(item, index)}
                </TouchableOpacity>
              </WiggleView>
            </ScaleDecorator>
          )}
        />

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
                    <View style={styles.switchRow}>
                      <ThemedText style={[styles.label, styles.switchLabel]}>Lottis Favorit</ThemedText>
                      <Switch
                        value={formIsFavorite}
                        onValueChange={setFormIsFavorite}
                        trackColor={{ false: 'rgba(0,0,0,0.15)', true: '#C9A188' }}
                        thumbColor={formIsFavorite ? '#FFF4E9' : '#F1ECE6'}
                        ios_backgroundColor="rgba(0,0,0,0.15)"
                      />
                    </View>
                    <ThemedText style={styles.fieldHint}>
                      Optional: Zeigt den angepinnten Favorit-Badge
                    </ThemedText>
                  </View>

                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Button-Text</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.tabIconDefault }]}
                      value={formButtonText}
                      onChangeText={setFormButtonText}
                      placeholder="Zum Produkt"
                      placeholderTextColor={theme.tabIconDefault}
                    />
                    <ThemedText style={styles.fieldHint}>
                      Optional: Standard ist "Zum Produkt"
                    </ThemedText>
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
  draggingCard: {
    opacity: 0.96,
  },
  cardWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
  },
  cardBlur: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  cardGradient: {
    borderRadius: 22,
  },
  card: {
    overflow: 'hidden',
    position: 'relative',
  },
  favoriteBadgeWrapper: {
    position: 'absolute',
    top: 2,
    right: 8,
    zIndex: 10,
    elevation: 14,
    alignItems: 'flex-end',
    transform: [{ rotate: '-2deg' }],
  },
  favoritePin: {
    position: 'absolute',
    top: -8,
    right: 14,
    alignItems: 'center',
    zIndex: 11,
  },
  favoritePinHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D8B8A4',
    borderWidth: 1,
    borderColor: 'rgba(143,107,87,0.4)',
    shadowColor: '#8C6A58',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  favoritePinStem: {
    width: 2,
    height: 10,
    backgroundColor: '#B58C74',
    marginTop: -1,
    borderRadius: 1,
  },
  favoriteBadge: {
    backgroundColor: 'rgba(255,248,236,0.98)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(185,141,116,0.4)',
    shadowColor: '#8C6A58',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  favoriteBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8A6A58',
    letterSpacing: 0.2,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: -8,
    marginHorizontal: -1,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    padding: 22,
    alignItems: 'center',
  },
  titleIconContainer: {
    marginBottom: 10,
    backgroundColor: 'rgba(94,61,179,0.12)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.2)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.4,
    color: '#5E3DB3',
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 18,
    color: 'rgba(0,0,0,0.75)',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  discountCodeContainer: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(94,61,179,0.4)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  discountCodeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 6,
    position: 'relative',
  },
  sparkle: {
    fontSize: 14,
  },
  discountCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.7)',
  },
  discountCodeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5E3DB3',
    letterSpacing: 0.8,
  },
  copiedIndicator: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -8,
  },
  linkButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 18,
    gap: 8,
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    justifyContent: 'center',
  },
  adminButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    // No additional styles needed
  },
  deleteButton: {
    // No additional styles needed
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    marginBottom: 0,
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
