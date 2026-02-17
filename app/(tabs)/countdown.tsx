import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import CountdownTimer from '@/components/CountdownTimer';
import { supabase, hasGeburtsplan, getDueDateWithLinkedUsers, updateDueDateAndSync } from '@/lib/supabase';
import { generateAndDownloadPDF } from '@/lib/geburtsplan-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { pregnancyMotherInfo } from '@/constants/PregnancyMotherInfo';
import { pregnancyPartnerInfo } from '@/constants/PregnancyPartnerInfo';
import { pregnancySymptoms } from '@/constants/PregnancySymptoms';
import { BIRTH_PREP_SECTION_START_WEEK, birthPreparationMeasures } from '@/constants/BirthPreparationMeasures';
import Header from '@/components/Header';

// Sleep-Tracker Design Tokens
import { LiquidGlassCard, GLASS_OVERLAY, GLASS_OVERLAY_DARK, LAYOUT_PAD } from '@/constants/DesignGuide';

const PRIMARY_TEXT = '#5C4033';
const SECONDARY_TEXT = '#7D5A50';
const ACCENT_PURPLE = '#8E4EC6';
const ACCENT_MINT = '#389D91';
const ACCENT_ORANGE = '#FF8C42';
const WARN = '#E57373';
const TIMELINE_INSET = 8;

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const lightenHex = (hex: string, amount = 0.35) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');

  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

