import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';

import { PRIMARY, GLASS_OVERLAY } from '@/constants/PlannerDesign';
import { PlannerAssignee } from '@/services/planner';

export type PlannerCaptureType = 'todo' | 'event' | 'note';

export type PlannerCapturePayload = {
  type: PlannerCaptureType;
  title: string;
  dueAt?: Date;
  start?: Date;
  end?: Date | null;
  location?: string;
  notes?: string;
  assignee?: PlannerAssignee;
};

type Props = {
  visible: boolean;
  type: PlannerCaptureType;
  baseDate: Date;
  onClose: () => void;
  onSave: (payload: PlannerCapturePayload) => void;
};

const THEME = {
  text: '#6B4C3B',
  textSecondary: '#A8978E',
  background: 'rgba(255,255,255,0.94)',
  accent: PRIMARY,
  field: 'rgba(255,255,255,0.75)',
  divider: 'rgba(0,0,0,0.08)',
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const PlannerCaptureModal: React.FC<Props> = ({ visible, type, baseDate, onClose, onSave }) => {
  const initialStart = useMemo(() => {
    const d = new Date(baseDate);
    d.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
    return d;
  }, [baseDate]);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showEnd, setShowEnd] = useState(type === 'event');
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [currentType, setCurrentType] = useState<PlannerCaptureType>(type);
  const [assignee, setAssignee] = useState<PlannerAssignee>('me');

  useEffect(() => {
    if (visible) {
      const reset = new Date(baseDate);
      reset.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
      setCurrentType(type);
      setTitle('');
      setNotes('');
      setStartTime(reset);
      setEndTime(type === 'event' ? new Date(reset.getTime() + 30 * 60000) : null);
      setShowEnd(type === 'event');
      setDueTime(type === 'todo' ? reset : null);
      setLocation('');
      setNotesExpanded(type === 'note');
      setAssignee('me');
      setShowStartPicker(false);
      setShowEndPicker(false);
      setShowDuePicker(false);
    }
  }, [visible, type, baseDate]);

  useEffect(() => {
    if (!visible) return;
    if (currentType === 'event') {
      if (!endTime) {
        setEndTime(new Date(startTime.getTime() + 30 * 60000));
      }
      setShowEnd(true);
    } else {
      setShowEnd(false);
      setDueTime(new Date(startTime));
    }
  }, [currentType, visible]);

  const toggleNotes = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotesExpanded((prev) => !prev);
  };

  const renderDateSelector = (
    label: string,
    value: Date,
    visible: boolean,
    toggle: () => void,
    onChange: (date: Date) => void,
  ) => (
    <View style={styles.pickerBlock}>
      <TouchableOpacity style={styles.selectorHeader} onPress={toggle} activeOpacity={0.8}>
        <Text style={styles.pickerLabel}>{label}</Text>
        <Text style={styles.selectorValue}>{formatDateTime(value)}</Text>
      </TouchableOpacity>
      {visible && (
        <View style={styles.pickerInner}>
          <DateTimePicker
            value={value}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
            onChange={(event, date) => {
              if (date) {
                onChange(date);
                if (Platform.OS !== 'ios' || event?.type === 'set') {
                  toggle();
                }
              } else if (Platform.OS !== 'ios' && event?.type === 'dismissed') {
                toggle();
              }
            }}
            style={styles.dateTimePicker}
          />
        </View>
      )}
    </View>
  );

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedNotes = notes.trim();

    if (currentType !== 'note' && trimmedTitle.length === 0) {
      return;
    }

    if (currentType === 'event' && (!startTime || (!endTime && showEnd))) {
      return;
    }

    const payload: PlannerCapturePayload = {
      type: currentType,
      title: currentType === 'note' ? (trimmedTitle || trimmedNotes || 'Notiz') : trimmedTitle,
      notes: trimmedNotes || undefined,
    };

    if (currentType === 'todo') {
      payload.dueAt = dueTime || undefined;
      payload.assignee = assignee;
    }

    if (currentType === 'event') {
      payload.start = startTime;
      payload.end = showEnd ? endTime : null;
      payload.location = location.trim() || undefined;
    }

    if (currentType === 'note') {
      payload.dueAt = dueTime || undefined;
    }

    onSave(payload);
    onClose();
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'Offen';
    return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <BlurView intensity={85} tint="extraLight" style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity style={[styles.roundButton, { backgroundColor: 'rgba(0,0,0,0.08)' }]} onPress={onClose}>
              <Text style={styles.roundButtonLabel}>✕</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>
                {currentType === 'todo' ? 'Neue Aufgabe' : currentType === 'event' ? 'Neuer Termin' : 'Notiz'}
              </Text>
              <Text style={styles.subtitle}>Details hinzufügen</Text>
            </View>
            <TouchableOpacity
              style={[styles.roundButton, { backgroundColor: PRIMARY }]}
              onPress={handleSave}
              accessibilityLabel="Speichern"
            >
              <Text style={[styles.roundButtonLabel, { color: '#fff' }]}>✓</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.contentWrapper}>
                <View style={styles.typeSwitchRow}>
                  {(['todo', 'event', 'note'] as PlannerCaptureType[]).map((btnType) => (
                    <TouchableOpacity
                      key={btnType}
                      style={[styles.typeSwitchButton, currentType === btnType && styles.typeSwitchButtonActive]}
                      onPress={() => setCurrentType(btnType)}
                    >
                      <Text style={[styles.typeSwitchLabel, currentType === btnType && styles.typeSwitchLabelActive]}>
                        {btnType === 'todo' ? 'Aufgabe' : btnType === 'event' ? 'Termin' : 'Notiz'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={currentType === 'note' ? 'Titel oder Betreff' : 'Titel'}
                  placeholderTextColor={THEME.textSecondary}
                  style={styles.titleInput}
                />

                {currentType === 'event' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>⏰ Zeitraum</Text>
                    {renderDateSelector('Start', startTime, showStartPicker, () => setShowStartPicker((prev) => !prev), (date) => {
                      setStartTime(date);
                      if (showEnd && endTime && endTime < date) {
                        setEndTime(new Date(date.getTime() + 30 * 60000));
                      }
                    })}
                    {showEnd && endTime ? (
                      <>
                        {renderDateSelector('Ende', endTime, showEndPicker, () => setShowEndPicker((prev) => !prev), setEndTime)}
                        <TouchableOpacity
                          style={styles.removeEndButton}
                          onPress={() => {
                            setShowEnd(false);
                            setEndTime(null);
                            setShowEndPicker(false);
                          }}
                        >
                          <Text style={styles.removeEndLabel}>Ende entfernen</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => {
                          const defaultEnd = new Date(startTime.getTime() + 30 * 60000);
                          setEndTime(defaultEnd);
                          setShowEnd(true);
                          setShowEndPicker(true);
                        }}
                      >
                        <Text style={styles.timeButtonLabel}>Ende hinzufügen</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.locationField}
                      onPress={() => {}}
                      activeOpacity={1}
                    >
                      <TextInput
                        value={location}
                        onChangeText={setLocation}
                        placeholder="Ort (optional)"
                        placeholderTextColor={THEME.textSecondary}
                        style={styles.locationInput}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {currentType !== 'event' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>🕒 Zeitpunkt</Text>
                    {renderDateSelector('Fällig', dueTime ?? startTime, showDuePicker, () => setShowDuePicker((prev) => !prev), (date) => setDueTime(date))}
                  </View>
                )}

                {currentType === 'todo' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>👥 Zuständig</Text>
                    <View style={styles.assignRow}>
                      {(['me', 'partner'] as PlannerAssignee[]).map((role) => (
                        <TouchableOpacity
                          key={role}
                          style={[styles.assignButton, assignee === role && styles.assignButtonActive]}
                          onPress={() => setAssignee(role)}
                        >
                          <Text style={[styles.assignLabel, assignee === role && styles.assignLabelActive]}>
                            {role === 'me' ? 'Ich' : 'Partner'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.section}>
                  <TouchableOpacity style={styles.notesHeader} onPress={toggleNotes}>
                    <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>📝 Notizen</Text>
                    <Text style={[styles.notesToggle, { transform: [{ rotate: notesExpanded ? '-90deg' : '90deg' }] }]}>
                      ›
                    </Text>
                  </TouchableOpacity>
                  {notesExpanded && (
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Details hinzufügen..."
                      placeholderTextColor={THEME.textSecondary}
                      multiline
                      style={styles.notesInput}
                    />
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </BlurView>

      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: THEME.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonLabel: {
    fontSize: 20,
    color: THEME.text,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    color: THEME.textSecondary,
  },
  contentWrapper: {
    paddingBottom: 32,
    gap: 24,
  },
  typeSwitchRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  typeSwitchButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  typeSwitchButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  typeSwitchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
  },
  typeSwitchLabelActive: {
    color: '#fff',
  },
  titleInput: {
    width: '100%',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: THEME.field,
    fontSize: 16,
    color: THEME.text,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  pickerBlock: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 12,
    gap: 8,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.textSecondary,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
  },
  pickerInner: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: Platform.OS === 'ios' ? 0 : 8,
  },
  dateTimePicker: {
    alignSelf: 'stretch',
  },
  timeButton: {
    borderRadius: 16,
    backgroundColor: THEME.field,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  timeButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  removeEndButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(94,61,179,0.08)',
  },
  removeEndLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },
  assignRow: {
    flexDirection: 'row',
    gap: 12,
  },
  assignButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  assignButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  assignLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
  },
  assignLabelActive: {
    color: '#fff',
  },
  locationField: {
    borderRadius: 16,
    backgroundColor: THEME.field,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  locationInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: THEME.text,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notesToggle: {
    fontSize: 20,
    color: THEME.textSecondary,
  },
  notesInput: {
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: THEME.field,
    color: THEME.text,
    borderWidth: 1,
    borderColor: GLASS_OVERLAY,
  },
});

export default PlannerCaptureModal;
