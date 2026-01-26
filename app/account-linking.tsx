import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Share,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useConvex } from '@/contexts/ConvexContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router } from 'expo-router';
import { createInvitationLink, getUserInvitations, getLinkedUsers } from '@/lib/supabase';
import { redeemInvitationCodeFixed } from '@/lib/redeemInvitationCodeFixed';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';

type Invitation = {
  id: string;
  invitationCode: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string | Date;
  expiresAt: string | Date;
};

type LinkedUser = {
  linkId: string;
  firstName: string;
  lastName: string;
  userRole: 'mama' | 'papa' | string;
};

const TIMELINE_INSET = 8;            // wie im Sleep-Tracker
const PRIMARY_TEXT   = '#7D5A50';    // Sleep-Tracker Typo-Farbe
const ACCENT_PURPLE  = '#8E4EC6';    // Sleep-Tracker Akzent

export default function AccountLinkingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { syncUser } = useConvex();

  const [isLoading, setIsLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [invitationCode, setInvitationCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const invitationsResult = await getUserInvitations(user!.id);
      if (invitationsResult.success) setInvitations(invitationsResult.invitations);

      const linkedUsersResult = await getLinkedUsers(user!.id);
      if (linkedUsersResult.success) setLinkedUsers(linkedUsersResult.linkedUsers);
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
      const result = await createInvitationLink(user!.id);
      if (result.success) {
        await Share.share({
          message: `Verbinde dich mit mir in der App! Einladungscode: ${result.invitationCode} • Link: ${result.invitationLink}`,
          title: 'Einladung'
        });
        loadData();
        void syncUser();
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
    const cleanedCode = invitationCode.replace(/\s+/g, '').toUpperCase();

    setIsRedeeming(true);
    try {
      if (!user?.id) {
        Alert.alert('Fehler', 'Bitte erneut anmelden.');
        return;
      }
      const result = await redeemInvitationCodeFixed(user.id, cleanedCode);
      if (result.success) {
        const creatorName = result.creatorInfo?.first_name || 'einem anderen Benutzer';
        Alert.alert('Erfolg', `Code eingelöst. Jetzt verknüpft mit ${creatorName}.`, [
          {
            text: 'OK',
            onPress: () => {
              setInvitationCode('');
              loadData();
              void syncUser();
            }
          }
        ]);
      } else {
        const errorMessage = result.error?.message ||
          'Der Einladungscode konnte nicht eingelöst werden. Bitte versuche es später erneut.';
        Alert.alert('Fehler', errorMessage);
      }
    } catch (error: any) {
      console.error('Exception redeeming invitation:', error);
      Alert.alert('Fehler', `Unerwarteter Fehler: ${error?.message ?? 'Unbekannt'}`);
    } finally {
      setIsRedeeming(false);
    }
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden />
        <Header title="Accounts verknüpfen" showBackButton onBackPress={() => router.back()} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <LiquidGlassCard style={[styles.sectionCard, styles.centerCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={styles.loadingText}>Lade Daten…</ThemedText>
            </LiquidGlassCard>
          ) : (
            <>
              {/* Abschnitt: Einladung erstellen */}
              <LiquidGlassCard style={[styles.sectionCard, { marginHorizontal: TIMELINE_INSET }]} intensity={26} overlayColor={GLASS_OVERLAY}>
                <ThemedText style={styles.sectionTitle}>Einladung erstellen</ThemedText>
                <ThemedText style={styles.sectionDescription}>
                  Erstelle einen Code und teile ihn mit deinem Partner oder einer Vertrauensperson.
                </ThemedText>

                <TouchableOpacity
                  onPress={handleCreateInvitation}
                  activeOpacity={0.9}
                  style={styles.fullWidthAction}
                >
                  <BlurView intensity={24} tint="light" style={styles.cardBlur}>
                    <View style={[styles.actionCard, { backgroundColor: 'rgba(220,200,255,0.6)' }]}>
                      <View style={[styles.actionIcon, { backgroundColor: ACCENT_PURPLE }]}>
                        <IconSymbol name="plus" size={26} color="#FFFFFF" />
                      </View>
                      <ThemedText style={styles.actionTitle}>Einladungscode erstellen</ThemedText>
                      <ThemedText style={styles.actionSub}>Sicher teilen & verbinden</ThemedText>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              </LiquidGlassCard>

              {/* Abschnitt: Einladungscode einlösen */}
              <LiquidGlassCard style={[styles.sectionCard, { marginHorizontal: TIMELINE_INSET }]} intensity={26} overlayColor={GLASS_OVERLAY}>
                <ThemedText style={styles.sectionTitle}>Einladungscode einlösen</ThemedText>
                <ThemedText style={styles.sectionDescription}>
                  Du hast einen Code bekommen? Gib ihn hier ein und verknüpfe euren Account.
                </ThemedText>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputGlass}
                    placeholder="CODE"
                    placeholderTextColor="#9BA0A6"
                    value={invitationCode}
                    onChangeText={(t) => setInvitationCode(t.replace(/\s+/g, '').toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                  />
                </View>

                <TouchableOpacity
                  onPress={handleRedeemInvitation}
                  disabled={isRedeeming || !invitationCode.trim()}
                  activeOpacity={0.9}
                  style={[styles.fullWidthAction, (isRedeeming || !invitationCode.trim()) && { opacity: 0.7 }]}
                >
                  <BlurView intensity={24} tint="light" style={styles.cardBlur}>
                    <View style={[styles.actionCard, { backgroundColor: 'rgba(168,196,193,0.6)' }]}>
                      <View style={[styles.actionIcon, { backgroundColor: '#A8C4C1' }]}>
                        {isRedeeming ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <IconSymbol name="checkmark" size={26} color="#FFFFFF" />
                        )}
                      </View>
                      <ThemedText style={styles.actionTitle}>{isRedeeming ? 'Einlösen…' : 'Code einlösen'}</ThemedText>
                      <ThemedText style={styles.actionSub}>Schnell & sicher</ThemedText>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              </LiquidGlassCard>

              {/* Abschnitt: Verknüpfte Accounts */}
              {linkedUsers.length > 0 && (
                <LiquidGlassCard style={[styles.sectionCard, { marginHorizontal: TIMELINE_INSET }]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <ThemedText style={styles.sectionTitle}>Verknüpfte Accounts</ThemedText>

                  <View style={styles.list}>
                    {linkedUsers.map((u) => (
                      <View key={u.linkId} style={styles.listItem}>
                        <View style={styles.listItemLeft}>
                          <View style={[styles.avatar, { backgroundColor: 'rgba(142,78,198,0.2)' }]}>
                            <IconSymbol name="person.fill" size={18} color={ACCENT_PURPLE} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={styles.userName}>{u.firstName} {u.lastName}</ThemedText>
                            <ThemedText style={styles.userRole}>
                              {u.userRole === 'mama' ? 'Mama' : u.userRole === 'papa' ? 'Papa' : 'Benutzer'}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </LiquidGlassCard>
              )}

              {/* Abschnitt: Ausstehende Einladungen */}
              {invitations && invitations.filter(i => i.status === 'pending').length > 0 && (
                <LiquidGlassCard style={[styles.sectionCard, { marginHorizontal: TIMELINE_INSET }]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <ThemedText style={styles.sectionTitle}>Ausstehende Einladungen</ThemedText>

                  <View style={styles.list}>
                    {invitations
                      .filter(i => i.status === 'pending')
                      .map((inv) => (
                        <View key={inv.id} style={styles.listItem}>
                          <View style={styles.listItemLeft}>
                            <View style={[styles.avatar, { backgroundColor: 'rgba(255,140,66,0.18)' }]}>
                              <IconSymbol name="doc.on.doc" size={18} color="#FF8C42" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={styles.invCode}>Code: {inv.invitationCode}</ThemedText>
                              <ThemedText style={styles.metaText}>Erstellt: {formatDate(inv.createdAt)}</ThemedText>
                              <ThemedText style={styles.metaText}>Gültig bis: {formatDate(inv.expiresAt)}</ThemedText>
                            </View>
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              Share.share({
                                message: `Verbinde dich mit mir! Code: ${inv.invitationCode} • Link: wehen-tracker://invite?code=${inv.invitationCode}`,
                                title: 'Einladung teilen'
                              });
                            }}
                            style={styles.sharePill}
                          >
                            <IconSymbol name="square.and.arrow.up" size={18} color={ACCENT_PURPLE} />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                </LiquidGlassCard>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', backgroundColor: '#f5eee0' }, // wie Sleep-Tracker
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },

  // identischer Scroll-Rhythmus
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 140,
    paddingTop: 10,
  },

  sectionCard: { marginBottom: 16, borderRadius: 22, overflow: 'hidden' },
  centerCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  loadingText: { marginTop: 10, fontSize: 16, color: PRIMARY_TEXT },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
    color: PRIMARY_TEXT,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    color: PRIMARY_TEXT,
    opacity: 0.85,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },

  // Input im Glas-Look
  inputRow: { paddingHorizontal: 20, marginBottom: 10 },
  inputGlass: {
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    color: '#333',
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Action-Cards (wie Sleep-Tracker „Schlaf starten / Manuell“)
  fullWidthAction: { borderRadius: 22, overflow: 'hidden', marginHorizontal: 20, marginTop: 8, marginBottom: 8 },
  cardBlur: { borderRadius: 22, overflow: 'hidden' },
  actionCard: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: 'rgba(255,255,255,0.3)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 4,
  },
  actionTitle: { fontSize: 16, fontWeight: '800', color: PRIMARY_TEXT, marginBottom: 4, textAlign: 'center' },
  actionSub: { fontSize: 11, color: PRIMARY_TEXT, opacity: 0.8, textAlign: 'center' },

  // Listen im Glas-Stil
  list: { paddingHorizontal: 12, paddingBottom: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  listItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)',
  },
  userName: { fontSize: 16, fontWeight: '800', color: PRIMARY_TEXT },
  userRole: { fontSize: 13, color: PRIMARY_TEXT, opacity: 0.85 },

  invCode: { fontSize: 15, fontWeight: '800', color: PRIMARY_TEXT },
  metaText: { fontSize: 12, color: PRIMARY_TEXT, opacity: 0.85, marginTop: 2 },

  sharePill: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
});
