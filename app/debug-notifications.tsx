import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { usePartnerNotifications } from '@/hooks/usePartnerNotifications';
import { pollPartnerActivities, getUnreadPartnerNotificationCount } from '@/lib/partnerNotificationService';
import { getPartnerId } from '@/lib/accountLinks';
import { supabase } from '@/lib/supabase';

export default function DebugNotificationsScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const { isPartnerLinked, partnerId, triggerPoll } = usePartnerNotifications();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 20));
    console.log(message);
  };

  const testPartnerLink = async () => {
    addLog('Testing partner link...');
    const id = await getPartnerId();
    addLog(`Partner ID: ${id || 'NONE'}`);

    const { data: userData } = await getCachedUser();
    addLog(`Current User ID: ${userData?.user?.id || 'NONE'}`);

    const { data: links } = await supabase
      .from('account_links')
      .select('*')
      .eq('status', 'accepted');
    addLog(`Account links: ${JSON.stringify(links)}`);
  };

  const testDatabaseNotifications = async () => {
    addLog('Checking database notifications...');
    const { data: userData } = await getCachedUser();

    // Check notifications FOR me (from partner)
    const { data: forMe, error: error1 } = await supabase
      .from('partner_activity_notifications')
      .select('*')
      .eq('user_id', userData?.user?.id || '')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error1) {
      addLog(`ERROR getting notifications FOR me: ${error1.message}`);
    } else {
      addLog(`📥 FOR ME (from partner): ${forMe?.length || 0} notifications`);
      forMe?.forEach(n => {
        addLog(`  - ${n.activity_type} (read: ${n.is_read}, id: ${n.id.substring(0, 8)})`);
      });
    }

    // Check notifications FOR partner (created by me)
    const { data: byMe, error: error2 } = await supabase
      .from('partner_activity_notifications')
      .select('*')
      .eq('partner_id', userData?.user?.id || '')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error2) {
      addLog(`ERROR getting notifications BY me: ${error2.message}`);
    } else {
      addLog(`📤 BY ME (for partner): ${byMe?.length || 0} notifications`);
      byMe?.forEach(n => {
        addLog(`  - ${n.activity_type} (read: ${n.is_read}, id: ${n.id.substring(0, 8)})`);
      });
    }
  };

  const testPoll = async () => {
    addLog('Triggering manual poll...');
    const count = await pollPartnerActivities();
    addLog(`Poll result: ${count} new notifications`);
  };

  const testUnreadCount = async () => {
    addLog('Checking unread count...');
    const count = await getUnreadPartnerNotificationCount();
    addLog(`Unread count: ${count}`);
  };

  const testCreateNotification = async () => {
    addLog('Creating test sleep entry...');
    const { data: userData } = await getCachedUser();

    const { data, error } = await supabase
      .from('sleep_entries')
      .insert({
        user_id: userData?.user?.id,
        start_time: new Date().toISOString(),
      })
      .select();

    if (error) {
      addLog(`ERROR creating entry: ${error.message}`);
    } else {
      addLog(`Created entry: ${data?.[0]?.id}`);
      addLog('Check if notification was created...');
      setTimeout(testDatabaseNotifications, 1000);
    }
  };

  const testPushTokens = async () => {
    addLog('Checking push token registration...');
    const { data: userData } = await getCachedUser();

    if (!userData?.user) {
      addLog('❌ ERROR: Not logged in');
      return;
    }

    const currentUserId = userData.user.id;
    addLog(`Current User: ${currentUserId.substring(0, 8)}...`);

    // Check current user's tokens
    const { data: myTokens, error: myError } = await supabase
      .from('user_push_tokens')
      .select('*')
      .eq('user_id', currentUserId);

    if (myError) {
      addLog(`❌ ERROR: ${myError.message}`);
      return;
    }

    if (!myTokens || myTokens.length === 0) {
      addLog('⚠️ No push tokens registered for you');
      addLog('The app should register a token on startup');
      addLog('Try restarting the app');
    } else {
      addLog(`✅ Found ${myTokens.length} push token(s):`);
      myTokens.forEach((token, i) => {
        addLog(`  ${i + 1}. Device: ${token.device_type || 'unknown'}`);
        addLog(`     Token: ${token.token.substring(0, 40)}...`);
        addLog(`     Created: ${new Date(token.created_at).toLocaleString()}`);
      });
    }

    // Check partner's tokens
    const partnerId = await getPartnerId();
    if (partnerId) {
      addLog('');
      addLog(`Partner: ${partnerId.substring(0, 8)}...`);

      const { data: partnerTokens, error: partnerError } = await supabase
        .from('user_push_tokens')
        .select('*')
        .eq('user_id', partnerId);

      if (partnerError) {
        addLog(`❌ ERROR: ${partnerError.message}`);
      } else if (!partnerTokens || partnerTokens.length === 0) {
        addLog('⚠️ Partner has no push tokens registered');
      } else {
        addLog(`✅ Partner has ${partnerTokens.length} push token(s)`);
      }
    }
  };

  const testPlannerNotifications = async () => {
    addLog('📋 CHECKING PLANNER NOTIFICATIONS...');
    const { data: userData } = await getCachedUser();

    if (!userData?.user) {
      addLog('❌ ERROR: Not logged in');
      return;
    }

    // Check planner notifications
    const { data: plannerNotifs, error } = await supabase
      .from('planner_notifications')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('scheduled_for', { ascending: false })
      .limit(10);

    if (error) {
      addLog(`❌ ERROR: ${error.message}`);
      return;
    }

    addLog(`Found ${plannerNotifs?.length || 0} planner notifications:`);
    plannerNotifs?.forEach(n => {
      const scheduled = new Date(n.scheduled_for);
      const isPast = scheduled <= new Date();
      addLog(`  - ${n.notification_type} (${isPast ? '🔴 DUE' : '🟢 FUTURE'})`);
      addLog(`    Scheduled: ${scheduled.toLocaleString()}`);
      addLog(`    Sent: ${n.sent ? '✓ Yes' : '✗ No'}`);
      addLog(`    ID: ${n.id.substring(0, 8)}...`);
    });
  };

  const testCreatePlannerEvent = async () => {
    addLog('📅 CREATING TEST PLANNER EVENT...');
    const { data: userData } = await getCachedUser();

    if (!userData?.user) {
      addLog('❌ ERROR: Not logged in');
      return;
    }

    // Create event for 20 minutes from now
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() + 20);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    addLog(`Event will start at: ${startTime.toLocaleTimeString()}`);
    addLog('Notification should arrive in ~5 minutes (15 min before event)');

    // Get or create today's planner_day
    const today = new Date().toISOString().split('T')[0];

    let { data: day, error: dayError } = await supabase
      .from('planner_days')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('day', today)
      .maybeSingle();

    if (!day) {
      const { data: newDay, error: createError } = await supabase
        .from('planner_days')
        .insert({ user_id: userData.user.id, day: today })
        .select()
        .single();

      if (createError) {
        addLog(`❌ ERROR creating day: ${createError.message}`);
        return;
      }
      day = newDay;
    }

    // Create the event
    const { data: event, error: eventError } = await supabase
      .from('planner_items')
      .insert({
        user_id: userData.user.id,
        day_id: day.id,
        entry_type: 'event',
        title: 'Test Notification Event',
        start_at: startTime.toISOString(),
        end_at: endTime.toISOString(),
        location: 'Debug Screen',
      })
      .select()
      .single();

    if (eventError) {
      addLog(`❌ ERROR: ${eventError.message}`);
      return;
    }

    addLog(`✓ Event created: ${event.id.substring(0, 8)}...`);

    // Wait and check if notification was created
    addLog('Waiting for trigger to create notification...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: notif, error: notifError } = await supabase
      .from('planner_notifications')
      .select('*')
      .eq('planner_item_id', event.id)
      .maybeSingle();

    if (notifError) {
      addLog(`❌ ERROR: ${notifError.message}`);
      return;
    }

    if (!notif) {
      addLog('❌ ERROR: No notification created by trigger!');
      return;
    }

    const notifTime = new Date(notif.scheduled_for);
    addLog(`✓ Notification scheduled for: ${notifTime.toLocaleTimeString()}`);
    addLog(`  Type: ${notif.notification_type}`);
    addLog(`  Reminder: ${notif.reminder_minutes} minutes before`);

    const minutesUntilNotif = Math.round((notifTime.getTime() - new Date().getTime()) / 60000);
    addLog(`⏰ Notification will arrive in ~${minutesUntilNotif} minutes`);
  };

  const testManualTriggerCheck = async () => {
    addLog('⚙️ MANUALLY TRIGGERING NOTIFICATION CHECK...');

    const { error } = await supabase.rpc('check_due_planner_notifications');

    if (error) {
      addLog(`❌ ERROR: ${error.message}`);
      return;
    }

    addLog('✓ Check function executed');
    addLog('Check planner notifications to see if any were marked as sent');

    // Check for sent notifications
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testPlannerNotifications();
  };

  const testPlannerNotificationChain = async () => {
    addLog('🧪 STARTING PLANNER NOTIFICATION CHAIN TEST');
    addLog('================================================');

    const { data: userData } = await getCachedUser();

    if (!userData?.user) {
      addLog('❌ ERROR: Not logged in');
      return;
    }

    addLog(`✓ Current User ID: ${userData.user.id.substring(0, 8)}...`);

    // Step 1: Check push tokens
    addLog('');
    addLog('STEP 1: Checking push tokens...');
    const { data: tokens } = await supabase
      .from('user_push_tokens')
      .select('token, device_type')
      .eq('user_id', userData.user.id);

    if (!tokens || tokens.length === 0) {
      addLog('⚠️ WARNING: No push tokens found');
      addLog('Open the app on your device to register a token');
    } else {
      addLog(`✓ Found ${tokens.length} push token(s)`);
    }

    // Step 2: Create test event
    addLog('');
    addLog('STEP 2: Creating test event...');
    await testCreatePlannerEvent();

    // Step 3: Instructions
    addLog('');
    addLog('================================================');
    addLog('✅ TEST SETUP COMPLETE');
    addLog('');
    addLog('What should happen:');
    addLog('1. Wait ~5 minutes for notification time');
    addLog('2. pg_cron checks every minute for due notifications');
    addLog('3. When due, webhook triggers Edge Function');
    addLog('4. Push notification arrives on your device');
    addLog('');
    addLog('To test immediately:');
    addLog('- Use "⚙️ Manual Trigger Check" button');
    addLog('- Or check Supabase Edge Function logs');
  };

  const testPushNotificationChain = async () => {
    addLog('🧪 STARTING FULL PUSH NOTIFICATION CHAIN TEST');
    addLog('================================================');

    const { data: userData } = await getCachedUser();
    const currentUserId = userData?.user?.id;

    if (!currentUserId) {
      addLog('❌ ERROR: Not logged in');
      return;
    }

    addLog(`✓ Current User ID: ${currentUserId.substring(0, 8)}...`);

    // Step 1: Check if user has a partner
    addLog('');
    addLog('STEP 1: Checking partner link...');
    const partnerId = await getPartnerId();

    if (!partnerId) {
      addLog('❌ ERROR: No partner linked!');
      addLog('You need to link with a partner first');
      return;
    }

    addLog(`✓ Partner ID: ${partnerId.substring(0, 8)}...`);

    // Step 2: Check if user has push tokens registered
    addLog('');
    addLog('STEP 2: Checking push tokens...');
    const { data: myTokens } = await supabase
      .from('user_push_tokens')
      .select('token, device_type')
      .eq('user_id', currentUserId);

    if (!myTokens || myTokens.length === 0) {
      addLog('⚠️ WARNING: No push tokens found for current user');
      addLog('Open the app on your device to register a token');
    } else {
      addLog(`✓ Found ${myTokens.length} push token(s) for current user`);
      myTokens.forEach((t, i) => {
        addLog(`  Token ${i + 1}: ${t.token.substring(0, 30)}... (${t.device_type})`);
      });
    }

    // Step 3: Check partner's push tokens
    addLog('');
    addLog('STEP 3: Checking partner push tokens...');
    const { data: partnerTokens } = await supabase
      .from('user_push_tokens')
      .select('token, device_type')
      .eq('user_id', partnerId);

    if (!partnerTokens || partnerTokens.length === 0) {
      addLog('⚠️ WARNING: Partner has no push tokens');
      addLog('Partner needs to open the app to register');
    } else {
      addLog(`✓ Partner has ${partnerTokens.length} push token(s)`);
    }

    // Step 4: Create a test sleep entry (triggers notification for partner)
    addLog('');
    addLog('STEP 4: Creating test sleep entry...');
    const { data: sleepEntry, error: sleepError } = await supabase
      .from('sleep_entries')
      .insert({
        user_id: currentUserId,
        start_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (sleepError) {
      addLog(`❌ ERROR creating sleep entry: ${sleepError.message}`);
      return;
    }

    addLog(`✓ Created sleep entry: ${sleepEntry.id.substring(0, 8)}...`);

    // Step 5: Wait and check if notification was created
    addLog('');
    addLog('STEP 5: Waiting for trigger to create notification...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: notifications, error: notifError } = await supabase
      .from('partner_activity_notifications')
      .select('*')
      .eq('entry_id', sleepEntry.id)
      .eq('user_id', partnerId);

    if (notifError) {
      addLog(`❌ ERROR checking notifications: ${notifError.message}`);
      return;
    }

    if (!notifications || notifications.length === 0) {
      addLog('❌ ERROR: No notification created by trigger!');
      addLog('Check database trigger logs');
      return;
    }

    addLog(`✓ Notification created: ${notifications[0].id.substring(0, 8)}...`);
    addLog(`  Activity: ${notifications[0].activity_type}`);
    addLog(`  For user: ${notifications[0].user_id.substring(0, 8)}...`);

    // Step 6: Check Edge Function logs (if accessible)
    addLog('');
    addLog('STEP 6: Checking Edge Function execution...');
    addLog('⚠️ Check Supabase Dashboard > Edge Functions > Logs');
    addLog('   to see if webhook was triggered');

    // Step 7: Summary
    addLog('');
    addLog('================================================');
    addLog('✅ TEST COMPLETE');
    addLog('');
    addLog('What should happen:');
    addLog('1. Partner should receive push notification');
    addLog('2. Notification should appear even if app is closed');
    addLog('3. Check partner device for notification');
    addLog('');
    addLog('If partner did NOT receive notification:');
    addLog('- Check Supabase Edge Function logs');
    addLog('- Verify partner has push tokens registered');
    addLog('- Check app notification permissions');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Notification Debug Screen</Text>

        <View style={styles.status}>
          <Text style={styles.statusText}>
            Partner Linked: {isPartnerLinked ? '✅ YES' : '❌ NO'}
          </Text>
          <Text style={styles.statusText}>
            Partner ID: {partnerId || 'NONE'}
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={testPushNotificationChain}
          >
            <Text style={styles.buttonText}>🧪 TEST PUSH NOTIFICATION CHAIN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testPushTokens}>
            <Text style={styles.buttonText}>📱 Check Push Tokens</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testPartnerLink}>
            <Text style={styles.buttonText}>1. Test Partner Link</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testDatabaseNotifications}>
            <Text style={styles.buttonText}>2. Check DB Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testUnreadCount}>
            <Text style={styles.buttonText}>3. Test Unread Count</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testPoll}>
            <Text style={styles.buttonText}>4. Trigger Manual Poll</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={testCreateNotification}>
            <Text style={styles.buttonText}>5. Create Test Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={() => setLogs([])}
          >
            <Text style={styles.buttonText}>Clear Logs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logs}>
          <Text style={styles.logsTitle}>Logs:</Text>
          {logs.map((log, i) => (
            <Text key={i} style={styles.logText}>{log}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  status: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 8,
  },
  buttons: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#8E4EC6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#E94560',
    marginBottom: 16,
  },
  clearButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  logs: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    minHeight: 200,
  },
  logsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logText: {
    color: '#0f0',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
