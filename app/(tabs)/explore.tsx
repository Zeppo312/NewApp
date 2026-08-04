import { StyleSheet, TouchableOpacity, Alert, ActivityIndicator, View, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ChecklistCategory } from '@/components/ChecklistCategory';
import { AddChecklistItem } from '@/components/AddChecklistItem';
import { ProgressCircle } from '@/components/ProgressCircle';

import { ChecklistItem, getHospitalChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem, supabaseUrl } from '@/lib/supabase';
import { LiquidGlassCard, LAYOUT_PAD, SECTION_GAP_TOP, PRIMARY, TEXT_PRIMARY, GLASS_OVERLAY, GLASS_OVERLAY_DARK } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLocale } from '@/contexts/LocaleContext';
import {
  getHospitalChecklistCategories,
  getHospitalChecklistDefaultItems,
  translatePregnancyChecklistText,
  type PregnancyChecklistTranslationKey,
} from '@/lib/pregnancyChecklistTranslations';

const ACCENT_PURPLE = '#A47AD4';
const DEEP_TEXT = '#5C4033';
const SOFT_CARD_BG = 'rgba(255, 246, 237, 0.88)';
const SOFT_BORDER = 'rgba(255,255,255,0.65)';
const TIP_ICON = '#B896FF';
const BADGE_TINT = 'rgba(142, 78, 198, 0.14)';
const BADGE_BORDER = 'rgba(142, 78, 198, 0.35)';

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
  const { locale } = useLocale();
  const t = (key: PregnancyChecklistTranslationKey, params?: Record<string, string | number>) =>
    translatePregnancyChecklistText(locale, key, params);
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? adaptiveColors.textPrimary : '#5C4033';
  const textSecondary = isDark ? adaptiveColors.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const softCardBg = isDark ? 'rgba(0,0,0,0.35)' : SOFT_CARD_BG;
  const softBorder = isDark ? 'rgba(255,255,255,0.18)' : SOFT_BORDER;
  const deepText = isDark ? adaptiveColors.textPrimary : DEEP_TEXT;
  const softText = isDark ? adaptiveColors.textSecondary : 'rgba(92,64,51,0.8)';
  const badgeAccent = isDark ? adaptiveColors.accent : PRIMARY;
  const tipIconColor = isDark ? adaptiveColors.accent : TIP_ICON;
  const errorBorderColor = isDark ? 'rgba(255,122,122,0.55)' : '#EFB0B6';
  const errorTextColor = isDark ? '#FFB4B4' : '#A8464C';
  const retryButtonBg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)';
  const retryButtonBorder = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)';

  // State für die Checkliste
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localizedCategories = getHospitalChecklistCategories(locale);
  const categories = localizedCategories.map((category) => category.label);
  const defaultItems = getHospitalChecklistDefaultItems(locale).map((item) => ({
    item_name: item.name,
    category: localizedCategories.find((category) => category.id === item.categoryId)?.label ?? categories.at(-1) ?? '',
    notes: item.notes,
  }));
  const localizeStoredItems = (items: ChecklistItem[]) => {
    const sourceLocales = ['de', 'en', 'es'] as const;
    const sourceDefaults = sourceLocales.map(getHospitalChecklistDefaultItems);
    const sourceCategories = sourceLocales.map(getHospitalChecklistCategories);

    return items.map((item) => {
      const position = item.position ?? -1;
      const targetDefault = defaultItems[position];
      const isKnownDefault = position >= 0 && sourceDefaults.some((rows) => rows[position]?.name === item.item_name);
      const categoryIndex = sourceCategories[0].findIndex((category, index) =>
        sourceCategories.some((rows) => rows[index]?.label === item.category),
      );
      return {
        ...item,
        item_name: isKnownDefault && targetDefault ? targetDefault.item_name : item.item_name,
        category: categoryIndex >= 0 ? localizedCategories[categoryIndex].label : item.category,
        notes: isKnownDefault && targetDefault ? targetDefault.notes : item.notes,
      };
    });
  };

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

        setChecklist(deduplicateChecklist(localizeStoredItems(initializedItems)));
      } else {
        // Wenn bereits Daten vorhanden sind, verwenden wir diese
        setChecklist(deduplicateChecklist(localizeStoredItems(data || [])));
      }
    } catch (err) {
      console.error('Error loading checklist:', err);
      setError(t('error.load'));

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
  }, [locale]);

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
      Alert.alert(t('common.error'), t('error.add'));
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
      Alert.alert(t('common.error'), t('error.toggle'));
    }
  };

  // Löschen eines Eintrags
  const handleDeleteItem = async (id: string) => {
    Alert.alert(
      t('delete.title'),
      t('delete.confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteChecklistItem(id);
              if (error) throw error;
              setChecklist(checklist.filter(item => item.id !== id));
            } catch (err) {
              console.error('Error deleting checklist item:', err);
              Alert.alert(t('common.error'), t('error.delete'));
            }
          }
        }
      ]
    );
  };

  // Gruppieren der Einträge nach Kategorien
  const groupedItems = checklist.reduce<Record<string, ChecklistItem[]>>((groups, item) => {
    const category = item.category || categories.at(-1) || '';
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
      return t('progress.start');
    }
    if (totalProgress < 50) {
      return t('progress.middle');
    }
    if (totalProgress < 90) {
      return t('progress.almost');
    }
    return t('progress.done');
  }, [totalProgress, locale]);

  return (
    <ThemedBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title={t('screen.title')}
          subtitle={t('screen.subtitle')}
          showBackButton
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          <LiquidGlassCard style={[styles.cardBase, styles.summaryCard, { backgroundColor: softCardBg, borderColor: softBorder }]}>
            <View style={styles.summaryHeader}>
              <ProgressCircle
                progress={totalProgress}
                size={70}
                progressColor={isDark ? adaptiveColors.accent : ACCENT_PURPLE}
                backgroundColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)'}
                textColor={deepText}
              />
              <View style={styles.summaryTextBlock}>
                <ThemedText style={[styles.summaryTitle, { color: deepText }]}>
                  {t('summary.title')}
                </ThemedText>
                <ThemedText style={[styles.summaryLead, { color: softText }]}>
                  {t('summary.description')}
                </ThemedText>
                <View style={styles.summaryBadges}>
                  <View style={[styles.summaryBadge, { backgroundColor: isDark ? 'rgba(142,78,198,0.22)' : BADGE_TINT, borderColor: BADGE_BORDER }]}>
                    <IconSymbol name="doc.text" size={16} color={badgeAccent} />
                    <ThemedText style={[styles.summaryBadgeText, { color: badgeAccent }]}>
                      {t('summary.categories', { count: totalCategories })}
                    </ThemedText>
                  </View>
                  <View style={[styles.summaryBadge, { backgroundColor: isDark ? 'rgba(142,78,198,0.22)' : BADGE_TINT, borderColor: BADGE_BORDER }]}>
                    <IconSymbol name="checkmark.seal.fill" size={16} color={badgeAccent} />
                    <ThemedText style={[styles.summaryBadgeText, { color: badgeAccent }]}>
                      {t('summary.completed', { completed: checkedItems, total: totalItems || 0 })}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
            <View style={[styles.summaryFooter, isDark && { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
              <ThemedText style={[styles.summaryFooterText, { color: softText }]}>
                {progressNote}
              </ThemedText>
            </View>
          </LiquidGlassCard>

          {loading ? (
            <LiquidGlassCard style={[styles.cardBase, styles.stateCard, { backgroundColor: softCardBg, borderColor: softBorder }]}>
              <ActivityIndicator size="small" color={ACCENT_PURPLE} />
              <ThemedText style={[styles.stateText, { color: deepText }]}>
                {t('state.loading')}
              </ThemedText>
            </LiquidGlassCard>
          ) : error ? (
            <LiquidGlassCard style={[styles.cardBase, styles.stateCard, styles.errorCard, { backgroundColor: softCardBg, borderColor: errorBorderColor }]}>
              <ThemedText style={[styles.stateText, styles.errorText, { color: errorTextColor }]}>
                {error}
              </ThemedText>
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: retryButtonBg, borderColor: retryButtonBorder }]} onPress={loadChecklist}>
                <ThemedText style={[styles.retryText, { color: deepText }]}>
                  {t('action.retry')}
                </ThemedText>
              </TouchableOpacity>
            </LiquidGlassCard>
          ) : (
            <>
              <AddChecklistItem onAdd={handleAddItem} categories={categories} />

              {Object.keys(groupedItems).length === 0 ? (
                <LiquidGlassCard style={[styles.cardBase, styles.stateCard, { backgroundColor: softCardBg, borderColor: softBorder }]}>
                  <ThemedText style={[styles.stateText, { color: deepText }]}>
                    {t('state.empty')}
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
            </>
          )}

          <LiquidGlassCard style={[styles.cardBase, styles.tipCard, { backgroundColor: softCardBg, borderColor: softBorder }]}>
            <View style={styles.tipContent}>
              <IconSymbol name="sparkles" size={20} color={tipIconColor} />
              <ThemedText style={[styles.tipText, { color: deepText }]}>
                {t('tip.review')}
              </ThemedText>
            </View>
          </LiquidGlassCard>
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
