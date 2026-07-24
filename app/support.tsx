import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LiquidGlassCard, LAYOUT_PAD } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_SUPPORT_LOCALE,
  SupportTranslationKey,
  translateSupportText,
} from '@/lib/supportTranslations';

const SUPPORT_EMAIL = 'support@lottibaby.de';
const ACTIVE_SUPPORT_LOCALE = DEFAULT_SUPPORT_LOCALE;
const t = (
  key: SupportTranslationKey,
  params?: Record<string, string | number>,
) => translateSupportText(ACTIVE_SUPPORT_LOCALE, key, params);

function buildMailtoUrl(email: string, subject: string, body: string) {
  const parts: string[] = [];
  if (subject.trim()) parts.push(`subject=${encodeURIComponent(subject.trim())}`);
  if (body.trim()) parts.push(`body=${encodeURIComponent(body.trim())}`);
  return `mailto:${email}${parts.length ? `?${parts.join('&')}` : ''}`;
}

export default function SupportScreen() {
  const router = useRouter();
  const adaptiveColors = useAdaptiveColors();
  const { user } = useAuth();
  const userId = user?.id;

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const isDark = adaptiveColors.effectiveScheme === 'dark';
  const accentColor = adaptiveColors.accent;
  const mutedColor = adaptiveColors.textTertiary;
  const inputBackground = isDark ? 'rgba(20,16,15,0.42)' : 'rgba(255,255,255,0.7)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(125,90,80,0.14)';

  const appVersion = useMemo(() => {
    const fromExpo = Constants.expoConfig?.version;
    const fromManifest = (Constants as any)?.manifest2?.version;
    return (fromExpo || fromManifest || '').toString();
  }, []);

  const mailtoUrl = useMemo(() => {
    const resolvedSubject = subject.trim() || t('mail.defaultSubject');
    const bodyParts: string[] = [];
    if (message.trim()) bodyParts.push(message.trim());
    bodyParts.push('', '---');
    if (appVersion) bodyParts.push(`${t('mail.appVersion')}: ${appVersion}`);
    if (userId) bodyParts.push(`${t('mail.userId')}: ${userId}`);

    return buildMailtoUrl(SUPPORT_EMAIL, resolvedSubject, bodyParts.join('\n'));
  }, [subject, message, appVersion, userId]);

  const openMail = async () => {
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (!canOpen) {
        Alert.alert(
          t('alert.unavailableTitle'),
          t('alert.unavailableMessage', { email: SUPPORT_EMAIL }),
        );
        return;
      }
      await Linking.openURL(mailtoUrl);
    } catch (error) {
      console.error('Failed to open mail app:', error);
      Alert.alert(
        t('alert.errorTitle'),
        t('alert.errorMessage', { email: SUPPORT_EMAIL }),
      );
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar hidden />
          <Header
            title={t('screen.title')}
            subtitle={t('screen.subtitle')}
            showBackButton
            showBabySwitcher={false}
            onBackPress={() => router.push('/more')}
          />

          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              contentInsetAdjustmentBehavior="automatic"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <LiquidGlassCard style={styles.heroCard} intensity={34}>
                <View style={styles.heroGlow} />
                <View style={styles.heroTopRow}>
                  <View style={[styles.heroIcon, { backgroundColor: `${accentColor}22` }]}>
                    <IconSymbol name="heart.fill" size={27} color={accentColor} />
                  </View>
                  <View style={styles.heroCopy}>
                    <ThemedText style={[styles.heroEyebrow, { color: accentColor }]}>
                      {t('hero.eyebrow')}
                    </ThemedText>
                    <ThemedText style={styles.heroTitle}>{t('hero.title')}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.heroDescription}>
                  {t('hero.description')}
                </ThemedText>
                <View style={styles.heroPills}>
                  <View style={[styles.heroPill, { borderColor: inputBorder }]}>
                    <IconSymbol name="person.fill" size={14} color={accentColor} />
                    <ThemedText style={styles.heroPillLabel}>{t('hero.reply')}</ThemedText>
                  </View>
                  <View style={[styles.heroPill, { borderColor: inputBorder }]}>
                    <IconSymbol name="envelope.fill" size={14} color={accentColor} />
                    <ThemedText style={styles.heroPillLabel}>{t('hero.email')}</ThemedText>
                  </View>
                </View>
              </LiquidGlassCard>

              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>{t('contact.title')}</ThemedText>
              </View>
              <LiquidGlassCard style={styles.card} intensity={26}>
                <TouchableOpacity style={styles.contactRow} onPress={openMail} activeOpacity={0.82}>
                  <View style={[styles.rowIcon, { backgroundColor: `${accentColor}22` }]}>
                    <IconSymbol name="envelope.fill" size={22} color={accentColor} />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowTitle}>{t('contact.emailTitle')}</ThemedText>
                    <ThemedText style={styles.rowDescription} selectable>
                      {SUPPORT_EMAIL}
                    </ThemedText>
                    <ThemedText style={styles.rowHint}>{t('contact.emailDescription')}</ThemedText>
                  </View>
                  <IconSymbol name="arrow.up.right" size={18} color={mutedColor} />
                </TouchableOpacity>
                <View style={[styles.responseNote, { borderTopColor: inputBorder }]}>
                  <IconSymbol name="clock" size={15} color={adaptiveColors.success} />
                  <ThemedText style={styles.responseText}>{t('contact.responseTime')}</ThemedText>
                </View>
              </LiquidGlassCard>

              <LiquidGlassCard style={styles.formCard} intensity={26}>
                <View style={styles.formHeading}>
                  <View style={[styles.formHeadingIcon, { backgroundColor: `${accentColor}22` }]}>
                    <IconSymbol name="paperplane.fill" size={19} color={accentColor} />
                  </View>
                  <View style={styles.formHeadingCopy}>
                    <ThemedText style={styles.formTitle}>{t('form.title')}</ThemedText>
                    <ThemedText style={styles.formDescription}>{t('form.description')}</ThemedText>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText style={styles.label}>{t('form.subjectLabel')}</ThemedText>
                  <TextInput
                    value={subject}
                    onChangeText={setSubject}
                    placeholder={t('form.subjectPlaceholder')}
                    placeholderTextColor={mutedColor}
                    style={[
                      styles.input,
                      { backgroundColor: inputBackground, borderColor: inputBorder, color: adaptiveColors.textPrimary },
                    ]}
                    autoCorrect
                    autoCapitalize="sentences"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText style={styles.label}>{t('form.messageLabel')}</ThemedText>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder={t('form.messagePlaceholder')}
                    placeholderTextColor={mutedColor}
                    style={[
                      styles.input,
                      styles.textarea,
                      { backgroundColor: inputBackground, borderColor: inputBorder, color: adaptiveColors.textPrimary },
                    ]}
                    multiline
                    textAlignVertical="top"
                    autoCorrect
                    autoCapitalize="sentences"
                  />
                </View>

                <View style={styles.privacyNote}>
                  <IconSymbol name="lock.shield" size={15} color={mutedColor} />
                  <ThemedText style={styles.privacyText}>{t('form.privacyNote')}</ThemedText>
                </View>

                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: accentColor }]}
                  onPress={openMail}
                  activeOpacity={0.86}
                >
                  <IconSymbol name="paperplane.fill" size={18} color="#3F302A" />
                  <ThemedText style={styles.sendButtonText}>{t('form.send')}</ThemedText>
                </TouchableOpacity>
              </LiquidGlassCard>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%' },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  content: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    padding: 20,
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(83, 59, 89, 0.12)',
  },
  heroGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -82,
    right: -46,
    backgroundColor: 'rgba(157,190,187,0.22)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, gap: 2 },
  heroEyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  heroDescription: { fontSize: 14, lineHeight: 21, opacity: 0.8, paddingTop: 14 },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 16 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroPillLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  sectionHeader: { paddingHorizontal: 4, paddingTop: 2, paddingBottom: 0 },
  sectionTitle: { fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 0.45, opacity: 0.78 },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    boxShadow: '0 6px 20px rgba(83, 59, 89, 0.08)',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 88,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  rowContent: { flex: 1, paddingRight: 10 },
  rowTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  rowDescription: { fontSize: 13, lineHeight: 18, fontWeight: '600', opacity: 0.82, marginTop: 2 },
  rowHint: { fontSize: 12, lineHeight: 17, opacity: 0.62, marginTop: 1 },
  responseNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  responseText: { flex: 1, fontSize: 12, lineHeight: 17, opacity: 0.72 },
  formCard: {
    padding: 18,
    borderRadius: 22,
    overflow: 'hidden',
    boxShadow: '0 6px 20px rgba(83, 59, 89, 0.08)',
    gap: 16,
  },
  formHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  formHeadingIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeadingCopy: { flex: 1, gap: 1 },
  formTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  formDescription: { fontSize: 13, lineHeight: 18, opacity: 0.7 },
  fieldGroup: { gap: 7 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700', opacity: 0.84 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    lineHeight: 20,
  },
  textarea: { minHeight: 138, paddingTop: 13 },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  privacyText: { flex: 1, fontSize: 11, lineHeight: 16, opacity: 0.62 },
  sendButton: {
    minHeight: 50,
    borderRadius: 16,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 14,
    paddingHorizontal: 18,
    boxShadow: '0 6px 14px rgba(93, 64, 52, 0.14)',
  },
  sendButtonText: { color: '#3F302A', fontSize: 16, lineHeight: 21, fontWeight: '800' },
});
