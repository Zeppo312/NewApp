import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

// Typdefinition für einen Termin
export interface Appointment {
  id: string;
  title: string;
  date: Date;
  location: string;
  notes: string;
  type: 'doctor' | 'checkup' | 'other';
  calendarEventId?: string; // ID des Kalendereintrags
}

// Farben für verschiedene Termintypen
const APPOINTMENT_COLORS = {
  doctor: '#FF9F9F',  // Rosa
  checkup: '#9FD8FF', // Hellblau
  other: '#D9D9D9'    // Grau
};

/**
 * Anfordern der Kalender-Berechtigungen
 * @returns {Promise<boolean>} True, wenn die Berechtigungen erteilt wurden
 */
export const requestCalendarPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    console.log('Kalender-Berechtigungsstatus:', status);
    return status === 'granted';
  } catch (error) {
    console.error('Fehler beim Anfordern der Kalender-Berechtigungen:', error);
    return false;
  }
};

/**
 * Abrufen der Standard-Kalender-ID
 * @returns {Promise<string>} ID des Standardkalenders
 */
export const getDefaultCalendarId = async (): Promise<string> => {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    console.log('Verfügbare Kalender:', JSON.stringify(calendars, null, 2));

    // Auf iOS suchen wir nach dem iCloud-Kalender oder dem ersten verfügbaren Kalender
    if (Platform.OS === 'ios') {
      // Zuerst versuchen wir, den Standardkalender zu finden
      let defaultCalendar = calendars.find(cal => cal.isDefaultCalendar);

      // Wenn kein Standardkalender gefunden wurde, suchen wir nach dem iCloud-Kalender
      if (!defaultCalendar) {
        defaultCalendar = calendars.find(
          cal => cal.source && cal.source.name === 'iCloud' && cal.allowsModifications
        );
      }

      // Wenn immer noch kein Kalender gefunden wurde, nehmen wir den ersten, der Änderungen erlaubt
      if (!defaultCalendar) {
        defaultCalendar = calendars.find(cal => cal.allowsModifications);
      }

      // Wenn immer noch kein Kalender gefunden wurde, nehmen wir einfach den ersten
      if (!defaultCalendar && calendars.length > 0) {
        defaultCalendar = calendars[0];
      }

      console.log('Ausgewählter iOS-Kalender:', defaultCalendar);
      return defaultCalendar?.id || '';
    }

    // Auf Android suchen wir nach dem Standardkalender
    let defaultCalendar = calendars.find(cal => cal.isPrimary);

    // Wenn kein primärer Kalender gefunden wurde, suchen wir nach einem, der Änderungen erlaubt
    if (!defaultCalendar) {
      defaultCalendar = calendars.find(cal => cal.allowsModifications);
    }

    // Wenn immer noch kein Kalender gefunden wurde, nehmen wir einfach den ersten
    if (!defaultCalendar && calendars.length > 0) {
      defaultCalendar = calendars[0];
    }

    console.log('Ausgewählter Android-Kalender:', defaultCalendar);
    return defaultCalendar?.id || '';
  } catch (error) {
    console.error('Fehler beim Abrufen der Kalender:', error);
    return '';
  }
};

/**
 * Hinzufügen eines Termins zum Kalender
 * @param {Appointment} appointment - Der Termin, der hinzugefügt werden soll
 * @returns {Promise<string>} ID des erstellten Kalendereintrags
 */
export const addAppointmentToCalendar = async (appointment: Appointment): Promise<string> => {
  try {
    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
      throw new Error('Kein Kalender verfügbar');
    }

    console.log('Versuche, Termin zum Kalender hinzuzufügen:', {
      calendarId,
      title: appointment.title,
      date: appointment.date
    });

    // Erstellen des Kalendereintrags
    const eventDetails = {
      title: appointment.title,
      startDate: appointment.date,
      endDate: new Date(appointment.date.getTime() + 60 * 60 * 1000), // 1 Stunde später
      location: appointment.location || '',
      notes: appointment.notes || '',
      allDay: false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      alarms: [{ relativeOffset: -60 }] // Erinnerung 1 Stunde vorher
    };

    // Auf iOS können wir die Farbe nicht direkt setzen
    if (Platform.OS === 'android') {
      eventDetails['color'] = APPOINTMENT_COLORS[appointment.type];
    }

    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);
    console.log('Termin erfolgreich zum Kalender hinzugefügt, ID:', eventId);

    return eventId;
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Termins zum Kalender:', error);
    throw error;
  }
};

/**
 * Aktualisieren eines Termins im Kalender
 * @param {Appointment} appointment - Der aktualisierte Termin
 * @returns {Promise<void>}
 */
export const updateAppointmentInCalendar = async (appointment: Appointment): Promise<void> => {
  try {
    if (!appointment.calendarEventId) {
      throw new Error('Kein Kalendereintrag vorhanden');
    }

    console.log('Versuche, Termin im Kalender zu aktualisieren:', {
      eventId: appointment.calendarEventId,
      title: appointment.title,
      date: appointment.date
    });

    // Aktualisieren des Kalendereintrags
    const eventDetails = {
      title: appointment.title,
      startDate: appointment.date,
      endDate: new Date(appointment.date.getTime() + 60 * 60 * 1000), // 1 Stunde später
      location: appointment.location || '',
      notes: appointment.notes || '',
      alarms: [{ relativeOffset: -60 }] // Erinnerung 1 Stunde vorher
    };

    // Auf iOS können wir die Farbe nicht direkt setzen
    if (Platform.OS === 'android') {
      eventDetails['color'] = APPOINTMENT_COLORS[appointment.type];
    }

    await Calendar.updateEventAsync(appointment.calendarEventId, eventDetails);
    console.log('Termin erfolgreich im Kalender aktualisiert');
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Termins im Kalender:', error);
    throw error;
  }
};

/**
 * Löschen eines Termins aus dem Kalender
 * @param {string} eventId - ID des Kalendereintrags
 * @returns {Promise<void>}
 */
export const deleteAppointmentFromCalendar = async (eventId: string): Promise<void> => {
  try {
    if (!eventId) {
      console.log('Keine Kalender-Event-ID vorhanden, nichts zu löschen');
      return; // Wenn keine ID vorhanden ist, gibt es nichts zu löschen
    }

    console.log('Versuche, Termin aus dem Kalender zu löschen, ID:', eventId);
    await Calendar.deleteEventAsync(eventId);
    console.log('Termin erfolgreich aus dem Kalender gelöscht');
  } catch (error) {
    console.error('Fehler beim Löschen des Termins aus dem Kalender:', error);
    throw error;
  }
};

/**
 * Synchronisieren eines Termins mit dem Kalender (hinzufügen oder aktualisieren)
 * @param {Appointment} appointment - Der zu synchronisierende Termin
 * @returns {Promise<string>} ID des Kalendereintrags
 */
export const syncAppointmentWithCalendar = async (appointment: Appointment): Promise<string> => {
  try {
    if (appointment.calendarEventId) {
      // Wenn bereits ein Kalendereintrag existiert, aktualisieren wir ihn
      await updateAppointmentInCalendar(appointment);
      return appointment.calendarEventId;
    } else {
      // Ansonsten erstellen wir einen neuen Eintrag
      const eventId = await addAppointmentToCalendar(appointment);
      return eventId;
    }
  } catch (error) {
    console.error('Fehler beim Synchronisieren des Termins mit dem Kalender:', error);
    throw error;
  }
};
