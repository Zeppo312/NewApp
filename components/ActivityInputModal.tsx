import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
  Text
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import DateTimePicker from '@react-native-community/datetimepicker';

type ActivityType = 'feeding' | 'diaper' | 'other';
type FeedingType = 'breast' | 'bottle' | 'solids';
type DiaperType = 'wet' | 'dirty' | 'both';

interface ActivityInputModalProps {
  visible: boolean;
  activityType: ActivityType;
  initialSubType?: string | null;
  date?: Date;
  onClose: () => void;
  onSave: (data: any) => void;
}

const ActivityInputModal: React.FC<ActivityInputModalProps> = ({
  visible,
  activityType,
  initialSubType,
  date,
  onClose,
  onSave
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // States
  const [startTime, setStartTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  
  // Feeding specific states
  const [feedingType, setFeedingType] = useState<FeedingType>('breast');
  const [volumeMl, setVolumeMl] = useState('');
  const [breastSide, setBreastSide] = useState<'left' | 'right' | 'both'>('left');
  
  // Diaper specific states
  const [diaperType, setDiaperType] = useState<DiaperType>('wet');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      const now = date || new Date();
      setStartTime(now);
      setNotes('');
      setVolumeMl('');
      
      // Set initial type based on initialSubType
      if (initialSubType) {
        if (initialSubType === 'feeding_breast') setFeedingType('breast');
        else if (initialSubType === 'feeding_bottle') setFeedingType('bottle');
        else if (initialSubType === 'feeding_solids') setFeedingType('solids');
        else if (initialSubType === 'diaper_wet') setDiaperType('wet');
        else if (initialSubType === 'diaper_dirty') setDiaperType('dirty');
        else if (initialSubType === 'diaper_both') setDiaperType('both');
      }
    }
  }, [visible, initialSubType, date]);

  const handleStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartTimePicker(false);
    if (selectedDate) {
      setStartTime(selectedDate);
    }
  };

  const getModalTitle = () => {
    switch (activityType) {
      case 'feeding': return 'Neue Fütterung';
      case 'diaper': return 'Wickeln';
      default: return 'Neuer Eintrag';
    }
  };

  const handleSave = () => {
    if (activityType === 'feeding') {
      onSave({
        type: feedingType,
        start_time: startTime.toISOString(),
        volume_ml: volumeMl ? parseInt(volumeMl) : null,
        side: feedingType === 'breast' ? breastSide : null,
        note: notes,
      });
    } else if (activityType === 'diaper') {
      onSave({
        entry_type: 'diaper',
        entry_date: startTime.toISOString(),
        start_time: startTime.toISOString(),
        notes: `${diaperType}${notes ? ` - ${notes}` : ''}`,
      });
    } else {
      onSave({
        entry_type: activityType,
        entry_date: startTime.toISOString(),
        start_time: startTime.toISOString(),
        notes: notes,
      });
    }
  };

  const renderFeedingOptions = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>🍼 Art der Fütterung</ThemedText>
      </View>
      
      <View style={styles.optionsGrid}>
        {[
          { type: 'breast', label: 'Brust', icon: '👶' },
          { type: 'bottle', label: 'Flasche', icon: '🍼' },
          { type: 'solids', label: 'Beikost', icon: '🥄' },
        ].map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.optionButton,
              feedingType === option.type && styles.selectedOption,
              { backgroundColor: feedingType === option.type ? '#4CAF50' : 'rgba(0,0,0,0.05)' }
            ]}
            onPress={() => setFeedingType(option.type as FeedingType)}
          >
            <Text style={styles.optionIcon}>{option.icon}</Text>
            <ThemedText style={[
              styles.optionLabel,
              { color: feedingType === option.type ? '#FFFFFF' : theme.text }
            ]}>
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {feedingType === 'solids' && (
        <View style={styles.infoBox}>
          <View style={styles.infoIconContainer}>
            <ThemedText style={styles.infoIcon}>ℹ️</ThemedText>
          </View>
          <ThemedText style={styles.infoText}>
            Verwenden Sie das Notizfeld für weitere Details über die Beikost
          </ThemedText>
        </View>
      )}

      {feedingType === 'bottle' && (
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Menge (ml):</ThemedText>
          <TextInput
            style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
            value={volumeMl}
            onChangeText={setVolumeMl}
            placeholder="z.B. 120"
            placeholderTextColor={theme.tabIconDefault}
            keyboardType="numeric"
          />
        </View>
      )}

      {feedingType === 'breast' && (
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Seite:</ThemedText>
          <View style={styles.sideSelector}>
            {['left', 'right', 'both'].map((side) => (
              <TouchableOpacity
                key={side}
                style={[
                  styles.sideButton,
                  breastSide === side && styles.selectedSideButton
                ]}
                onPress={() => setBreastSide(side as any)}
              >
                <ThemedText style={[
                  styles.sideButtonText,
                  { color: breastSide === side ? '#FFFFFF' : theme.text }
                ]}>
                  {side === 'left' ? 'Links' : side === 'right' ? 'Rechts' : 'Beide'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderDiaperOptions = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>💧 Art der Windel</ThemedText>
      </View>
      
      <View style={styles.optionsGrid}>
        {[
          { type: 'wet', label: 'Nass', icon: '💧' },
          { type: 'dirty', label: 'Voll', icon: '💩' },
          { type: 'both', label: 'Beides', icon: '💧💩' },
        ].map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.optionButton,
              diaperType === option.type && styles.selectedOption,
              { backgroundColor: diaperType === option.type ? '#2196F3' : 'rgba(0,0,0,0.05)' }
            ]}
            onPress={() => setDiaperType(option.type as DiaperType)}
          >
            <Text style={styles.optionIcon}>{option.icon}</Text>
            <ThemedText style={[
              styles.optionLabel,
              { color: diaperType === option.type ? '#FFFFFF' : theme.text }
            ]}>
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalContent, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.headerButton} onPress={onClose}>
                <ThemedText style={styles.headerButtonText}>✕</ThemedText>
              </TouchableOpacity>
              
              <View style={styles.headerCenter}>
                <ThemedText style={styles.modalTitle}>{getModalTitle()}</ThemedText>
                <ThemedText style={styles.modalSubtitle}>Details eingeben</ThemedText>
              </View>
              
              <TouchableOpacity style={[styles.headerButton, styles.saveHeaderButton]} onPress={handleSave}>
                <ThemedText style={styles.saveHeaderButtonText}>✓</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Content based on activity type */}
              {activityType === 'feeding' && renderFeedingOptions()}
              {activityType === 'diaper' && renderDiaperOptions()}

              {/* Time Section */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.timeSelector}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <ThemedText style={styles.timeLabel}>Uhrzeit:</ThemedText>
                  <ThemedText style={styles.timeValue}>
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

              {/* Notes Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>📝 Notizen</ThemedText>
                </View>
                <TextInput
                  style={[styles.notesInput, { color: theme.text, borderColor: theme.border }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Zusätzliche Informationen..."
                  placeholderTextColor={theme.tabIconDefault}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    width: '100%',
    maxHeight: '85%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerButton: {
    padding: 5,
  },
  headerButtonText: {
    fontSize: 24,
  },
  headerCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  saveHeaderButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  saveHeaderButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  optionButton: {
    width: '30%',
    minHeight: 80,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
    padding: 8,
  },
  selectedOption: {
    borderWidth: 2,
    borderColor: '#4CAF50', // Example color for selected
  },
  optionIcon: {
    fontSize: 28,
    marginBottom: 5,
  },
  optionLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#E0F2F7',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#B0E0E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoIcon: {
    fontSize: 18,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
  },
  inputGroup: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F0F0F0',
  },
  sideSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 5,
  },
  sideButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  selectedSideButton: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  sideButtonText: {
    fontSize: 14,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F0F0F0',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E0F2F7',
    borderRadius: 10,
    padding: 12,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ActivityInputModal;
