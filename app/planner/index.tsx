import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import GreetingCard from '@/components/planner/GreetingCard';
import TodayOverviewCard from '@/components/planner/TodayOverviewCard';
import EveningReflectionCard from '@/components/planner/EveningReflectionCard';
import { FloatingAddButton } from '@/components/planner/FloatingAddButton';
import StructuredTimeline from '@/components/planner/StructuredTimeline';
import PlannerCaptureModal, { PlannerCapturePayload, PlannerCaptureType } from '@/components/planner/PlannerCaptureModal';
import { PlannerEvent, PlannerTodo, usePlannerDay } from '@/services/planner';
import { PRIMARY, BACKGROUND, LAYOUT_PAD, SECTION_GAP_BOTTOM, SECTION_GAP_TOP, TEXT_PRIMARY } from '@/constants/PlannerDesign';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

function formatDateHeader(d: Date) {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'short' }).format(d);
}

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const {
    blocks,
    summary,
    toggleTodo,
    moveToTomorrow,
    addTodo,
    addEvent,
    updateTodo,
    updateEvent,
    updateMood,
    saveReflection,
  } = usePlannerDay(selectedDate);

  const [captureVisible, setCaptureVisible] = useState(false);
  const [captureType, setCaptureType] = useState<PlannerCaptureType>('todo');
  const [editingItem, setEditingItem] = useState<{ type: 'todo' | 'event'; item: PlannerTodo | PlannerEvent } | null>(null);
  const [profileName, setProfileName] = useState<string>('Lotti');
  const contentTopPadding = Math.max(SECTION_GAP_TOP - 24, 0);

  const weekStrip = useMemo(() => {
    const current = new Date(selectedDate);
    const weekday = (current.getDay() + 6) % 7; // Montag = 0
    const monday = new Date(current);
    monday.setDate(current.getDate() - weekday);
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return d;
    });
  }, [selectedDate]);

  const todayIso = toDateStr(new Date());
  const dayEmojis = ['🍼', '💜', '👣', '🧸', '🌙', '☀️', '🫧'];

  useEffect(() => {
    let active = true;
    const loadProfileName = async () => {
      if (!user?.id) {
        if (active) setProfileName('Lotti');
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.warn('Planner: Profilname konnte nicht geladen werden', error);
      }
      const raw = data?.first_name?.trim();
      const fallback = user.email ? user.email.split('@')[0] : '';
      setProfileName(raw && raw.length > 0 ? raw : (fallback || 'Lotti'));
    };
    loadProfileName();
    return () => {
      active = false;
    };
  }, [user?.id, user?.email]);

  const greeting = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let base = 'Hallo';
    let emoji = '☀️';
    let sub = 'Schön, dass du da bist.';

    if (hour >= 5 && hour < 11) {
      base = 'Guten Morgen';
      emoji = '☀️';
      sub = 'Bereit für einen neuen Tag?';
    } else if (hour >= 11 && hour < 17) {
      base = 'Guten Tag';
      emoji = '🌤️';
      sub = 'Was steht heute noch an?';
    } else if (hour >= 17 && hour < 22) {
      base = 'Guten Abend';
      emoji = '🌆';
      sub = 'Lass den Tag entspannt ausklingen.';
    } else {
      base = 'Gute Nacht';
      emoji = '🌙';
      sub = 'Zeit zum Abschalten und Ausruhen.';
    }

    const safeName = profileName?.trim().length ? profileName.trim() : 'du';
    const nameCapitalized = safeName.charAt(0).toUpperCase() + safeName.slice(1);

    return {
      title: `${base}, ${nameCapitalized}`,
      emoji,
      subline: sub,
    };
  }, [profileName]);

  const handleSelectDate = (next: Date) => {
    const normalized = new Date(next);
    normalized.setHours(0, 0, 0, 0);
    setSelectedDate(normalized);
    setCaptureVisible(false);
    setEditingItem(null);
  };

  const shiftWeek = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + delta * 7);
    handleSelectDate(next);
  };

  const openCapture = (
    type: PlannerCaptureType,
    existing?: { type: 'todo' | 'event'; item: PlannerTodo | PlannerEvent }
  ) => {
    setCaptureType(type);
    setEditingItem(existing ?? null);
    setCaptureVisible(true);
  };

  const handleCaptureClose = () => {
    setCaptureVisible(false);
    setEditingItem(null);
  };

  const findTodoById = (id: string) => {
    for (const block of blocks) {
      for (const item of block.items) {
        if ('completed' in item && item.id === id) {
          return item as PlannerTodo;
        }
      }
    }
    return undefined;
  };

  const findEventById = (id: string) => {
    for (const block of blocks) {
      for (const item of block.items) {
        if ('start' in item && 'end' in item && item.id === id) {
          return item as PlannerEvent;
        }
      }
    }
    return undefined;
  };

  const handleEditTodo = (id: string) => {
    const todo = findTodoById(id);
    if (!todo) return;
    openCapture('todo', { type: 'todo', item: { ...todo } });
  };

  const handleEditEvent = (id: string) => {
    const event = findEventById(id);
    if (!event) return;
    openCapture('event', { type: 'event', item: { ...event } });
  };

  const handleCaptureSave = (payload: PlannerCapturePayload) => {
    try {
      if (payload.type === 'event' && payload.start) {
        const startIso = payload.start.toISOString();
        const endIso = (payload.end ?? new Date(payload.start.getTime() + 30 * 60000)).toISOString();
        if (payload.id) {
          updateEvent(payload.id, {
            title: payload.title,
            start: startIso,
            end: endIso,
            location: payload.location,
          });
        } else {
          addEvent(payload.title, startIso, endIso, payload.location);
        }
      } else if (payload.type === 'todo') {
        const dueIso = payload.dueAt ? payload.dueAt.toISOString() : undefined;
        if (payload.id) {
          updateTodo(payload.id, {
            title: payload.title,
            dueAt: dueIso,
            notes: payload.notes,
            assignee: payload.assignee,
          });
        } else {
          addTodo(payload.title, undefined, dueIso, payload.notes, payload.assignee);
        }
      } else if (payload.type === 'note') {
        const dueIso = payload.dueAt ? payload.dueAt.toISOString() : undefined;
        if (payload.id) {
          updateTodo(payload.id, {
            title: payload.title,
            dueAt: dueIso,
            notes: payload.notes,
          });
        } else {
          addTodo(payload.title, undefined, dueIso, payload.notes);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setCaptureVisible(false);
      setEditingItem(null);
    }
  };

  return (
    <ThemedBackground style={{ flex: 1, backgroundColor: BACKGROUND }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: LAYOUT_PAD, paddingTop: 0 }}>
          <Header title={formatDateHeader(selectedDate)} showBackButton />

          <View style={styles.weekStrip} accessibilityRole="tablist" accessibilityLabel="Wochentage">
            <View style={styles.weekArrowRow}>
              <TouchableOpacity
                onPress={() => shiftWeek(-1)}
                accessibilityRole="button"
                accessibilityLabel="Vorherige Woche"
                style={styles.weekArrow}
              >
                <IconSymbol name="chevron.left" size={18} color={PRIMARY as any} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => shiftWeek(1)}
                accessibilityRole="button"
                accessibilityLabel="Nächste Woche"
                style={styles.weekArrow}
              >
                <IconSymbol name="chevron.right" size={18} color={PRIMARY as any} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekDays}>
              {weekStrip.map((date, index) => {
                const iso = toDateStr(date);
                const isSelected = iso === toDateStr(selectedDate);
                const isToday = iso === todayIso;
                return (
                  <TouchableOpacity
                    key={date.toISOString()}
                    onPress={() => handleSelectDate(date)}
                    style={styles.weekItem}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric' }).format(date)}`}
                  >
                    <ThemedText style={[styles.weekDay, isSelected && styles.weekDayActive]}>
                      {new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(date)}
                    </ThemedText>
                    <View style={[styles.weekDayCircle, isSelected && styles.weekDayCircleActive]}>
                      <ThemedText style={[styles.weekEmoji, isSelected && styles.weekEmojiActive]}>
                        {dayEmojis[index % dayEmojis.length]}
                      </ThemedText>
                      <ThemedText style={[styles.weekDayNum, isSelected && styles.weekDayNumActive]}>
                        {date.getDate()}
                      </ThemedText>
                    </View>
                    {isToday && <View style={styles.todayDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 0, paddingTop: contentTopPadding, paddingBottom: SECTION_GAP_BOTTOM + 96 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: LAYOUT_PAD }}>
            <GreetingCard title={greeting.title} emoji={greeting.emoji} subline={greeting.subline} />
            <View style={{ height: SECTION_GAP_TOP }} />
            <TodayOverviewCard summary={summary} />
            <View style={{ height: SECTION_GAP_TOP }} />
            <ThemedText style={[styles.sectionTitle, { paddingHorizontal: 4 }]}>Heute</ThemedText>
          </View>

          {(() => {
            const allItems = blocks.flatMap((b) => b.items.map((item) => ({ ...item })));
            const todos: PlannerTodo[] = allItems.filter((it: any): it is PlannerTodo => 'completed' in it);
            const events: PlannerEvent[] = allItems.filter((it: any): it is PlannerEvent => 'start' in it && 'end' in it);
            return (
              <StructuredTimeline
                date={selectedDate}
                events={events}
                todos={todos}
                onToggleTodo={(id) => toggleTodo(id)}
                onMoveTomorrow={(id) => moveToTomorrow(id)}
                onEditTodo={handleEditTodo}
                onEditEvent={handleEditEvent}
              />
            );
          })()}

          <View style={{ height: SECTION_GAP_TOP }} />
          <View style={styles.reflectionWrapper}>
            <EveningReflectionCard
              mood={summary.mood}
              reflection={summary.reflection}
              onChangeMood={(m) => updateMood(m)}
              onChangeReflection={(text) => saveReflection(text)}
            />
          </View>
        </ScrollView>

        <FloatingAddButton onPress={() => openCapture('todo')} bottomInset={insets.bottom + 16} rightInset={16} />
      </SafeAreaView>

      <PlannerCaptureModal
        visible={captureVisible}
        type={captureType}
        baseDate={selectedDate}
        editingItem={editingItem}
        onClose={handleCaptureClose}
        onSave={handleCaptureSave}
      />
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  weekStrip: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 24,
  },
  weekArrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 72,
    marginBottom: 18,
  },
  weekArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  weekItem: {
    alignItems: 'center',
    width: 38,
    gap: 6,
  },
  weekDay: { fontSize: 11, opacity: 0.7, color: TEXT_PRIMARY },
  weekDayActive: { color: PRIMARY, opacity: 1 },
  weekDayCircle: {
    marginTop: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  weekDayCircleActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  weekDayNum: { fontWeight: '700', color: TEXT_PRIMARY, fontSize: 14 },
  weekDayNumActive: { color: '#fff' },
  weekEmoji: {
    position: 'absolute',
    fontSize: 16,
    opacity: 0.35,
    top: 3,
  },
  weekEmojiActive: {
    opacity: 0.65,
    color: '#fff',
  },
  todayDot: {
    marginTop: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    opacity: 0.9,
  },
  reflectionWrapper: {
    marginHorizontal: LAYOUT_PAD / 2,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
});

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
