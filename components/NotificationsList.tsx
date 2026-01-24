import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator, Text, TextInput, Keyboard, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, createComment, createReply } from '@/lib/community';
import { useRouter } from 'expo-router';
import { followUser, unfollowUser, isFollowingUser } from '@/lib/follows';
import { FollowButton } from '@/components/FollowButton';

interface NotificationItem {
  id: string;
  type: 'like_post' | 'like_comment' | 'comment' | 'reply' | 'like_nested_comment' | 'follow' | 'message';
  content: string;
  reference_id: string;
  created_at: string;
  is_read: boolean;
  sender_name?: string;
  sender_id?: string;
}

export const NotificationsList = ({ onNotificationUpdate }: { onNotificationUpdate?: () => void }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [isAnonymousReply, setIsAnonymousReply] = useState<boolean>(false);
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const previousNotificationCount = useRef<number>(0);
  
  const timerRef = useRef<number | null>(null);
  const replyInputRef = useRef<TextInput>(null);

  // Benachrichtigungen im Hintergrund laden ohne Spinner zu zeigen
  const silentlyLoadNotifications = useCallback(async () => {
    try {
      const { data, error } = await getNotifications();
      if (error) throw error;
      
      // Prüfen, ob neue Benachrichtigungen hinzugekommen sind
      const newNotifications = data || [];
      const unreadCount = newNotifications.filter(n => !n.is_read).length;
      
      // Aktualisieren wir nur, wenn sich die Anzahl geändert hat oder
      // wenn vorher keine Benachrichtigungen da waren und jetzt welche da sind
      if (unreadCount !== previousNotificationCount.current || 
          (notifications.length === 0 && newNotifications.length > 0)) {
        setNotifications(newNotifications);
        previousNotificationCount.current = unreadCount;
        
        // Badge-Zähler aktualisieren
        if (onNotificationUpdate) {
          onNotificationUpdate();
        }
      }
    } catch (error) {
      console.error('Error silently loading notifications:', error);
    }
  }, [notifications.length, onNotificationUpdate]);

  // Initiales Laden mit Spinner
  const initialLoadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await getNotifications();
      if (error) throw error;
      setNotifications(data || []);
      previousNotificationCount.current = (data || []).filter(n => !n.is_read).length;
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Initiales Laden mit Ladeindikator
    initialLoadNotifications();
    
    // Regelmäßige Aktualisierung im Hintergrund alle 5 Sekunden
    timerRef.current = setInterval(silentlyLoadNotifications, 5000) as unknown as number;
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [silentlyLoadNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    initialLoadNotifications();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      // Update lokale Liste
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true } 
            : notification
        )
      );
      
      // Benachrichtige die übergeordnete Komponente für Badge-Aktualisierung
      if (onNotificationUpdate) {
        onNotificationUpdate();
      }
      
      // Aktualisiere den Zähler
      const updatedUnreadCount = notifications.filter(n => 
        n.id !== notificationId && !n.is_read
      ).length;
      previousNotificationCount.current = updatedUnreadCount;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      // Update lokale Liste
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => ({ ...notification, is_read: true }))
      );
      
      // Benachrichtige die übergeordnete Komponente für Badge-Aktualisierung
      if (onNotificationUpdate) {
        onNotificationUpdate();
      }
      
      // Aktualisiere den Zähler
      previousNotificationCount.current = 0;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `vor ${diffInMinutes} ${diffInMinutes === 1 ? 'Minute' : 'Minuten'}`;
    } else if (diffInHours < 24) {
      return `vor ${diffInHours} ${diffInHours === 1 ? 'Stunde' : 'Stunden'}`;
    } else if (diffInDays === 0) {
      return 'Heute';
    } else if (diffInDays === 1) {
      return 'Gestern';
    } else if (diffInDays < 7) {
      return `Vor ${diffInDays} Tagen`;
    } else {
      return date.toLocaleDateString('de-DE');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like_post':
      case 'like_comment':
      case 'like_nested_comment':
        return { name: 'heart.fill' as const, color: '#FF6B6B' };
      case 'comment':
        return { name: 'bubble.left.fill' as const, color: '#4DABF7' };
      case 'reply':
        return { name: 'arrowshape.turn.up.left.fill' as const, color: '#37B24D' };
      case 'follow':
        return { name: 'person.badge.plus.fill' as const, color: '#9775FA' };
      case 'message':
        return { name: 'envelope.fill' as const, color: '#74C0FC' };
      default:
        return { name: 'bell.fill' as const, color: '#FFA94D' };
    }
  };

  const getNotificationText = (notification: NotificationItem) => {
    const senderName = notification.sender_name || 'Jemand';
    
    switch (notification.type) {
      case 'like_post':
        return `${senderName} hat deinen Beitrag geliked`;
      case 'like_comment':
        return `${senderName} hat deinen Kommentar geliked`;
      case 'like_nested_comment':
        return `${senderName} hat deine Antwort geliked`;
      case 'comment':
        return `${senderName} hat auf deinen Beitrag geantwortet`;
      case 'reply':
        return `${senderName} hat auf deinen Kommentar geantwortet`;
      case 'follow':
        return `${senderName} folgt dir jetzt`;
      case 'message':
        return `${senderName} hat dir eine Nachricht gesendet`;
      default:
        return `${senderName} hat mit dir interagiert`;
    }
  };

  const handleNotificationPress = (notification: NotificationItem) => {
    // Markiere als gelesen
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    
    // Zu der entsprechenden Ansicht navigieren
    try {
      console.log(`NotificationsList: Navigating to ${notification.type}, ref=${notification.reference_id}`);
      
      if (notification.type === 'follow') {
        // Bei Follow-Benachrichtigungen direkt und sofort zum Profil navigieren
        console.log(`Directly navigating to profile: ${notification.reference_id}`);
        router.push(`/profile/${notification.reference_id}` as any);
      }
      else if (notification.type.includes('like') || notification.type.includes('comment')) {
        // Für Community-Benachrichtigungen - navigiere zum Post
        router.push({
          pathname: "/community",
          params: { post: notification.reference_id }
        } as any);
      } else if (notification.type === 'message') {
        // Direktnachricht -> Profil des Absenders anzeigen
        router.push(`/profile/${notification.sender_id}` as any);
      }
    } catch (error) {
      console.error('Navigationsfehler:', error);
    }
  };
  
  const handleReplyPress = (notification: NotificationItem) => {
    setReplyingTo(notification.id);
    setReplyText('');
    
    // Fokus auf das Eingabefeld setzen, aber mit einer kleinen Verzögerung,
    // damit es zuerst gerendert wird
    setTimeout(() => {
      if (replyInputRef.current) {
        replyInputRef.current.focus();
      }
    }, 100);
  };
  
  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
    setIsAnonymousReply(false);
    Keyboard.dismiss();
  };
  
  const handleSendReply = async (notification: NotificationItem) => {
    if (!replyText.trim()) return;
    
    try {
      setSendingReply(true);
      console.log(`Sending reply to notification type: ${notification.type}, reference_id: ${notification.reference_id}`);
      
      // Je nach Typ der Benachrichtigung die richtige Antwortfunktion aufrufen
      if (notification.type === 'comment') {
        // Bei 'comment' ist die reference_id die Post-ID, also muss ein normaler Kommentar erstellt werden
        const { error } = await createComment(notification.reference_id, replyText, isAnonymousReply);
        if (error) throw error;
        console.log('Comment created successfully');
      } else if (notification.type === 'like_post') {
        // Bei like_post ist die reference_id die Post-ID
        const { error } = await createComment(notification.reference_id, replyText, isAnonymousReply);
        if (error) throw error;
      } else {
        // Bei anderen Typen (reply, like_comment) ist die reference_id eine Kommentar-ID
        const { error } = await createReply(notification.reference_id, replyText, isAnonymousReply);
        if (error) throw error;
        console.log('Reply created successfully');
      }
      
      // Zurücksetzen des Formulars
      setReplyingTo(null);
      setReplyText('');
      setIsAnonymousReply(false);
      
      // Benachrichtigung als gelesen markieren
      handleMarkAsRead(notification.id);
      
      // Bestätigung für den Benutzer 
      Alert.alert('Erfolg', 'Deine Antwort wurde erfolgreich gesendet.');
    } catch (error) {
      console.error('Error sending reply:', error);
      Alert.alert('Fehler', 'Beim Senden der Antwort ist ein Fehler aufgetreten.');
    } finally {
      setSendingReply(false);
    }
  };

  const renderNotificationItem = ({ item }: { item: NotificationItem }) => {
    const icon = getNotificationIcon(item.type);
    const isReplying = replyingTo === item.id;
    const canReply = item.type === 'comment' || item.type === 'reply' || item.type === 'like_comment';
    
    return (
      <ThemedView 
        style={[
          styles.notificationItem,
          !item.is_read && { backgroundColor: colorScheme === 'dark' ? '#2C3E50' : '#F8F9FA' }
        ]}
        lightColor={item.is_read ? '#FFFFFF' : '#F8F9FA'}
        darkColor={item.is_read ? '#1A2530' : '#2C3E50'}
      >
        <TouchableOpacity 
          onPress={() => handleNotificationPress(item)}
          style={styles.notificationHeader}
        >
          <View style={styles.notificationIconContainer}>
            <IconSymbol 
              name={icon.name}
              size={20} 
              color={icon.color} 
            />
          </View>
          
          <View style={styles.notificationContent}>
            <ThemedText style={styles.notificationText}>
              {getNotificationText(item)}
            </ThemedText>
            
            {item.content && (
              <ThemedText style={styles.notificationDetail}>
                {item.content}
              </ThemedText>
            )}
            
            {item.type === 'follow' && (
              <TouchableOpacity
                style={[styles.profileLink, { backgroundColor: theme.accent }]}
                onPress={() => router.push(`/profile/${item.reference_id}` as any)}
              >
                <IconSymbol name="person.circle" size={12} color="#FFFFFF" />
                <Text style={styles.profileLinkText}>Zum Profil</Text>
              </TouchableOpacity>
            )}
            
            <ThemedText style={styles.notificationDate}>
              {formatDate(item.created_at)}
            </ThemedText>
          </View>
          
          {!item.is_read && (
            <View style={[styles.unreadIndicator, { backgroundColor: theme.accent }]} />
          )}
        </TouchableOpacity>
        
        {/* Antworten-Button, nur für bestimmte Benachrichtigungstypen */}
        {canReply && (
          <View style={styles.replyButtonContainer}>
            {isReplying ? (
              <View style={styles.replyInputContainer}>
                <TextInput
                  ref={replyInputRef}
                  style={[
                    styles.replyInput,
                    {
                      color: theme.text,
                      backgroundColor: colorScheme === 'dark' ? '#2A3A4A' : '#F0F0F0'
                    }
                  ]}
                  placeholder="Schreibe eine Antwort..."
                  placeholderTextColor={theme.tabIconDefault}
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                />
                
                <View style={styles.replyControls}>
                  <TouchableOpacity
                    style={styles.anonymousOption}
                    onPress={() => setIsAnonymousReply(!isAnonymousReply)}
                  >
                    <View style={[
                      styles.checkbox,
                      isAnonymousReply && styles.checkboxChecked,
                      !isAnonymousReply && { backgroundColor: colorScheme === 'dark' ? '#2A3A4A' : '#F0F0F0' }
                    ]}>
                      {isAnonymousReply && <IconSymbol name="checkmark" size={10} color="#FFFFFF" />}
                    </View>
                    <ThemedText style={styles.checkboxLabel}>Anonym</ThemedText>
                  </TouchableOpacity>
                  
                  <View style={styles.replyActions}>
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={handleCancelReply}
                    >
                      <ThemedText style={styles.cancelButtonText}>Abbrechen</ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.sendButton, 
                        { backgroundColor: theme.accent },
                        (!replyText.trim() || sendingReply) && styles.disabledButton
                      ]}
                      onPress={() => handleSendReply(item)}
                      disabled={!replyText.trim() || sendingReply}
                    >
                      {sendingReply ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ThemedText style={styles.sendButtonText}>Antworten</ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.replyButton, { borderColor: theme.accent }]}
                onPress={() => handleReplyPress(item)}
              >
                <IconSymbol name="arrowshape.turn.up.left" size={14} color={theme.accent} />
                <ThemedText style={[styles.replyButtonText, { color: theme.accent }]}>
                  Antworten
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Follow-Button für Benutzer hinzufügen */}
        {item.sender_id && (
          <View style={styles.followButtonContainer}>
            <FollowButton 
              userId={item.sender_id} 
              size="small" 
              showText={true}
              style={styles.followButton}
            />
          </View>
        )}
      </ThemedView>
    );
  };

  if (loading && !refreshing) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText style={styles.loadingText}>
          Benachrichtigungen werden geladen...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {notifications.length > 0 ? (
        <>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Benachrichtigungen</ThemedText>
            <View style={styles.headerButtons}>
              {notifications.some(n => !n.is_read) && (
                <TouchableOpacity 
                  style={styles.markAllReadButton}
                  onPress={handleMarkAllAsRead}
                >
                  <ThemedText style={[styles.markAllReadText, { color: theme.accent }]}>
                    Alle lesen
                  </ThemedText>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => router.push('/notifications' as any)}
              >
                <ThemedText style={[styles.viewAllText, { color: theme.accent }]}>
                  Alle ansehen
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        </>
      ) : (
        <ThemedView style={styles.emptyContainer}>
          <IconSymbol name="bell.slash" size={40} color={theme.tabIconDefault} />
          <ThemedText style={styles.emptyText}>
            Keine Benachrichtigungen
          </ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Hier werden Benachrichtigungen zu Likes und Kommentaren angezeigt.
          </ThemedText>
          
          <TouchableOpacity
            style={[styles.allNotificationsButton, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/notifications' as any)}
          >
            <ThemedText style={styles.allNotificationsButtonText}>
              Alle Benachrichtigungen
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllReadButton: {
    padding: 8,
  },
  markAllReadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  viewAllButton: {
    padding: 8,
    marginLeft: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  notificationItem: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  notificationHeader: {
    flexDirection: 'row',
    padding: 12,
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  notificationDetail: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  notificationDate: {
    fontSize: 12,
    color: '#AAA',
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  replyButtonContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    padding: 12,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  replyInputContainer: {
    width: '100%',
  },
  replyInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 80,
    maxHeight: 150,
    textAlignVertical: 'top',
  },
  replyControls: {
    marginTop: 8,
  },
  anonymousOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#E57373',
    borderColor: '#E57373',
  },
  checkboxLabel: {
    fontSize: 12,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: 8,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#888',
  },
  sendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
    color: '#888',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  allNotificationsButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 20,
  },
  allNotificationsButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  followButtonContainer: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  followButton: {
    marginVertical: 4,
  },
  profileLink: {
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileLinkText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
}); 
