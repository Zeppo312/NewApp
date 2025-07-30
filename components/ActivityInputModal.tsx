import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, TouchableWithoutFeedback, Keyboard, Platform, ScrollView, TextInput, LayoutAnimation, UIManager } from 'react-native';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import SuccessSplashScreen from './SuccessSplashScreen';

// Typ-Definitionen
type ActivityType = 'feeding' | 'diaper' | 'other';
type FeedingType = 'breast' | 'bottle' | 'solids';
type DiaperType = 'wet' | 'dirty' | 'both';
type BreastSide = 'left' | 'right' | 'both';

// Props-Interface
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
  onSave,
}) => {
  // Theme und Farben
  const theme = {
    background: '#F4F1ED',
    modalBackground: 'rgba(255, 255, 255, 0.95)', // Brighter background
    text: '#333333', // Dark text for contrast
    textSecondary: '#888888', // Lighter gray for subtitles
    primary: '#4A90E2', // Solid blue for selected bottle
    accent: '#E5B9A0',  // Warm orange for save button
    lightGray: 'rgba(230, 230, 230, 0.8)', // Light gray for unselected buttons
    mediumGray: 'rgba(220, 220, 220, 0.5)',
    green: '#4CAF50', // Solid green
    orange: '#F5A623',
    purple: '#9B59B6', // Solid purple
  };

  // States
  const [startTime, setStartTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [isNotesVisible, setNotesVisible] = useState(false);
  const [showSuccessSplash, setShowSuccessSplash] = useState(false);
  
  // Feeding States
  const [feedingType, setFeedingType] = useState<FeedingType>('bottle');
  const [volumeMl, setVolumeMl] = useState(120);
  const [breastSide, setBreastSide] = useState<BreastSide>('left');

  // Diaper States
  const [diaperType, setDiaperType] = useState<DiaperType>('wet');

  // Enable LayoutAnimation for Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Effekt zum Zurücksetzen der Werte bei Sichtbarkeit
  useEffect(() => {
    if (visible) {
      const now = date || new Date();
      setStartTime(now);
      setNotes('');
      setNotesVisible(false);
      
      // Standardwerte setzen
      setFeedingType('bottle');
      setVolumeMl(120);
      setBreastSide('left');
      setDiaperType('wet');
      
      // Hier könnten initialSubType ausgewertet werden
    }
  }, [visible, initialSubType, date]);

  // Speicherfunktion
  const handleSave = () => {
    let data: any = {
        date: startTime,
        note: notes,
    };

    if (activityType === 'feeding') {
        data = {
            ...data,
            feeding_type: feedingType,
            volume_ml: feedingType === 'bottle' ? volumeMl : null,
            side: feedingType === 'breast' ? breastSide.toUpperCase() : null,
        };
    } else if (activityType === 'diaper') {
        data = {
            ...data,
            type: diaperType,
        };
    }
    
    onSave(data);
    setShowSuccessSplash(true);
  };

  const handleSplashFinish = () => {
    setShowSuccessSplash(false);
    onClose();
  };

  const getButtonColor = (type: FeedingType) => {
    switch (type) {
      case 'breast': return theme.purple;
      case 'bottle': return theme.primary;
      case 'solids': return theme.green;
      default: return theme.lightGray;
    }
  };
  
  const getModalTitle = () => {
    switch (activityType) {
      case 'feeding': return 'Neue Fütterung';
      case 'diaper': return 'Wickeln';
      default: return 'Neuer Eintrag';
    }
  };

  // --- RENDER FUNKTIONEN ---

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={[styles.headerButton, { backgroundColor: theme.lightGray }]} onPress={onClose}>
        <Text style={styles.closeHeaderButtonText}>✕</Text>
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>{getModalTitle()}</Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Details eingeben</Text>
      </View>
      <TouchableOpacity 
        style={[styles.headerButton, { backgroundColor: theme.accent }]} 
        onPress={handleSave}
      >
        <Text style={styles.saveHeaderButtonText}>✓</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBreastSideSelector = () => (
    <View style={styles.sideSelectorContainer}>
      {(['left', 'right', 'both'] as BreastSide[]).map((side) => (
        <TouchableOpacity
          key={side}
          style={[
            styles.sideSelectorButton,
            { backgroundColor: theme.lightGray },
            breastSide === side && { backgroundColor: theme.purple, },
          ]}
          onPress={() => setBreastSide(side)}
        >
          <Text style={[styles.sideSelectorButtonText, { color: breastSide === side ? '#FFFFFF' : theme.text }]}>
            {side === 'left' ? 'Links' : side === 'right' ? 'Rechts' : 'Beide'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );



  const renderVolumeControl = () => {
    const quickVolumes = [60, 90, 120, 150, 180];
    return (
      <View style={{width: '100%', alignItems: 'center'}}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>🥛 Menge (ml)</Text>
        <View style={styles.volumeStepperContainer}>
          <TouchableOpacity style={styles.stepperButton} onPress={() => setVolumeMl(v => Math.max(0, v - 10))}>
            <Text style={styles.stepperButtonText}>-</Text>
          </TouchableOpacity>
          <View style={styles.volumeDisplay}>
            <Text style={[styles.volumeText, { color: theme.text }]}>{volumeMl}</Text>
            <Text style={[styles.volumeUnit, { color: theme.textSecondary }]}> ml</Text>
          </View>
          <TouchableOpacity style={styles.stepperButton} onPress={() => setVolumeMl(v => v + 10)}>
            <Text style={styles.stepperButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickVolumeGrid}>
          {quickVolumes.map((vol) => (
            <TouchableOpacity
              key={vol}
              style={[
                styles.quickVolumeButton, 
                { backgroundColor: theme.lightGray },
                volumeMl === vol && { backgroundColor: theme.mediumGray }
              ]}
              onPress={() => setVolumeMl(vol)}
            >
              <Text style={[styles.quickVolumeText, { color: theme.text }]}>{vol}ml</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderFeedingSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>🍼 Art der Fütterung</Text>
      <View style={styles.optionsGrid}>
        {[
          { type: 'breast', label: 'Brust', icon: '🤱' },
          { type: 'bottle', label: 'Flasche', icon: '🍼' },
          { type: 'solids', label: 'Beikost', icon: '🥄' },
        ].map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.optionButton,
              { backgroundColor: theme.lightGray },
              feedingType === option.type && { backgroundColor: getButtonColor(option.type as FeedingType) }
            ]}
            onPress={() => setFeedingType(option.type as FeedingType)}
          >
            <Text style={styles.optionIcon}>{option.icon}</Text>
            <Text style={[styles.optionLabel, { color: feedingType === option.type ? '#FFFFFF' : theme.text }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.contentContainer}>
        {feedingType === 'bottle' && renderVolumeControl()}
        {feedingType === 'breast' && (
          <View style={{width: '100%', alignItems: 'center'}}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🤱 Seite</Text>
            {renderBreastSideSelector()}
            <Text style={[styles.infoText, {marginTop: 20}]}>Wähle die Seite, auf der gestillt wurde.</Text>
          </View>
        )}
        {feedingType === 'solids' && (
          <View style={{width: '100%', alignItems: 'center', paddingTop: 20}}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🥦 Beikost</Text>
            <Text style={[styles.infoText, {marginTop: 10}]}>
              Weitere Details zur Beikost folgen in Kürze.
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderDiaperSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>💧 Art der Windel</Text>
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
              { backgroundColor: theme.lightGray },
              diaperType === option.type && { backgroundColor: theme.primary }
            ]}
            onPress={() => setDiaperType(option.type as DiaperType)}
          >
            <Text style={styles.optionIcon}>{option.icon}</Text>
            <Text style={[styles.optionLabel, { color: diaperType === option.type ? '#FFFFFF' : theme.text }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.infoText, {marginTop: 20}]}>Wähle aus, was auf die Windel zutrifft.</Text>
    </View>
  );

  const toggleNotes = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotesVisible(!isNotesVisible);
  };

  const renderNotes = () => (
      <View style={styles.section}>
         <TouchableOpacity style={styles.notesHeader} onPress={toggleNotes}>
           <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>📝 Notizen</Text>
           <Text style={{ fontSize: 20, transform: [{ rotate: isNotesVisible ? '90deg' : '0deg' }] }}>›</Text>
         </TouchableOpacity>
         {isNotesVisible && (
            <TextInput
                style={[styles.notesInput, { color: theme.text, backgroundColor: theme.lightGray }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Details hinzufügen..."
                placeholderTextColor={theme.textSecondary}
                multiline
            />
         )}
      </View>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* This empty view allows closing the modal by tapping the background */}
        <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <BlurView
            style={styles.modalContent}
            tint="extraLight" // Use a brighter tint
            intensity={80} // Slightly less intense blur
        >
            {renderHeader()}
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* This wrapper ensures keyboard dismiss works inside the scroll view */}
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{width: '100%', alignItems: 'center'}}>
                        {activityType === 'feeding' && renderFeedingSection()}
                        {activityType === 'diaper' && renderDiaperSection()}
                        {renderNotes()}
                    </View>
                </TouchableWithoutFeedback>
            </ScrollView>
        </BlurView>
      </View>
      <SuccessSplashScreen 
        visible={showSuccessSplash} 
        onFinish={handleSplashFinish} 
        backgroundColor={theme.accent} 
      />
    </Modal>
  );
};

// --- STYLES ---

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dimming backdrop
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    width: '100%',
    height: '85%',
    maxHeight: 700,
    minHeight: 650,
    overflow: 'hidden',
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  closeHeaderButtonText: {
    fontSize: 20,
    fontWeight: '400',
    color: '#888888',
  },
  headerCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  saveHeaderButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  saveHeaderButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    width: '90%',
    textAlign: 'left',
  },
  optionsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    marginHorizontal: 5,
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  optionIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  contentContainer: {
    minHeight: 180, // Feste Höhe, um Springen zu verhindern
    justifyContent: 'center',
    paddingTop: 10,
  },
  volumeStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 30,
    paddingVertical: 5,
    paddingHorizontal: 20,
    width: '90%',
    minHeight: 70,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  stepperButtonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
  },
  volumeDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flex: 1,
  },
  volumeText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  volumeUnit: {
    fontSize: 18,
    marginLeft: 5,
    marginBottom: 5,
  },
  quickVolumeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 15,
    width: '90%',
  },
  quickVolumeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    margin: 5,
  },
  quickVolumeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sideSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '90%',
    marginTop: 10,
  },
  sideSelectorButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 20,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  sideSelectorButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  chevron: {
    fontSize: 24,
    color: '#888',
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 15,
    backgroundColor: 'rgba(240, 240, 240, 0.9)',
    width: '100%',
    marginTop: 10,
  },
});

export default ActivityInputModal;