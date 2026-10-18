import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useLocale } from '@/contexts/LocaleContext';
import type { StoredChatMessage } from '@/lib/askLotti/chatStore';
import { ASK_LOTTI_REPORT_REASONS, canReportLottiMessage, MAX_REPORT_DETAILS_LENGTH, reportLottiAnswer } from '@/lib/askLotti/reporting';
import { translateAskLotti } from '@/lib/askLotti/translations';
import type { ReportReason } from '@/lib/moderation';
import { translateModerationText } from '@/lib/moderationTranslations';
import { ActionButton } from '@/components/ui/action-button';

export function ReportAnswerButton({ message, conversationId, isDark }: {
  message: StoredChatMessage;
  conversationId: string;
  isDark: boolean;
}) {
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reported, setReported] = useState(false);
  const inFlight = useRef(false);
  const accent = isDark ? '#C8B3FF' : '#6544B8';
  const color = isDark ? '#F3EDF9' : '#513C35';
  const backgroundColor = isDark ? '#27212F' : '#FFFAF7';
  const borderColor = isDark ? '#73677C' : '#CDBECC';
  const t = (key: Parameters<typeof translateAskLotti>[1]) => translateAskLotti(locale, key);
  const mt = (key: Parameters<typeof translateModerationText>[1]) => translateModerationText(locale, key);

  const close = () => { if (!inFlight.current) setVisible(false); };
  const submit = async () => {
    if (!reason || inFlight.current || reported) return;
    inFlight.current = true;
    setSending(true);
    setFailed(false);
    try {
      const success = await reportLottiAnswer({ conversationId, message, reason, details });
      setReported(success);
      setFailed(!success);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  if (!canReportLottiMessage(message)) return null;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t(reported ? 'answerReported' : 'reportAnswer')}
        onPress={() => setVisible(true)} style={styles.trigger}>
        <IconSymbol name="flag" size={14} color={accent} />
        <Text style={{ color: accent }}>{t(reported ? 'answerReported' : 'reportAnswer')}</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor, marginTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text accessibilityRole="header" style={[styles.title, { color }]}>{t(reported ? 'reportThanks' : 'reportAnswer')}</Text>
              {reported ? <Text style={[styles.copy, { color }]}>{t('reportSuccess')}</Text> : <>
                <Text style={[styles.copy, { color }]}>{t('reportPrivacy')}</Text>
                <Text numberOfLines={4} style={[styles.preview, { color, borderColor }]}>{message.text}</Text>
                <Text style={[styles.copy, { color }]}>{mt('report.subtitle')}</Text>
                {ASK_LOTTI_REPORT_REASONS.map((value) => (
                  <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: reason === value, disabled: sending }}
                    disabled={sending} onPress={() => setReason(value)}
                    style={[styles.reason, { borderColor: reason === value ? accent : borderColor, backgroundColor: reason === value ? (isDark ? '#433256' : '#EEE5FC') : 'transparent' }]}>
                    <Text style={{ color, flex: 1 }}>{mt(`report.reason.${value}`)}</Text>
                    {reason === value ? <IconSymbol name="checkmark" size={16} color={accent} /> : null}
                  </Pressable>
                ))}
                <Text style={[styles.copy, { color }]}>{mt('report.detailsLabel')}</Text>
                <TextInput accessibilityLabel={mt('report.detailsLabel')} value={details} onChangeText={setDetails}
                  editable={!sending} multiline maxLength={MAX_REPORT_DETAILS_LENGTH} textAlignVertical="top"
                  placeholder={mt('report.detailsPlaceholder')} placeholderTextColor={isDark ? '#B4A7BE' : '#786779'}
                  style={[styles.input, { color, borderColor }]} />
                {failed ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.copy, { color: isDark ? '#FFB4AB' : '#A12626' }]}>{mt('report.failedMessage')}</Text> : null}
                <ActionButton
                  label={t('reportSubmit')}
                  busyLabel={t('reportSending')}
                  disabled={!reason}
                  busy={sending}
                  isDark={isDark}
                  onPress={() => void submit()}
                />
              </>}
              <ActionButton variant="ghost" label={mt(reported ? 'common.close' : 'common.cancel')}
                disabled={sending} isDark={isDark} onPress={close} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, alignSelf: 'flex-start', paddingVertical: 10 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '94%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  copy: { fontSize: 15, lineHeight: 22 },
  preview: { padding: 12, borderWidth: 1, borderRadius: 12, lineHeight: 21 },
  reason: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 88, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
});
