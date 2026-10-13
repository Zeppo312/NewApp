import { ActionButton } from '@/components/ui/action-button';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@/components/ui/DateTimePicker';
import {
  FormField,
  FormSection,
  FormSheet,
  FormTextInput,
} from '@/components/ui/form-sheet';
import { FormColors } from '@/constants/Colors';
import { TYPOGRAPHY } from '@/constants/Typography';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { DailyEntry } from '@/lib/baby';
import { CustomActivityType } from '@/lib/customActivities';
import { getDailyLocaleTag, translateDailyText } from '@/lib/dailyTranslations';

export type CustomActivityEntryPayload = {
  start_time: string;
  end_time: string | null;
  notes: string | null;
  custom_quantity: number | null;
};

type Props = {
  visible: boolean;
  definition: Pick<
    CustomActivityType,
    'name' | 'emoji' | 'color' | 'tracking_mode' | 'unit' | 'default_quantity'
  > | null;
  useExactDate?: boolean;
  startTimerByDefault?: boolean;
  date: Date;
  initialData?: DailyEntry | null;
  onClose: () => void;
  onSave: (
    payload: CustomActivityEntryPayload,
    options: { startTimer: boolean },
  ) => Promise<boolean>;
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
  useExactDate = false,
  startTimerByDefault = false,
}: Props) {
  const { locale } = useLocale();

  const t = (key: Parameters<typeof translateDailyText>[1]) =>
    translateDailyText(locale, key);
  const localeTag = getDailyLocaleTag(locale);
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' ||
    adaptiveColors.isDarkBackground;
  const {
    secondary: textSecondary,
    field: fieldBackground,
    border: borderColor,
  } = FormColors[isDark ? 'dark' : 'light'];

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
      : useExactDate
        ? new Date(date)
        : combineDayAndClock(date, new Date());
    const start = Number.isFinite(initialStart.getTime())
      ? initialStart
      : combineDayAndClock(date, new Date());
    const initialEnd = initialData?.end_time
      ? new Date(initialData.end_time)
      : null;
    const duration =
      initialEnd && Number.isFinite(initialEnd.getTime())
        ? Math.max(
            1,
            Math.round((initialEnd.getTime() - start.getTime()) / 60000),
          )
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
    setStartTimer(
      definition.tracking_mode === 'duration' &&
        (initialData?.id ? !initialData.end_time : startTimerByDefault),
    );
    setPickerVisible(false);
    setBusy(false);
  }, [
    date,
    definition,
    initialData,
    visible,
    useExactDate,
    startTimerByDefault,
  ]);

  const formattedTime = useMemo(
    () =>
      startTime.toLocaleTimeString(localeTag, {
        hour: '2-digit',
        minute: '2-digit',
      }),
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
        endTime = new Date(
          startTime.getTime() + Math.round(parsedDuration * 60000),
        );
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
    <FormSheet
      visible={visible}
      isDark={isDark}
      title={definition.name}
      subtitle={initialData?.id ? t('custom.editEntry') : t('custom.newEntry')}
      onClose={onClose}
      onCancel={onClose}
      cancelLabel={t('common.cancel')}
      confirmLabel={startTimer ? t('custom.startTimer') : undefined}
      busy={busy}
      onConfirm={handleSave}
    >
      <FormSection isDark={isDark} label={t('custom.occurredAt')}>
        <FormField
          isDark={isDark}
          onPress={() => {
            setPickerDraft(startTime);
            setPickerVisible(true);
          }}
          value={`${startTime.toLocaleDateString(localeTag, { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${formattedTime}`}
        />
      </FormSection>

      {pickerVisible ? (
        <View
          style={[
            styles.pickerCard,
            { backgroundColor: fieldBackground, borderColor },
          ]}
        >
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
            <ActionButton
              label={t('common.done')}
              size="compact"
              isDark={isDark}
              style={styles.pickerDone}
              onPress={() => {
                commitPicker(undefined, pickerDraft);
                setPickerVisible(false);
              }}
            />
          ) : null}
        </View>
      ) : null}

      {definition.tracking_mode === 'quantity' ? (
        <>
          <FormSection isDark={isDark} label={t('custom.amount')}>
            <View style={styles.quantityField}>
              <FormTextInput
                isDark={isDark}
                style={{ flex: 1 }}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="0"
              />
              <Text style={[styles.unit, { color: textSecondary }]}>
                {definition.unit}
              </Text>
            </View>
          </FormSection>
        </>
      ) : null}

      {definition.tracking_mode === 'duration' ? (
        <>
          {!initialData?.id ? (
            <View style={styles.timerChoiceRow}>
              <TouchableOpacity
                style={[
                  styles.timerChoice,
                  {
                    backgroundColor: !startTimer
                      ? definition.color
                      : fieldBackground,
                    borderColor: !startTimer ? definition.color : borderColor,
                  },
                ]}
                onPress={() => setStartTimer(false)}
              >
                <Text
                  style={[
                    styles.timerChoiceText,
                    { color: !startTimer ? '#FFFFFF' : textSecondary },
                  ]}
                >
                  {t('custom.enterDuration')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.timerChoice,
                  {
                    backgroundColor: startTimer
                      ? definition.color
                      : fieldBackground,
                    borderColor: startTimer ? definition.color : borderColor,
                  },
                ]}
                onPress={() => setStartTimer(true)}
              >
                <Text
                  style={[
                    styles.timerChoiceText,
                    { color: startTimer ? '#FFFFFF' : textSecondary },
                  ]}
                >
                  {t('custom.startTimer')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {!startTimer ? (
            <>
              <FormSection isDark={isDark} label={t('custom.durationMinutes')}>
                <View
                  style={[
                    styles.quantityField,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                      padding: 0,
                    },
                  ]}
                >
                  <FormTextInput
                    isDark={isDark}
                    style={{ flex: 1 }}
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="15"
                  />
                  <Text style={[styles.unit, { color: textSecondary }]}>
                    {t('card.minutesShort')}
                  </Text>
                </View>
              </FormSection>
            </>
          ) : (
            <Text style={[styles.timerHint, { color: textSecondary }]}>
              {t('custom.timerHint')}
            </Text>
          )}
        </>
      ) : null}

      <FormSection isDark={isDark} label={t('input.notes')}>
        <FormTextInput
          isDark={isDark}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={500}
          placeholder={t('custom.notesPlaceholder')}
        />
      </FormSection>

      {initialData?.id && onDelete ? (
        <ActionButton
          variant="destructive"
          label={t('input.deleteEntry')}
          isDark={isDark}
          onPress={onDelete}
        />
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  label: { ...TYPOGRAPHY.label, alignSelf: 'flex-start' },

  pickerCard: { borderRadius: 22, borderWidth: 1, padding: 8 },
  pickerDone: { alignSelf: 'flex-end' },
  quantityField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  quantityInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: '600',
    paddingVertical: 10,
  },
  unit: { flexShrink: 1, fontSize: 16, fontWeight: '600', paddingLeft: 10 },
  timerChoiceRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  timerChoice: {
    flex: 1,
    minHeight: 48,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  timerChoiceText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  timerHint: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  notes: {
    minHeight: 92,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 15,
  },
});
