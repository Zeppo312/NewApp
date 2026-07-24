import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getPartnerId } from '@/lib/accountLinks';
import { pollPartnerActivities, getUnreadPartnerNotificationCount } from '@/lib/partnerNotificationService';

const POLLING_INTERVAL = 30000; // 30 seconds
const activePollingInstances = new Set<symbol>();
const unreadCountSubscribers = new Set<(count: number) => void>();

let sharedPollingInterval: ReturnType<typeof setInterval> | null = null;
let sharedPollInFlight = false;
let sharedUnreadCount = 0;
let sharedAppState: AppStateStatus = AppState.currentState;

function broadcastUnreadCount(count: number) {
  sharedUnreadCount = count;
  unreadCountSubscribers.forEach((callback) => callback(count));
}

async function runSharedPoll() {
  if (sharedPollInFlight) {
    return;
  }

  sharedPollInFlight = true;
  try {
    const newNotifications = await pollPartnerActivities();
    if (newNotifications > 0) {
      console.log(`📬 Displayed ${newNotifications} partner notifications`);
    }

    const count = await getUnreadPartnerNotificationCount();
    broadcastUnreadCount(count);
  } catch (error) {
    console.error('Error polling partner activities:', error);
  } finally {
    sharedPollInFlight = false;
  }
}

function startSharedPolling() {
  if (sharedPollingInterval) {
    return;
  }

  console.log('▶️ Starting partner notification polling (every 30s)');
  runSharedPoll();

  sharedPollingInterval = setInterval(() => {
    if (sharedAppState === 'active' || sharedAppState === 'background') {
      runSharedPoll();
    } else {
      console.log('⏸️ App inactive, skipping poll');
    }
  }, POLLING_INTERVAL);
}

function stopSharedPolling() {
  if (!sharedPollingInterval) {
    return;
  }

  console.log('⏹️ Stopping partner notification polling');
  clearInterval(sharedPollingInterval);
  sharedPollingInterval = null;
}

/**
 * Hook for managing partner activity notifications
 *
 * Features:
 * - Checks if partner is linked
 * - Polls for new partner activities every 30 seconds
 * - Only polls when app is active or in background (not inactive/closed)
 * - Displays local notifications for partner activities
 *
 * Usage:
 * ```typescript
 * const { isPartnerLinked, partnerId, unreadCount } = usePartnerNotifications();
 * ```
 */
export function usePartnerNotifications() {
  const [isPartnerLinked, setIsPartnerLinked] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(sharedUnreadCount);
  const instanceIdRef = useRef(Symbol('partner-notification-hook'));
  const isInstancePollingActiveRef = useRef(false);

  /**
   * Check if a partner is linked and get their ID
   */
  const checkPartnerLink = useCallback(async () => {
    try {
      const id = await getPartnerId();
      setPartnerId(id);
      setIsPartnerLinked(!!id);

      if (id) {
        console.log('✅ Partner linked:', id);
      } else {
        console.log('ℹ️ No partner linked');
      }

      return !!id;
    } catch (error) {
      console.error('Error checking partner link:', error);
      setPartnerId(null);
      setIsPartnerLinked(false);
      return false;
    }
  }, []);

  /**
   * Poll for new partner activities
   */
  const poll = useCallback(async () => {
    await runSharedPoll();
  }, []);

  /**
   * Start polling for partner activities
   */
  const startPolling = useCallback(() => {
    if (isInstancePollingActiveRef.current) {
      return;
    }

    isInstancePollingActiveRef.current = true;
    activePollingInstances.add(instanceIdRef.current);
    startSharedPolling();
  }, []);

  /**
   * Stop polling for partner activities
   */
  const stopPolling = useCallback(() => {
    if (!isInstancePollingActiveRef.current) {
      return;
    }

    isInstancePollingActiveRef.current = false;
    activePollingInstances.delete(instanceIdRef.current);

    if (activePollingInstances.size === 0) {
      stopSharedPolling();
    }
  }, []);

  /**
   * Manually trigger a poll (useful after creating an entry)
   */
  const triggerPoll = useCallback(() => {
    poll();
  }, [poll]);

  // Check partner link on mount
  useEffect(() => {
    checkPartnerLink();
  }, [checkPartnerLink]);

  useEffect(() => {
    const onUnreadCountChange = (count: number) => {
      setUnreadCount(count);
    };

    unreadCountSubscribers.add(onUnreadCountChange);
    setUnreadCount(sharedUnreadCount);

    return () => {
      unreadCountSubscribers.delete(onUnreadCountChange);
    };
  }, []);

  // Setup polling when partner is linked
  useEffect(() => {
    if (!isPartnerLinked) {
      stopPolling();
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [isPartnerLinked, startPolling, stopPolling]);

  // Listen to app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('📱 App state changed:', sharedAppState, '→', nextAppState);
      sharedAppState = nextAppState;

      // If app becomes active and partner is linked, poll immediately
      if (nextAppState === 'active' && isPartnerLinked) {
        console.log('📱 App became active, triggering poll');
        poll();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isPartnerLinked, poll]);

  return {
    isPartnerLinked,
    partnerId,
    unreadCount,
    triggerPoll,
    checkPartnerLink,
  };
}
