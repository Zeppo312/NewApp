import { StyleSheet, TouchableOpacity, Alert, ActivityIndicator, View } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ChecklistCategory } from '@/components/ChecklistCategory';
import { AddChecklistItem } from '@/components/AddChecklistItem';

import { useAuth } from '@/contexts/AuthContext';
import { ChecklistItem, getHospitalChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem, supabaseUrl } from '@/lib/supabase';

export default function TabTwoScreen() {
  const { signOut } = useAuth();

  // State für die Checkliste
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vordefinierte Kategorien für die Checkliste
  const categories = [
    'Dokumente',
    'Kleidung für Mama',
    'Kleidung für Baby',
    'Hygieneartikel',
    'Sonstiges'
  ];

  // Vordefinierte Einträge für die Checkliste
  const defaultItems: Array<{
    item_name: string;
    category: string;
    notes?: string | null;
  }> = [
    // Dokumente
    { item_name: 'Mutterpass', category: 'Dokumente', notes: 'Unbedingt mitnehmen!' },
    { item_name: 'Personalausweis', category: 'Dokumente', notes: null },
    { item_name: 'Krankenversicherungskarte', category: 'Dokumente', notes: null },
    { item_name: 'Familienstammbuch', category: 'Dokumente', notes: null },
    { item_name: 'Geburtsplan (falls vorhanden)', category: 'Dokumente', notes: null },

    // Kleidung für Mama
    { item_name: 'Bequeme Nachthemden', category: 'Kleidung für Mama', notes: '2-3 Stück' },
    { item_name: 'Warme Socken', category: 'Kleidung für Mama', notes: null },
    { item_name: 'Bademantel', category: 'Kleidung für Mama', notes: null },
    { item_name: 'Stillbustier/Still-BHs', category: 'Kleidung für Mama', notes: '2-3 Stück' },
    { item_name: 'Bequeme Unterwäsche', category: 'Kleidung für Mama', notes: 'Mehrere Stück' },
    { item_name: 'Hausschuhe', category: 'Kleidung für Mama', notes: null },
    { item_name: 'Bequeme Kleidung für die Heimreise', category: 'Kleidung für Mama', notes: null },

    // Kleidung für Baby
    { item_name: 'Bodys', category: 'Kleidung für Baby', notes: '4-5 Stück, Größe 50/56' },
    { item_name: 'Strampler', category: 'Kleidung für Baby', notes: '2-3 Stück, Größe 50/56' },
    { item_name: 'Mützchen', category: 'Kleidung für Baby', notes: null },
    { item_name: 'Söckchen', category: 'Kleidung für Baby', notes: '2-3 Paar' },
    { item_name: 'Jäckchen', category: 'Kleidung für Baby', notes: 'Je nach Jahreszeit' },
    { item_name: 'Heimfahrt-Outfit', category: 'Kleidung für Baby', notes: 'Wettergerecht' },

    // Hygieneartikel
    { item_name: 'Zahnbürste & Zahnpasta', category: 'Hygieneartikel', notes: null },
    { item_name: 'Haarbürste & Haargummis', category: 'Hygieneartikel', notes: null },
    { item_name: 'Duschgel & Shampoo', category: 'Hygieneartikel', notes: null },
    { item_name: 'Wochenbetteinlagen', category: 'Hygieneartikel', notes: null },
    { item_name: 'Brustwarzensalbe', category: 'Hygieneartikel', notes: null },
    { item_name: 'Lippenpflegestift', category: 'Hygieneartikel', notes: null },
    { item_name: 'Feuchttücher für Baby', category: 'Hygieneartikel', notes: null },
    { item_name: 'Windeln für Neugeborene', category: 'Hygieneartikel', notes: 'Kleine Packung' },

    // Sonstiges
    { item_name: 'Handtücher', category: 'Sonstiges', notes: '2 Stück' },
    { item_name: 'Waschlappen', category: 'Sonstiges', notes: '2-3 Stück' },
    { item_name: 'Handy & Ladekabel', category: 'Sonstiges', notes: null },
    { item_name: 'Snacks & Getränke', category: 'Sonstiges', notes: null },
    { item_name: 'Kamera', category: 'Sonstiges', notes: null },
    { item_name: 'Lektüre/Zeitschriften', category: 'Sonstiges', notes: null },
    { item_name: 'Maxicar/Babyschale für Heimfahrt', category: 'Sonstiges', notes: null }
  ];

  // State für die Initialisierung der Checkliste
  const [isInitialized, setIsInitialized] = useState(false);

  // Laden der Checkliste beim ersten Rendern und bei Fokus auf den Tab
  const loadChecklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Abrufen der gespeicherten Checkliste
      const { data, error } = await getHospitalChecklist();
      if (error) throw error;

      // Wenn die Checkliste leer ist und noch nicht initialisiert wurde,
      // fügen wir die vordefinierten Einträge hinzu
      if ((!data || data.length === 0) && !isInitialized) {
        console.log('Initializing checklist with default items...');
        setIsInitialized(true);

        // Vorbereitete Einträge hinzufügen
        const initializedItems: ChecklistItem[] = [];

        // Sequentiell hinzufügen, um Reihenfolge zu erhalten
        for (let i = 0; i < defaultItems.length; i++) {
          const item = defaultItems[i];
          try {
            const { data: newItem } = await addChecklistItem({
              item_name: item.item_name,
              category: item.category,
              notes: item.notes || null,
              is_checked: false,
              position: i
            });

            if (newItem) {
              initializedItems.push(newItem);
            }
          } catch (itemError) {
            console.error('Error adding default item:', itemError);
            // Wir setzen fort, auch wenn ein Eintrag fehlschlägt
          }
        }

        setChecklist(initializedItems);
      } else {
        // Wenn bereits Daten vorhanden sind, verwenden wir diese
        setChecklist(data || []);
      }
    } catch (err) {
      console.error('Error loading checklist:', err);
      setError('Die Checkliste konnte nicht geladen werden.');

      // Im Fehlerfall zeigen wir die vordefinierten Einträge im Demo-Modus an
      if (supabaseUrl.includes('example.supabase.co')) {
        console.log('Using default items in demo mode...');
        const demoItems = defaultItems.map((item, index) => ({
          ...item,
          id: `demo-${index}`,
          user_id: 'demo-user',
          is_checked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          position: index
        })) as ChecklistItem[];

        setChecklist(demoItems);
      }
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  useFocusEffect(
    useCallback(() => {
      loadChecklist();
    }, [loadChecklist])
  );

  // Hinzufügen eines neuen Eintrags
  const handleAddItem = async (itemName: string, category: string, notes: string) => {
    try {
      const newItem = {
        item_name: itemName,
        category,
        notes: notes || null,
        is_checked: false,
        position: checklist.length // Position am Ende der Liste
      };

      const { data, error } = await addChecklistItem(newItem);
      if (error) throw error;
      if (data) {
        setChecklist([...checklist, data]);
      }
    } catch (err) {
      console.error('Error adding checklist item:', err);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht hinzugefügt werden.');
    }
  };

  // Umschalten des Status eines Eintrags (abgehakt/nicht abgehakt)
  const handleToggleItem = async (id: string, isChecked: boolean) => {
    try {
      const { data, error } = await toggleChecklistItem(id, isChecked);
      if (error) throw error;
      if (data) {
        setChecklist(checklist.map(item => item.id === id ? data : item));
      }
    } catch (err) {
      console.error('Error toggling checklist item:', err);
      Alert.alert('Fehler', 'Der Status konnte nicht geändert werden.');
    }
  };

  // Löschen eines Eintrags
  const handleDeleteItem = async (id: string) => {
    Alert.alert(
      'Eintrag löschen',
      'Möchtest du diesen Eintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteChecklistItem(id);
              if (error) throw error;
              setChecklist(checklist.filter(item => item.id !== id));
            } catch (err) {
              console.error('Error deleting checklist item:', err);
              Alert.alert('Fehler', 'Der Eintrag konnte nicht gelöscht werden.');
            }
          }
        }
      ]
    );
  };

  // Gruppieren der Einträge nach Kategorien
  const groupedItems = checklist.reduce<Record<string, ChecklistItem[]>>((groups, item) => {
    const category = item.category || 'Sonstiges';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});

  // Abmelden-Funktion
  const handleLogout = async () => {
    Alert.alert(
      'Abmelden',
      'Möchtest du dich wirklich abmelden?',
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
        {
          text: 'Abmelden',
          style: 'destructive',
          onPress: async () => {
            try {
              // Abmelden mit Supabase
              const { error } = await signOut();
              if (error) throw error;

              // Die Navigation wird automatisch durch den AuthProvider gesteuert
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Fehler', 'Beim Abmelden ist ein Fehler aufgetreten.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#F9F1EC', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#E9C9B6"
          name="checklist"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Krankenhaus-Checkliste</ThemedText>
      </ThemedView>

      <ThemedText style={styles.description}>
        Hier kannst du alle wichtigen Dinge für deinen Krankenhausaufenthalt notieren.
        Hake die Einträge ab, sobald du sie eingepackt hast.
      </ThemedText>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E9C9B6" />
          <ThemedText style={styles.loadingText}>Checkliste wird geladen...</ThemedText>
        </View>
      ) : error ? (
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={loadChecklist}>
            <ThemedText style={styles.retryButtonText}>Erneut versuchen</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      ) : (
        <>
          {/* Kategorien mit Einträgen anzeigen */}
          {Object.keys(groupedItems).length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>
                Deine Checkliste ist noch leer. Füge unten neue Einträge hinzu.
              </ThemedText>
            </ThemedView>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <ChecklistCategory
                key={category}
                title={category}
                items={items}
                onToggleItem={handleToggleItem}
                onDeleteItem={handleDeleteItem}
              />
            ))
          )}

          {/* Formular zum Hinzufügen neuer Einträge */}
          <AddChecklistItem onAdd={handleAddItem} categories={categories} />
        </>
      )}

      {/* Logout Section */}
      <ThemedView style={styles.logoutSection}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <ThemedText style={styles.logoutButtonText}>
            Abmelden
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#E9C9B6',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  description: {
    marginBottom: 20,
    lineHeight: 22,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  errorContainer: {
    padding: 20,
    marginVertical: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9C9B6',
    alignItems: 'center',
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
    color: '#E9C9B6',
  },
  retryButton: {
    backgroundColor: '#E9C9B6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#5C4033',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9E9E9',
    borderRadius: 8,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 22,
  },
  logoutSection: {
    marginTop: 40,
    marginBottom: 20,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#E9C9B6', // Using warning color from our palette
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#5C4033', // Dark brown text
    fontWeight: 'bold',
    fontSize: 18,
  },
});
