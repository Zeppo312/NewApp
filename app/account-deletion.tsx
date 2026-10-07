import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { ACCOUNT_DELETION_URL, getDeletionAvailability, requestAccountDeletion, sendDeletionVerification, verifyDeletionCode, type DeletionAvailability } from '@/lib/accountDeletion';
import { deletionCopy } from '@/lib/accountDeletionCopy';
import { getRevenueCatSubscriptionSummary } from '@/lib/revenuecat';
import { openSubscriptionManagement } from '@/lib/subscriptionManagement';

export default function AccountDeletionScreen() {
 const { user, signOut } = useAuth(); const { locale } = useLocale(); const router = useRouter();
 const { scope: requestedScope } = useLocalSearchParams<{ scope?: string }>();
 const scope = requestedScope === 'data' ? 'data' : 'account'; const copy = deletionCopy[locale];
 const [email, setEmail] = useState<string | null>(null); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);
 const [availability, setAvailability] = useState<DeletionAvailability | 'checking'>('checking');
 const [availabilityRevision, setAvailabilityRevision] = useState(0);
 useEffect(() => {
  let cancelled = false;
  setAvailability('checking'); setEmail(null); setCode('');
  void getDeletionAvailability().then(value => { if (!cancelled) setAvailability(value); });
  return () => { cancelled = true; };
 }, [user?.id, availabilityRevision]);
 const verify = async () => {
  setBusy(true);
  try { setEmail(await sendDeletionVerification()); } catch { Alert.alert(copy.title, copy.error); }
  finally { setBusy(false); }
 };
 const submit = async () => {
  if (!email || !user || busy) return;
  setBusy(true);
  try {
   const userId = user.id;
   const verifiedToken = await verifyDeletionCode(email, code, userId);
   // Bind acceptance to this verified identity even if another sign-in occurs
   // while the network request is pending.
   const receipt = await requestAccountDeletion(scope, verifiedToken);
   // Sign out immediately, not only after dismissing the success dialog.
   // Once accepted, local logout failures must never be shown as a rejected
   // deletion request. AuthContext performs and reports local cleanup.
   try { await signOut(); } catch { /* The server receipt remains valid. */ }
   Alert.alert(copy.acceptedTitle, `${copy.accepted}\n\n${receipt.requestId}`);
  } catch { Alert.alert(copy.title, copy.error); }
  finally { setBusy(false); }
 };
 return <ThemedBackground style={{ flex: 1 }}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.card}>
   <ThemedText style={styles.title}>{scope === 'data' ? copy.resetTitle : copy.title}</ThemedText>
   <ThemedText style={styles.body}>{scope === 'data' ? copy.resetBody : copy.body}</ThemedText>
   <ThemedText style={styles.body}>{copy.warning}</ThemedText>
   {availability === 'checking' && <ThemedText style={styles.body}>{copy.busy}</ThemedText>}
   {availability === 'support' && <ThemedText style={styles.body}>{copy.supportOnly}</ThemedText>}
   {availability === 'unavailable' && <><ThemedText style={styles.body}>{copy.availabilityError}</ThemedText><Pressable accessibilityRole="button" onPress={() => setAvailabilityRevision(value => value + 1)} style={styles.button}><ThemedText style={styles.buttonText}>{copy.retry}</ThemedText></Pressable></>}
   {availability === 'available' && (email ? <><ThemedText style={styles.body}>{copy.sent}</ThemedText><TextInput accessibilityLabel={copy.code} placeholder={copy.code} value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={10} style={styles.input} />
    <Pressable accessibilityRole="button" disabled={busy || code.trim().length < 6} onPress={() => void submit()} style={styles.danger}><ThemedText style={styles.buttonText}>{busy ? copy.busy : copy.confirm}</ThemedText></Pressable></>
   : <Pressable accessibilityRole="button" disabled={busy} onPress={() => void verify()} style={styles.button}><ThemedText style={styles.buttonText}>{busy ? copy.busy : copy.verify}</ThemedText></Pressable>)}
   <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(ACCOUNT_DELETION_URL)} style={styles.link}><ThemedText>{copy.support}</ThemedText></Pressable>
   <Pressable accessibilityRole="button" onPress={() => { void (async () => { try { const s = user ? await getRevenueCatSubscriptionSummary(user.id) : null; await openSubscriptionManagement({ store: s?.store ?? null }); } catch { Alert.alert(copy.title, copy.error); } })(); }} style={styles.link}><ThemedText>{copy.manage}</ThemedText></Pressable>
   <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.link}><ThemedText>{copy.cancel}</ThemedText></Pressable>
  </View></ScrollView></SafeAreaView></ThemedBackground>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, justifyContent: 'center', padding: 24 }, card: { backgroundColor: '#fffaf5', borderRadius: 24, padding: 24, gap: 14 }, title: { fontSize: 25, fontWeight: '700', lineHeight: 32 }, body: { fontSize: 16, lineHeight: 24 }, input: { borderWidth: 1, borderColor: '#847080', borderRadius: 12, padding: 16, color: '#30282b', backgroundColor: '#fff' }, button: { backgroundColor: '#665086', padding: 16, borderRadius: 12 }, danger: { backgroundColor: '#a52d31', padding: 16, borderRadius: 12 }, buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' }, link: { paddingVertical: 12 } });
