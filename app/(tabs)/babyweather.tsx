import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, SafeAreaView, StatusBar, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, FlatList } from 'react-native';
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
  ],
  mid: [
    { id: '6', name: 'Dünner Pullover', image: 'DuennerPulli.png', recommended: false, category: 'mid', tempRange: { min: 11, max: 20 } },
    { id: '7', name: 'Pullover', image: 'Pullover.png', recommended: false, category: 'mid', tempRange: { min: -20, max: 15 } },
  ],
  outer: [
    { id: '8', name: 'Jacke', image: 'Jacke.png', recommended: false, category: 'outer', tempRange: { min: -20, max: 10 } },
    { id: '9', name: 'Overall', image: 'Overall.png', recommended: false, category: 'outer', tempRange: { min: -20, max: 5 } },
  ],
  accessory: [
    { id: '10', name: 'Mütze', image: 'Muetze.png', recommended: false, category: 'accessory', tempRange: { min: -20, max: 15 } },
    { id: '11', name: 'Socken', image: 'Socken.png', recommended: false, category: 'accessory', tempRange: { min: -20, max: 20 } },
    { id: '12', name: 'Handschuhe', image: 'Handschuhe.png', recommended: false, category: 'accessory', tempRange: { min: -20, max: 10 } },
  ],
  sleep: [
    { id: '13', name: 'Schlafsack 0.5 TOG', image: 'Schlafsack.png', recommended: false, category: 'sleep', tempRange: { min: 24, max: 27 } },
    { id: '14', name: 'Schlafsack 1.0 TOG', image: 'Schlafsack.png', recommended: false, category: 'sleep', tempRange: { min: 20, max: 24 } },
    { id: '15', name: 'Schlafsack 2.5 TOG', image: 'Schlafsack.png', recommended: false, category: 'sleep', tempRange: { min: 16, max: 20 } },
  ],
};

