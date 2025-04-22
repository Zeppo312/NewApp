import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Tag, getTags } from '@/lib/tags';
import { IconSymbol } from './ui/IconSymbol';

interface TagSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({ 
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
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  // Prüfen, ob ein Tag ausgewählt ist
  const isTagSelected = (tagId: string) => {
    return selectedTagIds.includes(tagId);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.loadingText}>Tags werden geladen...</ThemedText>
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

  // Anzahl der ausgewählten Tags pro Kategorie
  const selectedTrimesterCount = tags.trimester.filter(tag => 
    selectedTagIds.includes(tag.id)
  ).length;
  
  const selectedBabyAgeCount = tags.baby_age.filter(tag => 
    selectedTagIds.includes(tag.id)
  ).length;

  return (
    <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <IconSymbol name="tag" size={16} color={theme.accent} />
          <ThemedText style={styles.title}>Themen-Tags</ThemedText>
        </View>
        
        <View style={styles.headerRight}>
          {selectedTagIds.length > 0 && (
            <View style={styles.selectedCount}>
              <ThemedText style={styles.selectedCountText}>
                {selectedTagIds.length}
              </ThemedText>
            </View>
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
            <ThemedText style={styles.categoryTitle}>
              Schwangerschaft
              {selectedTrimesterCount > 0 && ` (${selectedTrimesterCount})`}
            </ThemedText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsScrollContent}
            >
              {tags.trimester.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagButton,
                    isTagSelected(tag.id) && styles.selectedTagButton,
                    { borderColor: theme.accent }
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
            </ScrollView>
          </View>
          
          <View style={styles.categoryContainer}>
            <ThemedText style={styles.categoryTitle}>
              Baby-Alter
              {selectedBabyAgeCount > 0 && ` (${selectedBabyAgeCount})`}
            </ThemedText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsScrollContent}
            >
              {tags.baby_age.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagButton,
                    isTagSelected(tag.id) && styles.selectedTagButton,
                    { borderColor: theme.accent }
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
            </ScrollView>
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
  selectedCount: {
    backgroundColor: '#FF9F9F',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  selectedCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
  tagsScrollContent: {
    paddingBottom: 4,
  },
  tagButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 4,
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
