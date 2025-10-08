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
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';

export default function AppSettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // no extra width logic; match "Mehr" padding rhythm via ScrollView

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
            <Header
              title="App-Einstellungen"
              subtitle="Benachrichtigungen, Erscheinungsbild und mehr"
              showBackButton
              onBackPress={() => router.push('/more')}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.accent} />
                  <ThemedText style={styles.loadingText}>Einstellungen werden geladen...</ThemedText>
                </View>
              ) : (
                <View style={styles.contentWrap}>
                {settings ? (
                <>
                  {/* Erscheinungsbild-Einstellungen */}
                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Erscheinungsbild</ThemedText>

                    <TouchableOpacity style={styles.rowItem} onPress={() => handleChangeTheme('light')} disabled={isSaving}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="sun.max" size={24} color={theme.accent} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Helles Design</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        <View style={[styles.themeButton, themePreference === 'light' && styles.selectedThemeButton]}>
                          <ThemedText style={[styles.themeButtonText, themePreference === 'light' && styles.selectedThemeButtonText]}>
                            {themePreference === 'light' && '✓'}
                          </ThemedText>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.rowItem} onPress={() => handleChangeTheme('dark')} disabled={isSaving}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="moon" size={24} color={theme.accent} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Dunkles Design</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        <View style={[styles.themeButton, themePreference === 'dark' && styles.selectedThemeButton]}>
                          <ThemedText style={[styles.themeButtonText, themePreference === 'dark' && styles.selectedThemeButtonText]}>
                            {themePreference === 'dark' && '✓'}
                          </ThemedText>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.rowItem} onPress={() => handleChangeTheme('system')} disabled={isSaving}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="gearshape" size={24} color={theme.accent} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Systemeinstellung</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        <View style={[styles.themeButton, themePreference === 'system' && styles.selectedThemeButton]}>
                          <ThemedText style={[styles.themeButtonText, themePreference === 'system' && styles.selectedThemeButtonText]}>
                            {themePreference === 'system' && '✓'}
                          </ThemedText>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </LiquidGlassCard>

                  {/* Benachrichtigungen-Einstellungen */}
                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Benachrichtigungen</ThemedText>

                    <View style={styles.rowItem}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="bell" size={24} color={theme.accent} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Benachrichtigungen aktivieren</ThemedText>
                        <ThemedText style={styles.rowDescription}>Erhalte wichtige Erinnerungen und Updates</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        <Switch
                          value={settings.notifications_enabled}
                          onValueChange={handleToggleNotifications}
                          disabled={isSaving}
                          trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                          thumbColor={settings.notifications_enabled ? '#FFFFFF' : '#F4F4F4'}
                          ios_backgroundColor="#D1D1D6"
                        />
                      </View>
                    </View>
                  </LiquidGlassCard>

                  {/* Über die App */}
                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Über die App</ThemedText>

                    <View style={styles.rowItem}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="info.circle" size={24} color={theme.accent} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Version</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        <ThemedText style={styles.versionText}>1.0.0</ThemedText>
                      </View>
                    </View>

                    <TouchableOpacity style={styles.rowItem}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="doc.text" size={24} color={theme.accent} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Datenschutzerklärung</ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.rowItem}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="doc.text" size={24} color={theme.accent} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Impressum</ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
                    </TouchableOpacity>
                  </LiquidGlassCard>

                  {/* Daten verwalten */}
                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Daten verwalten</ThemedText>

                    <TouchableOpacity style={styles.rowItem}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="arrow.down.doc" size={24} color={theme.accent} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Daten exportieren</ThemedText>
                        <ThemedText style={styles.rowDescription}>Exportiere deine Daten als Backup</ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rowItem}
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
                      <View style={styles.rowIcon}>
                        <IconSymbol name="trash" size={24} color="#FF6B6B" />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={[styles.rowTitle, styles.dangerText]}>Alle Daten löschen</ThemedText>
                        <ThemedText style={styles.rowDescription}>Lösche alle deine gespeicherten Daten</ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  </LiquidGlassCard>
                </>
              ) : (
                <LiquidGlassCard style={[styles.sectionCard, styles.errorContainerGlass]} intensity={26} overlayColor={GLASS_OVERLAY}>
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
                  </LiquidGlassCard>
              )}
                </View>
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
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 10,
  },
  contentWrap: {
    width: '100%',
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
  sectionCard: { marginBottom: 16, borderRadius: 22, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)'
  },
  rowIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowDescription: { fontSize: 13, opacity: 0.8, marginTop: 2 },
  trailing: { marginLeft: 12, alignItems: 'center', justifyContent: 'center' },
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
  errorContainerGlass: {
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