// Definiere Typen für die verknüpften Benutzer
interface LinkedUser {
  firstName: string;
  id?: string;
  userId?: string;
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
  1: {
    baby: "Dein Baby ist nach wie vor optimal versorgt. Die Plazenta liefert zuverlässig Sauerstoff und Nährstoffe, doch der Platz wird langsam enger. Viele Babys schlafen jetzt mehr, ihre Bewegungen können sich etwas verändern. Achte darauf, Tritte weiterhin täglich bewusst wahrzunehmen.",
    mother: "Die Geduld wird geprüft – du bist bereit, aber es passiert noch nichts. Gönn dir bewusste Auszeiten: Meditation, warmes Bad (sofern Hebamme/Ärzt:in zustimmen) oder ein Spaziergang zum Ankurbeln der Durchblutung. Beobachte Frühwehen oder Schleimpfropf-Abgang. Bei Unsicherheit lieber einmal mehr telefonieren als grübeln.",
    partner: "Sei verfügbar und proaktiv. Kümmere dich um kleine Alltagsaufgaben, damit sie loslassen kann. Frische Lieblingssnacks, ein wärmendes Kirschkernkissen oder gemeinsames Streaming können Wunder wirken. Halte den Tankstand des Autos im Auge – Abfahrt kann jederzeit sein.",
    symptoms: ["Harter, tiefer Bauch","Verstärkter Ausfluss","Zunehmender Druck im Becken","Vorwehen (Übungswehen)","Rückenschmerzen","Verstärkte Müdigkeit","Emotionale Anspannung"]
  },
  2: {
    baby: "Das Kind profitiert weiter von Antikörpern der Mutter und lagert Fettreserven ein, die nach der Geburt beim Temperaturhalten helfen. Flüssigkeit im Fruchtwasser bleibt entscheidend – CTG/Ultraschall geben Aufschluss. Bewegungen spüren? Ja, aber sie können \"gleitender\" wirken, nicht mehr so kraftvoll.",
    mother: "Leichte Wassereinlagerungen, Rückenschmerzen oder verstärkte Müdigkeit sind häufig. Wärme (z. B. Kirschkernkissen) und sanftes Dehnen entlasten. Versuche, dich nicht auf Social-Media-Fragen (\"Ist das Baby schon da?\") einzulassen – setze klare Grenzen.",
    partner: "Organisiere gemeinsame \"Ablenk-Dates\": kurzer Stadtbummel, frische Luft, Café-Besuch. Frage aktiv nach ihrem Befinden, ohne Druck aufzubauen. Prüfe Kliniktasche auf Vollständigkeit (Ladekabel, Snacks, Haargummis).",
    symptoms: ["Leichte Wassereinlagerungen","Verstärkte Rückenschmerzen","Zunehmende Müdigkeit","Unregelmäßige Vorwehen","Vermehrter Harndrang","Veränderter Ausfluss","Mentale Unruhe"]
  },
  3: {
    baby: "Alles im grünen Bereich, doch Arzt/Ärztin prüft jetzt häufig Fruchtwasserqualität und Plazentadurchblutung. Vernix (Käseschmiere) ist fast komplett verschwunden; Haut kann im Fruchtwasser leicht aufquellen – völlig normal.",
    mother: "Unregelmäßige Vorwehen können schmerzhafter werden; vertraue darauf, dass dein Körper übt. Bleib in Bewegung: Treppen steigen, leichter Yoga-Walk. Führe ein Wohlfühl-Journal – was tut dir gut, was stresst?",
    partner: "Übernimm Kommunikation mit Familie/Freunden (\"Wir melden uns!\"). Bereite eine Playlist fürs Kreißzimmer vor – stimme sie mit der werdenden Mama ab. Emotionaler Rückhalt zählt mehr als Lösungen.",
    symptoms: ["Intensivere Vorwehen","Mehr Druck nach unten","Schlafstörungen","Erhöhter Ausfluss","Leichte Übelkeit","Veränderter Appetit","Anhaltende Rückenschmerzen"]
  },
  4: {
    baby: "Plazentaleistung kann beginnen, minimal nachzulassen – medizinisches Monitoring wird wichtiger. Dein Baby übt weiterhin Atembewegungen, schluckt Fruchtwasser und trainiert Darm und Lunge.",
    mother: "Das Gewicht des Babys drückt stärker auf Becken und Ischias. Wärme, leichte Becken-Kreise im Vierfüßlerstand oder ein Gymnastikball schaffen Entlastung. Sprich Ängste offen an: Einleitung, Kaiserschnitt – Wissen reduziert Sorge.",
    partner: "Biete Massagen für Rücken und Füße an; zeige, dass du präsent bist. Erledige letzte Erledigungen (Apotheke, Müll rausbringen). Mach einen Probe-Fahrweg zur Klinik zu verkehrsintensiven Zeiten.",
    symptoms: ["Ischiasschmerzen","Häufigeres Wasserlassen","Spürbarer Druck auf Becken","Zunehmende Erschöpfung","Verstärkte Vorwehen","Schlafprobleme","Stärkerer Ausfluss"]
  },
  5: {
    baby: "Kindliche Kopfform kann sich weiter anpassen und tiefer ins Becken rutschen. Fruchtwassermenge wird per Ultraschall gemessen; Werte sind noch meist stabil.",
    mother: "Viele Kliniken bieten jetzt Aufklärungsgespräch zur Einleitung an: Pro- und Kontra, Methoden (Gel, Ballon, Oxytocin). Notiere Fragen vorab. Gönn dir protein- und magnesiumreiche Kost – hilft Muskeln und Nerven.",
    partner: "Sei beim Aufklärungsgespräch dabei, nimm Notizen. Plane kurze, wohltuende Aktivitäten – Spaziergang im Park, Hörbuch mit Kopfhörern. Halte Handy stets geladen, lade sie zum Power-Napping ein.",
    symptoms: ["Verstärkte Beckendruckbeschwerden","Zunahme der Vorwehen","Öfter wechselnde Stimmung","Möglicher Abgang des Schleimpfropfs","Verdauungsprobleme","Verstärktes Sodbrennen","Beinschwellungen"]
  },
  6: {
    baby: "Herz- und Atemfrequenz werden beim CTG genau beobachtet. Meist zeigt sich alles unauffällig; Babys verkraften diese Extra-Tage gut. Bewegungen können langsamer, aber rhythmisch sein.",
    mother: "Schlaf wird schwerer, weil Beckenboden drückt. Seitenschläferkissen oder Stillkissen unterstützen. Achte auf klare Fruchtwasserabgänge – bei grünlichem Wasser sofort Klinik anrufen.",
    partner: "Übernimm nächtliche Aufsteh-Hilfen (Kissen richten, Wasser holen). Organisiere ein leichtes Abendessen mit viel Omega-3 (z. B. Avocado, Lachs), stärkt beide. Worte wie \"Entspann dich doch\" vermeiden – biete stattdessen konkrete Hilfe.",
    symptoms: ["Schlaflosigkeit","Zunehmender Druck auf Beckenboden","Veränderte Kindsbewegungen","Unregelmäßige Kontraktionen","Verstärkter Harndrang","Verdauungsbeschwerden","Emotionale Erschöpfung"]
  },
  7: {
    baby: "Ab heute sprechen viele Ärzt:innen von \"post-term\". Noch immer gut geschützt, doch Monitoring wird alle 1-2 Tage empfohlen: CTG, Doppler, Fruchtwasser.",
    mother: "Körperlich kann sich Schweregefühl steigern. Vielleicht erhältst du einen Termin zur Einleitung in den nächsten Tagen. Akupressur an Hand- und Fußpunkten (Hebamme) kann Wehentätigkeit anregen; wissenschaftlich nicht eindeutig, aber vielen hilft es psychisch.",
    partner: "Bleib sachlich, aber optimistisch. Erkläre Schritte der Einleitung, damit keine offenen Fragen bleiben. Sorge für gute Erreichbarkeit (Diensthandy-Weiterleitung, Meeting-Vertretungen klären).",
    symptoms: ["Deutliches Schweregefühl","Verstärkte Vorwehen","Reizbarkeit & Ungeduld","Energiemangel","Zunehmende Schlafstörungen","Verstärkter Ausfluss","Veränderungen im Appetit"]
  },
  8: {
    baby: "Käseschmiere ist weg, dafür produziert die Haut schützendes Fett. Haare und Nägel wachsen weiter – viele \"über-Termin-Babys\" kommen mit weichen Fingernägeln zur Welt.",
    mother: "Häufigere CTGs (ggf. täglich). Setze auf leicht verdauliche Mahlzeiten; ein voller Magen kann Übelkeit bei Wehen verstärken. Bleibe hydriert, 2–3 Liter Wasser/ungesüßte Tees.",
    partner: "Plane Mahlzeiten mit: leichte Suppe, gedünstetes Gemüse, Proteine. Überrasche mit Mini-Wellness: Fußbad, Aromadiffuser (Lavendel, sofern sie es mag). Ermuntere zu leichten Lockerungsübungen – mach einfach mit.",
    symptoms: ["Erhöhte Müdigkeit","Vermehrte Wadenkrämpfe","Häufigere Vorwehen","Zunehmende Rückenbeschwerden","Gesteigerter Harndrang","Verlangsamte Verdauung","Schwere in den Beinen"]
  },
  9: {
    baby: "Fruchtwasser wird gelegentlich weniger; Ärzte achten auf klare, nicht grünliche Flüssigkeit. Kindliche Haut kann leicht trocken sein – später keine Sorge, Creme löst das schnell.",
    mother: "Darmträgheit nimmt zu; ballaststoffreiche Nahrung (Hafer, Trockenpflaumen) beugt Verstopfung vor. Sanfte Bauchmassage (Uhrzeigersinn) fördert Wohlgefühl.",
    partner: "Unterstütze bei Ernährung: frische Früchte schneiden, Overnight-Oats vorbereiten. Höre aktiv zu, wenn Ängste hochkommen – nicht relativieren, sondern bestätigen (\"Ich verstehe, dass du…\").",
    symptoms: ["Verstopfung","Zunehmende Ungeduld","Intensive Hitzewallungen","Verstärkte Schlaflosigkeit","Häufigere Kontraktionen","Reizbare Stimmung","Druckgefühl im Unterleib"]
  },
  10: {
    baby: "Einleitung wird jetzt intensiv besprochen. Babys jenseits ET + 10 zeigen leicht erhöhtes Risiko für Unterversorgung, daher engmaschige Checks.",
    mother: "Termin zur Einleitung oft innerhalb der nächsten 48 Stunden. Informiere dich über Verfahren: Prostaglandin-Gel, Ballonkatheter, intravenöses Oxytocin. Wähle bequeme Kleidung für Klinikaufenthalt, inkl. eigener Bademantel.",
    partner: "Organisiere Arbeitsvertretung ab jetzt flexibel. Packe Extras in Kliniktasche: Ladekabel-Verlängerung, Wechsel-T-Shirt, Münzen für Automaten. Bereite aufmunternde Sprachnachrichten von Freunden/Familie vor (nur abspielen, wenn sie es möchte).",
    symptoms: ["Deutliche Erschöpfung","Intensive Vorwehen","Schleimiger Ausfluss","Stärkste Rückenschmerzen","Extreme Beckendruckbeschwerden","Gereiztheit & Unruhe","Magenverstimmung"]
  },
  11: {
    baby: "Dauermonitoring denkbar (CTG-Gurt, CTG-Langzeit). Bewegungen weiterhin bewusster wahrnehmen und nach Leitlinien dokumentieren (z. B. 10 Bewegungen in 2 Stunden).",
    mother: "Hormonelle Veränderungen können Stimmungsschwankungen verstärken. Sprich offen, wenn du dich überrollt fühlst. Leichte Dehnungen im Vierfüßlerstand entlasten Kreuzbein und fördern Babyliegeposition.",
    partner: "Akzeptiere Stimmungstief ohne Ratschlag-Reflex. Biete körperliche Nähe (Handhalten, Rücken streicheln), wenn erwünscht. Übernimm To-do-Listen und besorge fehlende Dokumente (Mutterpass, Personalausweise).",
    symptoms: ["Starke Stimmungsschwankungen","Zunehmende Muskelschmerzen","Abnehmende Beweglichkeit","Anhaltende Sodbrennen","Verstärkte Erschöpfung","Tränen & Emotionalität","Gesteigerte Nervosität"]
  },
  12: {
    baby: "Fruchtwasseranalyse besonders wichtig. Falls Werte kritisch, entscheidet Team eventuell über sofortige Einleitung oder Kaiserschnitt.",
    mother: "Möglicherweise stationäre Aufnahme zur Einleitung. Nimm Kopfhörer, Augenkissen, Lieblingslotion mit – kleine Comfort-Items entspannen. Bleibe aktiv: Klinikflure entlangspazieren, soweit erlaubt.",
    partner: "Rechne mit Wartezeiten: Lade Tablet mit Filmen, nimm Buch/Zeitschriften. Bringe eigene Snacks (Kliniken haben begrenzte Kantinenzeiten). Bleibe Ansprechpartner – auch nachts.",
    symptoms: ["Verstärkte Vorwehen mit Regelmäßigkeit","Erhöhter Ausfluss","Spannungsgefühl im Unterleib","Extreme Erschöpfung","Schlaflosigkeit","Anhaltende Rückenschmerzen","Gesteigerte Sensibilität für Geräusche/Gerüche"]
  },
  13: {
    baby: "Bei anhaltender Schwangerschaft steigt das Risiko für Mekonium (Kindspech) im Fruchtwasser – Teams handeln zügig, um Komplikationen vorzubeugen.",
    mother: "Einleitungsmaßnahmen laufen ggf. schon: Wehencocktail, Prostaglandin oder Ballon. Ruh dich zwischen CTG‐Intervallen aus, aber bewege dich während Wehenpausen, um Schwerkraft zu nutzen.",
    partner: "Unterstütze mit Atem-Timing-App oder Zählen während Wehen, falls gewünscht. Organisiere Wärmflasche/Waschlappen. Sage motivierende Sätze (\"Jede Wehe bringt euch näher zueinander\").",
    symptoms: ["Regelmäßige Wehen","Verstärkter Schleimpfropfabgang","Starker Druck nach unten","Zunehmende Übelkeit","Intensivierung aller Symptome","Besonders starke Rückenschmerzen","Erhöhte Körpertemperatur möglich"]
  },
  14: {
    baby: "Medizinischer Konsens: Spätestens heute wird die Geburt eingeleitet oder ein Kaiserschnitt erwogen. Plazentafunktion nimmt statistisch ab, Sauerstoffversorgung könnte sinken.",
    mother: "Du erreichst die äußerste Grenze der Terminschwangerschaft. Vertraue auf dein Team – es hat deine Werte im Blick. Bleibe fokussiert auf Atmung und Zwischenpausen-Entspannung. Halte Motivation hoch: Dein Kind ist gleich bei dir!",
    partner: "Höchste Präsenz: Keine Ablenkungen, Handy lautlos außer wichtigen Anrufen. Erinnere sie ans Trinken zwischen Wehen. Bleibe ruhig, auch wenn Entscheidungen (z. B. Kaiserschnitt) spontan fallen – deine Gelassenheit überträgt sich.",
    symptoms: ["Intensive, regelmäßige Wehen","Möglicher Fruchtwasserabgang","Extremer Druck im Becken","Übelkeit und/oder Erbrechen","Zittern oder Schüttelfrost","Starke Kreuzschmerzen","Extreme physische & emotionale Erschöpfung"]
  },
  default: {
    baby: "Dein Baby ist jetzt vollständig entwickelt. Die Plazenta versorgt es weiterhin mit allen notwendigen Nährstoffen. Die Verbindung zwischen euch beiden ist stärker denn je. Das Immunsystem deines Babys wird durch die Übertragung von Antikörpern über die Plazenta weiter gestärkt.",
    mother: "Viele Frauen empfinden diese Wartezeit als besonders anstrengend. Versuche dich abzulenken und nutze die Zeit für Entspannung. Bewegung kann helfen, den Geburtsprozess anzuregen. Achte auf Anzeichen für Wehen oder den Abgang des Mutterkuchens. Bei Unsicherheiten kontaktiere immer deine Hebamme oder deinen Arzt.",
    partner: "Deine Unterstützung ist jetzt besonders wichtig. Sei geduldig und verständnisvoll. Hilf beim Ablenken und sorge für Aktivitäten, die die Wartezeit verkürzen. Stelle sicher, dass alles für die Fahrt ins Krankenhaus bereit ist und ihr jederzeit los könnt.",
    symptoms: ["Harter, tiefer Bauch","Verstärkter Ausfluss","Zunehmender Druck im Becken","Vorwehen (Übungswehen)","Rückenschmerzen","Verstärkte Müdigkeit","Emotionale Anspannung"]
  }
};

