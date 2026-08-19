import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DEFAULT_APP_LOCALE, type AppLocale } from '@/lib/localization';
import {
  blockUser,
  reportContent,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/moderation';
import {
  translateModerationText,
  type ModerationTranslationKey,
} from '@/lib/moderationTranslations';

export type ModerationTarget = {
  targetType: ReportTargetType;
  targetId: string;
  authorId: string;
  authorName?: string | null;
};

type ModerationSheetProps = {
  visible: boolean;
  target: ModerationTarget | null;
  locale?: AppLocale;
  onClose: () => void;
  /** Wird nach einer erfolgreichen Meldung aufgerufen, damit die Liste den Inhalt sofort ausblendet. */
  onContentHidden?: (target: ModerationTarget) => void;
  /** Wird nach einer erfolgreichen Blockierung aufgerufen. */
  onUserBlocked?: (userId: string) => void;
};

const REPORT_REASONS: { reason: ReportReason; key: ModerationTranslationKey }[] = [
  { reason: 'harassment', key: 'report.reason.harassment' },
  { reason: 'hate', key: 'report.reason.hate' },
  { reason: 'sexual', key: 'report.reason.sexual' },
  { reason: 'violence', key: 'report.reason.violence' },
  { reason: 'self_harm', key: 'report.reason.self_harm' },
  { reason: 'misinformation', key: 'report.reason.misinformation' },
  { reason: 'spam', key: 'report.reason.spam' },
  { reason: 'other', key: 'report.reason.other' },
];

export function ModerationSheet({
  visible,
  target,
  locale = DEFAULT_APP_LOCALE,
  onClose,
  onContentHidden,
  onUserBlocked,
}: ModerationSheetProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const [step, setStep] = useState<'actions' | 'report'>('actions');
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textPrimary = isDark ? Colors.dark.text : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const overlayColor = isDark ? 'rgba(12, 12, 16, 0.72)' : 'rgba(92, 64, 51, 0.34)';
  const sheetColor = isDark ? '#1E1B22' : '#FFF8F4';
  const sheetBorderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(125, 90, 80, 0.12)';
  const cardColor = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const cardBorderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(125, 90, 80, 0.08)';
  const activeBorderColor = isDark ? '#E9C9B6' : '#D7A98F';
  const activeCardColor = isDark ? 'rgba(233,201,182,0.14)' : 'rgba(233,201,182,0.16)';
  const primaryButtonColor = '#9DBEBB';
  const dangerColor = isDark ? '#E88F84' : '#C4645A';
  const secondaryButtonColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(125, 90, 80, 0.08)';

  const t = useCallback(
    (key: ModerationTranslationKey, params?: Record<string, string | number>) =>
      translateModerationText(locale, key, params),
    [locale],
  );

  useEffect(() => {
    if (visible) return;
    setStep('actions');
    setSelectedReason(null);
    setDetails('');
    setAlsoBlock(false);
    setIsSubmitting(false);
  }, [visible]);

  const isProfileTarget = target?.targetType === 'profile';
  const authorName = target?.authorName?.trim() || t('target.profile');

  const handleBlock = useCallback(() => {
    if (!target) return;

    Alert.alert(
      t('block.confirmTitle'),
      t('block.confirmMessage', { name: authorName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('block.confirm'),
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            // Apple verlangt, dass der Entwickler beim Blockieren über den
            // Anlass informiert wird – daher immer eine Meldung mitschicken.
            const result = await blockUser(target.authorId, {
              targetType: target.targetType,
              targetId: target.targetId,
            });
            setIsSubmitting(false);

            if (!result.success) {
              Alert.alert(t('common.error'), t('block.failedMessage'));
              return;
            }

            onUserBlocked?.(target.authorId);
            onClose();
            Alert.alert(
              t('block.successTitle'),
              t('block.successMessage', { name: authorName }),
            );
          },
        },
      ],
    );
  }, [authorName, onClose, onUserBlocked, t, target]);

  const handleSubmitReport = useCallback(async () => {
    if (!target || !selectedReason || isSubmitting) return;

    setIsSubmitting(true);
    const result = await reportContent({
      targetType: target.targetType,
      targetId: target.targetId,
      reason: selectedReason,
      details,
    });

    if (!result.success) {
      setIsSubmitting(false);
      Alert.alert(t('report.failedTitle'), t('report.failedMessage'));
      return;
    }

    if (alsoBlock) {
      const blockResult = await blockUser(target.authorId);
      if (blockResult.success) onUserBlocked?.(target.authorId);
    }

    setIsSubmitting(false);
    onContentHidden?.(target);
    onClose();
    Alert.alert(t('report.successTitle'), t('report.successMessage'));
  }, [
    alsoBlock,
    details,
    isSubmitting,
    onClose,
    onContentHidden,
    onUserBlocked,
    selectedReason,
    t,
    target,
  ]);

  if (!target) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <View style={[styles.sheet, { backgroundColor: sheetColor, borderColor: sheetBorderColor }]}>
          {step === 'actions' ? (
            <>
              <ThemedText style={[styles.title, { color: textPrimary }]}>
                {isProfileTarget ? t('sheet.titleProfile') : t('sheet.title')}
              </ThemedText>

              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: cardColor, borderColor: cardBorderColor }]}
                onPress={() => setStep('report')}
                activeOpacity={0.9}
              >
                <IconSymbol name="exclamationmark.triangle.fill" size={22} color={dangerColor} />
                <ThemedText style={[styles.actionLabel, { color: textPrimary }]}>
                  {isProfileTarget ? t('sheet.reportProfile') : t('sheet.report')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: cardColor, borderColor: cardBorderColor }]}
                onPress={handleBlock}
                activeOpacity={0.9}
                disabled={isSubmitting}
              >
                <IconSymbol name="hand.raised.fill" size={22} color={dangerColor} />
                <ThemedText style={[styles.actionLabel, { color: textPrimary }]}>
                  {t('sheet.block')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: secondaryButtonColor }]}
                onPress={onClose}
                activeOpacity={0.9}
              >
                <ThemedText style={[styles.secondaryButtonText, { color: textPrimary }]}>
                  {t('common.cancel')}
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ThemedText style={[styles.title, { color: textPrimary }]}>
                {t('report.title')}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: textSecondary }]}>
                {t('report.subtitle')}
              </ThemedText>

              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {REPORT_REASONS.map((option) => {
                  const isSelected = selectedReason === option.reason;
                  return (
                    <TouchableOpacity
                      key={option.reason}
                      style={[
                        styles.reasonRow,
                        {
                          backgroundColor: isSelected ? activeCardColor : cardColor,
                          borderColor: isSelected ? activeBorderColor : cardBorderColor,
                        },
                      ]}
                      onPress={() => setSelectedReason(option.reason)}
                      activeOpacity={0.9}
                      disabled={isSubmitting}
                    >
                      <ThemedText style={[styles.reasonLabel, { color: textPrimary }]}>
                        {t(option.key)}
                      </ThemedText>
                      <IconSymbol
                        name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                        size={22}
                        color={isSelected ? primaryButtonColor : textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}

                <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>
                  {t('report.detailsLabel')}
                </ThemedText>
                <TextInput
                  style={[
                    styles.detailsInput,
                    { backgroundColor: cardColor, borderColor: cardBorderColor, color: textPrimary },
                  ]}
                  value={details}
                  onChangeText={setDetails}
                  placeholder={t('report.detailsPlaceholder')}
                  placeholderTextColor={textSecondary}
                  multiline
                  maxLength={500}
                  editable={!isSubmitting}
                />

                {!isProfileTarget && (
                  <TouchableOpacity
                    style={[
                      styles.blockToggle,
                      {
                        backgroundColor: alsoBlock ? activeCardColor : cardColor,
                        borderColor: alsoBlock ? activeBorderColor : cardBorderColor,
                      },
                    ]}
                    onPress={() => setAlsoBlock((current) => !current)}
                    activeOpacity={0.9}
                    disabled={isSubmitting}
                  >
                    <ThemedText style={[styles.reasonLabel, { color: textPrimary }]}>
                      {t('report.blockToo')}
                    </ThemedText>
                    <IconSymbol
                      name={alsoBlock ? 'checkmark.circle.fill' : 'circle'}
                      size={22}
                      color={alsoBlock ? primaryButtonColor : textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </ScrollView>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.buttonFlex, { backgroundColor: secondaryButtonColor }]}
                  onPress={onClose}
                  activeOpacity={0.9}
                  disabled={isSubmitting}
                >
                  <ThemedText style={[styles.secondaryButtonText, { color: textPrimary }]}>
                    {t('common.cancel')}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: primaryButtonColor },
                    (!selectedReason || isSubmitting) && styles.buttonDisabled,
                  ]}
                  onPress={() => void handleSubmitReport()}
                  activeOpacity={0.9}
                  disabled={!selectedReason || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>{t('report.submit')}</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    maxHeight: '88%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  scrollArea: {
    marginTop: 14,
    maxHeight: 380,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  detailsInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  blockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  buttonFlex: {
    flex: 1,
  },
  secondaryButton: {
    borderRadius: 16,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1.3,
    borderRadius: 16,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
