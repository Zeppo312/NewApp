import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SupabaseErrorHandler } from '@/lib/errorHandler';

interface ConnectionStatusProps {
  showAlways?: boolean; // Show status even when connected
  autoCheck?: boolean; // Automatically check connection every few seconds
  onRetry?: () => void; // Callback when user clicks retry
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showAlways = false,
  autoCheck = true,
  onRetry
}) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    
    try {
      const result = await SupabaseErrorHandler.checkConnection();
      setIsConnected(result.connected);
      setError(result.error || null);
    } catch (err) {
      setIsConnected(false);
      setError('Verbindungstest fehlgeschlagen');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkConnection();

    // Auto-check every 30 seconds if enabled
    if (autoCheck) {
      const interval = setInterval(checkConnection, 30000);
      return () => clearInterval(interval);
    }
  }, [autoCheck]);

  const handleRetry = () => {
    checkConnection();
    onRetry?.();
  };

  // Don't show if connected and showAlways is false
  if (isConnected && !showAlways) {
    return null;
  }

  // Don't show during initial check
  if (isConnected === null && !isChecking) {
    return null;
  }

  const getStatusInfo = () => {
    if (isChecking) {
      return {
        icon: '🔄',
        color: '#ffa500',
        bgColor: 'rgba(255, 165, 0, 0.1)',
        message: 'Verbindung wird geprüft...'
      };
    }

    if (isConnected) {
      return {
        icon: '✅',
        color: '#28a745',
        bgColor: 'rgba(40, 167, 69, 0.1)',
        message: 'Verbindung zur Datenbank aktiv'
      };
    }

    return {
      icon: '⚠️',
      color: '#dc3545',
      bgColor: 'rgba(220, 53, 69, 0.1)',
      message: error || 'Keine Verbindung zur Datenbank'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <View style={[styles.container, { backgroundColor: statusInfo.bgColor }]}>
      <View style={styles.content}>
        <Text style={styles.iconText}>
          {statusInfo.icon}
        </Text>
        <Text style={[styles.message, { color: statusInfo.color }]}>
          {statusInfo.message}
        </Text>
      </View>
      
      {!isConnected && !isChecking && (
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconText: {
    fontSize: 16,
    marginRight: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 16,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
}); 