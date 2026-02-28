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
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import { useConvex } from '@/contexts/ConvexContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router } from 'expo-router';
import { createInvitationLink, getUserInvitations, getLinkedUsers, deactivateAccountLink } from '@/lib/supabase';
import { redeemInvitationCodeFixed } from '@/lib/redeemInvitationCodeFixed';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LiquidGlassCard, GLASS_OVERLAY, GLASS_OVERLAY_DARK, LAYOUT_PAD } from '@/constants/DesignGuide';

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

const PRIMARY_TEXT   = '#7D5A50';    // Sleep-Tracker Typo-Farbe
const ACCENT_PURPLE  = '#8E4EC6';    // Sleep-Tracker Akzent
const ACCENT_MINT    = '#A8C4C1';
const ACCENT_ORANGE  = '#FF8C42';
const ACCENT_RED     = '#E06464';

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const lightenHex = (hex: string, amount = 0.35) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');

  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

export default function AccountLinkingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;

  const accentPurple = isDark ? lightenHex(ACCENT_PURPLE) : ACCENT_PURPLE;
  const accentMint = isDark ? lightenHex(ACCENT_MINT) : ACCENT_MINT;
  const accentOrange = isDark ? lightenHex(ACCENT_ORANGE) : ACCENT_ORANGE;
  const accentRed = isDark ? lightenHex(ACCENT_RED) : ACCENT_RED;

  const cardBorderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
  const listItemBorderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)';
  const listItemBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.6)';
  const inputBorderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
  const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)';
  const inputTextColor = isDark ? Colors.dark.textPrimary : '#333';
  const inputPlaceholderColor = isDark ? 'rgba(240,230,220,0.7)' : '#9BA0A6';
  const sharePillBg = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.9)';
  const sharePillBorder = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
  const cardBlurTint = isDark ? 'dark' : 'light';
  const { user } = useAuth();
  const { syncUser } = useConvex();

  const [isLoading, setIsLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [invitationCode, setInvitationCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    if (!user?.id) {
      setInvitations([]);
      setLinkedUsers([]);
      return;
    }

    setIsLoading(true);
    try {
      const invitationsResult = await getUserInvitations(user.id);
      if (invitationsResult.success) setInvitations(invitationsResult.invitations);

      const linkedUsersResult = await getLinkedUsers(user.id);
      if (linkedUsersResult.success) setLinkedUsers(linkedUsersResult.linkedUsers);
    } catch (error) {
      console.error('Error loading account linking data:', error);
      Alert.alert('Fehler', 'Die Daten konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    if (!user?.id) {
      Alert.alert('Fehler', 'Bitte erneut anmelden.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createInvitationLink(user.id);
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

  const performDeactivateLink = async (link: LinkedUser) => {
    if (!link?.linkId) return;
    setUnlinkingId(link.linkId);
    try {
      const result = await deactivateAccountLink(link.linkId);
      if (result.success) {
        Alert.alert('Verknüpfung deaktiviert', 'Die Verbindung wurde deaktiviert.');
        loadData();
        void syncUser();
      } else {
        const errorMessage = result.error?.message || 'Die Verknüpfung konnte nicht deaktiviert werden.';
        Alert.alert('Fehler', errorMessage);
      }
    } catch (error) {
      console.error('Error deactivating account link:', error);
      Alert.alert('Fehler', 'Die Verknüpfung konnte nicht deaktiviert werden.');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleDeactivateLink = (link: LinkedUser) => {
    const displayName = [link.firstName, link.lastName].filter(Boolean).join(' ').trim() || 'diesem Account';
    Alert.alert(
      'Verknüpfung deaktivieren',
      `Möchtest du die Verknüpfung mit ${displayName} wirklich deaktivieren?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Deaktivieren',
          style: 'destructive',
          onPress: () => performDeactivateLink(link),
        },
      ]
    );
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <ThemedBackground style={[styles.background, isDark && styles.backgroundDark]}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden />
        <Header title="Accounts verknüpfen" showBackButton onBackPress={() => router.back()} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <LiquidGlassCard style={[styles.sectionCard, styles.centerCard]} intensity={26} overlayColor={glassOverlay}>
              <ActivityIndicator size="large" color={isDark ? adaptiveColors.accent : theme.accent} />
              <ThemedText style={[styles.loadingText, { color: textSecondary }]}>Lade Daten…</ThemedText>
            </LiquidGlassCard>
          ) : (
            <>
              {/* Abschnitt: Einladung erstellen */}
              <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Einladung erstellen</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
                  Erstelle einen Code und teile ihn mit deinem Partner oder einer Vertrauensperson.
                </ThemedText>

                <TouchableOpacity
                  onPress={handleCreateInvitation}
                  activeOpacity={0.9}
                  style={styles.fullWidthAction}
                >
                  <BlurView intensity={24} tint={cardBlurTint} style={styles.cardBlur}>
                    <View
                      style={[
                        styles.actionCard,
                        {
                          backgroundColor: isDark ? toRgba(accentPurple, 0.22) : 'rgba(220,200,255,0.6)',
                          borderColor: cardBorderColor,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.actionIcon,
                          { backgroundColor: accentPurple, borderColor: cardBorderColor },
                        ]}
                      >
                        <IconSymbol name="plus" size={26} color="#FFFFFF" />
                      </View>
                      <ThemedText style={[styles.actionTitle, { color: textPrimary }]}>Einladungscode erstellen</ThemedText>
                      <ThemedText style={[styles.actionSub, { color: textSecondary }]}>Sicher teilen & verbinden</ThemedText>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              </LiquidGlassCard>

              {/* Abschnitt: Einladungscode einlösen */}
              <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Einladungscode einlösen</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
                  Du hast einen Code bekommen? Gib ihn hier ein und verknüpfe euren Account.
                </ThemedText>

                <View style={styles.inputRow}>
                  <TextInput
                    style={[
                      styles.inputGlass,
                      {
                        borderColor: inputBorderColor,
                        backgroundColor: inputBg,
                        color: inputTextColor,
                      },
                    ]}
                    placeholder="CODE"
                    placeholderTextColor={inputPlaceholderColor}
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
                  <BlurView intensity={24} tint={cardBlurTint} style={styles.cardBlur}>
                    <View
                      style={[
                        styles.actionCard,
                        {
                          backgroundColor: isDark ? toRgba(accentMint, 0.22) : 'rgba(168,196,193,0.6)',
                          borderColor: cardBorderColor,
                        },
                      ]}
                    >
                      <View style={[styles.actionIcon, { backgroundColor: accentMint, borderColor: cardBorderColor }]}>
                        {isRedeeming ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <IconSymbol name="checkmark" size={26} color="#FFFFFF" />
                        )}
                      </View>
                      <ThemedText style={[styles.actionTitle, { color: textPrimary }]}>{isRedeeming ? 'Einlösen…' : 'Code einlösen'}</ThemedText>
                      <ThemedText style={[styles.actionSub, { color: textSecondary }]}>Schnell & sicher</ThemedText>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              </LiquidGlassCard>

              {/* Abschnitt: Verknüpfte Accounts */}
              {linkedUsers.length > 0 && (
                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                  <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Verknüpfte Accounts</ThemedText>

                  <View style={styles.list}>
                    {linkedUsers.map((u) => (
                      <View key={u.linkId} style={[styles.listItem, { backgroundColor: listItemBg, borderColor: listItemBorderColor }]}>
                        <View style={styles.listItemLeft}>
                          <View style={[styles.avatar, { backgroundColor: isDark ? toRgba(accentPurple, 0.2) : 'rgba(142,78,198,0.2)', borderColor: listItemBorderColor }]}>
                            <IconSymbol name="person.fill" size={18} color={accentPurple} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={[styles.userName, { color: textPrimary }]}>{u.firstName} {u.lastName}</ThemedText>
                            <ThemedText style={[styles.userRole, { color: textSecondary }]}>
                              {u.userRole === 'mama' ? 'Mama' : u.userRole === 'papa' ? 'Papa' : 'Benutzer'}
                            </ThemedText>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeactivateLink(u)}
                          disabled={unlinkingId === u.linkId}
                          accessibilityLabel="Verknüpfung deaktivieren"
                          accessibilityRole="button"
                          style={[
                            styles.unlinkPill,
                            {
                              backgroundColor: isDark ? toRgba(accentRed, 0.18) : 'rgba(255,200,200,0.6)',
                              borderColor: listItemBorderColor,
                            },
                            unlinkingId === u.linkId && { opacity: 0.7 },
                          ]}
                        >
                          {unlinkingId === u.linkId ? (
                            <ActivityIndicator color={accentRed} />
                          ) : (
                            <IconSymbol name="xmark.circle.fill" size={18} color={accentRed} />
                          )}
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </LiquidGlassCard>
              )}

              {/* Abschnitt: Ausstehende Einladungen */}
              {invitations && invitations.filter(i => i.status === 'pending').length > 0 && (
                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                  <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Ausstehende Einladungen</ThemedText>

                  <View style={styles.list}>
                    {invitations
                      .filter(i => i.status === 'pending')
                      .map((inv) => (
                        <View key={inv.id} style={[styles.listItem, { backgroundColor: listItemBg, borderColor: listItemBorderColor }]}>
                          <View style={styles.listItemLeft}>
                            <View style={[styles.avatar, { backgroundColor: isDark ? toRgba(accentOrange, 0.2) : 'rgba(255,140,66,0.18)', borderColor: listItemBorderColor }]}>
                              <IconSymbol name="doc.on.doc" size={18} color={accentOrange} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={[styles.invCode, { color: textPrimary }]}>Code: {inv.invitationCode}</ThemedText>
                              <ThemedText style={[styles.metaText, { color: textSecondary }]}>Erstellt: {formatDate(inv.createdAt)}</ThemedText>
                              <ThemedText style={[styles.metaText, { color: textSecondary }]}>Gültig bis: {formatDate(inv.expiresAt)}</ThemedText>
                            </View>
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              Share.share({
                                message: `Verbinde dich mit mir! Code: ${inv.invitationCode} • Link: wehen-tracker://invite?code=${inv.invitationCode}`,
                                title: 'Einladung teilen'
                              });
                            }}
                            style={[styles.sharePill, { backgroundColor: sharePillBg, borderColor: sharePillBorder }]}
                          >
                            <IconSymbol name="square.and.arrow.up" size={18} color={accentPurple} />
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
  backgroundDark: { backgroundColor: Colors.dark.background },
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
  unlinkPill: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
});
