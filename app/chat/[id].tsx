import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Platform, 
  ActivityIndicator, 
  Keyboard, 
  KeyboardAvoidingView,
  InputAccessoryView,
  LayoutChangeEvent,
  SafeAreaView as RNSafeAreaView
} from 'react-native';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Annahmen für die Höhenberechnung des Eingabefelds
const INPUT_APPROX_LINE_HEIGHT = 24; // Geschätzte Zeilenhöhe bei fontSize 16
const INPUT_VERTICAL_PADDING = 20;   // Zusätzliches vertikales Padding

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
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolbarHeight, setToolbarHeight] = useState(60); // Standardhöhe für die Toolbar
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUserName, setOtherUserName] = useState('Benutzer');
  const [sending, setSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const maxInputLines = 3; // Maximale Anzahl von Zeilen im Textfeld
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  
  // Toolbar-Höhe messen
  const handleToolbarLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setToolbarHeight(height);
  };
  
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
  
  // Zum Ende der Liste scrollen, wenn neue Nachrichten kommen und Tastatur-Status überwachen
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [messages]);
  
  // Berechne die maximale Höhe basierend auf maxInputLines Zeilen
  const calculateMaxInputHeight = () => {
    return INPUT_APPROX_LINE_HEIGHT * maxInputLines + INPUT_VERTICAL_PADDING;
  };
  
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
        
        // Zum Ende scrollen
        setTimeout(() => {
          flatListRef.current?.scrollToEnd();
        }, 100);
      }
      
      // Benachrichtigung für den Empfänger erstellen
      try {
        await createNotification(
          userId,               // Empfänger-ID
          'message',            // Benachrichtigungstyp
          user.id,              // Referenz-ID (Absender-ID)
          `${senderName} hat dir eine Nachricht gesendet` // Benachrichtigungstext
        );
      } catch (notificationError) {
        console.error('Fehler beim Erstellen der Nachrichtenbenachrichtigung:', notificationError);
      }
      
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
  
  // Render-Funktion für die Toolbar
  const renderToolbar = () => (
    <View 
      style={[
        styles.inputContainerWrapper,
        { backgroundColor: theme.background },
        Platform.OS === 'ios' && { paddingBottom: insets.bottom },
        keyboardVisible && styles.inputContainerWrapperKeyboardVisible
      ]}
      onLayout={handleToolbarLayout}
    >
      <TextInput
        style={[
          styles.input,
          { 
            color: theme.text,
            height: Math.min(calculateMaxInputHeight(), Math.max(40, inputHeight))
          }
        ]}
        placeholder="Nachricht schreiben..."
        placeholderTextColor="#999"
        value={newMessage}
        onChangeText={setNewMessage}
        multiline
        onContentSizeChange={(e) => {
          const height = e.nativeEvent.contentSize.height;
          setInputHeight(height);
        }}
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
    </View>
  );

  return (
    <ThemedBackground style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.mainContainer}>
          <Header 
            title={otherUserName}
            onBackPress={() => router.back()}
          />
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={styles.loadingText}>
                Nachrichten werden geladen...
              </ThemedText>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={item => item.id}
              style={styles.messagesList}
              contentContainerStyle={[
                styles.messagesContainer,
                { paddingBottom: toolbarHeight + insets.bottom }
              ]}
              onContentSizeChange={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onLayout={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
            />
          )}
          
          {/* Plattformspezifisches Rendering */}
          {Platform.OS === 'ios' ? (
            <View style={[
              styles.toolbarContainer,
              keyboardVisible && styles.toolbarContainerKeyboardVisible
            ]}>
              {renderToolbar()}
            </View>
          ) : (
            <View style={[
              styles.androidToolbarContainer,
              keyboardVisible && styles.androidToolbarContainerKeyboardVisible
            ]}>
              {renderToolbar()}
            </View>
          )}
        </View>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mainContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  messagesContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  messagesList: {
    flex: 1,
    paddingBottom: 16,
  },
  inputContainerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F2F2F2',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 8,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  androidToolbarContainer: {
    backgroundColor: '#F2F2F2',
    paddingBottom: 4,
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
  toolbarContainer: {
    backgroundColor: '#F2F2F2',
    paddingBottom: 4,
  },
  inputContainerWrapperKeyboardVisible: {
    paddingBottom: 4,
  },
  toolbarContainerKeyboardVisible: {
    paddingBottom: 2,
  },
  androidToolbarContainerKeyboardVisible: {
    paddingBottom: 2,
  },
}); 