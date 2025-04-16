# Code-Dokumentation: Krankenhaus-Checkliste

## Dateistruktur

Die Krankenhaus-Checkliste-Funktionalität ist auf mehrere Dateien verteilt:

1. **app/(tabs)/explore.tsx**: Hauptkomponente der Checkliste
2. **components/ChecklistCategory.tsx**: Komponente für Kategorien
3. **components/ChecklistItem.tsx**: Komponente für einzelne Einträge
4. **components/AddChecklistItem.tsx**: Komponente zum Hinzufügen neuer Einträge
5. **components/Collapsible.tsx**: Wiederverwendbare Komponente für aufklappbare Bereiche
6. **lib/supabase.ts**: Enthält die Datenbankfunktionen für die Checkliste

## Hauptkomponente (explore.tsx)

Die `TabTwoScreen`-Komponente ist die Hauptkomponente der Krankenhaus-Checkliste.

### Imports

```typescript
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
```

### State und Konstanten

```typescript
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
  // ... weitere vordefinierte Einträge
];

// State für die Initialisierung der Checkliste
const [isInitialized, setIsInitialized] = useState(false);
```

### Daten laden

```typescript
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
```

### Event-Handler

```typescript
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
```

### Datenverarbeitung

```typescript
// Gruppieren der Einträge nach Kategorien
const groupedItems = checklist.reduce<Record<string, ChecklistItem[]>>((groups, item) => {
  const category = item.category || 'Sonstiges';
  if (!groups[category]) {
    groups[category] = [];
  }
  groups[category].push(item);
  return groups;
}, {});
```

### Rendering

```typescript
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
  </ParallaxScrollView>
);
```

## Komponenten

### ChecklistCategory

Die `ChecklistCategory`-Komponente zeigt eine Kategorie mit ihren Einträgen an.

```typescript
export const ChecklistCategory: React.FC<ChecklistCategoryProps> = ({
  title,
  items,
  onToggleItem,
  onDeleteItem,
}) => {
  // Berechne den Fortschritt (wie viele Items sind abgehakt)
  const checkedCount = items.filter(item => item.is_checked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  return (
    <Collapsible 
      title={title}
      subtitle={`${checkedCount}/${totalCount} (${progress}%)`}
      initiallyExpanded={true}
    >
      <View style={styles.container}>
        {items.length === 0 ? (
          <ThemedText style={styles.emptyText}>
            Keine Einträge in dieser Kategorie
          </ThemedText>
        ) : (
          items.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={onToggleItem}
              onDelete={onDeleteItem}
            />
          ))
        )}
      </View>
    </Collapsible>
  );
};
```

### ChecklistItem

Die `ChecklistItem`-Komponente zeigt einen einzelnen Eintrag mit Checkbox und Lösch-Button an.

```typescript
export const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, onToggle, onDelete }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => onToggle(item.id, !item.is_checked)}
      >
        <View style={[
          styles.checkbox,
          item.is_checked ? styles.checkboxChecked : {},
          { borderColor: theme.text }
        ]}>
          {item.is_checked && (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          )}
        </View>
      </TouchableOpacity>
      
      <View style={styles.textContainer}>
        <ThemedText 
          style={[
            styles.itemText,
            item.is_checked ? styles.itemTextChecked : {}
          ]}
        >
          {item.item_name}
        </ThemedText>
        
        {item.notes && (
          <ThemedText style={styles.notes}>
            {item.notes}
          </ThemedText>
        )}
      </View>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#E9C9B6" />
      </TouchableOpacity>
    </View>
  );
};
```

### AddChecklistItem

Die `AddChecklistItem`-Komponente bietet ein Formular zum Hinzufügen neuer Einträge.

```typescript
export const AddChecklistItem: React.FC<AddChecklistItemProps> = ({ onAdd, categories }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [modalVisible, setModalVisible] = useState(false);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Allgemein');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Namen für den Eintrag ein.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onAdd(itemName.trim(), category, notes.trim());
      setItemName('');
      setNotes('');
      setModalVisible(false);
    } catch (error) {
      console.error('Error adding checklist item:', error);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht hinzugefügt werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add-circle" size={24} color="#E9C9B6" />
        <ThemedText style={styles.addButtonText}>Neuen Eintrag hinzufügen</ThemedText>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        {/* Modal-Inhalt */}
      </Modal>
    </>
  );
};
```

### Collapsible

Die `Collapsible`-Komponente ermöglicht das Ein- und Ausklappen von Bereichen.

```typescript
export function Collapsible({
  children,
  title,
  subtitle,
  initiallyExpanded = false
}: PropsWithChildren & {
  title: string,
  subtitle?: string,
  initiallyExpanded?: boolean
}) {
  const [isOpen, setIsOpen] = useState(initiallyExpanded);
  const theme = useColorScheme() ?? 'light';

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity
        style={styles.heading}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}>
        <View style={styles.titleContainer}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle && (
            <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
          )}
        </View>
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {isOpen && <ThemedView style={styles.content}>{children}</ThemedView>}
    </ThemedView>
  );
}
```

## Datenbankfunktionen (lib/supabase.ts)

Die Datenbankfunktionen für die Krankenhaus-Checkliste sind in der Datei `lib/supabase.ts` definiert.

### Typdefinition

```typescript
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
```

### Funktionen

```typescript
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
```

## Datenbankschema (supabase/schema.sql)

Das Datenbankschema für die Krankenhaus-Checkliste ist in der Datei `supabase/schema.sql` definiert.

```sql
-- Erstellen der Tabelle für die Krankenhaus-Checkliste
CREATE TABLE IF NOT EXISTS public.hospital_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  is_checked BOOLEAN DEFAULT false,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  position INTEGER DEFAULT 0
);

-- Indizes für schnellere Abfragen
CREATE INDEX IF NOT EXISTS hospital_checklist_user_id_idx ON public.hospital_checklist(user_id);
CREATE INDEX IF NOT EXISTS hospital_checklist_category_idx ON public.hospital_checklist(category);

-- Row Level Security (RLS) aktivieren
ALTER TABLE public.hospital_checklist ENABLE ROW LEVEL SECURITY;

-- Richtlinien für Row Level Security
-- Benutzer können nur ihre eigenen Checklisten-Einträge sehen
CREATE POLICY "Users can view their own checklist items"
  ON public.hospital_checklist
  FOR SELECT
  USING (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Checklisten-Einträge einfügen
CREATE POLICY "Users can insert their own checklist items"
  ON public.hospital_checklist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Checklisten-Einträge aktualisieren
CREATE POLICY "Users can update their own checklist items"
  ON public.hospital_checklist
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Checklisten-Einträge löschen
CREATE POLICY "Users can delete their own checklist items"
  ON public.hospital_checklist
  FOR DELETE
  USING (auth.uid() = user_id);

-- Erstellen einer Funktion, um die Checklisten-Einträge eines Benutzers abzurufen
CREATE OR REPLACE FUNCTION public.get_hospital_checklist()
RETURNS SETOF public.hospital_checklist
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.hospital_checklist
  WHERE user_id = auth.uid()
  ORDER BY position ASC, created_at ASC;
$$;
```
