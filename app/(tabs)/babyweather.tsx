import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, SafeAreaView, StatusBar, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, FlatList, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import * as Location from 'expo-location';
import { getWeatherByCoordinates, getWeatherByZipCode, getMockWeatherData, WeatherData, getWeatherByCity } from '@/lib/weatherService';
import { API_KEYS } from '@/lib/config';
import { Stack } from 'expo-router';
import Header from '@/components/Header';
import { useSmartBack } from '@/contexts/NavigationContext';
import { LiquidGlassCard, LAYOUT_PAD, TIMELINE_INSET } from '@/constants/DesignGuide';

const { width: screenWidth } = Dimensions.get('window');
const contentWidth = screenWidth - 2 * LAYOUT_PAD;
const TIMELINE_CONTENT_WIDTH = screenWidth - LAYOUT_PAD;

// Funktion zum Laden der Bilder
const getClothingImage = (imageName: string | null) => {
  if (!imageName) return null;
  
  switch (imageName) {
    case 'Windel.png':
      return require('@/assets/images/Windel.png');
    case 'Kurzarmbody.png':
      return require('@/assets/images/Kurzarmbody.png');
    case 'Langarmbody.png':
      return require('@/assets/images/Langarmbody.png');
    case 'Hose.png':
      return require('@/assets/images/Hose.png');
    case 'Pullover.png':
      return require('@/assets/images/Pullover.png');
    case 'Muetze.png':
      return require('@/assets/images/Muetze.png');
    case 'Socken.png':
      return require('@/assets/images/Socken.png');
    case 'Strumpfhose.png':
      return require('@/assets/images/Strumpfhose.png');
    case 'Shorts.png':
      return require('@/assets/images/Shorts.png');
    case 'Schlafsack.png':
      return require('@/assets/images/Schlafsack.png');
    case 'Jacke.png':
      return require('@/assets/images/Jacke.png');
    case 'Overall.png':
      return require('@/assets/images/Overall.png');
    case 'DuennerPulli.png':
      return require('@/assets/images/DuennerPulli.png');
    case 'Handschuhe.png':
      return require('@/assets/images/Handschuhe.png');
    case 'Fleecejacke.png':
      return require('@/assets/images/Fleecejacke.png');
    case 'Softshellanzug.png':
      return require('@/assets/images/Softshellanzug.png');
    case 'Regenjacke.png':
      return require('@/assets/images/Regenjacke.png');
    case 'Schal.png':
      return require('@/assets/images/Schal.png');
    case 'Kinderwagendecke.png':
      return require('@/assets/images/Kinderwagendecke.png');
    
    default:
      return null;
  }
};

// Funktion zum Laden der Situationsbilder
const getContextImage = (mode: ContextMode): any => {
  switch (mode) {
    case 'stroller':
      return require('@/assets/images/Kinderwagen.png');
    case 'carrier':
      return require('@/assets/images/Babytrage.png');
    case 'indoor':
      return require('@/assets/images/Zuhause.png');
    case 'sleeping':
      return require('@/assets/images/Schlafenszeit.png');
    case 'carSeat':
      return require('@/assets/images/Auto.png');// Using null as fallback - will display the icon instead
    default:
      return null;
  }
};

// Typen für Kleidungsempfehlungen
type ClothingItem = {
  id: string;
  name: string;
  image: string | null;
  recommended: boolean;
  category: ClothingCategory;
  tempRange: {
    min: number;
    max: number;
  };
};

// Kategorien für unterschiedliche Kleidungstypen
type ClothingCategory = 'underwear' | 'top' | 'bottom' | 'mid' | 'outer' | 'accessory' | 'sleep';

// Kontext-Modi
type ContextMode = 'stroller' | 'carrier' | 'indoor' | 'sleeping' | 'carSeat';

type TemperatureBand = 'hot' | 'warm' | 'mild' | 'cool' | 'fresh' | 'cold';

// Neues LayerSlot-System (exklusive Auswahl pro Layer)
type LayerSlot = {
  base: string | null;
  bottom: string | null;
  mid: string | null;
  outer: string | null;
  accessories: string[];
};

// Alternativen für User-Switch (optional)
type LayerAlternatives = {
  bottom?: string[];
  mid?: string[];
  outer?: string[];
};

// Erweiterte Kleidungskatalog mit spezifischeren Kategorien
const clothingCatalogue: Record<ClothingCategory, ClothingItem[]> = {
  underwear: [
    { id: '1', name: 'Windel', image: 'Windel.png', recommended: false, category: 'underwear', tempRange: { min: -20, max: 40 } },
    { id: '2', name: 'Kurzarmbody', image: 'Kurzarmbody.png', recommended: false, category: 'underwear', tempRange: { min: 20, max: 40 } },
    { id: '3', name: 'Langarmbody', image: 'Langarmbody.png', recommended: false, category: 'underwear', tempRange: { min: -20, max: 25 } },
  ],
  top: [],  // Wird nicht direkt verwendet, da Top durch underwear abgedeckt wird
  bottom: [
    { id: '4', name: 'Hose', image: 'Hose.png', recommended: false, category: 'bottom', tempRange: { min: -20, max: 25 } },
    { id: '5', name: 'Shorts', image: 'Shorts.png', recommended: false, category: 'bottom', tempRange: { min: 25, max: 40 } },
    { id: '16', name: 'Strumpfhose', image: 'Strumpfhose.png', recommended: false, category: 'bottom', tempRange: { min: -15, max: 18 } },
  ],
  mid: [
    { id: '6', name: 'Dünner Pullover', image: 'DuennerPulli.png', recommended: false, category: 'mid', tempRange: { min: 11, max: 20 } },
    { id: '7', name: 'Pullover', image: 'Pullover.png', recommended: false, category: 'mid', tempRange: { min: -20, max: 15 } },
    { id: '17', name: 'Fleecejacke', image: 'Fleecejacke.png', recommended: false, category: 'mid', tempRange: { min: -10, max: 12 } },
  ],
  outer: [
    { id: '8', name: 'Jacke', image: 'Jacke.png', recommended: false, category: 'outer', tempRange: { min: -20, max: 10 } },
    { id: '9', name: 'Overall', image: 'Overall.png', recommended: false, category: 'outer', tempRange: { min: -20, max: 5 } },
    { id: '26', name: 'Tragejacke/-cover', image: null, recommended: false, category: 'outer', tempRange: { min: -20, max: 15 } },
    { id: '18', name: 'Softshellanzug', image: 'Softshellanzug.png', recommended: false, category: 'outer', tempRange: { min: 5, max: 15 } },
    { id: '19', name: 'Regenjacke', image: 'Regenjacke.png', recommended: false, category: 'outer', tempRange: { min: 5, max: 20 } },
  ],
  accessory: [
    { id: '10', name: 'Mütze', image: 'Muetze.png', recommended: false, category: 'accessory', tempRange: { min: -20, max: 15 } },
    { id: '11', name: 'Socken', image: 'Socken.png', recommended: false, category: 'accessory', tempRange: { min: -20, max: 20 } },
    { id: '12', name: 'Handschuhe', image: 'Handschuhe.png', recommended: false, category: 'accessory', tempRange: { min: -20, max: 10 } },
    { id: '20', name: 'Sonnenhut', image: null, recommended: false, category: 'accessory', tempRange: { min: 20, max: 40 } },
    { id: '21', name: 'Halstuch', image: null, recommended: false, category: 'accessory', tempRange: { min: 8, max: 20 } },
    { id: '22', name: 'Schal', image: 'Schal.png', recommended: false, category: 'accessory', tempRange: { min: -20, max: 10 } },
    { id: '23', name: 'Schuhe', image: null, recommended: false, category: 'accessory', tempRange: { min: -10, max: 20 } },
    { id: '24', name: 'Kinderwagen-Decke', image: 'Kinderwagendecke.png', recommended: false, category: 'accessory', tempRange: { min: -20, max: 15 } },
    { id: '27', name: 'Füßlinge', image: null, recommended: false, category: 'accessory', tempRange: { min: -20, max: 15 } },
  ],
  sleep: [
    { id: '13', name: 'Schlafsack 0.5 TOG', image: 'Schlafsack.png', recommended: false, category: 'sleep', tempRange: { min: 24, max: 27 } },
    { id: '14', name: 'Schlafsack 1.0 TOG', image: 'Schlafsack.png', recommended: false, category: 'sleep', tempRange: { min: 20, max: 24 } },
    { id: '15', name: 'Schlafsack 2.5 TOG', image: 'Schlafsack.png', recommended: false, category: 'sleep', tempRange: { min: 16, max: 20 } },
    { id: '25', name: 'Schlafanzug', image: null, recommended: false, category: 'sleep', tempRange: { min: 18, max: 24 } },
  ],
};

