import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, SafeAreaView, StatusBar } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { GlassCard, LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';

const TIMELINE_INSET = 8; // wie im Sleep-Tracker

export default function MoreScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSwitchBack = () => {
    Alert.alert(
      "Zurück zur Schwangerschaftsansicht",
      "Möchtest du wirklich zur Schwangerschaftsansicht zurückkehren?",
      [
        {
          text: "Abbrechen",
          style: "cancel"
        },
        {
          text: "Ja, zurückkehren",
          onPress: async () => {
            try {
              await setIsBabyBorn(false);
              Alert.alert("Erfolg", "Du bist jetzt in der Schwangerschaftsansicht.");
            } catch (error) {
              console.error('Error switching to pregnancy view:', error);
              Alert.alert("Fehler", "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.");
            }
          }
        }
      ]
    );
  };

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

              // Zur Login-Seite navigieren
              router.replace('/(auth)');
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

  // Wechsel zur Babyansicht
  const handleSwitchToBabyView = () => {
    Alert.alert(
      "Zur Babyansicht wechseln",
      "Möchtest du wirklich zur Babyansicht wechseln?",
      [
        {
          text: "Abbrechen",
          style: "cancel"
        },
        {
          text: "Ja, wechseln",
          onPress: async () => {
            try {
              await setIsBabyBorn(true);
              Alert.alert("Erfolg", "Du bist jetzt in der Babyansicht.");
            } catch (error) {
              console.error('Error switching to baby view:', error);
              Alert.alert("Fehler", "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.");
            }
          }
        }
      ]
    );
  };

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
       <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header 
          title="Mehr" 
          subtitle="Einstellungen und weitere Funktionen" 
        />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              Baby & Familie
            </ThemedText>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(tabs)/weight-tracker')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="chart.line.uptrend.xyaxis" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  Gewichtskurve
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Verfolge deine Gewichtsentwicklung
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>
          </LiquidGlassCard>

          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              Wissen & Hilfe
            </ThemedText>

            {/* Geburtsplan-Link (nur vor der Geburt anzeigen) */}
            {!isBabyBorn && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push('/(tabs)/geburtsplan')}
              >
                <View style={styles.menuItemIcon}>
                  <IconSymbol name="doc.text.fill" size={24} color={theme.accent} />
                </View>
                <View style={styles.menuItemContent}>
                  <ThemedText style={styles.menuItemTitle}>
                    Geburtsplan
                  </ThemedText>
                  <ThemedText style={styles.menuItemDescription}>
                    Erstelle und bearbeite deinen persönlichen Geburtsplan
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/lottis-empfehlungen')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="star.fill" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  Lottis Empfehlungen
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Handverlesene Produkte für dich und dein Baby
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/mini-wiki')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="book.fill" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  Mini-Wiki
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Wissenswertes über die ersten Monate
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/faq')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="questionmark.circle.fill" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  Häufige Fragen
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Antworten auf typische Fragen nach der Geburt
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>
          </LiquidGlassCard>

          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              Einstellungen
            </ThemedText>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/app-settings')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="gear" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  App-Einstellungen
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Benachrichtigungen, Erscheinungsbild, etc.
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profil')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="person.crop.circle" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  Profil
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Deine persönlichen Daten verwalten
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/account-linking')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="link" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  Accounts verknüpfen
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Verbinde dich mit deinem Partner oder Familie
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>

            {/* Zur Babyansicht wechseln (nur vor der Geburt anzeigen) */}
            {!isBabyBorn && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleSwitchToBabyView}
              >
                <View style={styles.menuItemIcon}>
                  <IconSymbol name="arrow.forward" size={24} color="#3A9E8C" />
                </View>
                <View style={styles.menuItemContent}>
                  <ThemedText style={styles.menuItemTitle}>
                    Zur Babyansicht wechseln
                  </ThemedText>
                  <ThemedText style={styles.menuItemDescription}>
                    Wechsle zur Ansicht nach der Geburt
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
              </TouchableOpacity>
            )}

            {/* Zurück zur Schwangerschaftsansicht (nur nach der Geburt anzeigen) */}
            {isBabyBorn && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleSwitchBack}
              >
                <View style={styles.menuItemIcon}>
                  <IconSymbol name="arrow.uturn.backward" size={24} color="#FF6B6B" />
                </View>
                <View style={styles.menuItemContent}>
                  <ThemedText style={styles.menuItemTitle}>
                    Zurück zur Schwangerschaftsansicht
                  </ThemedText>
                  <ThemedText style={styles.menuItemDescription}>
                    Wechsle zurück zur Ansicht vor der Geburt
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
              </TouchableOpacity>
            )}
          </LiquidGlassCard>

          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              Über die App
            </ThemedText>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemIcon}>
                <IconSymbol name="info.circle.fill" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  Informationen
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Version, Datenschutz, Impressum
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemIcon}>
                <IconSymbol name="star.fill" size={24} color={theme.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  Bewerten
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  Bewerte die App im App Store
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
            </TouchableOpacity>
          </LiquidGlassCard>

          {/* Logout Section */}
          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <ThemedText style={styles.logoutButtonText}>
                Abmelden
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: { paddingHorizontal: LAYOUT_PAD, paddingBottom: 40, paddingTop: 10 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    // gleiche Innenbreite wie Timeline:
    marginHorizontal: TIMELINE_INSET,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)'
  },
  menuItemIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 13,
    opacity: 0.8,
  },
  logoutSection: {
    marginTop: 20,
    marginBottom: 40,
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
