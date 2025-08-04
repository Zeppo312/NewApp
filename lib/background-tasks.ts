import * as TaskManager from 'expo-task-manager';

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Constants
const CONTRACTION_TIMER_TASK = 'CONTRACTION_TIMER_TASK';
const CONTRACTION_TIMER_KEY = 'CONTRACTION_TIMER_DATA';

// Types
export type ContractionTimerData = {
  isRunning: boolean;
  startTime: number; // timestamp
  elapsedTime: number; // in seconds
  lastUpdated: number; // timestamp
};

// Register the background task
TaskManager.defineTask(CONTRACTION_TIMER_TASK, async () => {
  try {
    // Get current timer data
    const storedDataStr = await AsyncStorage.getItem(CONTRACTION_TIMER_KEY);
    if (!storedDataStr) {
      return "noData";
    }

    const timerData: ContractionTimerData = JSON.parse(storedDataStr);
    
    // If timer is running, update elapsed time
    if (timerData.isRunning) {
      const now = Date.now();
      const secondsSinceLastUpdate = Math.floor((now - timerData.lastUpdated) / 1000);
      
      const updatedTimerData: ContractionTimerData = {
        ...timerData,
        elapsedTime: timerData.elapsedTime + secondsSinceLastUpdate,
        lastUpdated: now
      };
      
      // Save updated data
      await AsyncStorage.setItem(CONTRACTION_TIMER_KEY, JSON.stringify(updatedTimerData));
      
      // Update notification
      await updateTimerNotification(updatedTimerData);
      
      return "newData";
    }
    
    return "noData";
  } catch (error) {
    console.error('Error in background task:', error);
    return "failed";
  }
});

// Format time for display (MM:SS)
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Register the background fetch

// Setup notifications
export const setupNotifications = async () => {
  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }

  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  return true;
};

// Create or update the timer notification
const updateTimerNotification = async (timerData: ContractionTimerData) => {
  if (!timerData.isRunning) {
    await Notifications.dismissAllNotificationsAsync();
    return;
  }

  const formattedTime = formatTime(timerData.elapsedTime);
  
  await Notifications.setNotificationCategoryAsync('timer', [
    {
      identifier: 'stop',
      buttonTitle: 'Wehe Beenden',
      options: {
        isDestructive: true,
      },
    },
  ]);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Wehen-Tracker läuft',
      body: `Timer: ${formattedTime}`,
      data: { screen: 'index' },
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: 'timer',
    },
    trigger: null, // Immediate notification
    identifier: 'contraction-timer', // Use the same identifier to replace existing notification
  });
};

// Start the timer in background
export const startContractionTimer = async () => {
  const now = Date.now();
  
  const timerData: ContractionTimerData = {
    isRunning: true,
    startTime: now,
    elapsedTime: 0,
    lastUpdated: now
  };
  
  // Save timer data
  await AsyncStorage.setItem(CONTRACTION_TIMER_KEY, JSON.stringify(timerData));
  
  // Update notification
  await updateTimerNotification(timerData);
  
  // Register background task if not already registered
  const isRegistered = await TaskManager.isTaskRegisteredAsync(CONTRACTION_TIMER_TASK);
  if (!isRegistered) {
    await registerBackgroundFetch();
  }
  
  return timerData;
};

// Stop the timer
export const stopContractionTimer = async () => {
  const storedDataStr = await AsyncStorage.getItem(CONTRACTION_TIMER_KEY);
  if (!storedDataStr) {
    return { isRunning: false, elapsedTime: 0, startTime: 0, lastUpdated: 0 };
  }
  
  const timerData: ContractionTimerData = JSON.parse(storedDataStr);
  
  // Update elapsed time one more time
  const now = Date.now();
  const secondsSinceLastUpdate = Math.floor((now - timerData.lastUpdated) / 1000);
  
  const finalTimerData: ContractionTimerData = {
    isRunning: false,
    startTime: timerData.startTime,
    elapsedTime: timerData.elapsedTime + secondsSinceLastUpdate,
    lastUpdated: now
  };
  
  // Save final data
  await AsyncStorage.setItem(CONTRACTION_TIMER_KEY, JSON.stringify(finalTimerData));
  
  // Clear notification
  await Notifications.dismissAllNotificationsAsync();
  
  return finalTimerData;
};

// Get current timer state
export const getContractionTimerState = async (): Promise<ContractionTimerData> => {
  const storedDataStr = await AsyncStorage.getItem(CONTRACTION_TIMER_KEY);
  if (!storedDataStr) {
    return {
      isRunning: false,
      startTime: 0,
      elapsedTime: 0,
      lastUpdated: 0
    };
  }
  
  const timerData: ContractionTimerData = JSON.parse(storedDataStr);
  
  // If timer is running, calculate current elapsed time
  if (timerData.isRunning) {
    const now = Date.now();
    const secondsSinceLastUpdate = Math.floor((now - timerData.lastUpdated) / 1000);
    
    return {
      ...timerData,
      elapsedTime: timerData.elapsedTime + secondsSinceLastUpdate,
      lastUpdated: now
    };
  }
  
  return timerData;
};

// For iOS Dynamic Island - configure ActivityState for live activities
export const setupDynamicIsland = async () => {
  if (Platform.OS !== 'ios') return;
  
  // This would require implementing a native module for LiveActivities
  // Since we can't implement native code directly here, we'll comment this out
  
  // The actual implementation would:
  // 1. Create a LiveActivity to show the timer in Dynamic Island
  // 2. Update the activity as the timer changes
  // 3. End the activity when the timer stops
  
  // For a real implementation, you would need to:
  // 1. Add the ActivityKit framework to your iOS project
  // 2. Create a WidgetKit extension
  // 3. Implement a Live Activity with a timeline provider
  // 4. Bridge this to React Native
  
  console.log('Dynamic Island would be configured here with native code implementation');
}; 