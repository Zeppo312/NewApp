import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, SafeAreaView, StatusBar, FlatList, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter, Stack } from 'expo-router';
import { ThemedBackground } from '@/components/ThemedBackground';
import TextInputOverlay from '@/components/modals/TextInputOverlay';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD, TIMELINE_INSET, TEXT_PRIMARY } from '@/constants/DesignGuide';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isUserAdmin } from '@/lib/supabase/recommendations';

// Fallback-Daten für Babynamen, falls die Datenbank nicht verfügbar ist
const FALLBACK_NAMES = {
  male: [
    { name: 'Noah', meaning: 'Ruhe, Trost', origin: 'Hebräisch', gender: 'male' as const },
    { name: 'Leon', meaning: 'Löwe', origin: 'Lateinisch', gender: 'male' as const },
    { name: 'Paul', meaning: 'Der Kleine, der Bescheidene', origin: 'Lateinisch', gender: 'male' as const },
    { name: 'Ben', meaning: 'Sohn', origin: 'Hebräisch', gender: 'male' as const },
    { name: 'Finn', meaning: 'Der Blonde, der Helle', origin: 'Irisch', gender: 'male' as const },
  ],
  female: [
    { name: 'Emma', meaning: 'Die Große, die Starke', origin: 'Germanisch', gender: 'female' as const },
    { name: 'Mia', meaning: 'Mein', origin: 'Italienisch', gender: 'female' as const },
    { name: 'Hannah', meaning: 'Die Anmutige', origin: 'Hebräisch', gender: 'female' as const },
    { name: 'Emilia', meaning: 'Die Eifrige, die Fleißige', origin: 'Lateinisch', gender: 'female' as const },
    { name: 'Lina', meaning: 'Die Zarte, die Milde', origin: 'Arabisch', gender: 'female' as const },
  ],
  unisex: [
    { name: 'Alex', meaning: 'Der Beschützer', origin: 'Griechisch', gender: 'unisex' as const },
    { name: 'Charlie', meaning: 'Die Freie', origin: 'Germanisch', gender: 'unisex' as const },
    { name: 'Robin', meaning: 'Der Glänzende', origin: 'Germanisch', gender: 'unisex' as const },
    { name: 'Kim', meaning: 'Der Kühne', origin: 'Englisch', gender: 'unisex' as const },
    { name: 'Noel', meaning: 'Weihnachten', origin: 'Französisch', gender: 'unisex' as const },
  ]
};

// Kategorien für die Filterung
const CATEGORIES = [
  { id: 'all', name: 'Alle Namen', icon: 'list.bullet' },
  { id: 'male', name: 'Jungennamen', icon: 'figure.boy' },
  { id: 'female', name: 'Mädchennamen', icon: 'figure.girl' },
  { id: 'unisex', name: 'Unisex Namen', icon: 'person.2' },
  { id: 'favorites', name: 'Favoriten', icon: 'heart.fill' },
];

interface Name {
  id?: string;
  name: string;
  meaning?: string | null;
  origin?: string | null;
  gender?: 'male' | 'female' | 'unisex' | null;
  isFavorite?: boolean;
}

interface BulkEntry {
  localId: string;
  name: string;
  meaning: string;
  origin: string;
  gender: string;
  error?: string | null;
}

type FocusConfig = {
  mode: 'single' | 'bulk';
  field: 'name' | 'meaning' | 'origin' | 'gender';
  index?: number;
  label: string;
  placeholder?: string;
  multiline?: boolean;
};

