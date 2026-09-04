/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Dimensions,
  Alert,
  AppState,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/Header";
import { ThemedBackground } from "@/components/ThemedBackground";
import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import GreetingCardView from "@/components/planner/GreetingCard";
import TodayOverviewCardView from "@/components/planner/TodayOverviewCard";
import { FloatingAddButton } from "@/components/planner/FloatingAddButton";
import StructuredTimelineView from "@/components/planner/StructuredTimeline";
import { SwipeableListItem } from "@/components/planner/SwipeableListItem";
import PlannerCaptureModalView, {
  PlannerCapturePayload,
  PlannerCaptureType,
} from "@/components/planner/PlannerCaptureModal";
import {
  expandRecurringForRange,
  PlannerEvent,
  PlannerTodo,
  usePlannerDay,
} from "@/services/planner";
import {
  PRIMARY,
  BACKGROUND,
  LAYOUT_PAD,
  SECTION_GAP_BOTTOM,
  SECTION_GAP_TOP,
  TEXT_PRIMARY,
} from "@/constants/PlannerDesign";
import {
  adaptPlannerColor,
  normalizePlannerColor,
} from "@/constants/PlannerColors";
import { Colors } from "@/constants/Colors";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { getLinkedUsers, supabase } from "@/lib/supabase";
import {
  GlassCard,
  LiquidGlassCard,
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK,
} from "@/constants/DesignGuide";
import { BabyInfo, listBabies } from "@/lib/baby";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  buildPlannerPersonColorMap,
  getPlannerPersonKey,
  resolvePlannerItemColor,
} from "@/lib/plannerPersonColors";
import {
  buildPlannerWidgetSnapshot,
  drainPlannerWidgetToggles,
  isPlannerWidgetSupported,
  syncPlannerWidget,
} from "@/lib/plannerWidget";
import { parseSafeDate } from "@/lib/safeDate";
import {
  disablePlannerCalendarSync,
  enablePlannerCalendarSync,
  getPlannerCalendarSyncSettings,
  PlannerCalendarSyncSettings,
  runPlannerCalendarSync,
} from "@/lib/plannerCalendarSync";
import { LockedFeatureScreen } from '@/components/LockedFeatureScreen';
import { useFeatureAccess } from '@/lib/entitlements';
import {
  DEFAULT_PLANNER_LOCALE,
  getPlannerLocaleTag,
  PlannerTranslationKey,
  translatePlannerText,
} from '@/lib/plannerTranslations';

let ACTIVE_PLANNER_LOCALE = DEFAULT_PLANNER_LOCALE;
let PLANNER_LOCALE_TAG = getPlannerLocaleTag(ACTIVE_PLANNER_LOCALE);
const t = (key: PlannerTranslationKey, params?: Record<string, string | number>) =>
  translatePlannerText(ACTIVE_PLANNER_LOCALE, key, params);

