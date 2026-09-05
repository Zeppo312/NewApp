import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { Colors } from '@/constants/Colors';
import { RADIUS } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLocale } from '@/contexts/LocaleContext';
import {
  CustomActivityType,
  CustomActivityTypeDraft,
  CustomTrackingMode,
} from '@/lib/customActivities';
import { translateDailyText } from '@/lib/dailyTranslations';

const COLORS = ['#5E3DB3', '#4A90E2', '#35B6B4', '#38A169', '#F5A623', '#E25555'];
const EMOJI_SUGGESTIONS = ['⭐️', '💊', '🛁', '🌡️', '🤸', '🦷', '💧', '🌿'];
const UNIT_SUGGESTIONS = ['ml', 'g', 'mg', 'Tropfen', 'Stück'];

type Props = {
  visible: boolean;
  initialValue?: CustomActivityType | null;
  onClose: () => void;
  onSave: (draft: CustomActivityTypeDraft) => Promise<boolean>;
  onArchive?: () => Promise<boolean>;
};

const parsePositiveDecimal = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default function CustomActivityDefinitionModal({
  visible,
  initialValue,
  onClose,
  onSave,
  onArchive,
}: Props) {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateDailyText>[1]) => translateDailyText(locale, key);
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#342824';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const panelBackground = isDark ? 'rgba(35,31,32,0.97)' : 'rgba(248,245,241,0.98)';
  const fieldBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.78)';
  const borderColor = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(125,90,80,0.14)';

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('⭐️');
  const [trackingMode, setTrackingMode] = useState<CustomTrackingMode>('event');
  const [unit, setUnit] = useState('');
  const [defaultQuantity, setDefaultQuantity] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initialValue?.name ?? '');
    setEmoji(initialValue?.emoji ?? '⭐️');
    setTrackingMode(initialValue?.tracking_mode ?? 'event');
    setUnit(initialValue?.unit ?? '');
    setDefaultQuantity(
      initialValue?.default_quantity == null ? '' : String(initialValue.default_quantity).replace('.', ','),
    );
    setColor(initialValue?.color ?? COLORS[0]);
    setBusy(false);
  }, [initialValue, visible]);

  const trackingOptions = [
    { value: 'event' as const, emoji: '✓', label: t('custom.event') },
    { value: 'quantity' as const, emoji: '🔢', label: t('custom.quantity') },
    { value: 'duration' as const, emoji: '⏱️', label: t('custom.duration') },
  ];

  const handleSave = async () => {
    const normalizedName = name.trim();
    const normalizedUnit = unit.trim();
    if (!normalizedName) {
      Alert.alert(t('common.notice'), t('custom.requiredName'));
      return;
    }
    if (trackingMode === 'quantity' && !normalizedUnit) {
      Alert.alert(t('common.notice'), t('custom.requiredUnit'));
      return;
    }

    const parsedDefault = parsePositiveDecimal(defaultQuantity);
    if (defaultQuantity.trim() && parsedDefault == null) {
      Alert.alert(t('common.notice'), t('custom.invalidDefault'));
      return;
    }

    setBusy(true);
    try {
      const saved = await onSave({
        name: normalizedName,
        emoji: emoji.trim() || '⭐️',
        color,
        tracking_mode: trackingMode,
        unit: trackingMode === 'quantity' ? normalizedUnit : null,
        default_quantity: trackingMode === 'quantity' ? parsedDefault : null,
      });
      if (saved) onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = () => {
    if (!onArchive || busy) return;
    Alert.alert(t('custom.archiveTitle'), t('custom.archiveQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('custom.archive'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const archived = await onArchive();
            if (archived) onClose();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: isDark ? 'rgba(5,5,8,0.72)' : 'rgba(35,25,20,0.32)' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <BlurView
          intensity={isDark ? 40 : 70}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.panel, { backgroundColor: panelBackground, borderColor }]}
        >
          <View style={[styles.handle, { backgroundColor: borderColor }]} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.titleRow}>
              <Text allowFontScaling={false} style={styles.previewEmoji}>{emoji.trim() || '⭐️'}</Text>
              <View style={styles.titleCopy}>
                <Text style={[styles.title, { color: textPrimary }]}>
                  {initialValue ? t('custom.editTitle') : t('custom.newTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: textSecondary }]}>{t('custom.definitionHint')}</Text>
              </View>
            </View>

            <Text style={[styles.label, { color: textPrimary }]}>{t('custom.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={40}
              placeholder={t('custom.namePlaceholder')}
              placeholderTextColor={textSecondary}
              style={[styles.input, { color: textPrimary, backgroundColor: fieldBackground, borderColor }]}
            />

            <Text style={[styles.label, { color: textPrimary }]}>{t('custom.emoji')}</Text>
            <TextInput
              value={emoji}
              onChangeText={setEmoji}
              maxLength={32}
              placeholder="⭐️"
              placeholderTextColor={textSecondary}
              style={[styles.input, styles.emojiInput, { color: textPrimary, backgroundColor: fieldBackground, borderColor }]}
            />
            <Text style={[styles.fieldHint, { color: textSecondary }]}>{t('custom.emojiHint')}</Text>
            <View style={styles.emojiRow}>
              {EMOJI_SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={[
                    styles.emojiChip,
                    { backgroundColor: fieldBackground, borderColor },
                    emoji === suggestion && { borderColor: color, borderWidth: 2 },
                  ]}
                  onPress={() => setEmoji(suggestion)}
                >
                  <Text allowFontScaling={false} style={styles.emojiChipText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: textPrimary }]}>{t('custom.tracking')}</Text>
            <View style={styles.segmentRow}>
              {trackingOptions.map((option) => {
                const selected = trackingMode === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.segment,
                      {
                        backgroundColor: selected ? color : fieldBackground,
                        borderColor: selected ? color : borderColor,
                      },
                    ]}
                    onPress={() => setTrackingMode(option.value)}
                  >
                    <Text allowFontScaling={false} style={styles.segmentEmoji}>{option.emoji}</Text>
                    <Text style={[styles.segmentLabel, { color: selected ? '#FFFFFF' : textSecondary }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {trackingMode === 'quantity' ? (
              <>
                <Text style={[styles.label, { color: textPrimary }]}>{t('custom.unit')}</Text>
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  maxLength={20}
                  placeholder={t('custom.unitPlaceholder')}
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { color: textPrimary, backgroundColor: fieldBackground, borderColor }]}
                />
                <View style={styles.chipRow}>
                  {UNIT_SUGGESTIONS.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      style={[styles.chip, { backgroundColor: fieldBackground, borderColor }]}
                      onPress={() => setUnit(suggestion)}
                    >
                      <Text style={[styles.chipText, { color: textSecondary }]}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: textPrimary }]}>{t('custom.defaultQuantity')}</Text>
                <TextInput
                  value={defaultQuantity}
                  onChangeText={setDefaultQuantity}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder={t('custom.defaultQuantityPlaceholder')}
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { color: textPrimary, backgroundColor: fieldBackground, borderColor }]}
                />
              </>
            ) : null}

            <Text style={[styles.label, { color: textPrimary }]}>{t('custom.color')}</Text>
            <View style={styles.colorRow}>
              {COLORS.map((item) => (
                <TouchableOpacity
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={item}
                  onPress={() => setColor(item)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: item },
                    color === item && styles.colorDotSelected,
                  ]}
                >
                  {color === item ? <Text style={styles.colorCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.bottomBar, { borderTopColor: borderColor }]}>
            {initialValue && onArchive ? (
              <TouchableOpacity style={styles.archiveButton} onPress={handleArchive} disabled={busy}>
                <Text style={styles.archiveText}>{t('custom.archive')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.cancelButton, { borderColor }]} onPress={onClose} disabled={busy}>
                <Text style={[styles.cancelText, { color: textSecondary }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: color }, busy && styles.disabled]}
              onPress={handleSave}
              disabled={busy}
            >
              <Text style={styles.saveText}>{t('custom.save')}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    maxHeight: '92%',
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 9 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  previewEmoji: { fontSize: 38 },
  titleCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  label: { fontSize: 14, fontWeight: '800', marginTop: 7 },
  input: { minHeight: 48, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  emojiInput: { fontSize: 24 },
  fieldHint: { fontSize: 12, lineHeight: 17 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiChip: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emojiChipText: { fontSize: 22 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 72, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  segmentEmoji: { fontSize: 20 },
  segmentLabel: { fontSize: 12, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 },
  colorDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  colorDotSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  colorCheck: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  bottomBar: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 28 : 18 },
  cancelButton: { flex: 1, minHeight: 50, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '800' },
  archiveButton: { flex: 1, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(226,85,85,0.12)' },
  archiveText: { color: '#E25555', fontSize: 15, fontWeight: '800' },
  saveButton: { flex: 1.3, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
