import React from 'react';
import { Alert } from 'react-native';
import { DailyEntry, saveDailyEntry, deleteDailyEntry } from '@/lib/baby';
import { SupabaseErrorHandler } from '@/lib/errorHandler';

export interface DiaperEventData {
  type: 'diaper_wet' | 'diaper_dirty' | 'diaper_both';
  note?: string;
  date: Date;
}

export class DiaperEventManager {
  
  // Map UI types to database types
  private static mapTypeToDatabase(uiType: string): string {
    const typeMap: Record<string, string> = {
      'diaper_wet': 'wet',
      'diaper_dirty': 'dirty', 
      'diaper_both': 'both'
    };
    return typeMap[uiType] || 'wet';
  }

  static async createDiaperEvent(data: DiaperEventData): Promise<{ success: boolean; id?: string; error?: string }> {
    const operation = async () => {
      console.log('💧 Creating diaper event with data:', data);
      
      const diaperEntry: DailyEntry = {
        entry_type: 'diaper',
        entry_date: data.date.toISOString().split('T')[0], // YYYY-MM-DD format
        start_time: data.date.toISOString(),
        notes: `${this.mapTypeToDatabase(data.type)}${data.note ? ` - ${data.note}` : ''}`,
      };

      console.log('💧 Mapped diaper entry:', diaperEntry);

      const { data: result, error } = await saveDailyEntry(diaperEntry);
      
      if (error) {
        throw error;
      }

      console.log('✅ Diaper event created successfully:', result);
      return result;
    };

    const result = await SupabaseErrorHandler.executeWithHandling(
      operation,
      'DiaperEvent.create',
      true,
      3
    );

    if (result.success) {
      return { success: true, id: result.data?.id };
    } else {
      return { 
        success: false, 
        error: result.error?.userMessage || 'Fehler beim Speichern des Wickeleintrags' 
      };
    }
  }

  static async deleteDiaperEvent(entryId: string): Promise<{ success: boolean; error?: string }> {
    const operation = async () => {
      console.log('🗑️ Deleting diaper event:', entryId);
      
      const { data, error } = await deleteDailyEntry(entryId);
      
      if (error) {
        throw error;
      }

      console.log('✅ Diaper event deleted successfully');
      return data;
    };

    const result = await SupabaseErrorHandler.executeWithHandling(
      operation,
      'DiaperEvent.delete',
      true,
      2
    );

    if (result.success) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: result.error?.userMessage || 'Fehler beim Löschen des Eintrags' 
      };
    }
  }

  static showError(message: string) {
    Alert.alert('Fehler beim Wickeln', message);
  }

  static showSuccess(message: string) {
    Alert.alert('Erfolg', message);
  }

  static confirmDelete(onConfirm: () => void) {
    Alert.alert(
      'Eintrag löschen',
      'Möchtest du diesen Wickeleintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: onConfirm },
      ]
    );
  }
} 