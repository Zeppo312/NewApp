import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LiquidGlassCard, GLASS_OVERLAY, GLASS_OVERLAY_DARK, LAYOUT_PAD } from '@/constants/DesignGuide';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  localizeBirthPlanOptionValue,
  translateBirthPlanText,
  type BirthPlanLocale,
  type BirthPlanTranslationKey,
} from '@/lib/birthPlanTranslations';

// TIMELINE_INSET zentral aus DesignGuide
import { supabase, getCurrentUser, getGeburtsplan, saveGeburtsplan, saveStructuredGeburtsplan } from '@/lib/supabase';
import { GeburtsplanData, defaultGeburtsplan } from '@/types/geburtsplan';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { generateAndDownloadPDF } from '@/lib/geburtsplan-utils';
import Header from '@/components/Header';

// Import der Abschnittskomponenten
import { AllgemeineAngabenSection } from '@/components/geburtsplan/AllgemeineAngabenSection';
import { GeburtsWuenscheSection } from '@/components/geburtsplan/GeburtsWuenscheSection';
import { MedizinischeEingriffeSection } from '@/components/geburtsplan/MedizinischeEingriffeSection';
import { NachDerGeburtSection } from '@/components/geburtsplan/NachDerGeburtSection';
import { NotfallSection } from '@/components/geburtsplan/NotfallSection';
import { SonstigeWuenscheSection } from '@/components/geburtsplan/SonstigeWuenscheSection';

// Die Formatierungsfunktionen wurden in eine separate Datei ausgelagert: components/geburtsplan/formatHelpers.ts

// Funktion zum Generieren eines Textes aus den strukturierten Daten
const generateTextFromStructuredData = (data: GeburtsplanData, locale: BirthPlanLocale): string => {
  const t = (key: BirthPlanTranslationKey) => translateBirthPlanText(locale, key);
  const option = (value: string) => localizeBirthPlanOptionValue(locale, value);
  const list = (values: string[]) => values.map(option).join(', ');
  let text = '';

  // 1. Allgemeine Angaben
  text += `${t('export.documentTitle')}\n\n`;
  text += `${t('section.general')}\n`;
  if (data.allgemeineAngaben.mutterName) text += `${t('general.motherName')}: ${data.allgemeineAngaben.mutterName}\n`;
  if (data.allgemeineAngaben.entbindungstermin) text += `${t('general.dueDate')}: ${data.allgemeineAngaben.entbindungstermin}\n`;
  if (data.allgemeineAngaben.geburtsklinik) text += `${t('general.place')}: ${data.allgemeineAngaben.geburtsklinik}\n`;
  if (data.allgemeineAngaben.begleitpersonen) text += `${t('general.companions')}: ${data.allgemeineAngaben.begleitpersonen}\n`;
  text += '\n';

  // 2. Wünsche zur Geburt
  text += `${t('section.birthWishes')}\n`;
  if (data.geburtsWuensche.geburtspositionen.length > 0) {
    text += `${t('birthWishes.positions')}: ${list(data.geburtsWuensche.geburtspositionen)}\n`;
  }
  if (data.geburtsWuensche.schmerzmittel.length > 0) {
    text += `${t('birthWishes.painRelief')}: ${list(data.geburtsWuensche.schmerzmittel)}\n`;
  }
  if (data.geburtsWuensche.rolleBegleitperson) {
    text += `${t('birthWishes.companionRole')}: ${option(data.geburtsWuensche.rolleBegleitperson)}\n`;
  }
  if (data.geburtsWuensche.musikAtmosphaere.length > 0) {
    text += `${t('birthWishes.atmosphere')}: ${list(data.geburtsWuensche.musikAtmosphaere)}\n`;
  }
  if (data.geburtsWuensche.sonstigeWuensche) {
    text += `${t('birthWishes.other')}: ${data.geburtsWuensche.sonstigeWuensche}\n`;
  }
  text += '\n';

  // 3. Medizinische Eingriffe & Maßnahmen
  text += `${t('section.interventions')}\n`;
  if (data.medizinischeEingriffe.wehenfoerderung) text += `${t('interventions.induction')}: ${option(data.medizinischeEingriffe.wehenfoerderung)}\n`;
  if (data.medizinischeEingriffe.dammschnitt) text += `${t('interventions.episiotomy')}: ${option(data.medizinischeEingriffe.dammschnitt)}\n`;
  if (data.medizinischeEingriffe.monitoring) text += `${t('interventions.monitoring')}: ${option(data.medizinischeEingriffe.monitoring)}\n`;
  if (data.medizinischeEingriffe.notkaiserschnitt) text += `${t('interventions.emergencyCSection')}: ${option(data.medizinischeEingriffe.notkaiserschnitt)}\n`;
  if (data.medizinischeEingriffe.sonstigeEingriffe) text += `${t('interventions.other')}: ${data.medizinischeEingriffe.sonstigeEingriffe}\n`;
  text += '\n';

  // 4. Nach der Geburt
  text += `${t('section.afterBirth')}\n`;
  text += `${t('afterBirth.bonding')}: ${t(data.nachDerGeburt.bonding ? 'common.yes' : 'common.no')}\n`;
  text += `${t('afterBirth.breastfeeding')}: ${t(data.nachDerGeburt.stillen ? 'common.yes' : 'common.no')}\n`;
  if (data.nachDerGeburt.plazenta) text += `${t('afterBirth.placenta')}: ${option(data.nachDerGeburt.plazenta)}\n`;
  if (data.nachDerGeburt.vitaminKGabe) text += `${t('afterBirth.vitaminK')}: ${option(data.nachDerGeburt.vitaminKGabe)}\n`;
  if (data.nachDerGeburt.sonstigeWuensche) text += `${t('afterBirth.other')}: ${data.nachDerGeburt.sonstigeWuensche}\n`;
  text += '\n';

  // 5. Für den Notfall / Kaiserschnitt
  text += `${t('section.emergency')}\n`;
  if (data.notfall.begleitpersonImOP) text += `${t('emergency.companion')}: ${option(data.notfall.begleitpersonImOP)}\n`;
  text += `${t('emergency.bonding')}: ${t(data.notfall.bondingImOP ? 'common.yes' : 'common.no')}\n`;
  if (data.notfall.fotoerlaubnis) text += `${t('emergency.photos')}: ${option(data.notfall.fotoerlaubnis)}\n`;
  if (data.notfall.sonstigeWuensche) text += `${t('emergency.other')}: ${data.notfall.sonstigeWuensche}\n`;
  text += '\n';

  // 6. Sonstige Wünsche / Hinweise
  if (data.sonstigeWuensche.freitext) {
    text += `${t('section.other')}\n`;
    text += `${data.sonstigeWuensche.freitext}\n`;
  }

  return text;
};

