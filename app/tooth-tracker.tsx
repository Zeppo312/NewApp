import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import TextInputOverlay from '@/components/modals/TextInputOverlay';
import { Colors } from '@/constants/Colors';
import { GLASS_OVERLAY, GLASS_OVERLAY_DARK, LAYOUT_PAD, LiquidGlassCard, PRIMARY, RADIUS } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import {
  BABY_TEETH,
  BABY_TEETH_MAP,
  deleteToothEntry,
  getToothEntries,
  saveToothEntry,
  ToothEntry,
  ToothPosition,
  ToothSymptom,
  updateToothEntry,
} from '@/lib/toothData';

type ToothDef = {
  key: ToothPosition;
  label: string;
};

const UPPER_TEETH: ToothDef[] = BABY_TEETH
  .filter((tooth) => tooth.row === 'upper')
  .map((tooth) => ({ key: tooth.key, label: tooth.label }));

const LOWER_TEETH: ToothDef[] = BABY_TEETH
  .filter((tooth) => tooth.row === 'lower')
  .map((tooth) => ({ key: tooth.key, label: tooth.label }));

const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

const SYMPTOM_OPTIONS: Array<{ key: ToothSymptom; label: string }> = [
  { key: 'fever', label: 'Fieber' },
  { key: 'restlessness', label: 'Unruhe' },
  { key: 'teething_pain', label: 'Zahnungsschmerz' },
];

const SVG_W = 300;
const SVG_H = 290;
const CX = SVG_W / 2;

type ToothType = 'molar2' | 'molar1' | 'canine' | 'lateral' | 'central';

interface ToothSpec {
  cx: number;
  width: number;
  crownH: number;
  gumY: number;
  type: ToothType;
}

const TOOTH_TYPES: ToothType[] = [
  'molar2', 'molar1', 'canine', 'lateral', 'central',
  'central', 'lateral', 'canine', 'molar1', 'molar2',
];
const TOOTH_WIDTHS = [27, 25, 20, 18, 22, 22, 18, 20, 25, 27];
const TOOTH_GAP = 2;

function computeTeethRow(jaw: 'upper' | 'lower'): ToothSpec[] {
  const crownHeights = jaw === 'upper'
    ? [26, 27, 31, 27, 28, 28, 27, 31, 27, 26]
    : [24, 25, 29, 25, 26, 26, 25, 29, 25, 24];
  const gumYs = jaw === 'upper'
    ? [58, 61, 65, 68, 70, 70, 68, 65, 61, 58]
    : [220, 217, 213, 210, 208, 208, 210, 213, 217, 220];

  const totalW = TOOTH_WIDTHS.reduce((s, w) => s + w, 0) + TOOTH_GAP * 9;
  let x = (SVG_W - totalW) / 2;

  return TOOTH_TYPES.map((type, i) => {
    const spec: ToothSpec = {
      cx: x + TOOTH_WIDTHS[i] / 2,
      width: TOOTH_WIDTHS[i],
      crownH: crownHeights[i],
      gumY: gumYs[i],
      type,
    };
    x += TOOTH_WIDTHS[i] + TOOTH_GAP;
    return spec;
  });
}

const UPPER_SPECS = computeTeethRow('upper');
const LOWER_SPECS = computeTeethRow('lower');

