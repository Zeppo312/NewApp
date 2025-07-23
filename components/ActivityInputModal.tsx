import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Platform
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import DateTimePicker from '@react-native-community/datetimepicker';

type ActivityType = 'feeding' | 'diaper' | 'other';

interface ActivityInputModalProps {
  visible: boolean;
  activityType: ActivityType;
  onClose: () => void;
  onSave: (data: {
    entry_type: ActivityType;
    start_time: string;
    end_time?: string;
    notes?: string;
    duration: number;
  }) => void;
}

const ActivityInputModal: React.FC<ActivityInputModalProps> = ({
  visible,
  activityType,
  onClose,
  onSave
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(startTime.getTime()));
  const [notes, setNotes] = useState('');
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      const now = new Date();
      setStartTime(now);
      setEndTime(now); // Setze Ende gleich Start, da keine Dauer mehr benötigt wird
      setNotes('');
      setShowNotesField(false); // Reset notes field visibility
    }
  }, [visible]);

  // Handle start time change
  const handleStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartTimePicker(false);
    if (selectedDate) {
      setStartTime(selectedDate);
      setEndTime(selectedDate); // Setze Ende gleich Start, da keine Dauer mehr benötigt wird
    }
  };

  // Get activity title and color based on type
  const getActivityInfo = () => {
    switch (activityType) {
      case 'feeding':
        return { title: 'Füttern', color: '#FF9800', icon: 'drop.fill' as const };
      case 'diaper':
        return { title: 'Wickeln', color: '#4CAF50', icon: 'heart.fill' as const };
      case 'other':
        return { title: 'Sonstiges', color: '#9C27B0', icon: 'star.fill' as const };
    }
  };

  const activityInfo = getActivityInfo();

  // Handle save
  const handleSave = () => {
    onSave({
      entry_type: activityType,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: notes,
      duration: 0 // Feste Dauer auf 0 setzen
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent} lightColor={theme.card} darkColor={theme.card}>
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: activityInfo.color }]}>
                <IconSymbol name={activityInfo.icon} size={24} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.title}>{activityInfo.title}</ThemedText>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <IconSymbol name="xmark" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              {/* Start Time Selector */}
              <View style={styles.timeSelector}>
                <ThemedText style={styles.label}>Startzeit:</ThemedText>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <ThemedText style={styles.timeButtonText}>
                    {startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {showStartTimePicker && (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display="default"
                  onChange={handleStartTimeChange}
                />
              )}

              {/* "Notiz hinzufügen" Button - nur anzeigen, wenn das Notizfeld nicht sichtbar ist */}
              {!showNotesField && (
                <TouchableOpacity
                  style={styles.addNotesButton}
                  onPress={() => setShowNotesField(true)}
                >
                  <IconSymbol name="plus.circle" size={18} color={activityInfo.color} />
                  <ThemedText style={[styles.addNotesText, { color: activityInfo.color }]}>
                    Notiz hinzufügen
                  </ThemedText>
                </TouchableOpacity>
              )}

              {/* Notes Input - nur anzeigen, wenn showNotesField true ist */}
              {showNotesField && (
                <TextInput
                  style={[
                    styles.notesInput,
                    { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                  ]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notizen (optional)"
                  placeholderTextColor={colorScheme === 'dark' ? '#AAAAAA' : '#888888'}
                  multiline
                  numberOfLines={3}
                  autoFocus={true}
                />
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: activityInfo.color }]}
                onPress={handleSave}
              >
                <ThemedText style={styles.saveButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                  Speichern
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  content: {
    marginBottom: Platform.OS === 'ios' ? 30 : 0, // Extra padding for iOS
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginRight: 10,
  },
  timeButton: {
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  timeButtonText: {
    fontSize: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 15,
  },
  addNotesText: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default ActivityInputModal;
