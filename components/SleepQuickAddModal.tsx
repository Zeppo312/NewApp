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

const formatClockTime = (date: Date) =>
  date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const formatShortDayDate = (date: Date) =>
  date.toLocaleDateString('de-DE', {
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
}: {
  label: string;
  time: Date | null;
  onConfirm: (date: Date) => void;
  accentColor: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  placeholder?: string;
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
              {formatShortDayDate(time)}
            </Text>
            <Text style={[styles.timeCardValue, { color: accentColor }]}>
              {formatClockTime(time)}
            </Text>
          </>
        ) : (
          <Text style={[styles.timeCardPlaceholder, { color: textSecondary }]}>
            {placeholder ?? 'Tippen zum Eingeben'}
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
                  <Text style={[styles.pickerAction, { color: textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <Text style={[styles.pickerTitle, { color: textPrimary }]}>{label}</Text>
                <TouchableOpacity
                  onPress={commit}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.pickerAction, { color: accentColor }]}>Fertig</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={resolvePickerDate(draft)}
                mode="datetime"
                display="spinner"
                locale="de-DE"
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
              <Text style={[styles.headerTitle, { color: textPrimary }]}>Schlaf hinzufügen</Text>
              <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                Zeitraum und Qualität festhalten
              </Text>
            </View>

            {/* Zeit */}
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>⏰ Zeitraum</Text>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <TimePickerField
                  label="Eingeschlafen"
                  time={startTime}
                  onConfirm={setStartTime}
                  accentColor={accentColor}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimePickerField
                  label="Aufgewacht"
                  time={endTime}
                  onConfirm={setEndTime}
                  accentColor={accentColor}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  placeholder="Offen"
                />
              </View>
            </View>

            {/* Qualität */}
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>😴 Schlafqualität</Text>
            <View style={styles.qualityRow}>
              {(['good', 'medium', 'bad'] as SleepQuality[]).map((item) => {
                const isActive = quality === item;
                const bg = item === 'good' ? '#38A169' : item === 'medium' ? '#F5A623' : '#E53E3E';
                const icon = item === 'good' ? '😴' : item === 'medium' ? '😐' : '😵';
                const lbl = item === 'good' ? 'Gut' : item === 'medium' ? 'Mittel' : 'Schlecht';
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
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>📝 Notizen</Text>
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
              placeholder="Optionale Notiz hinzufügen..."
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
              <Text style={[styles.cancelBtnText, { color: textSecondary }]}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accentColor }]}
              onPress={handleSave}
              activeOpacity={0.7}
            >
              <Text style={styles.saveBtnText}>Speichern</Text>
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
