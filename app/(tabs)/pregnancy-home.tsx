import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import CountdownTimer from '@/components/CountdownTimer';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { pregnancyMotherInfo } from '@/constants/PregnancyMotherInfo';
import { pregnancyPartnerInfo } from '@/constants/PregnancyPartnerInfo';
import { pregnancySymptoms } from '@/constants/PregnancySymptoms';

export default function PregnancyHomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      setIsLoading(true);

      // Geburtstermin laden
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('due_date')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsError) {
        console.error('Error loading due date:', settingsError);
      } else if (settingsData && settingsData.due_date) {
        const dueDateObj = new Date(settingsData.due_date);
        setDueDate(dueDateObj);

        // Berechne die aktuelle SSW
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Geburtstermin ohne Uhrzeit (nur Tag)
        const dueDateCopy = new Date(dueDateObj);
        dueDateCopy.setHours(0, 0, 0, 0);

        // Berechne die Differenz in Millisekunden
        const difference = dueDateCopy.getTime() - now.getTime();

        // Berechne die Tage bis zum Geburtstermin
        const daysLeft = Math.round(difference / (1000 * 60 * 60 * 24));

        // Schwangerschaft dauert ca. 40 Wochen
        const totalDaysInPregnancy = 280; // 40 Wochen * 7 Tage

        // Berechne die Tage der Schwangerschaft
        const daysRemaining = Math.max(0, daysLeft);
        const daysPregnant = totalDaysInPregnancy - daysRemaining;

        // Berechne SSW und Tag
        const weeksPregnant = Math.floor(daysPregnant / 7);
        const daysInCurrentWeek = daysPregnant % 7;

        setCurrentWeek(weeksPregnant);
        setCurrentDay(daysInCurrentWeek);
      }

      // Benutzernamen laden
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Error loading user profile:', profileError);
      } else if (profileData && profileData.first_name) {
        setUserName(profileData.first_name);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {/* Begrüßung */}
          <ThemedView style={styles.greetingContainer} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.greeting}>
              Hallo {userName ? userName : 'Mama'}!
            </ThemedText>
          </ThemedView>

          {/* Countdown-Bereich */}
          <ThemedView style={styles.countdownContainer} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.sectionTitle}>Dein Countdown</ThemedText>
            <CountdownTimer dueDate={dueDate} />
          </ThemedView>

          {/* Wöchentliche Informationen */}
          {currentWeek && currentWeek >= 4 && currentWeek <= 42 && (
            <ThemedView style={styles.weeklyInfoContainer} lightColor={theme.card} darkColor={theme.card}>
              <ThemedText style={styles.sectionTitle}>SSW {currentWeek}: Was geschieht diese Woche?</ThemedText>

              {/* Kind */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <IconSymbol name="figure.child" size={24} color={theme.accent} />
                  <ThemedText style={styles.infoTitle}>Beim Baby</ThemedText>
                </View>
                <ThemedText style={styles.infoText}>
                  {pregnancyWeekInfo[currentWeek]}
                </ThemedText>
              </View>

              {/* Mutter */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <IconSymbol name="person.fill" size={24} color={theme.accent} />
                  <ThemedText style={styles.infoTitle}>Bei der Mutter</ThemedText>
                </View>
                <ThemedText style={styles.infoText}>
                  {pregnancyMotherInfo[currentWeek]}
                </ThemedText>
              </View>

              {/* Partner */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <IconSymbol name="person.2.fill" size={24} color={theme.accent} />
                  <ThemedText style={styles.infoTitle}>Für den Partner</ThemedText>
                </View>
                <ThemedText style={styles.infoText}>
                  {pregnancyPartnerInfo[currentWeek]}
                </ThemedText>
              </View>
            </ThemedView>
          )}

          {/* Mögliche Symptome */}
          {currentWeek && currentWeek >= 4 && currentWeek <= 42 && (
            <ThemedView style={styles.symptomsContainer} lightColor={theme.card} darkColor={theme.card}>
              <ThemedText style={styles.sectionTitle}>Mögliche Symptome in SSW {currentWeek}</ThemedText>

              <View style={styles.symptomsList}>
                {pregnancySymptoms[currentWeek].map((symptom, index) => (
                  <View key={index} style={styles.symptomItem}>
                    <IconSymbol name="circle.fill" size={8} color={theme.accent} />
                    <ThemedText style={styles.symptomText}>{symptom}</ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          )}

          {/* Schnellzugriff-Buttons */}
          <View style={styles.cardsSection}>
            <ThemedText style={styles.sectionTitle}>Schnellzugriff</ThemedText>

            <View style={styles.cardsGrid}>
              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(157, 190, 187, 0.9)' }]}
                onPress={() => router.push({ pathname: '/(tabs)/countdown' })}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="calendar" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle}>Countdown</ThemedText>
                <ThemedText style={styles.cardDescription}>Dein Weg zur Geburt</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(233, 201, 182, 0.9)' }]}
                onPress={() => router.push({ pathname: '/(tabs)' })}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="timer" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle}>Wehen-Tracker</ThemedText>
                <ThemedText style={styles.cardDescription}>Wehen messen und verfolgen</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(125, 90, 80, 0.7)' }]}
                onPress={() => router.push({ pathname: '/(tabs)/explore' })}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="checklist" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle}>Checkliste</ThemedText>
                <ThemedText style={styles.cardDescription}>Kliniktasche vorbereiten</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(229, 115, 115, 0.7)' }]}
                onPress={() => router.push({ pathname: '/(tabs)/geburtsplan' })}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="doc.text.fill" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle}>Geburtsplan</ThemedText>
                <ThemedText style={styles.cardDescription}>Wünsche für die Geburt</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(157, 190, 187, 0.9)' }]}
                onPress={() => router.push('/doctor-questions' as any)}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="questionmark.circle" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle}>Frauenarzt-Fragen</ThemedText>
                <ThemedText style={styles.cardDescription}>Fragen für den nächsten Termin</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  greetingContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7D5A50',
    textAlign: 'left',
  },
  countdownContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  weeklyInfoContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#7D5A50',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 32,
  },
  symptomsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  symptomsList: {
    paddingLeft: 8,
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  symptomText: {
    fontSize: 14,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  cardsSection: {
    marginBottom: 16,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#7D5A50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7D5A50',
    textAlign: 'center',
  },
});
