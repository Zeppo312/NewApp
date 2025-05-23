import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { registerForPushNotificationsAsync, savePushToken, setupNotificationListeners } from '@/lib/notificationService';

interface NotificationBadgeProps {
  size?: number;
  refreshTrigger?: any; // Prop zum manuellen Auslösen einer Aktualisierung
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ 
  size = 20,
  refreshTrigger 
}) => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Push-Token registrieren und in Supabase speichern
  useEffect(() => {
    if (!user) return;

    // Asynchrone Funktion zur Registrierung des Push-Tokens
    const registerPushToken = async () => {
      try {
        // Push-Token erhalten
        const token = await registerForPushNotificationsAsync();
        
        // Token in der Datenbank speichern, wenn verfügbar
        if (token) {
          await savePushToken(token);
        }
      } catch (error) {
        console.error('Fehler bei der Push-Token-Registrierung:', error);
      }
    };

    // Notification Listener einrichten
    const cleanup = setupNotificationListeners((notification) => {
      // Aktualisiere den Benachrichtigungszähler, wenn eine neue Benachrichtigung eintrifft
      fetchNotificationCount();
    });

    // Token registrieren
    registerPushToken();

    return () => {
      // Bereinige die Listener beim Unmount
      cleanup();
    };
  }, [user]);

  // Funktion zum Abrufen der ungelesenen Benachrichtigungen
  const fetchNotificationCount = async () => {
    if (!user) return;
    
    try {
      // Community-Benachrichtigungen zählen
      const { data: notificationData, error: notificationError } = await supabase
        .from('community_notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (notificationError) {
        console.error('Error fetching notification count:', notificationError);
      }
      
      // Direktnachrichten zählen
      const { data: messageData, error: messageError } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact' })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      
      if (messageError) {
        console.error('Error fetching message count:', messageError);
      }
      
      // Beide Zähler addieren
      const notificationCount = notificationData?.length || 0;
      const messageCount = messageData?.length || 0;
      const totalCount = notificationCount + messageCount;
      
      console.log(`Notification Badge: ${notificationCount} notifications + ${messageCount} messages = ${totalCount} total`);
      
      setCount(totalCount);
    } catch (err) {
      console.error('Error in notification count fetch:', err);
    }
  };

  // Setup für Echtzeit-Updates und periodische Aktualisierungen
  useEffect(() => {
    if (!user) return;
    
    // Initial abrufen
    fetchNotificationCount();
    
    // Regelmäßige Aktualisierung alle 5 Sekunden
    timerRef.current = setInterval(fetchNotificationCount, 5000) as unknown as number;
    
    // Echtzeit-Updates abonnieren für neue Benachrichtigungen
    const notificationsSubscription = supabase
      .channel('notifications_count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Bei jeder Änderung den Zähler sofort aktualisieren
        fetchNotificationCount();
      })
      .subscribe();
    
    // Echtzeit-Updates abonnieren für neue Direktnachrichten
    const messagesSubscription = supabase
      .channel('direct_messages_count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${user.id}`
      }, () => {
        // Bei neuen Nachrichten den Zähler sofort aktualisieren
        fetchNotificationCount();
      })
      .subscribe();
    
    return () => {
      // Cleanup
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      supabase.removeChannel(notificationsSubscription);
      supabase.removeChannel(messagesSubscription);
    };
  }, [user]);
  
  // Auf externen Aktualisierungstrigger reagieren
  useEffect(() => {
    if (refreshTrigger) {
      fetchNotificationCount();
    }
  }, [refreshTrigger]);
  
  if (count <= 0) return null;
  
  return (
    <View style={[styles.badge, { width: size, height: size }]}>
      <Text style={styles.text}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  text: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
}); 