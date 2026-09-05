import React, { useEffect, useMemo, useState } from 'react';
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';

import { Colors } from '@/constants/Colors';
import { RADIUS } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLocale } from '@/contexts/LocaleContext';
import { CustomActivityType } from '@/lib/customActivities';
import { DailyEntry } from '@/lib/baby';
import { getDailyLocaleTag, translateDailyText } from '@/lib/dailyTranslations';

export type CustomActivityEntryPayload = {
  start_time: string;
  end_time: string | null;
  notes: string | null;
  custom_quantity: number | null;
};

type Props = {
  visible: boolean;
  definition: CustomActivityType | null;
  date: Date;
  initialData?: DailyEntry | null;
  onClose: () => void;
  onSave: (payload: CustomActivityEntryPayload, options: { startTimer: boolean }) => Promise<boolean>;
  onDelete?: () => void;
};

const combineDayAndClock = (day: Date, clock: Date) => {
  const next = new Date(day);
  next.setHours(clock.getHours(), clock.getMinutes(), 0, 0);
  return next;
};

const parsePositiveDecimal = (raw: string): number | null => {
  const parsed = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default function CustomActivityEntryModal({
  visible,
  definition,
  date,
  initialData,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateDailyText>[1]) => translateDailyText(locale, key);
  const localeTag = getDailyLocaleTag(locale);
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#342824';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const panelBackground = isDark ? 'rgba(35,31,32,0.97)' : 'rgba(248,245,241,0.98)';
  const fieldBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.78)';
  const borderColor = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(125,90,80,0.14)';

  const [startTime, setStartTime] = useState(new Date());
  const [quantity, setQuantity] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('15');
  const [notes, setNotes] = useState('');
  const [startTimer, setStartTimer] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDraft, setPickerDraft] = useState(new Date());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !definition) return;
    const initialStart = initialData?.start_time
      ? new Date(initialData.start_time)
      : combineDayAndClock(date, new Date());
    const start = Number.isFinite(initialStart.getTime()) ? initialStart : combineDayAndClock(date, new Date());
    const initialEnd = initialData?.end_time ? new Date(initialData.end_time) : null;
    const duration = initialEnd && Number.isFinite(initialEnd.getTime())
      ? Math.max(1, Math.round((initialEnd.getTime() - start.getTime()) / 60000))
      : 15;

    setStartTime(start);
    setPickerDraft(start);
    setQuantity(
      initialData?.custom_quantity != null
        ? String(initialData.custom_quantity).replace('.', ',')
        : definition.default_quantity != null
          ? String(definition.default_quantity).replace('.', ',')
          : '',
    );
    setDurationMinutes(String(duration));
    setNotes(initialData?.notes ?? '');
    setStartTimer(definition.tracking_mode === 'duration' && !!initialData?.id && !initialData.end_time);
    setPickerVisible(false);
    setBusy(false);
  }, [date, definition, initialData, visible]);

  const formattedTime = useMemo(
    () => startTime.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' }),
    [localeTag, startTime],
  );

  const commitPicker = (event?: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') setPickerVisible(false);
    if (event?.type === 'dismissed') return;
    const picked = value ?? pickerDraft;
    setPickerDraft(picked);
    setStartTime(combineDayAndClock(date, picked));
  };

  const handleSave = async () => {
    if (!definition) return;
    let parsedQuantity: number | null = null;
    if (definition.tracking_mode === 'quantity') {
      parsedQuantity = parsePositiveDecimal(quantity);
      if (parsedQuantity == null) {
        Alert.alert(t('common.notice'), t('custom.invalidQuantity'));
        return;
      }
    }

    let endTime: Date | null = startTime;
    if (definition.tracking_mode === 'duration') {
      if (startTimer) {
        endTime = null;
      } else {
        const parsedDuration = parsePositiveDecimal(durationMinutes);
        if (parsedDuration == null) {
          Alert.alert(t('common.notice'), t('custom.invalidDuration'));
          return;
        }
        endTime = new Date(startTime.getTime() + Math.round(parsedDuration * 60000));
      }
    }

    setBusy(true);
    try {
      const saved = await onSave(
        {
          start_time: startTime.toISOString(),
          end_time: endTime?.toISOString() ?? null,
          notes: notes.trim() || null,
          custom_quantity: parsedQuantity,
        },
        { startTimer: definition.tracking_mode === 'duration' && startTimer },
      );
      if (saved) onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!definition) return null;

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
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Text allowFontScaling={false} style={styles.headerEmoji}>{definition.emoji}</Text>
              <Text style={[styles.title, { color: textPrimary }]}>{definition.name}</Text>
              <Text style={[styles.subtitle, { color: textSecondary }]}>
                {initialData?.id ? t('custom.editEntry') : t('custom.newEntry')}
              </Text>
            </View>

            <Text style={[styles.label, { color: textPrimary }]}>{t('custom.occurredAt')}</Text>
            <TouchableOpacity
              style={[styles.timeButton, { backgroundColor: fieldBackground, borderColor }]}
              onPress={() => {
                setPickerDraft(startTime);
                setPickerVisible(true);
              }}
            >
              <Text style={[styles.timeDay, { color: textSecondary }]}>
                {startTime.toLocaleDateString(localeTag, { weekday: 'short', day: '2-digit', month: '2-digit' })}
              </Text>
              <Text style={[styles.timeValue, { color: definition.color }]}>{formattedTime}</Text>
            </TouchableOpacity>

            {pickerVisible ? (
              <View style={[styles.pickerCard, { backgroundColor: fieldBackground, borderColor }]}>
                <DateTimePicker
                  value={pickerDraft}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, value) => {
                    if (value) setPickerDraft(value);
                    commitPicker(event, value);
                  }}
                />
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity
                    style={[styles.pickerDone, { backgroundColor: definition.color }]}
                    onPress={() => {
                      commitPicker(undefined, pickerDraft);
                      setPickerVisible(false);
                    }}
                  >
                    <Text style={styles.pickerDoneText}>{t('common.done')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {definition.tracking_mode === 'quantity' ? (
              <>
                <Text style={[styles.label, { color: textPrimary }]}>{t('custom.amount')}</Text>
                <View style={[styles.quantityField, { backgroundColor: fieldBackground, borderColor }]}>
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="0"
                    placeholderTextColor={textSecondary}
                    style={[styles.quantityInput, { color: textPrimary }]}
                  />
                  <Text style={[styles.unit, { color: textSecondary }]}>{definition.unit}</Text>
                </View>
              </>
            ) : null}

            {definition.tracking_mode === 'duration' ? (
              <>
                {!initialData?.id ? (
                  <View style={styles.timerChoiceRow}>
                    <TouchableOpacity
                      style={[
                        styles.timerChoice,
                        { backgroundColor: !startTimer ? definition.color : fieldBackground, borderColor: !startTimer ? definition.color : borderColor },
                      ]}
                      onPress={() => setStartTimer(false)}
                    >
                      <Text style={[styles.timerChoiceText, { color: !startTimer ? '#FFFFFF' : textSecondary }]}>
                        {t('custom.enterDuration')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.timerChoice,
                        { backgroundColor: startTimer ? definition.color : fieldBackground, borderColor: startTimer ? definition.color : borderColor },
                      ]}
                      onPress={() => setStartTimer(true)}
                    >
                      <Text style={[styles.timerChoiceText, { color: startTimer ? '#FFFFFF' : textSecondary }]}>
                        {t('custom.startTimer')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {!startTimer ? (
                  <>
                    <Text style={[styles.label, { color: textPrimary }]}>{t('custom.durationMinutes')}</Text>
                    <View style={[styles.quantityField, { backgroundColor: fieldBackground, borderColor }]}>
                      <TextInput
                        value={durationMinutes}
                        onChangeText={setDurationMinutes}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        placeholder="15"
                        placeholderTextColor={textSecondary}
                        style={[styles.quantityInput, { color: textPrimary }]}
                      />
                      <Text style={[styles.unit, { color: textSecondary }]}>{t('card.minutesShort')}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={[styles.timerHint, { color: textSecondary }]}>{t('custom.timerHint')}</Text>
                )}
              </>
            ) : null}

            <Text style={[styles.label, { color: textPrimary }]}>{t('input.notes')}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={500}
              placeholder={t('custom.notesPlaceholder')}
              placeholderTextColor={textSecondary}
              style={[styles.notes, { color: textPrimary, backgroundColor: fieldBackground, borderColor }]}
            />

            {initialData?.id && onDelete ? (
              <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                <Text style={styles.deleteText}>{t('input.deleteEntry')}</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <View style={[styles.bottomBar, { borderTopColor: borderColor }]}>
            <TouchableOpacity style={[styles.cancelButton, { borderColor }]} onPress={onClose} disabled={busy}>
              <Text style={[styles.cancelText, { color: textSecondary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: definition.color }, busy && styles.disabled]}
              onPress={handleSave}
              disabled={busy}
            >
              <Text style={styles.saveText}>
                {startTimer ? t('custom.startTimer') : t('custom.saveEntry')}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  panel: { maxHeight: '92%', borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, borderWidth: 1, overflow: 'hidden' },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 9 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, gap: 10 },
  header: { alignItems: 'center', marginBottom: 4 },
  headerEmoji: { fontSize: 38 },
  title: { fontSize: 21, fontWeight: '900', marginTop: 4 },
  subtitle: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  label: { fontSize: 14, fontWeight: '800', marginTop: 8 },
  timeButton: { minHeight: 72, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, justifyContent: 'center' },
  timeDay: { fontSize: 12, fontWeight: '700' },
  timeValue: { fontSize: 25, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  pickerCard: { borderRadius: 16, borderWidth: 1, padding: 8 },
  pickerDone: { alignSelf: 'flex-end', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  pickerDoneText: { color: '#FFFFFF', fontWeight: '800' },
  quantityField: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  quantityInput: { flex: 1, fontSize: 22, fontWeight: '800', paddingVertical: 10 },
  unit: { fontSize: 16, fontWeight: '800', paddingLeft: 10 },
  timerChoiceRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  timerChoice: { flex: 1, minHeight: 48, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  timerChoiceText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  timerHint: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  notes: { minHeight: 92, borderRadius: 16, borderWidth: 1, padding: 14, textAlignVertical: 'top', fontSize: 15 },
  deleteButton: { alignItems: 'center', paddingVertical: 13 },
  deleteText: { color: '#E25555', fontSize: 14, fontWeight: '800' },
  bottomBar: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 28 : 18 },
  cancelButton: { flex: 1, minHeight: 50, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '800' },
  saveButton: { flex: 1.4, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.55 },
});
