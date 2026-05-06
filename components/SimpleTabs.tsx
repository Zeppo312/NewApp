import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';

export type TabType = 'all' | 'feeding' | 'sleep' | 'diaper' | 'other';

interface SimpleTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const SimpleTabs: React.FC<SimpleTabsProps> = ({ activeTab, onTabChange }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const inactiveColor = isDark ? Colors.dark.textTertiary : '#666666';
  const [prevActiveTab, setPrevActiveTab] = useState<TabType>(activeTab);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Animation beim Tabwechsel
  useEffect(() => {
    if (prevActiveTab !== activeTab) {
      // Ausblenden
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        // Slide-Position aktualisieren
        slideAnim.setValue(prevActiveTab < activeTab ? -20 : 20);

        // Einblenden mit Slide
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        ]).start();

        setPrevActiveTab(activeTab);
      });
    }
  }, [activeTab]);

  // Rendere den Titel des Tabs
  const getTabTitle = (tab: TabType): string => {
    switch (tab) {
      case 'all':
        return 'Alle';
      case 'feeding':
        return 'Füttern';
      case 'sleep':
        return 'Schlafen';
      case 'diaper':
        return 'Wickeln';
      case 'other':
        return 'Sonstiges';
      default:
        return '';
    }
  };

  // Rendere das Icon des Tabs
  const getTabIcon = (tab: TabType): string => {
    switch (tab) {
      case 'all':
        return 'list.bullet';
      case 'feeding':
        return 'drop.fill';
      case 'sleep':
        return 'moon.fill';
      case 'diaper':
        return 'heart.fill';
      case 'other':
        return 'star.fill';
      default:
        return 'list.bullet';
    }
  };

  // Rendere die Farbe des Tabs
  const getTabColor = (tab: TabType): string => {
    switch (tab) {
      case 'all':
        return '#7D5A50';
      case 'feeding':
        return '#FF9800';
      case 'sleep':
        return '#5C6BC0';
      case 'diaper':
        return '#4CAF50';
      case 'other':
        return '#9C27B0';
      default:
        return '#7D5A50';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {(['all', 'feeding', 'sleep', 'diaper', 'other'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.7}
          >
            <View style={styles.tabContent}>
              <IconSymbol
                name={getTabIcon(tab)}
                size={14}
                color={activeTab === tab ? getTabColor(tab) : inactiveColor}
                style={styles.tabIcon}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText
                ]}
                lightColor={activeTab === tab ? getTabColor(tab) : '#666666'}
                darkColor={activeTab === tab ? getTabColor(tab) : Colors.dark.textSecondary}
              >
                {getTabTitle(tab)}
              </ThemedText>
            </View>
            {activeTab === tab && (
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: getTabColor(tab) }
                ]}
              />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Animierter Content-Bereich */}
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateX: slideAnim }],
        marginTop: 10,
      }}>
        {/* Hier könnte ein Indikator für den aktuellen Tab angezeigt werden */}
        <View style={styles.contentIndicator}>
          <IconSymbol
            name={getTabIcon(activeTab)}
            size={16}
            color={getTabColor(activeTab)}
          />
          <ThemedText style={styles.contentIndicatorText}>
            {getTabTitle(activeTab)}
          </ThemedText>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 5,
    marginBottom: 5,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  tab: {
    marginRight: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    position: 'relative',
    borderRadius: 16,
  },
  activeTab: {
    backgroundColor: 'rgba(125, 90, 80, 0.08)',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabIcon: {
    marginRight: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    height: 2,
    borderRadius: 1,
  },
  contentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  contentIndicatorText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    // color wird durch ThemedText gesetzt
  },
});

export default SimpleTabs;
