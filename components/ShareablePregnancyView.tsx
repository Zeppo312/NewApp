import React, { useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Share, Alert, Platform, ImageBackground } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from './ui/IconSymbol';
import { format, differenceInDays, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { babySizeComparison } from '@/constants/BabySizeComparison';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface ShareablePregnancyViewProps {
  dueDate: Date;
  currentWeek: number;
  currentDay: number;
  progress: number;
  onClose: () => void;
}

const ShareablePregnancyView: React.FC<ShareablePregnancyViewProps> = ({ 
  dueDate, 
  currentWeek, 
  currentDay, 
  progress, 
  onClose 
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const viewShotRef = useRef<ViewShot>(null);

  // Berechne zusätzliche Informationen
  const today = new Date();
  const daysLeft = differenceInDays(dueDate, today);
  const conceptionDate = addDays(dueDate, -280); // 40 Wochen zurück
  const daysSinceConception = differenceInDays(today, conceptionDate);
  
  // Berechne Schwangerschaftsmonat (jeweils 4 Wochen)
  const pregnancyMonth = Math.ceil(currentWeek / 4);
  
  // Berechne Kalendermonat
  const calendarMonth = dueDate.getMonth() + 1; // JavaScript Monate sind 0-basiert
  
  // Bestimme Trimester
  const trimester = currentWeek <= 13 ? 1 : currentWeek <= 27 ? 2 : 3;

  const handleShare = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();
        
        if (Platform.OS === 'ios') {
          await Sharing.shareAsync(uri);
        } else {
          await Share.share({
            title: 'Meine Schwangerschaft',
            message: `Ich bin in SSW ${currentWeek}+${currentDay} und habe bereits ${Math.round(progress * 100)}% meiner Schwangerschaft geschafft! Noch ${daysLeft} Tage bis zum errechneten Geburtstermin am ${format(dueDate, 'dd.MM.yyyy')}. 🤰👶`,
            url: uri
          });
        }
      }
    } catch (error) {
      console.error('Error sharing pregnancy details:', error);
      Alert.alert('Fehler', 'Beim Teilen ist ein Fehler aufgetreten. Bitte versuche es später erneut.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <ViewShot ref={viewShotRef} style={styles.shareableContent}>
        <ImageBackground
          source={require('@/assets/images/Background_Hell.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Meine Schwangerschaft
            </ThemedText>
          </View>

          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <View style={styles.progressContainer}>
              <ThemedText style={styles.progressTitle}>Fortschritt</ThemedText>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.accent }]} />
              </View>
              <ThemedText style={styles.progressText}>
                {Math.round(progress * 100)}% geschafft
              </ThemedText>
            </View>
          </ThemedView>

          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>SSW</ThemedText>
                <ThemedText style={styles.infoValue}>{currentWeek}+{currentDay}</ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Trimester</ThemedText>
                <ThemedText style={styles.infoValue}>{trimester}. Trimester</ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Schwangerschaftsmonat</ThemedText>
                <ThemedText style={styles.infoValue}>{pregnancyMonth}. Monat</ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Kalendermonat</ThemedText>
                <ThemedText style={styles.infoValue}>{format(dueDate, 'MMMM', { locale: de })}</ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Schwanger seit</ThemedText>
                <ThemedText style={styles.infoValue}>{daysSinceConception} Tagen</ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Verbleibende Tage</ThemedText>
                <ThemedText style={styles.infoValue}>{daysLeft}</ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Errechneter Termin</ThemedText>
                <ThemedText style={styles.infoValue}>{format(dueDate, 'dd.MM.yyyy')}</ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Baby so groß wie</ThemedText>
                <ThemedText style={styles.infoValue}>{babySizeComparison[currentWeek] || "Wächst und gedeiht 🌱"}</ThemedText>
              </View>
            </View>
          </ThemedView>

          <ThemedView style={styles.card} lightColor={theme.cardLight} darkColor={theme.cardDark}>
            <ThemedText style={styles.weekInfoTitle}>Diese Woche</ThemedText>
            <ThemedText style={styles.weekInfoText}>
              {pregnancyWeekInfo[currentWeek] || "Dein Baby entwickelt sich weiter."}
            </ThemedText>
          </ThemedView>
        </ImageBackground>
      </ViewShot>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleShare}>
          <ThemedView style={styles.buttonInner} lightColor={theme.accent} darkColor={theme.accent}>
            <IconSymbol name="share" size={20} color="#FFFFFF" />
            <ThemedText style={styles.buttonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
              Teilen
            </ThemedText>
          </ThemedView>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <ThemedView style={styles.buttonInner} lightColor={theme.cardDark} darkColor={theme.cardLight}>
            <IconSymbol name="close" size={20} color="#FFFFFF" />
            <ThemedText style={styles.buttonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
              Schließen
            </ThemedText>
          </ThemedView>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  shareableContent: {
    flex: 1,
  },
  backgroundImage: {
    width: '100%',
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  card: {
    margin: 16,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  progressBarContainer: {
    width: '100%',
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    borderRadius: 10,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.success,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 16,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7D5A50',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  weekInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  weekInfoText: {
    fontSize: 16,
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
    paddingHorizontal: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default ShareablePregnancyView;
