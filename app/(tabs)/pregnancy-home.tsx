import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, Platform, ToastAndroid, Animated, Text, Image, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import CountdownTimer from '@/components/CountdownTimer';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, getDueDateWithLinkedUsers } from '@/lib/supabase';
import { getRecommendations, LottiRecommendation } from '@/lib/supabase/recommendations';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { pregnancyMotherInfo } from '@/constants/PregnancyMotherInfo';
import { pregnancyPartnerInfo } from '@/constants/PregnancyPartnerInfo';
import { pregnancySymptoms } from '@/constants/PregnancySymptoms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// Tägliche Tipps für Schwangere
const dailyTips = [
  "Nimm dir heute 10 Minuten nur für dich – eine kleine Auszeit kann Wunder wirken!",
  "Trinke ausreichend Wasser – besonders wichtig für dich und dein Baby.",
  "Ein kurzer Spaziergang an der frischen Luft kann deine Stimmung heben.",
  "Bitte um Hilfe, wenn du sie brauchst – du musst nicht alles alleine schaffen.",
  "Achte auf gute Ernährung – sie ist die Basis für eine gesunde Schwangerschaft.",
  "Gönn dir ausreichend Schlaf – er ist wichtig für dich und dein Baby.",
  "Stress reduzieren – probiere Entspannungsübungen wie Schwangerschaftsyoga.",
  "Feiere jeden kleinen Fortschritt – dein Körper leistet Großartiges!",
  "Vertraue deinem Instinkt – du weißt, was gut für dich und dein Baby ist.",
  "Verbinde dich mit deinem Baby – sprich mit ihm oder höre gemeinsam Musik."
];

// AsyncStorage-Schlüssel
const LAST_POPUP_DATE_KEY = 'lastDueDatePopup';
const DEBUG_POPUP_COUNTER_KEY = 'debugPopupCounter';

// Definiere Typen für die verknüpften Benutzer
interface LinkedUser {
  firstName: string;
  id: string;
}

// Konstanten für Überfälligkeits-Informationen
const overdueInfo = {
  baby: "Dein Baby ist jetzt vollständig entwickelt. Die Plazenta versorgt es weiterhin mit allen notwendigen Nährstoffen. Die Verbindung zwischen euch beiden ist stärker denn je. Das Immunsystem deines Babys wird durch die Übertragung von Antikörpern über die Plazenta weiter gestärkt.",
  mother: "Viele Frauen empfinden diese Wartezeit als besonders anstrengend. Versuche dich abzulenken und nutze die Zeit für Entspannung. Bewegung kann helfen, den Geburtsprozess anzuregen. Achte auf Anzeichen für Wehen oder den Abgang des Mutterkuchens. Bei Unsicherheiten kontaktiere immer deine Hebamme oder deinen Arzt.",
  partner: "Deine Unterstützung ist jetzt besonders wichtig. Sei geduldig und verständnisvoll. Hilf beim Ablenken und sorge für Aktivitäten, die die Wartezeit verkürzen. Stelle sicher, dass alles für die Fahrt ins Krankenhaus bereit ist und ihr jederzeit los könnt.",
  symptoms: [
    "Harter, tiefer Bauch",
    "Verstärkter Ausfluss",
    "Zunehmender Druck im Becken",
    "Vorwehen (Übungswehen)",
    "Rückenschmerzen",
    "Verstärkte Müdigkeit",
    "Emotionale Anspannung"
  ]
};

