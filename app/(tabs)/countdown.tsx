import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, Platform, SafeAreaView, StatusBar, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import CountdownTimer from '@/components/CountdownTimer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase, hasGeburtsplan, getDueDateWithLinkedUsers, updateDueDateAndSync } from '@/lib/supabase';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { generateAndDownloadPDF } from '@/lib/geburtsplan-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { pregnancyMotherInfo } from '@/constants/PregnancyMotherInfo';
import { pregnancyPartnerInfo } from '@/constants/PregnancyPartnerInfo';
import { pregnancySymptoms } from '@/constants/PregnancySymptoms';
import Header from '@/components/Header';

// Definiere Typen für die verknüpften Benutzer
interface LinkedUser {
  firstName: string;
  id: string;
}

// Interface für die Tagesinformationen
interface DayInfo {
  baby: string;
  mother: string;
  partner: string;
  symptoms: string[];
}

// Konstanten für Überfälligkeits-Informationen
const overdueInfo: Record<number, DayInfo> & { default: DayInfo } = {
  // Tag 1 nach ET
  1: {
    baby: "Dein Baby ist nach wie vor optimal versorgt. Die Plazenta liefert zuverlässig Sauerstoff und Nährstoffe, doch der Platz wird langsam enger. Viele Babys schlafen jetzt mehr, ihre Bewegungen können sich etwas verändern. Achte darauf, Tritte weiterhin täglich bewusst wahrzunehmen.",
    mother: "Die Geduld wird geprüft – du bist bereit, aber es passiert noch nichts. Gönn dir bewusste Auszeiten: Meditation, warmes Bad (sofern Hebamme/Ärzt:in zustimmen) oder ein Spaziergang zum Ankurbeln der Durchblutung. Beobachte Frühwehen oder Schleimpfropf-Abgang. Bei Unsicherheit lieber einmal mehr telefonieren als grübeln.",
    partner: "Sei verfügbar und proaktiv. Kümmere dich um kleine Alltagsaufgaben, damit sie loslassen kann. Frische Lieblingssnacks, ein wärmendes Kirschkernkissen oder gemeinsames Streaming können Wunder wirken. Halte den Tankstand des Autos im Auge – Abfahrt kann jederzeit sein.",
    symptoms: [
      "Harter, tiefer Bauch",
      "Verstärkter Ausfluss",
      "Zunehmender Druck im Becken",
      "Vorwehen (Übungswehen)",
      "Rückenschmerzen",
      "Verstärkte Müdigkeit",
      "Emotionale Anspannung"
    ]
  },
  // Tag 2 nach ET
  2: {
    baby: "Das Kind profitiert weiter von Antikörpern der Mutter und lagert Fettreserven ein, die nach der Geburt beim Temperaturhalten helfen. Flüssigkeit im Fruchtwasser bleibt entscheidend – CTG/Ultraschall geben Aufschluss. Bewegungen spüren? Ja, aber sie können \"gleitender\" wirken, nicht mehr so kraftvoll.",
    mother: "Leichte Wassereinlagerungen, Rückenschmerzen oder verstärkte Müdigkeit sind häufig. Wärme (z. B. Kirschkernkissen) und sanftes Dehnen entlasten. Versuche, dich nicht auf Social-Media-Fragen (\"Ist das Baby schon da?\") einzulassen – setze klare Grenzen.",
    partner: "Organisiere gemeinsame \"Ablenk-Dates\": kurzer Stadtbummel, frische Luft, Café-Besuch. Frage aktiv nach ihrem Befinden, ohne Druck aufzubauen. Prüfe Kliniktasche auf Vollständigkeit (Ladekabel, Snacks, Haargummis).",
    symptoms: [
      "Leichte Wassereinlagerungen",
      "Verstärkte Rückenschmerzen", 
      "Zunehmende Müdigkeit",
      "Unregelmäßige Vorwehen",
      "Vermehrter Harndrang", 
      "Veränderter Ausfluss",
      "Mentale Unruhe"
    ]
  },
  // Tag 3 nach ET
  3: {
    baby: "Alles im grünen Bereich, doch Arzt/Ärztin prüft jetzt häufig Fruchtwasserqualität und Plazentadurchblutung. Vernix (Käseschmiere) ist fast komplett verschwunden; Haut kann im Fruchtwasser leicht aufquellen – völlig normal.",
    mother: "Unregelmäßige Vorwehen können schmerzhafter werden; vertraue darauf, dass dein Körper übt. Bleib in Bewegung: Treppen steigen, leichter Yoga-Walk. Führe ein Wohlfühl-Journal – was tut dir gut, was stresst?",
    partner: "Übernimm Kommunikation mit Familie/Freunden (\"Wir melden uns!\"). Bereite eine Playlist fürs Kreißzimmer vor – stimme sie mit der werdenden Mama ab. Emotionaler Rückhalt zählt mehr als Lösungen.",
    symptoms: [
      "Intensivere Vorwehen",
      "Mehr Druck nach unten",
      "Schlafstörungen",
      "Erhöhter Ausfluss",
      "Leichte Übelkeit",
      "Veränderter Appetit",
      "Anhaltende Rückenschmerzen"
    ]
  },
  // Tag 4 nach ET
  4: {
    baby: "Plazentaleistung kann beginnen, minimal nachzulassen – medizinisches Monitoring wird wichtiger. Dein Baby übt weiterhin Atembewegungen, schluckt Fruchtwasser und trainiert Darm und Lunge.",
    mother: "Das Gewicht des Babys drückt stärker auf Becken und Ischias. Wärme, leichte Becken-Kreise im Vierfüßlerstand oder ein Gymnastikball schaffen Entlastung. Sprich Ängste offen an: Einleitung, Kaiserschnitt – Wissen reduziert Sorge.",
    partner: "Biete Massagen für Rücken und Füße an; zeige, dass du präsent bist. Erledige letzte Erledigungen (Apotheke, Müll rausbringen). Mach einen Probe-Fahrweg zur Klinik zu verkehrsintensiven Zeiten.",
    symptoms: [
      "Ischiasschmerzen",
      "Häufigeres Wasserlassen",
      "Spürbarer Druck auf Becken",
      "Zunehmende Erschöpfung",
      "Verstärkte Vorwehen",
      "Schlafprobleme",
      "Stärkerer Ausfluss"
    ]
  },
  // Tag 5 nach ET
  5: {
    baby: "Kindliche Kopfform kann sich weiter anpassen und tiefer ins Becken rutschen. Fruchtwassermenge wird per Ultraschall gemessen; Werte sind noch meist stabil.",
    mother: "Viele Kliniken bieten jetzt Aufklärungsgespräch zur Einleitung an: Pro- und Kontra, Methoden (Gel, Ballon, Oxytocin). Notiere Fragen vorab. Gönn dir protein- und magnesiumreiche Kost – hilft Muskeln und Nerven.",
    partner: "Sei beim Aufklärungsgespräch dabei, nimm Notizen. Plane kurze, wohltuende Aktivitäten – Spaziergang im Park, Hörbuch mit Kopfhörern. Halte Handy stets geladen, lade sie zum Power-Napping ein.",
    symptoms: [
      "Verstärkte Beckendruckbeschwerden",
      "Zunahme der Vorwehen",
      "Öfter wechselnde Stimmung",
      "Möglicher Abgang des Schleimpfropfs",
      "Verdauungsprobleme",
      "Verstärktes Sodbrennen",
      "Beinschwellungen"
    ]
  },
  // Tag 6 nach ET
  6: {
    baby: "Herz- und Atemfrequenz werden beim CTG genau beobachtet. Meist zeigt sich alles unauffällig; Babys verkraften diese Extra-Tage gut. Bewegungen können langsamer, aber rhythmisch sein.",
    mother: "Schlaf wird schwerer, weil Beckenboden drückt. Seitenschläferkissen oder Stillkissen unterstützen. Achte auf klare Fruchtwasserabgänge – bei grünlichem Wasser sofort Klinik anrufen.",
    partner: "Übernimm nächtliche Aufsteh-Hilfen (Kissen richten, Wasser holen). Organisiere ein leichtes Abendessen mit viel Omega-3 (z. B. Avocado, Lachs), stärkt beide. Worte wie \"Entspann dich doch\" vermeiden – biete stattdessen konkrete Hilfe.",
    symptoms: [
      "Schlaflosigkeit",
      "Zunehmender Druck auf Beckenboden",
      "Veränderte Kindsbewegungen",
      "Unregelmäßige Kontraktionen",
      "Verstärkter Harndrang",
      "Verdauungsbeschwerden",
      "Emotionale Erschöpfung"
    ]
  },
  // Tag 7 nach ET
  7: {
    baby: "Ab heute sprechen viele Ärzt:innen von \"post-term\". Noch immer gut geschützt, doch Monitoring wird alle 1-2 Tage empfohlen: CTG, Doppler, Fruchtwasser.",
    mother: "Körperlich kann sich Schweregefühl steigern. Vielleicht erhältst du einen Termin zur Einleitung in den nächsten Tagen. Akupressur an Hand- und Fußpunkten (Hebamme) kann Wehentätigkeit anregen; wissenschaftlich nicht eindeutig, aber vielen hilft es psychisch.",
    partner: "Bleib sachlich, aber optimistisch. Erkläre Schritte der Einleitung, damit keine offenen Fragen bleiben. Sorge für gute Erreichbarkeit (Diensthandy-Weiterleitung, Meeting-Vertretungen klären).",
    symptoms: [
      "Deutliches Schweregefühl",
      "Verstärkte Vorwehen",
      "Reizbarkeit & Ungeduld",
      "Energiemangel",
      "Zunehmende Schlafstörungen",
      "Verstärkter Ausfluss",
      "Veränderungen im Appetit"
    ]
  },
  // Tag 8 nach ET
  8: {
    baby: "Käseschmiere ist weg, dafür produziert die Haut schützendes Fett. Haare und Nägel wachsen weiter – viele \"über-Termin-Babys\" kommen mit weichen Fingernägeln zur Welt.",
    mother: "Häufigere CTGs (ggf. täglich). Setze auf leicht verdauliche Mahlzeiten; ein voller Magen kann Übelkeit bei Wehen verstärken. Bleibe hydriert, 2–3 Liter Wasser/ungesüßte Tees.",
    partner: "Plane Mahlzeiten mit: leichte Suppe, gedünstetes Gemüse, Proteine. Überrasche mit Mini-Wellness: Fußbad, Aromadiffuser (Lavendel, sofern sie es mag). Ermuntere zu leichten Lockerungsübungen – mach einfach mit.",
    symptoms: [
      "Erhöhte Müdigkeit",
      "Vermehrte Wadenkrämpfe",
      "Häufigere Vorwehen",
      "Zunehmende Rückenbeschwerden",
      "Gesteigerter Harndrang",
      "Verlangsamte Verdauung",
      "Schwere in den Beinen"
    ]
  },
  // Tag 9 nach ET
  9: {
    baby: "Fruchtwasser wird gelegentlich weniger; Ärzte achten auf klare, nicht grünliche Flüssigkeit. Kindliche Haut kann leicht trocken sein – später keine Sorge, Creme löst das schnell.",
    mother: "Darmträgheit nimmt zu; ballaststoffreiche Nahrung (Hafer, Trockenpflaumen) beugt Verstopfung vor. Sanfte Bauchmassage (Uhrzeigersinn) fördert Wohlgefühl.",
    partner: "Unterstütze bei Ernährung: frische Früchte schneiden, Overnight-Oats vorbereiten. Höre aktiv zu, wenn Ängste hochkommen – nicht relativieren, sondern bestätigen (\"Ich verstehe, dass du…\").",
    symptoms: [
      "Verstopfung",
      "Zunehmende Ungeduld",
      "Intensive Hitzewallungen",
      "Verstärkte Schlaflosigkeit",
      "Häufigere Kontraktionen",
      "Reizbare Stimmung",
      "Druckgefühl im Unterleib"
    ]
  },
  // Tag 10 nach ET
  10: {
    baby: "Einleitung wird jetzt intensiv besprochen. Babys jenseits ET + 10 zeigen leicht erhöhtes Risiko für Unterversorgung, daher engmaschige Checks.",
    mother: "Termin zur Einleitung oft innerhalb der nächsten 48 Stunden. Informiere dich über Verfahren: Prostaglandin-Gel, Ballonkatheter, intravenöses Oxytocin. Wähle bequeme Kleidung für Klinikaufenthalt, inkl. eigener Bademantel.",
    partner: "Organisiere Arbeitsvertretung ab jetzt flexibel. Packe Extras in Kliniktasche: Ladekabel-Verlängerung, Wechsel-T-Shirt, Münzen für Automaten. Bereite aufmunternde Sprachnachrichten von Freunden/Familie vor (nur abspielen, wenn sie es möchte).",
    symptoms: [
      "Deutliche Erschöpfung",
      "Intensive Vorwehen",
      "Schleimiger Ausfluss",
      "Stärkste Rückenschmerzen",
      "Extreme Beckendruckbeschwerden",
      "Gereiztheit & Unruhe",
      "Magenverstimmung"
    ]
  },
  // Tag 11 nach ET
  11: {
    baby: "Dauermonitoring denkbar (CTG-Gurt, CTG-Langzeit). Bewegungen weiterhin bewusster wahrnehmen und nach Leitlinien dokumentieren (z. B. 10 Bewegungen in 2 Stunden).",
    mother: "Hormonelle Veränderungen können Stimmungsschwankungen verstärken. Sprich offen, wenn du dich überrollt fühlst. Leichte Dehnungen im Vierfüßlerstand entlasten Kreuzbein und fördern Babyliegeposition.",
    partner: "Akzeptiere Stimmungstief ohne Ratschlag-Reflex. Biete körperliche Nähe (Handhalten, Rücken streicheln), wenn erwünscht. Übernimm To-do-Listen und besorge fehlende Dokumente (Mutterpass, Personalausweise).",
    symptoms: [
      "Starke Stimmungsschwankungen",
      "Zunehmende Muskelschmerzen",
      "Abnehmende Beweglichkeit",
      "Anhaltende Sodbrennen",
      "Verstärkte Erschöpfung",
      "Tränen & Emotionalität",
      "Gesteigerte Nervosität"
    ]
  },
  // Tag 12 nach ET
  12: {
    baby: "Fruchtwasseranalyse besonders wichtig. Falls Werte kritisch, entscheidet Team eventuell über sofortige Einleitung oder Kaiserschnitt.",
    mother: "Möglicherweise stationäre Aufnahme zur Einleitung. Nimm Kopfhörer, Augenkissen, Lieblingslotion mit – kleine Comfort-Items entspannen. Bleibe aktiv: Klinikflure entlangspazieren, soweit erlaubt.",
    partner: "Rechne mit Wartezeiten: Lade Tablet mit Filmen, nimm Buch/Zeitschriften. Bringe eigene Snacks (Kliniken haben begrenzte Kantinenzeiten). Bleibe Ansprechpartner – auch nachts.",
    symptoms: [
      "Verstärkte Vorwehen mit Regelmäßigkeit",
      "Erhöhter Ausfluss",
      "Spannungsgefühl im Unterleib",
      "Extreme Erschöpfung",
      "Schlaflosigkeit",
      "Anhaltende Rückenschmerzen",
      "Gesteigerte Sensibilität für Geräusche/Gerüche"
    ]
  },
  // Tag 13 nach ET
  13: {
    baby: "Bei anhaltender Schwangerschaft steigt das Risiko für Mekonium (Kindspech) im Fruchtwasser – Teams handeln zügig, um Komplikationen vorzubeugen.",
    mother: "Einleitungsmaßnahmen laufen ggf. schon: Wehencocktail, Prostaglandin oder Ballon. Ruh dich zwischen CTG‐Intervallen aus, aber bewege dich während Wehenpausen, um Schwerkraft zu nutzen.",
    partner: "Unterstütze mit Atem-Timing-App oder Zählen während Wehen, falls gewünscht. Organisiere Wärmflasche/Waschlappen. Sage motivierende Sätze (\"Jede Wehe bringt euch näher zueinander\").",
    symptoms: [
      "Regelmäßige Wehen",
      "Verstärkter Schleimpfropfabgang",
      "Starker Druck nach unten",
      "Zunehmende Übelkeit",
      "Intensivierung aller Symptome",
      "Besonders starke Rückenschmerzen",
      "Erhöhte Körpertemperatur möglich"
    ]
  },
  // Tag 14 nach ET (42+0)
  14: {
    baby: "Medizinischer Konsens: Spätestens heute wird die Geburt eingeleitet oder ein Kaiserschnitt erwogen. Plazentafunktion nimmt statistisch ab, Sauerstoffversorgung könnte sinken.",
    mother: "Du erreichst die äußerste Grenze der Terminschwangerschaft. Vertraue auf dein Team – es hat deine Werte im Blick. Bleibe fokussiert auf Atmung und Zwischenpausen-Entspannung. Halte Motivation hoch: Dein Kind ist gleich bei dir!",
    partner: "Höchste Präsenz: Keine Ablenkungen, Handy lautlos außer wichtigen Anrufen. Erinnere sie ans Trinken zwischen Wehen. Bleibe ruhig, auch wenn Entscheidungen (z. B. Kaiserschnitt) spontan fallen – deine Gelassenheit überträgt sich.",
    symptoms: [
      "Intensive, regelmäßige Wehen",
      "Möglicher Fruchtwasserabgang",
      "Extremer Druck im Becken",
      "Übelkeit und/oder Erbrechen",
      "Zittern oder Schüttelfrost",
      "Starke Kreuzschmerzen",
      "Extreme physische & emotionale Erschöpfung"
    ]
  },
  // Fallback für Tage >14
  default: {
  baby: "Dein Baby ist jetzt vollständig entwickelt. Die Plazenta versorgt es weiterhin mit allen notwendigen Nährstoffen. Die Verbindung zwischen euch beiden ist stärker denn je. Das Immunsystem deines Babys wird durch die Übertragung von Antikörpern über die Plazenta weiter gestärkt.",
  mother: "Viele Frauen empfinden diese Wartezeit als besonders anstrengend. Versuche dich abzulenken und nutze die Zeit für Entspannung. Bewegung kann helfen, den Geburtsprozess anzuregen. Achte auf Anzeichen für Wehen oder den Abgang des Mutterkuchens. Bei Unsicherheiten kontaktiere immer deine Hebamme oder deinen Arzt.",
  partner: "Deine Unterstützung ist jetzt besonders wichtig. Sei geduldig und verständnisvoll. Hilf beim Ablenken und sorge für Aktivitäten, die die Wartezeit verkürzen. Stelle sicher, dass alles für die Fahrt ins Krankenhaus bereit ist und ihr jederzeit los könnt.",
  symptoms: [
    "Harter, tiefer Bauch",
    "Verstärkter Ausfluss",
    "Zunehmender Druck im Becken",
    "Vorwehen (Übungswehen)",
    "Rückenschmerzen",
    "Verstärkte Müdigkeit",
    "Emotionale Anspannung"
  ]
  }
};

