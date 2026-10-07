import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type SleepChangeRecord = {
  id?: string;
  baby_id?: string | null;
  user_id?: string;
  partner_id?: string | null;
  shared_with_user_id?: string | null;
};

type SleepChange = RealtimePostgresChangesPayload<SleepChangeRecord>;

export interface SleepEntriesSyncOptions {
  userId?: string | null;
  babyId?: string | null;
  enabled: boolean;
  entryIds: readonly string[];
  onRefresh: () => Promise<void>;
  onInvalidate: () => void;
}

const REFRESH_DEBOUNCE_MS = 200;
let nextSubscriptionId = 0;

/** Refresh the visible sleep screen after partner changes and missed events. */
export function useSleepEntriesSync({
  userId,
  babyId,
  enabled,
  entryIds,
  onRefresh,
  onInvalidate,
}: SleepEntriesSyncOptions) {
  const callbacksRef = useRef({ onRefresh, onInvalidate });
  const entryIdsRef = useRef(new Set(entryIds));

  // Callbacks and known entries change with the screen state, without creating
  // another subscription or dropping the connection on every timer render.
  useEffect(() => {
    callbacksRef.current = { onRefresh, onInvalidate };
    entryIdsRef.current = new Set(entryIds);
  }, [entryIds, onInvalidate, onRefresh]);

  useFocusEffect(useCallback(() => {
    if (!enabled || !userId) return;

    let focused = true;
    let appState = AppState.currentState;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let refreshing = false;
    let refreshPending = false;

    const cancelTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const scheduleRefresh = () => {
      if (!focused || appState !== 'active' || refreshing) return;
      cancelTimer();
      timer = setTimeout(() => { void flushRefresh(); }, REFRESH_DEBOUNCE_MS);
    };

    const flushRefresh = async () => {
      cancelTimer();
      if (!focused || appState !== 'active' || refreshing || !refreshPending) return;
      refreshPending = false;
      refreshing = true;
      try {
        await callbacksRef.current.onRefresh();
      } catch (error) {
        console.warn('[SleepEntriesSync] Failed to refresh sleep entries:', error);
      } finally {
        refreshing = false;
        // A change received during a request must be read after that request.
        if (focused && refreshPending) scheduleRefresh();
      }
    };

    const requestRefresh = (immediate = false) => {
      if (!focused) return;
      // Prevent a pre-event snapshot from reviving a stopped timer while the
      // debounced request is still waiting to start.
      callbacksRef.current.onInvalidate();
      refreshPending = true;
      if (appState !== 'active' || refreshing) return;
      if (immediate) {
        void flushRefresh();
      } else {
        scheduleRefresh();
      }
    };

    const onDelete = (payload: SleepChange) => {
      const id = (payload.old as Partial<SleepChangeRecord>).id;
      // DELETE may contain only the primary key. The extra unfiltered binding
      // must never reload this screen for other users' unknown deleted rows.
      if (id && entryIdsRef.current.has(id)) requestRefresh();
    };

    const onChange = (payload: SleepChange) => {
      if (payload.eventType === 'DELETE') {
        onDelete(payload);
        return;
      }

      const next = payload.new;
      const previous = payload.old as Partial<SleepChangeRecord>;
      const id = next.id ?? previous.id;
      if (babyId && !(id && entryIdsRef.current.has(id))) {
        // Include legacy NULL rows and moves out of the current baby. Missing
        // old-row metadata on UPDATE cannot prove that the row was irrelevant:
        // the initial snapshot may still be loading its ID into the screen.
        const nextIsOtherBaby = next.baby_id != null && next.baby_id !== babyId;
        const previousIsOtherBaby = previous.baby_id != null && previous.baby_id !== babyId;
        if (nextIsOtherBaby && (payload.eventType === 'INSERT' || previousIsOtherBaby)) return;
      }
      requestRefresh();
    };

    // Topics are unique because removeChannel finishes asynchronously; rapid
    // blur/focus must not reuse a channel that is still being removed.
    const channel = supabase.channel(`sleep-screen-sync-${userId}-${++nextSubscriptionId}`);
    for (const column of ['user_id', 'partner_id', 'shared_with_user_id']) {
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sleep_entries',
        filter: `${column}=eq.${userId}`,
      }, onChange);
    }
    channel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'sleep_entries',
    }, onDelete);
    channel.subscribe((status) => {
      // The SDK rejoins automatically. Read the snapshot after every join,
      // since events missed while disconnected are not replayed.
      if (status === 'SUBSCRIBED') requestRefresh();
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const returning = appState !== 'active' && nextState === 'active';
      appState = nextState;
      if (nextState !== 'active') cancelTimer();
      if (returning) requestRefresh(true);
    });

    requestRefresh(true);

    return () => {
      focused = false;
      refreshPending = false;
      cancelTimer();
      callbacksRef.current.onInvalidate();
      appStateSubscription.remove();
      void supabase.removeChannel(channel).catch((error) => {
        console.warn('[SleepEntriesSync] Failed to remove sleep subscription:', error);
      });
    };
  }, [babyId, enabled, userId]));
}
