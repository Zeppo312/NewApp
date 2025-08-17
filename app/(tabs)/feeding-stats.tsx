import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, StyleSheet, Text, TouchableOpacity, ScrollView, Animated, StatusBar, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getBabyCareEntriesForDate, getBabyCareEntriesForDateRange, getBabyCareEntriesForMonth } from '@/lib/supabase';
import { Stack } from 'expo-router';

type FeedType = 'BREAST' | 'BOTTLE' | 'SOLIDS';

function GlassCard({ children, style, intensity = 28, overlayColor = 'rgba(255,255,255,0.30)', borderColor = 'rgba(255,255,255,0.40)' }: { children: React.ReactNode; style?: any; intensity?: number; overlayColor?: string; borderColor?: string }) {
  return (
    <View style={[s.glassCard, { borderColor }, style]}>
      <BlurView style={StyleSheet.absoluteFill} intensity={intensity} tint="light" />
      <LinearGradient colors={[overlayColor, overlayColor]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

export default function FeedingStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        if (selectedTab === 'day') {
          const { data } = await getBabyCareEntriesForDate(selectedDate);
          setEntries(data ?? []);
        } else if (selectedTab === 'week') {
          const d = new Date(selectedDate);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(d.setDate(diff));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          const { data } = await getBabyCareEntriesForDateRange(weekStart, weekEnd);
          setEntries(data ?? []);
        } else {
          const { data } = await getBabyCareEntriesForMonth(selectedDate);
          setEntries(data ?? []);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedTab, selectedDate]);

  const stats = useMemo(() => {
    const onlyFeeding = entries.filter((e) => e.entry_type === 'feeding');
    const countBreast = onlyFeeding.filter((e) => e.feeding_type === 'BREAST').length;
    const countBottle = onlyFeeding.filter((e) => e.feeding_type === 'BOTTLE').length;
    const countSolids = onlyFeeding.filter((e) => e.feeding_type === 'SOLIDS').length;
    const volume = onlyFeeding.reduce((sum, e) => sum + (e.feeding_volume_ml || 0), 0);
    const first = onlyFeeding.length > 0 ? new Date(onlyFeeding[onlyFeeding.length - 1].start_time) : null;
    const last = onlyFeeding.length > 0 ? new Date(onlyFeeding[0].start_time) : null;

    // Verteilung über den Tag (0-23)
    const byHour: number[] = new Array(24).fill(0);
    onlyFeeding.forEach((e) => {
      const h = new Date(e.start_time).getHours();
      byHour[h] += 1;
    });

    return { total: onlyFeeding.length, countBreast, countBottle, countSolids, volume, first, last, byHour };
  }, [entries]);

  const Tab = ({ id, label }: { id: 'day' | 'week' | 'month'; label: string }) => (
    <GlassCard style={[s.tabBtn, selectedTab === id && s.tabActive]} intensity={18}>
      <TouchableOpacity style={s.tabInner} onPress={() => setSelectedTab(id)} activeOpacity={0.85}>
        <Text style={[s.tabText, selectedTab === id && s.tabTextActive]}>{label}</Text>
      </TouchableOpacity>
    </GlassCard>
  );

  const Bar = ({ value, max }: { value: number; max: number }) => {
    const h = max === 0 ? 2 : Math.max(2, Math.round((value / max) * 56));
    return (
      <View style={s.barWrap}>
        <LinearGradient colors={[ 'rgba(125,90,80,0.15)', 'rgba(125,90,80,0.35)' ]} style={[s.bar, { height: h }]} />
      </View>
    );
  };

  const maxHour = Math.max(...stats.byHour);

  return (
    <ThemedBackground style={s.bg}>
      <SafeAreaView style={s.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header title="Mahlzeiten" subtitle="Statistiken & Verläufe" showBackButton />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.tabsRow}>
            <Tab id="day" label="Tag" />
            <Tab id="week" label="Woche" />
            <Tab id="month" label="Monat" />
          </View>

          {/* KPI Row */}
          <View style={s.kpiRow}>
            <GlassCard style={s.kpiCard}>
              <Text style={s.kpiTitle}>Gesamt</Text>
              <Text style={s.kpiValue}>{stats.total}</Text>
              <Text style={s.kpiSub}>Fütterungen</Text>
            </GlassCard>

            <GlassCard style={s.kpiCard}>
              <Text style={s.kpiTitle}>Volumen</Text>
              <Text style={s.kpiValue}>{stats.volume} ml</Text>
              <Text style={s.kpiSub}>nur Fläschchen</Text>
            </GlassCard>
          </View>

          <View style={s.kpiRow}>
            <GlassCard style={s.typeCard}>
              <Text style={s.typeEmoji}>🤱</Text>
              <Text style={s.typeValue}>{stats.countBreast}</Text>
              <Text style={s.typeLabel}>Stillen</Text>
            </GlassCard>
            <GlassCard style={s.typeCard}>
              <Text style={s.typeEmoji}>🍼</Text>
              <Text style={s.typeValue}>{stats.countBottle}</Text>
              <Text style={s.typeLabel}>Flasche</Text>
            </GlassCard>
            <GlassCard style={s.typeCard}>
              <Text style={s.typeEmoji}>🥄</Text>
              <Text style={s.typeValue}>{stats.countSolids}</Text>
              <Text style={s.typeLabel}>Beikost</Text>
            </GlassCard>
          </View>

          {/* Verlauf */}
          <Text style={s.sectionTitle}>Verteilung über den Tag</Text>
          <GlassCard style={s.chartCard}>
            <View style={s.chartRow}>
              {stats.byHour.map((v, i) => (
                <Bar key={i} value={v} max={maxHour} />
              ))}
            </View>
            <View style={s.chartLabels}>
              <Text style={s.chartLabel}>0</Text>
              <Text style={s.chartLabel}>6</Text>
              <Text style={s.chartLabel}>12</Text>
              <Text style={s.chartLabel}>18</Text>
              <Text style={s.chartLabel}>24</Text>
            </View>
          </GlassCard>

          {/* Zeitliche Eckwerte */}
          <View style={s.kpiRow}>
            <GlassCard style={s.metaCard}>
              <Text style={s.metaTitle}>Erste</Text>
              <Text style={s.metaValue}>{stats.first ? stats.first.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
            </GlassCard>
            <GlassCard style={s.metaCard}>
              <Text style={s.metaTitle}>Letzte</Text>
              <Text style={s.metaValue}>{stats.last ? stats.last.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
            </GlassCard>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const s = StyleSheet.create<{
  bg: ViewStyle;
  container: ViewStyle;
  glassCard: ViewStyle;
  tabsRow: ViewStyle;
  tabBtn: ViewStyle;
  tabInner: ViewStyle;
  tabText: TextStyle;
  tabActive: ViewStyle;
  tabTextActive: TextStyle;
  sectionTitle: TextStyle;
  kpiRow: ViewStyle;
  kpiCard: ViewStyle;
  kpiTitle: TextStyle;
  kpiValue: TextStyle;
  kpiSub: TextStyle;
  typeCard: ViewStyle;
  typeEmoji: TextStyle;
  typeValue: TextStyle;
  typeLabel: TextStyle;
  chartCard: ViewStyle;
  chartRow: ViewStyle;
  barWrap: ViewStyle;
  bar: ViewStyle;
  chartLabels: ViewStyle;
  chartLabel: TextStyle;
  metaCard: ViewStyle;
  metaTitle: TextStyle;
  metaValue: TextStyle;
}>({
  bg: { flex: 1, width: '100%' },
  container: { flex: 1 },
  glassCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  tabsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingHorizontal: 16, marginTop: 6 },
  tabBtn: { borderRadius: 20, borderWidth: 1 },
  tabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  tabText: { fontSize: 13, fontWeight: '700', color: '#7D5A50' },
  tabActive: { borderColor: 'rgba(125,90,80,0.55)' },
  tabTextActive: { color: '#7D5A50' },

  sectionTitle: { marginTop: 18, marginBottom: 8, paddingHorizontal: 16, fontSize: 14, fontWeight: '700', color: '#7D5A50' },

  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 10 },
  kpiCard: { width: '48%', paddingVertical: 18, paddingHorizontal: 14 },
  kpiTitle: { fontSize: 13, color: '#7D5A50', fontWeight: '700' },
  kpiValue: { fontSize: 28, fontWeight: '800', color: '#7D5A50', marginTop: 2 },
  kpiSub: { marginTop: 6, fontSize: 12, color: '#7D5A50' },

  typeCard: { width: '31%', alignItems: 'center', paddingVertical: 14 },
  typeEmoji: { fontSize: 26 },
  typeValue: { fontSize: 20, fontWeight: '800', color: '#7D5A50', marginTop: 6 },
  typeLabel: { fontSize: 12, color: '#7D5A50', marginTop: 2 },

  chartCard: { marginHorizontal: 16, paddingVertical: 16, paddingHorizontal: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 60 },
  barWrap: { width: '3.67%', backgroundColor: 'rgba(125,90,80,0.06)', borderRadius: 4, marginHorizontal: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 8, borderRadius: 4 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chartLabel: { fontSize: 10, color: '#7D5A50' },

  metaCard: { width: '48%', paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' },
  metaTitle: { fontSize: 12, color: '#7D5A50' },
  metaValue: { fontSize: 18, fontWeight: '800', color: '#7D5A50', marginTop: 4 },
});