export default function BabyNamesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [names, setNames] = useState<Name[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nameOffset, setNameOffset] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingName, setIsCreatingName] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingOriginalName, setEditingOriginalName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [persistedMeaning, setPersistedMeaning] = useState('');
  const [persistedOrigin, setPersistedOrigin] = useState('');
  const [persistedGender, setPersistedGender] = useState<'male' | 'female' | 'unisex'>('unisex');
  const [createMode, setCreateMode] = useState<'single' | 'bulk'>('single');
  const [bulkSql, setBulkSql] = useState('');
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkErrorIndex, setBulkErrorIndex] = useState<number | null>(null);
  const [bulkSqlSnapshot, setBulkSqlSnapshot] = useState<string | null>(null);
  const bulkListRef = useRef<FlatList<BulkEntry>>(null);
  const [focusConfig, setFocusConfig] = useState<FocusConfig | null>(null);
  const [focusValue, setFocusValue] = useState('');
  const namesFetchIdRef = useRef(0);
  const PAGE_SIZE = 40;

  useEffect(() => {
    if (user) {
      loadFavorites();
    }
    checkAdminStatus();
    resetAndLoadNames();
  }, [user]);

  useEffect(() => {
    resetAndLoadNames();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (selectedCategory === 'favorites') {
      resetAndLoadNames();
      return;
    }
    setNames(prev => prev.map(entry => ({ ...entry, isFavorite: favorites.includes(entry.name) })));
  }, [favorites]);

  useEffect(() => {
    if (bulkErrorIndex === null) return;
    bulkListRef.current?.scrollToIndex({ index: bulkErrorIndex, animated: true });
  }, [bulkErrorIndex]);

  useEffect(() => {
    if (!showCreateModal) {
      setFocusConfig(null);
      setFocusValue('');
    }
  }, [showCreateModal]);

  const checkAdminStatus = async () => {
    const adminStatus = await isUserAdmin();
    setIsAdmin(adminStatus);
  };

  // Lade Favoriten aus Supabase
  const loadFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('baby_names_favorites')
        .select('name')
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error loading favorites:', error);
        Alert.alert('Fehler', 'Favoriten konnten nicht geladen werden.');
      } else if (data) {
        const favoriteNames = data.map(item => item.name);
        setFavorites(favoriteNames);
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    }
  };

  const getFallbackNames = () => {
    let fallback: Name[] = [];
    if (selectedCategory === 'all') {
      fallback = [
        ...FALLBACK_NAMES.male,
        ...FALLBACK_NAMES.female,
        ...FALLBACK_NAMES.unisex,
      ];
    } else if (selectedCategory === 'favorites') {
      fallback = [
        ...FALLBACK_NAMES.male,
        ...FALLBACK_NAMES.female,
        ...FALLBACK_NAMES.unisex,
      ].filter(name => favorites.includes(name.name));
    } else {
      fallback = FALLBACK_NAMES[selectedCategory as keyof typeof FALLBACK_NAMES] ?? [];
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      fallback = fallback.filter(
        name =>
          name.name.toLowerCase().includes(query) ||
          (name.meaning || '').toLowerCase().includes(query) ||
          (name.origin || '').toLowerCase().includes(query)
      );
    }

    return fallback.map(name => ({
      ...name,
      isFavorite: favorites.includes(name.name),
    }));
  };

  const buildNamesQuery = () => {
    let query = supabase
      .from('baby_names')
      .select('id, name, meaning, origin, gender');

    if (selectedCategory !== 'all' && selectedCategory !== 'favorites') {
      query = query.eq('gender', selectedCategory);
    }

    if (selectedCategory === 'favorites') {
      if (favorites.length === 0) return null;
      query = query.in('name', favorites);
    }

    if (searchQuery.trim()) {
      const like = `%${searchQuery.trim()}%`;
      query = query.or(`name.ilike.${like},meaning.ilike.${like},origin.ilike.${like}`);
    }

    return query.order('name', { ascending: true });
  };

  const mergeNames = (current: Name[], incoming: Name[]) => {
    const existingIds = new Set(current.map(item => item.id));
    const merged = [...current];
    incoming.forEach(item => {
      if (!item.id || !existingIds.has(item.id)) {
        merged.push(item);
      }
    });
    return merged;
  };

  const fetchNamesPage = async (reset = false) => {
    const fetchId = (namesFetchIdRef.current += 1);
    if (reset) {
      setIsLoading(true);
      setIsLoadingMore(false);
      setHasMore(true);
      setNameOffset(0);
    } else {
      setIsLoadingMore(true);
    }

    const query = buildNamesQuery();
    if (!query) {
      setNames([]);
      setIsLoading(false);
      setIsLoadingMore(false);
      setHasMore(false);
      setUsingFallback(false);
      return;
    }

    try {
      const offset = reset ? 0 : nameOffset;
      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
      if (fetchId !== namesFetchIdRef.current) return;

      if (error) {
        console.error('Error loading baby names:', error);
        const fallback = getFallbackNames();
        setNames(fallback);
        setHasMore(false);
        setUsingFallback(true);
      } else {
        const next = (data ?? []).map(item => ({
          ...item,
          isFavorite: favorites.includes(item.name),
        }));
        setNames(prev => (reset ? next : mergeNames(prev, next)));
        setNameOffset(offset + next.length);
        setHasMore(next.length === PAGE_SIZE);
        setUsingFallback(false);
      }
    } catch (err) {
      console.error('Failed to load baby names:', err);
      const fallback = getFallbackNames();
      setNames(fallback);
      setHasMore(false);
      setUsingFallback(true);
    } finally {
      if (fetchId === namesFetchIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  const resetAndLoadNames = async () => {
    await fetchNamesPage(true);
  };

  const handleLoadMoreNames = () => {
    if (isLoading || isLoadingMore || !hasMore || usingFallback) return;
    fetchNamesPage(false);
  };

  const resetBulkState = () => {
    setBulkSql('');
    setBulkEntries([]);
    setBulkError(null);
    setBulkErrorIndex(null);
    setBulkSqlSnapshot(null);
  };

  const openFocusEditor = (config: FocusConfig, value: string) => {
    setFocusConfig(config);
    setFocusValue(value);
  };

  const closeFocusEditor = () => {
    setFocusConfig(null);
    setFocusValue('');
  };

  const saveFocusEditor = (nextValue?: string) => {
    if (!focusConfig) return;
    const next = typeof nextValue === 'string' ? nextValue : focusValue;

    if (focusConfig.mode === 'single') {
      if (focusConfig.field === 'name') {
        setNewName(next);
      } else if (focusConfig.field === 'meaning') {
        setPersistedMeaning(next);
      } else if (focusConfig.field === 'origin') {
        setPersistedOrigin(next);
      } else if (focusConfig.field === 'gender') {
        setPersistedGender(next.trim().toLowerCase() as 'male' | 'female' | 'unisex');
      }
    } else if (focusConfig.index !== undefined) {
      const patch = { [focusConfig.field]: next } as Partial<BulkEntry>;
      handleBulkEntryChange(focusConfig.index, patch);
    }

    closeFocusEditor();
  };

  const renderInlineField = (
    value: string,
    placeholder: string,
    onPress: () => void,
    multiline = false
  ) => (
    <TouchableOpacity
      style={[styles.modalInput, multiline && styles.modalInputMultiline]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <ThemedText
        style={[
          value ? styles.modalInputText : styles.modalInputPlaceholder,
          { color: value ? theme.text : theme.tabIconDefault },
        ]}
        numberOfLines={multiline ? 3 : 1}
      >
        {value || placeholder}
      </ThemedText>
    </TouchableOpacity>
  );

  const parseSqlLiteral = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return { type: 'raw' as const, value: '' };
    if (trimmed.toLowerCase() === 'null') return { type: 'null' as const, value: null };
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      const inner = trimmed.slice(1, -1).replace(/''/g, "'");
      return { type: 'string' as const, value: inner };
    }
    return { type: 'raw' as const, value: trimmed };
  };

  const splitSqlFields = (tuple: string) => {
    const fields: string[] = [];
    let buffer = '';
    let inQuote = false;
    let depth = 0;
    for (let i = 0; i < tuple.length; i += 1) {
      const char = tuple[i];
      const next = tuple[i + 1];
      if (char === "'" && inQuote && next === "'") {
        buffer += "''";
        i += 1;
        continue;
      }
      if (char === "'") {
        inQuote = !inQuote;
      }
      if (!inQuote) {
        if (char === '(') depth += 1;
        if (char === ')') depth = Math.max(0, depth - 1);
      }
      if (char === ',' && !inQuote && depth === 0) {
        fields.push(buffer.trim());
        buffer = '';
        continue;
      }
      buffer += char;
    }
    if (buffer.trim().length > 0) {
      fields.push(buffer.trim());
    }
    return fields;
  };

  const extractSqlTuples = (sql: string) => {
    const tuples: string[] = [];
    let buffer = '';
    let inQuote = false;
    let depth = 0;
    for (let i = 0; i < sql.length; i += 1) {
      const char = sql[i];
      const next = sql[i + 1];
      if (char === "'" && inQuote && next === "'") {
        if (depth > 0) buffer += "''";
        i += 1;
        continue;
      }
      if (char === "'") {
        inQuote = !inQuote;
      }
      if (!inQuote) {
        if (char === '(') {
          depth += 1;
          if (depth === 1) {
            buffer = '';
            continue;
          }
        } else if (char === ')') {
          depth -= 1;
          if (depth === 0) {
            tuples.push(buffer.trim());
            buffer = '';
            continue;
          }
        }
      }
      if (depth > 0) {
        buffer += char;
      }
    }
    return tuples;
  };

  const parseBulkSql = (sql: string) => {
    const valuesMatch = sql.match(/\bvalues\b/i);
    const normalizedSql = valuesMatch?.index !== undefined
      ? sql.slice(valuesMatch.index + valuesMatch[0].length)
      : sql;
    const tuples = extractSqlTuples(normalizedSql);
    if (tuples.length === 0) {
      return {
        entries: [] as BulkEntry[],
        errorMessage: 'Keine gültigen Werte gefunden. Bitte das INSERT-VALUES-Format prüfen.',
        errorIndex: null as number | null,
      };
    }

    const entries = tuples.map((tuple, index) => {
      const fields = splitSqlFields(tuple);
      let error: string | null = null;

      if (fields.length !== 6) {
        error = `Erwartet 6 Werte, gefunden ${fields.length}.`;
      }

      const nameParsed = parseSqlLiteral(fields[1] ?? '');
      const meaningParsed = parseSqlLiteral(fields[2] ?? '');
      const originParsed = parseSqlLiteral(fields[3] ?? '');
      const genderParsed = parseSqlLiteral(fields[4] ?? '');

      const nameValue = nameParsed.type === 'string' ? (nameParsed.value ?? '') : '';
      const meaningValue = meaningParsed.type === 'string' ? (meaningParsed.value ?? '') : '';
      const originValue = originParsed.type === 'string' ? (originParsed.value ?? '') : '';
      const genderValue = genderParsed.type === 'string' ? (genderParsed.value ?? '') : '';

      if (!error) {
        if (nameParsed.type !== 'string' || !nameValue.trim()) {
          error = 'Name fehlt oder ist nicht als Text angegeben.';
        } else if (meaningParsed.type === 'raw') {
          error = 'Bedeutung muss Text (in einfachen Anführungszeichen) oder NULL sein.';
        } else if (originParsed.type === 'raw') {
          error = 'Herkunft muss Text (in einfachen Anführungszeichen) oder NULL sein.';
        } else if (genderParsed.type !== 'string') {
          error = 'Geschlecht muss als Text angegeben werden.';
        }
      }

      return {
        localId: `${Date.now()}-${index}`,
        name: nameValue,
        meaning: meaningValue,
        origin: originValue,
        gender: genderValue,
        error,
      };
    });

    const firstErrorIndex = entries.findIndex(entry => entry.error);
    const errorMessage =
      firstErrorIndex >= 0
        ? `Fehler bei "${entries[firstErrorIndex].name || 'Unbekannt'}": ${entries[firstErrorIndex].error}`
        : null;

    return {
      entries,
      errorMessage,
      errorIndex: firstErrorIndex >= 0 ? firstErrorIndex : null,
    };
  };

  const validateBulkEntries = (entries: BulkEntry[]) => {
    const counts = new Map<string, number>();

    entries.forEach(entry => {
      const key = entry.name.trim().toLowerCase();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const nextEntries = entries.map(entry => {
      const issues: string[] = [];
      const nameValue = entry.name.trim();
      const genderValue = entry.gender.trim().toLowerCase();

      if (entry.error) {
        issues.push(entry.error);
      }
      if (!nameValue) {
        issues.push('Name fehlt.');
      }
      if (!genderValue) {
        issues.push('Geschlecht fehlt.');
      } else if (!['male', 'female', 'unisex'].includes(genderValue)) {
        issues.push('Geschlecht muss female, male oder unisex sein.');
      }
      if (nameValue && (counts.get(nameValue.toLowerCase()) ?? 0) > 1) {
        issues.push('Name ist in der Liste doppelt.');
      }

      return {
        ...entry,
        error: issues.length > 0 ? issues[0] : null,
      };
    });

    const firstErrorIndex = nextEntries.findIndex(entry => entry.error);
    const errorMessage =
      firstErrorIndex >= 0
        ? `Fehler bei "${nextEntries[firstErrorIndex].name || 'Unbekannt'}": ${nextEntries[firstErrorIndex].error}`
        : null;

    return {
      entries: nextEntries,
      errorMessage,
      errorIndex: firstErrorIndex >= 0 ? firstErrorIndex : null,
    };
  };

  const formatSupabaseError = (error: any) => {
    const message = typeof error?.message === 'string' ? error.message : 'Unbekannter Fehler';
    const details = typeof error?.details === 'string' ? error.details : '';
    const hint = typeof error?.hint === 'string' ? error.hint : '';
    const parts = [message];
    if (details) parts.push(`Details: ${details}`);
    if (hint) parts.push(`Hinweis: ${hint}`);
    return parts.join('\n');
  };

  const extractDuplicateName = (error: any) => {
    const details = typeof error?.details === 'string' ? error.details : '';
    const match = details.match(/\(name\)=\((.+?)\)/);
    return match?.[1] ?? null;
  };

  const findExistingNames = async (names: string[]) => {
    const trimmedNames = names.map(name => name.trim()).filter(Boolean);
    const uniqueNames = Array.from(new Set(trimmedNames));
    if (uniqueNames.length === 0) return [];

    const { data, error } = await supabase
      .from('baby_names')
      .select('name')
      .in('name', uniqueNames);

    if (error) {
      console.error('Error checking existing baby names:', error);
      return [];
    }

    return (data ?? []).map(row => row.name);
  };

  // Füge einen Namen zu Favoriten hinzu oder entferne ihn
  const toggleFavorite = async (name: string) => {
    if (!user) {
      Alert.alert('Hinweis', 'Du musst angemeldet sein, um Favoriten zu speichern.');
      return;
    }

    setIsSaving(true);

    try {
      if (favorites.includes(name)) {
        // Entferne aus Favoriten
        const { error } = await supabase
          .from('baby_names_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('name', name);

        if (error) {
          console.error('Error removing favorite:', error);
          Alert.alert('Fehler', 'Favorit konnte nicht entfernt werden.');
        } else {
          // Lokale Favoriten aktualisieren
          setFavorites(favorites.filter(n => n !== name));
        }
      } else {
        // Füge zu Favoriten hinzu
        const { error } = await supabase
          .from('baby_names_favorites')
          .insert({
            user_id: user.id,
            name: name
          });

        if (error) {
          console.error('Error adding favorite:', error);
          Alert.alert('Fehler', 'Favorit konnte nicht hinzugefügt werden.');
        } else {
          // Lokale Favoriten aktualisieren
          setFavorites([...favorites, name]);
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
    setNewName('');
    setPersistedMeaning('');
    setPersistedOrigin('');
    setPersistedGender('unisex');
    setEditingNameId(null);
    setEditingOriginalName(null);
    setCreateMode('single');
    resetBulkState();
    setShowCreateModal(true);
  };

  const handleEditName = (item: Name) => {
    setEditingNameId(item.id ?? null);
    setEditingOriginalName(item.name);
    setNewName(item.name);
    setPersistedMeaning(item.meaning || '');
    setPersistedOrigin(item.origin || '');
    setPersistedGender(item.gender || 'unisex');
    setCreateMode('single');
    resetBulkState();
    setShowCreateModal(true);
  };

  const handleDeleteName = (item: Name) => {
    if (!item.id) return;
    Alert.alert(
      'Name löschen',
      `Möchtest du "${item.name}" wirklich entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsCreatingName(true);
              const { error } = await supabase.from('baby_names').delete().eq('id', item.id);
              if (error) throw error;
              await resetAndLoadNames();
              setShowCreateModal(false);
              Alert.alert('Erfolg', 'Der Name wurde gelöscht.');
            } catch (err) {
              console.error('Error deleting baby name:', err);
              Alert.alert('Fehler', 'Der Name konnte nicht gelöscht werden.');
            } finally {
              setIsCreatingName(false);
            }
          }
        }
      ]
    );
  };

  const handleCreateName = async () => {
    if (!isAdmin) {
      Alert.alert('Hinweis', 'Nur Admins können Babynamen hinzufügen.');
      return;
    }

    if (createMode === 'bulk') {
      if (!bulkSql.trim() && bulkEntries.length === 0) {
        setBulkError('Bitte zuerst das SQL-Skript einfügen.');
        return;
      }

      let nextEntries = bulkEntries;
      if (bulkEntries.length === 0 || bulkSqlSnapshot !== bulkSql.trim()) {
        const parsed = parseBulkSql(bulkSql);
        nextEntries = parsed.entries;
        setBulkEntries(nextEntries);
        setBulkSqlSnapshot(bulkSql.trim());
        setBulkError(parsed.errorMessage);
        setBulkErrorIndex(parsed.errorIndex);
        if (parsed.errorMessage || nextEntries.length === 0) {
          return;
        }
      }

      const validation = validateBulkEntries(nextEntries);
      setBulkEntries(validation.entries);
      setBulkError(validation.errorMessage);
      setBulkErrorIndex(validation.errorIndex);
      if (validation.errorMessage) {
        return;
      }

      try {
        setIsCreatingName(true);
        const payload = validation.entries.map(entry => ({
          name: entry.name.trim(),
          meaning: entry.meaning.trim() || null,
          origin: entry.origin.trim() || null,
          gender: entry.gender.trim().toLowerCase(),
        }));

        const existingNames = await findExistingNames(payload.map(entry => entry.name));
        if (existingNames.length > 0) {
          const existingSet = new Set(existingNames.map(name => name.trim().toLowerCase()));
          const nextEntriesWithErrors = validation.entries.map(entry => {
            const isDuplicate = existingSet.has(entry.name.trim().toLowerCase());
            return isDuplicate
              ? { ...entry, error: 'Name existiert bereits in der Datenbank.' }
              : entry;
          });
          const firstDuplicateIndex = nextEntriesWithErrors.findIndex(entry => entry.error);
          const duplicateMessage =
            firstDuplicateIndex >= 0
              ? `Fehler bei "${nextEntriesWithErrors[firstDuplicateIndex].name}": ${nextEntriesWithErrors[firstDuplicateIndex].error}`
              : 'Mindestens ein Name existiert bereits in der Datenbank.';

          setBulkEntries(nextEntriesWithErrors);
          setBulkError(duplicateMessage);
          setBulkErrorIndex(firstDuplicateIndex >= 0 ? firstDuplicateIndex : null);
          Alert.alert('Fehler', duplicateMessage);
          return;
        }

        const { error } = await supabase.from('baby_names').insert(payload);
        if (error) {
          const errorMessage = formatSupabaseError(error);
          const duplicateName = extractDuplicateName(error);
          let scopedMessage = errorMessage;

          if (duplicateName) {
            const normalized = duplicateName.trim().toLowerCase();
            const index = validation.entries.findIndex(
              entry => entry.name.trim().toLowerCase() === normalized
            );
            if (index >= 0) {
              setBulkEntries(prev =>
                prev.map((entry, idx) =>
                  idx === index ? { ...entry, error: 'Name existiert bereits in der Datenbank.' } : entry
                )
              );
              setBulkErrorIndex(index);
              scopedMessage = `Fehler bei "${validation.entries[index].name}": Name existiert bereits in der Datenbank.`;
            } else {
              scopedMessage = `Fehler bei "${duplicateName}": ${errorMessage}`;
            }
          }

          setBulkError(scopedMessage);
          Alert.alert('Fehler', scopedMessage);
          return;
        }

        await resetAndLoadNames();
        resetBulkState();
        setShowCreateModal(false);
        setSelectedCategory('all');
        setSearchQuery('');
        Alert.alert('Erfolg', `${payload.length} Namen wurden hinzugefügt.`);
      } catch (err) {
        console.error('Failed to create baby names from SQL:', err);
        const message = formatSupabaseError(err);
        setBulkError(message);
        Alert.alert('Fehler', message);
      } finally {
        setIsCreatingName(false);
      }

      return;
    }

    const nameValue = newName.trim();
    if (!nameValue) {
      Alert.alert('Fehler', 'Bitte gib einen Namen ein.');
      return;
    }

    const originalName = editingOriginalName?.trim().toLowerCase();
    if (!editingNameId || originalName !== nameValue.toLowerCase()) {
      const existingNames = await findExistingNames([nameValue]);
      if (existingNames.length > 0) {
        Alert.alert('Hinweis', 'Dieser Name existiert bereits.');
        return;
      }
    }

    try {
      setIsCreatingName(true);
      const payload = {
        name: nameValue,
        meaning: (persistedMeaning || '').trim() || null,
        origin: (persistedOrigin || '').trim() || null,
        gender: persistedGender || 'unisex',
      };

      if (editingNameId) {
        const { error } = await supabase.from('baby_names').update(payload).eq('id', editingNameId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('baby_names').insert(payload);
        if (error) throw error;
      }

      await resetAndLoadNames();
      setShowCreateModal(false);
      setSelectedCategory('all');
      setSearchQuery('');
      setEditingNameId(null);
      setEditingOriginalName(null);
      Alert.alert('Erfolg', editingNameId ? 'Der Name wurde aktualisiert.' : 'Der Name wurde hinzugefügt.');
    } catch (err) {
      console.error('Failed to create baby name:', err);
      Alert.alert('Fehler', formatSupabaseError(err));
    } finally {
      setIsCreatingName(false);
    }
  };

  const handleBulkEntryChange = (index: number, patch: Partial<BulkEntry>) => {
    setBulkEntries(prev =>
      prev.map((entry, idx) =>
        idx === index
          ? {
              ...entry,
              ...patch,
              error: null,
            }
          : entry
      )
    );
    setBulkError(null);
    setBulkErrorIndex(null);
  };

  const handleRemoveBulkEntry = (index: number) => {
    setBulkEntries(prev => prev.filter((_, idx) => idx !== index));
    setBulkError(null);
    setBulkErrorIndex(null);
  };

  const handleParseBulkSql = () => {
    if (!bulkSql.trim()) {
      setBulkError('Bitte zuerst das SQL-Skript einfügen.');
      return;
    }

    const parsed = parseBulkSql(bulkSql);
    if (parsed.errorMessage) {
      setBulkEntries(parsed.entries);
      setBulkSqlSnapshot(bulkSql.trim());
      setBulkError(parsed.errorMessage);
      setBulkErrorIndex(parsed.errorIndex);
      return;
    }

    const validation = validateBulkEntries(parsed.entries);
    setBulkEntries(validation.entries);
    setBulkSqlSnapshot(bulkSql.trim());
    setBulkError(validation.errorMessage);
    setBulkErrorIndex(validation.errorIndex);
  };

  const renderBulkEntryItem = ({ item, index }: { item: BulkEntry; index: number }) => {
    const hasError = Boolean(item.error);
    return (
      <View
        style={[
          styles.bulkEntryCard,
          hasError && styles.bulkEntryCardError,
          bulkErrorIndex === index && styles.bulkEntryCardFocus,
        ]}
      >
        <View style={styles.bulkEntryHeader}>
          <ThemedText style={[styles.bulkEntryTitle, hasError && styles.bulkEntryTitleError]}>
            {index + 1}. {item.name || 'Unbenannt'}
          </ThemedText>
          <TouchableOpacity onPress={() => handleRemoveBulkEntry(index)} style={styles.bulkEntryRemove}>
            <IconSymbol name="trash" size={16} color="#C94A4A" />
          </TouchableOpacity>
        </View>
        {hasError && <ThemedText style={styles.bulkEntryErrorText}>{item.error}</ThemedText>}
        <View style={styles.bulkField}>
          <ThemedText style={styles.bulkFieldLabel}>Name</ThemedText>
          {renderInlineField(
            item.name,
            'z.B. Mila',
            () =>
              openFocusEditor(
                {
                  mode: 'bulk',
                  field: 'name',
                  index,
                  label: 'Name',
                  placeholder: 'z.B. Mila',
                },
                item.name
              )
          )}
        </View>
        <View style={styles.bulkField}>
          <ThemedText style={styles.bulkFieldLabel}>Bedeutung</ThemedText>
          {renderInlineField(
            item.meaning,
            'z.B. Wunder, Hoffnung',
            () =>
              openFocusEditor(
                {
                  mode: 'bulk',
                  field: 'meaning',
                  index,
                  label: 'Bedeutung',
                  placeholder: 'z.B. Wunder, Hoffnung',
                  multiline: true,
                },
                item.meaning
              ),
            true
          )}
        </View>
        <View style={styles.bulkField}>
          <ThemedText style={styles.bulkFieldLabel}>Herkunft</ThemedText>
          {renderInlineField(
            item.origin,
            'z.B. Hebräisch',
            () =>
              openFocusEditor(
                {
                  mode: 'bulk',
                  field: 'origin',
                  index,
                  label: 'Herkunft',
                  placeholder: 'z.B. Hebräisch',
                },
                item.origin
              )
          )}
        </View>
        <View style={styles.bulkField}>
          <ThemedText style={styles.bulkFieldLabel}>Geschlecht</ThemedText>
          {renderInlineField(
            item.gender,
            'female, male, unisex',
            () =>
              openFocusEditor(
                {
                  mode: 'bulk',
                  field: 'gender',
                  index,
                  label: 'Geschlecht',
                  placeholder: 'female, male, unisex',
                },
                item.gender
              )
          )}
        </View>
      </View>
    );
  };

  const renderCategoryItem = ({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory === item.id && { backgroundColor: theme.accent + '30' }
      ]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <ThemedView
        style={styles.categoryItemInner}
        lightColor="rgba(255, 255, 255, 0.8)"
        darkColor="rgba(50, 50, 50, 0.8)"
      >
        <IconSymbol name={item.icon as any} size={20} color={theme.accent} />
        <ThemedText style={styles.categoryText}>{item.name}</ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );

  const genderOverlay = (gender?: string) => {
    if (gender === 'male') return 'rgba(135,206,235,0.32)'; // Baby blue
    if (gender === 'female') return 'rgba(142,78,198,0.32)'; // Lila
    return 'rgba(168,196,193,0.32)'; // Neutral grünlich
  };

  const renderNameItem = ({ item }: { item: Name }) => {
    const originText = item.origin || 'Herkunft unbekannt';
    const meaningText = item.meaning || 'Keine Bedeutung hinterlegt.';
    return (
      <LiquidGlassCard
        style={[styles.fullWidthCard, styles.glassCard]}
        intensity={26}
        overlayColor={genderOverlay(item.gender)}
        borderColor={'rgba(255,255,255,0.7)'}
      >
        <View style={styles.nameItemInner}>
          <View style={styles.nameHeader}>
            <ThemedText style={styles.nameTitle}>{item.name}</ThemedText>
            <View style={styles.nameActions}>
              {isAdmin && item.id && (
                <>
                  <TouchableOpacity style={styles.iconButton} onPress={() => handleEditName(item)}>
                    <IconSymbol name="pencil" size={18} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconButton, { marginLeft: 6 }]} onPress={() => handleDeleteName(item)}>
                    <IconSymbol name="trash" size={18} color="#C94A4A" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.favoriteButton, { marginLeft: 8 }]}
                onPress={() => toggleFavorite(item.name)}
                disabled={isSaving}
              >
                {isSaving && favorites.includes(item.name) === item.isFavorite ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <IconSymbol
                    name={item.isFavorite ? 'heart.fill' : 'heart'}
                    size={20}
                    color={item.isFavorite ? theme.accent : theme.tabIconDefault}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
          <ThemedText style={[styles.nameOrigin, { color: TEXT_PRIMARY }]}>{originText}</ThemedText>
          <ThemedText style={[styles.nameMeaning, { color: TEXT_PRIMARY }]}>{meaningText}</ThemedText>
        </View>
      </LiquidGlassCard>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage}>
        <SafeAreaView style={styles.container}>
          <StatusBar hidden={true} />
          <Header 
            title="Babynamen" 
            subtitle="Finde den perfekten Namen für dein Baby"
            showBackButton 
          />
          <FlatList
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            data={names}
            keyExtractor={(item, index) => item.id ?? `${item.name}-${index}`}
            renderItem={({ item }) => (
              <View style={{ width: '100%', marginBottom: 12 }}>
                {renderNameItem({ item })}
              </View>
            )}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMoreNames}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              <View>
                {/* Suchleiste */}
                <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={styles.searchInputContainer}>
                    <IconSymbol name="magnifyingglass" size={20} color={theme.tabIconDefault} />
                    <TextInput
                      style={[styles.searchInput, { color: theme.text }]}
                      placeholder="Suche nach Namen..."
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
                </LiquidGlassCard>

                {/* Kategorien */}
                <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={styles.categoriesContainer}>
                    <FlatList
                      data={CATEGORIES}
                      renderItem={renderCategoryItem}
                      keyExtractor={(item) => item.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    />
                  </View>
                </LiquidGlassCard>
              </View>
            }
            ListEmptyComponent={
              isLoading ? (
                <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                    <ThemedText style={[styles.loadingText, { color: TEXT_PRIMARY }]}>Lade Namen...</ThemedText>
                  </View>
                </LiquidGlassCard>
              ) : (
                <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={styles.emptyContainer}>
                    <IconSymbol name="magnifyingglass" size={40} color={theme.tabIconDefault} />
                    <ThemedText style={[styles.emptyText, { color: TEXT_PRIMARY }]}>
                      {selectedCategory === 'favorites'
                        ? 'Du hast noch keine Favoriten gespeichert.'
                        : 'Keine Namen gefunden.'}
                    </ThemedText>
                    {selectedCategory === 'favorites' && (
                      <TouchableOpacity
                        style={styles.emptyButton}
                        onPress={() => setSelectedCategory('all')}
                      >
                        <ThemedText style={styles.emptyButtonText}>Alle Namen anzeigen</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </LiquidGlassCard>
              )
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              ) : null
            }
          />

          {isAdmin && (
            <TouchableOpacity
              style={[styles.adminFab, { backgroundColor: theme.accent }]}
              onPress={handleOpenCreateModal}
              activeOpacity={0.9}
            >
              <IconSymbol name="plus" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <Modal
            visible={showCreateModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCreateModal(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.dailyModalWrapper}
            >
              <View style={styles.dailyModalOverlay}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    setShowCreateModal(false);
                    Keyboard.dismiss();
                  }}
                >
                  <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>

                <BlurView style={styles.dailyModalContent} tint="extraLight" intensity={82}>
                  <View style={styles.modalHeaderRow}>
                    <View style={styles.headerLeft}>
                      <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.headerCircleButton}>
                        <IconSymbol name="xmark" size={18} color={BABY_LILA} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.headerCenter}>
                      <ThemedText style={[styles.modalTitle, { color: BABY_LILA }]}>
                        {editingNameId ? 'Name bearbeiten' : 'Neuen Namen hinzufügen'}
                      </ThemedText>
                    </View>
                    <View style={styles.headerRight}>
                      <TouchableOpacity
                        style={[styles.headerCircleButton, { backgroundColor: BABY_LILA }]}
                        onPress={handleCreateName}
                        disabled={isCreatingName}
                      >
                        {isCreatingName ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <IconSymbol name="checkmark" size={18} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.adminModeToggle}>
                    <TouchableOpacity
                      style={[
                        styles.adminModeButton,
                        createMode === 'single' && styles.adminModeButtonActive,
                      ]}
                      onPress={() => {
                        setCreateMode('single');
                        setBulkError(null);
                        setBulkErrorIndex(null);
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.adminModeButtonText,
                          createMode === 'single' && styles.adminModeButtonTextActive,
                        ]}
                      >
                        Einzeln
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.adminModeButton,
                        createMode === 'bulk' && styles.adminModeButtonActive,
                        editingNameId && styles.adminModeButtonDisabled,
                      ]}
                      onPress={() => {
                        if (editingNameId) return;
                        setCreateMode('bulk');
                        setBulkError(null);
                        setBulkErrorIndex(null);
                      }}
                      disabled={Boolean(editingNameId)}
                    >
                      <ThemedText
                        style={[
                          styles.adminModeButtonText,
                          createMode === 'bulk' && styles.adminModeButtonTextActive,
                        ]}
                      >
                        SQL-Import
                      </ThemedText>
                    </TouchableOpacity>
                  </View>

                  {createMode === 'single' ? (
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ paddingBottom: 12 }}
                    >
                      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View>
                          <View style={styles.modalField}>
                            <ThemedText style={[styles.modalLabel, { color: BABY_LILA }]}>Name</ThemedText>
                            {renderInlineField(
                              newName,
                              'z.B. Mila',
                              () =>
                                openFocusEditor(
                                  {
                                    mode: 'single',
                                    field: 'name',
                                    label: 'Name',
                                    placeholder: 'z.B. Mila',
                                  },
                                  newName
                                )
                            )}
                          </View>

                          <View style={styles.modalField}>
                            <ThemedText style={[styles.modalLabel, { color: BABY_LILA }]}>Bedeutung</ThemedText>
                            {renderInlineField(
                              persistedMeaning,
                              'z.B. Wunder, Hoffnung',
                              () =>
                                openFocusEditor(
                                  {
                                    mode: 'single',
                                    field: 'meaning',
                                    label: 'Bedeutung',
                                    placeholder: 'z.B. Wunder, Hoffnung',
                                    multiline: true,
                                  },
                                  persistedMeaning
                                ),
                              true
                            )}
                          </View>

                          <View style={styles.modalField}>
                            <ThemedText style={[styles.modalLabel, { color: BABY_LILA }]}>Herkunft</ThemedText>
                            {renderInlineField(
                              persistedOrigin,
                              'z.B. Hebräisch',
                              () =>
                                openFocusEditor(
                                  {
                                    mode: 'single',
                                    field: 'origin',
                                    label: 'Herkunft',
                                    placeholder: 'z.B. Hebräisch',
                                  },
                                  persistedOrigin
                                )
                            )}
                          </View>
                        </View>
                      </TouchableWithoutFeedback>
                    </ScrollView>
                  ) : (
                    <FlatList
                      ref={bulkListRef}
                      data={bulkEntries}
                      renderItem={renderBulkEntryItem}
                      keyExtractor={(item) => item.localId}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: 12 }}
                      onScrollToIndexFailed={({ index, averageItemLength }) => {
                        bulkListRef.current?.scrollToOffset({
                          offset: averageItemLength * index,
                          animated: true,
                        });
                      }}
                      ListHeaderComponent={
                        <View>
                          <View style={styles.modalField}>
                            <ThemedText style={[styles.modalLabel, { color: BABY_LILA }]}>
                              SQL-Skript
                            </ThemedText>
                            <TextInput
                              style={[styles.modalInput, styles.bulkSqlInput, { color: theme.text }]}
                              value={bulkSql}
                              onChangeText={(text) => {
                                setBulkSql(text);
                                setBulkEntries([]);
                                setBulkError(null);
                                setBulkErrorIndex(null);
                                setBulkSqlSnapshot(null);
                              }}
                              placeholder="insert into public.baby_names (id, name, meaning, origin, gender, created_at) values ..."
                              placeholderTextColor={theme.tabIconDefault}
                              multiline
                              textAlignVertical="top"
                            />
                          </View>
                          <View style={styles.bulkActionsRow}>
                            <TouchableOpacity
                              style={styles.bulkActionButton}
                              onPress={handleParseBulkSql}
                            >
                              <ThemedText style={styles.bulkActionButtonText}>SQL prüfen</ThemedText>
                            </TouchableOpacity>
                          </View>
                          {bulkError && (
                            <ThemedText style={styles.bulkErrorText}>{bulkError}</ThemedText>
                          )}
                          {bulkEntries.length > 0 && (
                            <ThemedText style={styles.bulkHintText}>
                              Prüfe die Einträge, passe sie an und speichere.
                            </ThemedText>
                          )}
                        </View>
                      }
                      ListFooterComponent={<View style={{ height: 8 }} />}
                    />
                  )}
                </BlurView>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <TextInputOverlay
            visible={!!focusConfig}
            label={focusConfig?.label ?? ''}
            value={focusValue}
            placeholder={focusConfig?.placeholder}
            multiline={!!focusConfig?.multiline}
            accentColor={BABY_LILA}
            onClose={closeFocusEditor}
            onSubmit={(next) => saveFocusEditor(next)}
          />
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const BABY_LILA = '#8E4EC6';

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
  fullWidthCard: {
    marginHorizontal: TIMELINE_INSET,
  },
  glassCard: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    padding: 8,
  },
  categoriesContainer: { paddingVertical: 6 },
  categoriesRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  categoryItem: {
    borderRadius: 20,
    marginRight: 8,
    overflow: 'hidden',
  },
  categoryItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryText: {
    fontSize: 14,
    marginLeft: 8,
  },
  namesContainer: { marginBottom: 16 },
  nameItem: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  nameItemInner: {
    padding: 16,
  },
  nameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  nameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  favoriteButton: {
    padding: 4,
  },
  nameOrigin: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.7,
  },
  nameMeaning: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  emptyButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#E9C9B6',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  adminFab: {
    position: 'absolute',
    right: LAYOUT_PAD + 6,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dailyModalWrapper: {
    flex: 1,
  },
  dailyModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dailyModalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    width: '100%',
    maxHeight: '78%',
    overflow: 'hidden',
    padding: 20,
    paddingBottom: 28,
    backgroundColor: 'rgba(142,78,198,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.2)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: { flex: 1, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  headerCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    color: BABY_LILA,
    opacity: 0.85,
    marginTop: 2,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
  },
  modalField: {
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    fontSize: 16,
  },
  modalInputMultiline: {
    minHeight: 90,
    paddingVertical: 12,
  },
  modalInputText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalInputPlaceholder: {
    fontSize: 16,
    fontWeight: '500',
  },
  adminModeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  adminModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.2)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
  },
  adminModeButtonActive: {
    backgroundColor: 'rgba(142,78,198,0.18)',
    borderColor: 'rgba(142,78,198,0.5)',
  },
  adminModeButtonDisabled: {
    opacity: 0.45,
  },
  adminModeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
  },
  adminModeButtonTextActive: {
    color: BABY_LILA,
  },
  bulkSqlInput: {
    minHeight: 140,
  },
  bulkActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  bulkActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(142,78,198,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.35)',
  },
  bulkActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: BABY_LILA,
  },
  bulkErrorText: {
    fontSize: 13,
    color: '#C94A4A',
    fontWeight: '600',
    marginBottom: 8,
  },
  bulkHintText: {
    fontSize: 12,
    color: '#7D5A50',
    marginBottom: 8,
  },
  bulkEntryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.2)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 12,
    marginBottom: 12,
  },
  bulkEntryCardError: {
    borderColor: 'rgba(201,74,74,0.6)',
    backgroundColor: 'rgba(255,235,235,0.9)',
  },
  bulkEntryCardFocus: {
    borderWidth: 2,
  },
  bulkEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bulkEntryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B4C3B',
  },
  bulkEntryTitleError: {
    color: '#C94A4A',
  },
  bulkEntryErrorText: {
    fontSize: 12,
    color: '#C94A4A',
    marginBottom: 6,
  },
  bulkEntryRemove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  bulkField: {
    marginBottom: 10,
  },
  bulkFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7D5A50',
    marginBottom: 6,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  genderPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
