import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SupabaseErrorHandler } from '@/lib/errorHandler';

interface DebugInfo {
  timestamp: string;
  operation: string;
  errorCode?: string;
  errorMessage?: string;
  userMessage?: string;
  context?: string;
  retryable?: boolean;
}

export const DebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking...');

  useEffect(() => {
    // Check connection status
    const checkConnection = async () => {
      try {
        const result = await SupabaseErrorHandler.checkConnection();
        setConnectionStatus(result.connected ? '✅ Connected' : `❌ ${result.error}`);
      } catch (err) {
        setConnectionStatus('❌ Connection check failed');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Add debug log entry
  const addDebugLog = (info: DebugInfo) => {
    setDebugLogs(prev => [info, ...prev.slice(0, 9)]); // Keep last 10 entries
  };

  // Expose to global for easy access
  useEffect(() => {
    (global as any).addDebugLog = addDebugLog;
    return () => {
      delete (global as any).addDebugLog;
    };
  }, []);

  if (!__DEV__) return null;

  return (
    <>
      {/* Debug Toggle Button */}
      <TouchableOpacity
        style={styles.debugToggle}
        onPress={() => setIsVisible(!isVisible)}
      >
        <Text style={styles.debugToggleText}>
          {isVisible ? '🔽' : '🔼'} Debug
        </Text>
      </TouchableOpacity>

      {/* Debug Panel */}
      {isVisible && (
        <View style={styles.debugPanel}>
          <ScrollView style={styles.debugScroll}>
            <Text style={styles.debugTitle}>🔍 Debug Panel</Text>
            
            {/* Connection Status */}
            <View style={styles.debugSection}>
              <Text style={styles.sectionTitle}>📡 Connection Status</Text>
              <Text style={styles.debugText}>{connectionStatus}</Text>
            </View>

            {/* Recent Errors */}
            <View style={styles.debugSection}>
              <Text style={styles.sectionTitle}>💥 Recent Errors</Text>
              {debugLogs.length === 0 ? (
                <Text style={styles.debugText}>No errors logged</Text>
              ) : (
                debugLogs.map((log, index) => (
                  <View key={index} style={styles.errorEntry}>
                    <Text style={styles.errorTimestamp}>{log.timestamp}</Text>
                    <Text style={styles.errorOperation}>Operation: {log.operation}</Text>
                    {log.errorCode && (
                      <Text style={styles.errorCode}>Code: {log.errorCode}</Text>
                    )}
                    {log.errorMessage && (
                      <Text style={styles.errorMessage}>Message: {log.errorMessage}</Text>
                    )}
                    {log.userMessage && (
                      <Text style={styles.userMessage}>User: {log.userMessage}</Text>
                    )}
                    {log.context && (
                      <Text style={styles.errorContext}>Context: {log.context}</Text>
                    )}
                    {log.retryable !== undefined && (
                      <Text style={styles.retryable}>
                        Retryable: {log.retryable ? 'Yes' : 'No'}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.debugSection}>
              <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  addDebugLog({
                    timestamp: new Date().toISOString(),
                    operation: 'Manual Test',
                    errorCode: 'TEST',
                    errorMessage: 'Manual debug log entry',
                    userMessage: 'Test error message',
                    context: 'Debug Panel',
                    retryable: false
                  });
                }}
              >
                <Text style={styles.debugButtonText}>Add Test Log</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => setDebugLogs([])}
              >
                <Text style={styles.debugButtonText}>Clear Logs</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  debugToggle: {
    position: 'absolute',
    top: 100,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1000,
  },
  debugToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  debugPanel: {
    position: 'absolute',
    top: 140,
    right: 10,
    width: 300,
    maxHeight: 400,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    padding: 16,
    zIndex: 999,
  },
  debugScroll: {
    flex: 1,
  },
  debugTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  debugSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  debugText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
  },
  errorEntry: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  errorTimestamp: {
    color: '#888',
    fontSize: 10,
    marginBottom: 4,
  },
  errorOperation: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  errorCode: {
    color: '#ff6b6b',
    fontSize: 11,
    marginBottom: 2,
  },
  errorMessage: {
    color: '#ffd93d',
    fontSize: 11,
    marginBottom: 2,
  },
  userMessage: {
    color: '#6bcf7f',
    fontSize: 11,
    marginBottom: 2,
  },
  errorContext: {
    color: '#74c0fc',
    fontSize: 11,
    marginBottom: 2,
  },
  retryable: {
    color: '#f8f9fa',
    fontSize: 11,
    fontStyle: 'italic',
  },
  debugButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
}); 