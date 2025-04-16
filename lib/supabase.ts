import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// Supabase-Konfiguration
// Ersetzen Sie diese Werte mit Ihren eigenen Supabase-Projektdaten
export const supabaseUrl = 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bmlpeWF5aHpnamZxanNqY2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NzEyNjIsImV4cCI6MjA1OTU0NzI2Mn0.h0CL1_SXhfp9BXSPy0ipprs57qSZ8A_26wh2hP-8vZk';

// Konfiguration für die Entwicklungsumgebung
// Wir verwenden eine bedingte Prüfung, um sicherzustellen, dass der Code sowohl im Browser als auch in Node.js funktioniert
const isClient = typeof window !== 'undefined';

// Erstellen des Supabase-Clients mit einer Prüfung, ob wir im Browser oder in Node.js sind
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isClient ? AsyncStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce', // Empfohlen für mobile Apps
  },
});

// Hilfsfunktion, um zu prüfen, ob der Client bereit ist
export const isSupabaseReady = () => {
  return isClient;
};

// Debug-Funktion, um zu prüfen, ob Supabase korrekt funktioniert
export const checkSupabaseConnection = async () => {
  // Prüfen, ob wir im Browser sind
  if (!isClient) {
    console.log('Skipping Supabase connection check (server-side rendering)');
    return { success: false, error: 'Server-side rendering' };
  }

  // Prüfen, ob die Supabase-Anmeldedaten konfiguriert sind
  if (supabaseUrl.includes('example.supabase.co')) {
    console.log('Supabase credentials not configured, using demo mode');
    return { success: false, error: 'Supabase credentials not configured' };
  }

  try {
    // Timeout für die Verbindungsprüfung (3 Sekunden)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 3000);
    });

    // Supabase-Verbindungsprüfung
    const connectionPromise = supabase.from('contractions').select('count');

    // Wir verwenden Promise.race, um einen Timeout zu implementieren
    const result = await Promise.race([
      connectionPromise,
      timeoutPromise
    ]) as { data: any, error: any };

    if (result.error) {
      console.error('Supabase connection error:', result.error);
      return { success: false, error: result.error };
    }

    console.log('Supabase connection successful:', result.data);
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Supabase connection exception:', error);
    return { success: false, error };
  }
};

// Typdefinitionen für Supabase-Tabellen
export type Contraction = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration: number | null; // in seconds
  interval: number | null; // time since last contraction in seconds
  intensity: string | null; // Stärke der Wehe (schwach, mittel, stark)
  created_at: string;
};

export type ChecklistItem = {
  id: string;
  user_id: string;
  item_name: string;
  is_checked: boolean;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  position: number;
};

import { GeburtsplanData } from '@/types/geburtsplan';

export type Geburtsplan = {
  id: string;
  user_id: string;
  content: string;
  structured_data?: GeburtsplanData;
  created_at: string;
  updated_at: string;
};

// Hilfsfunktionen für die Authentifizierung

// E-Mail-Authentifizierung
export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

// Telefon-Authentifizierung
export const signUpWithPhone = async (phone: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    phone,
    password,
  });
  return { data, error };
};

export const signInWithPhone = async (phone: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    phone,
    password,
  });
  return { data, error };
};

// OTP (One-Time Password) für Telefon-Authentifizierung
export const signInWithOtp = async (phone: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
  });
  return { data, error };
};

export const verifyOtp = async (phone: string, token: string) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  return { data, error };
};

// Magic Link (passwortlose Anmeldung)
export const signInWithMagicLink = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
  });
  return { data, error };
};

// Social Logins
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  return { data, error };
};

export const signInWithApple = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
  });
  return { data, error };
};

export const signInWithFacebook = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
  });
  return { data, error };
};

// Anonyme Authentifizierung
export const signInAnonymously = async () => {
  const { data, error } = await supabase.auth.signUp({
    email: `${Math.random().toString(36).substring(2)}@anonymous.com`,
    password: Math.random().toString(36).substring(2),
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};

// Hilfsfunktionen für Wehen-Daten
export const saveContraction = async (contraction: Omit<Contraction, 'id' | 'user_id' | 'created_at'>) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: new Error('Nicht angemeldet') };

  const { data, error } = await supabase
    .from('contractions')
    .insert({
      ...contraction,
      user_id: userData.user.id,
    })
    .select()
    .single();

  return { data, error };
};

