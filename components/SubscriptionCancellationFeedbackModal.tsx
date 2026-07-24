import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import type { SubscriptionCancellationFeedbackReason } from '@/lib/subscriptionCancellationFeedback';
import {
  DEFAULT_SUBSCRIPTION_LOCALE,
  translateSubscriptionText,
  type SubscriptionLocale,
  type SubscriptionTranslationKey,
} from '@/lib/subscriptionTranslations';

type FeedbackOption = {
  value: SubscriptionCancellationFeedbackReason;
  labelKey: SubscriptionTranslationKey;
};

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { value: 'too_expensive', labelKey: 'feedback.tooExpensive' },
  { value: 'missing_features', labelKey: 'feedback.missingFeatures' },
  { value: 'not_using', labelKey: 'feedback.notUsing' },
  { value: 'technical_issues', labelKey: 'feedback.technicalIssues' },
  { value: 'temporary_pause', labelKey: 'feedback.temporaryPause' },
  { value: 'other', labelKey: 'feedback.other' },
];

type SubscriptionCancellationFeedbackModalProps = {
  visible: boolean;
  isSubmitting?: boolean;
  locale?: SubscriptionLocale;
  onClose: () => void;
  onSkip: () => void;
  onSubmit: (feedback: {
    reason: SubscriptionCancellationFeedbackReason;
    details: string;
  }) => void;
};

export function SubscriptionCancellationFeedbackModal({
  visible,
  isSubmitting = false,
  locale = DEFAULT_SUBSCRIPTION_LOCALE,
  onClose,
  onSkip,
  onSubmit,
}: SubscriptionCancellationFeedbackModalProps) {
  const t = (
    key: SubscriptionTranslationKey,
    params?: Record<string, string | number>,
  ) => translateSubscriptionText(locale, key, params);
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' ||
    adaptiveColors.isDarkBackground;
  const [selectedReason, setSelectedReason] =
    useState<SubscriptionCancellationFeedbackReason | null>(null);
  const [details, setDetails] = useState('');

  const palette = {
    backdrop: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.46)',
    card: isDark ? 'rgba(12,12,18,0.96)' : 'rgba(255,255,255,0.96)',
    border: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.72)',
    text: isDark ? adaptiveColors.textPrimary : '#5C4033',
    textSecondary: isDark ? adaptiveColors.textSecondary : '#7D5A50',
    field: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(125,90,80,0.06)',
    fieldBorder: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(125,90,80,0.12)',
    option: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
    selected: isDark ? 'rgba(255,207,174,0.18)' : 'rgba(255,207,174,0.42)',
    accent: isDark ? '#FFD0AE' : '#6B4FCE',
    ghost: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
    disabled: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(107,79,206,0.25)',
    placeholder: isDark ? 'rgba(248,240,229,0.52)' : 'rgba(125,90,80,0.55)',
  };

  const canSubmit = !!selectedReason && !isSubmitting;

  const resetForm = () => {
    setSelectedReason(null);
    setDetails('');
  };

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit({ reason: selectedReason, details });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={resetForm}
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: palette.backdrop }]}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
      >
        <BlurView
          intensity={92}
          tint={isDark ? 'dark' : 'extraLight'}
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={[styles.iconWrap, { backgroundColor: palette.selected }]}>
              <IconSymbol name="heart.fill" size={22} color={palette.accent} />
            </View>
            <View style={styles.headerText}>
              <ThemedText style={[styles.title, { color: palette.text }]}>
                {t('feedback.title')}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: palette.textSecondary }]}>
                {t('feedback.subtitle')}
              </ThemedText>
            </View>
          </View>

          <ScrollView
            style={styles.optionsScroll}
            contentContainerStyle={styles.optionsContent}
            showsVerticalScrollIndicator={false}
          >
            {FEEDBACK_OPTIONS.map((option) => {
              const isSelected = selectedReason === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: isSelected ? palette.selected : palette.option,
                      borderColor: isSelected ? palette.accent : palette.fieldBorder,
                    },
                  ]}
                  activeOpacity={0.82}
                  onPress={() => setSelectedReason(option.value)}
                >
                  <View
                    style={[
                      styles.radio,
                      { borderColor: isSelected ? palette.accent : palette.fieldBorder },
                    ]}
                  >
                    {isSelected ? (
                      <View style={[styles.radioDot, { backgroundColor: palette.accent }]} />
                    ) : null}
                  </View>
                  <ThemedText style={[styles.optionLabel, { color: palette.text }]}>
                    {t(option.labelKey)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}

            <TextInput
              style={[
                styles.detailsInput,
                {
                  backgroundColor: palette.field,
                  borderColor: palette.fieldBorder,
                  color: palette.text,
                },
              ]}
              value={details}
              onChangeText={setDetails}
              placeholder={t('feedback.placeholder')}
              placeholderTextColor={palette.placeholder}
              multiline
              maxLength={1200}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: palette.ghost }]}
              onPress={onSkip}
              disabled={isSubmitting}
            >
              <ThemedText style={[styles.secondaryButtonText, { color: palette.textSecondary }]}>
                {t('feedback.skip')}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: canSubmit ? palette.accent : palette.disabled },
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>
                  {t('feedback.submit')}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  optionsScroll: {
    maxHeight: 420,
  },
  optionsContent: {
    paddingBottom: 2,
  },
  optionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  detailsInput: {
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
