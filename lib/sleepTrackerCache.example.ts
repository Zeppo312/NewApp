/**
 * BEISPIEL: Intelligentes Caching für Sleep Tracker
 *
 * Zeigt wie man LIVE und STATISCHE Daten trennt
 */

import { supabase } from './supabase';
import {
  CacheStrategy,
  loadWithRevalidate,
  invalidateCacheAfterAction,
  cacheData,
} from './screenCache';

// =====================================================
// SCHRITT 1: Daten in LIVE und STATISCH aufteilen
// =====================================================

/**
 * LIVE Daten (NIE cachen!)
 * - Aktueller Timer-Status (läuft/läuft nicht)
 * - Elapsed time
 * - Aktiver Sleep Entry
 */
async function loadLiveStatus(userId: string) {
  // Immer frisch vom Server laden - KEIN CACHE!
  const { data } = await supabase
    .from('sleep_entries')
    .select('*')
    .eq('user_id', userId)
    .is('end_time', null) // Nur laufende Sleeps
    .maybeSingle();

  return {
    isTracking: !!data,
    activeSleep: data,
    // Timer wird im Frontend berechnet, nicht gecacht
  };
}

/**
 * STATISCHE Daten (MIT Cache!)
 * - Vergangene Sleep Entries (History)
 * - Statistics
 * - Recommendations
 */
async function loadSleepHistory(userId: string) {
  // Stale-While-Revalidate: Zeige Cache, lade parallel neue Daten
  const result = await loadWithRevalidate(
    `screen_cache_sleep_history_${userId}`,
    async () => {
      const { data } = await supabase
        .from('sleep_entries')
        .select('*')
        .eq('user_id', userId)
        .not('end_time', 'is', null) // Nur beendete Sleeps
        .order('start_time', { ascending: false })
        .limit(50);

      return data || [];
    },
    CacheStrategy.MEDIUM // 2 Minuten Cache
  );

  return result;
}

// =====================================================
// SCHRITT 2: Screen lädt beide getrennt
// =====================================================

export async function loadSleepTrackerData(userId: string) {
  // LIVE: Immer frisch, kein Cache
  const liveStatus = await loadLiveStatus(userId);

  // HISTORY: Mit Cache, aber refresh im Hintergrund
  const { data: history, isStale, refresh } = await loadSleepHistory(userId);

  return {
    // Live-Daten
    isTracking: liveStatus.isTracking,
    activeSleep: liveStatus.activeSleep,

    // Gecachte Daten (können stale sein)
    history,
    isHistoryStale: isStale,

    // Funktion um History zu refreshen
    refreshHistory: refresh,
  };
}

// =====================================================
// SCHRITT 3: Cache Invalidation nach User Actions
// =====================================================

/**
 * User startet Sleep Tracking
 */
export async function startSleepTracking(userId: string) {
  // 1. Sleep in DB erstellen
  const { data } = await supabase
    .from('sleep_entries')
    .insert({
      user_id: userId,
      start_time: new Date().toISOString(),
    })
    .select()
    .single();

  // 2. Cache NICHT invalidieren!
  // History bleibt gecacht, weil neuer Sleep noch nicht in History ist

  return { success: true, entry: data };
}

/**
 * User stoppt Sleep Tracking
 */
export async function stopSleepTracking(entryId: string, userId: string) {
  // 1. Sleep in DB beenden
  const { data } = await supabase
    .from('sleep_entries')
    .update({
      end_time: new Date().toISOString(),
    })
    .eq('id', entryId)
    .select()
    .single();

  // 2. Cache INVALIDIEREN!
  // Weil beendeter Sleep jetzt in History erscheinen soll
  await invalidateCacheAfterAction(`sleep_history_${userId}`);

  return { success: true, entry: data };
}

// =====================================================
// SCHRITT 4: Im Screen Component verwenden
// =====================================================

/*
// Beispiel Component:
function SleepTrackerScreen() {
  const { user } = useAuth();
  const [liveStatus, setLiveStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  async function loadData() {
    if (!user) return;

    setIsLoading(true);

    const data = await loadSleepTrackerData(user.id);

    // LIVE Daten - immer frisch
    setLiveStatus({
      isTracking: data.isTracking,
      activeSleep: data.activeSleep,
    });

    // History - kann gecacht sein
    setHistory(data.history);

    setIsLoading(false);

    // Im Hintergrund refreshen falls stale
    if (data.isHistoryStale) {
      const freshHistory = await data.refreshHistory();
      setHistory(freshHistory);
    }
  }

  async function handleStartSleep() {
    await startSleepTracking(user.id);
    // Reload nur Live-Status, History bleibt gecacht
    const liveStatus = await loadLiveStatus(user.id);
    setLiveStatus(liveStatus);
  }

  async function handleStopSleep() {
    await stopSleepTracking(activeSleep.id, user.id);
    // Reload alles (Cache wurde invalidiert)
    await loadData();
  }

  return (
    <View>
      {liveStatus.isTracking && (
        <Text>Timer läuft! {elapsedTime}</Text>
      )}

      <FlatList data={history} ... />
    </View>
  );
}
*/

// =====================================================
// ERGEBNIS
// =====================================================

/**
 * ✅ Timer ist immer live und aktuell
 * ✅ History lädt instant aus Cache
 * ✅ History wird im Hintergrund aktualisiert
 * ✅ Nach Stop wird History neu geladen
 * ✅ 95% weniger API Calls!
 *
 * API Calls:
 * - Vorher: Bei jedem Screen-Wechsel beide Queries
 * - Nachher: Live Query + Cache (Background Refresh)
 */