export default function GeburtsplanScreen() {
  const { locale } = useLocale();
  const t = (key: BirthPlanTranslationKey) => translateBirthPlanText(locale, key);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const iconAccentColor = isDark ? adaptiveColors.accent : theme.accent;
  const iconSecondaryColor = isDark ? adaptiveColors.iconSecondary : theme.tabIconDefault;
  const heroIconBackground = isDark ? 'rgba(142,78,198,0.7)' : 'rgba(142,78,198,0.9)';
  const router = useRouter();
  const { isReadOnlyPreviewMode } = useBabyStatus();
  const [user, setUser] = useState<any>(null);
  const styles = React.useMemo(
    () => createStyles({ textPrimary, textSecondary, isDark }),
    [textPrimary, textSecondary, isDark]
  );

  // State für den Geburtsplan
  const [geburtsplan, setGeburtsplan] = useState('');
  const [structuredData, setStructuredData] = useState<GeburtsplanData>(defaultGeburtsplan);
  const [useStructuredEditor, setUseStructuredEditor] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [babyIconBase64, setBabyIconBase64] = useState<string | null>(null);
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

  // Lade das Baby-Icon beim Start
  useEffect(() => {
    const loadBabyIcon = async () => {
      try {
        // Lade das Bild
        const asset = Asset.fromModule(require('@/assets/images/Baby_Icon.png'));
        await asset.downloadAsync();

        // Lese die Datei als Base64
        const base64 = await FileSystem.readAsStringAsync(asset.localUri!, {
          encoding: 'base64',
        });

        setBabyIconBase64(base64);
      } catch (error) {
        console.error('Fehler beim Laden des Baby-Icons:', error);
      }
    };

    loadBabyIcon();
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { user: currentUser } = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        loadGeburtsplan();
      } else {
        setIsLoading(false);
      }
    };

    checkUser();

    // Auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          loadGeburtsplan();
        } else {
          setIsLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadGeburtsplan = async () => {
    try {
      setIsLoading(true);

      // Geburtsplan laden mit der Hilfsfunktion
      const { data, error } = await getGeburtsplan();

      if (error) {
        console.error('Error loading geburtsplan:', error);
        // Keine Alert-Meldung mehr, um die Benutzererfahrung nicht zu beeinträchtigen
      } else if (data) {
        // Wenn Daten gefunden wurden

        // Wenn strukturierte Daten vorhanden sind, setzen wir diese
        if (data.structured_data) {
          setStructuredData(data.structured_data);
          // Wenn es einen gespeicherten Textinhalt gibt, setzen wir diesen
          if (data.textContent) {
            setGeburtsplan(data.textContent);
          } else {
            // Ansonsten generieren wir den Text aus den strukturierten Daten
            const generatedContent = generateTextFromStructuredData(data.structured_data, locale);
            setGeburtsplan(generatedContent);
          }
        } else {
          // Wenn keine strukturierten Daten vorhanden sind, setzen wir den Textinhalt
          setGeburtsplan(data.content || '');
        }

        console.log('Geburtsplan geladen:', data);
      }
    } catch (err) {
      console.error('Failed to load geburtsplan:', err);
      // Keine Alert-Meldung mehr, um die Benutzererfahrung nicht zu beeinträchtigen
    } finally {
      setIsLoading(false);
    }
  };

  // Funktion zum Generieren und Herunterladen des Geburtsplans als PDF
  const handleGeneratePDF = async () => {
    if (!user) {
      Alert.alert(t('common.notice'), t('alert.signInPdf'));
      return;
    }

    // Verwende die ausgelagerte Funktion
    await generateAndDownloadPDF(babyIconBase64, setIsGeneratingPDF, locale);
  };

  const handleSaveGeburtsplan = async () => {
    if (!ensureWritableInCurrentMode()) return;
    if (!user) {
      Alert.alert(t('common.notice'), t('alert.signInSave'));
      return;
    }

    try {
      setIsSaving(true);

      let result;

      // Je nach Editor-Modus den Geburtsplan speichern
      if (useStructuredEditor) {
        // Strukturierten Geburtsplan speichern
        // Wir generieren auch einen Textinhalt aus den strukturierten Daten
        const generatedContent = generateTextFromStructuredData(structuredData, locale);
        result = await saveStructuredGeburtsplan(structuredData, generatedContent);
        // Auch den Textinhalt aktualisieren
        setGeburtsplan(generatedContent);
      } else {
        // Einfachen Textgeburtsplan speichern
        result = await saveGeburtsplan(geburtsplan);
      }

      const { error } = result;

      if (error) {
        console.error('Error saving geburtsplan:', error);
        Alert.alert(t('common.error'), t('alert.saveFailed'));
      } else {
        Alert.alert(t('common.success'), t('alert.saved'), [
          {
            text: t('common.ok'),
            onPress: () => {
              // Nach erfolgreichem Speichern zur Countdown-Seite zurückkehren
              router.push('/(tabs)/countdown');
            }
          }
        ]);
        // Nach erfolgreichem Speichern den Geburtsplan neu laden
        await loadGeburtsplan();
        console.log('Geburtsplan gespeichert und neu geladen');
      }
    } catch (err) {
      console.error('Failed to save geburtsplan:', err);
      Alert.alert(t('common.error'), t('alert.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
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
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                  <View style={styles.heroHeader}>
                    <View style={[styles.heroIcon, { backgroundColor: heroIconBackground }]}>
                      <IconSymbol name="doc.text.fill" size={24} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.sectionTitle, styles.centerText]}>
                      {t('intro.title')}
                    </ThemedText>
                    <ThemedText style={[styles.infoText, styles.centerText]}>
                      {t('intro.description')}
                    </ThemedText>
                  </View>
                </LiquidGlassCard>

                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                  <ThemedText style={styles.sectionTitle}>
                    {t('editor.title')}
                  </ThemedText>
                  <View style={styles.switchContainer}>
                    <ThemedText style={styles.switchLabel}>{t('editor.structured')}</ThemedText>
                    <Switch
                      value={useStructuredEditor}
                      onValueChange={(value) => {
                        if (!ensureWritableInCurrentMode()) return;
                        setUseStructuredEditor(value);
                      }}
                      trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                      thumbColor={useStructuredEditor ? '#FFFFFF' : '#F4F4F4'}
                      ios_backgroundColor="#D1D1D6"
                      disabled={isReadOnlyPreviewMode}
                    />
                  </View>
                </LiquidGlassCard>

                {isLoading ? (
                  <ActivityIndicator size="large" color={iconAccentColor} style={styles.loader} />
                ) : useStructuredEditor ? (
                  // Strukturierter Editor
                  <>
                    <AllgemeineAngabenSection
                      data={structuredData.allgemeineAngaben}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        allgemeineAngaben: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                      readOnly={isReadOnlyPreviewMode}
                    />

                    <GeburtsWuenscheSection
                      data={structuredData.geburtsWuensche}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        geburtsWuensche: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                      readOnly={isReadOnlyPreviewMode}
                    />

                    <MedizinischeEingriffeSection
                      data={structuredData.medizinischeEingriffe}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        medizinischeEingriffe: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                      readOnly={isReadOnlyPreviewMode}
                    />

                    <NachDerGeburtSection
                      data={structuredData.nachDerGeburt}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        nachDerGeburt: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                      readOnly={isReadOnlyPreviewMode}
                    />

                    <NotfallSection
                      data={structuredData.notfall}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        notfall: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                      readOnly={isReadOnlyPreviewMode}
                    />

                    <SonstigeWuenscheSection
                      data={structuredData.sonstigeWuensche}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        sonstigeWuensche: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                      readOnly={isReadOnlyPreviewMode}
                    />
                  </>
                ) : (
                  // Einfacher Texteditor
                  <LiquidGlassCard style={styles.textAreaGlass} intensity={26} overlayColor={glassOverlay}>
                    <TextInput
                      style={[
                        styles.textArea,
                        { color: textPrimary }
                      ]}
                      multiline
                      numberOfLines={20}
                      placeholder={t('editor.freePlaceholder')}
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                      value={geburtsplan}
                      onChangeText={setGeburtsplan}
                      editable={!isReadOnlyPreviewMode}
                    />
                  </LiquidGlassCard>
                )}

                {/* Quick Actions im More-Style */}
                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                  <TouchableOpacity
                    style={[styles.menuItem, isReadOnlyPreviewMode && styles.actionDisabled]}
                    onPress={handleSaveGeburtsplan}
                    disabled={isSaving || isReadOnlyPreviewMode}
                  >
                    <View style={styles.menuItemIcon}>
                      <IconSymbol name="tray.and.arrow.down.fill" size={24} color={iconAccentColor} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <ThemedText style={styles.menuItemTitle}>{t('action.save')}</ThemedText>
                      <ThemedText style={styles.menuItemDescription}>{t('action.plan')}</ThemedText>
                    </View>
                    {isSaving ? (
                      <ActivityIndicator size="small" color={iconAccentColor} />
                    ) : (
                      <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleGeneratePDF}
                    disabled={isGeneratingPDF}
                  >
                    <View style={styles.menuItemIcon}>
                      <IconSymbol name="arrow.down.doc" size={24} color={iconAccentColor} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <ThemedText style={styles.menuItemTitle}>{t('action.pdf')}</ThemedText>
                      <ThemedText style={styles.menuItemDescription}>{t('action.download')}</ThemedText>
                    </View>
                    {isGeneratingPDF ? (
                      <ActivityIndicator size="small" color={iconAccentColor} />
                    ) : (
                      <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
                    )}
                  </TouchableOpacity>
                </LiquidGlassCard>

                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                  <ThemedText style={styles.sectionTitle}>
                    {t('tips.title')}
                  </ThemedText>
                  <ThemedText style={styles.tipText}>• {t('tips.position')}</ThemedText>
                  <ThemedText style={styles.tipText}>• {t('tips.painRelief')}</ThemedText>
                  <ThemedText style={styles.tipText}>• {t('tips.atmosphere')}</ThemedText>
                  <ThemedText style={styles.tipText}>• {t('tips.interventions')}</ThemedText>
                  <ThemedText style={styles.tipText}>• {t('tips.afterBirth')}</ThemedText>
                </LiquidGlassCard>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const createStyles = ({
  textPrimary,
  textSecondary,
  isDark,
}: {
  textPrimary: string;
  textSecondary: string;
  isDark: boolean;
}) => StyleSheet.create({
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
  contentContainer: { paddingHorizontal: LAYOUT_PAD, paddingBottom: 40, paddingTop: 10 },
  fullWidthCard: {
  },
  readOnlyPreviewBanner: {
    marginHorizontal: LAYOUT_PAD,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
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
  sectionCard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
    color: textPrimary,
  },
  infoText: { fontSize: 14, lineHeight: 20, color: textSecondary, paddingHorizontal: 16, marginBottom: 16 },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: textPrimary,
  },
  centerText: { textAlign: 'center' },
  heroHeader: { alignItems: 'center', paddingVertical: 6 },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)'
  },
  textAreaGlass: {
    borderRadius: 22,
    overflow: 'hidden',
    padding: 12,
    marginBottom: 16
  },
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 300,
    textAlignVertical: 'top',
  },
  // Action cards row
  cardsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginBottom: 16
  },
  actionCardWrapper: { flex: 1, borderRadius: 22, overflow: 'hidden' },
  actionCardInner: {
    alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 112,
  },
  iconContainer: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)'
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardDesc: { fontSize: 12, opacity: 0.9, color: textSecondary },
  tipText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 5,
    color: textSecondary,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    gap: 12,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(142, 78, 198, 0.15)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.35)',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: textPrimary,
  },
  menuItemDescription: {
    fontSize: 12,
    color: textSecondary,
    opacity: 0.8,
    marginTop: 2,
  },
  loader: {
    marginVertical: 30,
  },
});
