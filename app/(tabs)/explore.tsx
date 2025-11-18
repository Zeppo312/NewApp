import { StyleSheet, TouchableOpacity, Alert, ActivityIndicator, View, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ChecklistCategory } from '@/components/ChecklistCategory';
import { AddChecklistItem } from '@/components/AddChecklistItem';
import { ProgressCircle } from '@/components/ProgressCircle';

import { ChecklistItem, getHospitalChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem, supabaseUrl } from '@/lib/supabase';
import { LiquidGlassCard, LAYOUT_PAD, SECTION_GAP_TOP, PRIMARY, TEXT_PRIMARY } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';

const ACCENT_PURPLE = '#A47AD4';
const DEEP_TEXT = '#5C4033';
const SOFT_CARD_BG = 'rgba(255, 246, 237, 0.88)';
const SOFT_BORDER = 'rgba(255,255,255,0.65)';
const TIP_ICON = '#B896FF';
const BADGE_TINT = 'rgba(255,255,255,0.92)';

const deduplicateChecklist = (items: ChecklistItem[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.position ?? ''}|${item.category ?? ''}|${(item.item_name || '').toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export default function TabTwoScreen() {
  const colorScheme = useColorScheme() ?? 'light';

  // State für die Checkliste
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vordefinierte Kategorien für die Checkliste
  const categories = [
    'Dokumente',
    'Kleidung für Mama',
    'Kleidung für Baby',
    'Hygieneartikel',
    'Sonstiges'
  ];

  // Vordefinierte Einträge für die Checkliste
  const defaultItems: Array<{
    item_name: string;
    category: string;
    notes?: string | null;
  }> = [
    // Dokumente
    { item_name: 'Mutterpass', category: 'Dokumente', notes: 'Unbedingt mitnehmen!' },
    { item_name: 'Personalausweis', category: 'Dokumente', notes: null },
    { item_name: 'Krankenversicherungskarte', category: 'Dokumente', notes: null },
    { item_name: 'Familienstammbuch', category: 'Dokumente', notes: null },
    { item_name: 'Geburtsplan (falls vorhanden)', category: 'Dokumente', notes: null },

    // Kleidung für Mama
    { item_name: 'Bequeme Nachthemden', category: 'Kleidung für Mama', notes: '2-3 Stück' },
    { item_name: 'Warme Socken', category: 'Kleidung für Mama', notes: null },
    { item_name: 'Bademantel', category: 'Kleidung für Mama', notes: null },
    { item_name: 'Stillbustier/Still-BHs', category: 'Kleidung für Mama', notes: '2-3 Stück' },
    { item_name: 'Bequeme Unterwäsche', category: 'Kleidung für Mama', notes: 'Mehrere Stück' },
    { item_name: 'Hausschuhe', category: 'Kleidung für Mama', notes: null },
    { item_name: 'Bequeme Kleidung für die Heimreise', category: 'Kleidung für Mama', notes: null },

    // Kleidung für Baby
    { item_name: 'Bodys', category: 'Kleidung für Baby', notes: '4-5 Stück, Größe 50/56' },
    { item_name: 'Strampler', category: 'Kleidung für Baby', notes: '2-3 Stück, Größe 50/56' },
    { item_name: 'Mützchen', category: 'Kleidung für Baby', notes: null },
    { item_name: 'Söckchen', category: 'Kleidung für Baby', notes: '2-3 Paar' },
    { item_name: 'Jäckchen', category: 'Kleidung für Baby', notes: 'Je nach Jahreszeit' },
    { item_name: 'Heimfahrt-Outfit', category: 'Kleidung für Baby', notes: 'Wettergerecht' },

    // Hygieneartikel
    { item_name: 'Zahnbürste & Zahnpasta', category: 'Hygieneartikel', notes: null },
    { item_name: 'Haarbürste & Haargummis', category: 'Hygieneartikel', notes: null },
    { item_name: 'Duschgel & Shampoo', category: 'Hygieneartikel', notes: null },
    { item_name: 'Wochenbetteinlagen', category: 'Hygieneartikel', notes: null },
    { item_name: 'Brustwarzensalbe', category: 'Hygieneartikel', notes: null },
    { item_name: 'Lippenpflegestift', category: 'Hygieneartikel', notes: null },
    { item_name: 'Feuchttücher für Baby', category: 'Hygieneartikel', notes: null },
    { item_name: 'Windeln für Neugeborene', category: 'Hygieneartikel', notes: 'Kleine Packung' },

    // Sonstiges
    { item_name: 'Handtücher', category: 'Sonstiges', notes: '2 Stück' },
    { item_name: 'Waschlappen', category: 'Sonstiges', notes: '2-3 Stück' },
    { item_name: 'Handy & Ladekabel', category: 'Sonstiges', notes: null },
    { item_name: 'Snacks & Getränke', category: 'Sonstiges', notes: null },
    { item_name: 'Kamera', category: 'Sonstiges', notes: null },
    { item_name: 'Lektüre/Zeitschriften', category: 'Sonstiges', notes: null },
    { item_name: 'Maxicar/Babyschale für Heimfahrt', category: 'Sonstiges', notes: null }
  ];

  const hasSeededDefaults = useRef(false);

  // Laden der Checkliste beim ersten Rendern und bei Fokus auf den Tab
  const loadChecklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Abrufen der gespeicherten Checkliste
      const { data, error } = await getHospitalChecklist();
      if (error) throw error;

      // Wenn die Checkliste leer ist und noch nicht initialisiert wurde,
      // fügen wir die vordefinierten Einträge hinzu
      if ((!data || data.length === 0) && !hasSeededDefaults.current) {
        console.log('Initializing checklist with default items...');
        hasSeededDefaults.current = true;

        // Vorbereitete Einträge hinzufügen
        const initializedItems: ChecklistItem[] = [];

        // Sequentiell hinzufügen, um Reihenfolge zu erhalten
        for (let i = 0; i < defaultItems.length; i++) {
          const item = defaultItems[i];
          try {
            const { data: newItem } = await addChecklistItem({
              item_name: item.item_name,
              category: item.category,
              notes: item.notes || null,
              is_checked: false,
              position: i
            });

            if (newItem) {
              initializedItems.push(newItem);
            }
          } catch (itemError) {
            console.error('Error adding default item:', itemError);
            // Wir setzen fort, auch wenn ein Eintrag fehlschlägt
          }
        }

        setChecklist(deduplicateChecklist(initializedItems));
      } else {
        // Wenn bereits Daten vorhanden sind, verwenden wir diese
        setChecklist(deduplicateChecklist(data || []));
      }
    } catch (err) {
      console.error('Error loading checklist:', err);
      setError('Die Checkliste konnte nicht geladen werden.');

      // Im Fehlerfall zeigen wir die vordefinierten Einträge im Demo-Modus an
      if (supabaseUrl.includes('example.supabase.co')) {
        console.log('Using default items in demo mode...');
        const demoItems = defaultItems.map((item, index) => ({
          ...item,
          id: `demo-${index}`,
          user_id: 'demo-user',
          is_checked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          position: index
        })) as ChecklistItem[];

        setChecklist(demoItems);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  useFocusEffect(
    useCallback(() => {
      loadChecklist();
    }, [loadChecklist])
  );

  // Hinzufügen eines neuen Eintrags
  const handleAddItem = async (itemName: string, category: string, notes: string) => {
    try {
      const newItem = {
        item_name: itemName,
        category,
        notes: notes || null,
        is_checked: false,
        position: checklist.length // Position am Ende der Liste
      };

      const { data, error } = await addChecklistItem(newItem);
      if (error) throw error;
      if (data) {
        setChecklist(prev => deduplicateChecklist([...prev, data]));
      }
    } catch (err) {
      console.error('Error adding checklist item:', err);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht hinzugefügt werden.');
    }
  };

  // Umschalten des Status eines Eintrags (abgehakt/nicht abgehakt)
  const handleToggleItem = async (id: string, isChecked: boolean) => {
    try {
      const { data, error } = await toggleChecklistItem(id, isChecked);
      if (error) throw error;
      if (data) {
        setChecklist(checklist.map(item => item.id === id ? data : item));
      }
    } catch (err) {
      console.error('Error toggling checklist item:', err);
      Alert.alert('Fehler', 'Der Status konnte nicht geändert werden.');
    }
  };

  // Löschen eines Eintrags
  const handleDeleteItem = async (id: string) => {
    Alert.alert(
      'Eintrag löschen',
      'Möchtest du diesen Eintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteChecklistItem(id);
              if (error) throw error;
              setChecklist(checklist.filter(item => item.id !== id));
            } catch (err) {
              console.error('Error deleting checklist item:', err);
              Alert.alert('Fehler', 'Der Eintrag konnte nicht gelöscht werden.');
            }
          }
        }
      ]
    );
  };

  // Gruppieren der Einträge nach Kategorien
  const groupedItems = checklist.reduce<Record<string, ChecklistItem[]>>((groups, item) => {
    const category = item.category || 'Sonstiges';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});

  // Berechne den Gesamtfortschritt über alle Kategorien
  const totalProgress = useMemo(() => {
    const totalItems = checklist.length;
    if (totalItems === 0) return 0;

    const checkedItems = checklist.filter(item => item.is_checked).length;
    return Math.round((checkedItems / totalItems) * 100);
  }, [checklist]);

  const checkedItems = useMemo(() => checklist.filter(item => item.is_checked).length, [checklist]);
  const totalItems = checklist.length;
  const totalCategories = Object.keys(groupedItems).length || categories.length;

  const progressNote = useMemo(() => {
    if (totalProgress === 0) {
      return 'Starte mit den wichtigsten Dokumenten – so bleibt alles entspannt.';
    }
    if (totalProgress < 50) {
      return 'Du bist mittendrin! Kleine Schritte bringen dich ans Ziel.';
    }
    if (totalProgress < 90) {
      return 'Nur noch ein paar Teile – der große Tag kann kommen.';
    }
    return 'Wow, fast erledigt! Lass dir nur die letzten Kleinigkeiten bestätigen.';
  }, [totalProgress]);

  return (
    <ThemedBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <Header
          title="Krankenhaus-Checkliste"
          subtitle="Alles was du für die Klinik brauchst"
          showBackButton
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          <LiquidGlassCard style={[styles.cardBase, styles.summaryCard, { backgroundColor: SOFT_CARD_BG, borderColor: SOFT_BORDER }]}>
            <View style={styles.summaryHeader}>
              <ProgressCircle
                progress={totalProgress}
                size={70}
                progressColor={ACCENT_PURPLE}
                backgroundColor="rgba(255,255,255,0.3)"
                textColor={DEEP_TEXT}
              />
              <View style={styles.summaryTextBlock}>
                <ThemedText style={styles.summaryTitle} lightColor={DEEP_TEXT}>
                  Bereit für den großen Tag
                </ThemedText>
                <ThemedText style={styles.summaryLead} lightColor="rgba(92,64,51,0.8)">
                  Deine Liste wächst mit dir – hake ab, ergänze und bleib entspannt.
                </ThemedText>
                <View style={styles.summaryBadges}>
                  <View style={[styles.summaryBadge, { backgroundColor: BADGE_TINT, borderColor: SOFT_BORDER }]}>
                    <IconSymbol name="doc.text" size={16} color={DEEP_TEXT} />
                    <ThemedText style={styles.summaryBadgeText} lightColor={DEEP_TEXT}>
                      {totalCategories} Kategorien
                    </ThemedText>
                  </View>
                  <View style={[styles.summaryBadge, { backgroundColor: BADGE_TINT, borderColor: SOFT_BORDER }]}>
                    <IconSymbol name="checkmark.seal.fill" size={16} color={DEEP_TEXT} />
                    <ThemedText style={styles.summaryBadgeText} lightColor={DEEP_TEXT}>
                      {checkedItems}/{totalItems || 0} erledigt
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.summaryFooter}>
              <ThemedText style={styles.summaryFooterText} lightColor="rgba(92,64,51,0.85)">
                {progressNote}
              </ThemedText>
            </View>
          </LiquidGlassCard>

          <LiquidGlassCard style={[styles.cardBase, styles.tipCard, { backgroundColor: SOFT_CARD_BG, borderColor: SOFT_BORDER }]}>
            <View style={styles.tipContent}>
              <IconSymbol name="sparkles" size={20} color={TIP_ICON} />
              <ThemedText style={styles.tipText} lightColor={DEEP_TEXT}>
                Tipp: Überprüfe am Abend vor der Abreise alles noch einmal gemeinsam mit deiner Begleitung.
              </ThemedText>
            </View>
          </LiquidGlassCard>

          {loading ? (
            <LiquidGlassCard style={[styles.cardBase, styles.stateCard, { backgroundColor: SOFT_CARD_BG, borderColor: SOFT_BORDER }]}>
              <ActivityIndicator size="small" color={ACCENT_PURPLE} />
              <ThemedText style={styles.stateText} lightColor={DEEP_TEXT}>
                Checkliste wird geladen...
              </ThemedText>
            </LiquidGlassCard>
          ) : error ? (
            <LiquidGlassCard style={[styles.cardBase, styles.stateCard, styles.errorCard, { backgroundColor: SOFT_CARD_BG, borderColor: '#EFB0B6' }]}>
              <ThemedText style={[styles.stateText, styles.errorText]} lightColor="#A8464C">
                {error}
              </ThemedText>
              <TouchableOpacity style={styles.retryButton} onPress={loadChecklist}>
                <ThemedText style={styles.retryText} lightColor={DEEP_TEXT}>
                  Erneut versuchen
                </ThemedText>
              </TouchableOpacity>
            </LiquidGlassCard>
          ) : (
            <>
              {Object.keys(groupedItems).length === 0 ? (
                <LiquidGlassCard style={[styles.cardBase, styles.stateCard, { backgroundColor: SOFT_CARD_BG, borderColor: SOFT_BORDER }]}>
                  <ThemedText style={styles.stateText} lightColor={DEEP_TEXT}>
                    Deine Checkliste ist noch leer. Füge unten neue Einträge hinzu.
                  </ThemedText>
                </LiquidGlassCard>
              ) : (
                Object.entries(groupedItems).map(([category, items]) => (
                  <ChecklistCategory
                    key={category}
                    title={category}
                    items={items}
                    onToggleItem={handleToggleItem}
                    onDeleteItem={handleDeleteItem}
                  />
                ))
              )}

              <AddChecklistItem onAdd={handleAddItem} categories={categories} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 120,
    paddingTop: SECTION_GAP_TOP,
    gap: SECTION_GAP_TOP,
  },
  cardBase: {
    borderRadius: 26,
    borderWidth: 1,
  },
  summaryCard: {
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 18,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  summaryTextBlock: {
    flex: 1,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    lineHeight: 28,
  },
  summaryLead: {
    fontSize: 15,
    lineHeight: 20,
  },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  summaryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryFooter: {
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.35)',
  },
  summaryFooterText: {
    fontSize: 15,
    lineHeight: 22,
  },
  tipCard: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  stateCard: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  stateText: {
    fontSize: 15,
    textAlign: 'center',
  },
  errorCard: {
    borderColor: 'rgba(230, 108, 119, 0.65)',
  },
  errorText: {
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  retryText: {
    fontWeight: '600',
  },
});
