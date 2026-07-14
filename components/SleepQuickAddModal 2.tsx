import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';

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

const SleepQuickAddModal: React.FC<Props> = ({
  visible,
  initialStart,
  onClose,
  onSave,
}) => {
  const [startTime, setStartTime] = useState<Date>(initialStart ?? new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [quality, setQuality] = useState<SleepQuality>('good');
  const [notes, setNotes] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      const baseStart = initialStart ?? new Date();
      setStartTime(baseStart);
      setEndTime(null);
      setQuality('good');
      setNotes('');
      setShowStartPicker(false);
      setShowEndPicker(false);
    }
  }, [visible, initialStart?.valueOf()]);

  const handleSave = () => {
    onSave({
      start: startTime,
      end: endTime,
      quality,
      notes: notes.trim(),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

        <BlurView style={styles.modal} tint="extraLight" intensity={80}>
          <View style={styles.header}>
            <TouchableOpacity style={[styles.headerButton, styles.headerGhost]} onPress={onClose}>
              <Text style={styles.headerGhostText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Schlaf hinzufügen</Text>
              <Text style={styles.subtitle}>Zeitraum und Qualität festhalten</Text>
            </View>
            <TouchableOpacity style={[styles.headerButton, styles.headerPrimary]} onPress={handleSave}>
              <Text style={styles.headerPrimaryText}>✓</Text>
            </TouchableOpacity>
          </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1 }}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⏰ Zeitraum</Text>
                <View style={styles.timeRow}>
                  <TouchableOpacity style={styles.timeButton} onPress={() => setShowStartPicker(true)}>
                    <Text style={styles.timeLabel}>Start</Text>
                    <Text style={styles.timeValue}>
                      {startTime.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.timeButton} onPress={() => setShowEndPicker(true)}>
                    <Text style={styles.timeLabel}>Ende</Text>
                    <Text style={styles.timeValue}>
                      {endTime
                        ? endTime.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Offen'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showStartPicker && (
                  <View style={styles.pickerBlock}>
                    <DateTimePicker
                      value={startTime}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'compact' : 'default'}
                      onChange={(_, date) => {
                        if (date) setStartTime(date);
                      }}
                      style={styles.picker}
                    />
                    <View style={styles.pickerActions}>
                      <TouchableOpacity style={styles.pickerDone} onPress={() => setShowStartPicker(false)}>
                        <Text style={styles.pickerDoneText}>Fertig</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {showEndPicker && (
                  <View style={styles.pickerBlock}>
                    <DateTimePicker
                      value={endTime ?? new Date()}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'compact' : 'default'}
                      onChange={(_, date) => {
                        if (date) setEndTime(date);
                      }}
                      style={styles.picker}
                    />
                    <View style={styles.pickerActions}>
                      <TouchableOpacity style={styles.pickerDone} onPress={() => setShowEndPicker(false)}>
                        <Text style={styles.pickerDoneText}>Fertig</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>😴 Schlafqualität</Text>
                <View style={styles.qualityRow}>
                  {(['good', 'medium', 'bad'] as SleepQuality[]).map((item) => {
                    const isActive = quality === item;
                    const background =
                      item === 'good'
                        ? '#38A169'
                        : item === 'medium'
                        ? '#F5A623'
                        : '#E53E3E';
                    const icon = item === 'good' ? '😴' : item === 'medium' ? '😐' : '😵';
                    const label = item === 'good' ? 'Gut' : item === 'medium' ? 'Mittel' : 'Schlecht';
                    return (
                      <TouchableOpacity
                        key={item ?? 'none'}
                        style={[
                          styles.qualityButton,
                          { backgroundColor: isActive ? background : 'rgba(230,230,230,0.85)' },
                        ]}
                        onPress={() => setQuality(item)}
                      >
                        <Text style={styles.qualityIcon}>{icon}</Text>
                        <Text style={[styles.qualityLabel, { color: isActive ? '#FFFFFF' : '#333333' }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📝 Notizen</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optionale Notiz hinzufügen..."
                  placeholderTextColor="#A8978E"
                  multiline
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
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
  modal: {
    width: '100%',
    maxHeight: 640,
    minHeight: 560,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGhost: {
    backgroundColor: 'rgba(230,230,230,0.8)',
  },
  headerGhostText: {
    fontSize: 20,
    color: '#888888',
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#A8978E',
  },
  headerPrimary: {
    backgroundColor: '#8E4EC6',
  },
  headerPrimaryText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  timeLabel: {
    fontSize: 12,
    color: '#A8978E',
    marginBottom: 6,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7D5A50',
  },
  pickerBlock: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 12,
  },
  picker: {
    width: '100%',
  },
  pickerActions: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  pickerDone: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(142,78,198,0.1)',
  },
  pickerDoneText: {
    color: '#8E4EC6',
    fontWeight: '600',
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  qualityButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qualityIcon: {
    fontSize: 24,
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 90,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.75)',
    padding: 16,
    fontSize: 14,
    color: '#7D5A50',
    textAlignVertical: 'top',
  },
});

export default SleepQuickAddModal;

