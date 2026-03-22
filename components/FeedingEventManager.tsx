import React, { useState } from 'react';
import { Alert } from 'react-native';
import { FeedingEvent, saveFeedingEvent, updateFeedingEventEnd } from '@/lib/baby';
import { SupabaseErrorHandler } from '@/lib/errorHandler';

export interface FeedingEventData {
  type: 'feeding_breast' | 'feeding_bottle' | 'feeding_solids';
  volume_ml?: number;
  side?: 'LEFT' | 'RIGHT' | 'BOTH';
  note?: string;
  date: Date;
}

export class FeedingEventManager {
  
  // Map UI types to database types
  private static mapTypeToDatabase(uiType: string): 'BREAST' | 'BOTTLE' | 'SOLIDS' {
    const typeMap: Record<string, 'BREAST' | 'BOTTLE' | 'SOLIDS'> = {
      'feeding_breast': 'BREAST',
      'feeding_bottle': 'BOTTLE', 
      'feeding_solids': 'SOLIDS'
    };
    return typeMap[uiType] || 'BREAST';
  }

  static async createFeedingEvent(
    data: FeedingEventData,
    babyId: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
  
    const operation = async () => {
      if (!babyId) {
        throw new Error('No active baby selected');
      }
  
      console.log('🍼 Creating feeding event with data:', data);
  
      const feedingEvent: FeedingEvent = {
        type: this.mapTypeToDatabase(data.type),
        start_time: data.date.toISOString(),
        volume_ml: data.volume_ml,
        side: data.side,
        note: data.note || '',
      };
  
      console.log('🍼 Mapped feeding event:', feedingEvent);
  
      const { data: result, error } = await saveFeedingEvent(feedingEvent, babyId);
  
      if (error) throw error;
  
      console.log('✅ Feeding event created successfully:', result);
      return result;
    };
  
    const result = await SupabaseErrorHandler.executeWithHandling(
      operation,
      'FeedingEvent.create',
      true,
      3
    );
  
    if (result.success) {
      return { success: true, id: result.data?.id };
    } else {
      return {
        success: false,
        error: result.error?.userMessage || 'Fehler beim Speichern des Fütterungseintrags',
      };
    }
  }

  static async stopFeedingTimer(timerId: string): Promise<{ success: boolean; error?: string }> {
    const operation = async () => {
      console.log('⏹️ Stopping feeding timer:', timerId);
      
      const { data, error } = await updateFeedingEventEnd(timerId, new Date());
      
      if (error) {
        throw error;
      }

      console.log('✅ Timer stopped successfully:', data);
      return data;
    };

    const result = await SupabaseErrorHandler.executeWithHandling(
      operation,
      'FeedingEvent.stopTimer',
      true,
      2
    );

    if (result.success) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: result.error?.userMessage || 'Fehler beim Stoppen des Timers' 
      };
    }
  }

  static showError(message: string) {
    Alert.alert('Fehler bei Fütterung', message);
  }

  static showSuccess(message: string) {
    Alert.alert('Erfolg', message);
  }
} 