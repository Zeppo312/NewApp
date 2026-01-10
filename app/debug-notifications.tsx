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

    const { data: userData } = await supabase.auth.getUser();
    addLog(`Current User ID: ${userData?.user?.id || 'NONE'}`);

    const { data: links } = await supabase
      .from('account_links')
      .select('*')
      .eq('status', 'accepted');
    addLog(`Account links: ${JSON.stringify(links)}`);
  };

  const testDatabaseNotifications = async () => {
    addLog('Checking database notifications...');
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('partner_activity_notifications')
      .select('*')
      .eq('user_id', userData?.user?.id || '')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      addLog(`ERROR: ${error.message}`);
    } else {
      addLog(`Found ${data?.length || 0} notifications in DB`);
      data?.forEach(n => {
        addLog(`- ${n.activity_type} (read: ${n.is_read})`);
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
    const { data: userData } = await supabase.auth.getUser();

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
