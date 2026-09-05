import { supabase } from './supabase';

/**
 * Debug-Funktion zum Tracken aktiver Realtime Subscriptions
 */
export function logActiveSubscriptions() {
  const channels = supabase.getChannels();
  console.log('=== REALTIME DEBUG ===');
  console.log(`Aktive Channels: ${channels.length}`);
  channels.forEach((channel, index) => {
    console.log(`  Channel ${index + 1}: ${channel.topic} (State: ${channel.state})`);
  });
  console.log('=====================');
  return channels.length;
}

/**
 * Hook zum periodischen Loggen der aktiven Subscriptions
 * Nur für Debugging - später entfernen!
 */
export function startSubscriptionMonitoring(intervalSeconds: number = 10) {
  console.log(`🔍 Starting subscription monitoring (every ${intervalSeconds}s)`);

  const interval = setInterval(() => {
    const count = logActiveSubscriptions();
    if (count > 10) {
      console.warn(`⚠️ WARNING: ${count} active subscriptions detected! This is unusually high.`);
    }
  }, intervalSeconds * 1000);

  return () => {
    console.log('🛑 Stopping subscription monitoring');
    clearInterval(interval);
  };
}
