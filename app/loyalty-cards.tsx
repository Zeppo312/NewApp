import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Code128Barcode } from '@/components/code-128-barcode';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLocale } from '@/contexts/LocaleContext';
import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LiquidGlassCard, PRIMARY, RADIUS } from '@/constants/DesignGuide';
import { canEncodeCode128 } from '@/lib/code-128';
import { translateLoyaltyCards, type LoyaltyCardsTranslationKey } from '@/lib/loyaltyCardsTranslations';
import {
  createLoyaltyCard,
  deleteLoyaltyCard,
  fetchLoyaltyCards,
  LoyaltyCard,
} from '@/lib/loyalty-cards';

type CardPreset = { name: string; color: string };

const CARD_PRESETS: CardPreset[] = [
  { name: 'PAYBACK', color: '#1B63B7' },
  { name: 'Kaufland Card', color: '#D9252A' },
  { name: 'EDEKA', color: '#F3C400' },
  { name: 'dm', color: '#E94E1B' },
  { name: 'REWE', color: '#CC071E' },
  { name: 'Andere Karte', color: PRIMARY },
];

const DEFAULT_PRESET = CARD_PRESETS[0];
const SCAN_DEBOUNCE_MS = 1800;

type ZoomStep = { label: string; lens?: string; zoom: number };

// Identisch zum Einkaufs-Scanner: 0,5x nutzt die echte Ultraweitwinkel-Linse
// (nur iOS, wenn vorhanden), 2x/3x sind digitaler Zoom auf der Weitwinkel-Linse.
const buildZoomSteps = (lenses: string[]): ZoomStep[] => {
  const steps: ZoomStep[] = [];
  if (Platform.OS === 'ios' && lenses.includes('builtInUltraWideCamera')) {
    steps.push({ label: '0,5x', lens: 'builtInUltraWideCamera', zoom: 0 });
  }
  steps.push({ label: '1x', lens: 'builtInWideAngleCamera', zoom: 0 });
  steps.push({ label: '2x', lens: 'builtInWideAngleCamera', zoom: 0.15 });
  steps.push({ label: '3x', lens: 'builtInWideAngleCamera', zoom: 0.3 });
  return steps;
};

const readableBarcodeType = (type: string) => {
  const labels: Record<string, string> = {
    code128: 'Code 128',
    code39: 'Code 39',
    codabar: 'Codabar',
    ean13: 'EAN-13',
    ean8: 'EAN-8',
    itf14: 'ITF-14',
    upc_a: 'UPC-A',
    upc_e: 'UPC-E',
  };
  return labels[type] ?? 'Manuell';
};

