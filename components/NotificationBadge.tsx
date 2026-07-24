import React, { useState, useEffect } from 'react';
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
      const { data, error } = await supabase.rpc('get_unread_notification_count', {
        user_id_param: user.id
      });
      
      if (error) {
        console.error('Error fetching notification count:', error);
        return;
      }
      
      setCount(data || 0);
    } catch (err) {
      console.error('Error in notification count fetch:', err);
    }
  };

  // Setup für Echtzeit-Updates (Polling entfernt - nur noch Realtime!)
  useEffect(() => {
    if (!user) return;

    // Initial abrufen
    fetchNotificationCount();

    // Echtzeit-Updates abonnieren für neue Benachrichtigungen
    const subscription = supabase
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

    return () => {
      // Cleanup
      supabase.removeChannel(subscription);
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