export const getContractions = async () => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

  const { data, error } = await supabase
    .from('contractions')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('start_time', { ascending: false });

  return { data, error };
};

export const updateContraction = async (id: string, updates: Partial<Contraction>) => {
  const { data, error } = await supabase
    .from('contractions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

export const deleteContraction = async (id: string) => {
  try {
    console.log(`Attempting to delete contraction with ID: ${id}`);

    const { error } = await supabase
      .from('contractions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting contraction with ID ${id}:`, error);
    }

    return { error };
  } catch (err) {
    console.error(`Exception when deleting contraction with ID ${id}:`, err);
    return { error: err instanceof Error ? err : new Error('Unknown error during deletion') };
  }
};

// Hilfsfunktionen für den Baby-Status
export const getBabyBornStatus = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: false, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('user_settings')
      .select('is_baby_born')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching baby born status:', error);
      return { data: false, error };
    }

    return { data: data?.is_baby_born || false, error: null };
  } catch (err) {
    console.error('Failed to get baby born status:', err);
    return { data: false, error: err };
  }
};

export const setBabyBornStatus = async (isBabyBorn: boolean) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Zuerst prüfen, ob bereits ein Eintrag existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing settings:', fetchError);
      return { data: null, error: fetchError };
    }

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Eintrag existiert, aktualisieren wir diesen
      result = await supabase
        .from('user_settings')
        .update({
          is_baby_born: isBabyBorn,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id);
    } else {
      // Wenn kein Eintrag existiert, erstellen wir einen neuen
      result = await supabase
        .from('user_settings')
        .insert({
          user_id: userData.user.id,
          is_baby_born: isBabyBorn,
          updated_at: new Date().toISOString()
        });
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to set baby born status:', err);
    return { data: null, error: err };
  }
};

// Hilfsfunktionen für den Geburtsplan

