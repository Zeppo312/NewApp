/**
 * Vollbild-Sperre für Features, die im aktuellen Abo-Tier nicht enthalten
 * sind. Zeigt Benefit-Copy aus LOCKED_FEATURE_COPY und führt zur Paywall
 * (mit origin-Parameter, damit sich später messen lässt, welcher Lock
 * konvertiert).
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  LOCKED_FEATURE_COPY,
  type AppFeature,
} from '@/lib/entitlements';
import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

const FAMILY_FEATURE_PREVIEWS = {
  de: {
    shoppingList: {
      title: 'Weniger im Kopf.\nMehr im Körbchen.',
      caption: 'Zusammen planen. Entspannt einkaufen.',
      subtitle: 'Windeln, Obst und alles dazwischen: Teilt eure Einkaufsliste und habt eure Kundenkarten gleich dabei.',
      bullets: ['Eine gemeinsame Liste für euch beide', 'Änderungen in Echtzeit sehen', 'Kundenkarten an einem Ort griffbereit'],
    },
    planner: {
      title: 'Weniger organisieren.\nMehr Familie.',
      caption: 'Eure Termine. Euer gemeinsamer Überblick.',
      subtitle: 'Vom Kinderarzt bis zur Familienzeit: Plant euren Alltag gemeinsam und lasst Lotti an wichtige Termine erinnern.',
      bullets: ['Alle Familientermine in einem Kalender', 'Erinnerungen an wichtige Termine', 'Mit deinem Partner synchron bleiben'],
    },
  },
  en: {
    shoppingList: {
      title: 'Less to remember.\nMore in your basket.',
      caption: 'Plan together. Shop with ease.',
      subtitle: 'Nappies, fruit and everything in between: share your shopping list and keep your loyalty cards close at hand.',
      bullets: ['One shared list for both of you', 'See changes in real time', 'Keep loyalty cards together in one place'],
    },
    planner: {
      title: 'Less organising.\nMore family time.',
      caption: 'Your plans. One shared view.',
      subtitle: 'From check-ups to family time: plan your days together and let Lotti remind you of important appointments.',
      bullets: ['All family appointments in one calendar', 'Reminders for important appointments', 'Stay in sync with your partner'],
    },
  },
  es: {
    shoppingList: {
      title: 'Menos que recordar.\nMás en la cesta.',
      caption: 'Planificar juntos. Comprar con calma.',
      subtitle: 'Pañales, fruta y todo lo demás: compartid vuestra lista de compras y tened las tarjetas de fidelización a mano.',
      bullets: ['Una lista compartida para los dos', 'Cambios visibles en tiempo real', 'Tarjetas de fidelización en un solo lugar'],
    },
    planner: {
      title: 'Menos organizar.\nMás tiempo en familia.',
      caption: 'Vuestros planes. Una vista compartida.',
      subtitle: 'Del pediatra al tiempo en familia: organizad juntos vuestro día y dejad que Lotti os recuerde las citas importantes.',
      bullets: ['Todas las citas familiares en un calendario', 'Recordatorios de citas importantes', 'Siempre en sintonía con tu pareja'],
    },
  },
} as const;

/** Decorative artwork; the feature benefits provide the accessible description. */
function FamilyFeatureIllustration({ feature }: { feature: 'shoppingList' | 'planner' }) {
  return (
    <Svg width={240} height={130} viewBox="0 0 240 130">
      <Circle cx="120" cy="65" r="59" fill="#FFE1BE" opacity={0.14} />
      <Ellipse cx="122" cy="115" rx="70" ry="7" fill="#21192F" opacity={0.12} />
      {feature === 'shoppingList' ? (
        <>
          <Rect x="143" y="25" width="49" height="72" rx="9" fill="#FFF1DD" transform="rotate(10 167 61)" />
          <Path d="M154 43L157 46L163 39M152 58L155 61L161 54M150 73L153 76L159 69" fill="none" stroke="#7D9C78" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M169 44L181 46M167 59L179 61M165 74L177 76" stroke="#D5B28C" strokeWidth="3" strokeLinecap="round" />
          <Rect x="72" y="21" width="22" height="67" rx="11" fill="#E8BD83" transform="rotate(-16 83 55)" />
          <Path d="M75 34L86 31M79 45L90 42M82 56L93 53" stroke="#FFF1DD" strokeWidth="3" strokeLinecap="round" />
          <Path d="M124 64Q98 40 110 31Q127 31 129 58Q127 30 141 28Q155 41 134 64" fill="#8CA982" />
          <Circle cx="111" cy="66" r="17" fill="#ECAA91" />
          <Path d="M57 65L68 105Q70 113 79 113H137Q146 113 148 105L160 65Z" fill="#EFB5A5" />
          <Rect x="53" y="61" width="111" height="12" rx="6" fill="#FFD6BF" />
          <Path d="M79 62Q83 36 108 36Q133 36 139 62" fill="none" stroke="#FFD6BF" strokeWidth="7" strokeLinecap="round" />
          <Path d="M82 82L87 100M107 82V100M132 82L127 100" stroke="#FFF1DD" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Rect x="58" y="23" width="117" height="88" rx="13" fill="#FFF1DD" />
          <Path d="M71 23H162Q175 23 175 36V48H58V36Q58 23 71 23" fill="#EFB5A5" />
          <Path d="M83 18V31M150 18V31" stroke="#D5B28C" strokeWidth="7" strokeLinecap="round" />
          <Rect x="73" y="59" width="18" height="15" rx="4" fill="#E6D6EB" />
          <Rect x="103" y="59" width="18" height="15" rx="4" fill="#DFE8D8" />
          <Rect x="133" y="59" width="18" height="15" rx="4" fill="#F8D9B2" />
          <Rect x="73" y="83" width="18" height="15" rx="4" fill="#F8D9B2" />
          <Rect x="103" y="83" width="18" height="15" rx="4" fill="#EFB5A5" />
          <Path d="M108 90L111 93L117 87" fill="none" stroke="#FFF8ED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="167" cy="94" r="23" fill="#8CA982" />
          <Path d="M156 94L164 102L179 86" fill="none" stroke="#FFF1DD" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      <Path d="M36 45L39 36L42 45L51 48L42 51L39 60L36 51L27 48Z" fill="#FFD7A6" />
      <Circle cx="200" cy="53" r="3" fill="#D0BDD9" />
      <Circle cx="47" cy="94" r="3" fill="#FFD7A6" />
    </Svg>
  );
}

type LockedFeatureScreenProps = {
  feature: AppFeature;
  /** Header-Titel; Standard ist der Feature-Titel aus der Copy. */
  headerTitle?: string;
  headerSubtitle?: string;
};

export function LockedFeatureScreen({
  feature,
  headerTitle,
  headerSubtitle,
}: LockedFeatureScreenProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const tileProps = useMemo(
    () =>
      isDark
        ? {
            tint: 'dark' as const,
            intensity: 38,
            frostColor: 'rgba(18,15,24,0.78)',
            toneColor: 'rgba(72,51,101,0.16)',
            borderColor: 'rgba(255,255,255,0.17)',
            innerBorderColor: 'rgba(255,255,255,0.07)',
            highlightStrength: 'subtle' as const,
            highlightOpacity: 0.34,
            glossOpacity: 0.09,
            grainOpacity: 0.025,
            shadeOpacity: 0.75,
          }
        : {},
    [isDark],
  );
  const defaultCopy = LOCKED_FEATURE_COPY[feature];
  const translated = {
    en: {
      recipes: { title: 'Recipes & first foods', subtitle: 'Fresh ideas for your baby’s first bites, favourite recipes in one place, and a video course to guide you.', bullets: ['Discover age-appropriate recipe ideas', 'Save your own family favourites', 'Explore first foods with the video course'] },
      partnerLink: { title: 'Together as a family', subtitle: 'Link your account with your partner so you can both see and track the same baby.', bullets: ['Entries appear for both of you immediately', 'Both of you can see the current status', 'Notifications for your partner'] },
      planner: { title: 'Planner & appointments', subtitle: 'Keep medical appointments, check-ups, and family life in view.', bullets: ['Shared family calendar', 'Reminders for important appointments', 'Synced with your partner'] },
      shoppingList: { title: 'Shopping', subtitle: 'Shopping lists and loyalty cards in one place.', bullets: ['Shared lists for both of you', 'Keep loyalty cards close at hand', 'Updates shared in real time'] },
      wochenmomente: { title: 'Weekly moments', subtitle: "Save one special moment from your baby's week.", bullets: ['A weekly memory collection', 'Your story to look back on', 'Share moments with your partner'] },
      fragLotti: { title: 'Ask Lotti', subtitle: 'Ask about your routine and get evidence-backed answers from your own records.', bullets: ['Summaries of sleep, feeding, and your day', 'Every answer shows its data basis', 'No diagnoses or invented causes'] },
    },
    es: {
      recipes: { title: 'Recetas y alimentación complementaria', subtitle: 'Ideas para sus primeras cucharadas, recetas favoritas en un solo lugar y un videocurso para acompañaros.', bullets: ['Descubre recetas adecuadas para su edad', 'Guarda las recetas favoritas de la familia', 'Explora la alimentación complementaria con el videocurso'] },
      partnerLink: { title: 'Juntos en familia', subtitle: 'Vincula tu cuenta con la de tu pareja para ver y registrar al mismo bebé.', bullets: ['Los registros aparecen al instante para ambos', 'Los dos veis la situación actual', 'Notificaciones para tu pareja'] },
      planner: { title: 'Planificador y citas', subtitle: 'Ten a la vista las citas médicas, revisiones y la vida familiar.', bullets: ['Calendario familiar compartido', 'Recordatorios de citas importantes', 'Sincronizado con tu pareja'] },
      shoppingList: { title: 'Compras', subtitle: 'Listas de compras y tarjetas de fidelización en un solo lugar.', bullets: ['Listas compartidas', 'Tarjetas de fidelización siempre a mano', 'Actualizaciones compartidas en tiempo real'] },
      wochenmomente: { title: 'Momentos semanales', subtitle: 'Guarda cada semana un momento especial de tu bebé.', bullets: ['Colección semanal de recuerdos', 'Vuestra historia para volver a verla', 'Comparte momentos con tu pareja'] },
      fragLotti: { title: 'Pregunta a Lotti', subtitle: 'Pregunta por vuestra rutina y recibe respuestas verificables basadas en vuestros registros.', bullets: ['Resúmenes de sueño, tomas y del día', 'Cada respuesta muestra la base de datos', 'Sin diagnósticos ni causas inventadas'] },
    },
  } as const;
  const localizedCopy = locale === 'de' ? null : translated[locale][feature as keyof typeof translated.en];
  const copy = localizedCopy ? { ...defaultCopy, ...localizedCopy } : defaultCopy;
  const ui = {
    de: { premium: 'Lotti Premium', standard: 'Ab Lotti Standard', unlock: 'Premium entdecken', options: 'Jetzt Abos entdecken', later: 'Vielleicht später', benefits: 'Darauf könnt ihr euch freuen', hint: 'Abo und Preis im nächsten Schritt auswählen', recipeTitle: 'Kleine Löffel.\nGroße Entdeckungen.', recipePreview: 'Mit Liebe kochen. Gemeinsam genießen.', recipeSubtitle: 'Neue Ideen für die ersten Bissen, eure Lieblingsrezepte an einem Ort und ein Videokurs, der euch begleitet.' },
    en: { premium: 'Lotti Premium', standard: 'From Lotti Standard', unlock: 'Discover Premium', options: 'Explore subscriptions', later: 'Maybe later', benefits: 'Here’s what’s waiting for you', hint: 'Choose your plan and price in the next step', recipeTitle: 'Little spoonfuls.\nBig discoveries.', recipePreview: 'Cook with love. Enjoy together.', recipeSubtitle: 'Fresh ideas for your baby’s first bites, favourite recipes in one place, and a video course to guide you.' },
    es: { premium: 'Lotti Premium', standard: 'Desde Lotti Standard', unlock: 'Descubrir Premium', options: 'Descubrir suscripciones', later: 'Quizá más tarde', benefits: 'Esto es lo que os espera', hint: 'Elige tu plan y precio en el siguiente paso', recipeTitle: 'Pequeñas cucharadas.\nGrandes descubrimientos.', recipePreview: 'Cocinar con amor. Disfrutar juntos.', recipeSubtitle: 'Ideas para sus primeras cucharadas, recetas favoritas en un solo lugar y un videocurso para acompañaros.' },
  }[locale];
  const isPremiumFeature = copy.requiredTier === 'premium';
  const isRecipes = feature === 'recipes';
  const familyPreview = feature === 'shoppingList' || feature === 'planner'
    ? FAMILY_FEATURE_PREVIEWS[locale][feature]
    : null;
  const preview = isRecipes
    ? { title: ui.recipeTitle, caption: ui.recipePreview, subtitle: ui.recipeSubtitle }
    : familyPreview;
  const bullets = familyPreview?.bullets ?? copy.bullets;

  const openPaywall = () => {
    router.push(`/paywall?origin=lock_${feature}` as any);
  };

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title={headerTitle ?? copy.title}
          subtitle={headerSubtitle}
          showBackButton
          showBabySwitcher={false}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.wrap}
        >
          <GlassCard {...tileProps} radius={28} contentStyle={styles.content}>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>✦  {isPremiumFeature ? ui.premium : ui.standard}</Text>
            </View>

            {preview ? (
              <View style={styles.preview}>
                <LinearGradient
                  colors={isDark ? ['#48415E', '#302A42'] : ['#FFF0DE', '#F4E4EF']}
                  style={StyleSheet.absoluteFill}
                />
                <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {feature === 'shoppingList' || feature === 'planner' ? (
                    <FamilyFeatureIllustration feature={feature} />
                  ) : (
                  <Svg width={240} height={130} viewBox="0 0 240 130">
                    <Circle cx="120" cy="65" r="59" fill="#FFE1BE" opacity={0.14} />
                    <Ellipse cx="122" cy="113" rx="66" ry="8" fill="#21192F" opacity={0.12} />
                    <Rect x="177" y="24" width="10" height="92" rx="5" fill="#D5B28C" transform="rotate(20 182 70)" />
                    <Ellipse cx="193" cy="24" rx="13" ry="20" fill="#EAD0AC" transform="rotate(20 193 24)" />
                    <Path d="M56 63 Q61 112 118 114 Q174 110 179 63Z" fill="#EFB5A5" />
                    <Path d="M56 63 Q61 100 104 109 Q70 95 74 65Z" fill="#FFD6BF" />
                    <Ellipse cx="118" cy="62" rx="62" ry="22" fill="#FFF1DD" />
                    <Ellipse cx="118" cy="62" rx="51" ry="15" fill="#EAA55D" />
                    <Path d="M89 61 Q110 48 140 62 Q117 76 100 64" fill="none" stroke="#FFD292" strokeWidth="4" strokeLinecap="round" />
                    <Path d="M117 55 Q98 32 109 27 Q127 30 122 53 Q127 28 144 33 Q148 47 122 55" fill="#8CA982" />
                    <Path d="M39 33L42 24L45 33L54 36L45 39L42 48L39 39L30 36Z" fill="#FFD7A6" />
                    <Circle cx="161" cy="22" r="3" fill="#FFD7A6" />
                    <Circle cx="47" cy="93" r="3" fill="#D0BDD9" />
                  </Svg>
                  )}
                </View>
                <Text style={styles.previewCaption}>{preview.caption}</Text>
              </View>
            ) : <Text style={styles.emoji} accessible={false}>✨</Text>}

            <ThemedText adaptive={false} style={styles.title}>
              {preview?.title ?? copy.title}
            </ThemedText>
            <ThemedText adaptive={false} style={styles.subtitle}>
              {preview?.subtitle ?? copy.subtitle}
            </ThemedText>

            {bullets.length > 0 ? (
              <View style={styles.bullets}>
                <Text style={styles.sectionLabel}>{ui.benefits}</Text>
                {bullets.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <View style={styles.bulletIcon}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                    <ThemedText adaptive={false} style={styles.bulletText}>{item}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={openPaywall}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
            >
              <LinearGradient colors={['#FFDBB5', '#FFB89D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.ctaButtonText}>{isPremiumFeature ? ui.unlock : ui.options}</Text>
              <Text style={styles.ctaArrow} accessible={false}>→</Text>
            </Pressable>
            <Text style={styles.ctaHint}>{ui.hint}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>{ui.later}</Text>
            </Pressable>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  background: { flex: 1 },
  safeArea: { flex: 1 },
  wrap: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, width: '100%', maxWidth: 540, alignSelf: 'center' },
  content: { alignItems: 'center', padding: 22, gap: 14 },
  emoji: { fontSize: 48, marginVertical: 8 },
  tierBadge: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: isDark ? 'rgba(255,211,164,0.12)' : '#FBE8D8' },
  tierBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: isDark ? '#FFDBB5' : '#85502D' },
  preview: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 20, overflow: 'hidden', paddingTop: 4, paddingBottom: 15 },
  previewCaption: { fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center', paddingHorizontal: 12, color: isDark ? '#EAD8CF' : '#77584F' },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7, color: isDark ? '#FFF7F1' : '#4A3A33', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 22, color: isDark ? '#D3CBDF' : '#755B54', textAlign: 'center' },
  bullets: { alignSelf: 'stretch', gap: 12, paddingVertical: 6 },
  sectionLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: isDark ? '#E8D8CA' : '#77584F', marginBottom: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: isDark ? '#39483F' : '#E2EFE3', alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 15, fontWeight: '700', color: isDark ? '#C2E6C6' : '#386D48' },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20, color: isDark ? '#EAE3F2' : '#5F4346' },
  ctaButton: { alignSelf: 'stretch', minHeight: 56, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(255,180,147,0.14)' },
  ctaPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  ctaButtonText: { flexShrink: 1, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '800', color: '#573529' },
  ctaArrow: { fontSize: 21, color: '#573529' },
  ctaHint: { fontSize: 11, lineHeight: 16, textAlign: 'center', color: isDark ? '#BEB4CA' : '#80675F' },
  backButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
  backText: { fontSize: 14, fontWeight: '600', color: isDark ? '#CCC2D7' : '#806259' },
});

export default LockedFeatureScreen;