function formatDateHeader(d: Date) {
  return new Intl.DateTimeFormat(PLANNER_LOCALE_TAG, {
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(d);
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
  const formatter = new Intl.DateTimeFormat(PLANNER_LOCALE_TAG, {
    day: "2-digit",
    month: "short",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function formatMonthHeader(d: Date) {
  return new Intl.DateTimeFormat(PLANNER_LOCALE_TAG, {
    month: "long",
    year: "numeric",
  }).format(d);
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
  { key: "morning", label: t('dayPart.morning'), start: 5, end: 12 },
  { key: "midday", label: t('dayPart.midday'), start: 12, end: 15 },
  { key: "afternoon", label: t('dayPart.afternoon'), start: 15, end: 18 },
  { key: "evening", label: t('dayPart.evening'), start: 18, end: 23.99 },
];

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace("#", "");
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const lightenHex = (hex: string, amount = 0.25) => {
  const cleanHex = hex.replace("#", "");
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0");

  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

type LinkedUser = {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  userRole?: string | null;
  relationshipType?: string | null;
};

type MonthSummaryDay = {
  tasks: number;
  events: number;
  itemColors: string[];
};

function displayNameForLinkedUser(linkedUser: LinkedUser, index: number) {
  const firstName = linkedUser.firstName?.trim();
  const lastName = linkedUser.lastName?.trim();
  if (firstName && lastName) return `${firstName} ${lastName.charAt(0)}.`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  const role = linkedUser.userRole?.trim();
  if (role) return role;
  return `Partner ${index + 1}`;
}

// Abo-Gate: in Lotti Lite ist dieses Feature gesperrt (lib/entitlements.ts).
export default function PlannerScreen() {
  ACTIVE_PLANNER_LOCALE = useLocale().locale;
  PLANNER_LOCALE_TAG = getPlannerLocaleTag(ACTIVE_PLANNER_LOCALE);
  const access = useFeatureAccess('planner');

  if (access.hasAccess === null) return null;
  if (!access.hasAccess) {
    return <LockedFeatureScreen feature="planner" />;
  }

  return <PlannerScreenContent />;
}

function PlannerScreenContent() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : "#5C4033";
  const textSecondary = isDark ? Colors.dark.textSecondary : "#7D5A50";
  const textMuted = isDark ? "rgba(248,240,229,0.72)" : "rgba(92,64,51,0.72)";
  const accentColor = isDark ? lightenHex(PRIMARY, 0.26) : PRIMARY;
  const accentEventColor = isDark ? lightenHex("#6E4DBD", 0.26) : "#6E4DBD";
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const glassBorder = isDark
    ? "rgba(255,255,255,0.22)"
    : "rgba(255,255,255,0.5)";
  const backgroundFallback = isDark ? "#1F1A18" : BACKGROUND;
  const { width: screenWidth } = Dimensions.get("window");
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedTab, setSelectedTab] = useState<"day" | "week" | "month">(
    "day",
  );
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [babies, setBabies] = useState<BabyInfo[]>([]);

  const {
    blocks,
    summary,
    floatingTodos,
    completedFloatingTodos,
    toggleTodo,
    moveToTomorrow,
    addTodo,
    addEvent,
    updateTodo,
    updateEvent,
    convertPlannerItem,
    addRecurringItem,
    updateRecurringSeries,
    updateRecurringOccurrence,
    toggleRecurringTodo,
    deleteRecurringSeries,
    deleteRecurringOccurrence,
    disableRecurrence,
    refetch,
  } = usePlannerDay(selectedDate);

  const [captureVisible, setCaptureVisible] = useState(false);
  const [captureType, setCaptureType] = useState<PlannerCaptureType>("todo");
  const [editingItem, setEditingItem] = useState<{
    type: "todo" | "event";
    item: PlannerTodo | PlannerEvent;
  } | null>(null);
  const [profileName, setProfileName] = useState<string>("Lotti");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const contentTopPadding = Math.max(SECTION_GAP_TOP - 24, 0);
  const [weekAgenda, setWeekAgenda] = useState<Record<string, any>>({});
  const [monthSummary, setMonthSummary] = useState<Record<string, MonthSummaryDay>>(
    {},
  );
  const [showCompletedFloatingTodos, setShowCompletedFloatingTodos] =
    useState(false);
  const [calendarSyncSettings, setCalendarSyncSettings] =
    useState<PlannerCalendarSyncSettings | null>(null);
  const [calendarSyncLoading, setCalendarSyncLoading] = useState(false);
  const [calendarSyncError, setCalendarSyncError] = useState<string | null>(null);
  const [calendarSyncSummary, setCalendarSyncSummary] = useState<string | null>(null);
  const [calendarSyncPanelVisible, setCalendarSyncPanelVisible] = useState(false);
  const calendarSyncRunningRef = useRef(false);

  const ownerOptions = useMemo(() => {
    if (!user?.id) return [];
    const options = [
      { id: user.id, label: "Ich" },
      ...linkedUsers.map((linkedUser, idx) => ({
        id: linkedUser.userId,
        label: displayNameForLinkedUser(linkedUser, idx),
      })),
    ];
    const seen = new Set<string>();
    return options.filter((opt) => {
      if (!opt.id || seen.has(opt.id)) return false;
      seen.add(opt.id);
      return true;
    });
  }, [user?.id, linkedUsers]);

  const ownerLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    ownerOptions.forEach((opt) => {
      map[opt.id] = opt.label;
    });
    return map;
  }, [ownerOptions]);

  const babyOptions = useMemo(() => {
    return babies
      .map((baby) => ({
        id: baby.id ?? "",
        label: baby.name ?? t('person.baby'),
      }))
      .filter((opt) => opt.id.length > 0);
  }, [babies]);

  const partnerUserId = useMemo(
    () => linkedUsers.find((entry) => entry.userId !== user?.id)?.userId,
    [linkedUsers, user?.id],
  );

  // Personenfarben kommen aus lib/plannerPersonColors, damit das Home-Screen-
  // Widget dieselben Farben zeigt wie der Screen.
  const eventColorByPersonKey = useMemo(
    () =>
      buildPlannerPersonColorMap({
        userId: user?.id,
        linkedUserIds: linkedUsers.map((entry) => entry.userId),
        babies,
        accentColor,
        isDark,
      }),
    [accentColor, babies, isDark, linkedUsers, user?.id],
  );

  const getOwnerLabel = useCallback(
    (ownerId?: string) => {
      if (!ownerId) return undefined;
      return ownerLabelById[ownerId] ?? t('person.partner');
    },
    [ownerLabelById],
  );

  const getAssigneeLabel = useCallback(
    (assignee?: string, babyId?: string, ownerId?: string) => {
      if (!assignee) return undefined;

      if (assignee === "me") {
        return t('person.me');
      }

      if (assignee === "partner") {
        const partnerUser = linkedUsers.find((u) => u.userId !== user?.id);
        if (partnerUser) {
          return displayNameForLinkedUser(partnerUser, 0);
        }
        return t('person.partner');
      }

      if (assignee === "child" && babyId) {
        const baby = babies.find((b) => b.id === babyId);
        return baby?.name ?? t('person.child');
      }

      if (assignee === "child") {
        return t('person.child');
      }

      if (assignee === "family") {
        return t('person.family');
      }

      return undefined;
    },
    [linkedUsers, babies, user?.id],
  );

  const getDisplayAssigneeLabel = useCallback(
    (assignee?: string, babyId?: string, ownerId?: string) => {
      const assigneeLabel = getAssigneeLabel(assignee, babyId, ownerId);
      if (assigneeLabel && assigneeLabel !== t('person.me')) return assigneeLabel;
      const ownerLabel = getOwnerLabel(ownerId);
      if (ownerLabel && ownerLabel !== t('person.me')) return ownerLabel;
      return undefined;
    },
    [getAssigneeLabel, getOwnerLabel],
  );

  const getEventPersonKey = useCallback(
    (assignee?: string, babyId?: string, ownerId?: string) =>
      getPlannerPersonKey(
        { assignee, babyId, ownerId },
        { userId: user?.id, partnerUserId },
      ),
    [partnerUserId, user?.id],
  );

  const getEventColorByPersonKey = useCallback(
    (personKey?: string) => {
      if (!personKey) return accentEventColor;
      return eventColorByPersonKey[personKey] ?? accentEventColor;
    },
    [accentEventColor, eventColorByPersonKey],
  );

  const getEventColor = useCallback(
    (assignee?: string, babyId?: string, ownerId?: string, itemColor?: string | null) => {
      const custom = normalizePlannerColor(itemColor);
      if (custom) return adaptPlannerColor(custom, isDark);
      return getEventColorByPersonKey(getEventPersonKey(assignee, babyId, ownerId));
    },
    [getEventColorByPersonKey, getEventPersonKey, isDark],
  );

  /** Aufgaben nutzen dieselbe eigene-oder-Personenfarbe wie Termine. */
  const getTodoColor = useCallback(
    (todo: { assignee?: string; babyId?: string; userId?: string; color?: string }) =>
      getEventColor(todo.assignee, todo.babyId, todo.userId, todo.color),
    [getEventColor],
  );

  useEffect(() => {
    setCaptureVisible(false);
    setEditingItem(null);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) {
        if (active) setLinkedUsers([]);
        return;
      }
      try {
        const result = await getLinkedUsers(user.id);
        if (!active) return;
        if (result?.success && Array.isArray(result.linkedUsers)) {
          const next = result.linkedUsers
            .map((entry: any) => ({
              userId: entry?.userId,
              firstName: entry?.firstName ?? null,
              lastName: entry?.lastName ?? null,
              userRole: entry?.userRole ?? null,
              relationshipType: entry?.relationshipType ?? null,
            }))
            .filter(
              (entry: any): entry is LinkedUser =>
                typeof entry.userId === "string" && entry.userId.length > 0,
            );
          setLinkedUsers(next);
        } else {
          setLinkedUsers([]);
        }
      } catch (err) {
        console.error("Planner: failed to load linked users", err);
        if (active) setLinkedUsers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) {
        if (active) setBabies([]);
        return;
      }
      try {
        const result = await listBabies();
        if (!active) return;
        if (result?.data && Array.isArray(result.data)) {
          setBabies(result.data);
        } else {
          setBabies([]);
        }
      } catch (err) {
        console.error("Planner: failed to load babies", err);
        if (active) setBabies([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const headerTitle = useMemo(() => {
    if (selectedTab === "week") return formatWeekRangeHeader(selectedDate);
    if (selectedTab === "month") return formatMonthHeader(selectedDate);
    return formatDateHeader(selectedDate);
  }, [selectedDate, selectedTab]);

  const navTitle = useMemo(() => {
    if (selectedTab === "week") return t('view.weekOverview');
    if (selectedTab === "month") return t('view.monthOverview');
    return t('view.dayOverview');
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
  const weekDayWidth = useMemo(
    () => Math.max(110, (screenWidth - LAYOUT_PAD * 2 - 16) / 3),
    [screenWidth],
  );
  const weekScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    let active = true;
    const loadProfileName = async () => {
      if (!user?.id) {
        if (active) setProfileName("Lotti");
        if (active) setProfileAvatarUrl(null);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.warn("Planner: Profilname konnte nicht geladen werden", error);
      }
      const raw = data?.first_name?.trim();
      const fallback = user.email ? user.email.split("@")[0] : "";
      setProfileName(raw && raw.length > 0 ? raw : fallback || "Lotti");
      setProfileAvatarUrl(data?.avatar_url ?? null);
    };
    loadProfileName();
    return () => {
      active = false;
    };
  }, [user?.id, user?.email]);

  const greeting = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let base = t('greeting.hello');
    let sub = t('greeting.welcome');

    if (hour >= 5 && hour < 11) {
      base = t('greeting.morning');
      sub = t('greeting.morningSub');
    } else if (hour >= 11 && hour < 17) {
      base = t('greeting.day');
      sub = t('greeting.daySub');
    } else if (hour >= 17 && hour < 22) {
      base = t('greeting.evening');
      sub = t('greeting.eveningSub');
    } else {
      base = t('greeting.night');
      sub = t('greeting.nightSub');
    }

    const safeName = profileName?.trim().length ? profileName.trim() : t('greeting.you');
    const nameCapitalized =
      safeName.charAt(0).toUpperCase() + safeName.slice(1);

    return {
      title: `${base}, ${nameCapitalized}`,
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
          selectedTab === "month"
            ? (() => {
                const d = new Date(selectedDate);
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
                return startOfWeek(d);
              })()
            : startOfWeek(selectedDate);
        const end = new Date(start);
        end.setDate(start.getDate() + (selectedTab === "month" ? 41 : 6));

        const startIso = toDateKey(start);
        const endIso = toDateKey(end);
        const ownerIds = Array.from(
          new Set([
            user.id,
            ...linkedUsers.map((linkedUser) => linkedUser.userId),
          ]),
        );

        const { data: itemRows, error: itemError } = await supabase
          .from("planner_items")
          .select(
            "id,user_id,day_id,entry_type,title,completed,assignee,baby_id,notes,location,due_at,start_at,end_at,is_all_day,color,created_at,updated_at,planner_days!inner(day)",
          )
          .in("user_id", ownerIds)
          .gte("planner_days.day", startIso)
          .lte("planner_days.day", endIso);
        if (itemError) throw itemError;

        const { data: recurringSeriesRows, error: recurringSeriesError } =
          await supabase
            .from("planner_recurring_items")
            .select(
              "id,user_id,entry_type,title,notes,location,assignee,baby_id,is_all_day,due_at_minutes,start_at_minutes,end_at_minutes,repeat_days,starts_on,ends_on,color,created_at,updated_at",
            )
            .in("user_id", ownerIds);
        if (recurringSeriesError) throw recurringSeriesError;

        const activeRecurringSeries = ((recurringSeriesRows ?? []) as any[]).filter(
          (item) => item.starts_on <= endIso && (!item.ends_on || item.ends_on >= startIso),
        );
        const recurringIds = activeRecurringSeries.map((item) => item.id);
        const { data: recurringExceptionRows, error: recurringExceptionError } =
          recurringIds.length
            ? await supabase
                .from("planner_recurring_exceptions")
                .select(
                  "id,user_id,recurring_item_id,day,deleted,completed,title,notes,location,assignee,baby_id,is_all_day,due_at_minutes,start_at_minutes,end_at_minutes,color,created_at,updated_at",
                )
                .in("recurring_item_id", recurringIds)
                .gte("day", startIso)
                .lte("day", endIso)
            : { data: [], error: null };
        if (recurringExceptionError) throw recurringExceptionError;

        const recurringMap = expandRecurringForRange(
          start,
          end,
          activeRecurringSeries as any,
          (recurringExceptionRows ?? []) as any,
          user.id,
        );
        const recurringExpandedRows = Array.from(recurringMap.entries()).flatMap(
          ([dayIso, items]) =>
            items.map((item) => ({
              ...item,
              planner_days: { day: dayIso },
            })),
        );

        const agenda: Record<string, any> = {};
        const monthAgg: Record<string, MonthSummaryDay> = {};

        const assignBlock = (
          dateIso: string,
          item: any,
          type: "event" | "todo",
        ) => {
          if (!agenda[dateIso]) {
            agenda[dateIso] = {
              dateIso,
              blocks: WEEK_BLOCKS.reduce(
                (acc, b) => ({ ...acc, [b.key]: { todos: [], events: [] } }),
                {},
              ),
            };
          }
          const timeStr = item.start_at ?? item.due_at;
          const time = parseSafeDate(timeStr);
          const hour = time ? time.getHours() + time.getMinutes() / 60 : 12;
          const blockKey =
            WEEK_BLOCKS.find((b) => hour >= b.start && hour < b.end)?.key ??
            WEEK_BLOCKS[0].key;
          if (type === "event") {
            agenda[dateIso].blocks[blockKey].events.push(item);
          } else {
            agenda[dateIso].blocks[blockKey].todos.push(item);
          }
        };

        ([...((itemRows ?? []) as any[]), ...recurringExpandedRows] as any[]).forEach((item) => {
          const plannerDay = item?.planner_days as
            | { day?: string }
            | { day?: string }[]
            | undefined;
          const dayIso = Array.isArray(plannerDay)
            ? plannerDay[0]?.day
            : plannerDay?.day;
          if (!dayIso) return;
          if (!monthAgg[dayIso]) {
            monthAgg[dayIso] = { tasks: 0, events: 0, itemColors: [] };
          }
          if (item.entry_type === "event") monthAgg[dayIso].events += 1;
          else monthAgg[dayIso].tasks += 1;

          const itemColor = getEventColor(
            item.assignee,
            item.baby_id,
            item.user_id,
            item.color,
          );
          if (!monthAgg[dayIso].itemColors.includes(itemColor)) {
            monthAgg[dayIso].itemColors.push(itemColor);
          }

          if (item.entry_type === "event") {
            assignBlock(dayIso, item, "event");
          } else if (item.entry_type === "todo") {
            assignBlock(dayIso, item, "todo");
          }
        });

        setWeekAgenda(agenda);
        setMonthSummary(monthAgg);
      } catch (err) {
        console.error("Planner: failed to load range", err);
        setWeekAgenda({});
        setMonthSummary({});
      }
    };

    if (selectedTab === "week" || selectedTab === "month") {
      loadRange();
    }
  }, [getEventColor, linkedUsers, selectedDate, selectedTab, user?.id]);

  useEffect(() => {
    if (selectedTab !== "week") return;
    const todayIso = toDateKey(new Date());
    const selectedIso = toDateKey(selectedDate);
    const idxToday = weekDays.findIndex((d) => toDateKey(d) === todayIso);
    const idxSelected = weekDays.findIndex((d) => toDateKey(d) === selectedIso);
    const idx = idxToday >= 0 ? idxToday : idxSelected;
    if (idx < 0) return;
    const offset = idx * (weekDayWidth + 8);
    requestAnimationFrame(() => {
      weekScrollRef.current?.scrollTo({ x: offset, y: 0, animated: false });
    });
  }, [selectedTab, weekDays, weekDayWidth, selectedDate]);

  const loadCalendarSyncSettings = useCallback(async () => {
    if (!userId) {
      setCalendarSyncSettings(null);
      return null;
    }
    try {
      const settings = await getPlannerCalendarSyncSettings(userId);
      setCalendarSyncSettings(settings);
      return settings;
    } catch (err) {
      console.error("Planner: failed to load calendar sync settings", err);
      setCalendarSyncError(t('sync.loadFailed'));
      return null;
    }
  }, [userId]);

  const runCalendarSync = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!userId || calendarSyncRunningRef.current) return;
      calendarSyncRunningRef.current = true;
      if (!options.silent) {
        setCalendarSyncLoading(true);
      }
      setCalendarSyncError(null);
      try {
        const result = await runPlannerCalendarSync(userId);
        await loadCalendarSyncSettings();
        await refetch();
        if (result.errors.length > 0) {
          setCalendarSyncError(result.errors[0]);
        } else {
          const changes =
            result.createdPlanner +
            result.updatedPlanner +
            result.deletedPlanner +
            result.createdApple +
            result.updatedApple +
            result.deletedApple;
          setCalendarSyncSummary(
            changes > 0
              ? t('sync.changes', { count: changes })
              : t('sync.current'),
          );
        }
      } catch (err) {
        console.error("Planner: calendar sync failed", err);
        setCalendarSyncError(t('sync.failed'));
      } finally {
        calendarSyncRunningRef.current = false;
        if (!options.silent) {
          setCalendarSyncLoading(false);
        }
      }
    },
    [loadCalendarSyncSettings, refetch, userId],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const settings = await loadCalendarSyncSettings();
      if (!active || !settings?.enabled) return;
      await runCalendarSync({ silent: true });
    })();
    return () => {
      active = false;
    };
  }, [loadCalendarSyncSettings, runCalendarSync]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && calendarSyncSettings?.enabled) {
        void runCalendarSync({ silent: true });
      }
    });
    return () => subscription.remove();
  }, [calendarSyncSettings?.enabled, runCalendarSync]);

  const handleCalendarSyncToggle = async (enabled: boolean) => {
    if (!userId) return;
    setCalendarSyncLoading(true);
    setCalendarSyncError(null);
    try {
      if (enabled) {
        const settings = await enablePlannerCalendarSync(userId);
        setCalendarSyncSettings(settings);
        await runCalendarSync({ silent: true });
      } else {
        const settings = await disablePlannerCalendarSync(userId);
        setCalendarSyncSettings(settings);
        setCalendarSyncSummary(null);
      }
    } catch (err) {
      console.error("Planner: calendar sync toggle failed", err);
      setCalendarSyncError(
        enabled
          ? t('sync.enableFailed')
          : t('sync.disableFailed'),
      );
    } finally {
      setCalendarSyncLoading(false);
    }
  };

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
    if (selectedTab === "day") {
      const next = new Date(selectedDate);
      next.setDate(selectedDate.getDate() + direction);
      handleSelectDate(next);
      return;
    }
    if (selectedTab === "week") {
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
    existing?: { type: "todo" | "event"; item: PlannerTodo | PlannerEvent },
  ) => {
    setCaptureType(type);
    setEditingItem(existing ?? null);
    setCaptureVisible(true);
  };

  const handleCaptureClose = () => {
    setCaptureVisible(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      if (id.startsWith("exclude:")) {
        const [, seriesId, occurrenceDate] = id.split(":");
        if (seriesId && occurrenceDate) {
          await deleteRecurringOccurrence(seriesId, occurrenceDate);
          await runCalendarSync({ silent: true });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return;
      }
      if (id.startsWith("delete-series:")) {
        const [, seriesId] = id.split(":");
        if (seriesId) {
          await deleteRecurringSeries(seriesId);
          await runCalendarSync({ silent: true });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return;
      }
      const recurring = parseRecurringId(id);
      if (recurring) {
        Alert.alert(
          t('delete.recurringTitle'),
          t('delete.recurringQuestion'),
          [
            { text: t('common.cancel'), style: "cancel" },
            {
              text: t('delete.onlyDay'),
              style: "destructive",
              onPress: () =>
                handleDeleteItem(
                  `exclude:${recurring.seriesId}:${recurring.occurrenceDate}`,
                ),
            },
            {
              text: t('delete.series'),
              style: "destructive",
              onPress: () =>
                handleDeleteItem(`delete-series:${recurring.seriesId}`),
            },
          ],
        );
        return;
      }
      if (!user?.id) return;

      const { error } = await supabase
        .from("planner_items")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Planner: failed to delete item", error);
        Alert.alert(t('common.error'), t('delete.failed'));
      } else {
        await refetch();
        await runCalendarSync({ silent: true });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error("Planner: delete error", err);
      Alert.alert(t('common.error'), t('delete.unexpected'));
    }
  };

  const findTodoById = (id: string) => {
    for (const block of blocks) {
      for (const item of block.items) {
        if ("completed" in item && item.id === id) {
          return item as PlannerTodo;
        }
      }
    }
    const floating = floatingTodos.find((todo) => todo.id === id);
    if (floating) return floating;
    const completedFloating = completedFloatingTodos.find(
      (todo) => todo.id === id,
    );
    if (completedFloating) return completedFloating;
    return undefined;
  };

  const findEventById = (id: string) => {
    for (const block of blocks) {
      for (const item of block.items) {
        if ("start" in item && "end" in item && item.id === id) {
          return item as PlannerEvent;
        }
      }
    }
    return undefined;
  };

  const handleEditTodo = (id: string) => {
    const todo = findTodoById(id);
    if (!todo) return;
    openCapture("todo", { type: "todo", item: { ...todo } });
  };

  const handleEditEvent = (id: string) => {
    const event = findEventById(id);
    if (!event) return;
    openCapture("event", { type: "event", item: { ...event } });
  };

  const parseRecurringId = (id: string) => {
    const parts = id.split(":");
    if (parts.length < 3 || parts[0] !== "recurring") return null;
    return { seriesId: parts[1], occurrenceDate: parts.slice(2).join(":") };
  };

  const toMinutes = (date?: Date | null) =>
    date ? date.getHours() * 60 + date.getMinutes() : null;

  const handleToggleItem = (id: string) => {
    const recurring = parseRecurringId(id);
    if (recurring) {
      toggleRecurringTodo(recurring.seriesId, recurring.occurrenceDate);
      return;
    }
    toggleTodo(id);
  };

  const handleMoveTomorrow = async (id: string) => {
    const recurring = parseRecurringId(id);
    if (!recurring) {
      await moveToTomorrow(id);
      return;
    }

    const todo = findTodoById(id);
    if (!todo) return;

    const baseDate = todo.dueAt ? parseSafeDate(todo.dueAt) : selectedDate;
    const tomorrow = new Date(baseDate ?? selectedDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const repeatDays = todo.repeatDays ?? [];
    const tomorrowIsoWeekday = tomorrow.getDay() === 0 ? 7 : tomorrow.getDay();
    if (!repeatDays.includes(tomorrowIsoWeekday)) {
      const nextDueAt = todo.dueAt
        ? tomorrow.toISOString()
        : (() => {
            const flexibleDue = new Date(tomorrow);
            flexibleDue.setHours(12, 0, 0, 0);
            return flexibleDue.toISOString();
          })();
      await addTodo(
        todo.title,
        undefined,
        nextDueAt,
        todo.notes,
        todo.assignee ?? "me",
        todo.babyId,
        todo.userId,
      );
    }

    await deleteRecurringOccurrence(recurring.seriesId, recurring.occurrenceDate);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectedDayTimeline = useMemo(() => {
    const allItems = blocks.flatMap((block) =>
      block.items.map((item) => ({ ...item })),
    );
    const todos = allItems.filter(
      (it: any): it is PlannerTodo => "completed" in it && it.dueAt != null,
    );
    const events = allItems.filter(
      (it: any): it is PlannerEvent => "start" in it && "end" in it,
    );
    return { todos, events };
  }, [blocks]);

  // Deep Link aus dem Home-Screen-Widget: `planner?capture=todo|event` öffnet
  // direkt die Erfassung. Der Parameter wird danach gelöscht, damit ein
  // erneutes Fokussieren des Screens nicht wieder das Modal öffnet.
  const router = useRouter();
  const { capture: captureParam } = useLocalSearchParams<{ capture?: string }>();
  useEffect(() => {
    if (captureParam !== "todo" && captureParam !== "event") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- externer Auslöser (Deep Link), kein abgeleiteter Zustand
    openCapture(captureParam);
    router.setParams({ capture: undefined } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf den Parameter reagieren
  }, [captureParam]);

  // Home-Screen-Widget mit dem heutigen Stand füttern – aus den bereits
  // aufgelösten Screen-Daten (Farben, Personennamen), sobald sie sich ändern.
  // Ohne diesen Weg hinge das Widget nach dem Abhaken bis zur nächsten
  // App-Aktivierung hinterher.
  const isSelectedDateToday = toDateKey(selectedDate) === toDateKey(new Date());
  useEffect(() => {
    if (!isPlannerWidgetSupported() || !userId || !isSelectedDateToday) return;
    // Das Widget bekommt immer die Hell-Farben und hellt im Dunkelmodus selbst
    // auf – sonst würde eine im dunklen Screen schon aufgehellte Farbe dort
    // ein zweites Mal aufgehellt.
    const lightColorMap = buildPlannerPersonColorMap({
      userId,
      linkedUserIds: linkedUsers.map((entry) => entry.userId),
      babies,
      accentColor: PRIMARY,
      isDark: false,
    });
    const widgetColor = (item: {
      assignee?: string;
      babyId?: string;
      userId?: string;
      color?: string;
    }) =>
      resolvePlannerItemColor(
        { assignee: item.assignee, babyId: item.babyId, ownerId: item.userId, color: item.color },
        lightColorMap,
        { userId, partnerUserId, isDark: false, fallback: "#6E4DBD" },
      );
    const snapshot = buildPlannerWidgetSnapshot({
      locale: ACTIVE_PLANNER_LOCALE,
      events: selectedDayTimeline.events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        isAllDay: event.isAllDay,
        color: widgetColor(event),
        location: event.location,
        person: getDisplayAssigneeLabel(event.assignee, event.babyId, event.userId) ?? null,
      })),
      todos: [
        ...selectedDayTimeline.todos,
        ...floatingTodos,
        ...completedFloatingTodos,
      ].map((todo) => ({
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        dueAt: todo.dueAt ?? null,
        color: widgetColor(todo),
        person: getDisplayAssigneeLabel(todo.assignee, todo.babyId, todo.userId) ?? null,
        isRecurring: todo.isRecurring,
        seriesId: todo.seriesId ?? null,
        occurrenceDate: todo.occurrenceDate ?? null,
      })),
    });
    void syncPlannerWidget(snapshot);
  }, [
    babies,
    completedFloatingTodos,
    floatingTodos,
    getDisplayAssigneeLabel,
    isSelectedDateToday,
    linkedUsers,
    partnerUserId,
    selectedDayTimeline,
    userId,
  ]);

  // Im Widget abgehakte Aufgaben beim Zurückkehren in die App übernehmen und
  // den Screen nachladen, damit er nicht den alten Stand zeigt.
  useEffect(() => {
    if (!isPlannerWidgetSupported() || !userId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void (async () => {
        await drainPlannerWidgetToggles({ userId, locale: ACTIVE_PLANNER_LOCALE });
        await refetch();
      })();
    });
    return () => subscription.remove();
  }, [refetch, userId]);

  const handleCaptureSave = async (payload: PlannerCapturePayload) => {
    const itemColor = normalizePlannerColor(payload.color);
    const safeStart = payload.start ? parseSafeDate(payload.start) : null;
    const safeEnd = payload.end ? parseSafeDate(payload.end) : null;
    const safeDueAt = payload.dueAt ? parseSafeDate(payload.dueAt) : null;
    const recurringEdit = editingItem ? parseRecurringId(editingItem.item.id) : null;
    const recurringSeriesId = payload.recurringSeriesId ?? recurringEdit?.seriesId;
    const recurringOccurrenceDate =
      payload.recurringOccurrenceDate ?? recurringEdit?.occurrenceDate ?? toDateKey(selectedDate);

    if (payload.type === "event" && !safeStart) {
      Alert.alert(t('validation.timeTitle'), t('validation.timeMessage'));
      return;
    }

    const eventEnd =
      safeStart && safeEnd && safeEnd.getTime() > safeStart.getTime()
        ? safeEnd
        : safeStart
          ? new Date(safeStart.getTime() + 30 * 60000)
          : null;

    const recurringSeriesInput = {
      entryType: payload.type,
      title: payload.title,
      notes: payload.notes,
      location: payload.location,
      assignee: payload.assignee,
      babyId: payload.babyId ?? null,
      isAllDay: payload.isAllDay,
      dueAtMinutes: toMinutes(safeDueAt ?? safeStart),
      startAtMinutes: toMinutes(safeStart),
      endAtMinutes: toMinutes(eventEnd),
      repeatDays: payload.repeatDays ?? [],
      ownerId: payload.ownerId,
      color: itemColor,
      endsOn: payload.recurringEndsOn ? toDateKey(payload.recurringEndsOn) : null,
    } as const;
    const newRecurringInput = {
      ...recurringSeriesInput,
      startsOn: recurringOccurrenceDate,
    } as const;

    try {
      if (payload.repeatEnabled && payload.repeatDays?.length) {
        if (recurringSeriesId) {
          if (payload.editScope === "occurrence") {
            if (
              editingItem &&
              editingItem.type !== payload.type
            ) {
              Alert.alert(
                t('validation.unsupportedTitle'),
                t('validation.unsupportedMessage'),
              );
              return;
            }
            await updateRecurringOccurrence(recurringSeriesId, recurringOccurrenceDate, {
                entryType: payload.type,
                title: payload.title,
                notes: payload.notes ?? null,
                location: payload.type === "event" ? payload.location ?? null : null,
                assignee: payload.assignee ?? null,
                babyId: payload.babyId ?? null,
                isAllDay: payload.type === "event" ? !!payload.isAllDay : false,
                dueAtMinutes: payload.type === "todo" ? toMinutes(safeDueAt ?? safeStart) : null,
                startAtMinutes: payload.type === "event" ? toMinutes(safeStart) : null,
                endAtMinutes: payload.type === "event" ? toMinutes(eventEnd) : null,
                color: itemColor,
              },
            );
          } else {
            await updateRecurringSeries(recurringSeriesId, recurringSeriesInput);
          }
        } else {
          await addRecurringItem(newRecurringInput);
        }
        await runCalendarSync({ silent: true });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      if (!payload.repeatEnabled && recurringSeriesId) {
        await disableRecurrence(
          recurringSeriesId,
          recurringOccurrenceDate,
          recurringSeriesInput,
        );
        await runCalendarSync({ silent: true });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      if (payload.id && editingItem && editingItem.type !== payload.type) {
        if (payload.type === "event" && safeStart && eventEnd) {
          const startIso = safeStart.toISOString();
          const endIso = eventEnd.toISOString();
          await convertPlannerItem(payload.id, "event", {
            title: payload.title,
            start: startIso,
            end: endIso,
            location: payload.location,
            reminderMinutes: payload.reminderMinutes,
            notes: payload.notes,
            assignee: payload.assignee,
            color: itemColor,
          });
        } else if (payload.type === "todo") {
          const dueIso =
            payload.dueAt === null
              ? null
              : safeDueAt
                ? safeDueAt.toISOString()
                : undefined;
          await convertPlannerItem(payload.id, payload.type, {
            title: payload.title,
            dueAt: dueIso,
            notes: payload.notes,
            assignee: payload.assignee,
            color: itemColor,
          });
        }
      } else if (payload.type === "event" && safeStart && eventEnd) {
        const startIso = safeStart.toISOString();
        const endIso = eventEnd.toISOString();
        if (payload.id) {
          await updateEvent(payload.id, {
            title: payload.title,
            start: startIso,
            end: endIso,
            location: payload.location,
            assignee: payload.assignee,
            babyId: payload.babyId,
            isAllDay: payload.isAllDay,
            reminderMinutes: payload.reminderMinutes,
            color: itemColor,
          });
        } else {
          await addEvent(
            payload.title,
            startIso,
            endIso,
            payload.location,
            payload.assignee ?? "me",
            payload.babyId,
            undefined,
            payload.ownerId,
            payload.isAllDay,
            payload.reminderMinutes,
            itemColor,
          );
        }
      } else if (payload.type === "todo") {
        const dueIso =
          payload.dueAt === null
              ? null
              : safeDueAt
                ? safeDueAt.toISOString()
                : undefined;
        if (payload.id) {
          await updateTodo(payload.id, {
            title: payload.title,
            dueAt: dueIso,
            notes: payload.notes,
            assignee: payload.assignee,
            babyId: payload.babyId,
            color: itemColor,
          });
        } else {
          await addTodo(
            payload.title,
            undefined,
            dueIso,
            payload.notes,
            payload.assignee,
            payload.babyId,
            payload.ownerId,
            itemColor,
          );
        }
      }
      await runCalendarSync({ silent: true });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setCaptureVisible(false);
      setEditingItem(null);
    }
  };

  const calendarSyncLastLabel = calendarSyncSettings?.last_synced_at
    ? new Intl.DateTimeFormat(PLANNER_LOCALE_TAG, {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parseSafeDate(calendarSyncSettings.last_synced_at) ?? new Date())
    : null;

  return (
    <ThemedBackground style={{ flex: 1, backgroundColor: backgroundFallback }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title={headerTitle} subtitle={navTitle} showBackButton />

        <View style={{ paddingHorizontal: LAYOUT_PAD, paddingTop: 0 }}>
          <View style={styles.topTabsContainer}>
            {(["day", "week", "month"] as const).map((tab) => {
              const isActive = selectedTab === tab;
              return (
                <GlassCard
                  key={tab}
                  style={[
                    styles.topTab,
                    isActive && {
                      borderColor: toRgba(accentColor, 0.66),
                      backgroundColor: isDark
                        ? toRgba(accentColor, 0.16)
                        : "rgba(255,255,255,0.86)",
                    },
                  ]}
                  intensity={22}
                  overlayColor={
                    isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.14)"
                  }
                  borderColor={
                    isActive ? toRgba(accentColor, 0.66) : glassBorder
                  }
                >
                  <TouchableOpacity
                    style={styles.topTabInner}
                    onPress={() => setSelectedTab(tab)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[
                        styles.topTabText,
                        { color: isActive ? accentColor : textSecondary },
                      ]}
                    >
                      {tab === "day"
                        ? t('view.day')
                        : tab === "week"
                          ? t('view.week')
                          : t('view.month')}
                    </Text>
                  </TouchableOpacity>
                </GlassCard>
              );
            })}
          </View>

          <View style={styles.dayNavigationContainer}>
            <TouchableOpacity
              style={[
                styles.weekNavButton,
                {
                  borderColor: isDark
                    ? "rgba(255,255,255,0.24)"
                    : "rgba(255,255,255,0.35)",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.12)",
                },
              ]}
              onPress={() => shiftDateByTab(-1)}
              accessibilityRole="button"
              accessibilityLabel={
                selectedTab === "day"
                  ? t('navigation.previousDay')
                  : selectedTab === "week"
                    ? t('navigation.previousWeek')
                    : t('navigation.previousMonth')
              }
            >
              <ThemedText
                style={[styles.weekNavButtonText, { color: textPrimary }]}
              >
                ‹
              </ThemedText>
            </TouchableOpacity>

            <View style={styles.weekHeaderCenter}>
              <ThemedText
                style={[styles.weekHeaderTitle, { color: textPrimary }]}
              >
                {navTitle}
              </ThemedText>
              <ThemedText
                style={[styles.weekHeaderSubtitle, { color: textSecondary }]}
              >
                {headerTitle}
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[
                styles.weekNavButton,
                {
                  borderColor: isDark
                    ? "rgba(255,255,255,0.24)"
                    : "rgba(255,255,255,0.35)",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.12)",
                },
              ]}
              onPress={() => shiftDateByTab(1)}
              accessibilityRole="button"
              accessibilityLabel={
                selectedTab === "day"
                  ? t('navigation.nextDay')
                  : selectedTab === "week"
                    ? t('navigation.nextWeek')
                    : t('navigation.nextMonth')
              }
            >
              <ThemedText
                style={[styles.weekNavButtonText, { color: textPrimary }]}
              >
                ›
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 0,
            paddingTop: contentTopPadding,
            paddingBottom: SECTION_GAP_BOTTOM + 54,
          }}
          showsVerticalScrollIndicator={false}
        >
          {selectedTab === "day" ? (
            <>
              <View style={{ paddingHorizontal: LAYOUT_PAD }}>
                <View style={{ marginHorizontal: -LAYOUT_PAD }}>
                  <GreetingCardView
                    title={greeting.title}
                    subline={greeting.subline}
                    avatarUrl={profileAvatarUrl}
                  />
                </View>
                <View style={styles.dayOverviewSection}>
                  <View style={styles.dayOverviewHeader}>
                    <ThemedText
                      style={[
                        styles.sectionTitle,
                        { paddingHorizontal: 4, color: textSecondary },
                      ]}
                    >
                      {t('common.today')}
                    </ThemedText>
                    <TouchableOpacity
                      style={[
                        styles.calendarSyncGearButton,
                        {
                          borderColor: calendarSyncPanelVisible
                            ? toRgba(accentEventColor, 0.45)
                            : glassBorder,
                          backgroundColor: calendarSyncPanelVisible
                            ? toRgba(accentEventColor, 0.14)
                            : isDark
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(255,255,255,0.5)",
                        },
                      ]}
                      activeOpacity={0.85}
                      onPress={() => setCalendarSyncPanelVisible((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={t('sync.settingsAccessibility')}
                    >
                      {calendarSyncLoading ? (
                        <ActivityIndicator size="small" color={accentEventColor} />
                      ) : (
                        <IconSymbol
                          name="gear"
                          size={18}
                          color={
                            calendarSyncPanelVisible
                              ? (accentEventColor as any)
                              : (textSecondary as any)
                          }
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                  <TodayOverviewCardView summary={summary} />
                </View>
                <View style={{ height: 2 }} />
                {calendarSyncPanelVisible && (
                  <>
                    <LiquidGlassCard
                      style={styles.calendarSyncPanel}
                      intensity={20}
                      overlayColor={glassOverlay}
                      borderColor={glassBorder}
                    >
                      <View style={styles.calendarSyncHeader}>
                        <View style={styles.calendarSyncTitleRow}>
                          <IconSymbol
                            name="calendar"
                            size={17}
                            color={accentEventColor as any}
                          />
                          <View style={styles.calendarSyncCopy}>
                            <ThemedText
                              style={[
                                styles.calendarSyncTitle,
                                { color: textPrimary },
                              ]}
                            >
                              {t('sync.title')}
                            </ThemedText>
                            <Text
                              style={[
                                styles.calendarSyncSubtitle,
                                { color: textMuted },
                              ]}
                              numberOfLines={2}
                            >
                              {calendarSyncSettings?.enabled
                                ? calendarSyncLastLabel
                                  ? t('sync.last', { time: calendarSyncLastLabel })
                                  : t('sync.ready')
                                : t('sync.off')}
                            </Text>
                          </View>
                        </View>
                        <Switch
                          value={!!calendarSyncSettings?.enabled}
                          disabled={calendarSyncLoading || !user?.id}
                          onValueChange={handleCalendarSyncToggle}
                          trackColor={{
                            false: isDark
                              ? "rgba(255,255,255,0.16)"
                              : "rgba(125,90,80,0.18)",
                            true: toRgba(accentEventColor, 0.45),
                          }}
                          thumbColor={
                            calendarSyncSettings?.enabled ? accentEventColor : "#fff"
                          }
                        />
                      </View>
                      {(calendarSyncError || calendarSyncSummary || calendarSyncLoading || calendarSyncSettings?.enabled) && (
                        <View style={styles.calendarSyncFooter}>
                          {calendarSyncLoading ? (
                            <ActivityIndicator size="small" color={accentEventColor} />
                          ) : (
                            <Text
                              style={[
                                styles.calendarSyncStatus,
                                {
                                  color: calendarSyncError
                                    ? "#B94A48"
                                    : textSecondary,
                                },
                              ]}
                              numberOfLines={2}
                            >
                              {calendarSyncError ??
                                calendarSyncSummary ??
                                t('sync.readyAction')}
                            </Text>
                          )}
                          {calendarSyncSettings?.enabled && (
                            <TouchableOpacity
                              style={[
                                styles.calendarSyncIconButton,
                                {
                                  borderColor: toRgba(accentEventColor, 0.35),
                                  backgroundColor: toRgba(accentEventColor, 0.12),
                                },
                              ]}
                              activeOpacity={0.85}
                              disabled={calendarSyncLoading}
                              onPress={() => runCalendarSync()}
                              accessibilityRole="button"
                              accessibilityLabel={t('sync.actionAccessibility')}
                            >
                              <IconSymbol
                                name="arrow.triangle.2.circlepath"
                                size={16}
                                color={accentEventColor as any}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </LiquidGlassCard>
                    <View style={{ height: 2 }} />
                  </>
                )}
              </View>

              <StructuredTimelineView
                date={selectedDate}
                events={selectedDayTimeline.events}
                todos={selectedDayTimeline.todos}
                getOwnerLabel={getOwnerLabel}
                getAssigneeLabel={getAssigneeLabel}
                getEventColor={getEventColor}
                onToggleTodo={handleToggleItem}
                onMoveTomorrow={handleMoveTomorrow}
                onDelete={handleDeleteItem}
                onEditTodo={handleEditTodo}
                onEditEvent={handleEditEvent}
              />

              <View style={{ paddingHorizontal: LAYOUT_PAD, marginTop: 10 }}>
                <LiquidGlassCard
                  style={styles.floatingCard}
                  intensity={20}
                  overlayColor={glassOverlay}
                  borderColor={glassBorder}
                >
                  <View style={styles.timelineHeaderRow}>
                    <ThemedText
                      style={[
                        styles.sectionTitle,
                        styles.timelineTitleLabel,
                        { color: textSecondary },
                      ]}
                    >
                      {t('tasks.title')}
                    </ThemedText>
                    <View
                      style={[
                        styles.timelineBadge,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.28)",
                          borderColor: isDark
                            ? "rgba(255,255,255,0.18)"
                            : "rgba(255,255,255,0.5)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.timelineBadgeText,
                          { color: textPrimary },
                        ]}
                      >
                        {t('tasks.open', { count: floatingTodos.length })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.floatingList}>
                    {floatingTodos.map((todo, idx) => {
                      const displayLabel = getDisplayAssigneeLabel(
                        todo.assignee,
                        todo.babyId,
                        todo.userId,
                      );
                      const subtitle = displayLabel
                        ? t('tasks.flexibleWith', { name: displayLabel })
                        : t('tasks.flexible');

                      return (
                        <View key={todo.id}>
                          <SwipeableListItem
                            id={todo.id}
                            title={todo.title}
                            type="todo"
                            completed={todo.completed}
                            isRecurring={todo.isRecurring}
                            onComplete={() => {
                              setShowCompletedFloatingTodos(true);
                              handleToggleItem(todo.id);
                            }}
                            onMoveTomorrow={() => handleMoveTomorrow(todo.id)}
                            onDelete={handleDeleteItem}
                            onPress={() => handleEditTodo(todo.id)}
                            accentColor={getTodoColor(todo)}
                            showLeadingCheckbox={false}
                            trailingCheckbox
                            style={styles.floatingItem}
                            subtitle={subtitle}
                          />
                          {idx < floatingTodos.length - 1 && (
                            <View
                              style={[
                                styles.floatingDivider,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(255,255,255,0.14)"
                                    : "rgba(255,255,255,0.5)",
                                },
                              ]}
                            />
                          )}
                        </View>
                      );
                    })}
                    {floatingTodos.length === 0 && (
                      <View style={styles.emptyFloating}>
                        <Text
                          style={[
                            styles.emptyFloatingText,
                            { color: textMuted },
                          ]}
                        >
                          {t('tasks.empty')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {completedFloatingTodos.length > 0 && (
                    <>
                      <View
                        style={[
                          styles.sectionDivider,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.14)"
                              : "rgba(255,255,255,0.5)",
                          },
                        ]}
                      />
                      <TouchableOpacity
                        style={styles.completedToggleRow}
                        activeOpacity={0.85}
                        onPress={() =>
                          setShowCompletedFloatingTodos((prev) => !prev)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={
                          showCompletedFloatingTodos
                            ? t('tasks.hideDone')
                            : t('tasks.showDone')
                        }
                      >
                        <ThemedText
                          style={[
                            styles.completedToggleLabel,
                            { color: textPrimary },
                          ]}
                        >
                          {t('tasks.done')}
                        </ThemedText>
                        <View style={styles.completedToggleRight}>
                          <View
                            style={[
                              styles.timelineBadge,
                              {
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(255,255,255,0.28)",
                                borderColor: isDark
                                  ? "rgba(255,255,255,0.18)"
                                  : "rgba(255,255,255,0.5)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.timelineBadgeText,
                                { color: textPrimary },
                              ]}
                            >
                              {completedFloatingTodos.length}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.completedChevron,
                              { color: textSecondary },
                            ]}
                          >
                            {showCompletedFloatingTodos ? "˄" : "˅"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {showCompletedFloatingTodos && (
                        <View style={styles.completedList}>
                          {completedFloatingTodos.map((todo, idx) => {
                            const displayLabel = getDisplayAssigneeLabel(
                              todo.assignee,
                              todo.babyId,
                              todo.userId,
                            );
                            const subtitle = displayLabel
                              ? t('tasks.flexibleWith', { name: displayLabel })
                              : t('tasks.flexible');

                            return (
                              <View key={todo.id}>
                                <SwipeableListItem
                                  id={todo.id}
                                  title={todo.title}
                                  type="todo"
                                  completed={todo.completed}
                                  isRecurring={todo.isRecurring}
                                  onComplete={() => handleToggleItem(todo.id)}
                                  onMoveTomorrow={() => handleMoveTomorrow(todo.id)}
                                  onDelete={handleDeleteItem}
                                  onPress={() => handleEditTodo(todo.id)}
                                  accentColor={getTodoColor(todo)}
                                  showLeadingCheckbox={false}
                                  trailingCheckbox
                                  style={styles.floatingItem}
                                  subtitle={subtitle}
                                />
                                {idx < completedFloatingTodos.length - 1 && (
                                  <View
                                    style={[
                                      styles.floatingDivider,
                                      {
                                        backgroundColor: isDark
                                          ? "rgba(255,255,255,0.14)"
                                          : "rgba(255,255,255,0.5)",
                                      },
                                    ]}
                                  />
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </>
                  )}
                </LiquidGlassCard>
              </View>
            </>
          ) : selectedTab === "week" ? (
            <View style={{ paddingHorizontal: LAYOUT_PAD }}>
              <LiquidGlassCard
                style={styles.calendarCard}
                intensity={24}
                overlayColor={glassOverlay}
                borderColor={glassBorder}
              >
                <ThemedText
                  style={[styles.calendarTitle, { color: textSecondary }]}
                >
                  {t('calendar.week')}
                </ThemedText>

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
                    const events = Object.values(blocks).flatMap(
                      (b: any) => b?.events ?? [],
                    );
                    const todos = Object.values(blocks).flatMap(
                      (b: any) => b?.todos ?? [],
                    );
                    const hasItems = events.length + todos.length > 0;
                    const isToday = iso === toDateKey(new Date());
                    const combined = [
                      ...events.map((ev: any) => ({
                        id: ev.id,
                        title: ev.title,
                        time: ev.start_at ?? ev.due_at ?? null,
                        ownerId: ev.user_id,
                        assignee: ev.assignee,
                        babyId: ev.baby_id,
                        isAllDay: !!ev.is_all_day,
                        eventColor: getEventColor(
                          ev.assignee,
                          ev.baby_id,
                          ev.user_id,
                          ev.color,
                        ),
                        type: "event" as const,
                      })),
                      ...todos.map((todo: any) => ({
                        id: todo.id,
                        title: todo.title,
                        time: todo.due_at ?? null,
                        ownerId: todo.user_id,
                        assignee: todo.assignee,
                        babyId: todo.baby_id,
                        todoColor: getEventColor(
                          todo.assignee,
                          todo.baby_id,
                          todo.user_id,
                          todo.color,
                        ),
                        type: "todo" as const,
                      })),
                    ].sort((a, b) => {
                      const dateA = parseSafeDate(a.time);
                      const dateB = parseSafeDate(b.time);
                      const timeA = dateA
                        ? dateA.getHours() * 60 + dateA.getMinutes()
                        : 12 * 60;
                      const timeB = dateB
                        ? dateB.getHours() * 60 + dateB.getMinutes()
                        : 12 * 60;
                      return timeA - timeB;
                    });

                    return (
                      <TouchableOpacity
                        key={iso}
                        style={[
                          styles.weekDayCard,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.06)"
                              : "rgba(255,255,255,0.3)",
                            borderColor: isDark
                              ? "rgba(255,255,255,0.2)"
                              : "rgba(255,255,255,0.5)",
                          },
                          isToday && styles.weekDayCardToday,
                          isToday && {
                            borderColor: accentColor,
                            backgroundColor: isDark
                              ? toRgba(accentColor, 0.18)
                              : "rgba(94,61,179,0.12)",
                          },
                          { width: weekDayWidth },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => {
                          handleSelectDate(date);
                          setSelectedTab("day");
                        }}
                      >
                        <View style={styles.weekDayHeader}>
                          <ThemedText
                            style={[
                              styles.weekCellWeekday,
                              { color: textSecondary },
                              isToday && styles.weekCellWeekdayActive,
                              isToday && { color: accentColor },
                            ]}
                          >
                            {new Intl.DateTimeFormat(PLANNER_LOCALE_TAG, {
                              weekday: "short",
                            }).format(date)}
                          </ThemedText>
                          <View
                            style={[
                              styles.weekHeaderBadgeSmall,
                              {
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(255,255,255,0.24)",
                                borderColor: isDark
                                  ? "rgba(255,255,255,0.2)"
                                  : "rgba(255,255,255,0.5)",
                              },
                              isToday && styles.weekHeaderBadgeToday,
                              isToday && {
                                backgroundColor: accentColor,
                                borderColor: accentColor,
                              },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.weekHeaderBadgeText,
                                { color: textPrimary },
                                isToday && styles.weekHeaderBadgeTextToday,
                              ]}
                            >
                              {date.getDate()}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText
                          style={[styles.weekDateLabel, { color: textMuted }]}
                        >
                          {new Intl.DateTimeFormat(PLANNER_LOCALE_TAG, {
                            month: "short",
                            day: "2-digit",
                          }).format(date)}
                        </ThemedText>

                        <View style={styles.weekItems}>
                          <View
                            style={[
                              styles.weekTimelineLine,
                              {
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.2)"
                                  : "rgba(125,90,80,0.25)",
                              },
                            ]}
                          />
                          {combined.map((item) => {
                            const isAllDayEvent =
                              item.type === "event" && item.isAllDay;
                            const eventColor =
                              item.type === "event"
                                ? item.eventColor
                                : item.todoColor;
                            const safeTime = parseSafeDate(item.time);
                            const timeLabel = safeTime
                              ? new Intl.DateTimeFormat(PLANNER_LOCALE_TAG, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }).format(safeTime)
                              : "—";
                            const displayLabel = getDisplayAssigneeLabel(
                              item.assignee,
                              item.babyId,
                              item.ownerId,
                            );
                            const showDisplayLabel = !!displayLabel;
                            return (
                              <View key={item.id} style={styles.timelineRow}>
                                <View
                                  style={[
                                    styles.timelineDot,
                                    { backgroundColor: eventColor },
                                  ]}
                                />
                                <View style={styles.timelineContent}>
                                  {isAllDayEvent ? (
                                    <>
                                      <View style={styles.timelineTitleRow}>
                                        <View
                                          style={[
                                            styles.inlineEventIconBadge,
                                            {
                                              backgroundColor: toRgba(
                                                eventColor,
                                                isDark ? 0.9 : 0.82,
                                              ),
                                            },
                                          ]}
                                        >
                                          <IconSymbol
                                            name="calendar"
                                            size={11}
                                            color={
                                              (isDark ? "#fff" : textPrimary) as any
                                            }
                                          />
                                        </View>
                                        <Text
                                          numberOfLines={2}
                                          style={[
                                            styles.timelineTitle,
                                            styles.timelineTitleRowText,
                                            { color: textPrimary },
                                          ]}
                                        >
                                          {item.title}
                                        </Text>
                                        {showDisplayLabel && (
                                          <View
                                            style={[
                                              styles.ownerPill,
                                              {
                                                backgroundColor: toRgba(
                                                  eventColor,
                                                  isDark ? 0.26 : 0.18,
                                                ),
                                                borderColor: toRgba(
                                                  eventColor,
                                                  isDark ? 0.58 : 0.4,
                                                ),
                                              },
                                            ]}
                                          >
                                            <Text
                                              style={[
                                                styles.ownerPillText,
                                                {
                                                  color: eventColor,
                                                },
                                              ]}
                                            >
                                              {displayLabel}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                      <Text
                                        style={[
                                          styles.timelineAllDayLabel,
                                          { color: textMuted },
                                        ]}
                                      >
                                        {t('common.allDay')}
                                      </Text>
                                    </>
                                  ) : (
                                    <>
                                      <View style={styles.timelineMetaRow}>
                                        <Text
                                          style={[
                                            styles.timelineTime,
                                            { color: textMuted },
                                          ]}
                                        >
                                          {timeLabel}
                                        </Text>
                                        {showDisplayLabel && (
                                          <View
                                            style={[
                                              styles.ownerPill,
                                              {
                                                backgroundColor: toRgba(
                                                  eventColor,
                                                  isDark ? 0.26 : 0.18,
                                                ),
                                                borderColor: toRgba(
                                                  eventColor,
                                                  isDark ? 0.58 : 0.4,
                                                ),
                                              },
                                            ]}
                                          >
                                            <Text
                                              style={[
                                                styles.ownerPillText,
                                                {
                                                  color: eventColor,
                                                },
                                              ]}
                                            >
                                              {displayLabel}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                      <Text
                                        numberOfLines={2}
                                        style={[
                                          styles.timelineTitle,
                                          { color: textPrimary },
                                        ]}
                                      >
                                        {item.title}
                                      </Text>
                                    </>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                          {!hasItems && (
                            <Text
                              style={[
                                styles.emptyTextSmall,
                                { color: textMuted },
                              ]}
                            >
                              –
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </LiquidGlassCard>
            </View>
          ) : (
            <>
              <View style={{ paddingHorizontal: LAYOUT_PAD }}>
                <LiquidGlassCard
                  style={styles.calendarCard}
                  intensity={24}
                  overlayColor={glassOverlay}
                  borderColor={glassBorder}
                >
                  <ThemedText
                    style={[styles.calendarTitle, { color: textSecondary }]}
                  >
                    {t('calendar.month')}
                  </ThemedText>
                  <View style={styles.monthHeaderRow}>
                    {[t('weekday.mon'), t('weekday.tue'), t('weekday.wed'), t('weekday.thu'), t('weekday.fri'), t('weekday.sat'), t('weekday.sun')].map((d) => (
                      <ThemedText
                        key={d}
                        style={[styles.monthHeaderLabel, { color: textMuted }]}
                      >
                        {d}
                      </ThemedText>
                    ))}
                  </View>
                  <View style={styles.monthGrid}>
                    {monthDays.map((date) => {
                      const isSelected =
                        toDateKey(date) === toDateKey(selectedDate);
                      const isCurrentMonth =
                        date.getMonth() === selectedDate.getMonth();
                      const isToday = toDateKey(date) === toDateKey(new Date());
                      const stats = monthSummary[toDateKey(date)] ?? {
                        tasks: 0,
                        events: 0,
                        itemColors: [],
                      };
                      const hasData = stats.tasks > 0 || stats.events > 0;
                      const monthItemDots = stats.itemColors.slice(0, 3);
                      return (
                        <TouchableOpacity
                          key={date.toISOString()}
                          style={[
                            styles.monthCell,
                            isSelected && styles.monthCellActive,
                          ]}
                          onPress={() => {
                            handleSelectDate(date);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <View
                            style={[
                              styles.monthCircle,
                              {
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(255,255,255,0.38)",
                                borderColor: isDark
                                  ? "rgba(255,255,255,0.2)"
                                  : "rgba(255,255,255,0.55)",
                              },
                              isSelected && styles.monthCircleActive,
                              isSelected && {
                                backgroundColor: accentColor,
                                borderColor: accentColor,
                              },
                              !isCurrentMonth && styles.monthCircleFaded,
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.monthNumber,
                                { color: textPrimary },
                                !isCurrentMonth && styles.monthNumberFaded,
                                isSelected && styles.monthNumberActive,
                              ]}
                            >
                              {date.getDate()}
                            </ThemedText>
                          </View>
                          <View style={styles.monthDotRow}>
                            {isToday && (
                              <View
                                style={[
                                  styles.todayDotSmall,
                                  {
                                    marginRight: 3,
                                    backgroundColor: accentColor,
                                  },
                                ]}
                              />
                            )}
                            {isCurrentMonth &&
                              monthItemDots.map((color, index) => (
                                <View
                                  key={`${toDateKey(date)}-${color}-${index}`}
                                  style={[
                                    styles.dataDot,
                                    {
                                      backgroundColor: color,
                                      opacity: isCurrentMonth ? 1 : 0.55,
                                    },
                                  ]}
                                />
                              ))}
                            {isCurrentMonth &&
                              monthItemDots.length === 0 &&
                              hasData && (
                                <View
                                  style={[
                                    styles.dataDot,
                                    {
                                      backgroundColor: isDark
                                        ? "rgba(255,255,255,0.28)"
                                        : "rgba(125,90,80,0.35)",
                                    },
                                    styles.dataDotActive,
                                    { backgroundColor: accentColor },
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

              <View style={{ paddingHorizontal: LAYOUT_PAD, marginTop: 12 }}>
                <ThemedText
                  style={[
                    styles.sectionTitle,
                    { paddingHorizontal: 4, color: textSecondary },
                  ]}
                >
                  {formatDateHeader(selectedDate)}
                </ThemedText>
              </View>

              <StructuredTimelineView
                date={selectedDate}
                events={selectedDayTimeline.events}
                todos={selectedDayTimeline.todos}
                getOwnerLabel={getOwnerLabel}
                getAssigneeLabel={getAssigneeLabel}
                getEventColor={getEventColor}
                onToggleTodo={handleToggleItem}
                onMoveTomorrow={handleMoveTomorrow}
                onDelete={handleDeleteItem}
                onEditTodo={handleEditTodo}
                onEditEvent={handleEditEvent}
              />
            </>
          )}
        </ScrollView>

        {user?.id && (
          <FloatingAddButton
            onPress={() => openCapture("todo")}
            bottomInset={insets.bottom + 16}
            rightInset={16}
          />
        )}
      </SafeAreaView>

      <PlannerCaptureModalView
        visible={captureVisible}
        type={captureType}
        baseDate={selectedDate}
        editingItem={editingItem}
        ownerOptions={ownerOptions}
        babyOptions={babyOptions}
        defaultOwnerId={user?.id}
        onClose={handleCaptureClose}
        onSave={handleCaptureSave}
        onDelete={handleDeleteItem}
      />
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    opacity: 0.9,
  },
  timelineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 6,
  },
  timelineTitleLabel: {
    paddingHorizontal: 0,
  },
  timelineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  timelineBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  floatingCard: {
    paddingBottom: 12,
  },
  dayOverviewSection: {
    marginTop: -42,
  },
  dayOverviewHeader: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  calendarSyncGearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  calendarSyncPanel: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    marginTop: 8,
  },
  calendarSyncHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  calendarSyncTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  calendarSyncCopy: {
    flex: 1,
    minWidth: 0,
  },
  calendarSyncTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  calendarSyncSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_PRIMARY,
    opacity: 0.72,
  },
  calendarSyncFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  calendarSyncStatus: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  calendarSyncIconButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingList: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 4,
    gap: 0,
  },
  floatingItem: {
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  floatingDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginVertical: 6,
  },
  emptyFloating: {
    paddingVertical: 12,
  },
  emptyFloatingText: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    opacity: 0.7,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginTop: 10,
    marginBottom: 6,
    marginHorizontal: LAYOUT_PAD,
  },
  completedToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT_PAD,
    paddingVertical: 8,
  },
  completedToggleLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    opacity: 0.85,
  },
  completedToggleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  completedChevron: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT_PRIMARY,
    opacity: 0.75,
    paddingHorizontal: 4,
  },
  completedList: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 6,
  },
  topTabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 0,
    marginBottom: 6,
  },
  topTab: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
  },
  topTabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  activeTopTab: { borderColor: "rgba(94,61,179,0.65)" },
  topTabText: { fontSize: 13, fontWeight: "700", color: TEXT_PRIMARY },
  activeTopTabText: { color: PRIMARY },
  dayNavigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    marginTop: 0,
  },
  weekNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.3,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  weekNavButtonText: {
    fontSize: 22,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  weekHeaderCenter: {
    alignItems: "center",
    flex: 1,
  },
  weekHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
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
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 10,
    textAlign: "center",
  },
  weekDaysScroll: { paddingRight: 16, gap: 8 },
  weekDayCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    marginRight: 8,
    gap: 8,
    minHeight: 420,
  },
  weekDayCardToday: {
    borderColor: PRIMARY,
    backgroundColor: "rgba(94,61,179,0.12)",
  },
  weekDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weekHeaderBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  weekHeaderBadgeToday: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  weekHeaderBadgeText: { color: TEXT_PRIMARY, fontWeight: "700" },
  weekHeaderBadgeTextToday: { color: "#fff" },
  weekDateLabel: { fontSize: 12, color: TEXT_PRIMARY, opacity: 0.75 },
  weekItems: {
    gap: 8,
    marginTop: 6,
    position: "relative",
    paddingLeft: 12,
    paddingBottom: 16,
    minHeight: 320,
    justifyContent: "flex-start",
  },
  weekTimelineLine: {
    position: "absolute",
    left: 5,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(125,90,80,0.25)",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    backgroundColor: "#6e4dbd",
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timelineTime: {
    fontSize: 11,
    color: TEXT_PRIMARY,
    opacity: 0.7,
  },
  timelineAllDayLabel: {
    fontSize: 11,
    color: TEXT_PRIMARY,
    opacity: 0.7,
  },
  ownerPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  ownerPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    opacity: 0.85,
  },
  timelineTitle: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  timelineTitleRowText: {
    flex: 1,
  },
  weekCellWeekday: { fontSize: 12, color: TEXT_PRIMARY, opacity: 0.8 },
  weekCellWeekdayActive: { color: PRIMARY, fontWeight: "700", opacity: 1 },
  eventIcon: { fontSize: 14 },
  eventText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: "600", flex: 1 },
  emptyText: { fontSize: 12, color: TEXT_PRIMARY, opacity: 0.65 },
  monthHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthHeaderLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    opacity: 0.7,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
  },
  monthCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    paddingVertical: 4,
  },
  monthCellActive: {},
  monthCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
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
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  monthNumberFaded: { opacity: 0.6 },
  monthNumberActive: { color: "#fff" },
  todayDotSmall: {
    marginTop: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: PRIMARY,
  },
  monthDotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    gap: 2,
  },
  dataDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(125,90,80,0.35)",
  },
  dataDotActive: {
    backgroundColor: PRIMARY,
  },
  eventPillSmall: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 3,
    backgroundColor: "rgba(94,61,179,0.1)",
  },
  eventTextSmall: {
    fontSize: 11,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  inlineEventIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  todoRowSmall: {
    flexDirection: "row",
    alignItems: "center",
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
    textAlign: "center",
    marginTop: 8,
  },
});

function toDateKey(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
}