function upperCrownPath(t: ToothSpec): string {
  const hw = t.width / 2;
  const l = t.cx - hw;
  const r = t.cx + hw;
  const top = t.gumY;
  const bot = top + t.crownH;
  const mid = top + t.crownH * 0.5;

  switch (t.type) {
    case 'central':
      return [
        `M${l + 3},${top}`,
        `C${l},${top + 4} ${l - 1},${mid} ${l + 1},${bot - 5}`,
        `Q${l + 3},${bot + 1} ${t.cx - 3},${bot + 2}`,
        `Q${t.cx},${bot + 4} ${t.cx + 3},${bot + 2}`,
        `Q${r - 3},${bot + 1} ${r - 1},${bot - 5}`,
        `C${r + 1},${mid} ${r},${top + 4} ${r - 3},${top}`,
        'Z',
      ].join(' ');

    case 'lateral':
      return [
        `M${l + 3},${top}`,
        `C${l + 1},${top + 3} ${l},${mid - 2} ${l + 1},${bot - 4}`,
        `Q${l + 3},${bot + 1} ${t.cx - 2},${bot + 2}`,
        `Q${t.cx},${bot + 3} ${t.cx + 2},${bot + 2}`,
        `Q${r - 3},${bot + 1} ${r - 1},${bot - 4}`,
        `C${r},${mid - 2} ${r - 1},${top + 3} ${r - 3},${top}`,
        'Z',
      ].join(' ');

    case 'canine':
      return [
        `M${l + 2},${top}`,
        `C${l - 1},${top + 5} ${l},${mid + 2} ${t.cx - 4},${bot - 3}`,
        `Q${t.cx - 1},${bot + 2} ${t.cx},${bot + 3}`,
        `Q${t.cx + 1},${bot + 2} ${t.cx + 4},${bot - 3}`,
        `C${r},${mid + 2} ${r + 1},${top + 5} ${r - 2},${top}`,
        'Z',
      ].join(' ');

    case 'molar1': {
      return [
        `M${l + 2},${top}`,
        `Q${l - 1},${top + 4} ${l},${mid}`,
        `Q${l - 1},${bot - 4} ${l + 3},${bot - 1}`,
        `Q${t.cx - hw * 0.25},${bot + 3} ${t.cx},${bot + 1}`,
        `Q${t.cx + hw * 0.25},${bot + 3} ${r - 3},${bot - 1}`,
        `Q${r + 1},${bot - 4} ${r},${mid}`,
        `Q${r + 1},${top + 4} ${r - 2},${top}`,
        'Z',
      ].join(' ');
    }

    case 'molar2': {
      const q1 = t.cx - hw * 0.3;
      const q2 = t.cx + hw * 0.3;
      return [
        `M${l + 2},${top}`,
        `Q${l - 1},${top + 4} ${l},${mid}`,
        `Q${l - 1},${bot - 5} ${l + 3},${bot - 1}`,
        `Q${q1 - 1},${bot + 2} ${q1},${bot + 1}`,
        `Q${t.cx},${bot + 4} ${q2},${bot + 1}`,
        `Q${q2 + 1},${bot + 2} ${r - 3},${bot - 1}`,
        `Q${r + 1},${bot - 5} ${r},${mid}`,
        `Q${r + 1},${top + 4} ${r - 2},${top}`,
        'Z',
      ].join(' ');
    }
  }
}

function lowerCrownPath(t: ToothSpec): string {
  const hw = t.width / 2;
  const l = t.cx - hw;
  const r = t.cx + hw;
  const bot = t.gumY;
  const top = bot - t.crownH;
  const mid = bot - t.crownH * 0.5;

  switch (t.type) {
    case 'central':
      return [
        `M${l + 3},${bot}`,
        `C${l},${bot - 4} ${l - 1},${mid} ${l + 1},${top + 5}`,
        `Q${l + 3},${top - 1} ${t.cx - 3},${top - 2}`,
        `Q${t.cx},${top - 4} ${t.cx + 3},${top - 2}`,
        `Q${r - 3},${top - 1} ${r - 1},${top + 5}`,
        `C${r + 1},${mid} ${r},${bot - 4} ${r - 3},${bot}`,
        'Z',
      ].join(' ');

    case 'lateral':
      return [
        `M${l + 3},${bot}`,
        `C${l + 1},${bot - 3} ${l},${mid + 2} ${l + 1},${top + 4}`,
        `Q${l + 3},${top - 1} ${t.cx - 2},${top - 2}`,
        `Q${t.cx},${top - 3} ${t.cx + 2},${top - 2}`,
        `Q${r - 3},${top - 1} ${r - 1},${top + 4}`,
        `C${r},${mid + 2} ${r - 1},${bot - 3} ${r - 3},${bot}`,
        'Z',
      ].join(' ');

    case 'canine':
      return [
        `M${l + 2},${bot}`,
        `C${l - 1},${bot - 5} ${l},${mid - 2} ${t.cx - 4},${top + 3}`,
        `Q${t.cx - 1},${top - 2} ${t.cx},${top - 3}`,
        `Q${t.cx + 1},${top - 2} ${t.cx + 4},${top + 3}`,
        `C${r},${mid - 2} ${r + 1},${bot - 5} ${r - 2},${bot}`,
        'Z',
      ].join(' ');

    case 'molar1':
      return [
        `M${l + 2},${bot}`,
        `Q${l - 1},${bot - 4} ${l},${mid}`,
        `Q${l - 1},${top + 4} ${l + 3},${top + 1}`,
        `Q${t.cx - hw * 0.25},${top - 3} ${t.cx},${top - 1}`,
        `Q${t.cx + hw * 0.25},${top - 3} ${r - 3},${top + 1}`,
        `Q${r + 1},${top + 4} ${r},${mid}`,
        `Q${r + 1},${bot - 4} ${r - 2},${bot}`,
        'Z',
      ].join(' ');

    case 'molar2': {
      const q1 = t.cx - hw * 0.3;
      const q2 = t.cx + hw * 0.3;
      return [
        `M${l + 2},${bot}`,
        `Q${l - 1},${bot - 4} ${l},${mid}`,
        `Q${l - 1},${top + 5} ${l + 3},${top + 1}`,
        `Q${q1 - 1},${top - 2} ${q1},${top - 1}`,
        `Q${t.cx},${top - 4} ${q2},${top - 1}`,
        `Q${q2 + 1},${top - 2} ${r - 3},${top + 1}`,
        `Q${r + 1},${top + 5} ${r},${mid}`,
        `Q${r + 1},${bot - 4} ${r - 2},${bot}`,
        'Z',
      ].join(' ');
    }
  }
}

