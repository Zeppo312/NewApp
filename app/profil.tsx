import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Switch,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Header from '@/components/Header';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';

import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { supabase } from '@/lib/supabase';
import { getBabyInfo, saveBabyInfo } from '@/lib/baby';

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8; // wie im Sleep-Tracker
const PRIMARY_TEXT = '#7D5A50';
const ACCENT_PURPLE = '#8E4EC6'; // Sleep-Tracker Akzent
const BABY_BLUE = '#87CEEB';

export default function ProfilScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();

  // Benutzerinformationen
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [userRole, setUserRole]   = useState<'mama' | 'papa' | ''>('');

  // Baby-Informationen
  const [babyName, setBabyName]         = useState('');
  const [babyGender, setBabyGender]     = useState<'male' | 'female' | ''>('');
  const [dueDate, setDueDate]           = useState<Date | null>(null);
  const [birthDate, setBirthDate]       = useState<Date | null>(null);
  const [babyWeight, setBabyWeight]     = useState('');
  const [babyHeight, setBabyHeight]     = useState('');

  // UI
  const [isLoading, setIsLoading]                   = useState(true);
  const [showDueDatePicker, setShowDueDatePicker]   = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [isSaving, setIsSaving]                     = useState(false);

  useEffect(() => {
    if (user) loadUserData();
    else setIsLoading(false);
  }, [user]);

  const loadUserData = async () => {
    try {
      setIsLoading(true);

      if (user?.email) setEmail(user.email);

      // Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, user_role')
        .eq('id', user?.id)
        .single();

      if (!profileError && profileData) {
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
        setUserRole((profileData.user_role as any) || '');
      }

      // Settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('due_date, is_baby_born')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        if (settingsData.due_date) setDueDate(new Date(settingsData.due_date));
        if (settingsData.is_baby_born !== undefined) setIsBabyBorn(settingsData.is_baby_born);
      }

      // Baby info
      const { data: babyData } = await getBabyInfo();
      if (babyData) {
        setBabyName(babyData.name || '');
        setBabyGender(babyData.baby_gender || '');
        setBabyWeight(babyData.weight || '');
        setBabyHeight(babyData.height || '');
        if (babyData.birth_date) setBirthDate(new Date(babyData.birth_date));
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Fehler', 'Deine Daten konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveUserData = async () => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deine Daten zu speichern.');
        return;
      }
      setIsSaving(true);

      // profiles upsert
      const { data: existingProfile } = await supabase
        .from('profiles').select('id').eq('id', user.id).maybeSingle();

      let profileResult;
      if (existingProfile?.id) {
        profileResult = await supabase.from('profiles').update({
          first_name: firstName,
          last_name: lastName,
          user_role: userRole,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      } else {
        profileResult = await supabase.from('profiles').insert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          user_role: userRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (profileResult.error) throw profileResult.error;

      // user_settings upsert
      const { data: existingSettings } = await supabase
        .from('user_settings').select('id').eq('user_id', user.id).maybeSingle();

      let settingsResult;
      const base = {
        due_date: dueDate ? dueDate.toISOString() : null,
        is_baby_born: isBabyBorn,
        theme: 'light',
        notifications_enabled: true,
        updated_at: new Date().toISOString(),
      };
      if (existingSettings?.id) {
        settingsResult = await supabase.from('user_settings')
          .update(base).eq('id', existingSettings.id);
      } else {
        settingsResult = await supabase.from('user_settings')
          .insert({ user_id: user.id, ...base });
      }
      if (settingsResult.error) throw settingsResult.error;

      // baby info
      const { error: babyError } = await saveBabyInfo({
        name: babyName,
        baby_gender: babyGender,
        birth_date: birthDate ? birthDate.toISOString() : null,
        weight: babyWeight,
        height: babyHeight,
      });
      if (babyError) throw babyError;

      Alert.alert('Erfolg', 'Deine Daten wurden erfolgreich gespeichert.', [
        { text: 'OK', onPress: () => router.push('/more') },
      ]);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Fehler', e?.message || 'Deine Daten konnten nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: Date | null) =>
    !date
      ? 'Nicht festgelegt'
      : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleDueDateChange = (_: any, selectedDate?: Date) => {
    setShowDueDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDueDate(selectedDate);
  };
  const handleBirthDateChange = (_: any, selectedDate?: Date) => {
    setShowBirthDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
      setIsBabyBorn(true);
    }
  };
  const handleBabyBornChange = (value: boolean) => {
    setIsBabyBorn(value);
    if (!value) setBirthDate(null);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden />

          <Header
            title="Profil"
            subtitle="Persönliche Daten und Babyinfos"
            showBackButton
            onBackPress={() => router.push('/more')}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
                <ThemedText style={styles.loadingText}>Lade Daten...</ThemedText>
              </View>
            ) : (
              <>
                {/* Persönliche Daten */}
                <LiquidGlassCard
                  style={[styles.sectionCard, { marginHorizontal: TIMELINE_INSET }]}
                  intensity={26}
                  overlayColor={GLASS_OVERLAY}
                >
                  <ThemedText style={styles.sectionTitle}>Persönliche Daten</ThemedText>
                  <View style={styles.cardInner}>
                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>E-Mail</ThemedText>
                      <TextInput
                        style={[styles.inputGlass, styles.inputDisabled]}
                        value={email}
                        editable={false}
                        placeholder="Deine E-Mail-Adresse"
                        placeholderTextColor="#9BA0A6"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Vorname</ThemedText>
                      <TextInput
                        style={styles.inputGlass}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="Dein Vorname"
                        placeholderTextColor="#9BA0A6"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Nachname</ThemedText>
                      <TextInput
                        style={styles.inputGlass}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Dein Nachname"
                        placeholderTextColor="#9BA0A6"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Rolle</ThemedText>
                      <View style={styles.duoRow}>
                        <TouchableOpacity
                          style={[
                            styles.pickButton,
                            userRole === 'mama' && styles.pickButtonActive,
                          ]}
                          onPress={() => setUserRole('mama')}
                          activeOpacity={0.9}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={24}
                            color={userRole === 'mama' ? '#FFFFFF' : '#7D7D85'}
                          />
                          <ThemedText
                            style={[
                              styles.pickButtonText,
                              userRole === 'mama' && styles.pickButtonTextActive,
                            ]}
                          >
                            Mama
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.pickButton,
                            userRole === 'papa' && styles.pickButtonActive,
                          ]}
                          onPress={() => setUserRole('papa')}
                          activeOpacity={0.9}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={24}
                            color={userRole === 'papa' ? '#FFFFFF' : '#7D7D85'}
                          />
                          <ThemedText
                            style={[
                              styles.pickButtonText,
                              userRole === 'papa' && styles.pickButtonTextActive,
                            ]}
                          >
                            Papa
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </LiquidGlassCard>

                {/* Baby-Infos */}
                <LiquidGlassCard
                  style={[styles.sectionCard, { marginHorizontal: TIMELINE_INSET }]}
                  intensity={26}
                  overlayColor={GLASS_OVERLAY}
                >
                  <ThemedText style={styles.sectionTitle}>Baby-Informationen</ThemedText>
                  <View style={styles.cardInner}>
                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Errechneter Geburtstermin</ThemedText>
                      <TouchableOpacity
                        style={styles.dateButtonGlass}
                        onPress={() => setShowDueDatePicker(true)}
                        activeOpacity={0.9}
                      >
                        <ThemedText style={styles.dateButtonText}>
                          {dueDate ? formatDate(dueDate) : 'Geburtstermin auswählen'}
                        </ThemedText>
                        <IconSymbol name="calendar" size={20} color="#7D7D85" />
                      </TouchableOpacity>
                      {showDueDatePicker && (
                        <DateTimePicker
                          value={dueDate || new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'compact' : 'default'}
                          onChange={handleDueDateChange}
                        />
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Baby bereits geboren?</ThemedText>
                      <View style={styles.switchContainer}>
                        <ThemedText style={styles.switchLabel}>
                          {isBabyBorn ? 'Ja' : 'Nein'}
                        </ThemedText>
                        <Switch
                          value={isBabyBorn}
                          onValueChange={handleBabyBornChange}
                          disabled={isSaving}
                          trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                          thumbColor={isBabyBorn ? '#FFFFFF' : '#F4F4F4'}
                          ios_backgroundColor="#D1D1D6"
                        />
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Name des Babys</ThemedText>
                      <TextInput
                        style={styles.inputGlass}
                        value={babyName}
                        onChangeText={setBabyName}
                        placeholder="Name deines Babys"
                        placeholderTextColor="#9BA0A6"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Geschlecht</ThemedText>
                      <View style={styles.duoRow}>
                        <TouchableOpacity
                          style={[
                            styles.pickButton,
                            babyGender === 'male' && styles.pickButtonActive,
                          ]}
                          onPress={() => setBabyGender('male')}
                          activeOpacity={0.9}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={24}
                            color={babyGender === 'male' ? '#FFFFFF' : '#7D7D85'}
                          />
                          <ThemedText
                            style={[
                              styles.pickButtonText,
                              babyGender === 'male' && styles.pickButtonTextActive,
                            ]}
                          >
                            Junge
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.pickButton,
                            babyGender === 'female' && styles.pickButtonActive,
                          ]}
                          onPress={() => setBabyGender('female')}
                          activeOpacity={0.9}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={24}
                            color={babyGender === 'female' ? '#FFFFFF' : '#7D7D85'}
                          />
                          <ThemedText
                            style={[
                              styles.pickButtonText,
                              babyGender === 'female' && styles.pickButtonTextActive,
                            ]}
                          >
                            Mädchen
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {isBabyBorn && (
                      <>
                        <View style={styles.formGroup}>
                          <ThemedText style={styles.label}>Geburtsdatum</ThemedText>
                          <TouchableOpacity
                            style={styles.dateButtonGlass}
                            onPress={() => setShowBirthDatePicker(true)}
                            activeOpacity={0.9}
                          >
                            <ThemedText style={styles.dateButtonText}>
                              {birthDate ? formatDate(birthDate) : 'Geburtsdatum auswählen'}
                            </ThemedText>
                            <IconSymbol name="calendar" size={20} color="#7D7D85" />
                          </TouchableOpacity>
                          {showBirthDatePicker && (
                            <DateTimePicker
                              value={birthDate || new Date()}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'compact' : 'default'}
                              onChange={handleBirthDateChange}
                              maximumDate={new Date()}
                            />
                          )}
                        </View>

                        <View style={styles.formRow2}>
                          <View style={[styles.formGroup, { flex: 1 }]}>
                            <ThemedText style={styles.label}>Geburtsgewicht (g)</ThemedText>
                            <TextInput
                              style={[styles.inputGlass, styles.numeric]}
                              value={babyWeight}
                              onChangeText={setBabyWeight}
                              placeholder="z.B. 3500"
                              placeholderTextColor="#9BA0A6"
                              keyboardType="numeric"
                            />
                          </View>

                          <View style={[styles.formGroup, { flex: 1 }]}>
                            <ThemedText style={styles.label}>Größe (cm)</ThemedText>
                            <TextInput
                              style={[styles.inputGlass, styles.numeric]}
                              value={babyHeight}
                              onChangeText={setBabyHeight}
                              placeholder="z.B. 52"
                              placeholderTextColor="#9BA0A6"
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </LiquidGlassCard>

                {/* Speichern – im Action-Card Look */}
                <View style={{ marginHorizontal: TIMELINE_INSET }}>
                  <TouchableOpacity
                    onPress={saveUserData}
                    activeOpacity={0.9}
                    disabled={isSaving}
                    style={{ borderRadius: 22, overflow: 'hidden', marginTop: 12 }}
                  >
                    <BlurView intensity={24} tint="light" style={{ borderRadius: 22, overflow: 'hidden' }}>
                      <View
                        style={[
                          styles.saveCard,
                          { backgroundColor: isSaving ? 'rgba(168,168,168,0.5)' : 'rgba(220,200,255,0.6)' },
                        ]}
                      >
                        <View style={[styles.saveIconWrap, { backgroundColor: ACCENT_PURPLE }]}>
                          {isSaving ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <IconSymbol name="tray.and.arrow.down.fill" size={26} color="#FFFFFF" />
                          )}
                        </View>
                        <ThemedText style={styles.saveTitle}>
                          {isSaving ? 'Speichern…' : 'Änderungen speichern'}
                        </ThemedText>
                        <ThemedText style={styles.saveSub}>Deine Daten sicher aktualisieren</ThemedText>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },

  // Scroll rhythm wie Sleep-Tracker
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 140,
    paddingTop: 10,
  },

  loadingContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: PRIMARY_TEXT },

  sectionCard: { marginBottom: 16, borderRadius: 22, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
    color: PRIMARY_TEXT,
    textAlign: 'center',
  },
  cardInner: { paddingHorizontal: 20, paddingBottom: 16 },

  formGroup: { marginBottom: 16 },
  formRow2: { flexDirection: 'row', gap: 12 },

  label: { fontSize: 14, marginBottom: 8, color: PRIMARY_TEXT, fontWeight: '700' },

  // Glas-Inputs wie Sleep-Tracker
  inputGlass: {
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: 'rgba(200,200,200,0.35)',
  },
  numeric: { fontVariant: ['tabular-nums'] },

  // Glas-DateButton
  dateButtonGlass: {
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  dateButtonText: { fontSize: 16, color: '#333' },

  // Duo-Buttons (Rolle/Geschlecht) – Sleep-Tracker Look
  duoRow: { flexDirection: 'row', gap: 8 },
  pickButton: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pickButtonActive: {
    backgroundColor: ACCENT_PURPLE,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  pickButtonText: { fontSize: 16, color: '#7D7D85', fontWeight: '700' },
  pickButtonTextActive: { color: '#FFFFFF', fontWeight: '800' },

  // Switch
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16, color: PRIMARY_TEXT, fontWeight: '700' },

  // Save Action-Card (wie Sleep-Tracker Karten)
  saveCard: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  saveIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 4,
  },
  saveTitle: { fontSize: 16, fontWeight: '800', color: PRIMARY_TEXT, marginBottom: 4 },
  saveSub: { fontSize: 11, color: PRIMARY_TEXT, opacity: 0.8 },
});