export default function CountdownScreen() {
  const params = useLocalSearchParams<{ focus?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY_TEXT;
  const textSecondary = isDark ? Colors.dark.textSecondary : SECONDARY_TEXT;
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;

  const accentPurple = isDark ? lightenHex(ACCENT_PURPLE) : ACCENT_PURPLE;
  const accentMint = isDark ? lightenHex(ACCENT_MINT) : ACCENT_MINT;
  const accentOrange = isDark ? lightenHex(ACCENT_ORANGE) : ACCENT_ORANGE;
  const warnColor = isDark ? lightenHex(WARN) : WARN;

  const cardBorderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
  const infoDividerColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.35)';
  const avatarBorderColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)';
  const badgeBorderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
  const badgeBg = isDark ? toRgba(accentPurple, 0.25) : 'rgba(142,78,198,0.15)';
  const pillBorderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.65)';
  const pillGhostBg = isDark ? 'rgba(255,255,255,0.06)' : 'transparent';
  const pillPrimaryBorder = isDark ? toRgba(accentPurple, 0.7) : 'rgba(255,255,255,0.7)';
  const cardBlurTint = isDark ? 'dark' : 'light';
  const actionPurpleBg = isDark ? toRgba(accentPurple, 0.22) : 'rgba(220,200,255,0.55)';
  const actionMintBg = isDark ? toRgba(accentMint, 0.22) : 'rgba(168,196,193,0.6)';
  const actionWarnBg = isDark ? toRgba(warnColor, 0.2) : 'rgba(255,180,180,0.6)';
  const { user } = useAuth();
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);

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
  const [birthPreparationSectionY, setBirthPreparationSectionY] = useState<number | null>(null);

  const logWithTimestamp = (message: string) => {
    const now = new Date();
    console.log(`[${now.toLocaleTimeString()}] ${message}`);
  };

  // Baby-Icon laden
  useEffect(() => {
    const loadBabyIcon = async () => {
      try {
        const asset = Asset.fromModule(require('@/assets/images/Baby_Icon.png'));
        await asset.downloadAsync();
        const base64 = await FileSystem.readAsStringAsync(asset.localUri!, {
          encoding: 'base64',
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

  useEffect(() => {
    if (params.focus !== 'birth-preparation' || birthPreparationSectionY === null) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, birthPreparationSectionY - 12),
        animated: true,
      });
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [params.focus, birthPreparationSectionY]);

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
      const result = await getDueDateWithLinkedUsers(user?.id || '');
      if (result.success) {
        logWithTimestamp('Loaded due date with linked users');
        if (result.dueDate) {
          const resultDueDate = new Date(result.dueDate);
          setDueDate(resultDueDate);
          setTempDate(resultDueDate);
          logWithTimestamp(`Entbindungstermin geladen: ${resultDueDate.toLocaleDateString()}`);

          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const dueDateCopy = new Date(resultDueDate);
          dueDateCopy.setHours(0, 0, 0, 0);

          const difference = dueDateCopy.getTime() - now.getTime();
          const daysLeft = Math.round(difference / (1000 * 60 * 60 * 24));

          const totalDaysInPregnancy = 280;
          const daysRemaining = Math.max(0, daysLeft);
          const daysPregnant = totalDaysInPregnancy - daysRemaining;

          const weeksPregnant = Math.floor(daysPregnant / 7);
          const daysInCurrentWeek = daysPregnant % 7;

          setCurrentWeek(weeksPregnant + 1);
          setCurrentDay(daysInCurrentWeek);

          setDaysOverdue(daysLeft < 0 ? Math.abs(daysLeft) : 0);

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
          setLinkedUsers([]);
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

      const result = await updateDueDateAndSync(user.id, date);

      if (!result.success) {
        console.error('Error saving due date:', result.error);
        Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
        return;
      }

      setDueDate(date);
      logWithTimestamp(`Geburtstermin erfolgreich gespeichert: ${date.toLocaleDateString()}`);

      const syncedUsers = result.syncResult?.linkedUsers || [];
      if (syncedUsers.length > 0) {
        const linkedUserNames = syncedUsers.map((u: LinkedUser) => u.firstName).join(', ');
        Alert.alert('Erfolg', `Dein Geburtstermin wurde gespeichert und mit ${linkedUserNames} synchronisiert.`);
      } else {
        Alert.alert('Erfolg', 'Dein Geburtstermin wurde erfolgreich gespeichert.');
      }

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
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  const handleIOSConfirm = () => {
    setShowDatePicker(false);
    saveDueDate(tempDate);
  };

  const handleIOSCancel = () => {
    setShowDatePicker(false);
    if (dueDate) setTempDate(dueDate);
  };

  const showDatepicker = () => {
    if (dueDate) setTempDate(dueDate);
    else {
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

  const fetchLinkedUsers = async (userId: string) => {
    try {
      const result = await getDueDateWithLinkedUsers(userId);
      return { success: result.success, linkedUsers: result.linkedUsers || [], error: result.error };
    } catch (error) {
      console.error('Error getting linked users:', error);
      return { success: false, linkedUsers: [], error };
    }
  };

  const handleBabyBorn = async () => {
    try {
      await setIsBabyBorn(true);
      const linkedUsersResult = await fetchLinkedUsers(user?.id || '');
      let syncMessage = '';
      if (linkedUsersResult.success && linkedUsersResult.linkedUsers.length > 0) {
        const linkedUserNames = linkedUsersResult.linkedUsers.map((u: LinkedUser) => u.firstName).join(', ');
        syncMessage = `\n\nDiese Information wurde auch mit ${linkedUserNames} geteilt.`;
      }
      Alert.alert(
        'Herzlichen Glückwunsch!',
        `Wir freuen uns mit dir über die Geburt deines Babys! 🎉${syncMessage}`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/baby') }]
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
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={isDark ? adaptiveColors.accent : theme.tint} />
          </View>
        </SafeAreaView>
      </ThemedBackground>
    );
  }

  const isOverdue = !!dueDate && new Date() > dueDate;

  return (
    <ThemedBackground style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header title="Countdown" subtitle="Verfolge die Zeit bis zur Geburt" />

        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
          {/* Countdown im Glas-Card */}
          <LiquidGlassCard style={[styles.sectionCard, styles.centerCard]} intensity={26} overlayColor={glassOverlay}>
            <CountdownTimer dueDate={dueDate} variant="embedded" />
          </LiquidGlassCard>

          {/* Entbindungstermin */}
          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Entbindungstermin</ThemedText>
            <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
              Wähle den ET, damit Countdown & Inhalte exakt passen.
            </ThemedText>

            <TouchableOpacity onPress={showDatepicker} activeOpacity={0.9} style={styles.fullWidthAction}>
              <BlurView intensity={24} tint={cardBlurTint} style={styles.cardBlur}>
                <View style={[styles.actionCard, { backgroundColor: actionPurpleBg, borderColor: cardBorderColor }]}>
                  <View style={[styles.actionIcon, { backgroundColor: accentPurple, borderColor: cardBorderColor }]}>
                    <IconSymbol name="calendar" size={24} color="#fff" />
                  </View>
                  <ThemedText style={[styles.actionTitle, { color: textPrimary }]}>
                    {dueDate
                      ? dueDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : 'ET auswählen'}
                  </ThemedText>
                  <ThemedText style={[styles.actionSub, { color: textSecondary }]}>Tippen zum Ändern</ThemedText>
                </View>
              </BlurView>
            </TouchableOpacity>
          </LiquidGlassCard>

          {/* iOS DatePicker im Glas-Modal */}
          {Platform.OS === 'ios' && (
            <Modal transparent visible={showDatePicker} animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
              <Pressable style={styles.modalOverlay} onPress={handleIOSCancel}>
                <LiquidGlassCard style={styles.modalGlass} intensity={28} overlayColor={glassOverlay}>
                  <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>Entbindungstermin wählen</ThemedText>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    textColor={isDark ? textPrimary : undefined}
                    style={styles.datePicker}
                  />
                  <View style={styles.modalButtonRow}>
                    <TouchableOpacity
                      style={[styles.pillBtn, styles.pillGhost, { borderColor: pillBorderColor, backgroundColor: pillGhostBg }]}
                      onPress={handleIOSCancel}
                    >
                      <ThemedText style={[styles.pillGhostText, { color: textPrimary }]}>Abbrechen</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pillBtn, styles.pillPrimary, { backgroundColor: accentPurple, borderColor: pillPrimaryBorder }]}
                      onPress={handleIOSConfirm}
                    >
                      <ThemedText style={styles.pillPrimaryText}>Bestätigen</ThemedText>
                    </TouchableOpacity>
                  </View>
                </LiquidGlassCard>
              </Pressable>
            </Modal>
          )}

          {/* Android DatePicker */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker value={tempDate} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />
          )}

          {/* Wöchentliche Infos */}
          {currentWeek && currentWeek >= 4 && (
            <LiquidGlassCard
              style={[styles.sectionCard, isOverdue && styles.overdueBorder, isOverdue && { borderLeftColor: warnColor }]}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <ThemedText style={[styles.sectionTitle, { color: textPrimary }, isOverdue && { color: warnColor }]}>
                {isOverdue
                  ? `${daysOverdue} ${daysOverdue === 1 ? 'Tag' : 'Tage'} über dem ET: Was jetzt wichtig ist`
                  : `SSW ${currentWeek}: Was geschieht diese Woche?`}
              </ThemedText>

              {/* Baby */}
              <View style={[styles.infoBlock, { borderBottomColor: infoDividerColor }]}>
                <View style={styles.infoHeader}>
                  <View style={[styles.avatar, { backgroundColor: isDark ? toRgba(accentPurple, 0.2) : 'rgba(142,78,198,0.18)', borderColor: avatarBorderColor }]}>
                    <IconSymbol name="figure.child" size={18} color={accentPurple} />
                  </View>
                  <ThemedText style={[styles.infoTitle, { color: textPrimary }]}>Beim Baby</ThemedText>
                </View>
                <ThemedText style={[styles.infoText, { color: textSecondary }]}>
                  {isOverdue
                    ? (overdueInfo[Math.min(daysOverdue, 14)] || overdueInfo.default).baby
                    : pregnancyWeekInfo[currentWeek < 43 ? currentWeek : 42]}
                </ThemedText>
              </View>

              {/* Mutter */}
              <View style={[styles.infoBlock, { borderBottomColor: infoDividerColor }]}>
                <View style={styles.infoHeader}>
                  <View style={[styles.avatar, { backgroundColor: isDark ? toRgba(accentMint, 0.2) : 'rgba(56,157,145,0.18)', borderColor: avatarBorderColor }]}>
                    <IconSymbol name="person.fill" size={18} color={accentMint} />
                  </View>
                  <ThemedText style={[styles.infoTitle, { color: textPrimary }]}>Bei der Mutter</ThemedText>
                </View>
                <ThemedText style={[styles.infoText, { color: textSecondary }]}>
                  {isOverdue
                    ? (overdueInfo[Math.min(daysOverdue, 14)] || overdueInfo.default).mother
                    : pregnancyMotherInfo[currentWeek < 43 ? currentWeek : 42]}
                </ThemedText>
              </View>

              {/* Partner */}
              <View style={[styles.infoBlock, { borderBottomColor: infoDividerColor }]}>
                <View style={styles.infoHeader}>
                  <View style={[styles.avatar, { backgroundColor: isDark ? toRgba(accentOrange, 0.2) : 'rgba(255,140,66,0.18)', borderColor: avatarBorderColor }]}>
                    <IconSymbol name="person.2.fill" size={18} color={accentOrange} />
                  </View>
                  <ThemedText style={[styles.infoTitle, { color: textPrimary }]}>Für den Partner</ThemedText>
                </View>
                <ThemedText style={[styles.infoText, { color: textSecondary }]}>
                  {isOverdue
                    ? (overdueInfo[Math.min(daysOverdue, 14)] || overdueInfo.default).partner
                    : pregnancyPartnerInfo[currentWeek < 43 ? currentWeek : 42]}
                </ThemedText>
              </View>
            </LiquidGlassCard>
          )}

          {/* Symptome */}
          {currentWeek && currentWeek >= 4 && (
            <LiquidGlassCard
              style={[styles.sectionCard, isOverdue && styles.overdueBorder, isOverdue && { borderLeftColor: warnColor }]}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <ThemedText style={[styles.sectionTitle, { color: textPrimary }, isOverdue && { color: warnColor }]}>
                {isOverdue ? 'Häufige Anzeichen kurz vor der Geburt' : `Mögliche Symptome in SSW ${currentWeek}`}
              </ThemedText>

              <View style={styles.symptomList}>
                {(isOverdue
                  ? (overdueInfo[Math.min(daysOverdue, 14)] || overdueInfo.default).symptoms
                  : pregnancySymptoms[currentWeek < 43 ? currentWeek : 42]
                ).map((symptom: string, idx: number) => (
                  <View key={idx} style={styles.symptomItem}>
                    <IconSymbol name="circle.fill" size={8} color={isOverdue ? warnColor : accentMint} />
                    <ThemedText style={[styles.symptomText, { color: textSecondary }]}>{symptom}</ThemedText>
                  </View>
                ))}
              </View>
            </LiquidGlassCard>
          )}

          {/* Geburtsvorbereitung */}
          {currentWeek && currentWeek >= BIRTH_PREP_SECTION_START_WEEK && (
            <View onLayout={(event) => setBirthPreparationSectionY(event.nativeEvent.layout.y)}>
              <LiquidGlassCard
                style={styles.sectionCard}
                intensity={26}
                overlayColor={glassOverlay}
              >
                <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                  Geburtsvorbereitung (ab SSW {BIRTH_PREP_SECTION_START_WEEK})
                </ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
                  Alltagstaugliche Maßnahmen für die letzten Wochen. Bitte individuell mit Hebamme oder gynäkologischer Praxis abstimmen.
                </ThemedText>

                <View style={styles.birthPrepList}>
                  {birthPreparationMeasures.map((measure) => (
                    <View key={measure.id} style={[styles.birthPrepCard, { borderColor: cardBorderColor }]}>
                      <View style={styles.birthPrepHeader}>
                        <ThemedText style={styles.birthPrepIcon}>{measure.icon}</ThemedText>
                        <ThemedText style={[styles.birthPrepTitle, { color: textPrimary }]}>{measure.title}</ThemedText>
                      </View>
                      <ThemedText style={[styles.birthPrepLabel, { color: textPrimary }]}>Was bringt&apos;s?</ThemedText>
                      <ThemedText style={[styles.birthPrepText, { color: textSecondary }]}>{measure.benefit}</ThemedText>
                      <ThemedText style={[styles.birthPrepLabel, { color: textPrimary }]}>Ab wann?</ThemedText>
                      <ThemedText style={[styles.birthPrepText, { color: textSecondary }]}>{measure.startAt}</ThemedText>
                      <ThemedText style={[styles.birthPrepLabel, { color: textPrimary }]}>Wie oft?</ThemedText>
                      <ThemedText style={[styles.birthPrepText, { color: textSecondary }]}>{measure.frequency}</ThemedText>
                      <ThemedText style={[styles.birthPrepLabel, { color: textPrimary }]}>Wann nicht?</ThemedText>
                      <ThemedText style={[styles.birthPrepText, { color: textSecondary }]}>{measure.caution}</ThemedText>
                    </View>
                  ))}
                </View>
              </LiquidGlassCard>
            </View>
          )}

          {/* Hinweis Überfälligkeit */}
          {isOverdue && (
            <LiquidGlassCard style={[styles.sectionCard, styles.overdueBorder, { borderLeftColor: warnColor }]} intensity={26} overlayColor={glassOverlay}>
              <View style={styles.infoInset}>
                <View style={[styles.infoHeader, { marginBottom: 8 }]}>
                  <IconSymbol name="info.circle.fill" size={20} color={warnColor} />
                  <ThemedText style={[styles.infoTitle, { color: warnColor }]}>Wichtige Information</ThemedText>
                </View>
                <ThemedText style={[styles.bodyText, { color: textSecondary }]}>
                  Ab dem errechneten Geburtstermin wird die Schwangerschaft als „überfällig" bezeichnet. Etwa 5–10% aller Schwangerschaften dauern länger als 42 Wochen. Die meisten Geburten finden jedoch bis zu zwei Wochen vor oder nach dem ET statt.
                </ThemedText>
                <ThemedText style={[styles.bodyText, { color: textSecondary }]}>
                  Halte regelmäßigen Kontakt zu deiner Hebamme oder deinem Frauenarzt. In dieser Phase werden häufigere Kontrollen durchgeführt, um das Wohlbefinden deines Babys sicherzustellen.
                </ThemedText>
              </View>
            </LiquidGlassCard>
          )}

          {/* Geburtsplan */}
          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Geburtsplan</ThemedText>
            <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
              {geburtsplanExists
                ? 'Du hast bereits einen Geburtsplan. Du kannst ihn als PDF exportieren oder bearbeiten.'
                : 'Erstelle einen individuellen Geburtsplan und teile ihn mit deinem Team.'}
            </ThemedText>

            {/* Hauptaktion: exakt wie ET-Button aufgebaut */}
            <TouchableOpacity onPress={() => router.push('/geburtsplan')} activeOpacity={0.9} style={styles.fullWidthAction}>
              <BlurView intensity={24} tint={cardBlurTint} style={styles.cardBlur}>
                <View style={[styles.actionCard, { backgroundColor: actionPurpleBg, borderColor: cardBorderColor }]}>
                  <View style={[styles.actionIcon, { backgroundColor: accentPurple, borderColor: cardBorderColor }]}>
                    <IconSymbol name={geburtsplanExists ? 'pencil' : 'plus.circle'} size={24} color="#fff" />
                  </View>
                  <ThemedText style={[styles.actionTitle, { color: textPrimary }]}>
                    {geburtsplanExists ? 'Geburtsplan bearbeiten' : 'Geburtsplan erstellen'}
                  </ThemedText>
                  <ThemedText style={[styles.actionSub, { color: textSecondary }]}>Tippen zum {geburtsplanExists ? 'Bearbeiten' : 'Erstellen'}</ThemedText>
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Sekundäraktion: PDF Export als gleicher Stil (optional) */}
            {geburtsplanExists && (
              isGeneratingPDF ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={isDark ? adaptiveColors.accent : theme.tint} />
                  <ThemedText style={{ marginLeft: 8, color: textSecondary }}>PDF wird generiert…</ThemedText>
                </View>
              ) : (
                <TouchableOpacity onPress={handleDownloadPDF} activeOpacity={0.9} style={styles.fullWidthAction}>
                  <BlurView intensity={24} tint={cardBlurTint} style={styles.cardBlur}>
                    <View style={[styles.actionCard, { backgroundColor: actionMintBg, borderColor: cardBorderColor }]}>
                      <View style={[styles.actionIcon, { backgroundColor: accentMint, borderColor: cardBorderColor }]}>
                        <IconSymbol name="arrow.down.doc" size={22} color="#fff" />
                      </View>
                      <ThemedText style={[styles.actionTitle, { color: textPrimary }]}>Als PDF herunterladen</ThemedText>
                      <ThemedText style={[styles.actionSub, { color: textSecondary }]}>Tippen zum Exportieren</ThemedText>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              )
            )}
          </LiquidGlassCard>

          {/* Baby geboren */}
          {dueDate && isOverdue && !isBabyBorn && (
            <TouchableOpacity onPress={handleBabyBorn} activeOpacity={0.9} style={styles.fullWidthAction}>
              <BlurView intensity={24} tint={cardBlurTint} style={styles.cardBlur}>
                <View style={[styles.actionCard, { backgroundColor: actionWarnBg, borderColor: cardBorderColor }]}>
                  <View style={[styles.actionIcon, { backgroundColor: warnColor, borderColor: cardBorderColor }]}>
                    <IconSymbol name="heart.fill" size={22} color="#fff" />
                  </View>
                  <ThemedText style={[styles.actionTitle, { color: textPrimary }]}>Mein Baby ist geboren!</ThemedText>
                  <ThemedText style={[styles.actionSub, { color: textSecondary, opacity: 0.85 }]}>Tippen zum Bestätigen</ThemedText>
                </View>
              </BlurView>
            </TouchableOpacity>
          )}

          {/* Geteilter Countdown */}
          {linkedUsers.length > 0 && (
            <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
              <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Geteilter Countdown</ThemedText>
              <View style={styles.badgeWrap}>
                {linkedUsers.map((lu, index) => (
                  <View key={lu.id ?? lu.userId ?? `${lu.firstName}-${index}`} style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorderColor }]}>
                    <ThemedText style={[styles.badgeText, { color: textPrimary }]}>{lu.firstName}</ThemedText>
                  </View>
                ))}
              </View>
            </LiquidGlassCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  // Layout
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD + TIMELINE_INSET,
    paddingTop: 10,
    paddingBottom: 140,
  },

  sectionCard: {
    width: '100%',
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  centerCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },

  // Typo
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingHorizontal: 16,
    textAlign: 'center',
    color: PRIMARY_TEXT,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    color: PRIMARY_TEXT,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: PRIMARY_TEXT,
    opacity: 0.95,
  },

  // Action Cards (Sleep-Tracker Stil)
  fullWidthAction: {
    borderRadius: 22,
    overflow: 'hidden',
    marginHorizontal: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  cardBlur: { borderRadius: 22, overflow: 'hidden' },
  actionCard: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 112,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  actionTitle: { fontSize: 16, fontWeight: '800', color: PRIMARY_TEXT, marginBottom: 2, textAlign: 'center' },
  actionSub: { fontSize: 11, color: PRIMARY_TEXT, opacity: 0.8, textAlign: 'center' },

  // Info Blöcke
  infoBlock: { marginBottom: 12, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.35)' },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoTitle: { fontSize: 15, fontWeight: '800', color: PRIMARY_TEXT },
  infoText: { fontSize: 14, lineHeight: 20, color: PRIMARY_TEXT, opacity: 0.95, paddingLeft: 40 },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)',
  },

  // Symptome
  symptomList: { paddingHorizontal: 16, paddingTop: 2 },
  symptomItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  symptomText: { fontSize: 14, marginLeft: 8, color: PRIMARY_TEXT },

  // Geburtsvorbereitung
  birthPrepList: { paddingHorizontal: 12, paddingBottom: 8 },
  birthPrepCard: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  birthPrepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  birthPrepIcon: { fontSize: 17, marginRight: 8 },
  birthPrepTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  birthPrepLabel: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  birthPrepText: { fontSize: 13, lineHeight: 18, opacity: 0.95 },

  infoInset: { paddingHorizontal: 16 },

  // Badges (Linked Users)
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 8, paddingBottom: 8 },
  badge: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: 'rgba(142,78,198,0.15)',
    borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.6)',
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: PRIMARY_TEXT },

  // Overdue
  overdueBorder: { borderLeftWidth: 4, borderLeftColor: WARN },

  // Loading Row
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },

  // Pills (Buttons)
  pillRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', paddingHorizontal: 12, paddingTop: 4 },
  pillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  pillPrimary: { backgroundColor: ACCENT_PURPLE, borderColor: 'rgba(255,255,255,0.7)' },
  pillPrimaryText: { color: '#fff', fontWeight: '800' },
  pillMuted: { backgroundColor: 'rgba(255,255,255,0.6)' },
  pillGhost: { backgroundColor: 'transparent' },
  pillGhostText: { color: PRIMARY_TEXT, fontWeight: '800' },

  // Glass pill buttons (Liquid Glass look)
  glassPill: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  glassPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  glassPillText: { color: PRIMARY_TEXT, fontWeight: '800' },
  glassPillTextPrimary: { color: '#fff', fontWeight: '800' },

  // (obsolete) gpCards styles removed; using shared fullWidthAction pattern

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalGlass: { width: '100%', borderRadius: 22, overflow: 'hidden', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  datePicker: { width: '100%', height: 190 },
  modalButtonRow: { flexDirection: 'row', gap: 10, marginTop: 8, justifyContent: 'center' },
});
