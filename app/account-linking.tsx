import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Share, Alert, ImageBackground, SafeAreaView, ActivityIndicator, StatusBar, TextInput } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router } from 'expo-router';
import { createInvitationLink, getUserInvitations, getLinkedUsers } from '@/lib/supabase';
import { redeemInvitationCodeDirect } from '@/lib/redeemInvitationCodeDirect';

export default function AccountLinkingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [linkedUsers, setLinkedUsers] = useState([]);
  const [invitationCode, setInvitationCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Einladungen laden
      const invitationsResult = await getUserInvitations(user.id);
      if (invitationsResult.success) {
        setInvitations(invitationsResult.invitations);
      }

      // Verknüpfte Benutzer laden
      const linkedUsersResult = await getLinkedUsers(user.id);
      if (linkedUsersResult.success) {
        setLinkedUsers(linkedUsersResult.linkedUsers);
      }
    } catch (error) {
      console.error('Error loading account linking data:', error);
      Alert.alert('Fehler', 'Die Daten konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    setIsLoading(true);
    try {
      const result = await createInvitationLink(user.id);
      if (result.success) {
        // Teilen-Dialog öffnen
        await Share.share({
          message: `Verbinde dich mit mir in der Wehen-Tracker App! Verwende diesen Einladungscode: ${result.invitationCode} oder klicke auf diesen Link: ${result.invitationLink}`,
          title: 'Wehen-Tracker App - Einladung'
        });

        // Daten neu laden
        loadData();
      } else {
        Alert.alert('Fehler', 'Der Einladungscode konnte nicht erstellt werden.');
      }
    } catch (error) {
      console.error('Error creating invitation:', error);
      Alert.alert('Fehler', 'Der Einladungscode konnte nicht erstellt werden.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeemInvitation = async () => {
    if (!invitationCode.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Einladungscode ein.');
      return;
    }

    // Bereinigen des Codes (Leerzeichen entfernen und in Großbuchstaben umwandeln)
    const cleanedCode = invitationCode.replace(/\s+/g, '').toUpperCase();
    console.log(`Attempting to redeem invitation code in UI: '${cleanedCode}'`);

    setIsRedeeming(true);
    try {
      if (!user || !user.id) {
        Alert.alert('Fehler', 'Benutzer-ID konnte nicht ermittelt werden. Bitte melden Sie sich erneut an.');
        return;
      }

      // Verwende die direkte RPC-Funktion statt der normalen Funktion
      const result = await redeemInvitationCodeDirect(user.id, cleanedCode);

      if (result.success) {
        Alert.alert(
          'Erfolg',
          'Der Einladungscode wurde erfolgreich eingelöst. Dein Account ist jetzt verknüpft.',
          [{ text: 'OK', onPress: () => {
            setInvitationCode('');
            loadData();
          }}]
        );
      } else {
        console.log('Error redeeming code:', result.error);

        // Spezifische Fehlermeldung anzeigen
        const errorMessage = result.error?.message ||
          'Der Einladungscode konnte nicht eingelöst werden. Bitte versuche es später erneut.';

        Alert.alert(
          'Fehler',
          errorMessage
        );
      }
    } catch (error) {
      console.error('Exception redeeming invitation:', error);
      Alert.alert('Fehler', `Ein unerwarteter Fehler ist aufgetreten: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/Background_Hell.png')}
      style={styles.backgroundImage}
      resizeMode="repeat"
    >
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <IconSymbol name="chevron.left" size={24} color="#E57373" />
            </TouchableOpacity>

            <ThemedText type="title" style={styles.title}>
              Accounts verknüpfen
            </ThemedText>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={theme.accent} />
          ) : (
            <>
              <ThemedView style={styles.section} lightColor={theme.card} darkColor={theme.card}>
                <ThemedText style={styles.sectionTitle}>
                  Einladung erstellen
                </ThemedText>
                <ThemedText style={styles.sectionDescription}>
                  Erstelle einen Einladungscode, um dich mit einem anderen Benutzer zu verbinden. Teile den Code mit deinem Partner, Familienmitglied oder Freund.
                </ThemedText>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreateInvitation}
                >
                  <IconSymbol name="plus" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.createButtonText}>
                    Einladungscode erstellen
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.section} lightColor={theme.card} darkColor={theme.card}>
                <ThemedText style={styles.sectionTitle}>
                  Einladungscode einlösen
                </ThemedText>
                <ThemedText style={styles.sectionDescription}>
                  Hast du einen Einladungscode erhalten? Gib ihn hier ein, um deinen Account mit einem anderen zu verknüpfen.
                </ThemedText>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#362E28' : '#FFFFFF',
                        color: colorScheme === 'dark' ? '#FFF8F0' : '#7D5A50',
                        borderColor: colorScheme === 'dark' ? '#7D6A5A' : '#EFE1CF'
                      }
                    ]}
                    placeholder="Einladungscode eingeben"
                    placeholderTextColor={colorScheme === 'dark' ? '#A68A7B' : '#C8B6A6'}
                    value={invitationCode}
                    onChangeText={(text) => {
                      // Entfernen von Leerzeichen und Umwandlung in Großbuchstaben direkt bei der Eingabe
                      setInvitationCode(text.replace(/\s+/g, '').toUpperCase());
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                  />

                  <TouchableOpacity
                    style={[styles.redeemButton, isRedeeming && styles.disabledButton]}
                    onPress={handleRedeemInvitation}
                    disabled={isRedeeming || !invitationCode.trim()}
                  >
                    {isRedeeming ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                        <ThemedText style={styles.createButtonText}>
                          Einlösen
                        </ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ThemedView>

              {linkedUsers.length > 0 && (
                <ThemedView style={styles.section} lightColor={theme.card} darkColor={theme.card}>
                  <ThemedText style={styles.sectionTitle}>
                    Verknüpfte Accounts
                  </ThemedText>
                  {linkedUsers.map((linkedUser) => (
                    <ThemedView key={linkedUser.linkId} style={styles.userCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
                      <View style={styles.userInfo}>
                        <ThemedText style={styles.userName}>
                          {linkedUser.firstName} {linkedUser.lastName}
                        </ThemedText>
                        <ThemedText style={styles.userRole}>
                          {linkedUser.userRole === 'mama' ? 'Mama' : linkedUser.userRole === 'papa' ? 'Papa' : 'Benutzer'}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}

              {invitations.filter(inv => inv.status === 'pending').length > 0 && (
                <ThemedView style={styles.section} lightColor={theme.card} darkColor={theme.card}>
                  <ThemedText style={styles.sectionTitle}>
                    Ausstehende Einladungen
                  </ThemedText>
                  {invitations
                    .filter(inv => inv.status === 'pending')
                    .map((invitation) => (
                      <ThemedView key={invitation.id} style={styles.invitationCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
                        <View style={styles.invitationInfo}>
                          <ThemedText style={styles.invitationCode}>
                            Code: {invitation.invitation_code}
                          </ThemedText>
                          <ThemedText style={styles.invitationDate}>
                            Erstellt am: {new Date(invitation.created_at).toLocaleDateString()}
                          </ThemedText>
                          <ThemedText style={styles.invitationExpiry}>
                            Gültig bis: {new Date(invitation.expires_at).toLocaleDateString()}
                          </ThemedText>
                        </View>
                        <TouchableOpacity
                          style={styles.shareButton}
                          onPress={() => {
                            Share.share({
                              message: `Verbinde dich mit mir in der Wehen-Tracker App! Verwende diesen Einladungscode: ${invitation.invitation_code} oder klicke auf diesen Link: wehen-tracker://invite?code=${invitation.invitation_code}`,
                              title: 'Wehen-Tracker App - Einladung'
                            });
                          }}
                        >
                          <IconSymbol name="square.and.arrow.up" size={20} color={theme.accent} />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                </ThemedView>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  section: {
    borderRadius: 15,
    marginBottom: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 15,
    opacity: 0.7,
  },
  createButton: {
    backgroundColor: '#E57373',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    opacity: 0.7,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationCode: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  invitationDate: {
    fontSize: 14,
    opacity: 0.7,
  },
  invitationExpiry: {
    fontSize: 14,
    opacity: 0.7,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inputContainer: {
    marginTop: 10,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 10,
  },
  redeemButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.7,
  },
});
