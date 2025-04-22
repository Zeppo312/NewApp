import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ImageBackground, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { babySizeData, BabySizeData } from '@/lib/baby-size-data';

export default function BabySizePage() {
  // Stack-Konfiguration, um die Navigationsleiste zu verstecken
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BabySizeContent />
    </>
  );
}

function BabySizeContent() {
  const router = useRouter();
  const { week } = useLocalSearchParams();
  const [babyData, setBabyData] = useState<BabySizeData | null>(null);

  useEffect(() => {
    // Finde die Daten für die aktuelle Woche
    const currentWeek = parseInt(week as string) || 1;
    const data = babySizeData.find(item => item.week === currentWeek) || babySizeData[0];
    setBabyData(data);
  }, [week]);

  if (!babyData) {
    return (
      <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="repeat"
      >
        <SafeAreaView style={styles.container}>
          <StatusBar hidden={true} />
          <View style={styles.loadingContainer}>
            <ThemedText>Lade Daten...</ThemedText>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('@/assets/images/Background_Hell.png')}
      style={styles.backgroundImage}
      resizeMode="repeat"
    >
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#E57373" />
            <ThemedText style={[styles.backButtonText, { color: "#E57373" }]}>Zurück</ThemedText>
          </TouchableOpacity>

          <ThemedText type="title" style={styles.title}>
            Dein Baby in Woche {babyData.week}
          </ThemedText>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.fruitContainer}>
              <ThemedText style={styles.fruitTitle}>
                Heute ist dein Baby so groß wie
              </ThemedText>
              <ThemedText style={styles.fruitName}>
                {babyData.fruitComparison}
              </ThemedText>
              <Image
                source={require('@/assets/images/Baby_Icon.png')}
                style={styles.babyImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Größe</ThemedText>
                <ThemedText style={styles.statValue}>{babyData.length}</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Gewicht</ThemedText>
                <ThemedText style={styles.statValue}>{babyData.weight}</ThemedText>
              </View>
            </View>

            <View style={styles.descriptionContainer}>
              <ThemedText style={styles.descriptionTitle}>Entwicklung diese Woche</ThemedText>
              <ThemedText style={styles.descriptionText}>{babyData.description}</ThemedText>
            </View>
          </View>

          <View style={styles.weekSelector}>
            <ThemedText style={styles.weekSelectorTitle}>Andere Wochen</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekButtonsContainer}
            >
              {babySizeData.map((data) => (
                <TouchableOpacity
                  key={data.week}
                  style={[
                    styles.weekButton,
                    data.week === babyData.week && styles.selectedWeekButton
                  ]}
                  onPress={() => router.setParams({ week: data.week.toString() })}
                >
                  <ThemedText
                    style={[
                      styles.weekButtonText,
                      data.week === babyData.week && styles.selectedWeekButtonText
                    ]}
                  >
                    {data.week}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 40, // Ausgleich für den Zurück-Button
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fruitContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  fruitTitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
  },
  fruitName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E57373',
    marginBottom: 16,
  },
  babyImage: {
    width: 120,
    height: 120,
    marginVertical: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  descriptionContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#444',
  },
  weekSelector: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  weekSelectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  weekButtonsContainer: {
    paddingBottom: 8,
  },
  weekButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  selectedWeekButton: {
    backgroundColor: '#E57373',
  },
  weekButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedWeekButtonText: {
    color: 'white',
  },
});
