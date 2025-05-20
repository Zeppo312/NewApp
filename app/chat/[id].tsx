import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, Platform, ActivityIndicator, Keyboard, Dimensions, KeyboardAvoidingView, InputAccessoryView } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import { createNotification } from '@/lib/community';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

// Nachrichtentyp-Definition
interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

// Chat-Screen für einen einzelnen Chat
export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const userId = Array.isArray(id) ? id[0] : id;
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUserName, setOtherUserName] = useState('Benutzer');
  const [sending, setSending] = useState(false);
  
  // Für die InputAccessoryView auf iOS
  const inputAccessoryViewID = "uniqueID";
  
  // Ref für die ScrollView, um zum Ende zu scrollen
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);
  
  // Lade die Chatnachrichten
  useEffect(() => {
    if (!user || !userId) return;
    
    async function loadMessages() {
      try {
        setLoading(true);
        // Nachrichten zwischen den beiden Benutzern abrufen
        const { data, error } = await supabase
          .from('direct_messages')
          .select('*')
          .or(`sender_id.eq.${user?.id || ''},receiver_id.eq.${user?.id || ''}`)
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(50);
          
        if (error) throw error;
        
        // Nachrichten umkehren, damit die neuesten unten sind
        setMessages(data?.reverse() || []);
        
        // Markiere alle empfangenen Nachrichten als gelesen
        if (data && data.length > 0 && user) {
          const unreadMessages = data.filter(msg => 
            msg.receiver_id === user.id && !msg.is_read
          );
          
          if (unreadMessages.length > 0) {
            await supabase
              .from('direct_messages')
              .update({ is_read: true })
              .in('id', unreadMessages.map(msg => msg.id));
          }
        }
        
        // Benutzerinformationen abrufen
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .single();
          
        if (profileData) {
          const name = [profileData.first_name, profileData.last_name]
            .filter(Boolean)
            .join(' ');
          setOtherUserName(name || 'Benutzer');
        }
      } catch (error) {
        console.error('Fehler beim Laden der Nachrichten:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadMessages();
    
    // Echtzeit-Updates für neue Nachrichten
    const subscription = supabase
      .channel('direct_messages_channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${user.id}`
      }, payload => {
        // Neue Nachricht zur Liste hinzufügen
        const newMsg = payload.new as Message;
        if (newMsg.sender_id === userId || newMsg.receiver_id === userId) {
          setMessages(prev => [...prev, newMsg]);
          
          // Als gelesen markieren
          supabase
            .from('direct_messages')
            .update({ is_read: true })
            .eq('id', newMsg.id);
        }
      })
      .subscribe();
      
    // Cleanup bei Component-Unmount
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, userId]);
  
  // Sende eine neue Nachricht
  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !userId) return;
    
    try {
      setSending(true);
      
      // Benachrichtigung vorbereiten - Benutzernamen abrufen
      let senderName = 'Ein Benutzer';
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
          senderName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
          if (!senderName) senderName = 'Ein Benutzer';
        }
      } catch (profileError) {
        console.error('Fehler beim Abrufen des Profils:', profileError);
      }
      
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          content: newMessage.trim(),
          created_at: new Date().toISOString(),
          is_read: false
        })
        .select();
        
      if (error) throw error;
      
      // Nachrichtenfeld leeren
      setNewMessage('');
      
      // Lokale Nachrichtenliste aktualisieren
      if (data && data.length > 0) {
        setMessages(prev => [...prev, data[0] as Message]);
      }
      
      // Benachrichtigung für den Empfänger erstellen
      try {
        // Benachrichtigung erstellen
        await createNotification(
          userId,               // Empfänger-ID
          'message',            // Benachrichtigungstyp
          user.id,              // Referenz-ID (Absender-ID)
          `${senderName} hat dir eine Nachricht gesendet` // Benachrichtigungstext
        );
        
        console.log('Benachrichtigung für neue Nachricht erstellt');
      } catch (notificationError) {
        console.error('Fehler beim Erstellen der Nachrichtenbenachrichtigung:', notificationError);
      }
      
      // Kurze Verzögerung und dann Chat aktualisieren
      setTimeout(async () => {
        try {
          if (!user || !userId) return;
          
          // Nachrichten erneut laden
          const { data: refreshedData, error: refreshError } = await supabase
            .from('direct_messages')
            .select('*')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: true })
            .limit(50);
            
          if (refreshError) throw refreshError;
          setMessages(refreshedData || []);
          
        } catch (refreshError) {
          console.error('Fehler beim Aktualisieren der Nachrichten:', refreshError);
        }
      }, 500); // 0.5 Sekunden verzögern
      
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
    } finally {
      setSending(false);
    }
  };
  
  // Formatiere das Datum für die Anzeige
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Render-Funktion für Nachrichtenelemente
  const renderMessageItem = ({ item }: { item: Message }) => {
    // Safe check for user
    const isMyMessage = user ? item.sender_id === user.id : false;
    
    return (
      <View style={[
        styles.messageWrapper,
        isMyMessage ? styles.myMessageWrapper : styles.otherMessageWrapper
      ]}>
        <ThemedView
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessage : styles.otherMessage
          ]}
          lightColor={isMyMessage ? theme.accent : '#F0F0F0'}
          darkColor={isMyMessage ? theme.accent : '#2A2A2A'}
        >
          <ThemedText 
            style={[
              styles.messageText,
              isMyMessage && { color: '#FFFFFF' }
            ]}
          >
            {item.content}
          </ThemedText>
          <Text style={[
            styles.timeText,
            isMyMessage ? styles.myTimeText : styles.otherTimeText
          ]}>
            {formatTime(item.created_at)}
          </Text>
        </ThemedView>
      </View>
    );
  };
  
  return (
    <ThemedBackground style={styles.backgroundContainer}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />
          
          <Header 
            title="Chat" 
            subtitle={otherUserName}
            onBackPress={() => router.back()}
          />
          
          <View style={styles.chatContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
                <ThemedText style={styles.loadingText}>Nachrichten werden geladen...</ThemedText>
              </View>
            ) : (
              <KeyboardAwareScrollView
                ref={scrollViewRef}
                style={styles.keyboardAwareScrollView}
                contentContainerStyle={styles.scrollViewContent}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                enableAutomaticScroll={Platform.OS === 'android'}
                extraScrollHeight={Platform.OS === 'android' ? 80 : 0}
                keyboardOpeningTime={0}
                onContentSizeChange={() => {
                  // Scroll zum Ende der Nachrichten
                  scrollViewRef.current?.scrollToEnd();
                }}
              >
                {messages.map(item => renderMessageItem({ item }))}
              </KeyboardAwareScrollView>
            )}
          </View>
          
          {/* Input-Container für Android im KeyboardAvoidingView */}
          {Platform.OS === 'android' && (
            <View style={styles.inputContainerWrapper}>
              <ThemedView style={styles.inputContainer} lightColor="#F5F5F5" darkColor="#1E1E1E">
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Nachricht schreiben..."
                  placeholderTextColor="#999"
                  value={newMessage}
                  onChangeText={setNewMessage}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: theme.accent }]}
                  onPress={sendMessage}
                  disabled={sending || !newMessage.trim()}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </ThemedView>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
      
      {/* Input-Container als InputAccessoryView für iOS */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={inputAccessoryViewID}>
          <View style={styles.iosInputContainerWrapper}>
            <ThemedView style={styles.inputContainer} lightColor="#F5F5F5" darkColor="#1E1E1E">
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Nachricht schreiben..."
                placeholderTextColor="#999"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                inputAccessoryViewID={inputAccessoryViewID}
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.accent }]}
                onPress={sendMessage}
                disabled={sending || !newMessage.trim()}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </ThemedView>
          </View>
        </InputAccessoryView>
      )}
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    height: '100%',
  },
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    position: 'relative',
  },
  keyboardAwareScrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'android' ? 80 : 20, // Extra Platz für das Eingabefeld auf Android
  },
  inputContainerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#E9E0D1',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
    zIndex: 999,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  messageWrapper: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
  },
  otherMessageWrapper: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  myMessage: {
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimeText: {
    color: 'rgba(100, 100, 100, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  iosInputContainerWrapper: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#E9E0D1',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
}); 