import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getPartnerId } from '@/lib/accountLinks';
import { pollPartnerActivities, getUnreadPartnerNotificationCount } from '@/lib/partnerNotificationService';

const POLLING_INTERVAL = 30000; // 30 seconds

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

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
    if (isPolling) {
      console.log('⏸️ Already polling, skipping...');
      return;
    }

    setIsPolling(true);
    try {
      const newNotifications = await pollPartnerActivities();
      if (newNotifications > 0) {
        console.log(`📬 Displayed ${newNotifications} partner notifications`);
      }

      // Update unread count
      const count = await getUnreadPartnerNotificationCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error polling partner activities:', error);
    } finally {
      setIsPolling(false);
    }
  }, [isPolling]);

  /**
   * Start polling for partner activities
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('⏸️ Polling already started');
      return;
    }

    console.log('▶️ Starting partner notification polling (every 30s)');

    // Poll immediately
    poll();

    // Setup interval
    pollingIntervalRef.current = setInterval(() => {
      const currentState = appState.current;
      // Only poll when app is active or in background
      if (currentState === 'active' || currentState === 'background') {
        poll();
      } else {
        console.log('⏸️ App inactive, skipping poll');
      }
    }, POLLING_INTERVAL);
  }, [poll]);

  /**
   * Stop polling for partner activities
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('⏹️ Stopping partner notification polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
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
      console.log('📱 App state changed:', appState.current, '→', nextAppState);
      appState.current = nextAppState;

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
