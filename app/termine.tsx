import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, ImageBackground, SafeAreaView, StatusBar, FlatList, Alert, Switch, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Appointment as AppointmentType, requestCalendarPermissions, syncAppointmentWithCalendar, deleteAppointmentFromCalendar } from '@/lib/calendarService';

// Typdefinition für einen Termin
interface Appointment extends AppointmentType {}

// Beispieldaten für Termine
const SAMPLE_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    title: 'Kinderarzt - U3',
    date: new Date(2023, 11, 15, 10, 30),
    location: 'Dr. Schmidt, Hauptstraße 12',
    notes: 'Impfpass mitbringen',
    type: 'checkup'
  },
  {
    id: '2',
    title: 'Hebammenbesuch',
    date: new Date(2023, 11, 10, 14, 0),
    location: 'Zuhause',
    notes: 'Fragen zur Stillposition vorbereiten',
    type: 'other'
  },
  {
    id: '3',
    title: 'Kinderarzt - Kontrolle',
    date: new Date(2023, 11, 22, 9, 15),
    location: 'Dr. Schmidt, Hauptstraße 12',
    notes: '',
    type: 'doctor'
  }
];

export default function TermineScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>(SAMPLE_APPOINTMENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAppointment, setNewAppointment] = useState<Partial<Appointment>>({
    title: '',
    date: new Date(),
    location: '',
    notes: '',
    type: 'other'
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarPermission, setCalendarPermission] = useState(false);
  const [syncWithCalendar, setSyncWithCalendar] = useState(false);

  // Überprüfe Kalender-Berechtigungen beim Laden der Komponente
  useEffect(() => {
    const checkCalendarPermissions = async () => {
      try {
        console.log('Prüfe Kalender-Berechtigungen...');
        const hasPermission = await requestCalendarPermissions();
        console.log('Kalender-Berechtigungen erteilt:', hasPermission);
        setCalendarPermission(hasPermission);

        // Wenn Berechtigungen erteilt wurden, aktiviere standardmäßig die Synchronisierung
        if (hasPermission) {
          setSyncWithCalendar(true);
        }
      } catch (error) {
        console.error('Fehler beim Prüfen der Kalender-Berechtigungen:', error);
        setCalendarPermission(false);
      }
    };

    checkCalendarPermissions();
  }, []);

  // Sortiere Termine nach Datum (aufsteigend)
  const sortedAppointments = [...appointments].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Filtere Termine basierend auf der Suchanfrage
  const filteredAppointments = sortedAppointments.filter(appointment =>
    appointment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    appointment.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    appointment.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Formatiere das Datum für die Anzeige
  const formatDate = (date: Date) => {
    return format(date, 'dd. MMMM yyyy', { locale: de });
  };

  // Formatiere die Uhrzeit für die Anzeige
  const formatTime = (date: Date) => {
    return format(date, 'HH:mm', { locale: de });
  };

  // Füge einen neuen Termin hinzu
  const addAppointment = async () => {
    if (!newAppointment.title) {
      Alert.alert('Fehler', 'Bitte gib einen Titel ein');
      return;
    }

    const newId = (appointments.length + 1).toString();
    const appointmentToAdd = {
      ...newAppointment,
      id: newId,
      date: newAppointment.date || new Date(),
      type: newAppointment.type || 'other'
    } as Appointment;

    // Synchronisiere mit dem Kalender, wenn die Berechtigung erteilt wurde und der Benutzer es wünscht
    if (calendarPermission && syncWithCalendar) {
      try {
        console.log('Starte Synchronisierung mit dem Kalender...');
        const eventId = await syncAppointmentWithCalendar(appointmentToAdd);
        console.log('Kalender-Event-ID erhalten:', eventId);
        appointmentToAdd.calendarEventId = eventId;
      } catch (error) {
        console.error('Fehler beim Synchronisieren mit dem Kalender:', error);
        Alert.alert(
          'Kalender-Synchronisierung fehlgeschlagen',
          'Der Termin wurde in der App gespeichert, konnte aber nicht mit dem Kalender synchronisiert werden. Bitte überprüfe die Kalender-Berechtigungen in den Einstellungen deines Geräts.'
        );
      }
    } else {
      console.log('Keine Kalender-Synchronisierung durchgeführt:', {
        calendarPermission,
        syncWithCalendar
      });
    }

    setAppointments([...appointments, appointmentToAdd]);
    setNewAppointment({
      title: '',
      date: new Date(),
      location: '',
      notes: '',
      type: 'other'
    });
    setShowAddForm(false);
  };

  // Lösche einen Termin
  const deleteAppointment = (id: string) => {
    const appointment = appointments.find(app => app.id === id);

    Alert.alert(
      'Termin löschen',
      'Möchtest du diesen Termin wirklich löschen?',
      [
        {
          text: 'Abbrechen',
          style: 'cancel'
        },
        {
          text: 'Löschen',
          onPress: async () => {
            // Lösche den Termin aus dem Kalender, wenn er dort gespeichert ist
            if (appointment?.calendarEventId) {
              try {
                await deleteAppointmentFromCalendar(appointment.calendarEventId);
              } catch (error) {
                console.error('Fehler beim Löschen des Termins aus dem Kalender:', error);
                // Wir setzen fort, auch wenn das Löschen aus dem Kalender fehlschlägt
              }
            }

            setAppointments(appointments.filter(appointment => appointment.id !== id));
          },
          style: 'destructive'
        }
      ]
    );
  };

  // Rendere einen Termin
  const renderAppointmentItem = ({ item }: { item: Appointment }) => (
    <ThemedView
      style={styles.appointmentItem}
      lightColor={theme.card}
      darkColor={theme.card}
    >
      <View style={styles.appointmentHeader}>
        <View style={styles.appointmentTitleContainer}>
          <View style={[
            styles.appointmentTypeIndicator,
            {
              backgroundColor:
                item.type === 'doctor' ? '#FF9F9F' :
                item.type === 'checkup' ? '#9FD8FF' :
                '#D9D9D9'
            }
          ]} />
          <ThemedText style={styles.appointmentTitle}>{item.title}</ThemedText>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteAppointment(item.id)}
        >
          <IconSymbol name="trash" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      <View style={styles.appointmentDetails}>
        <View style={styles.appointmentDetailRow}>
          <IconSymbol name="calendar" size={16} color={theme.tabIconDefault} />
          <ThemedText style={styles.appointmentDetailText}>{formatDate(item.date)}</ThemedText>
        </View>

        <View style={styles.appointmentDetailRow}>
          <IconSymbol name="clock" size={16} color={theme.tabIconDefault} />
          <ThemedText style={styles.appointmentDetailText}>{formatTime(item.date)} Uhr</ThemedText>
        </View>

        {item.location ? (
          <View style={styles.appointmentDetailRow}>
            <IconSymbol name="location" size={16} color={theme.tabIconDefault} />
            <ThemedText style={styles.appointmentDetailText}>{item.location}</ThemedText>
          </View>
        ) : null}

        {item.notes ? (
          <View style={styles.appointmentDetailRow}>
            <IconSymbol name="doc.text" size={16} color={theme.tabIconDefault} />
            <ThemedText style={styles.appointmentDetailText}>{item.notes}</ThemedText>
          </View>
        ) : null}
      </View>
    </ThemedView>
  );

  return (
    <ImageBackground
      source={require('@/assets/images/Background_Hell.png')}
      style={styles.backgroundImage}
      resizeMode="repeat"
    >
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.text} />
            <ThemedText style={styles.backButtonText}>Zurück</ThemedText>
          </TouchableOpacity>

          <ThemedText type="title" style={styles.title}>
            Termine
          </ThemedText>
        </View>

        {showAddForm ? (
          // Formular zum Hinzufügen eines neuen Termins
          <ThemedView style={styles.addFormContainer} lightColor={theme.card} darkColor={theme.card}>
            <View style={styles.formHeader}>
              <ThemedText style={styles.formTitle}>Neuer Termin</ThemedText>
              <TouchableOpacity onPress={() => setShowAddForm(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={theme.tabIconDefault} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Titel</ThemedText>
              <TextInput
                style={[styles.formInput, { color: theme.text }]}
                placeholder="Titel des Termins"
                placeholderTextColor={theme.tabIconDefault}
                value={newAppointment.title}
                onChangeText={(text) => setNewAppointment({...newAppointment, title: text})}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Datum & Uhrzeit</ThemedText>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <ThemedText style={styles.datePickerButtonText}>
                  {newAppointment.date ? format(newAppointment.date, 'dd.MM.yyyy HH:mm', { locale: de }) : 'Datum auswählen'}
                </ThemedText>
                <IconSymbol name="calendar" size={20} color={theme.accent} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={newAppointment.date || new Date()}
                  mode="datetime"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setNewAppointment({...newAppointment, date: selectedDate});
                    }
                  }}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Ort</ThemedText>
              <TextInput
                style={[styles.formInput, { color: theme.text }]}
                placeholder="Ort des Termins"
                placeholderTextColor={theme.tabIconDefault}
                value={newAppointment.location}
                onChangeText={(text) => setNewAppointment({...newAppointment, location: text})}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Notizen</ThemedText>
              <TextInput
                style={[styles.formInput, styles.formTextarea, { color: theme.text }]}
                placeholder="Notizen zum Termin"
                placeholderTextColor={theme.tabIconDefault}
                value={newAppointment.notes}
                onChangeText={(text) => setNewAppointment({...newAppointment, notes: text})}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <ThemedText style={styles.formLabel}>
                  Im Kalender speichern
                  {!calendarPermission && (
                    <ThemedText style={styles.permissionHint}>
                      {' '}(Erfordert Kalender-Berechtigung)
                    </ThemedText>
                  )}
                </ThemedText>
                <Switch
                  value={calendarPermission && syncWithCalendar}
                  onValueChange={(value) => {
                    if (!calendarPermission && value) {
                      // Wenn der Benutzer versucht, die Synchronisierung zu aktivieren, aber keine Berechtigungen hat
                      Alert.alert(
                        'Kalender-Berechtigung erforderlich',
                        'Um Termine mit dem Kalender zu synchronisieren, benötigt die App Zugriff auf deinen Kalender. Bitte erteile die Berechtigung in den Einstellungen deines Geräts.',
                        [
                          { text: 'Abbrechen', style: 'cancel' },
                          {
                            text: 'Erneut versuchen',
                            onPress: async () => {
                              const hasPermission = await requestCalendarPermissions();
                              setCalendarPermission(hasPermission);
                              if (hasPermission) {
                                setSyncWithCalendar(true);
                              }
                            }
                          }
                        ]
                      );
                    } else {
                      setSyncWithCalendar(value);
                    }
                  }}
                  trackColor={{ false: '#D9D9D9', true: '#9FD8FF' }}
                  thumbColor={(calendarPermission && syncWithCalendar) ? '#7D5A50' : '#f4f3f4'}
                  disabled={!calendarPermission}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Typ</ThemedText>
              <View style={styles.typeButtonsContainer}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newAppointment.type === 'doctor' && styles.typeButtonSelected,
                    newAppointment.type === 'doctor' && { backgroundColor: '#FF9F9F' }
                  ]}
                  onPress={() => setNewAppointment({...newAppointment, type: 'doctor'})}
                >
                  <ThemedText style={styles.typeButtonText}>Arzttermin</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newAppointment.type === 'checkup' && styles.typeButtonSelected,
                    newAppointment.type === 'checkup' && { backgroundColor: '#9FD8FF' }
                  ]}
                  onPress={() => setNewAppointment({...newAppointment, type: 'checkup'})}
                >
                  <ThemedText style={styles.typeButtonText}>Vorsorge</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newAppointment.type === 'other' && styles.typeButtonSelected,
                    newAppointment.type === 'other' && { backgroundColor: '#D9D9D9' }
                  ]}
                  onPress={() => setNewAppointment({...newAppointment, type: 'other'})}
                >
                  <ThemedText style={styles.typeButtonText}>Sonstiges</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.accent }]}
              onPress={addAppointment}
            >
              <ThemedText style={styles.addButtonText}>Termin hinzufügen</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ) : (
          // Liste der Termine
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <IconSymbol name="magnifyingglass" size={20} color={theme.tabIconDefault} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Suche nach Terminen..."
                  placeholderTextColor={theme.tabIconDefault}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={theme.tabIconDefault} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <FlatList
              data={filteredAppointments}
              renderItem={renderAppointmentItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.appointmentsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <ThemedView style={styles.emptyState} lightColor={theme.card} darkColor={theme.card}>
                  <IconSymbol name="calendar.badge.exclamationmark" size={40} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyStateText}>
                    Keine Termine gefunden
                  </ThemedText>
                  <ThemedText style={styles.emptyStateSubtext}>
                    Füge deinen ersten Termin hinzu oder ändere deine Suchanfrage
                  </ThemedText>
                </ThemedView>
              }
            />

            <TouchableOpacity
              style={[styles.floatingAddButton, { backgroundColor: theme.accent }]}
              onPress={() => setShowAddForm(true)}
            >
              <IconSymbol name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    marginVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    paddingVertical: 4,
  },
  appointmentsList: {
    paddingBottom: 100,
  },
  appointmentItem: {
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  appointmentTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appointmentTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  appointmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  deleteButton: {
    padding: 4,
  },
  appointmentDetails: {
    marginTop: 8,
  },
  appointmentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  appointmentDetailText: {
    fontSize: 14,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addFormContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  formTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePickerButtonText: {
    fontSize: 16,
  },
  typeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  typeButtonSelected: {
    borderWidth: 2,
    borderColor: '#000',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionHint: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
  },
});
