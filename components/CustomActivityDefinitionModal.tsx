import { ActionButton } from '@/components/ui/action-button';
import {
  FormSection,
  FormSheet,
  FormTextInput,
} from '@/components/ui/form-sheet';
import { FormColors } from '@/constants/Colors';
import { TYPOGRAPHY } from '@/constants/Typography';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import {
  CustomActivityType,
  CustomActivityTypeDraft,
  CustomTrackingMode,
} from '@/lib/customActivities';
import { translateDailyText } from '@/lib/dailyTranslations';

const COLORS = [
  '#5E3DB3',
  '#4A90E2',
  '#35B6B4',
  '#38A169',
  '#F5A623',
  '#E25555',
];
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

  const t = (key: Parameters<typeof translateDailyText>[1]) =>
    translateDailyText(locale, key);
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' ||
    adaptiveColors.isDarkBackground;
  const {
    text: textPrimary,
    secondary: textSecondary,
    field: fieldBackground,
    border: borderColor,
  } = FormColors[isDark ? 'dark' : 'light'];

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
      initialValue?.default_quantity == null
        ? ''
        : String(initialValue.default_quantity).replace('.', ','),
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
    <FormSheet
      visible={visible}
      isDark={isDark}
      title={initialValue ? t('custom.editTitle') : t('custom.newTitle')}
      subtitle={t('custom.definitionHint')}
      onClose={onClose}
      onCancel={onClose}
      cancelLabel={t('common.cancel')}
      busy={busy}
      onConfirm={handleSave}
    >
      <FormSection isDark={isDark} label={t('custom.name')}>
        <FormTextInput
          isDark={isDark}
          value={name}
          onChangeText={setName}
          maxLength={40}
          placeholder={t('custom.namePlaceholder')}
        />
      </FormSection>

      <FormSection isDark={isDark} label={t('custom.emoji')}>
        <FormTextInput
          isDark={isDark}
          value={emoji}
          onChangeText={setEmoji}
          maxLength={32}
        />
      </FormSection>

      <Text style={[styles.fieldHint, { color: textSecondary }]}>
        {t('custom.emojiHint')}
      </Text>

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
            <Text allowFontScaling={false} style={styles.emojiChipText}>
              {suggestion}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FormSection isDark={isDark} label={t('custom.tracking')}>
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
                <Text allowFontScaling={false} style={styles.segmentEmoji}>
                  {option.emoji}
                </Text>
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: selected ? '#FFFFFF' : textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FormSection>

      {trackingMode === 'quantity' ? (
        <>
          <Text style={[styles.label, { color: textPrimary }]}>
            {t('custom.unit')}
          </Text>
          <FormTextInput
            isDark={isDark}
            value={unit}
            onChangeText={setUnit}
            maxLength={20}
            placeholder={t('custom.unitPlaceholder')}
          />
          <View style={styles.chipRow}>
            {UNIT_SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                style={[
                  styles.chip,
                  { backgroundColor: fieldBackground, borderColor },
                ]}
                onPress={() => setUnit(suggestion)}
              >
                <Text style={[styles.chipText, { color: textSecondary }]}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: textPrimary }]}>
            {t('custom.defaultQuantity')}
          </Text>
          <FormTextInput
            isDark={isDark}
            value={defaultQuantity}
            onChangeText={setDefaultQuantity}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={t('custom.defaultQuantityPlaceholder')}
          />
        </>
      ) : null}

      <FormSection isDark={isDark} label={t('custom.color')}>
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
      </FormSection>
      {initialValue && onArchive && (
        <ActionButton
          variant="destructive"
          isDark={isDark}
          disabled={busy}
          label={t('custom.archive')}
          onPress={handleArchive}
        />
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  label: { ...TYPOGRAPHY.label, alignSelf: 'flex-start' },

  fieldHint: { fontSize: 12, lineHeight: 17 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiChip: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChipText: { fontSize: 22 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    minHeight: 72,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  segmentEmoji: { fontSize: 20 },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 4,
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  colorCheck: { color: '#FFFFFF', fontWeight: '700', fontSize: 17 },
});
