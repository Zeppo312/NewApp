import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Tag, getTags } from '@/lib/tags';
import { IconSymbol } from './ui/IconSymbol';

interface TagFilterProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export const TagFilter: React.FC<TagFilterProps> = ({
  selectedTagIds,
  onTagsChange
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [tags, setTags] = useState<{
    trimester: Tag[];
    baby_age: Tag[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Tags laden
  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoading(true);
        const { data, error } = await getTags();

        if (error) throw error;
        setTags(data);
      } catch (err) {
        console.error('Error loading tags:', err);
        setError('Die Tags konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    loadTags();
  }, []);

  // Tag auswählen oder Auswahl aufheben
  const toggleTag = (tagId: string) => {
    // Prüfen, ob der Tag bereits ausgewählt ist
    if (selectedTagIds.includes(tagId)) {
      // Tag aus der Auswahl entfernen
      const newTagIds = selectedTagIds.filter(id => id !== tagId);
      onTagsChange(newTagIds);
    } else {
      // Tag zur Auswahl hinzufügen
      const newTagIds = [...selectedTagIds, tagId];
      onTagsChange(newTagIds);
    }
  };

  // Alle Filter zurücksetzen
  const clearFilters = () => {
    onTagsChange([]);
  };

  // Prüfen, ob ein Tag ausgewählt ist
  const isTagSelected = (tagId: string) => {
    return selectedTagIds.includes(tagId);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.loadingText}>Filter werden geladen...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!tags) {
    return null;
  }

  return (
    <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <IconSymbol name="line.3.horizontal.decrease" size={16} color={theme.accent} />
          <ThemedText style={styles.title}>Nach Thema filtern</ThemedText>
        </View>

        <View style={styles.headerRight}>
          {selectedTagIds.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearFilters}
            >
              <ThemedText style={styles.clearButtonText}>Zurücksetzen</ThemedText>
            </TouchableOpacity>
          )}
          <IconSymbol
            name={expanded ? "chevron.up" : "chevron.down"}
            size={16}
            color={theme.tabIconDefault}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.categoryContainer}>
            <ThemedText style={styles.categoryTitle}>Schwangerschaft</ThemedText>
            <View style={styles.tagsContainer}>
              {tags.trimester.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagButton,
                    isTagSelected(tag.id) && styles.selectedTagButton,
                    { borderColor: '#FFE0E0' }
                  ]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <ThemedText
                    style={[
                      styles.tagText,
                      isTagSelected(tag.id) && styles.selectedTagText
                    ]}
                  >
                    {tag.name}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.categoryContainer}>
            <ThemedText style={styles.categoryTitle}>Baby-Alter</ThemedText>
            <View style={styles.tagsContainer}>
              {tags.baby_age.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagButton,
                    isTagSelected(tag.id) && styles.selectedTagButton,
                    { borderColor: '#E0F0FF' }
                  ]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <ThemedText
                    style={[
                      styles.tagText,
                      isTagSelected(tag.id) && styles.selectedTagText
                    ]}
                  >
                    {tag.name}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  clearButton: {
    marginRight: 8,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#FF6B6B',
  },
  content: {
    padding: 12,
    paddingTop: 0,
  },
  categoryContainer: {
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTagButton: {
    backgroundColor: '#FF9F9F',
    borderColor: '#FF9F9F',
  },
  tagText: {
    fontSize: 12,
  },
  selectedTagText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loadingText: {
    padding: 12,
    fontSize: 14,
    color: '#888',
  },
  errorText: {
    padding: 12,
    fontSize: 14,
    color: '#FF6B6B',
  },
});
