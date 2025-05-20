import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getAppSettings, saveAppSettings, AppSettings } from '@/lib/supabase';
import Header from '@/components/Header';

export default function AppSettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Keine Bildschirmabmessungen mehr nötig, da ThemedBackground diese intern verwaltet

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await getAppSettings();

      if (error) {
        console.error('Error loading app settings:', error);
        Alert.alert('Fehler', 'Einstellungen konnten nicht geladen werden.');
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load app settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (updatedSettings: Partial<AppSettings>) => {
    try {
      setIsSaving(true);

      // Aktualisiere die lokalen Einstellungen sofort für bessere UX
      setSettings(prev => prev ? { ...prev, ...updatedSettings } : null);

      const { data, error } = await saveAppSettings(updatedSettings);

      if (error) {
        console.error('Error saving app settings:', error);
        Alert.alert('Fehler', 'Einstellungen konnten nicht gespeichert werden.');
        // Lade die Einstellungen neu, falls ein Fehler auftritt
        await loadSettings();
        return;
      }

      if (data) {
        // Aktualisiere die Einstellungen mit den vom Server zurückgegebenen Daten
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to save app settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    await handleSaveSettings({ notifications_enabled: value });
  };

  const { themePreference, setThemePreference } = useTheme();

  const handleChangeTheme = async (theme: 'light' | 'dark' | 'system') => {
    await setThemePreference(theme);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <Header title="App-Einstellungen" showBackButton={true} />
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.accent} />
                  <ThemedText style={styles.loadingText}>Einstellungen werden geladen...</ThemedText>
                </View>
              ) : settings ? (
                <>
                  {/* Erscheinungsbild-Einstellungen */}
                  <ThemedView style={styles.section} lightColor={theme.card} darkColor={theme.card}>
                    <ThemedText style={styles.sectionTitle}>Erscheinungsbild</ThemedText>

                    <View style={styles.settingItem}>
                      <View style={styles.settingInfo}>
                        <IconSymbol name="sun.max" size={24} color={theme.accent} />
                        <ThemedText style={styles.settingText}>Helles Design</ThemedText>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.themeButton,
                          themePreference === 'light' && styles.selectedThemeButton
                        ]}
                        onPress={() => handleChangeTheme('light')}
                        disabled={isSaving}
                      >
                        <ThemedText
                          style={[
                            styles.themeButtonText,
                            themePreference === 'light' && styles.selectedThemeButtonText
                          ]}
                        >
                          {themePreference === 'light' && '✓'}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.settingItem}>
                      <View style={styles.settingInfo}>
                        <IconSymbol name="moon" size={24} color={theme.accent} />
                        <ThemedText style={styles.settingText}>Dunkles Design</ThemedText>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.themeButton,
                          themePreference === 'dark' && styles.selectedThemeButton
                        ]}
                        onPress={() => handleChangeTheme('dark')}
                        disabled={isSaving}
                      >
                        <ThemedText
                          style={[
                            styles.themeButtonText,
                            themePreference === 'dark' && styles.selectedThemeButtonText
                          ]}
                        >
                          {themePreference === 'dark' && '✓'}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.settingItem}>
                      <View style={styles.settingInfo}>
                        <IconSymbol name="gearshape" size={24} color={theme.accent} />
                        <ThemedText style={styles.settingText}>Systemeinstellung</ThemedText>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.themeButton,
                          themePreference === 'system' && styles.selectedThemeButton
                        ]}
                        onPress={() => handleChangeTheme('system')}
                        disabled={isSaving}
                      >
                        <ThemedText
                          style={[
                            styles.themeButtonText,
                            themePreference === 'system' && styles.selectedThemeButtonText
                          ]}
                        >
                          {themePreference === 'system' && '✓'}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </ThemedView>

                  {/* Benachrichtigungen-Einstellungen */}
                  <ThemedView style={styles.section} lightColor={theme.card} darkColor={theme.card}>
                    <ThemedText style={styles.sectionTitle}>Benachrichtigungen</ThemedText>

                    <View style={styles.settingItem}>
                      <View style={styles.settingInfo}>
                        <IconSymbol name="bell" size={24} color={theme.accent} />
                        <View>
                          <ThemedText style={styles.settingText}>Benachrichtigungen aktivieren</ThemedText>
                          <ThemedText style={styles.settingDescription}>
                            Erhalte wichtige Erinnerungen und Updates
                          </ThemedText>
                        </View>
                      </View>
                      <Switch
                        value={settings.notifications_enabled}
                        onValueChange={handleToggleNotifications}
                        disabled={isSaving}
                        trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                        thumbColor={settings.notifications_enabled ? '#FFFFFF' : '#F4F4F4'}
                        ios_backgroundColor="#D1D1D6"
                      />
                    </View>
                  </ThemedView>

                  {/* Über die App */}
                  <ThemedView style={styles.section} lightColor={theme.card} darkColor={theme.card}>
                    <ThemedText style={styles.sectionTitle}>Über die App</ThemedText>

                    <View style={styles.settingItem}>
                      <View style={styles.settingInfo}>
                        <IconSymbol name="info.circle" size={24} color={theme.accent} />
                        <ThemedText style={styles.settingText}>Version</ThemedText>
                      </View>
                      <ThemedText style={styles.versionText}>1.0.0</ThemedText>
                    </View>

                    <TouchableOpacity style={styles.settingItem}>
                      <View style={styles.settingInfo}>
                        <IconSymbol name="doc.text" size={24} color={theme.accent} />
                        <ThemedText style={styles.settingText}>Datenschutzerklärung</ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem}>
                      <View style={styles.settingInfo}>
                        <IconSymbol name="doc.text" size={24} color={theme.accent} />
                        <ThemedText style={styles.settingText}>Impressum</ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
                    </TouchableOpacity>
                  </ThemedView>

                  {/* Daten verwalten */}
                  <ThemedView style={styles.section} lightColor={theme.card} darkColor={theme.card}>
                    <ThemedText style={styles.sectionTitle}>Daten verwalten</ThemedText>

                    <TouchableOpacity style={styles.settingItem}>
                      <View style={styles.settingInfo}>
                        <IconSymbol name="arrow.down.doc" size={24} color={theme.accent} />
                        <View>
                          <ThemedText style={styles.settingText}>Daten exportieren</ThemedText>
                          <ThemedText style={styles.settingDescription}>
                            Exportiere deine Daten als Backup
                          </ThemedText>
                        </View>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.settingItem, styles.dangerItem]}
                      onPress={() => {
                        Alert.alert(
                          'Daten löschen',
                          'Möchtest du wirklich alle deine Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
                          [
                            { text: 'Abbrechen', style: 'cancel' },
                            {
                              text: 'Löschen',
                              style: 'destructive',
                              onPress: () => {
                                // Hier würde die Funktion zum Löschen aller Daten aufgerufen werden
                                Alert.alert('Info', 'Diese Funktion ist noch nicht implementiert.');
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <View style={styles.settingInfo}>
                        <IconSymbol name="trash" size={24} color="#FF6B6B" />
                        <View>
                          <ThemedText style={[styles.settingText, styles.dangerText]}>Alle Daten löschen</ThemedText>
                          <ThemedText style={styles.settingDescription}>
                            Lösche alle deine gespeicherten Daten
                          </ThemedText>
                        </View>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  </ThemedView>
                </>
              ) : (
                <ThemedView style={styles.errorContainer} lightColor={theme.card} darkColor={theme.card}>
                  <IconSymbol name="exclamationmark.triangle" size={40} color="#FF6B6B" />
                  <ThemedText style={styles.errorText}>
                    Einstellungen konnten nicht geladen werden
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.retryButton, { backgroundColor: theme.accent }]}
                    onPress={loadSettings}
                  >
                    <ThemedText style={styles.retryButtonText}>
                      Erneut versuchen
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 0,
  },

  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  section: {
    marginHorizontal: 16,    // <<< HINZUFÜGEN/ÄNDERN
    borderRadius: 15,        // <<< ÄNDERN (war z.B. 16)
    padding: 15,             // <<< ÄNDERN (war z.B. 16)
    marginBottom: 20,        // <<< ÄNDERN (war z.B. 16)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,            // <<< ÄNDERN (war z.B. 2)
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
  },
  settingDescription: {
    fontSize: 14,
    marginLeft: 12,
    opacity: 0.7,
  },
  themeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#D1D1D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedThemeButton: {
    borderColor: '#9DBEBB',
    backgroundColor: '#9DBEBB',
  },
  themeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedThemeButtonText: {
    color: '#FFFFFF',
  },
  versionText: {
    fontSize: 16,
    opacity: 0.7,
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#FF6B6B',
  },
  errorContainer: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
