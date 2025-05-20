import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator, Text, SafeAreaView, RefreshControl } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/lib/community';
import { navigateToNotificationTarget } from '@/lib/notificationService';
import { getFollowedUsers, isFollowingUser, createMissingFollowNotifications } from '@/lib/follows';
import Header from '@/components/Header';
import { User } from '@supabase/supabase-js';

// Interface für direkte Nachrichten
interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_name?: string;
  receiver_name?: string;
}

// Konstanten für Tab-Indizes
const TABS = {
  MESSAGES: 0,
  ACTIVITY: 1,
  COMMENTS: 2
};

export default function NotificationsScreen() {
  const { tab } = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();

  const initialTab = Array.isArray(tab) ? tab[0] : tab;
  const [activeTab, setActiveTab] = useState(
    initialTab === 'activity'
      ? TABS.ACTIVITY
      : initialTab === 'comments'
      ? TABS.COMMENTS
      : TABS.MESSAGES
  );

  // Aktualisiere den aktiven Tab, wenn sich der Query-Parameter ändert
  useEffect(() => {
    if (initialTab === 'activity') setActiveTab(TABS.ACTIVITY);
    else if (initialTab === 'comments') setActiveTab(TABS.COMMENTS);
    else if (initialTab === 'messages') setActiveTab(TABS.MESSAGES);
  }, [initialTab]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);

  // Formatiert ein Datum für die Anzeige
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `vor ${diffInMinutes} Min`;
    } else if (diffInMinutes < 1440) { // 24 Stunden
      return `vor ${Math.floor(diffInMinutes / 60)} Std`;
    } else {
      return `am ${date.toLocaleDateString('de-DE')}`;
    }
  };

  // Aktualisiert (refresht) die Daten
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadFollowedUsers()]);
    setRefreshing(false);
  }, []);

  // Lädt die gefolgten Benutzer
  const loadFollowedUsers = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await getFollowedUsers();
      if (error) throw error;
      
      const userIds = data?.map((user: { user_id: string }) => user.user_id) || [];
      setFollowedUserIds(userIds);
    } catch (error) {
      console.error('Fehler beim Laden der gefolgten Benutzer:', error);
    }
  };

  // Lädt Benachrichtigungen und Nachrichten
  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Benachrichtigungen laden
      const { data: notificationData, error: notificationError } = await supabase
        .from('community_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (notificationError) throw notificationError;
      
      console.log("LOADED NOTIFICATIONS:", notificationData?.length || 0);
      console.log("FOLLOW NOTIFICATIONS:", notificationData?.filter(n => n.type === 'follow').length || 0);
      
      // Nachrichten laden - sowohl als Empfänger als auch als Absender
      const { data: receivedMessages, error: receivedError } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });
        
      if (receivedError) throw receivedError;
      
      const { data: sentMessages, error: sentError } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });
        
      if (sentError) throw sentError;
      
      // Alle Nachrichten kombinieren
      const allMessages = [...(receivedMessages || []), ...(sentMessages || [])];
      
      // Gruppiere nach Chat-Partner und behalte nur die neueste Nachricht pro Chat
      const latestMessagesByChatPartner = new Map<string, DirectMessage>();
      
      for (const message of allMessages) {
        // Bestimme den Chat-Partner (die andere Person im Chat)
        const partnerId = message.sender_id === user.id ? message.receiver_id : message.sender_id;
        
        // Wenn wir noch keine Nachricht für diesen Partner haben oder diese Nachricht neuer ist
        if (!latestMessagesByChatPartner.has(partnerId) || 
            new Date(message.created_at) > new Date(latestMessagesByChatPartner.get(partnerId)!.created_at)) {
          latestMessagesByChatPartner.set(partnerId, message);
        }
      }
      
      // Konvertiere zurück in ein Array und sortiere nach Erstellungsdatum (neueste zuerst)
      const uniqueMessages = Array.from(latestMessagesByChatPartner.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log(`Found ${uniqueMessages.length} unique chat conversations`);
      
      // Benachrichtigungen anreichern
      const enhancedNotifications = await Promise.all((notificationData || []).map(async notification => {
        // Absenderinformationen abrufen - verbesserte Methode mit Fallbacks
        let senderName = 'Benutzer';
        let senderProfile = null;
        
        try {
          // Methode 1: Direkte Abfrage der Profile-Tabelle
          console.log(`Trying to get profile for sender_id: ${notification.sender_id}`);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', notification.sender_id)
            .single();
            
          if (profileError) {
            console.error(`Error fetching profile for ${notification.sender_id}:`, profileError);
          } else if (profileData) {
            console.log(`Profile data found for ${notification.sender_id}:`, profileData);
            senderProfile = profileData;
          }
          
          // Methode 2: Falls keine direkte Übereinstimmung, try mit get_user_profile Funktion
          if (!senderProfile) {
            console.log(`Trying rpc get_user_profile for ${notification.sender_id}`);
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_user_profile', { user_id_param: notification.sender_id });
              
            if (rpcError) {
              console.error(`RPC Error for ${notification.sender_id}:`, rpcError);
            } else if (rpcData && rpcData.length > 0) {
              console.log(`RPC data found for ${notification.sender_id}:`, rpcData[0]);
              senderProfile = rpcData[0];
            }
          }
          
          // Methode 3: Als letzten Ausweg, user_settings Tabelle prüfen
          if (!senderProfile) {
            console.log(`Trying user_settings for ${notification.sender_id}`);
            const { data: settingsData, error: settingsError } = await supabase
              .from('user_settings')
              .select('first_name, last_name, username')
              .eq('user_id', notification.sender_id)
              .single();
              
            if (settingsError) {
              console.error(`Settings Error for ${notification.sender_id}:`, settingsError);
            } else if (settingsData) {
              console.log(`Settings data found for ${notification.sender_id}:`, settingsData);
              if (settingsData.username) {
                senderName = settingsData.username;
              } else if (settingsData.first_name) {
                senderName = settingsData.last_name 
                  ? `${settingsData.first_name} ${settingsData.last_name}`
                  : settingsData.first_name;
              }
            }
          }
          
          // Wenn wir ein Profil gefunden haben, Namen setzen
          if (senderProfile) {
            if (senderProfile.first_name) {
              senderName = senderProfile.last_name 
                ? `${senderProfile.first_name} ${senderProfile.last_name}`
                : senderProfile.first_name;
            }
          }
        } catch (error) {
          console.error(`Error in profile lookup for ${notification.sender_id}:`, error);
        }
        
        // Debug-Log für das finale Ergebnis
        console.log(`Final sender_name for ${notification.sender_id}:`, senderName);
          
        return {
          ...notification,
          sender_name: senderName
        };
      }));
      
      // Nachrichten anreichern
      const enhancedMessages = await Promise.all((uniqueMessages || []).map(async message => {
        // Bestimme, ob die aktuelle Nachricht vom Benutzer selbst oder einem anderen Benutzer stammt
        const isFromCurrentUser = message.sender_id === user.id;
        
        // Wir müssen entweder den Sender oder den Empfänger anreichern, je nachdem, wer der Chatpartner ist
        const chatPartnerId = isFromCurrentUser ? message.receiver_id : message.sender_id;
        
        // Absenderinformationen abrufen - verbesserte Methode mit Fallbacks
        let partnerName = 'Benutzer';
        let partnerProfile = null;
        
        try {
          // Methode 1: Direkte Abfrage der Profile-Tabelle
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', chatPartnerId)
            .single();
            
          if (profileError) {
            console.log(`Error fetching profile for chat partner ${chatPartnerId}:`, profileError);
          } else if (profileData) {
            partnerProfile = profileData;
          }
          
          // Methode 2: Falls keine direkte Übereinstimmung, try mit get_user_profile Funktion
          if (!partnerProfile) {
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_user_profile', { user_id_param: chatPartnerId });
              
            if (rpcError) {
              console.log(`RPC Error for chat partner ${chatPartnerId}:`, rpcError);
            } else if (rpcData && rpcData.length > 0) {
              partnerProfile = rpcData[0];
            }
          }
          
          // Methode 3: Als letzten Ausweg, user_settings Tabelle prüfen
          if (!partnerProfile) {
            const { data: settingsData, error: settingsError } = await supabase
              .from('user_settings')
              .select('first_name, last_name, username')
              .eq('user_id', chatPartnerId)
              .single();
              
            if (settingsError) {
              console.log(`Settings Error for chat partner ${chatPartnerId}:`, settingsError);
            } else if (settingsData) {
              if (settingsData.username) {
                partnerName = settingsData.username;
              } else if (settingsData.first_name) {
                partnerName = settingsData.last_name 
                  ? `${settingsData.first_name} ${settingsData.last_name}`
                  : settingsData.first_name;
              }
            }
          }
          
          // Wenn wir ein Profil gefunden haben, Namen setzen
          if (partnerProfile) {
            if (partnerProfile.first_name) {
              partnerName = partnerProfile.last_name 
                ? `${partnerProfile.first_name} ${partnerProfile.last_name}`
                : partnerProfile.first_name;
            }
          }
        } catch (error) {
          console.log(`Error in profile lookup for chat partner ${chatPartnerId}:`, error);
        }
        
        // Setze entweder sender_name oder receiver_name basierend darauf, wer der Chatpartner ist
        if (isFromCurrentUser) {
          return {
            ...message,
            receiver_name: partnerName
          };
        } else {
          return {
            ...message,
            sender_name: partnerName
          };
        }
      }));
      
      // Erweiterte Nachrichten in den State setzen
      setMessages(enhancedMessages);
      
      // Erweiterte Benachrichtigungen setzen
      setNotifications(enhancedNotifications);
      
      // Debug-Info ausgeben
      console.log("PROCESSED NOTIFICATIONS:", enhancedNotifications.length);
      
      // Erfolgreich geladen, Loading-Status beenden
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setLoading(false);
    }
  };
  
  // Lade Daten beim ersten Rendern
  useEffect(() => {
    loadFollowedUsers().then(() => loadData());
    
    // Echtzeit-Updates für Benachrichtigungen
    const notificationsSubscription = supabase
      .channel('notifications_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_notifications',
        // @ts-ignore - user kommt aus dem AuthContext und ist vom Typ User | null
        filter: user ? `user_id=eq.${user.id}` : undefined
      }, () => {
        loadData();
      })
      .subscribe();
    
    // Echtzeit-Updates für Nachrichten
    const messagesSubscription = supabase
      .channel('messages_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'direct_messages',
        // @ts-ignore - user kommt aus dem AuthContext und ist vom Typ User | null
        filter: user ? `receiver_id=eq.${user.id}` : undefined
      }, () => {
        loadData();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(notificationsSubscription);
      supabase.removeChannel(messagesSubscription);
    };
  }, [user]);
  
  // Markiert eine Benachrichtigung als gelesen und navigiert zu ihrem Ziel
  const handleNotificationPress = async (notification: Notification) => {
    try {
      console.log(`Notification clicked: type=${notification.type}, ref=${notification.reference_id}`);
      
      // Markiere als gelesen, falls noch nicht gelesen
      if (!notification.is_read) {
        await supabase
          .from('community_notifications')
          .update({ is_read: true })
          .eq('id', notification.id);
      }
      
      // Zur entsprechenden Ansicht navigieren
      if (notification.type === 'follow') {
        // Direkt zum Profil des Followers navigieren
        console.log(`Navigating to profile: ${notification.reference_id}`);
        router.push(`/profile/${notification.reference_id}` as any);
      } else {
        // Andere Benachrichtigungstypen über den Service verarbeiten
        navigateToNotificationTarget(notification.type, notification.reference_id);
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten der Benachrichtigung:', error);
    }
  };
  
  // Öffnet den Chat mit dem Absender
  const handleMessagePress = (message: DirectMessage) => {
    try {
      // Markiere als gelesen, falls noch nicht gelesen
      if (!message.is_read) {
        supabase
          .from('direct_messages')
          .update({ is_read: true })
          .eq('id', message.id);
      }
      
      // Zum Chat navigieren
      router.navigate({
        pathname: "chat/[id]",
        params: { id: message.sender_id }
      } as any);
    } catch (error) {
      console.error('Fehler beim Öffnen des Chats:', error);
    }
  };
  
  // Filtert Benachrichtigungen nach Typ
  const getFilteredNotifications = () => {
    if (!notifications) return [];

    switch (activeTab) {
      case TABS.ACTIVITY:
        return notifications.filter(n => n.type === 'like_post' || n.type === 'like_comment' || n.type === 'like_nested_comment');
      case TABS.COMMENTS:
        return notifications.filter(n => n.type === 'comment' || n.type === 'reply');
      default:
        return [];
    }
  };

  // Filtert Nachrichten, sodass nur Nachrichten von gefolgten Benutzern angezeigt werden
  const getFilteredMessages = () => {
    if (!messages) return [];

    // Wenn wir im Messages-Tab sind, zeige auch follow/message-Benachrichtigungen an
    const followNotifications = notifications.filter(n => n.type === 'follow' || n.type === 'message');
    
    return [...messages, ...followNotifications];
  };
  
  // Hilfsfunktion zur Typenprüfung
  const isFollowNotification = (item: any): item is Notification => {
    return item && typeof item === 'object' && 'type' in item && item.type === 'follow';
  };
  
  const isDirectMessage = (item: any): item is DirectMessage => {
    return item && typeof item === 'object' && 'receiver_id' in item;
  };
  
  // Rendert ein einzelnes Nachrichtenitem
  const renderMessage = ({ item }: { item: DirectMessage }) => {
    // Bestimme, ob die aktuelle Nachricht vom Benutzer selbst oder einem anderen Benutzer stammt
    const isFromCurrentUser = user && item.sender_id === user.id;
    
    // Wähle das richtige Icon und Namen basierend darauf, wer die Nachricht gesendet hat
    const iconName = isFromCurrentUser ? "paperplane" : "envelope";
    const displayName = isFromCurrentUser 
      ? `Nachricht an ${item.receiver_name || 'Benutzer'}`
      : item.sender_name || 'Benutzer';
    
    // Bestimme die Chat-Partner-ID (für die Navigation)
    const chatPartnerId = isFromCurrentUser ? item.receiver_id : item.sender_id;
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.is_read && !isFromCurrentUser && styles.unreadItem // Nur als ungelesen markieren, wenn es eine empfangene Nachricht ist
        ]}
        onPress={() => router.push(`/chat/${chatPartnerId}` as any)}
      >
        <View style={styles.notificationIcon}>
          <IconSymbol name={iconName} size={24} color="#7D5A50" />
        </View>
        <View style={styles.notificationContent}>
          <ThemedText style={styles.senderName}>{displayName}</ThemedText>
          <ThemedText style={styles.messagePreview} numberOfLines={2}>
            {isFromCurrentUser ? `Du: ${item.content}` : item.content}
          </ThemedText>
          <Text style={styles.timeText}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Rendert eine Follower-Benachrichtigung mit mehr Details
  const renderFollowerNotification = ({ item }: { item: Notification & { sender_name?: string } }) => {
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.is_read && styles.unreadItem,
          styles.followerItem
        ]}
        onPress={() => {
          console.log('Navigating to profile from follower component:', item.reference_id);
          router.push(`/profile/${item.reference_id}` as any);
        }}
      >
        <View style={styles.notificationIcon}>
          <IconSymbol name="person.badge.plus" size={24} color="#9775FA" />
        </View>
        <View style={styles.notificationContent}>
          <ThemedText style={styles.followTitle}>Neuer Follower!</ThemedText>
          <ThemedText style={styles.senderName}>{item.sender_name || 'Benutzer'}</ThemedText>
          <ThemedText style={styles.notificationText}>folgt dir jetzt</ThemedText>
          
          <TouchableOpacity
            style={[styles.profileButton, { backgroundColor: theme.accent }]}
            onPress={() => {
              console.log('Navigating to profile from button click:', item.reference_id);
              router.push(`/profile/${item.reference_id}` as any);
            }}
          >
            <IconSymbol name="person.circle" size={16} color="#FFFFFF" />
            <Text style={styles.profileButtonText}>Zum Profil von {item.sender_name}</Text>
          </TouchableOpacity>
          
          <Text style={styles.timeText}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Rendert ein einzelnes Benachrichtigungsitem
  const renderNotification = ({ item }: { item: Notification & { sender_name?: string } }) => {
    // Benachrichtigungstext bestimmen
    let notificationText = '';
    switch (item.type) {
      case 'like_post':
        notificationText = 'hat deinen Beitrag geliked';
        break;
      case 'like_comment':
      case 'like_nested_comment':
        notificationText = 'hat deinen Kommentar geliked';
        break;
      case 'comment':
        notificationText = 'hat auf deinen Beitrag geantwortet';
        break;
      case 'reply':
        notificationText = 'hat auf deinen Kommentar geantwortet';
        break;
      case 'follow':
        notificationText = 'folgt dir jetzt';
        break;
      case 'message':
        notificationText = 'hat dir eine Nachricht gesendet';
        break;
    }
    
    // Icon basierend auf Benachrichtigungstyp bestimmen
    let iconName: any = 'bell';
    let iconColor = '#FFA94D';
    
    switch (item.type) {
      case 'like_post':
      case 'like_comment':
      case 'like_nested_comment':
        iconName = 'heart';
        iconColor = '#FF6B6B';
        break;
      case 'comment':
      case 'reply':
        iconName = 'bubble.left';
        iconColor = '#4DABF7';
        break;
      case 'follow':
        iconName = 'person.badge.plus';
        iconColor = '#9775FA';
        break;
      case 'message':
        iconName = 'envelope';
        iconColor = '#7D5A50';
        break;
    }
    
    // Für spezielle Benachrichtigungen, zusätzliche Behandlung
    const handlePress = () => {
      if (item.type === 'follow') {
        console.log('Navigating to profile from notification click:', item.reference_id);
        router.push(`/profile/${item.reference_id}` as any);
      } else if (item.type === 'message') {
        console.log('Navigating to chat from notification click:', item.reference_id);
        router.push(`/chat/${item.reference_id}` as any);
      } else {
        handleNotificationPress(item);
      }
    };
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.is_read && styles.unreadItem,
          item.type === 'follow' && styles.followItem
        ]}
        onPress={handlePress}
      >
        <View style={styles.notificationIcon}>
          <IconSymbol name={iconName} size={24} color={iconColor} />
        </View>
        <View style={styles.notificationContent}>
          <TouchableOpacity
            onPress={() => {
              if (item.type === 'follow') {
                console.log('Navigating to profile from name click:', item.reference_id);
                router.push(`/profile/${item.reference_id}` as any);
              }
            }}
          >
            <ThemedText style={styles.senderName}>{item.sender_name || 'Benutzer'}</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.notificationText}>{notificationText}</ThemedText>
          {item.content && (
            <ThemedText style={styles.contentPreview}>{item.content}</ThemedText>
          )}
          {item.type === 'follow' && (
            <TouchableOpacity
              style={[styles.profileButton, { backgroundColor: theme.accent }]}
              onPress={() => {
                console.log('Navigating to profile from button click:', item.reference_id);
                router.push(`/profile/${item.reference_id}` as any);
              }}
            >
              <IconSymbol name="person.circle" size={16} color="#FFFFFF" />
              <Text style={styles.profileButtonText}>Zum Profil von {item.sender_name}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.timeText}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Wenn wir auf dem Followers-Tab sind und keine Daten haben, zeigen wir einen Button zum Synchronisieren
  const EmptyFollowersView = () => {
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    
    const handleSyncFollowers = async () => {
      try {
        setSyncing(true);
        setSyncResult(null);
        console.log("Syncing missing follow notifications");
        
        const { success, data, error } = await createMissingFollowNotifications();
        
        if (success && data) {
          console.log("Successfully synced followers:", data);
          setSyncResult(`${data.created} neue Benachrichtigungen erstellt.`);
          // Neu laden nach erfolgreicher Synchronisierung
          if (data.created > 0) {
            setTimeout(() => {
              loadData();
            }, 1000);
          }
        } else {
          console.error("Error syncing followers:", error);
          setSyncResult(`Fehler: ${error}`);
        }
      } catch (e) {
        console.error("Exception during sync:", e);
        setSyncResult(`Fehler: ${e}`);
      } finally {
        setSyncing(false);
      }
    };
    
    return (
      <View style={styles.emptyContainer}>
        <IconSymbol name="person.badge.plus" size={40} color={theme.tabIconDefault} />
        <ThemedText style={styles.emptyText}>
          Keine Follower gefunden
        </ThemedText>
        <ThemedText style={styles.emptySubtext}>
          Du hast noch keine neuen Follower oder die Benachrichtigungen wurden nicht korrekt erstellt.
        </ThemedText>
        
        <TouchableOpacity
          style={[styles.syncButton, { backgroundColor: theme.accent }, syncing && styles.disabledButton]}
          onPress={handleSyncFollowers}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.syncButtonText}>
              Follower synchronisieren
            </ThemedText>
          )}
        </TouchableOpacity>
        
        {syncResult && (
          <ThemedText style={styles.syncResultText}>
            {syncResult}
          </ThemedText>
        )}
      </View>
    );
  };
  
  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen 
          options={{
            headerShown: false
          }}
        />
        
        <Header title="Benachrichtigungen" subtitle="Nachrichten und Aktivitäten" />
        
        {/* Tab-Leiste */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === TABS.MESSAGES && styles.activeTab
            ]}
            onPress={() => setActiveTab(TABS.MESSAGES)}
          >
            <ThemedText
              style={[
                styles.tabText,
                activeTab === TABS.MESSAGES && styles.activeTabText
              ]}
            >
              Nachrichten
            </ThemedText>
            {activeTab === TABS.MESSAGES && (
              <View style={styles.activeTabIndicator} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === TABS.ACTIVITY && styles.activeTab
            ]}
            onPress={() => setActiveTab(TABS.ACTIVITY)}
          >
            <ThemedText
              style={[
                styles.tabText,
                activeTab === TABS.ACTIVITY && styles.activeTabText
              ]}
            >
              Aktivität
            </ThemedText>
            {activeTab === TABS.ACTIVITY && (
              <View style={styles.activeTabIndicator} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === TABS.COMMENTS && styles.activeTab
            ]}
            onPress={() => setActiveTab(TABS.COMMENTS)}
          >
            <ThemedText
              style={[
                styles.tabText,
                activeTab === TABS.COMMENTS && styles.activeTabText
              ]}
            >
              Kommentare
            </ThemedText>
            {activeTab === TABS.COMMENTS && (
              <View style={styles.activeTabIndicator} />
            )}
          </TouchableOpacity>
        </View>
        
        {/* Inhalt basierend auf aktivem Tab */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Wird geladen...</ThemedText>
          </View>
        ) : (
          <FlatList
            // @ts-ignore: Typing issue with the FlatList data
            data={activeTab === TABS.MESSAGES ? getFilteredMessages() : getFilteredNotifications()}
            // @ts-ignore: Typing issue with the renderItem function
            renderItem={({ item }) => {
              console.log("Rendering item type:", 'type' in item ? item.type : 'direct_message');
              
              // Wenn wir im Messages-Tab sind
              if (activeTab === TABS.MESSAGES) {
                // Wenn es eine Follow-Benachrichtigung ist
                if ('type' in item && item.type === 'follow') {
                  console.log("Rendering follow notification:", item.id);
                  return renderFollowerNotification({ item: item as Notification & { sender_name?: string } });
                }
                // Wenn es eine Message-Benachrichtigung ist
                else if ('type' in item && item.type === 'message') {
                  console.log("Rendering message notification:", item.id);
                  return renderNotification({ item: item as Notification & { sender_name?: string } });
                }
                // Wenn es eine direkte Nachricht ist
                else if ('receiver_id' in item) {
                  return renderMessage({ item: item as DirectMessage });
                }
                // Fallback für unbekannte Typen
                return null;
              } 
              // In anderen Tabs (Activity, Comments)
              else {
                return renderNotification({ item: item as Notification & { sender_name?: string } });
              }
            }}
            keyExtractor={item => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.accent]}
                tintColor={theme.accent}
              />
            }
            ListEmptyComponent={
              activeTab === TABS.MESSAGES ? (
                <View style={styles.emptyContainer}>
                  <IconSymbol
                    name="envelope"
                    size={48}
                    color={theme.tabIconDefault}
                  />
                  <ThemedText style={styles.emptyText}>
                    Keine Nachrichten
                  </ThemedText>
                  <ThemedText style={styles.emptySubtext}>
                    Du hast noch keine Nachrichten von gefolgten Benutzern
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <IconSymbol
                    name={activeTab === TABS.ACTIVITY ? 'bell' : 'bubble.right'}
                    size={48}
                    color={theme.tabIconDefault}
                  />
                  <ThemedText style={styles.emptyText}>
                    {activeTab === TABS.ACTIVITY
                      ? 'Keine Aktivitäten'
                      : 'Keine Kommentare'}
                  </ThemedText>
                  <ThemedText style={styles.emptySubtext}>
                    {activeTab === TABS.ACTIVITY
                      ? 'Wenn jemand deine Beiträge mag, erscheint es hier'
                      : 'Wenn jemand auf deine Beiträge antwortet, erscheint es hier'}
                  </ThemedText>
                </View>
              )
            }
          />
        )}
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    // Styling für aktiven Tab
  },
  tabText: {
    fontSize: 14,
    color: '#999999',
  },
  activeTabText: {
    color: '#7D5A50',
    fontWeight: 'bold',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#7D5A50',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999999',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  unreadItem: {
    backgroundColor: '#F8F9FA',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notificationContent: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 14,
    marginBottom: 4,
  },
  messagePreview: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 4,
  },
  contentPreview: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 12,
    color: '#999999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  profileButton: {
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  followItem: {
    backgroundColor: useColorScheme() === 'dark' ? '#333333' : '#F0F0F0',
    borderLeftWidth: 4,
    borderLeftColor: '#9775FA',
  },
  followerItem: {
    backgroundColor: useColorScheme() === 'dark' ? '#333333' : '#F0F0F0',
    borderLeftWidth: 4,
    borderLeftColor: '#9775FA',
  },
  followTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#9775FA'
  },
  syncButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#9775FA',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  syncResultText: {
    marginTop: 16,
    fontSize: 14,
    color: '#FFFFFF',
  },
}); 