function buildGumPath(specs: ToothSpec[], jaw: 'upper' | 'lower'): string {
  const first = specs[0];
  const last = specs[specs.length - 1];
  const padX = 12;
  const leftX = first.cx - first.width / 2 - padX;
  const rightX = last.cx + last.width / 2 + padX;

  if (jaw === 'upper') {
    const topY = 18;
    const outerCurveY = 12;
    const pts = specs.map(s => ({ x: s.cx, y: s.gumY + 5 }));
    return [
      `M${leftX},${first.gumY - 6}`,
      `Q${leftX},${topY} ${leftX + 22},${topY}`,
      `Q${CX},${outerCurveY} ${rightX - 22},${topY}`,
      `Q${rightX},${topY} ${rightX},${last.gumY - 6}`,
      `Q${rightX},${last.gumY + 3} ${rightX - 2},${last.gumY + 5}`,
      `Q${rightX - 15},${last.gumY + 7} ${pts[8].x},${pts[8].y}`,
      `Q${pts[7].x + 5},${pts[7].y + 1} ${pts[6].x},${pts[6].y}`,
      `C${pts[5].x + 10},${pts[5].y + 2} ${pts[5].x},${pts[5].y + 2} ${pts[4].x + (pts[5].x - pts[4].x) / 2},${pts[4].y + 2}`,
      `C${pts[4].x},${pts[4].y + 2} ${pts[3].x + 5},${pts[3].y + 1} ${pts[3].x},${pts[3].y}`,
      `Q${pts[2].x + 5},${pts[2].y + 1} ${pts[1].x},${pts[1].y}`,
      `Q${leftX + 15},${first.gumY + 7} ${leftX + 2},${first.gumY + 5}`,
      `Q${leftX},${first.gumY + 3} ${leftX},${first.gumY - 6}`,
      'Z',
    ].join(' ');
  }

  const botY = 268;
  const outerCurveY = 274;
  const pts = specs.map(s => ({ x: s.cx, y: s.gumY - 5 }));
  return [
    `M${leftX},${first.gumY + 6}`,
    `Q${leftX},${botY} ${leftX + 22},${botY}`,
    `Q${CX},${outerCurveY} ${rightX - 22},${botY}`,
    `Q${rightX},${botY} ${rightX},${last.gumY + 6}`,
    `Q${rightX},${last.gumY - 3} ${rightX - 2},${last.gumY - 5}`,
    `Q${rightX - 15},${last.gumY - 7} ${pts[8].x},${pts[8].y}`,
    `Q${pts[7].x + 5},${pts[7].y - 1} ${pts[6].x},${pts[6].y}`,
    `C${pts[5].x + 10},${pts[5].y - 2} ${pts[5].x},${pts[5].y - 2} ${pts[4].x + (pts[5].x - pts[4].x) / 2},${pts[4].y - 2}`,
    `C${pts[4].x},${pts[4].y - 2} ${pts[3].x + 5},${pts[3].y - 1} ${pts[3].x},${pts[3].y}`,
    `Q${pts[2].x + 5},${pts[2].y - 1} ${pts[1].x},${pts[1].y}`,
    `Q${leftX + 15},${first.gumY - 7} ${leftX + 2},${first.gumY - 5}`,
    `Q${leftX},${first.gumY - 3} ${leftX},${first.gumY + 6}`,
    'Z',
  ].join(' ');
}

const UPPER_GUM_PATH = buildGumPath(UPPER_SPECS, 'upper');
const LOWER_GUM_PATH = buildGumPath(LOWER_SPECS, 'lower');

const toDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date();
  date.setFullYear(year, (month || 1) - 1, day || 1);
  date.setHours(12, 0, 0, 0);
  return date;
};

