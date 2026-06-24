import React, { useMemo, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StatusBar, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';

const SUPPORT_EMAIL = 'support@lottibaby.de';

function buildMailtoUrl(email: string, subject: string, body: string) {
  const parts: string[] = [];
  if (subject.trim()) parts.push(`subject=${encodeURIComponent(subject.trim())}`);
  if (body.trim()) parts.push(`body=${encodeURIComponent(body.trim())}`);
  return `mailto:${email}${parts.length ? `?${parts.join('&')}` : ''}`;
}

export default function SupportScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const appVersion = useMemo(() => {
    const fromExpo = Constants.expoConfig?.version;
    const fromManifest = (Constants as any)?.manifest2?.version;
    return (fromExpo || fromManifest || '').toString();
  }, []);

  const mailtoUrl = useMemo(() => {
    const resolvedSubject = subject.trim() ? subject : 'Support-Anfrage';
    const bodyParts: string[] = [];
    if (message.trim()) bodyParts.push(message.trim());
    bodyParts.push('');
    bodyParts.push('---');
    if (appVersion) bodyParts.push(`App-Version: ${appVersion}`);
    if (user?.id) bodyParts.push(`User-ID: ${user.id}`);

    return buildMailtoUrl(SUPPORT_EMAIL, resolvedSubject, bodyParts.join('\n'));
  }, [subject, message, appVersion, user?.id]);

  const openMail = async () => {
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (!canOpen) {
        Alert.alert('E-Mail nicht verfügbar', `Bitte sende eine E-Mail an ${SUPPORT_EMAIL}.`);
        return;
      }
      await Linking.openURL(mailtoUrl);
    } catch (error) {
      console.error('Failed to open mail app:', error);
      Alert.alert('Fehler', `Bitte sende eine E-Mail an ${SUPPORT_EMAIL}.`);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />

          <Header
            title="Support"
            subtitle="Wünsche, Feedback oder Hilfe"
            showBackButton
            onBackPress={() => router.push('/more')}
          />

          <ScrollView contentContainerStyle={styles.content}>
            <LiquidGlassCard style={styles.card} intensity={26} overlayColor={GLASS_OVERLAY}>
              <ThemedText style={styles.sectionTitle}>Kontakt</ThemedText>

              <TouchableOpacity style={styles.row} onPress={openMail} activeOpacity={0.9}>
                <View style={styles.rowIcon}>
                  <IconSymbol name="envelope.fill" size={22} color={theme.accent} />
                </View>
                <View style={styles.rowContent}>
                  <ThemedText style={styles.rowTitle}>E-Mail an Support</ThemedText>
                  <ThemedText style={styles.rowDescription}>{SUPPORT_EMAIL}</ThemedText>
                </View>
                <IconSymbol name="arrow.up.right" size={18} color={theme.tabIconDefault} />
              </TouchableOpacity>
            </LiquidGlassCard>

            <LiquidGlassCard style={styles.card} intensity={26} overlayColor={GLASS_OVERLAY}>
              <ThemedText style={styles.sectionTitle}>Nachricht</ThemedText>

              <ThemedText style={styles.label}>Betreff</ThemedText>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Worum geht es?"
                placeholderTextColor="rgba(0,0,0,0.35)"
                style={styles.input}
                autoCorrect={true}
                autoCapitalize="sentences"
                returnKeyType="next"
              />

              <ThemedText style={styles.label}>Deine Nachricht</ThemedText>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Schreib uns deine Wünsche, Anmerkungen oder ein Problem…"
                placeholderTextColor="rgba(0,0,0,0.35)"
                style={[styles.input, styles.textarea]}
                multiline
                textAlignVertical="top"
                autoCorrect={true}
                autoCapitalize="sentences"
              />

              <TouchableOpacity style={styles.sendButton} onPress={openMail} activeOpacity={0.9}>
                <ThemedText style={styles.sendButtonText}>E-Mail öffnen</ThemedText>
              </TouchableOpacity>
            </LiquidGlassCard>
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 10,
  },
  card: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  rowIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowDescription: {
    fontSize: 13,
    opacity: 0.8,
  },
  label: {
    fontSize: 13,
    opacity: 0.85,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  input: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    fontSize: 15,
    color: '#5C4033',
  },
  textarea: {
    minHeight: 140,
  },
  sendButton: {
    marginHorizontal: 16,
    marginBottom: 18,
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#E9C9B6',
    alignItems: 'center',
  },
  sendButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#5C4033',
  },
});
