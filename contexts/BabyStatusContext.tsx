import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInMonths } from 'date-fns';
import { getBabyBornStatus, setBabyBornStatus } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { getBabyInfo, saveBabyInfo } from '@/lib/baby';
import { useActiveBaby } from './ActiveBabyContext';

type BabyStatusSource = 'cache' | 'baby_info' | 'user_settings' | 'default' | 'error' | 'local_action';
type SetBabyBornOptions = {
  birthDate?: string | null;
  babyId?: string | null;
};
type TemporaryViewMode = 'baby' | 'pregnancy';

interface BabyStatusContextType {
  isBabyBorn: boolean;
  isResolved: boolean;
  source: BabyStatusSource;
  setIsBabyBorn: (value: boolean, options?: SetBabyBornOptions) => Promise<void>;
  temporaryViewMode: TemporaryViewMode | null;
  setTemporaryViewMode: (mode: TemporaryViewMode | null) => void;
  isLoading: boolean;
  babyAgeMonths: number;
  babyWeightPercentile: number;
  refreshBabyDetails: () => Promise<void>;
}

const BabyStatusContext = createContext<BabyStatusContextType | undefined>(undefined);
const BABY_STATUS_CACHE_PREFIX = 'baby_status_v1';
const TEMPORARY_VIEW_MODE_TIMEOUT_MS = 10 * 60 * 1000;

type CachedBabyStatus = {
  isBabyBorn: boolean;
  birthDate: string | null;
  source: BabyStatusSource;
  updatedAt: string;
};

