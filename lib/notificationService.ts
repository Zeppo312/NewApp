import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

import * as TaskManager from 'expo-task-manager';
import { router } from 'expo-router';

// Konfiguriere das Verhalten von Benachrichtigungen
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Definiere den Hintergrund-Task-Namen
export const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';

// Diese Funktion registriert das Gerät für Push-Benachrichtigungen
export async function registerForPushNotificationsAsync() {
  let token;
  
  // Prüfen, ob das Gerät ein physisches Gerät ist (kein Simulator)
  if (Device.isDevice) {
    // Berechtigungen prüfen
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Berechtigungen anfordern, wenn sie noch nicht erteilt wurden
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // Wenn die Berechtigungen nicht erteilt wurden, abbrechen
    if (finalStatus !== 'granted') {
      console.log('Keine Benachrichtigungserlaubnis erteilt!');
      return null;
    }
    
    // Expo-Benachrichtigungstoken abrufen
    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })).data;
      
      console.log('Push-Token:', token);
    } catch (error) {
      console.error('Fehler beim Abrufen des Push-Tokens:', error);
    }
  } else {
    console.log('Push-Benachrichtigungen erfordern ein physisches Gerät');
  }

  // Plattformspezifische Einstellungen (nur für Android)
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

// Token in der Datenbank speichern
export async function savePushToken(token: string) {
  try {
    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      console.error('Kein angemeldeter Benutzer');
      return false;
    }

    // Prüfen, ob bereits ein Token für diesen Benutzer existiert
    const { data: existingToken } = await supabase
      .from('user_push_tokens')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('token', token)
      .maybeSingle();

    // Wenn das Token bereits existiert, nichts tun
    if (existingToken) {
      console.log('Token bereits registriert');
      return true;
    }

    // Neues Token speichern
    const { error } = await supabase
      .from('user_push_tokens')
      .insert({
        user_id: userData.user.id,
        token: token,
        device_type: Platform.OS,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Fehler beim Speichern des Push-Tokens:', error);
      return false;
    }

    console.log('Push-Token erfolgreich gespeichert');
    return true;
  } catch (error) {
    console.error('Fehler beim Speichern des Push-Tokens:', error);
    return false;
  }
}

// Navigiere zur entsprechenden Ansicht basierend auf dem Benachrichtigungstyp
export function navigateToNotificationTarget(type: string, referenceId: string) {
  console.log(`Navigiere zu: Typ=${type}, ID=${referenceId}`);

  try {
    switch (type) {
      // Partner notification types
      case 'sleep_window_reminder':
        // Navigate to sleep tracker when sleep window is starting
        router.push('/(tabs)/sleep-tracker' as any);
        break;

      case 'partner_sleep':
        // Navigate to sleep tracker with optional entry ID
        router.push({
          pathname: '/(tabs)/sleep-tracker',
          params: referenceId ? { entryId: referenceId } : {}
        } as any);
        break;

      case 'partner_feeding':
      case 'partner_diaper':
        // Navigate to daily screen with optional entry ID
        router.push({
          pathname: '/(tabs)/daily_old',
          params: referenceId ? { entryId: referenceId } : {}
        } as any);
        break;

      // Community notification types
      case 'message':
        // Öffne den Chat mit dieser Nachricht
        router.push(`/chat/${referenceId}` as any);
        break;

      case 'like_post':
      case 'comment':
        // Navigiere zum Beitrag
        router.push({
          pathname: '/community',
          params: { post: referenceId }
        } as any);
        break;

      case 'follow':
        // Bei Follow-Benachrichtigungen zum Profil des Followers navigieren
        router.push(`/profile/${referenceId}` as any);
        break;

      case 'like_comment':
      case 'reply':
      case 'like_nested_comment':
        // Bei Kommentar-Aktionen, erst den Eltern-Post finden
        findParentPostAndNavigate(referenceId);
        break;

      // Planner notification types
      case 'planner_item':
        // Navigate to planner with the specific date and item
        navigateToPlannerItem(referenceId);
        break;

      default:
        // Standardmäßig zur Community-Ansicht
        console.log('Unknown notification type:', type);
        router.push('/community' as any);
    }
  } catch (error) {
    console.error('Fehler bei der Navigation:', error);
    // Fallback zur Community-Ansicht
    router.push('/community' as any);
  }
}

// Findet den übergeordneten Beitrag eines Kommentars und navigiert dorthin
async function findParentPostAndNavigate(commentId: string) {
  try {
    // Kommentar abrufen, um die Post-ID zu erhalten
    const { data: comment, error } = await supabase
      .from('community_comments')
      .select('post_id')
      .eq('id', commentId)
      .single();

    if (error || !comment) {
      console.error('Fehler beim Abrufen des Kommentars:', error);
      router.push('/community' as any);
      return;
    }

    // Navigiere zum Beitrag mit dem Fokus auf diesem Kommentar
    router.push({
      pathname: '/community',
      params: { post: comment.post_id, comment: commentId }
    } as any);
  } catch (error) {
    console.error('Fehler beim Finden des übergeordneten Beitrags:', error);
    router.push('/community' as any);
  }
}