// Funktion zum Laden des Baby-Icons und Konvertieren in Base64
export const loadBabyIconBase64 = async (): Promise<string | null> => {
  try {
    // Lade das Bild
    const asset = Asset.fromModule(require('@/assets/images/Baby_Icon.png'));
    await asset.downloadAsync();

    // Lese die Datei als Base64
    const base64 = await FileSystem.readAsStringAsync(asset.localUri!, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return base64;
  } catch (error) {
    console.error('Fehler beim Laden des Baby-Icons:', error);
    return null;
  }
};

// Funktion zum Generieren und Herunterladen des Geburtsplans als PDF
export const generateGeburtsplanPDF = async () => {
  try {
    // Prüfen, ob der Benutzer angemeldet ist
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtsplan als PDF zu speichern.');
      return { success: false, error: new Error('Nicht angemeldet') };
    }

    // Lade den Geburtsplan
    const { data: geburtsplanData, error: geburtsplanError } = await getGeburtsplan();
    if (geburtsplanError) {
      Alert.alert('Fehler', 'Der Geburtsplan konnte nicht geladen werden.');
      return { success: false, error: geburtsplanError };
    }

    if (!geburtsplanData) {
      Alert.alert('Hinweis', 'Es wurde noch kein Geburtsplan erstellt.');
      return { success: false, error: new Error('Kein Geburtsplan vorhanden') };
    }

    // Generiere den Inhalt für das PDF
    let content = '';

    if (geburtsplanData.structured_data) {
      // Wenn strukturierte Daten vorhanden sind, generieren wir den Text aus diesen
      if (geburtsplanData.textContent) {
        content = geburtsplanData.textContent;
      } else {
        // Hier müssten wir die Funktion zum Generieren des Textes aus den strukturierten Daten aufrufen
        // Da diese Funktion aber in der Geburtsplan-Komponente definiert ist, verwenden wir den gespeicherten Text
        content = geburtsplanData.content || '';
      }
    } else {
      // Ansonsten verwenden wir den eingegebenen Text
      content = geburtsplanData.content || '';
    }

    // Lade das Baby-Icon
    const babyIconBase64 = await loadBabyIconBase64();

    // Hilfsfunktionen zum Formatieren des Inhalts
    const formatContent = (content: string): string => {
      // Ersetze Zeilenumbrüche durch <br>
      let formattedContent = content.replace(/\n/g, '<br>');

      // Ersetze Markdown-Überschriften durch HTML-Überschriften und entferne die Hashtags
      formattedContent = formattedContent.replace(/^# (.*)$/gm, '<h1>$1</h1>');
      formattedContent = formattedContent.replace(/^## (.*)$/gm, '<h2>$1</h2>');

      // Entferne alle verbliebenen Hashtags am Anfang von Zeilen
      formattedContent = formattedContent.replace(/^#+ (.*)(<br>|$)/gm, '<h3>$1</h3>');

      // Formatiere Schlüssel-Wert-Paare (z.B. "Name der Mutter: Anna")
      formattedContent = formattedContent.replace(/(.*?): (.*?)(<br>|$)/g, '<div class="item"><span class="item-label">$1:</span> <span class="item-value">$2</span></div>');

      return formattedContent;
    };

    const formatContentForHTMLLeftColumn = (content: string): string => {
      // Extrahiere die ersten drei Abschnitte (1-3)
      const sections = content.split(/\n\n/);
      let leftColumnContent = '';

      // Abschnitt 1: Allgemeine Angaben
      if (sections.length > 0 && sections[0].includes('GEBURTSPLAN')) {
        leftColumnContent += sections[0] + '\n\n';
      }

      // Abschnitt 1: Allgemeine Angaben
      const section1Index = sections.findIndex(s => s.includes('1. Allgemeine Angaben'));
      if (section1Index !== -1) {
        leftColumnContent += sections[section1Index] + '\n\n';
      }

      // Abschnitt 2: Wünsche zur Geburt
      const section2Index = sections.findIndex(s => s.includes('2. Wünsche zur Geburt'));
      if (section2Index !== -1) {
        leftColumnContent += sections[section2Index] + '\n\n';
      }

      // Abschnitt 3: Medizinische Eingriffe
      const section3Index = sections.findIndex(s => s.includes('3. Medizinische Eingriffe'));
      if (section3Index !== -1) {
        leftColumnContent += sections[section3Index] + '\n\n';
      }

      // Formatiere den Inhalt
      let formattedContent = formatContent(leftColumnContent);

      // Gruppiere Abschnitte
      formattedContent = formattedContent.replace(/<h2>(.*?)<\/h2>/g, '</div><div class="section"><h2>$1</h2>');

      // Schließe den ersten Abschnitt und füge einen öffnenden div für den ersten Abschnitt hinzu
      formattedContent = '<div class="section">' + formattedContent + '</div>';

      // Entferne leere Abschnitte
      formattedContent = formattedContent.replace(/<div class="section"><\/div>/g, '');

      return formattedContent;
    };

    const formatContentForHTMLRightColumn = (content: string): string => {
      // Extrahiere die letzten zwei Abschnitte (4-5)
      const sections = content.split(/\n\n/);
      let rightColumnContent = '';

      // Abschnitt 4: Nach der Geburt
      const section4Index = sections.findIndex(s => s.includes('4. Nach der Geburt'));
      if (section4Index !== -1) {
        rightColumnContent += sections[section4Index] + '\n\n';
      }

      // Abschnitt 5: Für den Notfall / Kaiserschnitt
      const section5Index = sections.findIndex(s => s.includes('5. Für den Notfall'));
      if (section5Index !== -1) {
        rightColumnContent += sections[section5Index] + '\n\n';
      }

      // Abschnitt 6: Sonstige Wünsche / Hinweise
      const section6Index = sections.findIndex(s => s.includes('6. Sonstige Wünsche'));
      if (section6Index !== -1) {
        rightColumnContent += sections[section6Index] + '\n\n';
      }

      // Formatiere den Inhalt
      let formattedContent = formatContent(rightColumnContent);

      // Gruppiere Abschnitte
      formattedContent = formattedContent.replace(/<h2>(.*?)<\/h2>/g, '</div><div class="section"><h2>$1</h2>');

      // Schließe den ersten Abschnitt und füge einen öffnenden div für den ersten Abschnitt hinzu
      formattedContent = '<div class="section">' + formattedContent + '</div>';

      // Entferne leere Abschnitte
      formattedContent = formattedContent.replace(/<div class="section"><\/div>/g, '');

      return formattedContent;
    };

    // Erstelle HTML für das PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Mein Geburtsplan</title>
        <style>
          @page {
            margin: 1.5cm;
            size: A4;
          }
          body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            margin: 0;
            padding: 0;
            color: #333;
            background-color: #FFF8F0;
            font-size: 10pt;
          }
          .container {
            max-width: 100%;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #E8D5C4;
          }
          h1 {
            color: #7D5A50;
            font-size: 18pt;
            margin: 0 0 5px 0;
          }
          h2 {
            color: #7D5A50;
            font-size: 12pt;
            margin: 10px 0 5px 0;
            border-bottom: 1px solid #E8D5C4;
            padding-bottom: 3px;
          }
          h3 {
            color: #7D5A50;
            font-size: 11pt;
            margin: 8px 0 4px 0;
          }
          p {
            margin: 4px 0;
          }
          .columns {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            gap: 20px;
          }
          .column {
            width: 48%;
          }
          .section {
            margin-bottom: 10px;
          }
          .item {
            margin-bottom: 4px;
          }
          .item-label {
            font-weight: bold;
            color: #5D4037;
          }
          .item-value {
            margin-left: 3px;
          }
          .footer {
            text-align: center;
            margin-top: 15px;
            font-size: 9pt;
            color: #7D5A50;
            font-style: italic;
            border-top: 1px solid #E8D5C4;
            padding-top: 10px;
          }
          .baby-icon {
            text-align: center;
            margin: 10px auto;
          }
          .baby-icon img {
            height: 50px;
            width: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mein Geburtsplan</h1>
            <p>Erstellt am ${new Date().toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
          </div>

          <div class="columns">
            <div class="column left-column">
              ${formatContentForHTMLLeftColumn(content)}
            </div>
            <div class="column right-column">
              ${formatContentForHTMLRightColumn(content)}
            </div>
          </div>

          <div class="footer">
            ${babyIconBase64 ? `<div class="baby-icon"><img src="data:image/png;base64,${babyIconBase64}" alt="Baby Icon" /></div>` : ''}
            <p>Dieser Geburtsplan wurde mit der Wehen-Tracker App erstellt.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Generiere das PDF mit expo-print
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // Teile die PDF-Datei
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Geburtsplan als PDF speichern',
        UTI: 'com.adobe.pdf'
      });
      return { success: true, error: null };
    } else {
      Alert.alert('Teilen nicht verfügbar', 'Das Teilen von Dateien wird auf diesem Gerät nicht unterstützt.');
      return { success: false, error: new Error('Teilen nicht verfügbar') };
    }

  } catch (error) {
    console.error('Fehler beim Generieren des PDFs:', error);
    Alert.alert('Fehler', 'Der Geburtsplan konnte nicht als PDF gespeichert werden.');
    return { success: false, error };
  }
};

// Prüfen, ob ein Geburtsplan existiert
export const hasGeburtsplan = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { exists: false, error: new Error('Nicht angemeldet') };

    // Wir prüfen, ob ein Geburtsplan existiert
    const { data, error } = await supabase
      .from('geburtsplan')
      .select('id')
      .eq('user_id', userData.user.id)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    return { exists: !!data, error: null };
  } catch (error) {
    console.error('Error checking geburtsplan existence:', error);
    return { exists: false, error };
  }
};