export default function CountdownScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();
  const router = useRouter();

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [geburtsplanExists, setGeburtsplanExists] = useState(false);
  const [babyIconBase64, setBabyIconBase64] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [daysOverdue, setDaysOverdue] = useState<number>(0);

  // Hilfsfunktion zur Protokollierung mit Zeitstempel
  const logWithTimestamp = (message: string) => {
    const now = new Date();
    console.log(`[${now.toLocaleTimeString()}] ${message}`);
  };

  // Lade das Baby-Icon beim Start
  useEffect(() => {
    const loadBabyIcon = async () => {
      try {
        // Lade das Bild
        const asset = Asset.fromModule(require('@/assets/images/Baby_Icon.png'));
        await asset.downloadAsync();

        // Lese die Datei als Base64
        const base64 = await FileSystem.readAsStringAsync(asset.localUri!, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setBabyIconBase64(base64);
      } catch (error) {
        console.error('Fehler beim Laden des Baby-Icons:', error);
      }
    };

    loadBabyIcon();
  }, []);

  useEffect(() => {
    if (user) {
      loadDueDate();
      checkGeburtsplan();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const checkGeburtsplan = async () => {
    try {
      const { exists, error } = await hasGeburtsplan();
      if (error) {
        console.error('Error checking geburtsplan:', error);
      } else {
        setGeburtsplanExists(exists);
      }
    } catch (err) {
      console.error('Failed to check geburtsplan:', err);
    }
  };

  const loadDueDate = async () => {
    try {
      setIsLoading(true);

      // Versuchen, den Entbindungstermin mit Informationen über verknüpfte Benutzer zu laden
      const result = await getDueDateWithLinkedUsers(user?.id || '');

      if (result.success) {
        logWithTimestamp('Loaded due date with linked users');

        if (result.dueDate) {
          const resultDueDate = new Date(result.dueDate);
          setDueDate(resultDueDate);
          setTempDate(resultDueDate);
          logWithTimestamp(`Entbindungstermin geladen: ${resultDueDate.toLocaleDateString()}`);

          // Berechne die aktuelle SSW
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          // Kopie des Entbindungstermins ohne Uhrzeit
          const dueDateCopy = new Date(resultDueDate);
          dueDateCopy.setHours(0, 0, 0, 0);

          // Berechne die Differenz in Tagen
          const difference = dueDateCopy.getTime() - now.getTime();
          const daysLeft = Math.round(difference / (1000 * 60 * 60 * 24));

          // Schwangerschaft dauert ca. 40 Wochen = 280 Tage
          const totalDaysInPregnancy = 280;
          const daysRemaining = Math.max(0, daysLeft);
          const daysPregnant = totalDaysInPregnancy - daysRemaining;

          // Berechne SSW und Tag
          const weeksPregnant = Math.floor(daysPregnant / 7);
          const daysInCurrentWeek = daysPregnant % 7;

          // currentWeek ist die aktuelle Schwangerschaftswoche (1-basiert)
          setCurrentWeek(weeksPregnant + 1);
          setCurrentDay(daysInCurrentWeek);
          
          // Berechne die Tage seit dem ET, wenn überfällig
          if (daysLeft < 0) {
            // Umwandlung in positive Zahl für Tage seit ET
            setDaysOverdue(Math.abs(daysLeft));
          } else {
            setDaysOverdue(0);
          }

          // Speichern der verknüpften Benutzer
          if (result.linkedUsers && result.linkedUsers.length > 0) {
            setLinkedUsers(result.linkedUsers);
            logWithTimestamp(`Linked users: ${result.linkedUsers.map((u: LinkedUser) => u.firstName).join(', ')}`);
          } else {
            setLinkedUsers([]);
          }
        } else {
          logWithTimestamp('No due date found in result');
          setDueDate(null);
          setLinkedUsers([]);
        }
      } else {
        console.error('Error loading due date:', result.error);

        // Fallback auf lokalen Termin
        const { data, error } = await supabase
          .from('user_settings')
          .select('due_date')
          .eq('user_id', user?.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading due date:', error);
        } else if (data && data.due_date) {
          const loadedDate = new Date(data.due_date);
          logWithTimestamp(`Loaded local due date: ${loadedDate.toLocaleDateString()}`);
          setDueDate(loadedDate);
          setTempDate(loadedDate);
          setLinkedUsers([]); // Keine verknüpften Benutzer
        } else {
          logWithTimestamp('No due date found for user');
          setDueDate(null);
          setLinkedUsers([]);
        }
      }
    } catch (err) {
      console.error('Failed to load due date:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDueDate = async (date: Date) => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtstermin zu speichern.');
        return;
      }

      // Verwenden der neuen Funktion zum Aktualisieren des Entbindungstermins und Synchronisieren
      const result = await updateDueDateAndSync(user.id, date);

      if (!result.success) {
        console.error('Error saving due date:', result.error);
        Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
        return;
      }

      // Aktualisieren des lokalen Zustands
      setDueDate(date);

      // Erfolgreiche Speicherung mit Erfolgsmeldung
      logWithTimestamp(`Geburtstermin erfolgreich gespeichert: ${date.toLocaleDateString()}`);
      
      // Prüfen, ob Benutzer synchronisiert wurden
      const syncedUsers = result.syncResult?.linkedUsers || [];

      if (syncedUsers.length > 0) {
        const linkedUserNames = syncedUsers
          .map((user: LinkedUser) => user.firstName)
          .join(', ');

        Alert.alert(
          'Erfolg',
          `Dein Geburtstermin wurde erfolgreich gespeichert und mit ${linkedUserNames} synchronisiert.`
        );
      } else {
        Alert.alert('Erfolg', 'Dein Geburtstermin wurde erfolgreich gespeichert.');
      }

      // Aktualisieren der Anzeige
      loadDueDate();
    } catch (err) {
      console.error('Failed to save due date:', err);
      Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
    }
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate) {
        setTempDate(selectedDate);
        saveDueDate(selectedDate);
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleIOSConfirm = () => {
    setShowDatePicker(false);
    saveDueDate(tempDate);
  };

  const handleIOSCancel = () => {
    setShowDatePicker(false);
    // Bei Abbruch den tempDate zurücksetzen
    if (dueDate) {
      setTempDate(dueDate);
    }
  };

  const showDatepicker = () => {
    if (dueDate) {
      setTempDate(dueDate);
    } else {
      // Wenn kein Datum gesetzt ist, verwende das heutige Datum + 9 Monate
      const today = new Date();
      today.setMonth(today.getMonth() + 9);
      setTempDate(today);
    }
    setShowDatePicker(true);
  };

  const handleDownloadPDF = async () => {
    if (!geburtsplanExists) {
      Alert.alert('Geburtsplan', 'Du hast noch keinen Geburtsplan erstellt. Möchtest du jetzt einen erstellen?', [
        { text: 'Nein', style: 'cancel' },
        { text: 'Ja', onPress: () => router.push('/geburtsplan') }
      ]);
      return;
    }
    
    setIsGeneratingPDF(true);
    try {
      await generateAndDownloadPDF(babyIconBase64 || '', setIsGeneratingPDF);
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Fehler', 'Beim Generieren des PDFs ist ein Fehler aufgetreten.');
    }
  };

  const getLinkedUsers = async (userId: string) => {
    try {
      const result = await getDueDateWithLinkedUsers(userId);
      return {
        success: result.success,
        linkedUsers: result.linkedUsers || [],
        error: result.error
      };
    } catch (error) {
      console.error('Error getting linked users:', error);
      return { success: false, linkedUsers: [], error };
    }
  };

  const handleBabyBorn = async () => {
    try {
      await setIsBabyBorn(true);
      
      const linkedUsersResult = await getLinkedUsers(user?.id || '');
      let syncMessage = '';

      if (linkedUsersResult.success && linkedUsersResult.linkedUsers.length > 0) {
        const linkedUserNames = linkedUsersResult.linkedUsers
          .map((user: LinkedUser) => user.firstName)
          .join(', ');

        syncMessage = `\n\nDiese Information wurde auch mit ${linkedUserNames} geteilt.`;
      }

      Alert.alert(
        "Herzlichen Glückwunsch!",
        `Wir freuen uns mit dir über die Geburt deines Babys! 🎉${syncMessage}`,
        [
          {
            text: "OK",
            onPress: () => {
              router.replace('/(tabs)/baby');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Fehler beim Setzen des Baby-Status:', error);
      Alert.alert('Fehler', 'Es gab ein Problem bei der Aktualisierung des Status.');
    }
  };

  if (isLoading) {
    return (
      <ThemedBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.tint} />
          </View>
        </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground style={{flex: 1}}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header 
          title="Countdown" 
          subtitle="Verfolge die Zeit bis zur Geburt" 
        />
        
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Countdown */}
          <CountdownTimer dueDate={dueDate} />

          {/* Entbindungstermin Button */}
          <ThemedView style={styles.dueDateContainer} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.dueDateTitle}>Entbindungstermin:</ThemedText>
            
            <TouchableOpacity
              style={styles.dueDateButton}
              onPress={showDatepicker}
            >
              <ThemedText style={styles.dueDateText}>
                {dueDate ? dueDate.toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                }) : 'Bitte wählen'}
              </ThemedText>
              <IconSymbol name="calendar" color={theme.text} size={20} />
            </TouchableOpacity>
          </ThemedView>

          {/* DateTimePicker Modal für iOS */}
          {Platform.OS === 'ios' && (
            <Modal
              transparent={true}
              visible={showDatePicker}
              animationType="fade"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <Pressable 
                style={styles.modalOverlay}
                onPress={handleIOSCancel}
              >
                <ThemedView 
                  style={styles.modalContent}
                  lightColor={theme.card}
                  darkColor={theme.card}
                >
                  <ThemedText style={styles.modalTitle}>
                    Entbindungstermin wählen
                  </ThemedText>
                  
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    textColor={colorScheme === 'dark' ? theme.text : undefined}
                    accentColor={theme.tint}
                    style={styles.datePicker}
                  />
                  
                  <View style={styles.modalButtonContainer}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]} 
                      onPress={handleIOSCancel}
                    >
                      <ThemedText style={styles.modalButtonText}>
                        Abbrechen
                      </ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.confirmButton]} 
                      onPress={handleIOSConfirm}
                    >
                      <ThemedText style={styles.confirmButtonText}>
                        Bestätigen
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </ThemedView>
              </Pressable>
            </Modal>
          )}

          {/* DateTimePicker für Android (erscheint als nativer Dialog) */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {/* Wöchentliche Informationen */}
          {currentWeek && currentWeek >= 4 && (
            <ThemedView 
              style={[
                styles.infoContainer, 
                currentWeek > 40 ? styles.overdueContainer : null
              ]} 
              lightColor={theme.card} 
              darkColor={theme.card}
            >
              <ThemedText 
                style={[
                  styles.sectionTitle,
                  currentWeek > 40 ? styles.overdueTitle : null
                ]}
              >
                {currentWeek > 40 
                  ? `${daysOverdue} ${daysOverdue === 1 ? 'Tag' : 'Tage'} über dem ET: Was jetzt wichtig ist` 
                  : `SSW ${currentWeek}: Was geschieht diese Woche?`}
              </ThemedText>

              {/* Kind */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <IconSymbol name="figure.child" size={24} color={theme.accent} />
                  <ThemedText style={styles.infoTitle}>Beim Baby</ThemedText>
                </View>
                <ThemedText style={styles.infoText}>
                  {currentWeek > 40 
                    ? (overdueInfo[Math.min(daysOverdue, 14)] || overdueInfo.default).baby 
                    : pregnancyWeekInfo[currentWeek < 43 ? currentWeek : 42]}
                </ThemedText>
              </View>

              {/* Mutter */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <IconSymbol name="person.fill" size={24} color={theme.accent} />
                  <ThemedText style={styles.infoTitle}>Bei der Mutter</ThemedText>
                </View>
                <ThemedText style={styles.infoText}>
                  {currentWeek > 40 
                    ? (overdueInfo[Math.min(daysOverdue, 14)] || overdueInfo.default).mother 
                    : pregnancyMotherInfo[currentWeek < 43 ? currentWeek : 42]}
                </ThemedText>
              </View>

              {/* Partner */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <IconSymbol name="person.2.fill" size={24} color={theme.accent} />
                  <ThemedText style={styles.infoTitle}>Für den Partner</ThemedText>
                </View>
                <ThemedText style={styles.infoText}>
                  {currentWeek > 40 
                    ? (overdueInfo[Math.min(daysOverdue, 14)] || overdueInfo.default).partner 
                    : pregnancyPartnerInfo[currentWeek < 43 ? currentWeek : 42]}
                </ThemedText>
              </View>
            </ThemedView>
          )}

          {/* Mögliche Symptome */}
          {currentWeek && currentWeek >= 4 && (
            <ThemedView 
              style={[
                styles.symptomsContainer,
                currentWeek > 40 ? styles.overdueContainer : null
              ]} 
              lightColor={theme.card} 
              darkColor={theme.card}
            >
              <ThemedText 
                style={[
                  styles.sectionTitle,
                  currentWeek > 40 ? styles.overdueTitle : null
                ]}
              >
                {currentWeek > 40 
                  ? "Häufige Anzeichen kurz vor der Geburt" 
                  : `Mögliche Symptome in SSW ${currentWeek}`}
              </ThemedText>

              <View style={styles.symptomsList}>
                {(currentWeek > 40 
                  ? (overdueInfo[Math.min(daysOverdue, 14)] || overdueInfo.default).symptoms 
                  : pregnancySymptoms[currentWeek < 43 ? currentWeek : 42]).map((symptom: string, index: number) => (
                  <View key={index} style={styles.symptomItem}>
                    <IconSymbol 
                      name="circle.fill" 
                      size={8} 
                      color={currentWeek > 40 ? '#E57373' : theme.accent} 
                    />
                    <ThemedText style={styles.symptomText}>{symptom}</ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          )}

          {/* Spezieller Hinweis für Überfälligkeits-Phase */}
          {currentWeek && currentWeek > 40 && (
            <ThemedView style={styles.overdueInfoCard} lightColor={theme.card} darkColor={theme.card}>
              <View style={styles.overdueInfoHeader}>
                <IconSymbol name="info.circle.fill" size={24} color="#E57373" />
                <ThemedText style={styles.overdueInfoTitle}>Wichtige Information</ThemedText>
              </View>
              <ThemedText style={styles.overdueInfoText}>
                Ab dem errechneten Geburtstermin wird die Schwangerschaft als "überfällig" bezeichnet. Etwa 5-10% aller Schwangerschaften dauern länger als 42 Wochen. 
                Die meisten Geburten finden jedoch bereits bis zu zwei Wochen vor oder nach dem errechneten Termin statt.
              </ThemedText>
              <ThemedText style={styles.overdueInfoText}>
                Halte regelmäßigen Kontakt zu deiner Hebamme oder deinem Frauenarzt. Sie werden in dieser Phase häufigere Kontrolluntersuchungen durchführen, 
                um das Wohlbefinden deines Babys sicherzustellen.
              </ThemedText>
            </ThemedView>
          )}

          {/* Download Geburtsplan */}
          <ThemedView style={styles.sectionContainer} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.sectionTitle}>Geburtsplan</ThemedText>
            
            <ThemedText style={styles.sectionDescription}>
              {geburtsplanExists 
                ? 'Du hast bereits einen Geburtsplan erstellt. Du kannst diesen als PDF herunterladen oder bearbeiten.'
                : 'Erstelle einen individuellen Geburtsplan und teile ihn mit deiner Hebamme oder deinem Arzt.'}
            </ThemedText>
            
            {isGeneratingPDF ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.tint} />
                <ThemedText style={styles.loadingText}>PDF wird generiert...</ThemedText>
              </View>
            ) : (
              <View style={styles.buttonsContainer}>
                {geburtsplanExists && (
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.tint }]}
                    onPress={handleDownloadPDF}
                  >
                    <ThemedText style={styles.buttonText} darkColor="#fff" lightColor="#fff">
                      PDF exportieren
                    </ThemedText>
                    <IconSymbol name="arrow.down" color="#fff" size={18} />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: geburtsplanExists ? '#6A8D92' : theme.tint }]}
                  onPress={() => router.push('/geburtsplan')}
                >
                  <ThemedText style={styles.buttonText} darkColor="#fff" lightColor="#fff">
                    {geburtsplanExists ? 'Geburtsplan bearbeiten' : 'Geburtsplan erstellen'}
                  </ThemedText>
                  <IconSymbol name={geburtsplanExists ? "pencil" : "plus.circle"} color="#fff" size={18} />
                </TouchableOpacity>
              </View>
            )}
          </ThemedView>

          {/* Baby geboren Button, nur anzeigen wenn das ET überschritten ist */}
          {dueDate && (new Date() > dueDate) && !isBabyBorn && (
            <TouchableOpacity
              style={[
                styles.button, 
                { 
                  backgroundColor: Colors.light.warning, 
                  paddingVertical: 15,
                  marginTop: 10,
                  width: '100%'
                }
              ]}
              onPress={handleBabyBorn}
            >
              <ThemedText style={[styles.buttonText, { color: '#5C4033' }]}>
                Mein Baby ist geboren!
              </ThemedText>
              <IconSymbol name="heart.fill" color="#5C4033" size={18} />
            </TouchableOpacity>
          )}

          {/* Verknüpfte Benutzer */}
          {linkedUsers.length > 0 && (
            <ThemedView style={styles.sectionContainer} lightColor={theme.card} darkColor={theme.card}>
              <ThemedText style={styles.sectionTitle}>Geteilter Countdown</ThemedText>
              
              <View style={styles.linkedUsersContainer}>
                {linkedUsers.map((linkedUser) => (
                  <ThemedView key={linkedUser.id} style={styles.linkedUserBadge} lightColor={theme.tint + '20'} darkColor={theme.tint + '20'}>
                    <ThemedText style={styles.linkedUserName}>
                      {linkedUser.firstName}
                    </ThemedText>
                  </ThemedView>
                ))}
              </View>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  dueDateContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dueDateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  dueDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6CCB2',
    backgroundColor: 'rgba(230, 204, 178, 0.1)',
    minWidth: 200,
  },
  dueDateText: {
    fontSize: 18,
    fontWeight: '500',
    marginRight: 10,
  },
  sectionContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 16,
    marginBottom: 15,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
  },
  buttonsContainer: {
    width: '100%',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  linkedUsersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 10,
  },
  linkedUserBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  linkedUserName: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  datePicker: {
    width: '100%',
    height: 200,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(200, 200, 200, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.3)',
  },
  confirmButton: {
    backgroundColor: Colors.light.success,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  infoContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    width: '100%',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  overdueContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  overdueTitle: {
    color: '#E57373',
  },
  overdueInfoCard: {
    width: '100%',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  overdueInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overdueInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E57373',
    marginLeft: 8,
  },
  overdueInfoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
});