// Navigiert zum Planner mit dem spezifischen Item
async function navigateToPlannerItem(plannerItemId: string) {
  try {
    // Planner-Item abrufen, um das Datum zu bekommen
    const { data: plannerItem, error } = await supabase
      .from('planner_items')
      .select('day_id, planner_days!inner(day)')
      .eq('id', plannerItemId)
      .single();

    if (error || !plannerItem) {
      console.error('Fehler beim Abrufen des Planner-Items:', error);
      router.push('/planner' as any);
      return;
    }

    // Extract day from the nested planner_days object
    const day = Array.isArray(plannerItem.planner_days)
      ? plannerItem.planner_days[0]?.day
      : plannerItem.planner_days?.day;

    // Navigiere zum Planner mit dem spezifischen Datum und Item
    router.push({
      pathname: '/planner',
      params: { date: day, itemId: plannerItemId }
    } as any);
  } catch (error) {
    console.error('Fehler beim Navigieren zum Planner-Item:', error);
    router.push('/planner' as any);
  }
}

// Listener für eingehende Benachrichtigungen einrichten
export function setupNotificationListeners(
  onNotification: (notification: Notifications.Notification) => void
) {
  // Listener für Benachrichtigungen im Vordergrund
  const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Benachrichtigung im Vordergrund erhalten:', notification);
    onNotification(notification);
  });

  // Listener für Interaktionen mit Benachrichtigungen
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Benutzerinteraktion mit Benachrichtigung:', response);
    
    // Daten aus der Benachrichtigung extrahieren
    const data = response.notification.request.content.data as any;
    const notificationId = data?.notificationId as string;
    const type = data?.type as string;
    const referenceId = data?.referenceId as string;
    
    // Benachrichtigung als gelesen markieren
    if (notificationId) {
      markNotificationAsRead(notificationId);
    }
    
    // Zur entsprechenden Ansicht navigieren
    if (type && referenceId) {
      navigateToNotificationTarget(type, referenceId);
    }
  });

  // Funktion zum Aufräumen der Listener
  return () => {
    Notifications.removeNotificationSubscription(foregroundSubscription);
    Notifications.removeNotificationSubscription(responseSubscription);
  };
}

// Benachrichtigung als gelesen markieren
async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('community_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
      
    if (error) {
      console.error('Fehler beim Markieren der Benachrichtigung als gelesen:', error);
    }
  } catch (error) {
    console.error('Fehler beim Markieren der Benachrichtigung als gelesen:', error);
  }
}

// Benachrichtigungen manuell im Hintergrund überprüfen
export async function checkForNewNotifications() {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    console.log('Prüfe auf neue Benachrichtigungen im Hintergrund...');

    // Abrufen ungelesener Benachrichtigungen
    const { data: notifications, error } = await supabase
      .from('community_notifications')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Abrufen neuer Benachrichtigungen:', error);
      return;
    }

    console.log(`${notifications?.length || 0} ungelesene Benachrichtigungen gefunden`);

    // Lokale Benachrichtigungen für ungelesene Einträge anzeigen
    if (notifications && notifications.length > 0) {
      notifications.forEach(async (notification) => {
        // Absenderinformationen abrufen
        const { data: sender } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', notification.sender_id)
          .single();

        const senderName = sender?.first_name || 'Jemand';
        
        // Titel und Text basierend auf dem Benachrichtigungstyp
        let title = 'Neue Benachrichtigung';
        let body = notification.content;
        
        switch (notification.type) {
          case 'like_post':
            title = `${senderName} hat deinen Beitrag geliked`;
            break;
          case 'like_comment':
            title = `${senderName} hat deinen Kommentar geliked`;
            break;
          case 'comment':
            title = `${senderName} hat auf deinen Beitrag geantwortet`;
            break;
          case 'reply':
            title = `${senderName} hat auf deinen Kommentar geantwortet`;
            break;
          case 'message':
            title = `Neue Nachricht von ${senderName}`;
            break;
          case 'follow':
            title = `${senderName} folgt dir jetzt`;
            break;
        }

        console.log(`Sende Benachrichtigung: ${title} - ${body}`);

        // Lokale Benachrichtigung anzeigen
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { 
              notificationId: notification.id,
              type: notification.type,
              referenceId: notification.reference_id
            },
          },
          trigger: null, // Sofort anzeigen
        });
      });
    }
  } catch (error) {
    console.error('Fehler bei der Hintergrundaktualisierung:', error);
  }
}

// Background-Task für Benachrichtigungen registrieren
export async function registerBackgroundNotificationTask() {
  console.log('Registriere Hintergrundaufgabe für Benachrichtigungen...');
  try {
    // Registriere den Task für Background Fetch (jetzt nur noch TaskManager)
    // Task muss mit TaskManager.defineTask definiert werden (sollte an anderer Stelle im Code sein)
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!isRegistered) {
      // Hier ggf. weitere Logik, falls Task nicht registriert ist
      console.log('Task war noch nicht registriert.');
    }
    console.log('Hintergrundaufgabe erfolgreich geprüft/registriert');
    return true;
  } catch (error) {
    console.error('Fehler beim Registrieren der Hintergrundaufgabe:', error);
    return false;
  }
}

// Prüfe, ob der Background-Task registriert ist
 