export const getGeburtsplan = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Wir holen alle Geburtspläne des Benutzers, sortiert nach dem neuesten zuerst
    const { data, error } = await supabase
      .from('geburtsplan')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows returned

    // Wenn Daten gefunden wurden, prüfen wir, ob der Inhalt ein gültiges JSON ist
    if (data && data.content) {
      try {
        // Prüfen, ob der Inhalt mit einem { beginnt (wahrscheinlich JSON)
        if (data.content.trim().startsWith('{')) {
          const parsedContent = JSON.parse(data.content);

          // Prüfen, ob es das neue Format mit structuredData und textContent ist
          if (parsedContent.structuredData && parsedContent.textContent) {
            data.structured_data = parsedContent.structuredData;
            data.textContent = parsedContent.textContent;
          }
          // Prüfen, ob es das alte Format mit allgemeineAngaben ist
          else if (parsedContent.allgemeineAngaben) {
            data.structured_data = parsedContent;
          }
          // Sonst ist es wahrscheinlich ein einfacher Text
          else {
            // Nichts tun, der Inhalt bleibt in data.content
          }
        }
      } catch (e) {
        // Wenn das Parsen fehlschlägt, ist es wahrscheinlich kein JSON, also ignorieren wir es
        console.log('Content is not valid JSON, treating as plain text');
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching geburtsplan:', error);
    return { data: null, error };
  }
};

