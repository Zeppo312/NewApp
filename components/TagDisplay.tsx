import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Tag {
  id: string;
  name: string;
  category: 'trimester' | 'baby_age';
}

interface TagDisplayProps {
  tags: Tag[];
  onTagPress?: (tagId: string) => void;
  small?: boolean;
}

export const TagDisplay: React.FC<TagDisplayProps> = ({
  tags,
  onTagPress,
  small = false
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  if (!tags || tags.length === 0) {
    return null;
  }

  // Sortiere Tags nach Kategorie (zuerst Trimester, dann Baby-Alter)
  const sortedTags = [...tags].sort((a, b) => {
    if (a.category === b.category) return 0;
    return a.category === 'trimester' ? -1 : 1;
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {sortedTags.map(tag => (
        <TouchableOpacity
          key={tag.id}
          style={[
            styles.tagButton,
            small && styles.smallTagButton,
            {
              backgroundColor: tag.category === 'trimester' ? '#FFE0E0' : '#E0F0FF',
              borderColor: tag.category === 'trimester' ? '#FFCACA' : '#CAE0FF'
            }
          ]}
          onPress={onTagPress ? () => {
            // Sofort den Tag-Filter anwenden und Beiträge neu laden
            onTagPress(tag.id);
          } : undefined}
          disabled={!onTagPress}
        >
          <ThemedText
            style={[
              styles.tagText,
              small && styles.smallTagText,
              {
                color: tag.category === 'trimester' ? '#E57373' : '#5C9CE6'
              }
            ]}
          >
            {tag.name}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingVertical: 4,
  },
  tagButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  smallTagButton: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  smallTagText: {
    fontSize: 10,
  },
});
