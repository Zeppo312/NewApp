import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ChecklistItem as ChecklistItemType } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { TEXT_PRIMARY } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

const CHECK_ACCENT = '#9D7BD8';

interface ChecklistItemProps {
  item: ChecklistItemType;
  onToggle: (id: string, isChecked: boolean) => void;
  onDelete: (id: string) => void;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, onToggle, onDelete }) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const baseBackground = isDark ? 'rgba(18,14,12,0.72)' : 'rgba(255,255,255,0.85)';
  const borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.55)';
  const textColor = isDark ? adaptiveColors.textPrimary : TEXT_PRIMARY;
  const notesColor = isDark ? adaptiveColors.textSecondary : `${textColor}CC`;
  const deleteBg = isDark ? 'rgba(157,123,216,0.3)' : 'rgba(157,123,216,0.2)';

  return (
    <View style={[styles.container, { backgroundColor: baseBackground, borderColor }]}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => onToggle(item.id, !item.is_checked)}
      >
        <View style={[
          styles.checkbox,
          {
            borderColor: item.is_checked ? CHECK_ACCENT : `${textColor}55`,
            backgroundColor: item.is_checked ? CHECK_ACCENT : 'transparent',
            shadowOpacity: item.is_checked ? 0.2 : 0,
          }
        ]}>
          {item.is_checked && (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          )}
        </View>
      </TouchableOpacity>
      
      <View style={styles.textContainer}>
        <ThemedText
          style={[
            styles.itemText,
            { color: textColor },
            item.is_checked ? styles.itemTextChecked : {}
          ]}
        >
          {item.item_name}
        </ThemedText>

        {item.notes && (
          <ThemedText style={[styles.notes, { color: notesColor }]}>
            {item.notes}
          </ThemedText>
        )}
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: deleteBg }]}
        onPress={() => onDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color={CHECK_ACCENT} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 18,
    gap: 12,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  textContainer: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  notes: {
    fontSize: 14,
    marginTop: 4,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(157,123,216,0.2)',
  },
});