// Speichern oder Aktualisieren des Geburtsplans (Textversion)
export const saveGeburtsplan = async (content: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Zuerst prüfen, ob bereits ein Geburtsplan existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('geburtsplan')
      .select('id')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Geburtsplan existiert, aktualisieren wir diesen
      result = await supabase
        .from('geburtsplan')
        .update({
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id)
        .select()
        .single();
    } else {
      // Wenn kein Geburtsplan existiert, erstellen wir einen neuen
      result = await supabase
        .from('geburtsplan')
        .insert({
          user_id: userData.user.id,
          content,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving geburtsplan:', error);
    return { data: null, error };
  }
};

// Speichern oder Aktualisieren des strukturierten Geburtsplans
export const saveStructuredGeburtsplan = async (structuredData: any, textContent: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Wir speichern die strukturierten Daten und den generierten Text zusammen in der content-Spalte
    const combinedData = {
      structuredData: structuredData,
      textContent: textContent
    };
    const combinedContent = JSON.stringify(combinedData);

    // Zuerst prüfen, ob bereits ein Geburtsplan existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('geburtsplan')
      .select('id')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Geburtsplan existiert, aktualisieren wir diesen
      result = await supabase
        .from('geburtsplan')
        .update({
          content: combinedContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id)
        .select()
        .single();
    } else {
      // Wenn kein Geburtsplan existiert, erstellen wir einen neuen
      result = await supabase
        .from('geburtsplan')
        .insert({
          user_id: userData.user.id,
          content: combinedContent,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) throw error;

    // Für die Rückgabe setzen wir die strukturierten Daten, damit die Anwendung sie verwenden kann
    if (data) {
      data.structured_data = structuredData;
      data.textContent = textContent;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error saving structured geburtsplan:', error);
    return { data: null, error };
  }
};

// Löschen des Geburtsplans
export const deleteGeburtsplan = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: new Error('Nicht angemeldet') };

    const { error } = await supabase
      .from('geburtsplan')
      .delete()
      .eq('user_id', userData.user.id);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting geburtsplan:', error);
    return { error };
  }
};

// Hilfsfunktionen für die Krankenhaus-Checkliste

// Abrufen aller Checklisten-Einträge
export const getHospitalChecklist = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('hospital_checklist')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('position', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching hospital checklist:', error);
    return { data: null, error };
  }
};

// Hinzufügen eines neuen Checklisten-Eintrags
export const addChecklistItem = async (item: Omit<ChecklistItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('hospital_checklist')
      .insert({
        ...item,
        user_id: userData.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error adding checklist item:', error);
    return { data: null, error };
  }
};

// Aktualisieren eines Checklisten-Eintrags
export const updateChecklistItem = async (id: string, updates: Partial<ChecklistItem>) => {
  try {
    const { data, error } = await supabase
      .from('hospital_checklist')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return { data: null, error };
  }
};

// Aktualisieren des Status eines Checklisten-Eintrags (abgehakt/nicht abgehakt)
export const toggleChecklistItem = async (id: string, isChecked: boolean) => {
  return updateChecklistItem(id, { is_checked: isChecked });
};

// Löschen eines Checklisten-Eintrags
export const deleteChecklistItem = async (id: string) => {
  try {
    const { error } = await supabase
      .from('hospital_checklist')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return { error };
  }
};

// Aktualisieren der Position mehrerer Checklisten-Einträge (für Drag & Drop)
export const updateChecklistPositions = async (items: { id: string, position: number }[]) => {
  try {
    const updates = items.map(item => ({
      id: item.id,
      position: item.position
    }));

    const { data, error } = await supabase
      .from('hospital_checklist')
      .upsert(updates, { onConflict: 'id' })
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating checklist positions:', error);
    return { data: null, error };
  }
};
