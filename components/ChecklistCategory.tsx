import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ChecklistItem as ChecklistItemType } from '@/lib/supabase';
import { ChecklistItem } from './ChecklistItem';
import { Collapsible } from './Collapsible';
import { ProgressCircle } from './ProgressCircle';
import { TEXT_PRIMARY } from '@/constants/DesignGuide';

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
  // Berechne den Fortschritt (wie viele Items sind abgehakt)
  const checkedCount = items.filter(item => item.is_checked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const categoryAccent = categoryColors[title] || defaultAccent;

  return (
    <Collapsible
      title={title}
      subtitle={`${checkedCount}/${totalCount} • ${progress}%`}
      initiallyExpanded={true}
      leftComponent={
        <View style={[styles.progressWrapper, { borderColor: `${categoryAccent}55`, backgroundColor: `${categoryAccent}22` }]}>
          <ProgressCircle
            progress={progress}
            size={38}
            progressColor={categoryAccent}
            backgroundColor={`${categoryAccent}40`}
            textColor={TEXT_PRIMARY}
          />
        </View>
      }
    >
      <View style={styles.container}>
        {items.length === 0 ? (
          <ThemedText style={styles.emptyText}>
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
