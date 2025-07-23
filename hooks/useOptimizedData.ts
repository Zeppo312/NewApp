import { useState, useEffect, useCallback, useMemo } from 'react';
import { CacheManager } from '@/lib/optimizedDatabase';
import { useAuth } from '@/contexts/AuthContext';

// Hook für optimiertes Laden von Benutzerdaten
export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const profileData = await CacheManager.getUserProfile(user.id);
      setProfile(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return { profile, loading, error, refetch: loadProfile };
}

// Hook für optimiertes Laden von Baby-Daten
export function useBabyData() {
  const { user } = useAuth();
  const [babyInfo, setBabyInfo] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<any>(null);
  const [phaseProgress, setPhaseProgress] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBabyData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Diese Imports müssen lazy geladen werden, um die initiale Bundle-Größe zu reduzieren
      const { getBabyInfo, getCurrentPhase, getPhaseProgress, getMilestonesByPhase } = await import('@/lib/baby');
      
      // Parallele Ausführung der Datenabfragen
      const [
        { data: babyData },
        { data: phaseData }
      ] = await Promise.all([
        getBabyInfo(),
        getCurrentPhase()
      ]);

      setBabyInfo(babyData);
      setCurrentPhase(phaseData);

      if (phaseData) {
        // Sequenzielle Ausführung nur wenn nötig
        const [progressData, { data: milestonesData }] = await Promise.all([
          getPhaseProgress(phaseData.phase_id),
          getMilestonesByPhase(phaseData.phase_id)
        ]);

        setPhaseProgress(progressData);
        setMilestones(milestonesData || []);
      }
    } catch (err) {
      console.error('Error loading baby data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadBabyData();
  }, [loadBabyData]);

  return { 
    babyInfo, 
    currentPhase, 
    phaseProgress, 
    milestones, 
    loading, 
    refetch: loadBabyData 
  };
}

// Hook für optimiertes Laden von Tagebuch-Daten
export function useDiaryData(limit = 5) {
  const { user } = useAuth();
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);
  const [dailyEntries, setDailyEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDiaryData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { getDiaryEntries, getDailyEntries } = await import('@/lib/baby');
      const today = new Date();

      // Parallele Ausführung
      const [
        { data: diaryData },
        { data: dailyData }
      ] = await Promise.all([
        getDiaryEntries(),
        getDailyEntries(undefined, today)
      ]);

      setDiaryEntries(diaryData?.slice(0, limit) || []);
      setDailyEntries(dailyData || []);
    } catch (err) {
      console.error('Error loading diary data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit]);

  useEffect(() => {
    loadDiaryData();
  }, [loadDiaryData]);

  return { diaryEntries, dailyEntries, loading, refetch: loadDiaryData };
}

// Hook für tägliche Statistiken mit Memoization
export function useDailySummary(dailyEntries: any[]) {
  const stats = useMemo(() => {
    const todayFeedings = dailyEntries.filter(entry => entry.entry_type === 'feeding').length;
    const todayDiaperChanges = dailyEntries.filter(entry => entry.entry_type === 'diaper').length;
    
    return {
      todayFeedings,
      todayDiaperChanges
    };
  }, [dailyEntries]);

  return stats;
}

// Hook für tägliche Tipps mit Memoization
export function useDailyTip(tips: string[]) {
  const dailyTip = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return tips[dayOfYear % tips.length];
  }, [tips]);

  return dailyTip;
}

// Hook für Schwangerschaftswoche mit Memoization
export function usePregnancyWeek(dueDate: Date | null) {
  const weekData = useMemo(() => {
    if (!dueDate) return { currentWeek: null, currentDay: null, isOverdue: false };

    const now = new Date();
    const timeDiff = dueDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) {
      // Überfällig
      return { 
        currentWeek: null, 
        currentDay: null, 
        isOverdue: true, 
        overdueDays: Math.abs(daysDiff) 
      };
    }

    // Schwangerschaftswoche berechnen (280 Tage = 40 Wochen)
    const totalDays = 280;
    const daysIntoPregnancy = totalDays - daysDiff;
    const currentWeek = Math.floor(daysIntoPregnancy / 7) + 1;
    const currentDay = (daysIntoPregnancy % 7) + 1;

    return { 
      currentWeek: Math.max(1, Math.min(40, currentWeek)),
      currentDay: Math.max(1, Math.min(7, currentDay)),
      isOverdue: false 
    };
  }, [dueDate]);

  return weekData;
}

// Hook für optimierte Refresh-Funktionalität
export function useOptimizedRefresh(refreshFunctions: (() => Promise<void>)[]) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Parallel ausführen für bessere Performance
      await Promise.all(refreshFunctions.map(fn => fn()));
      
      // Cache invalidieren
      await CacheManager.clearCache();
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFunctions]);

  return { refreshing, onRefresh };
}