export const BabyStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBabyBorn, setIsBabyBornState] = useState(false);
  const [temporaryViewMode, setTemporaryViewModeState] = useState<TemporaryViewMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolved, setIsResolved] = useState(false);
  const [source, setSource] = useState<BabyStatusSource>('default');
  const [babyAgeMonths, setBabyAgeMonths] = useState(0); // Standardwert: 0 Monate
  const [babyWeightPercentile, setBabyWeightPercentile] = useState(50); // Standardwert: 50. Perzentile
  const { user } = useAuth();
  const { activeBabyId, isReady: isActiveBabyReady } = useActiveBaby();
  const latestRequestIdRef = useRef(0);
  const temporaryViewModeResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTemporaryViewModeResetTimer = useCallback(() => {
    if (!temporaryViewModeResetTimerRef.current) return;
    clearTimeout(temporaryViewModeResetTimerRef.current);
    temporaryViewModeResetTimerRef.current = null;
  }, []);

  const setTemporaryViewMode = useCallback(
    (mode: TemporaryViewMode | null) => {
      clearTemporaryViewModeResetTimer();
      setTemporaryViewModeState(mode);

      if (!mode) return;

      temporaryViewModeResetTimerRef.current = setTimeout(() => {
        setTemporaryViewModeState(null);
        temporaryViewModeResetTimerRef.current = null;
      }, TEMPORARY_VIEW_MODE_TIMEOUT_MS);
    },
    [clearTemporaryViewModeResetTimer],
  );

  useEffect(
    () => () => {
      clearTemporaryViewModeResetTimer();
    },
    [clearTemporaryViewModeResetTimer],
  );

  const getCacheKey = useCallback(
    (userId: string, babyId: string | null) =>
      `${BABY_STATUS_CACHE_PREFIX}:${userId}:${babyId ?? 'none'}`,
    [],
  );

  const parseValidDate = useCallback((value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }, []);

  const applyResolvedState = useCallback(
    (status: { isBabyBorn: boolean; birthDate: string | null; source: BabyStatusSource }) => {
      setIsBabyBornState(status.isBabyBorn);
      setSource(status.source);
      if (status.birthDate) {
        const parsed = parseValidDate(status.birthDate);
        if (parsed) {
          const ageInMonths = differenceInMonths(new Date(), parsed);
          setBabyAgeMonths(Math.max(0, ageInMonths));
        } else {
          setBabyAgeMonths(0);
        }
      } else {
        setBabyAgeMonths(0);
      }
      setBabyWeightPercentile(50);
      setIsResolved(true);
    },
    [parseValidDate],
  );

  const readCachedStatus = useCallback(async () => {
    if (!user?.id) return null;
    try {
      const raw = await AsyncStorage.getItem(getCacheKey(user.id, activeBabyId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedBabyStatus;
      if (typeof parsed?.isBabyBorn !== 'boolean') return null;
      return parsed;
    } catch (error) {
      console.warn('Failed to read baby status cache:', error);
      return null;
    }
  }, [activeBabyId, getCacheKey, user?.id]);

  const writeCachedStatus = useCallback(
    async (status: { isBabyBorn: boolean; birthDate: string | null; source: BabyStatusSource }) => {
      if (!user?.id) return;
      const payload: CachedBabyStatus = {
        isBabyBorn: status.isBabyBorn,
        birthDate: status.birthDate,
        source: status.source,
        updatedAt: new Date().toISOString(),
      };
      try {
        await AsyncStorage.setItem(getCacheKey(user.id, activeBabyId), JSON.stringify(payload));
      } catch (error) {
        console.warn('Failed to write baby status cache:', error);
      }
    },
    [activeBabyId, getCacheKey, user?.id],
  );

  const resolveBabyDetails = useCallback(
    async (options?: { showLoading?: boolean; preferCache?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      const preferCache = options?.preferCache ?? true;

      if (!user) {
        latestRequestIdRef.current += 1;
        setIsBabyBornState(false);
        setSource('default');
        setBabyAgeMonths(0);
        setBabyWeightPercentile(50);
        setIsResolved(true);
        setIsLoading(false);
        return;
      }

      if (!isActiveBabyReady) {
        setIsResolved(false);
        setIsLoading(true);
        return;
      }

      const requestId = ++latestRequestIdRef.current;
      if (showLoading) {
        setIsLoading(true);
      }
      // Nur isResolved zurücksetzen wenn kein Cache erwartet wird,
      // damit isBabyBorn nicht kurz auf false springt und ein falsches Routing auslöst.
      if (!preferCache) {
        setIsResolved(false);
      }

      let hasCachedValue = false;
      if (preferCache) {
        const cached = await readCachedStatus();
        if (cached && requestId === latestRequestIdRef.current) {
          hasCachedValue = true;
          applyResolvedState({
            isBabyBorn: cached.isBabyBorn,
            birthDate: cached.birthDate,
            source: 'cache',
          });
        }
      }

      try {
        let remoteBirthDate: string | null = null;
        let babyInfoError: unknown = null;

        if (activeBabyId) {
          const { data: babyInfoData, error } = await getBabyInfo(activeBabyId);
          babyInfoError = error;
          if (babyInfoData?.birth_date) {
            remoteBirthDate = babyInfoData.birth_date;
          }
        }

        const { data: settingsIsBabyBorn, error: settingsError } = await getBabyBornStatus();

        if (requestId !== latestRequestIdRef.current) return;

        const noReliableSources =
          Boolean(settingsError) &&
          (!activeBabyId || Boolean(babyInfoError));

        if (noReliableSources) {
          if (!hasCachedValue) {
            applyResolvedState({ isBabyBorn: false, birthDate: null, source: 'error' });
          }
          return;
        }

        const fromBabyInfo = Boolean(remoteBirthDate);
        const fromSettings = !settingsError && settingsIsBabyBorn === true;
        const resolvedIsBabyBorn = fromBabyInfo || fromSettings;
        const resolvedSource: BabyStatusSource = fromBabyInfo
          ? 'baby_info'
          : fromSettings
            ? 'user_settings'
            : 'default';

        const resolved = {
          isBabyBorn: resolvedIsBabyBorn,
          birthDate: remoteBirthDate,
          source: resolvedSource,
        };

        applyResolvedState(resolved);
        await writeCachedStatus(resolved);
      } catch (error) {
        console.error('Error loading baby details:', error);
        if (requestId === latestRequestIdRef.current && !hasCachedValue) {
          applyResolvedState({ isBabyBorn: false, birthDate: null, source: 'error' });
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false);
          setIsResolved(true);
        }
      }
    },
    [activeBabyId, applyResolvedState, isActiveBabyReady, readCachedStatus, user, writeCachedStatus],
  );

  useEffect(() => {
    void resolveBabyDetails({ showLoading: true, preferCache: true });
  }, [resolveBabyDetails]);

  const setIsBabyBorn = async (value: boolean, options?: SetBabyBornOptions) => {
    if (!user) return;
    try {
      setTemporaryViewMode(null);
      setIsLoading(true);
      setSource('local_action');
      const targetBabyId = options?.babyId ?? activeBabyId;

      if (targetBabyId) {
        if (value) {
          if (options && Object.prototype.hasOwnProperty.call(options, 'birthDate')) {
            const { error: saveError } = await saveBabyInfo(
              { birth_date: options.birthDate ?? null },
              targetBabyId,
            );
            if (saveError) {
              throw saveError;
            }
          }
        } else {
          const { error: saveError } = await saveBabyInfo({ birth_date: null }, targetBabyId);
          if (saveError) {
            throw saveError;
          }
        }
      }

      const { error: statusError } = await setBabyBornStatus(value); // Partner-Sync
      if (statusError) {
        throw statusError;
      }

      await resolveBabyDetails({ showLoading: false, preferCache: false });
    } catch (error) {
      console.error('Error setting baby born status:', error);
      await resolveBabyDetails({ showLoading: false, preferCache: true });
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveIsBabyBorn =
    temporaryViewMode === 'baby'
      ? true
      : temporaryViewMode === 'pregnancy'
        ? false
        : isBabyBorn;

  return (
    <BabyStatusContext.Provider 
      value={{ 
        isBabyBorn: effectiveIsBabyBorn,
        isResolved,
        source,
        setIsBabyBorn, 
        temporaryViewMode,
        setTemporaryViewMode,
        isLoading, 
        babyAgeMonths,
        babyWeightPercentile,
        refreshBabyDetails: () => resolveBabyDetails({ showLoading: true, preferCache: true })
      }}
    >
      {children}
    </BabyStatusContext.Provider>
  );
};

export const useBabyStatus = () => {
  const context = useContext(BabyStatusContext);
  if (context === undefined) {
    throw new Error('useBabyStatus must be used within a BabyStatusProvider');
  }
  return context;
};