export default function PregnancyHomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();
  const DEFAULT_OVERVIEW_HEIGHT = 230;

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [dailyTip, setDailyTip] = useState('');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [debugCounter, setDebugCounter] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewCarouselWidth, setOverviewCarouselWidth] = useState(0);
  const [overviewIndex, setOverviewIndex] = useState(0);
  const [overviewSummaryHeight, setOverviewSummaryHeight] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<LottiRecommendation[]>([]);
  const [recommendationImageFailed, setRecommendationImageFailed] = useState(false);

  // Animation für Erfolgsmeldung
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const androidBlurProps =
    Platform.OS === 'android'
      ? { experimentalBlurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
      : {};

  const featuredRecommendation = recommendations[0] ?? null;

  const getPreviewText = (value?: string | null, limit = 10) => {
    if (!value) return '';
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length <= limit) return value.trim();
    return `${words.slice(0, limit).join(' ')}...`;
  };

  useEffect(() => {
    if (featuredRecommendation?.image_url) {
      Image.prefetch(featuredRecommendation.image_url).catch(() => {});
    }
  }, [featuredRecommendation?.image_url]);

  useEffect(() => {
    setRecommendationImageFailed(false);
  }, [featuredRecommendation?.id, featuredRecommendation?.image_url]);

  useEffect(() => {
    if (user) {
      loadUserData();
      const randomTip = dailyTips[Math.floor(Math.random() * dailyTips.length)];
      setDailyTip(randomTip);
    }
  }, [user]);

  // Hilfsfunktion zur Protokollierung mit Zeitstempel
  const logWithTimestamp = (message: string) => {
    const now = new Date();
    console.log(`[${now.toLocaleTimeString()}] ${message}`);
  };

  // Debug-Funktion: Popup-Zähler erhöhen
  const incrementDebugCounter = async () => {
    try {
      const currentCountStr = await AsyncStorage.getItem(DEBUG_POPUP_COUNTER_KEY) || '0';
      const currentCount = parseInt(currentCountStr, 10);
      const newCount = currentCount + 1;
      await AsyncStorage.setItem(DEBUG_POPUP_COUNTER_KEY, newCount.toString());
      setDebugCounter(newCount);
      logWithTimestamp(`Popup-Zähler erhöht auf: ${newCount}`);
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Debug-Zählers:', error);
    }
  };

  // Debug-Funktion: AsyncStorage-Key löschen
  const clearLastPopupDate = async () => {
    try {
      await AsyncStorage.removeItem(LAST_POPUP_DATE_KEY);
      logWithTimestamp('Letztes Popup-Datum zurückgesetzt');
    } catch (error) {
      console.error('Fehler beim Zurücksetzen des letzten Popup-Datums:', error);
    }
  };

  // Debug: Zeige den aktuellen Status beim Laden an
  useEffect(() => {
    const loadDebugInfo = async () => {
      try {
        const countStr = await AsyncStorage.getItem(DEBUG_POPUP_COUNTER_KEY) || '0';
        setDebugCounter(parseInt(countStr, 10));
        
        const lastPopupDateStr = await AsyncStorage.getItem(LAST_POPUP_DATE_KEY);
        logWithTimestamp(`DEBUG INFO - Popup-Zähler: ${countStr}, Letztes Popup: ${lastPopupDateStr || 'nie'}`);
      } catch (error) {
        console.error('Fehler beim Laden der Debug-Informationen:', error);
      }
    };
    
    loadDebugInfo();
  }, []);

  // Debug-Funktion: Manuelles Anzeigen des Popups für Testzwecke
  const debugShowPopup = () => {
    showPastDueDateAlert();
  };

  // Überprüfen, ob das Fälligkeitsdatum überschritten ist und ggf. Popup anzeigen
  useEffect(() => {
    const checkPastDueDate = async () => {
      logWithTimestamp('Überprüfe, ob Entbindungstermin überschritten wurde...');
      
      if (!dueDate) {
        logWithTimestamp('Kein Entbindungstermin festgelegt');
        return;
      }
      
      if (!user) {
        logWithTimestamp('Kein Benutzer angemeldet');
        return;
      }
      
      if (isBabyBorn) {
        logWithTimestamp('Baby ist bereits geboren');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dueDateCopy = new Date(dueDate);
      dueDateCopy.setHours(0, 0, 0, 0);

      logWithTimestamp(`Heutiges Datum: ${today.toLocaleDateString()}`);
      logWithTimestamp(`Entbindungstermin: ${dueDateCopy.toLocaleDateString()}`);

      // Prüfen, ob der Entbindungstermin überschritten ist oder heute ist
      if (today.getTime() >= dueDateCopy.getTime()) {
        logWithTimestamp('Entbindungstermin ist heute oder wurde überschritten');

        // Prüfen, wann das letzte Popup gezeigt wurde
        const lastPopupDateStr = await AsyncStorage.getItem(LAST_POPUP_DATE_KEY);
        logWithTimestamp(`Letztes Popup-Datum: ${lastPopupDateStr || 'nie'}`);
        
        if (!lastPopupDateStr || new Date(lastPopupDateStr).toDateString() !== today.toDateString()) {
          logWithTimestamp('Zeige Popup an');
          
          // Speichern des heutigen Datums als letztes Popup-Datum
          await AsyncStorage.setItem(LAST_POPUP_DATE_KEY, today.toISOString());
          incrementDebugCounter();
          
          // Popup anzeigen
          showPastDueDateAlert();
        } else {
          logWithTimestamp('Popup wurde heute bereits angezeigt');
        }
      } else {
        logWithTimestamp('Entbindungstermin liegt in der Zukunft');
      }
    };

    // Verzögerung hinzufügen, um sicherzustellen, dass alles initialisiert ist
    const timer = setTimeout(() => {
      checkPastDueDate();
    }, 1000);

    return () => clearTimeout(timer);
  }, [dueDate, user, isBabyBorn]);

  const showPastDueDateAlert = () => {
    Alert.alert(
      "Entbindungstermin überschritten",
      "Dein Entbindungstermin ist bereits überschritten. Ist dein Baby schon geboren?",
      [
        {
          text: "Noch nicht geboren",
          style: "cancel"
        },
        {
          text: "Ja, mein Baby ist da!",
          onPress: handleBabyBorn
        }
      ]
    );
  };

  const getLinkedUsers = async (userId: string) => {
    try {
      const result = await getDueDateWithLinkedUsers(userId);
      return {
        success: result.success,
        linkedUsers: result.linkedUsers || [],
        error: result.error
      };
    } catch (error) {
      console.error('Error getting linked users:', error);
      return { success: false, linkedUsers: [], error };
    }
  };

  const handleBabyBorn = async () => {
    try {
      // Setzen des Baby-Status auf 'geboren'
      await setIsBabyBorn(true);

      // Prüfen, ob der Benutzer mit anderen Benutzern verknüpft ist
      const linkedUsersResult = await getLinkedUsers(user?.id || '');
      let syncMessage = '';

      if (linkedUsersResult.success && linkedUsersResult.linkedUsers && linkedUsersResult.linkedUsers.length > 0) {
        const linkedUserNames = linkedUsersResult.linkedUsers
          .map((user: LinkedUser) => user.firstName)
          .join(', ');

        syncMessage = `\n\nDiese Information wurde auch mit ${linkedUserNames} geteilt.`;
      }

      // Erfolgsmeldung anzeigen
      Alert.alert(
        "Herzlichen Glückwunsch!",
        `Wir freuen uns mit dir über die Geburt deines Babys! 🎉${syncMessage}`,
        [
          {
            text: "OK",
            onPress: () => {
              // Navigation zum Baby-Dashboard
              router.replace('/(tabs)/baby');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Fehler beim Setzen des Baby-Status:', error);
      Alert.alert('Fehler', 'Es gab ein Problem bei der Aktualisierung des Status.');
    }
  };

  // Lädt Benutzerinformationen und aktualisiert die Anzeige
  const loadUserData = async () => {
    try {
      setIsLoading(true);

      // Benutzername laden
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, avatar_url')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;
      if (profileData) {
        setUserName(profileData.first_name || '');
      }
      setProfileAvatarUrl(profileData?.avatar_url || null);

      // Entbindungstermin laden
      const result = await getDueDateWithLinkedUsers(user?.id || '');

      if (result.success && result.dueDate) {
        const due = new Date(result.dueDate);
        setDueDate(due);

        // Berechne die aktuelle SSW
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Kopie des Entbindungstermins ohne Uhrzeit
        const dueDateCopy = new Date(due);
        dueDateCopy.setHours(0, 0, 0, 0);

        // Berechne die Differenz in Tagen
        const difference = dueDateCopy.getTime() - now.getTime();
        const daysLeft = Math.round(difference / (1000 * 60 * 60 * 24));

        // Schwangerschaft dauert ca. 40 Wochen = 280 Tage
        const totalDaysInPregnancy = 280;
        const daysRemaining = Math.max(0, daysLeft);
        const daysPregnant = totalDaysInPregnancy - daysRemaining;

        // Berechne SSW und Tag
        const weeksPregnant = Math.floor(daysPregnant / 7);
        const daysInCurrentWeek = daysPregnant % 7;

        // currentWeek ist die aktuelle Schwangerschaftswoche (1-basiert)
        const currentWeek = weeksPregnant + 1;

        setCurrentWeek(currentWeek);
        setCurrentDay(daysInCurrentWeek);
      } else {
        setDueDate(null);
        setCurrentWeek(null);
        setCurrentDay(null);
      }

      try {
        const recommendationData = await getRecommendations();
        setRecommendations(recommendationData);
      } catch (error) {
        console.error('Error loading recommendations:', error);
      }

    } catch (error) {
      console.error('Fehler beim Laden der Benutzerdaten:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Zeigt eine Erfolgsmeldung an, die nach einigen Sekunden ausblendet
  const showUpdateSuccess = () => {
    setUpdateSuccess(true);
    
    // Animation starten
    Animated.sequence([
      // Einblenden
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Warten
      Animated.delay(2000),
      // Ausblenden
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setUpdateSuccess(false);
    });
  };

  // Funktion zum Aktualisieren der Daten (Pull-to-Refresh)
  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      await loadUserData();
      const randomTip = dailyTips[Math.floor(Math.random() * dailyTips.length)];
      setDailyTip(randomTip);
      
      // Plattformspezifisches Feedback
      if (Platform.OS === 'android') {
        ToastAndroid.show('Daten aktualisiert', ToastAndroid.SHORT);
      } else {
        // iOS-Feedback (wird durch Animation angezeigt)
        showUpdateSuccess();
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('de-DE', options);
  };

  const handleFocusRecommendation = (recommendationId?: string | null) => {
    if (!recommendationId) {
      router.push('/lottis-empfehlungen');
      return;
    }
    router.push({
      pathname: '/lottis-empfehlungen',
      params: { focusId: recommendationId },
    });
  };

  const handleRecommendationImageError = () => {
    setRecommendationImageFailed(true);
  };

  const renderPregnancyOverviewCard = (wrapperStyle?: StyleProp<ViewStyle>) => (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/countdown')}
      activeOpacity={0.9}
      style={[styles.liquidGlassWrapper, wrapperStyle]}
      onLayout={(event) => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextHeight && nextHeight !== overviewSummaryHeight) {
          setOverviewSummaryHeight(nextHeight);
        }
      }}
    >
      <BlurView
        intensity={22}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        style={styles.liquidGlassBackground}
      >
        <ThemedView
          style={[styles.summaryContainer, styles.liquidGlassContainer]}
          lightColor="rgba(255, 255, 255, 0.04)"
          darkColor="rgba(255, 255, 255, 0.02)"
        >
          <View style={styles.sectionTitleContainer}>
            <ThemedText style={[styles.sectionTitle, { color: '#7D5A50', fontSize: 22 }]}>
              Dein Tag im Überblick
            </ThemedText>
            <View style={styles.liquidGlassChevron}>
              <IconSymbol name="chevron.right" size={20} color="#7D5A50" />
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={[styles.statItem, styles.liquidGlassStatItem, {
              backgroundColor: 'rgba(94, 61, 179, 0.13)',
              borderColor: 'rgba(94, 61, 179, 0.35)'
            }]}>
              <View style={styles.liquidGlassStatIcon}>
                <Text style={styles.statEmoji}>📅</Text>
              </View>
              <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, {
                color: '#5E3DB3',
                textShadowColor: 'rgba(255, 255, 255, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }]}>{currentWeek || 0}</ThemedText>
              <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>SSW</ThemedText>
            </View>

            <View style={[styles.statItem, styles.liquidGlassStatItem, {
              backgroundColor: 'rgba(94, 61, 179, 0.08)',
              borderColor: 'rgba(94, 61, 179, 0.22)'
            }]}>
              <View style={styles.liquidGlassStatIcon}>
                <Text style={styles.statEmoji}>🔢</Text>
              </View>
              <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, {
                color: '#5E3DB3',
                textShadowColor: 'rgba(255, 255, 255, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }]}>
                {currentWeek && currentWeek <= 13
                  ? "1"
                  : currentWeek && currentWeek <= 26
                    ? "2"
                    : "3"}
              </ThemedText>
              <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>Trimester</ThemedText>
            </View>

            <View style={[styles.statItem, styles.liquidGlassStatItem, {
              backgroundColor: 'rgba(94, 61, 179, 0.05)',
              borderColor: 'rgba(94, 61, 179, 0.15)'
            }]}>
              <View style={styles.liquidGlassStatIcon}>
                <Text style={styles.statEmoji}>📊</Text>
              </View>
              <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, {
                color: '#5E3DB3',
                textShadowColor: 'rgba(255, 255, 255, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }]}>
                {currentWeek
                  ? Math.min(100, Math.round((currentWeek / 40) * 100))
                  : 0}%
              </ThemedText>
              <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>Fortschritt</ThemedText>
            </View>
          </View>
        </ThemedView>
      </BlurView>
    </TouchableOpacity>
  );

  const renderRecommendationCard = (wrapperStyle?: StyleProp<ViewStyle>) => {
    const cardHeightStyle = { height: overviewSummaryHeight ?? DEFAULT_OVERVIEW_HEIGHT };
    const showRecommendationImage = Boolean(featuredRecommendation?.image_url) && !recommendationImageFailed;
    const buttonLabel = 'Mehr';

    return (
      <View style={[styles.liquidGlassWrapper, wrapperStyle, cardHeightStyle]}>
        <BlurView
          intensity={22}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[styles.liquidGlassBackground, cardHeightStyle]}
        >
          <ThemedView
            style={[styles.liquidGlassContainer, styles.recommendationContainer, cardHeightStyle]}
            lightColor="rgba(255, 255, 255, 0.04)"
            darkColor="rgba(255, 255, 255, 0.02)"
          >
            {featuredRecommendation ? (
              <View style={styles.recommendationCard}>
                <View style={styles.sectionTitleContainer}>
                  <ThemedText style={[styles.sectionTitle, styles.liquidGlassText, { color: '#6B4C3B', fontSize: 22 }]}>
                    Lottis Empfehlungen
                  </ThemedText>
                  <View style={[styles.liquidGlassChevron, styles.recommendationHeaderSpacer]} />
                </View>
                <TouchableOpacity
                  style={styles.recommendationInnerCard}
                  onPress={() => handleFocusRecommendation(featuredRecommendation.id)}
                  activeOpacity={0.9}
                >
                  <View style={styles.recommendationRow}>
                    <View style={styles.recommendationImagePane}>
                      {showRecommendationImage ? (
                        <Image
                          source={{ uri: featuredRecommendation.image_url ?? '' }}
                          style={styles.recommendationImage}
                          onError={handleRecommendationImageError}
                        />
                      ) : (
                        <View style={styles.recommendationImageFallback}>
                          <IconSymbol name="bag.fill" size={22} color="#6B4C3B" />
                        </View>
                      )}
                    </View>
                    <View style={styles.recommendationContentPane}>
                      <View style={styles.recommendationTextWrap}>
                        <ThemedText style={styles.recommendationTitle}>
                          {featuredRecommendation.title}
                        </ThemedText>
                        <ThemedText style={styles.recommendationDescription}>
                          {getPreviewText(featuredRecommendation.description, 10)}
                        </ThemedText>
                      </View>
                      <View style={styles.recommendationButton}>
                        <ThemedText style={styles.recommendationButtonText} numberOfLines={1}>
                          {buttonLabel}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.recommendationEmptyWrapper}>
                <View style={styles.sectionTitleContainer}>
                  <ThemedText style={[styles.sectionTitle, styles.liquidGlassText, { color: '#6B4C3B', fontSize: 22 }]}>
                    Lottis Empfehlungen
                  </ThemedText>
                  <View style={[styles.liquidGlassChevron, styles.recommendationHeaderSpacer]} />
                </View>
                <View style={styles.recommendationEmpty}>
                  <IconSymbol name="bag.fill" size={20} color="#7D5A50" />
                  <ThemedText style={styles.recommendationEmptyText}>
                    Noch keine Empfehlungen verfügbar.
                  </ThemedText>
                </View>
              </View>
            )}
          </ThemedView>
        </BlurView>
      </View>
    );
  };

  const renderOverviewSection = () => (
    <View
      style={styles.overviewCarouselWrapper}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth && nextWidth !== overviewCarouselWidth) {
          setOverviewCarouselWidth(nextWidth);
        }
      }}
    >
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.overviewCarousel}
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => {
          if (!overviewCarouselWidth) return;
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / overviewCarouselWidth);
          setOverviewIndex(nextIndex);
        }}
        scrollEventThrottle={16}
      >
        {[renderPregnancyOverviewCard(styles.carouselCardWrapper), renderRecommendationCard(styles.carouselCardWrapper)].map(
          (slide, index) => (
            <View
              key={`overview-slide-${index}`}
              style={[
                styles.overviewSlide,
                overviewCarouselWidth ? { width: overviewCarouselWidth } : null,
              ]}
            >
              {slide}
            </View>
          )
        )}
      </ScrollView>
      <View style={styles.carouselDots}>
        {[0, 1].map((index) => (
          <View
            key={`overview-dot-${index}`}
            style={[
              styles.carouselDot,
              overviewIndex === index && styles.carouselDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        
        {/* Erfolgs-Animation für iOS */}
        {updateSuccess && (
          <Animated.View style={[styles.updateSuccessContainer, { opacity: fadeAnim }]}>
            <View style={styles.updateSuccessContent}>
              <IconSymbol name="checkmark.circle.fill" size={32} color="#7D5A50" />
              <ThemedText style={styles.updateSuccessText}>
                Daten aktualisiert
              </ThemedText>
            </View>
          </Animated.View>
        )}
        
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#7D5A50']} // Farbe für Android
              tintColor={colorScheme === 'dark' ? '#F8F0E5' : '#7D5A50'} // Farbe für iOS
              title={refreshing ? "Aktualisiere..." : "Zum Aktualisieren ziehen"} // Nur auf iOS sichtbar
              titleColor={colorScheme === 'dark' ? '#F8F0E5' : '#7D5A50'} // Farbe für den Text auf iOS
            />
          }
        >
          {/* Begrüßung - Liquid Glass Design */}
          <View style={[styles.liquidGlassWrapper, styles.greetingCardWrapper]}>
            <BlurView
              {...androidBlurProps}
              intensity={22}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
              style={[styles.liquidGlassBackground, styles.greetingGlassBackground]}
            >
              <ThemedView
                style={[styles.greetingContainer, styles.liquidGlassContainer, styles.greetingGlassContainer]}
                lightColor="rgba(255, 255, 255, 0.04)"
                darkColor="rgba(255, 255, 255, 0.02)"
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0)']}
                  locations={[0, 0.45, 1]}
                  start={{ x: 0.15, y: 0.0 }}
                  end={{ x: 0.85, y: 1.0 }}
                  style={styles.greetingGloss}
                />

                <View style={styles.greetingHeader}>
                  <View>
                    <ThemedText style={[styles.greeting, styles.liquidGlassText, { color: '#6B4C3B' }]}>
                      Hallo {userName || 'Mama'}!
                    </ThemedText>
                    <ThemedText style={[styles.dateText, styles.liquidGlassSecondaryText, { color: '#6B4C3B' }]}>
                      {formatDate()}
                    </ThemedText>
                  </View>

                  <View style={styles.profileBadge}>
                    {profileAvatarUrl ? (
                      <View style={styles.profileImageWrapper}>
                        <Image source={{ uri: profileAvatarUrl }} style={styles.profileImage} />
                      </View>
                    ) : (
                      <View style={styles.profilePlaceholder}>
                        <IconSymbol name="person.fill" size={30} color="#FFFFFF" />
                      </View>
                    )}
                    <View style={styles.profileStatusDot} />
                  </View>
                </View>

                <View style={styles.tipCard}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.1)']}
                    locations={[0, 1]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.tipGloss}
                  />
                  <View style={styles.tipCardRow}>
                    <View style={styles.tipIconWrap}>
                      <IconSymbol name="lightbulb.fill" size={18} color="#D6B28C" />
                    </View>
                    <View style={styles.tipContent}>
                      <ThemedText style={styles.tipLabel}>Tipp des Tages</ThemedText>
                      <ThemedText style={styles.tipText}>{dailyTip}</ThemedText>
                    </View>
                  </View>
                </View>
              </ThemedView>
            </BlurView>
          </View>

          {/* Debug-Panel (nur im Entwicklungsmodus sichtbar) */}
          {__DEV__ && (
            <ThemedView style={styles.debugCard} lightColor="#ffefdb" darkColor="#453531">
              <ThemedText style={styles.debugTitle} lightColor="#8b4513" darkColor="#f5deb3">
                Debug Info
              </ThemedText>
              <View style={{ marginBottom: 10 }}>
                <ThemedText style={styles.debugText} lightColor="#333" darkColor="#f0f0f0">
                  Popup-Zähler: {debugCounter}
                </ThemedText>
              </View>
              <View style={styles.debugButtonRow}>
                <TouchableOpacity 
                  style={[styles.debugButton, { backgroundColor: '#4caf50' }]} 
                  onPress={debugShowPopup}
                >
                  <ThemedText style={styles.debugButtonText} lightColor="#fff" darkColor="#fff">
                    Test Popup
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.debugButton, { backgroundColor: '#f44336' }]} 
                  onPress={clearLastPopupDate}
                >
                  <ThemedText style={styles.debugButtonText} lightColor="#fff" darkColor="#fff">
                    Reset Timer
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}

          {renderOverviewSection()}

          {/* Schnellzugriff-Cards - Liquid Glass Design */}
          <View style={styles.cardsSection}>
            <ThemedText style={[styles.cardsSectionTitle, { color: '#7D5A50', fontSize: 22 }]}>
              Schnellzugriff
            </ThemedText>

            <View style={styles.cardsGrid}>
              <TouchableOpacity
                style={styles.liquidGlassCardWrapper}
                onPress={() => router.push({ pathname: '/(tabs)/countdown' })}
                activeOpacity={0.9}
              >
                <BlurView 
                  intensity={24} 
                  tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                  style={styles.liquidGlassCardBackground}
                >
                  <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 196, 193, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                      <IconSymbol name="calendar" size={28} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Countdown</ThemedText>
                    <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Dein Weg zur Geburt</ThemedText>
                  </View>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liquidGlassCardWrapper}
                onPress={() => router.push({ pathname: '/(tabs)' })}
                activeOpacity={0.9}
              >
                <BlurView 
                  intensity={24} 
                  tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                  style={styles.liquidGlassCardBackground}
                >
                  <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                      <IconSymbol name="timer" size={28} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Wehen-Tracker</ThemedText>
                    <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Wehen messen und verfolgen</ThemedText>
                  </View>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liquidGlassCardWrapper}
                onPress={() => router.push({ pathname: '/(tabs)/explore' })}
                activeOpacity={0.9}
              >
                <BlurView 
                  intensity={24} 
                  tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                  style={styles.liquidGlassCardBackground}
                >
                  <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(200, 130, 220, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                      <IconSymbol name="checklist" size={28} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Checkliste</ThemedText>
                    <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Kliniktasche vorbereiten</ThemedText>
                  </View>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liquidGlassCardWrapper}
                onPress={() => router.push({ pathname: '/(tabs)/geburtsplan' })}
                activeOpacity={0.9}
              >
                <BlurView 
                  intensity={24} 
                  tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                  style={styles.liquidGlassCardBackground}
                >
                  <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 215, 180, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 180, 130, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                      <IconSymbol name="doc.text.fill" size={28} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Geburtsplan</ThemedText>
                    <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Wünsche für die Geburt</ThemedText>
                  </View>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liquidGlassCardWrapper}
                onPress={() => router.push('/doctor-questions' as any)}
                activeOpacity={0.9}
              >
                <BlurView 
                  intensity={24} 
                  tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                  style={styles.liquidGlassCardBackground}
                >
                  <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 210, 230, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 160, 180, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                      <IconSymbol name="questionmark.circle" size={28} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Meine Fragen</ThemedText>
                    <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Fragen für den nächsten Termin</ThemedText>
                  </View>
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liquidGlassCardWrapper}
                onPress={() => router.push('/baby-names' as any)}
                activeOpacity={0.9}
              >
                <BlurView 
                  intensity={24} 
                  tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                  style={styles.liquidGlassCardBackground}
                >
                  <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(200, 225, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(140, 190, 255, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                      <IconSymbol name="person.text.rectangle" size={28} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Babynamen</ThemedText>
                    <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Finde den perfekten Namen</ThemedText>
                  </View>
                </BlurView>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f5eee0', // Beige Hintergrund wie im Bild
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  // Overview Carousel
  overviewCarouselWrapper: {
    marginBottom: 16,
  },
  overviewCarousel: {
    width: '100%',
  },
  overviewSlide: {
    width: '100%',
  },
  carouselCardWrapper: {
    marginBottom: 0,
    width: '100%',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(107, 76, 59, 0.25)',
    marginHorizontal: 4,
  },
  carouselDotActive: {
    backgroundColor: '#6B4C3B',
  },

  // Recommendation Card
  recommendationContainer: {
    flex: 1,
    padding: 18,
  },
  recommendationCard: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
  },
  recommendationInnerCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  recommendationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recommendationImagePane: {
    width: '40%',
    maxWidth: 120,
    maxHeight: 120,
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  recommendationImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  recommendationImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recommendationContentPane: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    paddingVertical: 4,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  recommendationTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B4C3B',
    marginBottom: 4,
    letterSpacing: 0.2,
    flexWrap: 'wrap',
  },
  recommendationDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(125, 90, 80, 0.88)',
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  recommendationButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#5E3DB3',
    borderWidth: 1,
    borderColor: 'rgba(94, 61, 179, 0.7)',
  },
  recommendationButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recommendationEmptyWrapper: {
    flex: 1,
  },
  recommendationHeaderSpacer: {
    opacity: 0,
  },
  recommendationEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  recommendationEmptyText: {
    fontSize: 13,
    color: '#7D5A50',
    marginTop: 8,
    textAlign: 'center',
  },

  // Liquid Glass styles - Core Components
  liquidGlassWrapper: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassBackground: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.35)', // stärkerer Frostglas-Effekt
  },
  liquidGlassContainer: {
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  greetingCardWrapper: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  greetingGlassBackground: {
    borderRadius: 30,
  },
  greetingGlassContainer: {
    borderRadius: 30,
  },
  greetingContainer: {
    paddingTop: 26,
    paddingHorizontal: 24,
    paddingBottom: 22,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  dateText: {
    fontSize: 14,
    opacity: 0.8,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  profileBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileImageWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
  },
  profilePlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(125, 90, 80, 0.65)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileStatusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5E3DB3',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  greetingGloss: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
  },

  // Tip Container
  tipCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    padding: 14,
    overflow: 'hidden',
  },
  tipGloss: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  tipCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D6B28C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5E3DB3',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    color: '#6B4C3B',
  },
  liquidGlassText: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
  },
  liquidGlassSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  countdownContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  weeklyInfoContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#7D5A50',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 32,
  },
  symptomsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  symptomsList: {
    paddingLeft: 8,
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  symptomText: {
    fontSize: 14,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#7D5A50',
  },
  cardsSection: {
    marginBottom: 16,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    height: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#7D5A50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7D5A50',
    textAlign: 'center',
  },
  debugCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 14,
    marginBottom: 10,
  },
  debugButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  debugButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  updateSuccessContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingTop: 60,
  },
  updateSuccessContent: {
    backgroundColor: 'rgba(248, 240, 229, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 6,
  },
  updateSuccessText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7D5A50',
    marginLeft: 10,
  },
  overdueContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  overdueTitle: {
    color: '#E57373',
  },
  overdueInfoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  overdueInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overdueInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E57373',
    marginLeft: 8,
  },
  overdueInfoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  overdueButton: {
    backgroundColor: '#E57373',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  overdueButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  summaryContainer: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.9,
  },
  postPregnancyContainer: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  postPregnancyContent: {
    alignItems: 'center',
  },
  postPregnancyImageContainer: {
    marginBottom: 15,
  },
  postPregnancyDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 15,
  },
  postPregnancyFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  postPregnancyFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  liquidGlassFeatureItem: {
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureText: {
    fontSize: 12,
    marginLeft: 8,
    color: '#7D5A50',
    fontWeight: '500',
  },

  // Stats with Liquid Glass Enhancement
  liquidGlassStatItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    minHeight: 66,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liquidGlassStatIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 32,
    padding: 14,
    marginBottom: 6,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  statEmoji: {
    fontSize: 32,
    lineHeight: 34,
    textAlign: 'center',
  },
  liquidGlassStatValue: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: 2,
    marginBottom: 2,
    lineHeight: 26,
  },
  liquidGlassStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  liquidGlassChevron: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  // Quick Access Cards Section
  cardsSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  // Liquid Glass Cards
  liquidGlassCardWrapper: {
    width: '48%',
    marginBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassCardBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassCard: {
    backgroundColor: 'transparent',
  },
  liquidGlassCardTitle: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  liquidGlassCardDescription: {
    color: 'rgba(85, 60, 55, 0.7)',
    fontWeight: '500',
  },
});
