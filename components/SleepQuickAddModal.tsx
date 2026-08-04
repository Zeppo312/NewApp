import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { Colors } from '@/constants/Colors';
import { RADIUS } from '@/constants/DesignGuide';
import { getSafePickerDate } from '@/lib/safeDate';
import { useLocale } from '@/contexts/LocaleContext';

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
  initialStart?: Date;
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
const TimePickerField = ({
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
  const [showAndroid, setShowAndroid] = useState(false);
  const [draft, setDraft] = useState<Date>(resolvePickerDate(time));

  useEffect(() => {
    if (!showIOS) setDraft(resolvePickerDate(time));
  }, [showIOS, time]);

  const commit = useCallback(() => {
    onConfirm(draft);
    setShowIOS(false);
  }, [draft, onConfirm]);

  const cardBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.50)';

  return (
    <>
      <TouchableOpacity
        style={[styles.timeCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={() => {
          setDraft(resolvePickerDate(time));
          if (Platform.OS === 'ios') setShowIOS(true);
          else setShowAndroid(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.timeCardLabel, { color: textSecondary }]}>{label}</Text>
        {time ? (
          <>
            <Text style={[styles.timeCardDay, { color: textSecondary }]}>
              {formatShortDayDate(time, localeTag)}
            </Text>
            <Text style={[styles.timeCardValue, { color: accentColor }]}>
              {formatClockTime(time, localeTag)}
            </Text>
          </>
        ) : (
          <Text style={[styles.timeCardPlaceholder, { color: textSecondary }]}>
            {placeholder ?? tapLabel}
          </Text>
        )}
      </TouchableOpacity>

      {/* iOS – spinner modal am unteren Bildschirmrand */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showIOS}
          transparent
          animationType="fade"
          onRequestClose={() => { commit(); }}
        >
          <View style={styles.pickerOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={commit}
              activeOpacity={1}
            />
            <View style={[
              styles.pickerCard,
              {
                backgroundColor: isDark ? 'rgba(24,24,28,0.97)' : 'rgba(255,255,255,0.98)',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              },
            ]}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity
                  onPress={() => setShowIOS(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.pickerAction, { color: textSecondary }]}>{cancelLabel}</Text>
                </TouchableOpacity>
                <Text style={[styles.pickerTitle, { color: textPrimary }]}>{label}</Text>
                <TouchableOpacity
                  onPress={commit}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.pickerAction, { color: accentColor }]}>{doneLabel}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={resolvePickerDate(draft)}
                mode="datetime"
                display="spinner"
                locale={localeTag}
                onChange={(_, d) => { if (d) setDraft(d); }}
                accentColor={accentColor}
                themeVariant={isDark ? 'dark' : 'light'}
                style={styles.spinner}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android – native picker */}
      {Platform.OS !== 'ios' && showAndroid && (
        <DateTimePicker
          value={resolvePickerDate(time)}
          mode="datetime"
          is24Hour
          onChange={(_, d) => {
            setShowAndroid(false);
            if (d) onConfirm(d);
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
  onClose,
  onSave,
}) => {
  const { locale, localeTag } = useLocale();
  const c = {
    de: { cancel: 'Abbrechen', done: 'Fertig', tap: 'Tippen zum Eingeben', title: 'Schlaf hinzufügen', subtitle: 'Zeitraum und Qualität festhalten', period: '⏰ Zeitraum', asleep: 'Eingeschlafen', awake: 'Aufgewacht', open: 'Offen', quality: '😴 Schlafqualität', good: 'Gut', medium: 'Mittel', bad: 'Schlecht', notes: '📝 Notizen', notesPlaceholder: 'Optionale Notiz hinzufügen…', save: 'Speichern' },
    en: { cancel: 'Cancel', done: 'Done', tap: 'Tap to enter', title: 'Add sleep', subtitle: 'Record the time and quality', period: '⏰ Time period', asleep: 'Fell asleep', awake: 'Woke up', open: 'Ongoing', quality: '😴 Sleep quality', good: 'Good', medium: 'Okay', bad: 'Poor', notes: '📝 Notes', notesPlaceholder: 'Add an optional note…', save: 'Save' },
    es: { cancel: 'Cancelar', done: 'Listo', tap: 'Toca para introducir', title: 'Añadir sueño', subtitle: 'Registra el horario y la calidad', period: '⏰ Periodo', asleep: 'Se durmió', awake: 'Se despertó', open: 'En curso', quality: '😴 Calidad del sueño', good: 'Buena', medium: 'Regular', bad: 'Mala', notes: '📝 Notas', notesPlaceholder: 'Añade una nota opcional…', save: 'Guardar' },
  }[locale];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentColor = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  const overlayColor = isDark ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.35)';
  const panelColor = isDark ? 'rgba(10,10,12,0.86)' : 'transparent';
  const panelBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'transparent';
  const sectionBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  const [startTime, setStartTime] = useState<Date>(() => resolvePickerDate(initialStart));
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [quality, setQuality] = useState<SleepQuality>('good');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setStartTime(resolvePickerDate(initialStart));
      setEndTime(null);
      setQuality('good');
      setNotes('');
    }
  }, [visible, initialStart?.valueOf()]);

  const handleSave = () => {
    onSave({ start: startTime, end: endTime, quality, notes: notes.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

        <BlurView
          style={[
            styles.panel,
            {
              backgroundColor: panelColor,
              borderTopWidth: isDark ? 1 : 0,
              borderTopColor: panelBorderColor,
            },
          ]}
          tint={isDark ? 'dark' : 'extraLight'}
          intensity={80}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerEmoji}>😴</Text>
              <Text style={[styles.headerTitle, { color: textPrimary }]}>{c.title}</Text>
              <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                {c.subtitle}
              </Text>
            </View>

            {/* Zeit */}
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>{c.period}</Text>
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

            {/* Qualität */}
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>{c.quality}</Text>
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
                          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(230,230,230,0.85)',
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

            {/* Notizen */}
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>{c.notes}</Text>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: sectionBg,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  color: textPrimary,
                },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder={c.notesPlaceholder}
              placeholderTextColor={textSecondary}
              multiline
            />
          </ScrollView>

          {/* Bottom bar */}
          <View
            style={[
              styles.bottomBar,
              { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ]}
          >
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: textSecondary }]}>{c.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accentColor }]}
              onPress={handleSave}
              activeOpacity={0.7}
            >
              <Text style={styles.saveBtnText}>{c.save}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  scroll: { flex: 1 },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerEmoji: { fontSize: 28, marginBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 4, opacity: 0.7 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  timeCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 80,
    justifyContent: 'center',
  },
  timeCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.6,
    marginBottom: 4,
  },
  timeCardDay: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  timeCardValue: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },
  timeCardPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.45,
    fontStyle: 'italic',
  },
  // Picker modal (bottom)
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTitle: { fontSize: 15, fontWeight: '700' },
  pickerAction: { fontSize: 15, fontWeight: '600' },
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
  notesInput: {
    minHeight: 80,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

export default SleepQuickAddModal;