// Tipps für verschiedene Wetterbedingungen
const weatherTips: Record<TemperatureBand, string[]> = {
  hot: [
    'Sonnencreme nicht vergessen - auch im Schatten!',
    'Hut mit breiter Krempe bietet zusätzlichen Sonnenschutz',
    'Im Kinderwagen auf ausreichend Luftzirkulation achten',
    'Besonders mittags (11-15 Uhr) Schatten suchen',
    'Regelmäßig Flüssigkeit anbieten',
  ],
  warm: [
    'Bei Aktivitäten im Freien immer eine dünne Jacke mitnehmen',
    'Sonnenschutz bei klarem Himmel verwenden',
    'Eine leichte Decke im Kinderwagen kann bei Wind nützlich sein',
  ],
  mild: [
    'Kleidung in Schichten, die sich bei Bedarf abnehmen lassen',
    'Eine dünne Mütze kann bei Wind sinnvoll sein',
    'Vor dem Schlafengehen ausreichend lüften',
  ],
  cool: [
    'Kalte Hände und Füße im Blick behalten',
    'Bei längeren Ausflügen Wechselkleidung mitnehmen',
    'Im Kinderwagen Fußsack verwenden',
  ],
  fresh: [
    'Windschutz oder Softshell hilft gegen Zugluft.',
    'Ein Halstuch schützt empfindliche Haut vor Kälte.',
    'Bei wechselhaftem Wetter Regenverdeck für den Kinderwagen einpacken.',
  ],
  cold: [
    'Mehrere dünne Schichten wärmen besser als eine dicke',
    'Auf trockene Kleidung achten, besonders nach Aktivitäten',
    'Wind-Schutz für den Kinderwagen nutzen',
    'Wechselkleidung mitnehmen',
  ],
};

// Temperaturanpassungen je nach Kontext
const contextModifiers: {[key in ContextMode]: number} = {
  stroller: 0,       // Keine Anpassung im Kinderwagen
  carrier: 3,        // In der Trage ist es wärmer (ca. +3 Grad)
  indoor: 5,         // Drinnen ist es wärmer (ca. +5 Grad)
  sleeping: 2,       // Beim Schlafen etwas wärmer (ca. +2 Grad)
  carSeat: 0,        // Keine Anpassung im Auto
};

// Beschreibungen der Kontexte
const contextDescriptions: {[key in ContextMode]: string} = {
  stroller: 'Kinderwagen',
  carrier: 'Babytrage',
  indoor: 'Drinnen',
  sleeping: 'Schlafenszeit',
  carSeat: 'Auto',
};

const getTemperatureBand = (value: number): TemperatureBand => {
  if (value >= 28) {
    return 'hot';
  }
  if (value >= 24) {
    return 'warm';
  }
  if (value >= 21) {
    return 'mild';
  }
  if (value >= 16) {
    return 'cool';
  }
  if (value >= 11) {
    return 'fresh';
  }
  return 'cold';
};

// Header component that will be memoized
interface HeaderProps {
  colorScheme: 'light' | 'dark';
  showBabyInfo: boolean;
  setShowBabyInfo: (show: boolean) => void;
  searchType: 'location' | 'zipCode' | 'cityName';
  toggleLocationMode: () => void;
  switchToZipCodeSearch: () => void;
  switchToCitySearch: () => void;
  zipCode: string;
  handleZipCodeChange: (text: string) => void;
  handleZipCodeSearch: () => void;
  cityName: string;
  handleCityNameChange: (text: string) => void;
  handleCitySearch: () => void;
  zipCodeInputRef: React.RefObject<TextInput | null>;
  cityNameInputRef: React.RefObject<TextInput | null>;
  weatherData: any;
  isLoading: boolean;
  errorMessage: string;
  selectedMode: ContextMode;
  setSelectedMode: (mode: ContextMode) => void;
  feltTemperature: number | null;
  setFeltTemperature: (value: number | null) => void;
  feltTemperatureOptions: number[];
  babyAgeMonths: number;
  babyWeightPercentile: number;
  metaCards: {title: string, content: string, icon: any}[];
}