const formatDateLabel = (value: string) => {
  const parsed = parseDateOnly(value);
  const day = `${parsed.getDate()}`.padStart(2, '0');
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatMonthLabel = (value: string) => {
  const parsed = parseDateOnly(value);
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(parsed);
};

const normalizeEditorDate = (date: Date) => {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
};

export default function ToothTrackerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const adaptiveColors = useAdaptiveColors();
  const insets = useSafeAreaInsets();
  const { activeBabyId, isReady } = useActiveBaby();

  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;

  const [entries, setEntries] = useState<ToothEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showToothPicker, setShowToothPicker] = useState(true);
  const [selectedTooth, setSelectedTooth] = useState<ToothPosition | null>(null);
  const [formDate, setFormDate] = useState<Date>(() => normalizeEditorDate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [notesEditorVisible, setNotesEditorVisible] = useState(false);
  const [formSymptoms, setFormSymptoms] = useState<ToothSymptom[]>([]);

  const entriesByTooth = useMemo(
    () => new Map(entries.map((entry) => [entry.tooth_position, entry])),
    [entries],
  );

  const eruptedTeeth = useMemo(
    () => new Set(entries.map((entry) => entry.tooth_position)),
    [entries],
  );

  const eruptedCount = entries.length;

  const timelineEntries = useMemo(() => {
    const sorted = [...entries];
    sorted.sort((a, b) => {
      const byDate = b.eruption_date.localeCompare(a.eruption_date);
      if (byDate !== 0) return byDate;
      return b.updated_at.localeCompare(a.updated_at);
    });
    return sorted;
  }, [entries]);

  const groupedTimeline = useMemo(() => {
    const groups = new Map<string, ToothEntry[]>();

    for (const entry of timelineEntries) {
      const monthKey = entry.eruption_date.slice(0, 7);
      const bucket = groups.get(monthKey) ?? [];
      bucket.push(entry);
      groups.set(monthKey, bucket);
    }

    return Array.from(groups.entries()).map(([monthKey, items]) => ({
      monthKey,
      monthLabel: formatMonthLabel(`${monthKey}-01`),
      items,
    }));
  }, [timelineEntries]);

  const availableTeeth = useMemo(
    () => ALL_TEETH.filter((tooth) => !entriesByTooth.has(tooth.key) || tooth.key === selectedTooth),
    [entriesByTooth, selectedTooth],
  );

  const loadEntries = useCallback(async () => {
    if (!isReady) return;

    if (!activeBabyId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await getToothEntries(activeBabyId);
      if (error) throw error;
      setEntries(data ?? []);
    } catch (error) {
      console.error('Failed to load tooth entries:', error);
      Alert.alert('Fehler', 'Die Zahneinträge konnten nicht geladen werden.');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBabyId, isReady]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const closeEditor = () => {
    setEditorVisible(false);
    setShowDatePicker(false);
    setNotesEditorVisible(false);
    setShowToothPicker(true);
  };

  const openCreateModal = useCallback((preferredTooth?: ToothPosition, fromToothTap = false) => {
    if (!activeBabyId) {
      Alert.alert('Kein Baby ausgewählt', 'Bitte wähle zuerst ein Baby aus.');
      return;
    }

    const freeTeeth = ALL_TEETH.filter((tooth) => !entriesByTooth.has(tooth.key));
    if (freeTeeth.length === 0) {
      Alert.alert('Alles dokumentiert', 'Für dieses Baby sind bereits alle 20 Milchzähne eingetragen.');
      return;
    }

    const defaultTooth = preferredTooth && !entriesByTooth.has(preferredTooth)
      ? preferredTooth
      : freeTeeth[0].key;

    setEditorMode('create');
    setEditingEntryId(null);
    setShowToothPicker(!fromToothTap);
    setSelectedTooth(defaultTooth);
    setFormDate(normalizeEditorDate(new Date()));
    setFormNotes('');
    setFormSymptoms([]);
    setShowDatePicker(false);
    setNotesEditorVisible(false);
    setEditorVisible(true);
  }, [activeBabyId, entriesByTooth]);

  const openEditModal = useCallback((entry: ToothEntry) => {
    setEditorMode('edit');
    setEditingEntryId(entry.id);
    setShowToothPicker(false);
    setSelectedTooth(entry.tooth_position);
    setFormDate(normalizeEditorDate(parseDateOnly(entry.eruption_date)));
    setFormNotes(entry.notes ?? '');
    setFormSymptoms(entry.symptoms ?? []);
    setShowDatePicker(false);
    setNotesEditorVisible(false);
    setEditorVisible(true);
  }, []);

  const handleToothPress = useCallback((toothKey: ToothPosition) => {
    if (!activeBabyId) {
      Alert.alert('Kein Baby ausgewählt', 'Bitte wähle zuerst ein Baby aus.');
      return;
    }

    const existing = entriesByTooth.get(toothKey);
    if (existing) {
      openEditModal(existing);
      return;
    }

    openCreateModal(toothKey, true);
  }, [activeBabyId, entriesByTooth, openCreateModal, openEditModal]);

  const toggleSymptom = (symptom: ToothSymptom) => {
    setFormSymptoms((prev) => {
      if (prev.includes(symptom)) {
        return prev.filter((item) => item !== symptom);
      }
      return [...prev, symptom];
    });
  };

  const handleSave = async () => {
    if (!activeBabyId) {
      Alert.alert('Kein Baby ausgewählt', 'Bitte wähle zuerst ein Baby aus.');
      return;
    }

    if (!selectedTooth) {
      Alert.alert('Zahn fehlt', 'Bitte wähle einen Zahn aus.');
      return;
    }

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (formDate.getTime() > now.getTime()) {
      Alert.alert('Ungültiges Datum', 'Das Durchbruch-Datum darf nicht in der Zukunft liegen.');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        eruption_date: toDateOnly(formDate),
        notes: formNotes,
        symptoms: formSymptoms,
      };

      let error: unknown = null;

      if (editorMode === 'edit' && editingEntryId) {
        const result = await updateToothEntry(editingEntryId, payload);
        error = result.error;
      } else {
        const result = await saveToothEntry({
          baby_id: activeBabyId,
          tooth_position: selectedTooth,
          ...payload,
        });
        error = result.error;
      }

      if (error) throw error;

      await loadEntries();
      closeEditor();
    } catch (error) {
      console.error('Failed to save tooth entry:', error);
      Alert.alert('Fehler', 'Der Zahneintrag konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingEntryId) return;

    Alert.alert('Eintrag löschen', 'Möchtest du diesen Zahneintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsSaving(true);
            const { error } = await deleteToothEntry(editingEntryId);
            if (error) throw error;

            await loadEntries();
            closeEditor();
          } catch (deleteError) {
            console.error('Failed to delete tooth entry:', deleteError);
            Alert.alert('Fehler', 'Der Zahneintrag konnte nicht gelöscht werden.');
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const softenedGumColor = isDark ? 'rgba(196, 128, 122, 0.44)' : 'rgba(240, 160, 155, 0.55)';
  const softenedGumHighlight = isDark ? 'rgba(232, 164, 158, 0.24)' : 'rgba(255, 205, 198, 0.38)';

  const toothGradTop = '#FFFFFF';
  const toothGradMid = isDark ? '#F4F0EA' : '#F9F6F2';
  const toothGradBot = isDark ? '#E6DED4' : '#EFEAE4';
  const toothInactiveFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(200,185,170,0.18)';
  const toothInactiveStroke = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(180,165,150,0.22)';
  const toothActiveStroke = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(180,165,150,0.5)';
  const shadowColor = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)';

  const renderTeethSvg = (teeth: ToothDef[], specs: ToothSpec[], jaw: 'upper' | 'lower') => {
    return teeth.map((tooth, i) => {
      const spec = specs[i];
      const erupted = eruptedTeeth.has(tooth.key);
      const d = jaw === 'upper' ? upperCrownPath(spec) : lowerCrownPath(spec);
      const shadowOffset = jaw === 'upper' ? 2 : -2;

      return (
        <G key={tooth.key} onPress={() => handleToothPress(tooth.key)}>
          {erupted && (
            <Path
              d={d}
              fill={shadowColor}
              transform={`translate(0,${shadowOffset})`}
            />
          )}

          <Path
            d={d}
            fill={erupted ? 'url(#toothGrad)' : toothInactiveFill}
            fillOpacity={erupted ? 0.95 : 0.55}
            stroke={erupted ? toothActiveStroke : toothInactiveStroke}
            strokeWidth={erupted ? 1 : 0.8}
            strokeLinejoin="round"
          />

          {erupted && (
            <Path
              d={d}
              fill="white"
              opacity={0.15}
              transform={`translate(0,${jaw === 'upper' ? -1.5 : 1.5})`}
            />
          )}
        </G>
      );
    });
  };

  const isCtaDisabled = !activeBabyId || !isReady || isLoading;

  const statsMessage = useMemo(() => {
    if (eruptedCount === 0) return 'Noch kein Zahn sichtbar';
    if (eruptedCount === 1) return 'Der erste Zahn ist da 🦷✨';
    if (eruptedCount >= 20) return 'Komplettes Milchgebiss 🎉';
    if (eruptedCount >= 8) return 'Halbzeit erreicht';
    return 'Dein Baby bekommt sein Lächeln 🥹';
  }, [eruptedCount]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage}>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <Header title="Zahn-Tracker" showBackButton />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <LiquidGlassCard style={styles.card} intensity={28} overlayColor={glassOverlay}>
              <View style={styles.statsInner}>
                <View style={styles.statsStack}>
                  <ThemedText style={[styles.statsNumber, { color: PRIMARY }]}>{eruptedCount}</ThemedText>
                  <ThemedText style={[styles.statsLabel, { color: textSecondary }]}>von 20 Milchzähnen</ThemedText>
                  <ThemedText style={[styles.statsMood, { color: textSecondary }]}>{statsMessage}</ThemedText>
                </View>
              </View>
            </LiquidGlassCard>

            <LiquidGlassCard style={styles.card} intensity={26} overlayColor={glassOverlay}>
              <View style={styles.chartInner}>
                <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Gebiss-Übersicht</ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: textSecondary }]}>
                  {!activeBabyId
                    ? 'Bitte zuerst ein Baby auswählen.'
                    : 'Tippe auf einen Zahn, um Details zu erfassen.'}
                </ThemedText>

                <View style={styles.jawLabelRow}>
                  <ThemedText style={[styles.jawLabel, { color: textSecondary }]}>Oberkiefer</ThemedText>
                </View>

                <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={styles.svg}>
                  <Defs>
                    <SvgLinearGradient id="gumGradUpper" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={softenedGumHighlight} />
                      <Stop offset="1" stopColor={softenedGumColor} />
                    </SvgLinearGradient>
                    <SvgLinearGradient id="gumGradLower" x1="0" y1="1" x2="0" y2="0">
                      <Stop offset="0" stopColor={softenedGumHighlight} />
                      <Stop offset="1" stopColor={softenedGumColor} />
                    </SvgLinearGradient>
                    <SvgLinearGradient id="toothGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={toothGradTop} />
                      <Stop offset="0.6" stopColor={toothGradMid} />
                      <Stop offset="1" stopColor={toothGradBot} />
                    </SvgLinearGradient>
                  </Defs>

                  <Path d={UPPER_GUM_PATH} fill="url(#gumGradUpper)" />
                  <G>{renderTeethSvg(UPPER_TEETH, UPPER_SPECS, 'upper')}</G>

                  <Ellipse
                    cx={CX}
                    cy={SVG_H / 2}
                    rx={95}
                    ry={10}
                    fill={isDark ? 'rgba(120,90,70,0.1)' : 'rgba(120,90,70,0.05)'}
                  />

                  <Path d={LOWER_GUM_PATH} fill="url(#gumGradLower)" />
                  <G>{renderTeethSvg(LOWER_TEETH, LOWER_SPECS, 'lower')}</G>
                </Svg>

                <View style={styles.jawLabelRow}>
                  <ThemedText style={[styles.jawLabel, { color: textSecondary }]}>Unterkiefer</ThemedText>
                </View>
              </View>
            </LiquidGlassCard>

            <LiquidGlassCard style={styles.card} intensity={26} overlayColor={glassOverlay}>
              <View style={styles.timelineInner}>
                <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Eingetragene Zähne</ThemedText>

                {isLoading ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={PRIMARY} />
                  </View>
                ) : timelineEntries.length === 0 ? (
                  <ThemedText style={[styles.emptyText, { color: textSecondary }]}>Noch keine Zähne eingetragen.</ThemedText>
                ) : (
                  groupedTimeline.map((group) => (
                    <View key={group.monthKey} style={styles.timelineMonthBlock}>
                      <ThemedText style={[styles.timelineMonthTitle, { color: textSecondary }]}>
                        {group.monthLabel}
                      </ThemedText>
                      {group.items.map((entry) => (
                        <View key={entry.id} style={styles.timelineItem}>
                          <View style={[styles.dateBubble, { backgroundColor: `${PRIMARY}20` }]}>
                            <ThemedText style={[styles.dateText, { color: PRIMARY }]}>{formatDateLabel(entry.eruption_date)}</ThemedText>
                          </View>
                          <View style={[styles.toothMiniIcon, { backgroundColor: `${PRIMARY}14` }]}>
                            <ThemedText style={styles.toothMiniIconText}>🦷</ThemedText>
                          </View>
                          <ThemedText style={[styles.toothName, { color: textPrimary }]}>
                            {BABY_TEETH_MAP[entry.tooth_position]?.label ?? entry.tooth_position}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </View>
            </LiquidGlassCard>

            <View style={{ height: 96 }} />
          </ScrollView>

          <View style={[styles.ctaContainer, { paddingBottom: Math.max(18, insets.bottom + 8) }]}>
            <TouchableOpacity
              style={[styles.ctaButton, isCtaDisabled && styles.ctaButtonDisabled]}
              activeOpacity={0.85}
              onPress={() => openCreateModal()}
              disabled={isCtaDisabled}
            >
              <ThemedText style={styles.ctaText}>+ Zahn eintragen</ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ThemedBackground>

      <Modal
        visible={editorVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.38)' }]}>
          <TouchableWithoutFeedback onPress={closeEditor}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <BlurView
            intensity={88}
            tint={isDark ? 'dark' : 'extraLight'}
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? 'rgba(10,10,12,0.88)' : 'rgba(255,255,255,0.92)',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.72)',
                paddingBottom: Math.max(22, insets.bottom + 8),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={closeEditor}
                style={[styles.headerButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}
                disabled={isSaving}
              >
                <ThemedText style={[styles.closeButtonLabel, { color: textSecondary }]}>✕</ThemedText>
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
                  {editorMode === 'edit' ? 'Zahn bearbeiten' : 'Zahn eintragen'}
                </ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: textSecondary }]}>
                  {editorMode === 'edit' ? 'Eintrag aktualisieren' : 'Details eingeben'}
                </ThemedText>
              </View>

              <TouchableOpacity
                style={[styles.headerButton, styles.saveHeaderButton, isSaving && styles.saveHeaderButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.saveHeaderButtonText}>✓</ThemedText>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {selectedTooth && (
                <View style={styles.selectedToothHero}>
                  <View style={[styles.selectedToothHeroIcon, { backgroundColor: `${PRIMARY}14` }]}>
                    <ThemedText style={styles.selectedToothHeroIconText}>🦷</ThemedText>
                  </View>
                  <ThemedText style={[styles.selectedToothHeroLabel, { color: textPrimary }]}>
                    {BABY_TEETH_MAP[selectedTooth]?.label ?? selectedTooth}
                  </ThemedText>
                </View>
              )}

              {editorMode === 'create' && showToothPicker && (
                <View style={styles.modalSection}>
                  <ThemedText style={[styles.modalSectionLabel, { color: textPrimary }]}>Zahn auswählen</ThemedText>
                  <View style={styles.toothChipWrap}>
                    {availableTeeth.map((tooth) => {
                      const active = selectedTooth === tooth.key;
                      return (
                        <TouchableOpacity
                          key={tooth.key}
                          style={[
                            styles.toothChip,
                            {
                              backgroundColor: active
                                ? PRIMARY
                                : isDark
                                  ? 'rgba(255,255,255,0.09)'
                                  : 'rgba(255,255,255,0.75)',
                              borderColor: active
                                ? PRIMARY
                                : isDark
                                  ? 'rgba(255,255,255,0.18)'
                                  : 'rgba(0,0,0,0.07)',
                            },
                          ]}
                          onPress={() => setSelectedTooth(tooth.key)}
                          activeOpacity={0.9}
                        >
                          <ThemedText style={[styles.toothChipLabel, { color: active ? '#FFF' : textPrimary }]} numberOfLines={2}>
                            {tooth.label}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.modalSection}>
                <ThemedText style={[styles.modalSectionLabel, { color: textPrimary }]}>Durchbruch-Datum</ThemedText>
                <View
                  style={[
                    styles.dateContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.76)',
                      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <TouchableOpacity style={styles.dateHeader} onPress={() => setShowDatePicker((prev) => !prev)}>
                    <ThemedText style={[styles.dateValue, { color: textPrimary }]}>{formatDateLabel(toDateOnly(formDate))}</ThemedText>
                    <View style={[styles.calendarPill, { backgroundColor: `${PRIMARY}18` }]}>
                      <ThemedText style={[styles.calendarPillIcon, { color: PRIMARY }]}>📅</ThemedText>
                    </View>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <View style={styles.datePickerWrap}>
                      <DateTimePicker
                        value={formDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        maximumDate={new Date()}
                        themeVariant={isDark ? 'dark' : 'light'}
                        accentColor={PRIMARY}
                        onChange={(event, date) => {
                          if (date) {
                            setFormDate(normalizeEditorDate(date));
                          }

                          if (Platform.OS !== 'ios') {
                            setShowDatePicker(false);
                          } else if (event?.type === 'dismissed') {
                            setShowDatePicker(false);
                          }
                        }}
                      />
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.modalSection}>
                <ThemedText style={[styles.modalSectionLabel, { color: textPrimary }]}>Symptome</ThemedText>
                <View style={styles.symptomWrap}>
                  {SYMPTOM_OPTIONS.map((option) => {
                    const active = formSymptoms.includes(option.key);
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.symptomChip,
                          {
                            backgroundColor: active
                              ? `${PRIMARY}15`
                              : isDark
                                ? 'rgba(255,255,255,0.09)'
                                : 'rgba(255,255,255,0.78)',
                            borderColor: active
                              ? PRIMARY
                              : isDark
                                ? 'rgba(255,255,255,0.18)'
                                : 'rgba(0,0,0,0.07)',
                          },
                        ]}
                        onPress={() => toggleSymptom(option.key)}
                      >
                        <ThemedText style={[styles.symptomLabel, { color: active ? PRIMARY : textPrimary }]}>
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalSection}>
                <ThemedText style={[styles.modalSectionLabel, { color: textPrimary }]}>Notizen</ThemedText>
                <TouchableOpacity
                  style={[
                    styles.notesInput,
                    styles.notesInputTouchable,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.78)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.07)',
                    },
                  ]}
                  activeOpacity={0.9}
                  onPress={() => setNotesEditorVisible(true)}
                >
                  <ThemedText
                    style={[
                      formNotes.trim() ? styles.notesInputValue : styles.notesInputPlaceholder,
                      {
                        color: formNotes.trim()
                          ? textPrimary
                          : isDark
                            ? 'rgba(255,255,255,0.45)'
                            : 'rgba(90,70,60,0.45)',
                      },
                    ]}
                    numberOfLines={4}
                  >
                    {formNotes.trim() || 'Optional: Beobachtungen oder Hinweise'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {editorMode === 'edit' && (
                <TouchableOpacity
                  style={styles.deleteActionButton}
                  onPress={handleDelete}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  <ThemedText style={styles.deleteActionButtonText}>🗑️ Eintrag löschen</ThemedText>
                </TouchableOpacity>
              )}
            </ScrollView>
            <TextInputOverlay
              visible={notesEditorVisible}
              label="Notizen"
              value={formNotes}
              placeholder="Optional: Beobachtungen oder Hinweise"
              multiline
              accentColor={PRIMARY}
              onClose={() => setNotesEditorVisible(false)}
              onSubmit={(next) => {
                setFormNotes(next);
                setNotesEditorVisible(false);
              }}
            />
          </BlurView>
        </View>
      </Modal>
    </>
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
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 10,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },

  statsInner: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsStack: {
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 42,
    letterSpacing: -0.4,
    minWidth: 28,
    textAlign: 'center',
    includeFontPadding: false,
  },
  statsLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  statsMood: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.78,
  },

  chartInner: {
    padding: 16,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
  jawLabelRow: {
    alignItems: 'center',
    marginVertical: 2,
  },
  jawLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.6,
  },
  svg: {
    alignSelf: 'center',
  },

  timelineInner: {
    padding: 16,
  },
  timelineMonthBlock: {
    marginTop: 10,
  },
  timelineMonthTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
    opacity: 0.82,
    marginBottom: 2,
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.7,
    lineHeight: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  dateBubble: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toothMiniIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toothMiniIconText: {
    fontSize: 13,
  },
  toothName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },

  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 12,
  },
  ctaButton: {
    backgroundColor: PRIMARY,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaButtonDisabled: {
    opacity: 0.55,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    height: '85%',
    maxHeight: 700,
    minHeight: 560,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButtonLabel: {
    fontSize: 20,
    fontWeight: '500',
  },
  saveHeaderButton: {
    backgroundColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  saveHeaderButtonDisabled: {
    opacity: 0.72,
  },
  saveHeaderButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalScrollContent: {
    paddingBottom: 18,
  },
  selectedToothHero: {
    marginTop: 2,
    marginBottom: 14,
    alignItems: 'center',
    overflow: 'visible',
  },
  selectedToothHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    marginBottom: 8,
    overflow: 'visible',
  },
  selectedToothHeroIconText: {
    fontSize: 25,
    lineHeight: 32,
    textAlign: 'center',
  },
  selectedToothHeroLabel: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  modalSection: {
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  modalSectionLabel: {
    width: '96%',
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  toothChipWrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toothChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '48%',
  },
  toothChipLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  dateContainer: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  calendarPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarPillIcon: {
    fontSize: 15,
  },
  datePickerWrap: {
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  symptomWrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  symptomLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  notesInput: {
    width: '100%',
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  notesInputTouchable: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  notesInputValue: {
    fontSize: 14,
    lineHeight: 20,
    width: '100%',
  },
  notesInputPlaceholder: {
    fontSize: 14,
    lineHeight: 20,
    width: '100%',
  },
  deleteActionButton: {
    width: '100%',
    marginTop: 2,
    marginBottom: 8,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,80,100,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(220,80,100,0.36)',
  },
  deleteActionButtonText: {
    color: '#CC375E',
    fontSize: 15,
    fontWeight: '800',
  },
});
