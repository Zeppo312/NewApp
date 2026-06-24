import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ChecklistItem as ChecklistItemType } from '@/lib/supabase';
import { ChecklistItem } from './ChecklistItem';
import { Collapsible } from './Collapsible';
import { ProgressCircle } from './ProgressCircle';
import { TEXT_PRIMARY } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

interface ChecklistCategoryProps {
  title: string;
  items: ChecklistItemType[];
  onToggleItem: (id: string, isChecked: boolean) => void;
  onDeleteItem: (id: string) => void;
}

export const ChecklistCategory: React.FC<ChecklistCategoryProps> = ({
  title,
  items,
  onToggleItem,
  onDeleteItem,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? adaptiveColors.textPrimary : TEXT_PRIMARY;
  const textSecondary = isDark ? adaptiveColors.textSecondary : 'rgba(125,90,80,0.75)';

  // Berechne den Fortschritt (wie viele Items sind abgehakt)
  const checkedCount = items.filter(item => item.is_checked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const categoryAccent = categoryColors[title] || defaultAccent;
  const progressChipBorder = isDark ? `${categoryAccent}88` : `${categoryAccent}55`;
  const progressChipBackground = isDark ? `${categoryAccent}2E` : `${categoryAccent}22`;
  const progressTrackColor = isDark ? `${categoryAccent}55` : `${categoryAccent}40`;

  return (
    <Collapsible
      title={title}
      subtitle={`${checkedCount}/${totalCount} • ${progress}%`}
      initiallyExpanded={true}
      leftComponent={
        <View style={[styles.progressWrapper, { borderColor: progressChipBorder, backgroundColor: progressChipBackground }]}>
          <ProgressCircle
            progress={progress}
            size={38}
            progressColor={categoryAccent}
            backgroundColor={progressTrackColor}
            textColor={textPrimary}
          />
        </View>
      }
    >
      <View style={styles.container}>
        {items.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: textSecondary }]}>
            Keine Einträge in dieser Kategorie
          </ThemedText>
        ) : (
          items.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={onToggleItem}
              onDelete={onDeleteItem}
            />
          ))
        )}
      </View>
    </Collapsible>
  );
};

const defaultAccent = '#E9C9B6';
const categoryColors: Record<string, string> = {
  Dokumente: '#EBC3A8',
  'Kleidung für Mama': '#F4C9D1',
  'Kleidung für Baby': '#D8E2D4',
  Hygieneartikel: '#F0D0BA',
  Sonstiges: '#D6C7ED',
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingTop: 12,
  },
  emptyText: {
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
    paddingVertical: 16,
  },
  progressWrapper: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
});