export default function LoyaltyCardsScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useCallback((key: LoyaltyCardsTranslationKey, params?: Record<string, string | number>) =>
    translateLoyaltyCards(locale, key, params), [locale]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;

  const c = useMemo(() => ({
    sheetBackground: isDark ? '#171319' : '#FFF8F2',
    sheetHandle: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(111,85,74,0.24)',
    subtleButton: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(111,85,74,0.08)',
    iconMuted: isDark ? adaptiveColors.textSecondary : '#6F554A',
    chevron: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(111,85,74,0.55)',
    chipBackground: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.66)',
    chipBorder: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(111,85,74,0.10)',
    chipSelectedBackground: isDark ? 'rgba(142,78,198,0.28)' : 'rgba(142,78,198,0.10)',
    inputBackground: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(111,85,74,0.12)',
    inputText: isDark ? '#F5EFEA' : '#352923',
    placeholder: isDark ? 'rgba(245,239,234,0.42)' : 'rgba(111,85,74,0.45)',
    scanButtonBackground: isDark ? 'rgba(142,78,198,0.18)' : 'rgba(142,78,198,0.08)',
    scanButtonBorder: isDark ? 'rgba(196,150,240,0.34)' : 'rgba(142,78,198,0.16)',
    scanButtonIconBackground: isDark ? 'rgba(255,255,255,0.10)' : '#FFFFFF',
    scanIconColor: isDark ? '#C496F0' : PRIMARY,
    divider: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(111,85,74,0.20)',
    scanResult: isDark ? '#9CD3A6' : '#5F8B67',
    dockBackground: isDark ? 'rgba(18,15,20,0.96)' : 'rgba(255,248,240,0.96)',
    dockBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(111,85,74,0.16)',
    detailBackground: isDark ? '#121014' : '#FFF8F2',
    detailTitle: isDark ? '#F5EFEA' : '#2B2421',
    brightnessBackground: isDark ? 'rgba(255,196,60,0.14)' : '#FFF0C7',
    brightnessText: isDark ? '#F0CE8A' : '#72500E',
    brightnessIcon: isDark ? '#F0CE8A' : '#B57A13',
  }), [adaptiveColors.textSecondary, isDark]);
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCard, setSelectedCard] = useState<LoyaltyCard | null>(null);
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [cardName, setCardName] = useState(DEFAULT_PRESET.name);
  const [cardColor, setCardColor] = useState(DEFAULT_PRESET.color);
  const [barcode, setBarcode] = useState('');
  const [scannedType, setScannedType] = useState('manual');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [zoomSelection, setZoomSelection] = useState('1x');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  const zoomSteps = useMemo(() => buildZoomSteps(availableLenses), [availableLenses]);
  const activeZoomStep =
    zoomSteps.find((step) => step.label === zoomSelection) ??
    zoomSteps.find((step) => step.label === '1x')!;

  useEffect(() => {
    let cancelled = false;
    fetchLoyaltyCards().then(({ data, error }) => {
      if (cancelled) return;
      setIsLoading(false);
      if (error || !data) {
        console.error('Failed to load loyalty cards:', error);
        Alert.alert(t('loadTitle'), t('loadMessage'));
        return;
      }
      setCards(data);
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const resetDraft = useCallback(() => {
    setCardName(DEFAULT_PRESET.name);
    setCardColor(DEFAULT_PRESET.color);
    setBarcode('');
    setScannedType('manual');
  }, []);

  const openAddSheet = useCallback(() => {
    resetDraft();
    setIsAddVisible(true);
  }, [resetDraft]);

  const selectPreset = useCallback((preset: CardPreset) => {
    setCardName(preset.name);
    setCardColor(preset.color);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  }, []);

  const openScanner = useCallback(async () => {
    let granted = cameraPermission?.granted ?? false;
    if (!granted) {
      const permission = await requestCameraPermission();
      granted = permission.granted;
    }
    if (!granted) {
      Alert.alert(t('cameraTitle'), t('cameraMessage'));
      return;
    }
    setIsAddVisible(false);
    setIsScannerVisible(true);
  }, [cameraPermission?.granted, requestCameraPermission, t]);

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    const now = Date.now();
    const lastScan = lastScanRef.current;
    if (lastScan && lastScan.value === result.data && now - lastScan.at < SCAN_DEBOUNCE_MS) {
      return;
    }
    lastScanRef.current = { value: result.data, at: now };

    if (!canEncodeCode128(result.data)) {
      Alert.alert(t('unsupportedTitle'), t('unsupportedMessage'));
      return;
    }

    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBarcode(result.data);
    setScannedType(result.type);
    setIsScannerVisible(false);
    setIsAddVisible(true);
  }, [t]);

  const saveCard = useCallback(async () => {
    const trimmedName = cardName.trim();
    const trimmedBarcode = barcode.trim();
    if (!trimmedName) {
      Alert.alert(t('nameMissingTitle'), t('nameMissingMessage'));
      return;
    }
    if (!trimmedBarcode) {
      Alert.alert(t('barcodeMissingTitle'), t('barcodeMissingMessage'));
      return;
    }
    if (!canEncodeCode128(trimmedBarcode)) {
      Alert.alert(t('numberUnsupportedTitle'), t('numberUnsupportedMessage'));
      return;
    }

    setIsSaving(true);
    const { data, error } = await createLoyaltyCard({
      name: trimmedName,
      barcode: trimmedBarcode,
      scannedType,
      color: cardColor,
    });
    setIsSaving(false);
    if (error || !data) {
      console.error('Failed to create loyalty card:', error);
      Alert.alert(t('saveFailedTitle'), t('saveFailedMessage'));
      return;
    }

    setCards((currentCards) => [data, ...currentCards]);
    setIsAddVisible(false);
    resetDraft();
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [barcode, cardColor, cardName, resetDraft, scannedType, t]);

  const deleteCard = useCallback(
    (card: LoyaltyCard) => {
      Alert.alert(t('deleteTitle'), t('deleteMessage', { name: card.name }), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteLoyaltyCard(card.id);
            if (error) {
              console.error('Failed to delete loyalty card:', error);
              Alert.alert(t('deleteFailedTitle'), t('deleteFailedMessage'));
              return;
            }
            setCards((currentCards) => currentCards.filter((entry) => entry.id !== card.id));
            setSelectedCard(null);
          },
        },
      ]);
    },
    [t]
  );

  const cardColumns = width >= 700 ? 3 : 2;
  const cardWidth = `${100 / cardColumns - 2}%` as `${number}%`;
  const maskedBarcode = useMemo(
    () => (barcode.length > 8 ? `•••• ${barcode.slice(-4)}` : barcode),
    [barcode]
  );

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          title={t('title')}
          subtitle={t('subtitle')}
          showBackButton
          showBabySwitcher={false}
          onBackPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/shopping-list');
          }}
        />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 84 }]}
          contentInsetAdjustmentBehavior="automatic"
        >
          <LiquidGlassCard style={styles.introCard}>
            <View style={styles.introContent}>
              <View style={styles.introIcon}>
                <IconSymbol name="wallet.pass.fill" size={24} color={PRIMARY} />
              </View>
              <View style={styles.introText}>
                <ThemedText style={styles.introTitle}>{t('introTitle')}</ThemedText>
                <ThemedText style={styles.helperText}>
                  {t('introText')}
                </ThemedText>
              </View>
            </View>
          </LiquidGlassCard>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={PRIMARY} size="large" />
              <ThemedText style={styles.helperText}>{t('loading')}</ThemedText>
            </View>
          ) : cards.length === 0 ? (
            <LiquidGlassCard style={styles.emptyCard}>
              <View style={styles.emptyContent}>
                <View style={styles.emptyIllustration}>
                  <IconSymbol name="creditcard.fill" size={36} color={PRIMARY} />
                </View>
                <ThemedText style={styles.emptyTitle}>{t('emptyTitle')}</ThemedText>
                <ThemedText style={[styles.helperText, styles.emptyText]}>
                  {t('emptyText')}
                </ThemedText>
                <TouchableOpacity style={styles.primaryButton} onPress={openAddSheet}>
                  <IconSymbol name="plus" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.primaryButtonText}>{t('firstCard')}</ThemedText>
                </TouchableOpacity>
              </View>
            </LiquidGlassCard>
          ) : (
            <View style={styles.cardsSection}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>{t('myCards')}</ThemedText>
                <ThemedText style={styles.sectionCount}>{cards.length}</ThemedText>
              </View>
              <View style={styles.cardGrid}>
                {cards.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    accessibilityHint={t('openHint')}
                    accessibilityLabel={t('openCard', { name: card.name })}
                    activeOpacity={0.86}
                    onPress={() => setSelectedCard(card)}
                    style={[styles.loyaltyCard, { backgroundColor: card.color, width: cardWidth }]}
                  >
                    <View style={styles.loyaltyCardTop}>
                      <IconSymbol name="creditcard.fill" size={22} color="#FFFFFF" />
                      <IconSymbol name="chevron.right" size={18} color="rgba(255,255,255,0.85)" />
                    </View>
                    <ThemedText numberOfLines={2} style={styles.loyaltyCardName}>
                      {card.name}
                    </ThemedText>
                    <ThemedText numberOfLines={1} style={styles.loyaltyCardNumber}>
                      •••• {card.barcode.slice(-4)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {cards.length > 0 ? (
          <View
            style={[
              styles.bottomDock,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: c.dockBackground,
                borderTopColor: c.dockBorder,
              },
            ]}
          >
            <TouchableOpacity style={styles.primaryButton} onPress={openAddSheet}>
              <IconSymbol name="plus" size={18} color="#FFFFFF" />
              <ThemedText style={styles.primaryButtonText}>{t('addCard')}</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        <Modal
          animationType="slide"
          onRequestClose={() => setIsAddVisible(false)}
          transparent
          visible={isAddVisible}
        >
          <KeyboardAvoidingView
            behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <View
              style={[
                styles.formSheet,
                { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: c.sheetBackground },
              ]}
            >
              <View style={[styles.sheetHandle, { backgroundColor: c.sheetHandle }]} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderText}>
                  <ThemedText style={styles.sheetTitle}>{t('addCard')}</ThemedText>
                  <ThemedText style={styles.helperText}>{t('addSubtitle')}</ThemedText>
                </View>
                <TouchableOpacity
                  accessibilityLabel={t('close')}
                  onPress={() => setIsAddVisible(false)}
                  style={[styles.closeButton, { backgroundColor: c.subtleButton }]}
                >
                  <IconSymbol name="xmark" size={18} color={c.iconMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.sheetScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <ThemedText style={styles.inputLabel}>{t('provider')}</ThemedText>
                <View style={styles.presetGrid}>
                  {CARD_PRESETS.map((preset) => {
                    const isSelected = cardName === preset.name && cardColor === preset.color;
                    return (
                      <TouchableOpacity
                        key={preset.name}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => selectPreset(preset)}
                        style={[
                          styles.presetChip,
                          { backgroundColor: c.chipBackground, borderColor: c.chipBorder },
                          isSelected && [
                            styles.presetChipSelected,
                            { backgroundColor: c.chipSelectedBackground },
                          ],
                        ]}
                      >
                        <View style={[styles.presetDot, { backgroundColor: preset.color }]} />
                        <ThemedText numberOfLines={1} style={styles.presetText}>
                          {preset.name === 'Andere Karte' ? t('otherCard') : preset.name}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <ThemedText style={styles.inputLabel}>{t('cardName')}</ThemedText>
                <TextInput
                  onChangeText={setCardName}
                  placeholder={t('cardNamePlaceholder')}
                  placeholderTextColor={c.placeholder}
                  style={[
                    styles.input,
                    { backgroundColor: c.inputBackground, borderColor: c.inputBorder, color: c.inputText },
                  ]}
                  value={cardName}
                />

                <ThemedText style={styles.inputLabel}>{t('barcode')}</ThemedText>
                <TouchableOpacity
                  onPress={openScanner}
                  style={[
                    styles.scanButton,
                    { backgroundColor: c.scanButtonBackground, borderColor: c.scanButtonBorder },
                  ]}
                >
                  <View style={[styles.scanButtonIcon, { backgroundColor: c.scanButtonIconBackground }]}>
                    <IconSymbol name="barcode.viewfinder" size={24} color={c.scanIconColor} />
                  </View>
                  <View style={styles.scanButtonText}>
                    <ThemedText style={styles.scanButtonTitle}>{t('scan')}</ThemedText>
                    <ThemedText style={styles.helperText}>{t('scanHint')}</ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={c.chevron} />
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={[styles.divider, { backgroundColor: c.divider }]} />
                  <ThemedText style={styles.dividerText}>{t('manualDivider')}</ThemedText>
                  <View style={[styles.divider, { backgroundColor: c.divider }]} />
                </View>

                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  onChangeText={(value) => {
                    setBarcode(value);
                    setScannedType('manual');
                  }}
                  placeholder={t('numberPlaceholder')}
                  placeholderTextColor={c.placeholder}
                  style={[
                    styles.input,
                    styles.barcodeInput,
                    { backgroundColor: c.inputBackground, borderColor: c.inputBorder, color: c.inputText },
                  ]}
                  value={barcode}
                />
                {barcode ? (
                  <ThemedText selectable style={[styles.scanResult, { color: c.scanResult }]}>
                    {scannedType === 'manual' ? t('entered') : t('scanned', { type: readableBarcodeType(scannedType) })}: {maskedBarcode}
                  </ThemedText>
                ) : null}

                <TouchableOpacity
                  disabled={isSaving}
                  style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                  onPress={saveCard}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <IconSymbol name="checkmark" size={18} color="#FFFFFF" />
                  )}
                  <ThemedText style={styles.primaryButtonText}>
                    {isSaving ? t('saving') : t('saveCard')}
                  </ThemedText>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          animationType="fade"
          onRequestClose={() => {
            setIsScannerVisible(false);
            setIsAddVisible(true);
          }}
          visible={isScannerVisible}
        >
          <View style={styles.scannerContainer}>
            <CameraView
              autofocus="on"
              barcodeScannerSettings={{
                barcodeTypes: ['code128', 'code39', 'codabar', 'ean13', 'ean8', 'itf14', 'upc_a', 'upc_e'],
              }}
              enableTorch={torchEnabled}
              facing="back"
              onAvailableLensesChanged={({ lenses }) => setAvailableLenses(lenses)}
              onBarcodeScanned={handleBarcodeScanned}
              selectedLens={Platform.OS === 'ios' ? activeZoomStep.lens : undefined}
              style={StyleSheet.absoluteFill}
              zoom={activeZoomStep.zoom}
            />
            <SafeAreaView edges={['top', 'bottom']} style={styles.scannerOverlay}>
              <View style={styles.scannerHeader}>
                <TouchableOpacity
                  accessibilityLabel={t('closeScanner')}
                  onPress={() => {
                    setIsScannerVisible(false);
                    setIsAddVisible(true);
                  }}
                  style={styles.scannerClose}
                >
                  <IconSymbol name="xmark" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <ThemedText style={styles.scannerTitle}>{t('scannerTitle')}</ThemedText>
                <View style={styles.scannerHeaderSpacer} />
              </View>
              <View style={styles.zoomRow}>
                {zoomSteps.map((step) => (
                  <TouchableOpacity
                    key={step.label}
                    accessibilityRole="button"
                    accessibilityLabel={t('zoom', { zoom: step.label })}
                    accessibilityState={{ selected: activeZoomStep.label === step.label }}
                    onPress={() => setZoomSelection(step.label)}
                    style={[
                      styles.zoomChip,
                      activeZoomStep.label === step.label && styles.zoomChipActive,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.zoomChipText,
                        activeZoomStep.label === step.label && styles.zoomChipTextActive,
                      ]}
                    >
                      {step.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.scannerFocusArea}>
                <View style={styles.scannerFrame} />
                <ThemedText style={styles.scannerHint}>
                  {t('scannerHint')}
                </ThemedText>
                <TouchableOpacity
                  accessibilityLabel={t('flashlight')}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: torchEnabled }}
                  onPress={() => setTorchEnabled((enabled) => !enabled)}
                  style={[styles.torchButton, torchEnabled && styles.torchButtonActive]}
                >
                  <IconSymbol
                    name={torchEnabled ? 'flashlight.on.fill' : 'flashlight.off.fill'}
                    size={22}
                    color={torchEnabled ? '#3A2E20' : '#FFFFFF'}
                  />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>

        <Modal
          animationType="slide"
          onRequestClose={() => setSelectedCard(null)}
          presentationStyle="fullScreen"
          visible={selectedCard !== null}
        >
          {selectedCard ? (
            <SafeAreaView
              edges={['top', 'bottom']}
              style={[styles.cardDetail, { backgroundColor: c.detailBackground }]}
            >
              <View style={styles.detailHeader}>
                <TouchableOpacity
                  accessibilityLabel={t('closeCard')}
                  onPress={() => setSelectedCard(null)}
                  style={[styles.detailHeaderButton, { backgroundColor: c.subtleButton }]}
                >
                  <IconSymbol name="xmark" size={21} color={c.detailTitle} />
                </TouchableOpacity>
                <ThemedText style={[styles.detailHeaderTitle, { color: c.detailTitle }]}>
                  {t('detailTitle')}
                </ThemedText>
                <TouchableOpacity
                  accessibilityLabel={t('deleteCard')}
                  onPress={() => deleteCard(selectedCard)}
                  style={[styles.detailHeaderButton, { backgroundColor: c.subtleButton }]}
                >
                  <IconSymbol name="trash" size={20} color={isDark ? '#FF8A8A' : '#B94B4B'} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.detailContent}
                contentInsetAdjustmentBehavior="automatic"
              >
                <View style={[styles.detailBrandCard, { backgroundColor: selectedCard.color }]}>
                  <IconSymbol name="creditcard.fill" size={28} color="#FFFFFF" />
                  <ThemedText style={styles.detailBrandName}>{selectedCard.name}</ThemedText>
                </View>

                <View style={styles.barcodeCard}>
                  <ThemedText style={styles.barcodeInstruction}>
                    {t('checkoutHint')}
                  </ThemedText>
                  <Code128Barcode
                    height={width < 390 ? 110 : 132}
                    style={styles.barcode}
                    value={selectedCard.barcode}
                  />
                  <ThemedText selectable style={styles.barcodeNumber}>
                    {selectedCard.barcode}
                  </ThemedText>
                  <ThemedText style={styles.barcodeFormat}>Code 128</ThemedText>
                </View>

                <View style={[styles.brightnessHint, { backgroundColor: c.brightnessBackground }]}>
                  <IconSymbol name="sun.max.fill" size={20} color={c.brightnessIcon} />
                  <ThemedText style={[styles.brightnessHintText, { color: c.brightnessText }]}>
                    {t('brightnessHint')}
                  </ThemedText>
                </View>
              </ScrollView>
            </SafeAreaView>
          ) : null}
        </Modal>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 18 },
  introCard: { borderRadius: RADIUS },
  loadingContainer: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  introContent: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  introIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(142,78,198,0.12)',
  },
  introText: { flex: 1, gap: 4 },
  introTitle: { fontSize: 16, fontWeight: '800' },
  helperText: { fontSize: 13, lineHeight: 18, opacity: 0.67 },
  emptyCard: { borderRadius: RADIUS },
  emptyContent: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 28 },
  emptyIllustration: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(142,78,198,0.10)',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', paddingTop: 4 },
  emptyText: { maxWidth: 290, textAlign: 'center' },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: PRIMARY,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  buttonDisabled: { opacity: 0.65 },
  cardsSection: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionCount: { fontSize: 14, fontWeight: '800', opacity: 0.55, fontVariant: ['tabular-nums'] },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  loyaltyCard: {
    minHeight: 142,
    justifyContent: 'space-between',
    gap: 9,
    padding: 15,
    borderRadius: 20,
    borderCurve: 'continuous',
    boxShadow: '0 5px 16px rgba(66, 41, 30, 0.14)',
  },
  loyaltyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loyaltyCardName: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', lineHeight: 21 },
  loyaltyCardNumber: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bottomDock: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(255,248,240,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(111,85,74,0.16)',
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(33,25,22,0.38)' },
  formSheet: {
    maxHeight: '92%',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 9,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFF8F2',
  },
  sheetHandle: { width: 42, height: 5, alignSelf: 'center', borderRadius: 3, backgroundColor: 'rgba(111,85,74,0.24)' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetHeaderText: { flex: 1, gap: 2 },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(111,85,74,0.08)' },
  sheetScrollContent: { gap: 11, paddingBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '800', paddingTop: 3, paddingHorizontal: 2 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: { maxWidth: '48%', minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.66)', borderWidth: 1, borderColor: 'rgba(111,85,74,0.10)' },
  presetChipSelected: { borderColor: PRIMARY, backgroundColor: 'rgba(142,78,198,0.10)' },
  presetDot: { width: 10, height: 10, borderRadius: 5 },
  presetText: { flexShrink: 1, fontSize: 13, fontWeight: '700' },
  input: { height: 48, paddingHorizontal: 14, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(111,85,74,0.12)', color: '#352923', fontSize: 15 },
  barcodeInput: { fontVariant: ['tabular-nums'] },
  scanButton: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 17, backgroundColor: 'rgba(142,78,198,0.08)', borderWidth: 1, borderColor: 'rgba(142,78,198,0.16)' },
  scanButtonIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFFFFF' },
  scanButtonText: { flex: 1, gap: 1 },
  scanButtonTitle: { fontSize: 15, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(111,85,74,0.20)' },
  dividerText: { fontSize: 12, opacity: 0.5 },
  scanResult: { fontSize: 12, fontWeight: '700', color: '#5F8B67', paddingHorizontal: 2, fontVariant: ['tabular-nums'] },
  scannerContainer: { flex: 1, backgroundColor: '#000000' },
  scannerOverlay: { flex: 1 },
  scannerHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  scannerClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.48)' },
  scannerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4 },
  scannerHeaderSpacer: { width: 44 },
  scannerFocusArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingBottom: 56 },
  zoomRow: { flexDirection: 'row', alignSelf: 'center', gap: 8 },
  zoomChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  zoomChipActive: { backgroundColor: '#FFFFFF' },
  zoomChipText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  zoomChipTextActive: { color: '#3A2E20' },
  torchButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  torchButtonActive: { backgroundColor: '#FFFFFF' },
  scannerFrame: { width: '82%', height: 160, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: 'transparent' },
  scannerHint: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.52)' },
  cardDetail: { flex: 1, backgroundColor: '#FFF8F2' },
  detailHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  detailHeaderButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(111,85,74,0.08)' },
  detailHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#2B2421' },
  detailContent: { gap: 20, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32 },
  detailBrandCard: { minHeight: 132, justifyContent: 'space-between', gap: 18, padding: 20, borderRadius: 24, borderCurve: 'continuous', boxShadow: '0 7px 22px rgba(66, 41, 30, 0.16)' },
  detailBrandName: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  barcodeCard: { gap: 15, paddingHorizontal: 18, paddingVertical: 22, borderRadius: 24, borderCurve: 'continuous', backgroundColor: '#FFFFFF', boxShadow: '0 3px 14px rgba(66, 41, 30, 0.10)' },
  barcodeInstruction: { color: '#2B2421', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  barcode: { alignSelf: 'stretch' },
  barcodeNumber: { color: '#111111', fontSize: 16, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center', fontVariant: ['tabular-nums'] },
  barcodeFormat: { color: '#6F625D', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  brightnessHint: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#FFF0C7' },
  brightnessHintText: { flex: 1, color: '#72500E', fontSize: 13, fontWeight: '700', lineHeight: 18 },
});
