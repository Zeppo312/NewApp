import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View, Text, Dimensions } from 'react-native';
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
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, LiquidGlassCard } from '@/constants/DesignGuide';

function formatDateHeader(d: Date) {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'short' }).format(d);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const weekday = (d.getDay() + 6) % 7; // Montag = 0
  d.setDate(d.getDate() - weekday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRangeHeader(d: Date) {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function formatMonthHeader(d: Date) {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(d);
}

function buildMonthGrid(date: Date) {
  const first = new Date(date);
  first.setDate(1);
  first.setHours(0, 0, 0, 0);
  const offset = (first.getDay() + 6) % 7; // Montag = 0
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });
}

const WEEK_BLOCKS = [
  { key: 'morning', label: 'Morgen', start: 5, end: 12 },
  { key: 'midday', label: 'Mittag', start: 12, end: 15 },
  { key: 'afternoon', label: 'Nachmittag', start: 15, end: 18 },
  { key: 'evening', label: 'Abend', start: 18, end: 23.99 },
];

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width: screenWidth } = Dimensions.get('window');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
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
  const [weekAgenda, setWeekAgenda] = useState<Record<string, any>>({});
  const [monthSummary, setMonthSummary] = useState<Record<string, { tasks: number; events: number }>>({});

  const headerTitle = useMemo(() => {
    if (selectedTab === 'week') return formatWeekRangeHeader(selectedDate);
    if (selectedTab === 'month') return formatMonthHeader(selectedDate);
    return formatDateHeader(selectedDate);
  }, [selectedDate, selectedTab]);

  const navTitle = useMemo(() => {
    if (selectedTab === 'week') return 'Wochenübersicht';
    if (selectedTab === 'month') return 'Monatsübersicht';
    return 'Tagesübersicht';
  }, [selectedTab]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return d;
    });
  }, [selectedDate]);

  const monthDays = useMemo(() => buildMonthGrid(selectedDate), [selectedDate]);
  const weekDayWidth = useMemo(() => Math.max(110, (screenWidth - LAYOUT_PAD * 2 - 16) / 3), [screenWidth]);
  const weekScrollRef = useRef<ScrollView | null>(null);

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

  useEffect(() => {
    if (!user?.id) {
      setWeekAgenda({});
      setMonthSummary({});
      return;
    }
    const loadRange = async () => {
      try {
        const start =
          selectedTab === 'month'
            ? (() => {
                const d = new Date(selectedDate);
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
                return startOfWeek(d);
              })()
            : startOfWeek(selectedDate);
        const end = new Date(start);
        end.setDate(start.getDate() + (selectedTab === 'month' ? 41 : 6));

        const startIso = toDateKey(start);
        const endIso = toDateKey(end);

        const { data: dayRows, error: dayError } = await supabase
          .from('planner_days')
          .select('id,day')
          .eq('user_id', user.id)
          .gte('day', startIso)
          .lte('day', endIso);
        if (dayError) throw dayError;

        const dayIds = (dayRows ?? []).map((row) => row.id);
        const { data: itemRows, error: itemError } = dayIds.length
          ? await supabase
              .from('planner_items')
              .select(
                'id,day_id,entry_type,title,completed,assignee,notes,location,due_at,start_at,end_at,created_at,updated_at',
              )
              .in('day_id', dayIds)
          : { data: [], error: null };
        if (itemError) throw itemError;

        const dayMap: Record<string, string> = {};
        (dayRows ?? []).forEach((row) => {
          if (row?.id && row?.day) dayMap[row.id] = row.day;
        });

        const agenda: Record<string, any> = {};
        const monthAgg: Record<string, { tasks: number; events: number }> = {};

        const assignBlock = (dateIso: string, item: any, type: 'event' | 'todo') => {
          if (!agenda[dateIso]) {
            agenda[dateIso] = {
              dateIso,
              blocks: WEEK_BLOCKS.reduce((acc, b) => ({ ...acc, [b.key]: { todos: [], events: [] } }), {}),
            };
          }
          const timeStr = item.start_at ?? item.due_at;
          const time = timeStr ? new Date(timeStr) : null;
          const hour = time ? time.getHours() + time.getMinutes() / 60 : 12;
          const blockKey =
            WEEK_BLOCKS.find((b) => hour >= b.start && hour < b.end)?.key ?? WEEK_BLOCKS[0].key;
          if (type === 'event') {
            agenda[dateIso].blocks[blockKey].events.push(item);
          } else {
            agenda[dateIso].blocks[blockKey].todos.push(item);
          }
        };

        (itemRows ?? []).forEach((item) => {
          const dayIso = dayMap[item.day_id];
          if (!dayIso) return;
          if (!monthAgg[dayIso]) monthAgg[dayIso] = { tasks: 0, events: 0 };
          if (item.entry_type === 'event') monthAgg[dayIso].events += 1;
          else monthAgg[dayIso].tasks += 1;

          if (item.entry_type === 'event') {
            assignBlock(dayIso, item, 'event');
          } else if (item.entry_type === 'todo' || item.entry_type === 'note') {
            assignBlock(dayIso, item, 'todo');
          }
        });

        setWeekAgenda(agenda);
        setMonthSummary(monthAgg);
      } catch (err) {
        console.error('Planner: failed to load range', err);
        setWeekAgenda({});
        setMonthSummary({});
      }
    };

    if (selectedTab === 'week' || selectedTab === 'month') {
      loadRange();
    }
  }, [selectedTab, selectedDate, user?.id]);

  useEffect(() => {
    if (selectedTab !== 'week') return;
    const todayIso = toDateKey(new Date());
    const idx = weekDays.findIndex((d) => toDateKey(d) === todayIso);
    if (idx < 0) return;
    const offset = idx * (weekDayWidth + 8);
    requestAnimationFrame(() => {
      weekScrollRef.current?.scrollTo({ x: offset, y: 0, animated: false });
    });
  }, [selectedTab, weekDays, weekDayWidth]);

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

  const shiftDateByTab = (direction: -1 | 1) => {
    if (selectedTab === 'day') {
      const next = new Date(selectedDate);
      next.setDate(selectedDate.getDate() + direction);
      handleSelectDate(next);
      return;
    }
    if (selectedTab === 'week') {
      shiftWeek(direction);
      return;
    }
    const next = new Date(selectedDate);
    const month = next.getMonth() + direction;
    next.setMonth(month);
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
        <Header title={headerTitle} subtitle={navTitle} showBackButton />

        <View style={{ paddingHorizontal: LAYOUT_PAD, paddingTop: 0 }}>
          <View style={styles.topTabsContainer}>
            {(['day', 'week', 'month'] as const).map((tab) => (
              <GlassCard key={tab} style={[styles.topTab, selectedTab === tab && styles.activeTopTab]} intensity={22}>
                <TouchableOpacity
                  style={styles.topTabInner}
                  onPress={() => setSelectedTab(tab)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedTab === tab }}
                >
                  <Text style={[styles.topTabText, selectedTab === tab && styles.activeTopTabText]}>
                    {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
                  </Text>
                </TouchableOpacity>
              </GlassCard>
            ))}
          </View>

          <View style={styles.dayNavigationContainer}>
            <TouchableOpacity
              style={styles.weekNavButton}
              onPress={() => shiftDateByTab(-1)}
              accessibilityRole="button"
              accessibilityLabel={selectedTab === 'day' ? 'Vorheriger Tag' : selectedTab === 'week' ? 'Vorherige Woche' : 'Vorheriger Monat'}
            >
              <ThemedText style={styles.weekNavButtonText}>‹</ThemedText>
            </TouchableOpacity>

            <View style={styles.weekHeaderCenter}>
              <ThemedText style={styles.weekHeaderTitle}>{navTitle}</ThemedText>
              <ThemedText style={styles.weekHeaderSubtitle}>{headerTitle}</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.weekNavButton}
              onPress={() => shiftDateByTab(1)}
              accessibilityRole="button"
              accessibilityLabel={selectedTab === 'day' ? 'Nächster Tag' : selectedTab === 'week' ? 'Nächste Woche' : 'Nächster Monat'}
            >
              <ThemedText style={styles.weekNavButtonText}>›</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 0, paddingTop: contentTopPadding, paddingBottom: SECTION_GAP_BOTTOM + 96 }} showsVerticalScrollIndicator={false}>
          {selectedTab === 'day' ? (
            <>
              <View style={{ paddingHorizontal: LAYOUT_PAD }}>
                <View style={{ marginHorizontal: -LAYOUT_PAD }}>
                  <GreetingCard title={greeting.title} emoji={greeting.emoji} subline={greeting.subline} />
                </View>
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
            </>
          ) : selectedTab === 'week' ? (
            <View style={{ paddingHorizontal: LAYOUT_PAD }}>
              <LiquidGlassCard style={styles.calendarCard} intensity={24}>
                <ThemedText style={styles.calendarTitle}>Wochenplan</ThemedText>

                <ScrollView
                  ref={weekScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={weekDayWidth + 8}
                  decelerationRate="fast"
                  contentContainerStyle={styles.weekDaysScroll}
                >
                  {weekDays.map((date) => {
                    const iso = toDateKey(date);
                    const dayAgenda = weekAgenda[iso];
                    const blocks = dayAgenda?.blocks ?? {};
                    const events = Object.values(blocks).flatMap((b: any) => b?.events ?? []);
                    const todos = Object.values(blocks).flatMap((b: any) => b?.todos ?? []);
                    const hasItems = events.length + todos.length > 0;
                    const isToday = iso === toDateKey(new Date());
                    const combined = [
                      ...events.map((ev: any) => ({
                        id: ev.id,
                        title: ev.title,
                        time: ev.start_at ?? ev.due_at ?? null,
                        type: 'event' as const,
                      })),
                      ...todos.map((todo: any) => ({
                        id: todo.id,
                        title: todo.title,
                        time: todo.due_at ?? null,
                        type: 'todo' as const,
                      })),
                    ].sort((a, b) => {
                      const timeA = a.time ? new Date(a.time).getHours() * 60 + new Date(a.time).getMinutes() : 12 * 60;
                      const timeB = b.time ? new Date(b.time).getHours() * 60 + new Date(b.time).getMinutes() : 12 * 60;
                      return timeA - timeB;
                    });

                    return (
                      <TouchableOpacity
                        key={iso}
                        style={[
                          styles.weekDayCard,
                          isToday && styles.weekDayCardToday,
                          { width: weekDayWidth },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => {
                          handleSelectDate(date);
                          setSelectedTab('day');
                        }}
                      >
                        <View style={styles.weekDayHeader}>
                          <ThemedText
                            style={[
                              styles.weekCellWeekday,
                              isToday && styles.weekCellWeekdayActive,
                            ]}
                          >
                            {new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(date)}
                          </ThemedText>
                          <View
                            style={[
                              styles.weekHeaderBadgeSmall,
                              isToday && styles.weekHeaderBadgeToday,
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.weekHeaderBadgeText,
                                isToday && styles.weekHeaderBadgeTextToday,
                              ]}
                            >
                              {date.getDate()}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.weekDateLabel}>
                          {new Intl.DateTimeFormat('de-DE', { month: 'short', day: '2-digit' }).format(date)}
                        </ThemedText>

                        <View style={styles.weekItems}>
                          <View style={styles.weekTimelineLine} />
                          {combined.map((item) => {
                            const timeLabel = item.time
                              ? new Intl.DateTimeFormat('de-DE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }).format(new Date(item.time))
                              : '—';
                            return (
                              <View key={item.id} style={styles.timelineRow}>
                                <View
                                  style={[
                                    styles.timelineDot,
                                    item.type === 'event' && styles.timelineDotEvent,
                                  ]}
                                />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTime}>{timeLabel}</Text>
                                  <Text numberOfLines={2} style={styles.timelineTitle}>
                                    {item.title}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                          {!hasItems && <Text style={styles.emptyTextSmall}>–</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </LiquidGlassCard>
            </View>
          ) : (
            <View style={{ paddingHorizontal: LAYOUT_PAD }}>
              <LiquidGlassCard style={styles.calendarCard} intensity={24}>
                <ThemedText style={styles.calendarTitle}>Monatskalender</ThemedText>
                <View style={styles.monthHeaderRow}>
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                    <ThemedText key={d} style={styles.monthHeaderLabel}>
                      {d}
                    </ThemedText>
                  ))}
                </View>
                <View style={styles.monthGrid}>
                  {monthDays.map((date) => {
                    const isSelected = toDateKey(date) === toDateKey(selectedDate);
                    const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                    const isToday = toDateKey(date) === toDateKey(new Date());
                    const stats = monthSummary[toDateKey(date)] ?? { tasks: 0, events: 0 };
                    const hasData = stats.tasks > 0 || stats.events > 0;
                    return (
                      <TouchableOpacity
                        key={date.toISOString()}
                        style={[styles.monthCell, isSelected && styles.monthCellActive]}
                        onPress={() => {
                          handleSelectDate(date);
                          setSelectedTab('day');
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View style={[styles.monthCircle, isSelected && styles.monthCircleActive, !isCurrentMonth && styles.monthCircleFaded]}>
                          <ThemedText
                            style={[
                              styles.monthNumber,
                              !isCurrentMonth && styles.monthNumberFaded,
                              isSelected && styles.monthNumberActive,
                            ]}
                          >
                            {date.getDate()}
                          </ThemedText>
                        </View>
                        <View style={styles.monthDotRow}>
                          {isToday && <View style={[styles.todayDotSmall, { marginRight: 3 }]} />}
                          {isCurrentMonth && (
                            <View
                              style={[
                                styles.dataDot,
                                hasData && styles.dataDotActive,
                              ]}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </LiquidGlassCard>
            </View>
          )}
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
  topTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  topTab: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  topTabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  activeTopTab: { borderColor: 'rgba(94,61,179,0.65)' },
  topTabText: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },
  activeTopTabText: { color: PRIMARY },
  dayNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 0,
  },
  weekNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.3,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  weekNavButtonText: {
    fontSize: 22,
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
  weekHeaderCenter: {
    alignItems: 'center',
    flex: 1,
  },
  weekHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  weekHeaderSubtitle: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    opacity: 0.75,
  },
  calendarCard: {
    padding: 16,
    borderRadius: 22,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 10,
    textAlign: 'center',
  },
  weekDaysScroll: { paddingRight: 16, gap: 8 },
  weekDayCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    marginRight: 8,
    gap: 8,
    minHeight: 420,
  },
  weekDayCardToday: {
    borderColor: PRIMARY,
    backgroundColor: 'rgba(94,61,179,0.12)',
  },
  weekDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekHeaderBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  weekHeaderBadgeToday: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  weekHeaderBadgeText: { color: TEXT_PRIMARY, fontWeight: '700' },
  weekHeaderBadgeTextToday: { color: '#fff' },
  weekDateLabel: { fontSize: 12, color: TEXT_PRIMARY, opacity: 0.75 },
  weekItems: {
    gap: 8,
    marginTop: 6,
    position: 'relative',
    paddingLeft: 12,
    paddingBottom: 16,
    minHeight: 320,
    justifyContent: 'flex-start',
  },
  weekTimelineLine: {
    position: 'absolute',
    left: 5,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(125,90,80,0.25)',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
    marginTop: 3,
  },
  timelineDotEvent: {
    backgroundColor: '#6e4dbd',
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineTime: {
    fontSize: 11,
    color: TEXT_PRIMARY,
    opacity: 0.7,
  },
  timelineTitle: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
  weekCellWeekday: { fontSize: 12, color: TEXT_PRIMARY, opacity: 0.8 },
  weekCellWeekdayActive: { color: PRIMARY, fontWeight: '700', opacity: 1 },
  eventIcon: { fontSize: 14 },
  eventText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600', flex: 1 },
  emptyText: { fontSize: 12, color: TEXT_PRIMARY, opacity: 0.65 },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    opacity: 0.7,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  monthCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
  },
  monthCellActive: {},
  monthCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  monthCircleActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  monthCircleFaded: {
    opacity: 0.45,
  },
  monthNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  monthNumberFaded: { opacity: 0.6 },
  monthNumberActive: { color: '#fff' },
  todayDotSmall: {
    marginTop: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: PRIMARY,
  },
  monthDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 2,
  },
  dataDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(125,90,80,0.35)',
  },
  dataDotActive: {
    backgroundColor: PRIMARY,
  },
  eventPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 3,
    backgroundColor: 'rgba(94,61,179,0.1)',
  },
  eventTextSmall: {
    fontSize: 11,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  todoRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  todoDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    marginRight: 4,
  },
  todoTextSmall: {
    fontSize: 11,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  emptyTextSmall: {
    fontSize: 11,
    color: TEXT_PRIMARY,
    opacity: 0.4,
    textAlign: 'center',
    marginTop: 8,
  },
});

function toDateKey(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().split('T')[0];
}