// Tipps für verschiedene Wetterbedingungen
const weatherTips: Record<string, string[]> = {
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
  babyAgeMonths,
  babyWeightPercentile,
  metaCards
}) => {
  const theme = Colors[colorScheme || 'light'];
  
  return (
    <>
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
      <ThemedView style={styles.sectionCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
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
      </ThemedView>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <ThemedText style={styles.loadingText}>Wetterdaten werden geladen...</ThemedText>
        </View>
      ) : errorMessage ? (
        <ThemedView style={styles.errorContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
          <IconSymbol name="exclamationmark.triangle" size={40} color="#FF6B6B" />
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : (
        <>
          {/* Wetteranzeige */}
          <ThemedView style={[styles.sectionCard, styles.weatherCard]} lightColor={theme.cardLight} darkColor={theme.cardDark}>
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
          </ThemedView>

          {/* Kontext-Auswahl */}
          <ThemedView style={[styles.sectionCard]} lightColor={theme.cardLight} darkColor={theme.cardDark}>
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
          </ThemedView>

          {/* Meta-Cards vor den Kleidungsempfehlungen anzeigen */}
          {!isLoading && !errorMessage && weatherData && (
            <View style={styles.metaCardsContainer}>
              {metaCards.map((card, index) => (
                <ThemedView key={index} style={styles.metaCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
                  <View style={styles.metaCardHeader}>
                    <IconSymbol name={card.icon} size={22} color={theme.accent} />
                    <ThemedText style={styles.metaCardTitle}>{card.title}</ThemedText>
                  </View>
                  <ThemedText style={styles.metaCardContent}>{card.content}</ThemedText>
                </ThemedView>
              ))}
            </View>
          )}
          
          {/* Neue Überschrift für Kleidungsempfehlungen */}
          {!isLoading && !errorMessage && weatherData && (
            <ThemedView style={styles.sectionCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
              <ThemedText style={styles.sectionTitle}>
                Empfohlene Kleidung für {contextDescriptions[selectedMode]}
              </ThemedText>
            </ThemedView>
          )}
        </>
      )}
    </>
  );
};

// Memoize the BabyWeatherHeader to prevent unnecessary rerenders
const MemoHeader = React.memo(BabyWeatherHeader);

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
  const [weatherTip, setWeatherTip] = useState<string>('');
  const [metaCards, setMetaCards] = useState<{title: string, content: string, icon: any}[]>([]);

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

  // Kleidungsempfehlungen aktualisieren, wenn sich der Kontext ändert
  useEffect(() => {
    if (weatherData) {
      updateClothingRecommendations(weatherData.temperature, selectedMode);
    }
  }, [selectedMode, weatherData, babyAgeMonths, babyWeightPercentile]);

  // Berechne die Kleidungsempfehlungen basierend auf Temperatur und Kontext
  const updateClothingRecommendations = (temperature: number, mode: ContextMode) => {
    console.log(`Ursprüngliche Temperatur: ${temperature}°C`);

    // 1. Realistische Temperatur bestimmen
    // Heat Index für Hitze (> 27°C) und Windchill für Kälte (< 10°C)
    const humidity = weatherData?.humidity ?? 50;
    const windSpeed = weatherData?.windSpeed ?? 0;
    
    // Gefühlte Temperatur aus der API bevorzugen
    let adjustedTemp = weatherData?.feelsLike ?? temperature;
    console.log(`Gefühlte Temperatur aus API: ${adjustedTemp}°C`);
    
    // Heat Index berechnen (für höhere Temperaturen)
    if (temperature > 27 && !weatherData?.feelsLike) {
      // Vereinfachte Heat Index Formel
      const heatIndex = temperature + (0.05 * humidity);
      console.log(`Berechneter Heat Index: ${heatIndex}°C (bei ${humidity}% Luftfeuchtigkeit)`);
      adjustedTemp = heatIndex;
    }
    
    // Windchill berechnen (für niedrigere Temperaturen)
    if (temperature < 10 && !weatherData?.feelsLike && windSpeed > 5) {
      // Vereinfachte Windchill Formel
      const windChill = temperature - (windSpeed * 0.1);
      console.log(`Berechneter Windchill: ${windChill}°C (bei ${windSpeed} km/h Wind)`);
      adjustedTemp = windChill;
    }
    
    // Kontext-Korrektur addieren
    const contextModifier = contextModifiers[mode];
    console.log(`Kontext-Modifikator: ${contextModifier}°C (${contextDescriptions[mode]})`);
    adjustedTemp += contextModifier;
    
    // Feinkorrektur für Alter
    const ageModifier = babyAgeMonths < 3 ? -2 : (babyAgeMonths < 6 ? -1 : 0);
    console.log(`Altersmodifikator: ${ageModifier}°C (${babyAgeMonths} Monate)`);
    adjustedTemp += ageModifier;
    
    // Feinkorrektur für Gewicht
    const weightModifier = babyWeightPercentile < 25 ? -0.5 : 0;
    console.log(`Gewichtsmodifikator: ${weightModifier}°C (${babyWeightPercentile}. Perzentile)`);
    adjustedTemp += weightModifier;
    
    console.log(`Endgültige angepasste Temperatur: ${adjustedTemp}°C`);

    // 2. Temperatur-Bänder definieren
    let temperatureBand: 'hot' | 'warm' | 'mild' | 'cool' | 'fresh' | 'cold';
    
    if (adjustedTemp >= 28) {
      temperatureBand = 'hot';  // Heiß: ≥ 28°C
    } else if (adjustedTemp >= 24) {
      temperatureBand = 'warm'; // Warm: 24-27°C
    } else if (adjustedTemp >= 21) {
      temperatureBand = 'mild'; // Mild: 21-23°C  
    } else if (adjustedTemp >= 16) {
      temperatureBand = 'cool'; // Kühl: 16-20°C
    } else if (adjustedTemp >= 11) {
      temperatureBand = 'fresh'; // Frisch: 11-15°C
    } else {
      temperatureBand = 'cold'; // Kalt: ≤ 10°C
    }
    
    console.log(`Temperatur-Band: ${temperatureBand} (${adjustedTemp}°C)`);

    // 3. Regeln pro Band anwenden
    let recommendations: ClothingItem[] = [];
    
    // Basis-Layer (immer Windel)
    const baseLayer = ['Windel'];
    
    // Body-Variante nach Band
    if (['hot', 'warm'].includes(temperatureBand)) {
      baseLayer.push('Kurzarmbody');
    } else {
      baseLayer.push('Langarmbody');
    }
    
    // Bottom-Layer
    const bottomLayer: string[] = [];
    if (temperatureBand === 'hot') {
      bottomLayer.push('Shorts');
    } else if (temperatureBand === 'warm' && adjustedTemp >= 25) {
      bottomLayer.push('Shorts');
    } else {
      bottomLayer.push('Hose');
    }
    
    // Mid-Layer (Pullover)
    const midLayer: string[] = [];
    if (temperatureBand === 'cool') {
      midLayer.push('Dünner Pullover');
    } else if (['fresh', 'cold'].includes(temperatureBand)) {
      midLayer.push('Pullover');
    }
    
    // Outer-Layer (Jacke / Overall)
    const outerLayer: string[] = [];
    if (temperatureBand === 'fresh') {
      outerLayer.push('Jacke');
    } else if (temperatureBand === 'cold') {
      // Spezialfall Autositz - keine dicken Overalls während des Anschnallens
      if (mode === 'carSeat') {
        outerLayer.push('Jacke');
      } else {
        outerLayer.push('Overall');
      }
    }
    
    // Accessoires
    const accessories: string[] = [];
    if (['cool', 'fresh', 'cold'].includes(temperatureBand)) {
      accessories.push('Socken');
    }
    if (['fresh', 'cold'].includes(temperatureBand)) {
      accessories.push('Mütze');
    }
    if (temperatureBand === 'cold') {
      accessories.push('Handschuhe');
    }

    // 4. Kontext-Sonderregeln
    let finalRecommendations: string[] = [];
    let metaWarnings: string[] = [];
    
    // Carrier-Modus: Eine Schicht weniger
    if (mode === 'carrier' && temperatureBand !== 'hot') {
      // Eine wärmere Kategorie verwenden (eine Schicht weniger)
      if (midLayer.length > 0) {
        midLayer.pop(); // Pullover entfernen
      } else if (outerLayer.length > 0) {
        outerLayer.pop(); // Outer-Layer entfernen
      }
      metaWarnings.push("In der Trage wird es wärmer - eine Schicht weniger als normal empfohlen.");
    }
    
    // CarSeat-Modus: Warnung zum Anschnallen
    if (mode === 'carSeat' && temperatureBand === 'cold') {
      metaWarnings.push("Wichtig: Keine dicken Overalls beim Anschnallen. Jacke erst über dem Gurt platzieren.");
    }
    
    // Schlafmodus: Spezifische Logik für TOG-Schlafsäcke
    if (mode === 'sleeping') {
      // Nur Basis-Layer verwenden (Windel + Body)
      finalRecommendations = [...baseLayer];
      
      // TOG-Schlafsack je nach Band hinzufügen
      if (['hot', 'warm'].includes(temperatureBand)) {
        finalRecommendations.push('Schlafsack 0.5 TOG');
      } else if (['mild', 'cool'].includes(temperatureBand)) {
        if (adjustedTemp >= 20) {
          finalRecommendations.push('Schlafsack 1.0 TOG');
        } else {
          finalRecommendations.push('Schlafsack 2.5 TOG');
        }
      } else { // fresh, cold
        finalRecommendations.push('Schlafsack 2.5 TOG');
      }
    } else {
      // Normale Kleidungsempfehlung für Nicht-Schlafmodus
      finalRecommendations = [...baseLayer, ...bottomLayer, ...midLayer, ...outerLayer, ...accessories];
    }
    
    console.log("Empfohlene Teile:", finalRecommendations.join(", "));
    
    // 5. Meta-Tipps & Warnungen
    const cards = [];
    
    // Wetter-Tipp hinzufügen 
    const tipList = weatherTips[temperatureBand];
    const randomTip = tipList ? tipList[Math.floor(Math.random() * tipList.length)] : '';
    setWeatherTip(randomTip);
    
    cards.push({
      title: "Tipp des Tages",
      content: weatherTip,
      icon: "lightbulb.fill" as any
    });
    
    // Warnungen hinzufügen, falls vorhanden
    if (metaWarnings.length > 0) {
      cards.push({
        title: "Wichtiger Hinweis",
        content: metaWarnings[0],
        icon: "exclamationmark.triangle.fill" as any
      });
    }
    
    // Hitze- oder Kältetipps
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
    
    // 6. Empfehlungs-Erstellung - ClothingItems aus dem Katalog filtern
    let clothingItems: ClothingItem[] = [];
    
    // Wandle String-Empfehlungen in ClothingItems um
    for (const category in clothingCatalogue) {
      const categoryItems = clothingCatalogue[category as ClothingCategory];
      
      categoryItems.forEach(item => {
        // Prüfe, ob das Teil in den Empfehlungen ist
        const isRecommended = finalRecommendations.includes(item.name);
        
        if (isRecommended) {
          clothingItems.push({...item, recommended: true});
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

  const renderClothingItem = ({ item }: { item: ClothingItem }) => (
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
      </View>
      <ThemedText style={styles.clothingName}>{item.name}</ThemedText>
    </View>
  );

  // Zusätzliches Rendering für Meta-Cards
  const renderMetaCard = ({ item }: { item: {title: string, content: string, icon: any} }) => (
    <ThemedView style={styles.metaCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
      <View style={styles.metaCardHeader}>
        <IconSymbol name={item.icon} size={22} color={theme.accent} />
        <ThemedText style={styles.metaCardTitle}>{item.title}</ThemedText>
      </View>
      <ThemedText style={styles.metaCardContent}>{item.content}</ThemedText>
    </ThemedView>
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
    case 'dünner pullover':
    case 'pullover':
      return 'person.crop.square.filled.and.at.rectangle.fill';
    case 'jacke':
      return 'person.fill';
    case 'overall':
      return 'person.fill.checkmark';
    case 'mütze':
      return 'crown.fill';
    case 'socken':
      return 'figure.walk';
    case 'handschuhe':
      return 'hand.raised.fill';
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
    case 'dünner pullover':
      return '#98FB98';
    case 'pullover':
      return '#DDA0DD';
    case 'jacke':
      return '#87CEEB';
    case 'overall':
      return '#4682B4';
    case 'mütze':
      return '#FFD700';
    case 'socken':
      return '#FFA07A';
    case 'handschuhe':
      return '#9DD3A8';
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
    padding: 20,
    paddingBottom: 40,
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
  errorContainer: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 14,
    marginLeft: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
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
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clotheslineContainer: {
    marginTop: 20,
    marginBottom: 20,
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
    marginVertical: 15,
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
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
  },
  disclaimer: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 15,
    textAlign: 'center',
    opacity: 0.7,
  },
  noRecommendations: {
    alignItems: 'center',
    padding: 20,
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 25,
    flex: 1,
    marginHorizontal: 2,
  },
  activeLocationButton: {
    backgroundColor: 'rgba(100, 150, 255, 0.2)',
  },
  locationButtonText: {
    marginLeft: 6,
    fontSize: 14,
  },
  activeLocationButtonText: {
    fontWeight: 'bold',
  },
  zipCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  zipCodeInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 10,
    fontSize: 16,
  },
  searchButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  currentLocation: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 5,
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
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
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
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyContextCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Für iOS
    // Für Android wird die Farbe durch lightColor/darkColor gesetzt
  },
  columnWrapper: {
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  metaCardsContainer: {
    marginBottom: 16,
  },
  metaCard: {
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  metaCardContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  contextImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginBottom: 5,
  },
  weatherCard: {
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 130,
    minHeight: 90,
    justifyContent: 'center',
  },
  temperatureValue: {
    fontSize: 38,
    fontWeight: 'bold',
    letterSpacing: -1,
    flexShrink: 0,
    lineHeight: 46,
  },
  feelsLikeValue: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.8,
  },
  weatherIconBox: {
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: 'rgba(100, 150, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherDescriptionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  weatherDescriptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  locationText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  weatherDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weatherDetailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
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
    fontWeight: 'bold',
    color: '#666',
  },
  contextButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contextButtonNew: {
    width: '48%',
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    padding: 12,
    alignItems: 'center',
  },
  selectedContextButtonNew: {
    backgroundColor: 'rgba(166, 205, 237, 0.25)',
  },
  contextImageContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedContextImageContainer: {
    backgroundColor: 'rgba(166, 205, 237, 0.9)',
  },
  contextImageNew: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  contextButtonTextNew: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});