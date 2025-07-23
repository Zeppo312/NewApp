import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ChecklistItem as ChecklistItemType } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ChecklistItemProps {
  item: ChecklistItemType;
  onToggle: (id: string, isChecked: boolean) => void;
  onDelete: (id: string) => void;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, onToggle, onDelete }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => onToggle(item.id, !item.is_checked)}
      >
        <View style={[
          styles.checkbox,
          item.is_checked ? styles.checkboxChecked : {},
          { borderColor: theme.text }
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
            item.is_checked ? styles.itemTextChecked : {}
          ]}
        >
          {item.item_name}
        </ThemedText>
        
        {item.notes && (
          <ThemedText style={styles.notes}>
            {item.notes}
          </ThemedText>
        )}
      </View>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#E9C9B6" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9E9E9',
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
  },
  checkboxChecked: {
    backgroundColor: '#E9C9B6',
    borderColor: '#E9C9B6',
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
    opacity: 0.7,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
});
