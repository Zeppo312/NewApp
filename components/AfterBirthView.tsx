import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { setBabyBornStatus } from '@/lib/supabase';

interface AfterBirthViewProps {
  onSwitchBack: () => void;
}

const AfterBirthView: React.FC<AfterBirthViewProps> = ({ onSwitchBack }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const handleSwitchBack = async () => {
    try {
      await setBabyBornStatus(false);
      onSwitchBack();
    } catch (error) {
      console.error('Error switching back to pregnancy view:', error);
    }
  };

  return (
    <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
      <ThemedText style={styles.congratsText}>
        Herzlichen Glückwunsch! 🎉
      </ThemedText>
      
      <ThemedText style={styles.mainText}>
        Dein Baby ist da! Wir wünschen euch alles Gute für den gemeinsamen Start.
      </ThemedText>
      
      <ThemedView style={styles.infoCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
        <ThemedText style={styles.infoTitle}>
          Die ersten Tage mit deinem Baby
        </ThemedText>
        <ThemedText style={styles.infoText}>
          • Ruhe und Erholung sind jetzt besonders wichtig für dich und dein Baby.
        </ThemedText>
        <ThemedText style={styles.infoText}>
          • Genieße die besonderen Momente und lass dir Zeit, dein Baby kennenzulernen.
        </ThemedText>
        <ThemedText style={styles.infoText}>
          • Scheue dich nicht, um Hilfe zu bitten, wenn du sie brauchst.
        </ThemedText>
        <ThemedText style={styles.infoText}>
          • Vertraue auf deine Intuition als Mutter.
        </ThemedText>
      </ThemedView>
      
      <View style={styles.buttonContainer}>
        <ThemedText 
          style={styles.switchBackButton} 
          lightColor={theme.accent} 
          darkColor={theme.accent}
          onPress={handleSwitchBack}
        >
          Zurück zur Schwangerschaftsansicht
        </ThemedText>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  congratsText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 15,
  },
  mainText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  infoCard: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  buttonContainer: {
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  switchBackButton: {
    fontSize: 16,
    padding: 10,
    borderRadius: 5,
    textDecorationLine: 'underline',
  },
});

export default AfterBirthView;
