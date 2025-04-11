import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ChecklistItem as ChecklistItemType } from '@/lib/supabase';
import { ChecklistItem } from './ChecklistItem';
import { Collapsible } from './Collapsible';

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

  return (
    <Collapsible 
      title={title}
      subtitle={`${checkedCount}/${totalCount} (${progress}%)`}
      initiallyExpanded={true}
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

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  emptyText: {
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
