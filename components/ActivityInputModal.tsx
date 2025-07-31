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
  const [showNotes, setShowNotes] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  
  // Feeding specific states
  const [feedingType, setFeedingType] = useState<FeedingType>('breast');
  const [volumeMl, setVolumeMl] = useState(0);
  const [breastSide, setBreastSide] = useState<'left' | 'right' | 'both'>('left');
  
  // Diaper specific states
  const [diaperType, setDiaperType] = useState<DiaperType>('wet');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      const now = date || new Date();
      setStartTime(now);
      setNotes('');
      setShowNotes(false);
      setVolumeMl(0);
      
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
        volume_ml: volumeMl || null,
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

  const OptionButton = ({
    emoji,
    label,
    selected,
    tint,
    onPress,
  }: {
    emoji: string;
    label: string;
    selected: boolean;
    tint: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[
        styles.optionBtn,
        {
          backgroundColor: selected ? tint : '#F2F2F4',
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.optionEmoji, { color: selected ? '#fff' : theme.text }]}>{emoji}</Text>
      <ThemedText style={[styles.optionLabel, { color: selected ? '#fff' : theme.text }]}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  const renderFeedingOptions = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>🍼 Art der Fütterung</ThemedText>
      </View>

      <View style={styles.optionRow}>
        {[
          { type: 'breast', label: 'Brust', icon: '🤱', tint: '#AF52DE' },
          { type: 'bottle', label: 'Flasche', icon: '🍼', tint: '#0A84FF' },
          { type: 'solids', label: 'Beikost', icon: '🥄', tint: '#34C759' },
        ].map((option) => (
          <OptionButton
            key={option.type}
            emoji={option.icon}
            label={option.label}
            selected={feedingType === option.type}
            tint={option.tint}
            onPress={() => setFeedingType(option.type as FeedingType)}
          />
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
          <ThemedText style={styles.inputLabel}>🥛 Menge (ml)</ThemedText>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setVolumeMl(Math.max(0, volumeMl - 30))}>
              <Text style={styles.stepBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{volumeMl} ml</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setVolumeMl(volumeMl + 30)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.presetRow}>
            {[60, 90, 120, 150, 180].map(v => (
              <TouchableOpacity key={v} style={styles.presetChip} onPress={() => setVolumeMl(v)}>
                <Text style={styles.presetChipText}>{v}ml</Text>
              </TouchableOpacity>
            ))}
          </View>
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
      
      <View style={styles.optionRow}>
        {[
          { type: 'wet', label: 'Nass', icon: '💧', tint: '#0A84FF' },
          { type: 'dirty', label: 'Voll', icon: '💩', tint: '#8A4E2C' },
          { type: 'both', label: 'Beides', icon: '💧💩', tint: '#0A84FF' },
        ].map((option) => (
          <OptionButton
            key={option.type}
            emoji={option.icon}
            label={option.label}
            selected={diaperType === option.type}
            tint={option.tint}
            onPress={() => setDiaperType(option.type as DiaperType)}
          />
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
          <ThemedView style={styles.modalContent}>
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
                <TouchableOpacity style={styles.notesRow} onPress={() => setShowNotes(true)}>
                  <Text style={styles.optionIcon}>📝</Text>
                  <ThemedText style={styles.notesRowLabel}>Notizen</ThemedText>
                  <IconSymbol name="chevron.right" size={20} color={theme.text} />
                </TouchableOpacity>
                {showNotes && (
                  <TextInput
                    style={[styles.notesInput, { color: theme.text, borderColor: theme.border }]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Zusätzliche Informationen..."
                    placeholderTextColor={theme.tabIconDefault}
                    multiline
                    numberOfLines={3}
                  />
                )}
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 30,
  },
  modalContent: {
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    width: '92%',
    maxHeight: '85%',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E5EA',
  },
  headerButtonText: {
    fontSize: 20,
    color: '#1C1C1E',
  },
  headerCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  saveHeaderButton: {
    backgroundColor: '#FFC4A6',
  },
  saveHeaderButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
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
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  optionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  optionEmoji: {
    fontSize: 20,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 12,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 20,
    fontWeight: '600',
  },
  stepValue: {
    fontSize: 30,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  presetChip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F4',
    borderRadius: 14,
    padding: 12,
  },
  notesRowLabel: {
    flex: 1,
    marginLeft: 8,
    fontSize: 17,
    fontWeight: '600',
  },
});

export default ActivityInputModal;
