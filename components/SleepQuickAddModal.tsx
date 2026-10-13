import DateTimePicker from '@/components/ui/DateTimePicker';
import { FormField,FormSection,FormSheet,FormTextInput } from '@/components/ui/form-sheet';
import { Colors } from '@/constants/Colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { getSafePickerDate } from '@/lib/safeDate';
import React,{ useCallback,useEffect,useState } from 'react';
import {
Platform,
StyleSheet,
Text,
TouchableOpacity,
View
} from 'react-native';

const ACCENT_LIGHT = '#8E4EC6';
const ACCENT_DARK = '#A26BFF';

export type SleepQuality = 'good' | 'medium' | 'bad' | null;

export type SleepQuickEntry = {
  start: Date;
  end: Date | null;
  quality: SleepQuality;
  notes: string;
};

type Props = {
  visible: boolean;
  saving?: boolean;
  initialStart?: Date;
  initialEntry?: SleepQuickEntry;
  onDelete?: () => void;
  onClose: () => void;
  onSave: (entry: SleepQuickEntry) => void;
};

const formatClockTime = (date: Date, localeTag: string) =>
  date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });

const formatShortDayDate = (date: Date, localeTag: string) =>
  date.toLocaleDateString(localeTag, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

const resolvePickerDate = (value?: Date | null, fallback?: Date) =>
  getSafePickerDate(value, fallback ?? new Date());

// ─── Reusable time picker button + modal ────────────────────
export const TimePickerField = ({
  label,
  time,
  onConfirm,
  accentColor,
  isDark,
  textPrimary,
  textSecondary,
  placeholder,
  localeTag,
  cancelLabel,
  doneLabel,
  tapLabel,
}: {
  label: string;
  time: Date | null;
  onConfirm: (date: Date) => void;
  accentColor: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  placeholder?: string;
  localeTag: string;
  cancelLabel: string;
  doneLabel: string;
  tapLabel: string;
}) => {
  const [showIOS, setShowIOS] = useState(false);

  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  const [draft, setDraft] = useState<Date>(resolvePickerDate(time));

  useEffect(() => {
    if (!showIOS) setDraft(resolvePickerDate(time));
  }, [showIOS, time]);

  const commit = useCallback(() => {
    onConfirm(draft);
    setShowIOS(false);
  }, [draft, onConfirm]);

  return (
    <>
      <FormField isDark={isDark} label={label}
 value={time ? formatShortDayDate(time, localeTag) + ' · ' + formatClockTime(time, localeTag) : undefined}
 placeholder={placeholder ?? tapLabel} onPress={() => {
          setDraft(resolvePickerDate(time));
          if (Platform.OS === 'ios') setShowIOS(true);
          else setAndroidStep('date');
        }} />

      {/* iOS – spinner modal am unteren Bildschirmrand */}
      {Platform.OS === 'ios' && (
        <FormSheet
            visible={showIOS}
            isDark={isDark}
            title={label}
            onClose={() => setShowIOS(false)}
            onCancel={() => setShowIOS(false)}
            cancelLabel={cancelLabel}
            confirmLabel={doneLabel}
            onConfirm={commit}
            scrollable={false}
          >
            <DateTimePicker
              value={resolvePickerDate(draft)}
              mode="datetime"
              display="spinner"
              locale={localeTag}
              onChange={(_, d) => {
                if (d) setDraft(d);
              }}
              accentColor={accentColor}
              themeVariant={isDark ? 'dark' : 'light'}
              style={styles.spinner}
            />
          </FormSheet>
      )}

      {/* Android – native picker */}
      {Platform.OS === 'android' && androidStep && (
        <DateTimePicker
          key={androidStep}
          value={resolvePickerDate(draft)}
          mode={androidStep}
          is24Hour
          onChange={(event, d) => {
            if (event.type === 'dismissed' || !d) { setAndroidStep(null); return; }
            if (androidStep === 'date') {
              setDraft(d);
              setAndroidStep('time');
            } else {
              setAndroidStep(null);
              onConfirm(d);
            }
          }}
        />
      )}
    </>
  );
};

// ─── Main Modal ─────────────────────────────────────────────
const SleepQuickAddModal: React.FC<Props> = ({
  visible,
  initialStart,
  initialEntry,
  onDelete,
  onClose,
  onSave,
  saving = false,
}) => {
  const { locale, localeTag } = useLocale();
  const c = {
    de: { cancel: 'Abbrechen', done: 'Fertig', tap: 'Tippen zum Eingeben', editTitle: 'Schlaf bearbeiten', delete: 'Eintrag löschen', title: 'Schlaf hinzufügen', subtitle: 'Zeitraum und Qualität festhalten', period: '⏰ Zeitraum', asleep: 'Eingeschlafen', awake: 'Aufgewacht', open: 'Offen', quality: '😴 Schlafqualität', good: 'Gut', medium: 'Mittel', bad: 'Schlecht', notes: '📝 Notizen', notesPlaceholder: 'Optionale Notiz hinzufügen…', save: 'Speichern' },
    en: { cancel: 'Cancel', done: 'Done', tap: 'Tap to enter', editTitle: 'Edit sleep', delete: 'Delete entry', title: 'Add sleep', subtitle: 'Record the time and quality', period: '⏰ Time period', asleep: 'Fell asleep', awake: 'Woke up', open: 'Ongoing', quality: '😴 Sleep quality', good: 'Good', medium: 'Okay', bad: 'Poor', notes: '📝 Notes', notesPlaceholder: 'Add an optional note…', save: 'Save' },
    es: { cancel: 'Cancelar', done: 'Listo', tap: 'Toca para introducir', editTitle: 'Editar sueño', delete: 'Eliminar registro', title: 'Añadir sueño', subtitle: 'Registra el horario y la calidad', period: '⏰ Periodo', asleep: 'Se durmió', awake: 'Se despertó', open: 'En curso', quality: '😴 Calidad del sueño', good: 'Buena', medium: 'Regular', bad: 'Mala', notes: '📝 Notas', notesPlaceholder: 'Añade una nota opcional…', save: 'Guardar' },
  }[locale];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentColor = isDark ? ACCENT_DARK : ACCENT_LIGHT;

  const [startTime, setStartTime] = useState<Date>(() => resolvePickerDate(initialStart));
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [quality, setQuality] = useState<SleepQuality>('good');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setStartTime(resolvePickerDate(initialEntry?.start ?? initialStart));
      setEndTime(initialEntry?.end ?? null);
      setQuality(initialEntry ? initialEntry.quality : 'good');
      setNotes(initialEntry?.notes ?? '');
    }
  }, [visible, initialStart?.valueOf(), initialEntry?.start.valueOf(), initialEntry?.end?.valueOf(), initialEntry?.quality, initialEntry?.notes]);

  const handleSave = () => {
    onSave({ start: startTime, end: endTime, quality, notes: notes.trim() });
  };

  return (
    <FormSheet
        visible={visible}
        isDark={isDark}
        title={initialEntry ? c.editTitle : c.title}
        subtitle={c.subtitle}
        onClose={onClose}
        onCancel={onClose}
        cancelLabel={c.cancel}
        confirmLabel={c.save}
        busy={saving}
        onConfirm={handleSave}
      >
        {/* Header */}

        {/* Zeit */}

        <FormSection isDark={isDark} label={c.period}>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <TimePickerField
                label={c.asleep}
                time={startTime}
                onConfirm={setStartTime}
                accentColor={accentColor}
                isDark={isDark}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                localeTag={localeTag}
                cancelLabel={c.cancel}
                doneLabel={c.done}
                tapLabel={c.tap}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TimePickerField
                label={c.awake}
                time={endTime}
                onConfirm={setEndTime}
                accentColor={accentColor}
                isDark={isDark}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                placeholder={c.open}
                localeTag={localeTag}
                cancelLabel={c.cancel}
                doneLabel={c.done}
                tapLabel={c.tap}
              />
            </View>
          </View>
        </FormSection>

        {/* Qualität */}

        <FormSection isDark={isDark} label={c.quality}>
          <View style={styles.qualityRow}>
            {(['good', 'medium', 'bad'] as SleepQuality[]).map((item) => {
              const isActive = quality === item;
              const bg = item === 'good' ? '#38A169' : item === 'medium' ? '#F5A623' : '#E53E3E';
              const icon = item === 'good' ? '😴' : item === 'medium' ? '😐' : '😵';
              const lbl = item === 'good' ? c.good : item === 'medium' ? c.medium : c.bad;
              return (
                <TouchableOpacity
                  key={item ?? 'none'}
                  style={[
                    styles.qualityBtn,
                    {
                      backgroundColor: isActive
                        ? bg
                        : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(230,230,230,0.85)',
                    },
                  ]}
                  onPress={() => setQuality(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qualityIcon}>{icon}</Text>
                  <Text style={[styles.qualityLabel, { color: isActive ? '#FFF' : textSecondary }]}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FormSection>

        {/* Notizen */}

        <FormSection isDark={isDark} label={c.notes}>
          <FormTextInput
            isDark={isDark}
            value={notes}
            onChangeText={setNotes}
            placeholder={c.notesPlaceholder}
            multiline
          />
        </FormSection>

        {onDelete && (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={onDelete}
            style={{
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              marginVertical: 12,
            }}
          >
            <Text style={{ color: '#E05263', fontWeight: '600' }}>{c.delete}</Text>
          </TouchableOpacity>
        )}
      </FormSheet>
  );
};

const styles = StyleSheet.create({

  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },

  // Picker modal (bottom)

  spinner: { marginTop: 4, height: 180 },
  // Quality
  qualityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  qualityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
  },
  qualityIcon: { fontSize: 22 },
  qualityLabel: { fontSize: 13, fontWeight: '600' },
  // Notes

});

export default SleepQuickAddModal;