const BabyWeatherHeader: React.FC<HeaderProps> = ({ 
  colorScheme, 
  showBabyInfo, 
  setShowBabyInfo, 
  searchType, 
  toggleLocationMode, 
  switchToZipCodeSearch, 
  switchToCitySearch,
  zipCode, 
  handleZipCodeChange,
  handleZipCodeSearch,
  cityName,
  handleCityNameChange,
  handleCitySearch,
  zipCodeInputRef,
  cityNameInputRef,
  weatherData,
  isLoading,
  errorMessage,
  selectedMode,
  setSelectedMode,
  feltTemperature,
  setFeltTemperature,
  feltTemperatureOptions,
  babyAgeMonths,
  babyWeightPercentile,
  metaCards
}) => {
  const theme = Colors[colorScheme || 'light'];
  const autoFeltTemp = weatherData?.feelsLike ?? weatherData?.temperature;
  
  return (
    <View style={styles.headerWrapper}>
      <TouchableOpacity 
        style={styles.infoButton}
        onPress={() => setShowBabyInfo(!showBabyInfo)}
      >
        <IconSymbol name="info.circle" size={22} color={theme.textSecondary} />
      </TouchableOpacity>

      {/* Informations-Popup für Baby-Daten */}
      {showBabyInfo && (
        <ThemedView style={styles.infoCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
          <ThemedText style={styles.infoTitle}>Baby-Daten für Empfehlungen</ThemedText>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Alter:</ThemedText>
            <ThemedText style={styles.infoValue}>{babyAgeMonths} Monate</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Gewicht-Perzentile:</ThemedText>
            <ThemedText style={styles.infoValue}>{babyWeightPercentile}%</ThemedText>
          </View>
          <ThemedText style={styles.infoNote}>
            Diese Daten werden aus dem Babyprofil übernommen und für präzisere Kleidungsempfehlungen verwendet.
          </ThemedText>
        </ThemedView>
      )}

      {/* Standort-/Postleitzahl-Auswahl */}
      <LiquidGlassCard style={styles.sectionCard} intensity={26}>
        <ThemedText style={styles.sectionTitle}>Standort</ThemedText>
        <View style={styles.locationToggle}>
          <TouchableOpacity
            style={[
              styles.locationButton,
              searchType === 'location' && styles.activeLocationButton
            ]}
            onPress={toggleLocationMode}
          >
            <IconSymbol name="location.fill" size={20} color={searchType === 'location' ? theme.accent : theme.tabIconDefault} />
            <ThemedText style={[styles.locationButtonText, searchType === 'location' && styles.activeLocationButtonText]}>Standort</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.locationButton,
              searchType === 'zipCode' && styles.activeLocationButton
            ]}
            onPress={switchToZipCodeSearch}
          >
            <IconSymbol name="number" size={20} color={searchType === 'zipCode' ? theme.accent : theme.tabIconDefault} />
            <ThemedText style={[styles.locationButtonText, searchType === 'zipCode' && styles.activeLocationButtonText]}>PLZ</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.locationButton,
              searchType === 'cityName' && styles.activeLocationButton
            ]}
            onPress={switchToCitySearch}
          >
            <IconSymbol name="building.2.fill" size={20} color={searchType === 'cityName' ? theme.accent : theme.tabIconDefault} />
            <ThemedText style={[styles.locationButtonText, searchType === 'cityName' && styles.activeLocationButtonText]}>Stadt</ThemedText>
          </TouchableOpacity>
        </View>

        {searchType === 'zipCode' && (
          <View style={styles.zipCodeContainer}>
            <TextInput
              style={[
                styles.zipCodeInput,
                { color: theme.text, borderColor: theme.cardLight !== '#FFFFFF' ? theme.cardLight : '#CCCCCC' }
              ]}
              placeholder="PLZ eingeben (z.B. 10115)"
              placeholderTextColor={theme.tabIconDefault}
              value={zipCode}
              onChangeText={handleZipCodeChange}
              keyboardType="numeric"
              maxLength={5}
              ref={zipCodeInputRef}
              blurOnSubmit={false}
              clearButtonMode="never"
              disableFullscreenUI={true}
            />
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: theme.accent }]}
              onPress={handleZipCodeSearch}
            >
              <ThemedText style={styles.searchButtonText}>Suchen</ThemedText>
            </TouchableOpacity>
          </View>
        )}
        
        {searchType === 'cityName' && (
          <View style={styles.zipCodeContainer}>
            <TextInput
              style={[
                styles.zipCodeInput,
                { color: theme.text, borderColor: theme.cardLight !== '#FFFFFF' ? theme.cardLight : '#CCCCCC' }
              ]}
              placeholder="Stadt eingeben (z.B. Berlin)"
              placeholderTextColor={theme.tabIconDefault}
              value={cityName}
              onChangeText={handleCityNameChange}
              autoCapitalize="words"
              ref={cityNameInputRef}
              blurOnSubmit={false}
              clearButtonMode="never"
              disableFullscreenUI={true}
            />
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: theme.accent }]}
              onPress={handleCitySearch}
            >
              <ThemedText style={styles.searchButtonText}>Suchen</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {weatherData && (
          <ThemedText style={styles.currentLocation}>
            {weatherData.location || (searchType === 'location' ? 'Aktueller Standort' : searchType === 'zipCode' ? `PLZ ${searchType === 'zipCode' ? zipCode : ''}` : cityName)}
          </ThemedText>
        )}
      </LiquidGlassCard>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <ThemedText style={styles.loadingText}>Wetterdaten werden geladen...</ThemedText>
        </View>
      ) : errorMessage ? (
        <LiquidGlassCard style={styles.errorContainer} intensity={26}>
          <IconSymbol name="exclamationmark.triangle" size={40} color="#FF6B6B" />
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </LiquidGlassCard>
      ) : (
        <>
          {/* Wetteranzeige */}
          <LiquidGlassCard style={[styles.sectionCard, styles.weatherCard]} intensity={26}>
            <ThemedText style={[styles.sectionTitle, styles.weatherTitle]}>Aktuelle Wetterlage</ThemedText>
            
            {/* New weather display layout */}
            <View style={styles.weatherDisplayContainer}>
              {/* Main temperature and icon row */}
              <View style={styles.mainWeatherRow}>
                <View style={styles.temperatureBox}>
                  <ThemedText style={styles.temperatureValue} numberOfLines={1} ellipsizeMode="clip">{weatherData?.temperature}°C</ThemedText>
                  <ThemedText style={styles.feelsLikeValue}>Gefühlt: {weatherData?.feelsLike}°C</ThemedText>
                </View>
                
                <View style={styles.weatherIconBox}>
                  <IconSymbol name={weatherData?.icon || "cloud.sun.fill"} size={54} color={theme.accent} />
                </View>
              </View>
              
              {/* Weather description */}
              <View style={styles.weatherDescriptionContainer}>
                <ThemedText style={styles.weatherDescriptionText}>{weatherData?.description}</ThemedText>
                <ThemedText style={styles.locationText}>{weatherData?.location || (searchType === 'location' ? 'Aktueller Standort' : searchType === 'zipCode' ? `PLZ ${zipCode}` : cityName)}</ThemedText>
              </View>
              
              {/* Weather details with smaller icons */}
              <View style={styles.weatherDetailsContainer}>
                <View style={styles.weatherDetailBox}>
                  <IconSymbol name="arrow.left.and.right" size={18} color={theme.tabIconDefault} />
                  <ThemedText style={styles.weatherDetailText}>Wind: {weatherData?.windSpeed} km/h</ThemedText>
                </View>
                
                <View style={styles.weatherDetailBox}>
                  <IconSymbol name="drop.fill" size={18} color={theme.tabIconDefault} />
                  <ThemedText style={styles.weatherDetailText}>Luftfeuchte: {weatherData?.humidity}%</ThemedText>
                </View>
              </View>
            </View>
          </LiquidGlassCard>

          {/* Kontext-Auswahl */}
          <LiquidGlassCard style={[styles.sectionCard]} intensity={26}>
            <ThemedText style={styles.sectionTitle}>Situation auswählen</ThemedText>
            <View style={styles.contextButtonsContainer}>
              {(Object.keys(contextDescriptions) as ContextMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.contextButtonNew,
                    selectedMode === mode && styles.selectedContextButtonNew
                  ]}
                  onPress={() => setSelectedMode(mode)}
                >
                  <View style={[
                    styles.contextImageContainer,
                    selectedMode === mode && styles.selectedContextImageContainer
                  ]}>
                    <Image 
                      source={getContextImage(mode)} 
                      style={styles.contextImageNew} 
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.contextButtonTextNew,
                      selectedMode === mode && styles.selectedContextButtonTextNew
                    ]}
                  >
                    {contextDescriptions[mode]}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </LiquidGlassCard>

          {(selectedMode === 'indoor' || selectedMode === 'sleeping') && (
            <LiquidGlassCard style={[styles.sectionCard]} intensity={26}>
              <ThemedText style={styles.sectionTitle}>Gefühlte Temperatur wählen</ThemedText>
              <View style={styles.feltTempOptions}>
                <TouchableOpacity
                  style={[
                    styles.feltTempButton,
                    feltTemperature === null && styles.feltTempButtonActive
                  ]}
                  onPress={() => setFeltTemperature(null)}
                >
                  <ThemedText
                    style={[
                      styles.feltTempButtonText,
                      feltTemperature === null && styles.feltTempButtonTextActive
                    ]}
                  >
                    Auto
                  </ThemedText>
                </TouchableOpacity>
                {feltTemperatureOptions.map((temp) => {
                  const isSelected = feltTemperature === temp;
                  return (
                    <TouchableOpacity
                      key={`felt-${temp}`}
                      style={[
                        styles.feltTempButton,
                        isSelected && styles.feltTempButtonActive
                      ]}
                      onPress={() => setFeltTemperature(temp)}
                    >
                      <ThemedText
                        style={[
                          styles.feltTempButtonText,
                          isSelected && styles.feltTempButtonTextActive
                        ]}
                      >
                        {temp}°C
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {autoFeltTemp !== undefined && autoFeltTemp !== null && (
                <ThemedText style={styles.feltTempHint}>
                  Aktuell (Wetter): {autoFeltTemp}°C
                </ThemedText>
              )}
            </LiquidGlassCard>
          )}

          {/* Meta-Cards vor den Kleidungsempfehlungen anzeigen */}
          {!isLoading && !errorMessage && weatherData && (
            <View style={styles.metaCardsContainer}>
              {metaCards.map((card, index) => (
                <LiquidGlassCard key={index} style={styles.metaCard} intensity={26}>
                  <View style={styles.metaCardHeader}>
                    <IconSymbol name={card.icon} size={22} color={theme.accent} />
                    <ThemedText style={styles.metaCardTitle}>{card.title}</ThemedText>
                  </View>
                  <ThemedText style={styles.metaCardContent}>{card.content}</ThemedText>
                </LiquidGlassCard>
              ))}
            </View>
          )}
          
          {/* Neue Überschrift für Kleidungsempfehlungen */}
          {!isLoading && !errorMessage && weatherData && (
            <LiquidGlassCard style={[styles.sectionCard, styles.recommendationCard]} intensity={26}>
              <ThemedText style={[styles.sectionTitle, styles.recommendationTitle]}>
                Empfohlene Kleidung für {contextDescriptions[selectedMode]}
              </ThemedText>
            </LiquidGlassCard>
          )}
        </>
      )}
    </View>
  );
};

// Memoize the BabyWeatherHeader to prevent unnecessary rerenders
const MemoHeader = React.memo(BabyWeatherHeader);

const FELT_TEMPERATURE_OPTIONS = [16, 18, 20, 22, 24, 26];

