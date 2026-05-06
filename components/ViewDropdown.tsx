import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';

export type ViewType = 'day' | 'timeline' | 'week';

interface ViewDropdownProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const ViewDropdown: React.FC<ViewDropdownProps> = ({ activeView, onViewChange }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const activeColor = isDark ? Colors.dark.accent : '#7D5A50';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownAnimation = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  // Öffne/schließe das Dropdown
  const toggleDropdown = () => {
    if (isOpen) {
      // Animation zum Schließen
      Animated.timing(dropdownAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsOpen(false));
    } else {
      setIsOpen(true);
      // Animation zum Öffnen
      Animated.timing(dropdownAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  // Wähle eine Ansicht aus und schließe das Dropdown
  const selectView = (view: ViewType) => {
    onViewChange(view);
    toggleDropdown();
  };

  // Rendere den Titel der aktiven Ansicht
  const getViewTitle = (view: ViewType): string => {
    switch (view) {
      case 'day':
        return 'Liste';
      case 'timeline':
        return 'Timeline';
      case 'week':
        return 'Woche';
      default:
        return 'Ansicht';
    }
  };

  // Rendere das Icon für die Ansicht
  const getViewIcon = (view: ViewType): string => {
    switch (view) {
      case 'day':
        return 'list.bullet';
      case 'timeline':
        return 'clock';
      case 'week':
        return 'calendar';
      default:
        return 'list.bullet';
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={toggleDropdown}
        activeOpacity={0.7}
      >
        <View style={styles.buttonContent}>
          <IconSymbol
            name={getViewIcon(activeView)}
            size={16}
            color={theme.text}
          />
          <ThemedText style={styles.buttonText}>
            {getViewTitle(activeView)}
          </ThemedText>
          <IconSymbol
            name={isOpen ? "chevron.up" : "chevron.down"}
            size={14}
            color={theme.text}
          />
        </View>
      </TouchableOpacity>

      {isOpen && (
        <Modal
          transparent={true}
          visible={isOpen}
          animationType="none"
          onRequestClose={toggleDropdown}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={toggleDropdown}
          >
            <Animated.View
              style={[
                styles.dropdownMenu,
                {
                  opacity: dropdownAnimation,
                  transform: [
                    {
                      translateY: dropdownAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                  left: 16,
                  width: screenWidth - 32,
                },
              ]}
            >
              <ThemedView style={styles.menuContent} lightColor="#FFFFFF" darkColor="#1A1A1A">
                <TouchableOpacity
                  style={[styles.menuItem, activeView === 'day' && [styles.activeMenuItem, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]]}
                  onPress={() => selectView('day')}
                >
                  <IconSymbol
                    name="list.bullet"
                    size={16}
                    color={activeView === 'day' ? activeColor : theme.text}
                  />
                  <ThemedText
                    style={[styles.menuItemText, activeView === 'day' && styles.activeMenuItemText]}
                    lightColor={activeView === 'day' ? '#7D5A50' : theme.text}
                    darkColor={activeView === 'day' ? Colors.dark.accent : theme.text}
                  >
                    Liste
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, activeView === 'timeline' && [styles.activeMenuItem, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]]}
                  onPress={() => selectView('timeline')}
                >
                  <IconSymbol
                    name="clock"
                    size={16}
                    color={activeView === 'timeline' ? activeColor : theme.text}
                  />
                  <ThemedText
                    style={[styles.menuItemText, activeView === 'timeline' && styles.activeMenuItemText]}
                    lightColor={activeView === 'timeline' ? '#7D5A50' : theme.text}
                    darkColor={activeView === 'timeline' ? Colors.dark.accent : theme.text}
                  >
                    Timeline
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, activeView === 'week' && [styles.activeMenuItem, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]]}
                  onPress={() => selectView('week')}
                >
                  <IconSymbol
                    name="calendar"
                    size={16}
                    color={activeView === 'week' ? activeColor : theme.text}
                  />
                  <ThemedText
                    style={[styles.menuItemText, activeView === 'week' && styles.activeMenuItemText]}
                    lightColor={activeView === 'week' ? '#7D5A50' : theme.text}
                    darkColor={activeView === 'week' ? Colors.dark.accent : theme.text}
                  >
                    Woche
                  </ThemedText>
                </TouchableOpacity>


              </ThemedView>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 5,
    zIndex: 100,
  },
  dropdownButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 100, // Position unter dem Header
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  menuContent: {
    borderRadius: 10,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  activeMenuItem: {
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  menuItemText: {
    fontSize: 14,
    marginLeft: 10,
  },
  activeMenuItemText: {
    fontWeight: '600',
  },
});

export default ViewDropdown;