export default function BabyWeatherScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { isBabyBorn, babyAgeMonths, babyWeightPercentile } = useBabyStatus();
  
  // Set fallback route for smart back navigation
  useSmartBack('/(tabs)/home');

  const zipCodeInputRef = useRef<TextInput>(null);
  const cityNameInputRef = useRef<TextInput>(null);
  
  // Refs to buffer input locally
  const zipCodeInputBuffer = useRef('');
  const cityNameInputBuffer = useRef('');

  const [weatherData, setWeatherData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<ContextMode>('stroller');
  const [clothingRecommendations, setClothingRecommendations] = useState<ClothingItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [cityName, setCityName] = useState('');
  const [useLocation, setUseLocation] = useState(true);
  const [searchZipCode, setSearchZipCode] = useState('');
  const [searchCityName, setSearchCityName] = useState('');
  const [searchType, setSearchType] = useState<'location' | 'zipCode' | 'cityName'>('location');
  const [showBabyInfo, setShowBabyInfo] = useState(false);
  const [metaCards, setMetaCards] = useState<{title: string, content: string, icon: any}[]>([]);
  const [feltTemperature, setFeltTemperature] = useState<number | null>(null);

  // Alternativen-System
  const [layerAlternatives, setLayerAlternatives] = useState<LayerAlternatives>({});
  const [currentAlternativeIndex, setCurrentAlternativeIndex] = useState<{
    bottom?: number;
    mid?: number;
    outer?: number;
  }>({});

  // Wetterdaten abrufen
  useEffect(() => {
    if (searchType === 'location') {
      fetchWeatherByLocation();
    } else if (searchType === 'zipCode' && searchZipCode) {
      fetchWeatherByZipCode(searchZipCode);
    } else if (searchType === 'cityName' && searchCityName) {
      fetchWeatherByCity(searchCityName);
    }
  }, [searchType, searchZipCode, searchCityName]);

  // Wetterdaten über Standort abrufen
  const fetchWeatherByLocation = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      // Standortberechtigung anfragen
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setErrorMessage('Standortberechtigung wurde nicht erteilt');
        setIsLoading(false);
        // Fallback auf Mock-Daten
        const mockData = getMockWeatherData(true);
        setWeatherData(mockData);
        updateClothingRecommendations(mockData.temperature, selectedMode);
        return;
      }

      // Standort abrufen
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      try {
        // API-Aufruf ohne überflüssige Prüfung
        const weatherData = await getWeatherByCoordinates(latitude, longitude);
        setWeatherData(weatherData);
        updateClothingRecommendations(weatherData.temperature, selectedMode);
      } catch (apiError) {
        console.error('API Error:', apiError);
        // Detailliertere Protokollierung für Debug-Zwecke
        if (apiError instanceof Error) {
          console.error('API Error Details:', apiError.message);
        }
        // Fallback auf Mock-Daten bei API-Fehler
        const mockData = getMockWeatherData(true);
        setWeatherData(mockData);
        updateClothingRecommendations(mockData.temperature, selectedMode);
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
      setErrorMessage('Fehler beim Abrufen der Wetterdaten');
      
      // Fallback auf Mock-Daten bei allgemeinen Fehlern
      const mockData = getMockWeatherData(true);
      setWeatherData(mockData);
      updateClothingRecommendations(mockData.temperature, selectedMode);
    } finally {
      setIsLoading(false);
    }
  };

  // Wetterdaten über Postleitzahl abrufen
  const fetchWeatherByZipCode = async (zipCode: string) => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      try {
        // API-Aufruf ohne überflüssige Prüfung
        const weatherData = await getWeatherByZipCode(zipCode);
        setWeatherData(weatherData);
        updateClothingRecommendations(weatherData.temperature, selectedMode);
      } catch (apiError) {
        console.error('API Error:', apiError);
        // Detailliertere Protokollierung für Debug-Zwecke
        if (apiError instanceof Error) {
          console.error('API Error Details:', apiError.message);
        }
        // Fallback auf Mock-Daten bei API-Fehler
        const mockData = getMockWeatherData(false, zipCode);
        setWeatherData(mockData);
        updateClothingRecommendations(mockData.temperature, selectedMode);
      }
    } catch (error) {
      console.error('Error fetching weather data by zip code:', error);
      setErrorMessage('Fehler beim Abrufen der Wetterdaten für diese Postleitzahl');
      
      // Fallback auf Mock-Daten bei allgemeinen Fehlern
      const mockData = getMockWeatherData(false, zipCode);
      setWeatherData(mockData);
      updateClothingRecommendations(mockData.temperature, selectedMode);
    } finally {
      setIsLoading(false);
    }
  };

  // Wetterdaten über Stadtname abrufen
  const fetchWeatherByCity = async (cityName: string) => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      try {
        // API-Aufruf ohne überflüssige Prüfung
        const weatherData = await getWeatherByCity(cityName);
        setWeatherData(weatherData);
        updateClothingRecommendations(weatherData.temperature, selectedMode);
      } catch (apiError) {
        console.error('API Error:', apiError);
        // Detailliertere Protokollierung für Debug-Zwecke
        if (apiError instanceof Error) {
          console.error('API Error Details:', apiError.message);
        }
        // Fallback auf Mock-Daten bei API-Fehler
        const mockData = getMockWeatherData(false, cityName);
        setWeatherData(mockData);
        updateClothingRecommendations(mockData.temperature, selectedMode);
      }
    } catch (error) {
      console.error('Error fetching weather data by city name:', error);
      setErrorMessage('Fehler beim Abrufen der Wetterdaten für diese Stadt');
      
      // Fallback auf Mock-Daten bei allgemeinen Fehlern
      const mockData = getMockWeatherData(false, cityName);
      setWeatherData(mockData);
      updateClothingRecommendations(mockData.temperature, selectedMode);
    } finally {
      setIsLoading(false);
    }
  };

  // Angepasster Handler für die Postleitzahlen-Eingabe
  const handleZipCodeChange = (text: string) => {
    // Update the buffer reference and state
    zipCodeInputBuffer.current = text;
    setZipCode(text);
    // Removed the focus call to prevent keyboard dismissal
  };
  
  // Angepasster Handler für die Stadtnamens-Eingabe
  const handleCityNameChange = (text: string) => {
    // Update the buffer reference and state
    cityNameInputBuffer.current = text;
    setCityName(text);
    // Removed the focus call to prevent keyboard dismissal
  };

  // Handle Postleitzahl-Suche
  const handleZipCodeSearch = () => {
    if (zipCode.trim().length === 5 && /^\d+$/.test(zipCode)) {
      setSearchZipCode(zipCode);
      setSearchType('zipCode');
    } else {
      Alert.alert('Ungültige Eingabe', 'Bitte gib eine gültige 5-stellige Postleitzahl ein.');
    }
  };

  // Handle Stadtname-Suche
  const handleCitySearch = () => {
    if (cityName.trim().length >= 2) {
      setSearchCityName(cityName);
      setSearchType('cityName');
    } else {
      Alert.alert('Ungültige Eingabe', 'Bitte gib einen gültigen Stadtnamen ein (mindestens 2 Zeichen).');
    }
  };

  // Wechsle zur nächsten Alternative für einen Layer
  const swapLayerAlternative = (layer: 'bottom' | 'mid' | 'outer') => {
    const alternatives = layerAlternatives[layer];
    if (!alternatives || alternatives.length <= 1) return;

    const currentIndex = currentAlternativeIndex[layer] ?? 0;
    const nextIndex = (currentIndex + 1) % alternatives.length;

    // Speichere neuen Index
    const newIndices = {
      ...currentAlternativeIndex,
      [layer]: nextIndex,
    };

    setCurrentAlternativeIndex(newIndices);

    // Empfehlungen neu berechnen mit dem NEUEN Index (direkt übergeben)
    if (weatherData) {
      updateClothingRecommendations(weatherData.temperature, selectedMode, newIndices);
    }
  };

  // Kleidungsempfehlungen aktualisieren, wenn sich der Kontext ändert
  useEffect(() => {
    if (weatherData) {
      // Alternativen-Index zurücksetzen bei Moduswechsel
      setCurrentAlternativeIndex({});
      updateClothingRecommendations(weatherData.temperature, selectedMode);
    }
  }, [selectedMode, weatherData, babyAgeMonths, babyWeightPercentile]);

  useEffect(() => {
    if (!weatherData) return;
    if (selectedMode === 'indoor' || selectedMode === 'sleeping') {
      updateClothingRecommendations(weatherData.temperature, selectedMode);
    }
  }, [feltTemperature]);

  // Helper: Wähle genau EINES aus einer Liste basierend auf Priorität
  const selectOne = (candidates: string[], priorities: string[]): string | null => {
    for (const priority of priorities) {
      if (candidates.includes(priority)) {
        return priority;
      }
    }
    return candidates[0] || null;
  };

  // Prioritäten für jede Layer-Kategorie (von höchster zu niedrigster Priorität)
  const layerPriorities = {
    bottom: ['Shorts', 'Strumpfhose', 'Hose'],
    mid: ['Fleecejacke', 'Pullover', 'Dünner Pullover'],
    outer: ['Overall', 'Tragejacke/-cover', 'Softshellanzug', 'Regenjacke', 'Jacke'],
  };
  const carrierOuterPriorities = ['Tragejacke/-cover', 'Jacke', 'Overall'];

  // Berechne die Kleidungsempfehlungen basierend auf Temperatur und Kontext
  const updateClothingRecommendations = (
    temperature: number,
    mode: ContextMode,
    overrideIndices?: { bottom?: number; mid?: number; outer?: number }
  ) => {
    // Verwende override indices falls übergeben, sonst state
    const activeIndices = overrideIndices || currentAlternativeIndex;
    console.log(`Ursprüngliche Temperatur: ${temperature}°C`);

    const humidity = weatherData?.humidity ?? 50;
    const windSpeed = weatherData?.windSpeed ?? 0;

    const manualFeltTemp = (mode === 'indoor' || mode === 'sleeping') ? feltTemperature : null;
    const hasManualFeltTemp = manualFeltTemp !== null && manualFeltTemp !== undefined;
    if (hasManualFeltTemp) {
      console.log(`Manuelle gefühlte Temperatur: ${manualFeltTemp}°C`);
    }
    let effectiveTemp = manualFeltTemp ?? weatherData?.feelsLike ?? temperature;
    console.log(`Gefühlte Temperatur Basis: ${effectiveTemp}°C`);

    if (!hasManualFeltTemp && temperature > 27 && !weatherData?.feelsLike) {
      const heatIndex = temperature + (0.05 * humidity);
      console.log(`Berechneter Heat Index: ${heatIndex}°C (bei ${humidity}% Luftfeuchtigkeit)`);
      effectiveTemp = heatIndex;
    }

    if (!hasManualFeltTemp && temperature < 10 && !weatherData?.feelsLike && windSpeed > 5) {
      const windChill = temperature - (windSpeed * 0.1);
      console.log(`Berechneter Windchill: ${windChill}°C (bei ${windSpeed} km/h Wind)`);
      effectiveTemp = windChill;
    }

    const contextModifier = (hasManualFeltTemp && (mode === 'indoor' || mode === 'sleeping')) ? 0 : contextModifiers[mode];
    console.log(`Kontext-Modifikator: ${contextModifier}°C (${contextDescriptions[mode]})`);

    const usePersonalModifiers = !(hasManualFeltTemp && (mode === 'indoor' || mode === 'sleeping'));
    const ageModifier = usePersonalModifiers ? (babyAgeMonths < 3 ? -2 : (babyAgeMonths < 6 ? -1 : 0)) : 0;
    console.log(`Altersmodifikator: ${ageModifier}°C (${babyAgeMonths} Monate)`);

    const weightModifier = usePersonalModifiers ? (babyWeightPercentile < 25 ? -0.5 : 0) : 0;
    console.log(`Gewichtsmodifikator: ${weightModifier}°C (${babyWeightPercentile}. Perzentile)`);

    const modifierSum = ageModifier + weightModifier;
    let adjustedTemp = effectiveTemp + contextModifier + modifierSum;
    console.log(`Endgültige angepasste Temperatur: ${adjustedTemp}°C`);

    const temperatureBand = getTemperatureBand(adjustedTemp);
    console.log(`Temperatur-Band (Außen): ${temperatureBand}`);

    const indoorReferenceTemp = hasManualFeltTemp ? manualFeltTemp : effectiveTemp;
    const indoorComfortTemp = Math.min(
      Math.max(indoorReferenceTemp + (hasManualFeltTemp ? 0 : contextModifiers.indoor) + modifierSum, 16),
      26
    );
    const layeringBand = mode === 'sleeping' ? getTemperatureBand(indoorComfortTemp) : temperatureBand;
    const referenceTemp = mode === 'sleeping' ? indoorComfortTemp : adjustedTemp;

    if (mode === 'sleeping') {
      console.log(`Schlaf-Referenztemperatur: ${indoorComfortTemp}°C (Band ${layeringBand})`);
    }

    const description = weatherData?.description?.toLowerCase() ?? '';
    const iconName = weatherData?.icon ?? '';
    const requiresRainProtection = description.includes('regen') || iconName.includes('rain') || iconName.includes('drizzle');
    const indicatesSnow = description.includes('schnee') || iconName.includes('snow');
    const indicatesWind = description.includes('wind') || windSpeed >= 20;

    // ✨ EXKLUSIVE LayerSlot-Logik: Maximal 1 Teil pro Layer
    const layers: LayerSlot = {
      base: null,
      bottom: null,
      mid: null,
      outer: null,
      accessories: [],
    };

    // Base Layer (Windel + Body)
    if (mode === 'sleeping') {
      layers.base = referenceTemp >= 20 ? 'Kurzarmbody' : 'Langarmbody';
    } else {
      layers.base = ['hot', 'warm'].includes(layeringBand) ? 'Kurzarmbody' : 'Langarmbody';
    }

    // Bottom Layer: Sammle Kandidaten, wähle dann EINEN
    const bottomCandidates: string[] = [];
    if (layeringBand === 'hot' || (layeringBand === 'warm' && referenceTemp >= 25)) {
      bottomCandidates.push('Shorts');
    } else {
      if (['fresh', 'cold'].includes(layeringBand)) {
        bottomCandidates.push('Strumpfhose');
      }
      bottomCandidates.push('Hose');
    }

    // Alternativen speichern, wenn mehrere Optionen vorhanden
    const alternatives: LayerAlternatives = {};
    if (bottomCandidates.length > 1) {
      alternatives.bottom = bottomCandidates;
    }

    // Wähle die aktuell gewählte Alternative oder die erste
    const bottomIndex = activeIndices.bottom ?? 0;
    layers.bottom = bottomCandidates[bottomIndex] || selectOne(bottomCandidates, layerPriorities.bottom);

    // Mid Layer: Sammle Kandidaten, wähle dann EINEN
    const midCandidates: string[] = [];
    if (layeringBand === 'cool') {
      midCandidates.push('Dünner Pullover');
    } else if (layeringBand === 'fresh') {
      midCandidates.push('Pullover');
    } else if (layeringBand === 'cold') {
      midCandidates.push('Pullover');
      midCandidates.push('Fleecejacke');
    }

    if (indicatesWind && ['fresh', 'cold'].includes(layeringBand)) {
      midCandidates.push('Fleecejacke');
    }

    // Duplikate entfernen
    const uniqueMidCandidates = Array.from(new Set(midCandidates));
    if (uniqueMidCandidates.length > 1) {
      alternatives.mid = uniqueMidCandidates;
    }

    const midIndex = activeIndices.mid ?? 0;
    layers.mid = uniqueMidCandidates[midIndex] || selectOne(uniqueMidCandidates, layerPriorities.mid);

    // Outer Layer: Sammle Kandidaten, wähle dann EINEN
    const outerCandidates: string[] = [];
    if (mode === 'carrier') {
      if (['fresh', 'cold'].includes(layeringBand)) {
        outerCandidates.push('Jacke');
        outerCandidates.push('Tragejacke/-cover');
      }
      if (layeringBand === 'cold') {
        outerCandidates.push('Overall');
      }
    } else {
      if (layeringBand === 'fresh') {
        outerCandidates.push('Jacke');
      } else if (layeringBand === 'cold' && mode !== 'carSeat') {
        outerCandidates.push('Overall');
      }

      if ((requiresRainProtection || indicatesSnow) && layeringBand !== 'hot') {
        outerCandidates.push('Regenjacke');
      }

      if (indicatesWind && ['cool', 'fresh', 'cold'].includes(layeringBand)) {
        outerCandidates.push('Softshellanzug');
      } else if (layeringBand === 'fresh' && mode === 'stroller') {
        outerCandidates.push('Softshellanzug');
      }
    }

    // Duplikate entfernen
    const uniqueOuterCandidates = Array.from(new Set(outerCandidates));
    if (uniqueOuterCandidates.length > 1) {
      alternatives.outer = uniqueOuterCandidates;
    }

    const outerIndex = activeIndices.outer ?? 0;
    const outerPriorities = mode === 'carrier' ? carrierOuterPriorities : layerPriorities.outer;
    layers.outer = uniqueOuterCandidates[outerIndex] || selectOne(uniqueOuterCandidates, outerPriorities);

    if (mode === 'carrier' && layeringBand === 'cold') {
      delete alternatives.bottom;
    }

    // Speichere Alternativen für die UI
    setLayerAlternatives(alternatives);

    // Accessories (können mehrere sein, aber sinnvoll begrenzt)
    const accessoriesSet = new Set<string>();
    const addAccessory = (item: string) => {
      if (item) {
        accessoriesSet.add(item);
      }
    };

    const isOutdoorMode = mode === 'stroller' || mode === 'carrier' || mode === 'carSeat';

    if (mode !== 'sleeping') {
      addAccessory('Socken');
    } else if (['fresh', 'cold'].includes(layeringBand)) {
      addAccessory('Socken');
    }

    if (['hot', 'warm', 'mild'].includes(layeringBand) && isOutdoorMode) {
      addAccessory('Sonnenhut');
    }

    if (mode === 'carrier' && ['cool', 'fresh', 'cold'].includes(layeringBand)) {
      addAccessory('Halstuch');
    } else if (['cool', 'fresh'].includes(layeringBand) && isOutdoorMode) {
      addAccessory('Halstuch');
    }

    if (layeringBand === 'cold' && isOutdoorMode && mode !== 'carrier') {
      addAccessory('Schal');
    }

    if (['fresh', 'cold'].includes(layeringBand) && isOutdoorMode) {
      addAccessory('Mütze');
    }

    if (layeringBand === 'cold' && isOutdoorMode) {
      addAccessory('Handschuhe');
    }

    if (babyAgeMonths >= 9 && ['cool', 'fresh', 'cold'].includes(layeringBand) && isOutdoorMode) {
      addAccessory('Schuhe');
    }

    if (mode === 'carrier' && babyAgeMonths < 9 && ['cool', 'fresh', 'cold'].includes(layeringBand)) {
      addAccessory('Füßlinge');
    }

    if ((mode === 'stroller' || (mode === 'carSeat' && ['fresh', 'cold'].includes(layeringBand))) && ['cool', 'fresh', 'cold'].includes(layeringBand)) {
      addAccessory('Kinderwagen-Decke');
    }

    layers.accessories = Array.from(accessoriesSet);

    // 4. Kontext-Sonderregeln (jetzt mit LayerSlot)
    const metaWarnings = new Set<string>();

    if (mode === 'carrier' && layeringBand !== 'hot') {
      metaWarnings.add("In der Trage wird es wärmer - bei Bedarf eine Schicht weniger wählen.");
    }

    if (mode === 'carSeat') {
      // Im Autositz: Keine dicken Anzüge, nur dünne Jacken
      if (layers.outer === 'Overall' || layers.outer === 'Softshellanzug') {
        layers.outer = null;
      }

      if (layeringBand !== 'hot' && !layers.outer) {
        layers.outer = 'Jacke';
      }

      if (['cool', 'fresh', 'cold'].includes(layeringBand)) {
        metaWarnings.add("Im Autositz nur dünne Jacken tragen und warme Schichten erst nach dem Anschnallen ergänzen.");
        layers.accessories = layers.accessories.filter(item => item !== 'Handschuhe' && item !== 'Schal');
        if (!layers.accessories.includes('Kinderwagen-Decke')) {
          layers.accessories.push('Kinderwagen-Decke');
        }
      }
    }

    // Baue finalRecommendations aus LayerSlot
    let finalRecommendations: string[] = [];

    if (mode === 'sleeping') {
      // Schlafen: Windel + Body + ggf. Schlafanzug + Schlafsack + ggf. Socken
      finalRecommendations.push('Windel');
      if (layers.base) finalRecommendations.push(layers.base);

      if (referenceTemp < 24) {
        finalRecommendations.push('Schlafanzug');
      }

      if (referenceTemp >= 24) {
        finalRecommendations.push('Schlafsack 0.5 TOG');
      } else if (referenceTemp >= 20) {
        finalRecommendations.push('Schlafsack 1.0 TOG');
      } else {
        finalRecommendations.push('Schlafsack 2.5 TOG');
      }

      const sleepAccessories = layers.accessories.filter(item => item === 'Socken');
      finalRecommendations.push(...sleepAccessories);
    } else if (mode === 'indoor') {
      // Indoor: Base + Bottom + ggf. Mid + Socken
      finalRecommendations.push('Windel');
      if (layers.base) finalRecommendations.push(layers.base);
      if (layers.bottom) finalRecommendations.push(layers.bottom);
      if (['cool', 'fresh', 'cold'].includes(layeringBand) && layers.mid) {
        finalRecommendations.push(layers.mid);
      }
      const indoorAccessories = layers.accessories.filter(item => item === 'Socken');
      finalRecommendations.push(...indoorAccessories);
    } else {
      // Outdoor: Alle Layers
      finalRecommendations.push('Windel');
      if (layers.base) finalRecommendations.push(layers.base);
      if (layers.bottom) finalRecommendations.push(layers.bottom);
      if (mode === 'carrier' && layeringBand === 'cold') {
        if (!finalRecommendations.includes('Strumpfhose')) {
          finalRecommendations.push('Strumpfhose');
        }
        if (!finalRecommendations.includes('Hose')) {
          finalRecommendations.push('Hose');
        }
      }
      if (layers.mid) finalRecommendations.push(layers.mid);
      if (layers.outer) finalRecommendations.push(layers.outer);
      finalRecommendations.push(...layers.accessories);
    }

    console.log("Empfohlene Teile:", finalRecommendations.join(", "));

    const cards = [];

    const tipList = weatherTips[temperatureBand] ?? [];
    const randomTip = tipList.length > 0 ? tipList[Math.floor(Math.random() * tipList.length)] : '';

    if (randomTip) {
      cards.push({
        title: "Tipp des Tages",
        content: randomTip,
        icon: "lightbulb.fill" as any
      });
    }

    const warnings = Array.from(metaWarnings);
    if (warnings.length > 0) {
      cards.push({
        title: "Wichtiger Hinweis",
        content: warnings[0],
        icon: "exclamationmark.triangle.fill" as any
      });
    }

    if (temperatureBand === 'hot') {
      cards.push({
        title: "Hitze-Tipp",
        content: "Denken Sie an Schatten, ausreichend Flüssigkeit, Sonnencreme und einen Sonnenhut.",
        icon: "sun.max.fill" as any
      });
    } else if (temperatureBand === 'cold') {
      cards.push({
        title: "Kälte-Tipp",
        content: "Mehrere dünne Schichten wärmen besser als eine dicke. Prüfen Sie die Temperatur im Nacken, nicht an Händen oder Füßen.",
        icon: "snowflake" as any
      });
    }

    setMetaCards(cards);

    const clothingItems: ClothingItem[] = [];
    for (const category in clothingCatalogue) {
      const categoryItems = clothingCatalogue[category as ClothingCategory];
      categoryItems.forEach(item => {
        if (finalRecommendations.includes(item.name)) {
          clothingItems.push({ ...item, recommended: true });
        }
      });
    }

    setClothingRecommendations(clothingItems);
  };

  // Funktion zum Wechseln zu Standortmodus
  const toggleLocationMode = () => {
    setSearchType('location');
    // Standort abrufen
    fetchWeatherByLocation();
  };

  // Wechsel zur PLZ-Suche-Eingabe (für Tab-Button)
  const switchToZipCodeSearch = () => {
    setSearchType('zipCode');
  };

  // Wechsel zur Stadtsuche-Eingabe (für Tab-Button)
  const switchToCitySearch = () => {
    setSearchType('cityName');
  };

  const renderEmpty = () => (
    <View style={styles.noRecommendations}>
      <IconSymbol name="questionmark.circle" size={40} color={theme.tabIconDefault} />
      <ThemedText style={styles.noRecommendationsText}>
        Keine spezifischen Empfehlungen für diese Temperatur und Situation.
      </ThemedText>
    </View>
  );

  const renderFooter = () => (
    <ThemedText style={styles.disclaimer}>
      Hinweis: Die Empfehlungen sind Richtwerte und sollten an die individuellen Bedürfnisse deines Babys angepasst werden.
    </ThemedText>
  );

  // Helper: Bestimme welchem Layer ein Item gehört
  const getItemLayer = (itemName: string): 'bottom' | 'mid' | 'outer' | null => {
    if (layerAlternatives.bottom?.includes(itemName)) return 'bottom';
    if (layerAlternatives.mid?.includes(itemName)) return 'mid';
    if (layerAlternatives.outer?.includes(itemName)) return 'outer';
    return null;
  };

  const getDisplayName = (name: string, mode: ContextMode): string => {
    if (mode === 'carrier') {
      if (name === 'Strumpfhose') return 'Leggings';
      if (name === 'Mütze') return 'Wintermütze';
    }
    return name;
  };

  const renderClothingItem = ({ item }: { item: ClothingItem }) => {
    const itemLayer = getItemLayer(item.name);
    const hasAlternatives = itemLayer && layerAlternatives[itemLayer] && layerAlternatives[itemLayer]!.length > 1;
    const alternatives = itemLayer ? layerAlternatives[itemLayer] : null;
    const currentIndex = itemLayer ? (currentAlternativeIndex[itemLayer] ?? 0) : 0;
    const nextAlternative = hasAlternatives && alternatives ? alternatives[(currentIndex + 1) % alternatives.length] : null;
    const displayName = getDisplayName(item.name, selectedMode);
    const displayAlternative = nextAlternative ? getDisplayName(nextAlternative, selectedMode) : null;

    return (
      <View style={styles.clothingItem}>
        <View style={styles.clothesPin} />
        <View style={[
          styles.clothingItemContent,
          { backgroundColor: 'rgba(255, 255, 255, 0.85)' }
        ]}>
          {item.image ? (
            <Image source={getClothingImage(item.image)} style={styles.clothingImage} />
          ) : (
            <View style={[
              styles.iconBackground,
              { backgroundColor: getClothingColor(item.name) }
            ]}>
              <IconSymbol name={getClothingIcon(item.name)} size={36} color="#FFFFFF" />
            </View>
          )}

          {/* Alternativen-Button */}
          {hasAlternatives && nextAlternative && (
            <TouchableOpacity
              style={styles.swapButton}
              onPress={() => itemLayer && swapLayerAlternative(itemLayer)}
            >
              <IconSymbol name="arrow.triangle.2.circlepath" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        <ThemedText style={styles.clothingName}>{displayName}</ThemedText>
        {hasAlternatives && displayAlternative && (
          <ThemedText style={styles.alternativeHint}>
            Alternative: {displayAlternative}
          </ThemedText>
        )}
      </View>
    );
  };

  // Zusätzliches Rendering für Meta-Cards
  const renderMetaCard = ({ item }: { item: {title: string, content: string, icon: any} }) => (
    <LiquidGlassCard style={styles.metaCard} intensity={26}>
      <View style={styles.metaCardHeader}>
        <IconSymbol name={item.icon} size={22} color={theme.accent} />
        <ThemedText style={styles.metaCardTitle}>{item.title}</ThemedText>
      </View>
      <ThemedText style={styles.metaCardContent}>{item.content}</ThemedText>
    </LiquidGlassCard>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage}>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
          
          <Header title="Babywetter" showBackButton />
          
          {!isLoading && !errorMessage && weatherData ? (
          <FlatList
            ListHeaderComponent={
              <MemoHeader 
                colorScheme={colorScheme}
                showBabyInfo={showBabyInfo}
                setShowBabyInfo={setShowBabyInfo}
                searchType={searchType}
                toggleLocationMode={toggleLocationMode}
                switchToZipCodeSearch={switchToZipCodeSearch}
                switchToCitySearch={switchToCitySearch}
                zipCode={zipCode}
                handleZipCodeChange={handleZipCodeChange}
                handleZipCodeSearch={handleZipCodeSearch}
                cityName={cityName}
                handleCityNameChange={handleCityNameChange}
                handleCitySearch={handleCitySearch}
                zipCodeInputRef={zipCodeInputRef}
                cityNameInputRef={cityNameInputRef}
                weatherData={weatherData}
                isLoading={isLoading}
                errorMessage={errorMessage}
                selectedMode={selectedMode}
                setSelectedMode={setSelectedMode}
                feltTemperature={feltTemperature}
                setFeltTemperature={setFeltTemperature}
                feltTemperatureOptions={FELT_TEMPERATURE_OPTIONS}
                babyAgeMonths={babyAgeMonths}
                babyWeightPercentile={babyWeightPercentile}
                metaCards={metaCards}
              />
            }
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            data={clothingRecommendations.filter(item => item.recommended)}
            renderItem={renderClothingItem}
            keyExtractor={item => item.id}
            numColumns={3}
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            columnWrapperStyle={styles.columnWrapper}
            initialNumToRender={9}
            removeClippedSubviews={false}
          />
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
            <MemoHeader 
              colorScheme={colorScheme}
              showBabyInfo={showBabyInfo}
              setShowBabyInfo={setShowBabyInfo}
              searchType={searchType}
              toggleLocationMode={toggleLocationMode}
              switchToZipCodeSearch={switchToZipCodeSearch}
              switchToCitySearch={switchToCitySearch}
              zipCode={zipCode}
              handleZipCodeChange={handleZipCodeChange}
              handleZipCodeSearch={handleZipCodeSearch}
              cityName={cityName}
              handleCityNameChange={handleCityNameChange}
              handleCitySearch={handleCitySearch}
              zipCodeInputRef={zipCodeInputRef}
              cityNameInputRef={cityNameInputRef}
              weatherData={weatherData}
              isLoading={isLoading}
              errorMessage={errorMessage}
              selectedMode={selectedMode}
              setSelectedMode={setSelectedMode}
              feltTemperature={feltTemperature}
              setFeltTemperature={setFeltTemperature}
              feltTemperatureOptions={FELT_TEMPERATURE_OPTIONS}
              babyAgeMonths={babyAgeMonths}
              babyWeightPercentile={babyWeightPercentile}
              metaCards={metaCards}
            />
          </ScrollView>
        )}
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

// Hilfsfunktionen für Icons und Farben
function getContextIcon(mode: ContextMode): any {
  switch (mode) {
    case 'stroller':
      return 'cart.fill';
    case 'carrier':
      return 'person.2.fill';
    case 'indoor':
      return 'house.fill';
    case 'sleeping':
      return 'moon.fill';
    case 'carSeat':
      return 'car.fill';
    default:
      return 'questionmark.circle';
  }
}

// Verbesserte Kleidungs-Icons mit spezifischeren passenden SF Symbols
function getClothingIcon(name: string): any {
  switch (name.toLowerCase()) {
    case 'windel':
      return 'heart.fill'; // Keine perfekte Entsprechung, aber besser als ein Fragezeichen
    case 'kurzarmbody':
      return 'tshirt';
    case 'langarmbody':
      return 'tshirt.fill';
    case 'hose':
      return 'figure.stand';
    case 'shorts':
      return 'figure.child';
    case 'strumpfhose':
      return 'figure.walk';
    case 'dünner pullover':
    case 'pullover':
      return 'person.crop.square.filled.and.at.rectangle.fill';
    case 'fleecejacke':
      return 'thermometer.snowflake';
    case 'jacke':
      return 'person.fill';
    case 'overall':
      return 'person.fill.checkmark';
    case 'softshellanzug':
      return 'shield.fill';
    case 'regenjacke':
      return 'cloud.rain.fill';
    case 'mütze':
      return 'crown.fill';
    case 'socken':
      return 'figure.walk';
    case 'handschuhe':
      return 'hand.raised.fill';
    case 'sonnenhut':
      return 'sun.max.fill';
    case 'halstuch':
      return 'wind';
    case 'schal':
      return 'snowflake';
    case 'schuhe':
      return 'shoeprints.fill';
    case 'kinderwagen-decke':
      return 'bed.double';
    case 'tragejacke/-cover':
      return 'person.2.fill';
    case 'füßlinge':
      return 'shoeprints.fill';
    case 'schlafanzug':
      return 'moon.stars.fill';
    case 'schlafsack 0.5 tog':
    case 'schlafsack 1.0 tog':
    case 'schlafsack 2.5 tog':
      return 'bed.double.fill';
    default:
      return 'questionmark.circle';
  }
}

function getClothingColor(name: string): string {
  switch (name.toLowerCase()) {
    case 'windel':
      return '#FFFFFF';
    case 'kurzarmbody':
      return '#FF9F9F';
    case 'langarmbody':
      return '#FFB6C1';
    case 'hose':
      return '#6495ED';
    case 'shorts':
      return '#87CEFA';
    case 'strumpfhose':
      return '#F5DEB3';
    case 'dünner pullover':
      return '#98FB98';
    case 'pullover':
      return '#DDA0DD';
    case 'fleecejacke':
      return '#6BA292';
    case 'jacke':
      return '#87CEEB';
    case 'overall':
      return '#4682B4';
    case 'softshellanzug':
      return '#7FB3D5';
    case 'regenjacke':
      return '#1E90FF';
    case 'mütze':
      return '#FFD700';
    case 'socken':
      return '#FFA07A';
    case 'handschuhe':
      return '#9DD3A8';
    case 'sonnenhut':
      return '#FFD39B';
    case 'halstuch':
      return '#FF8C69';
    case 'schal':
      return '#B22222';
    case 'schuhe':
      return '#8B4513';
    case 'kinderwagen-decke':
      return '#F0E68C';
    case 'tragejacke/-cover':
      return '#C2B1A1';
    case 'füßlinge':
      return '#C8A87A';
    case 'schlafanzug':
      return '#D6C4B5';
    case 'schlafsack 0.5 tog':
      return '#ADD8E6';
    case 'schlafsack 1.0 tog':
      return '#9FD8FF';
    case 'schlafsack 2.5 tog':
      return '#4169E1';
    default:
      return '#CCCCCC';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'stretch',
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 15,
  },
  headerWrapper: {
    width: TIMELINE_CONTENT_WIDTH,
    alignSelf: 'center',
    position: 'relative',
  },
  errorContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 22,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  errorText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  weatherContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weatherHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  topWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
    justifyContent: 'flex-start',
    padding: 5,
  },
  weatherIconContainer: {
    width: 70, 
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(100, 150, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  temperatureContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  temperature: {
    fontSize: 46,
    fontWeight: 'bold',
    letterSpacing: -1,
  },
  weatherInfo: {
    width: '100%',
    paddingHorizontal: 5,
    marginTop: 5,
  },
  weatherDescription: {
    fontSize: 16,
    marginBottom: 4,
  },
  feelsLike: {
    fontSize: 14,
    opacity: 0.8,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 5,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  weatherDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  weatherDetailText: {
    fontSize: 13,
    marginLeft: 6,
    color: '#7D5A50',
    fontWeight: '500',
  },
  contextContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 2,
    lineHeight: 22,
  },
  weatherTitle: {
    marginBottom: 16,
  },
  contextButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contextButton: {
    width: '48%',
    height: 90,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedContextButton: {
    backgroundColor: 'rgba(100, 150, 255, 0.8)',
  },
  contextButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
  selectedContextButtonText: {
    color: '#FFFFFF',
  },
  clothingContainer: {
    borderRadius: 15,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clotheslineContainer: {
    marginTop: 14,
    marginBottom: 14,
    alignItems: 'center',
    position: 'relative',
  },
  clothesline: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#7D5A50',
    width: '100%',
    top: 15,
  },
  clothingItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%',
  },
  clothingItem: {
    alignItems: 'center',
    marginVertical: 10,
    width: '33%',
  },
  clothesPin: {
    width: 15,
    height: 20,
    borderRadius: 3,
    backgroundColor: '#E9C9B6',
    marginBottom: -5,
    zIndex: 1,
  },
  clothingItemContent: {
    width: 80,
    height: 80,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  clothingImage: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
  },
  iconBackground: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clothingName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    color: '#7D5A50',
  },
  swapButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(125, 90, 80, 0.85)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  alternativeHint: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
    color: '#A67C52',
  },
  disclaimer: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
    opacity: 0.7,
    color: '#7D5A50',
  },
  noRecommendations: {
    alignItems: 'center',
    padding: 20,
    alignSelf: 'center',
    width: TIMELINE_CONTENT_WIDTH,
  },
  noRecommendationsText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  locationContainer: {
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    flex: 1,
    marginHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  activeLocationButton: {
    borderColor: 'rgba(100,150,255,0.55)',
    backgroundColor: 'rgba(166,205,237,0.2)',
  },
  locationButtonText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#7D5A50',
  },
  activeLocationButtonText: {
    fontWeight: '700',
    color: '#5D4A40',
  },
  zipCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  zipCodeInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginRight: 10,
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#7D5A50',
    fontWeight: '500',
  },
  searchButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(100,150,255,0.78)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  currentLocation: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 8,
    color: '#7D5A50',
    fontWeight: '500',
  },
  location: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  debugContainer: {
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  debugItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  controlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  infoButton: {
    position: 'absolute',
    right: 16,
    top: 14,
    padding: 5,
    zIndex: 10,
  },
  infoCard: {
    width: '100%',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 10,
    opacity: 0.7,
  },
  sectionCard: {
    width: '100%',
    marginBottom: 14,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'stretch',
  },
  recommendationCard: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyContextCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Für iOS
    // Für Android wird die Farbe durch lightColor/darkColor gesetzt
  },
  columnWrapper: {
    justifyContent: 'space-around',
    marginVertical: 6,
    width: TIMELINE_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  metaCardsContainer: {
    width: '100%',
    marginBottom: 10,
  },
  metaCard: {
    width: '100%',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  metaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  metaCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
    marginLeft: 8,
    flexShrink: 1,
  },
  metaCardContent: {
    fontSize: 13,
    lineHeight: 19,
    color: '#7D5A50',
    paddingHorizontal: 2,
  },
  contextImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginBottom: 5,
  },
  weatherCard: {
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  weatherDisplayContainer: {
    width: '100%',
  },
  mainWeatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  temperatureBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 18,
    padding: 14,
    marginRight: 12,
    minWidth: 130,
    minHeight: 90,
    justifyContent: 'center',
  },
  temperatureValue: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    flexShrink: 0,
    lineHeight: 46,
    color: '#7D5A50',
  },
  feelsLikeValue: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.75,
    color: '#7D5A50',
    fontWeight: '600',
  },
  weatherIconBox: {
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: 'rgba(166,205,237,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherDescriptionContainer: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  weatherDescriptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7D5A50',
  },
  locationText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    color: '#7D5A50',
  },
  weatherDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weatherDetailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 0.48,
  },
  tempMainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    width: '100%',
  },
  weatherIconContainerNew: {
    width: 70, 
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(166, 205, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  mainTempContainer: {
    flex: 1,
    alignItems: 'center',
  },
  selectedContextButtonTextNew: {
    fontWeight: '700',
    color: '#5D4A40',
  },
  contextButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contextButtonNew: {
    width: '48%',
    minHeight: 120,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedContextButtonNew: {
    borderColor: 'rgba(100,150,255,0.55)',
    backgroundColor: 'rgba(166,205,237,0.25)',
  },
  contextImageContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  selectedContextImageContainer: {
    backgroundColor: 'rgba(166,205,237,0.9)',
    borderColor: 'rgba(100,150,255,0.55)',
  },
  contextImageNew: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  contextButtonTextNew: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    color: '#7D5A50',
  },
  feltTempOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  feltTempButton: {
    width: '30%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feltTempButtonActive: {
    borderColor: 'rgba(100,150,255,0.55)',
    backgroundColor: 'rgba(166,205,237,0.25)',
  },
  feltTempButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7D5A50',
  },
  feltTempButtonTextActive: {
    fontWeight: '700',
    color: '#5D4A40',
  },
  feltTempHint: {
    marginTop: 6,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
    color: '#7D5A50',
    fontWeight: '500',
  },
  recommendationTitle: {
    fontSize: 24,
    lineHeight: 26,
    marginBottom: 0,
  },
});
