import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BabyInfo, createBaby, listBabies, syncBabiesForLinkedUsers } from '@/lib/baby';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

type ActiveBabyContextType = {
  babies: BabyInfo[];
  activeBabyId: string | null;
  activeBaby: BabyInfo | null;
  isLoading: boolean;
  isReady: boolean;
  loadError: string | null;
  setActiveBabyId: (babyId: string) => Promise<void>;
  refreshBabies: () => Promise<void>;
};

const ACTIVE_BABY_STORAGE_KEY = 'active_baby_id';

const ActiveBabyContext = createContext<ActiveBabyContextType | undefined>(
  undefined,
);

export const ActiveBabyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();

  const [babies, setBabies] = useState<BabyInfo[]>([]);
  const [activeBabyId, setActiveBabyIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const formatLoadError = useCallback((error: unknown) => {
    if (!error) return null;
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object') {
      const err = error as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      const parts = [
        err.message,
        err.details,
        err.hint,
        err.code ? `code: ${err.code}` : null,
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(' | ');
      try {
        return JSON.stringify(error);
      } catch {
        return '[unlesbarer Fehler]';
      }
    }
    return String(error);
  }, []);

  /**
   * Resolves which baby should be active:
   * 1) Stored baby id (AsyncStorage)
   * 2) First baby in list
   * 3) null
   *
   * IMPORTANT:
   * - Returns resolvedId so caller can decide when state is stable
   */
  const resolveActiveBabyId = useCallback(
    async (nextBabies: BabyInfo[]): Promise<string | null> => {
      const storedId = await AsyncStorage.getItem(ACTIVE_BABY_STORAGE_KEY);
      const firstWithBirthDate = nextBabies.find((b) => Boolean(b.birth_date))?.id ?? null;

      const resolvedId =
        nextBabies.find((b) => b.id === storedId)?.id ??
        firstWithBirthDate ??
        nextBabies[0]?.id ??
        null;

      setActiveBabyIdState(resolvedId);

      if (resolvedId) {
        await AsyncStorage.setItem(ACTIVE_BABY_STORAGE_KEY, resolvedId);
      } else {
        await AsyncStorage.removeItem(ACTIVE_BABY_STORAGE_KEY);
      }

      return resolvedId;
    },
    [],
  );

  /**
   * Loads babies from DB and guarantees:
   * - at least one baby exists
   * - activeBabyId is resolved BEFORE isReady = true
   *
   * OPTIMIZATION: Nutzt Cache für schnelles Laden (5 Min Cache)
   */
  const loadBabies = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setBabies([]);
      setActiveBabyIdState(null);
      setIsLoading(false);
      setIsReady(true);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setIsReady(false);

    const { data, error } = await listBabies(forceRefresh);
    if (error) {
      console.error('Error loading babies:', error);
      setBabies([]);
      setActiveBabyIdState(null);
      setIsLoading(false);
      setIsReady(true);
      setLoadError(formatLoadError(error));
      return;
    }

    let nextBabies = data ?? [];
    setLoadError(null);

    // Try to pull shared babies from linked accounts before creating a placeholder
    if (nextBabies.length === 0) {
      const syncResult = await syncBabiesForLinkedUsers();
      if (syncResult.success) {
        const { data: reloaded } = await listBabies(true);
        nextBabies = reloaded ?? [];
      }
    }

    // Skip auto-creation while the profile is unfinished (early onboarding)
    if (nextBabies.length === 0) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .maybeSingle();

        if (!profileError || profileError?.code === 'PGRST116') {
          if (!profileData || !profileData.first_name) {
            setBabies([]);
            setActiveBabyIdState(null);
            setIsLoading(false);
            setIsReady(true);
            setLoadError(null);
            return;
          }
        }

        if (profileError && profileError.code !== 'PGRST116') {
          setBabies([]);
          setActiveBabyIdState(null);
          setIsLoading(false);
          setIsReady(true);
          setLoadError(null);
          console.error('Error loading profile during baby sync:', profileError);
          return;
        }
      } catch (profileCheckError) {
        console.error('Unexpected error during profile check:', profileCheckError);
      }
    }

    // Ensure at least one baby exists
    if (nextBabies.length === 0) {
      const { error: createError } = await createBaby({});
      if (createError) {
        console.error('Error creating default baby:', createError);
        setLoadError(formatLoadError(createError));
      } else {
        // Force refresh after creating baby to skip cache
        const { data: reloaded } = await listBabies(true);
        nextBabies = reloaded ?? [];
      }
    }

    setBabies(nextBabies);

    const resolvedId = await resolveActiveBabyId(nextBabies);

    if (!resolvedId) {
      console.warn('[ActiveBaby] No active baby could be resolved');
    }

    setIsLoading(false);
    setIsReady(true);
  }, [user, resolveActiveBabyId]);

  /**
   * Initial load + reload on login change
   */
  useEffect(() => {
    loadBabies();
  }, [loadBabies]);

  /**
   * Explicit baby switch (BabySwitcher)
   * IMPORTANT:
   * - temporarily sets isReady=false to avoid race conditions
   */
  const setActiveBabyId = useCallback(async (babyId: string) => {
    setIsReady(false);

    setActiveBabyIdState(babyId);
    await AsyncStorage.setItem(ACTIVE_BABY_STORAGE_KEY, babyId);

    setIsReady(true);
  }, []);

  const activeBaby = useMemo(
    () => babies.find((b) => b.id === activeBabyId) ?? null,
    [babies, activeBabyId],
  );

  const refreshBabiesForced = useCallback(async () => {
    await loadBabies(true); // Force refresh = skip cache
  }, [loadBabies]);

  return (
    <ActiveBabyContext.Provider
      value={{
        babies,
        activeBabyId,
        activeBaby,
        isLoading,
        isReady,
        loadError,
        setActiveBabyId,
        refreshBabies: refreshBabiesForced,
      }}
    >
      {children}
    </ActiveBabyContext.Provider>
  );
};

export const useActiveBaby = () => {
  const context = useContext(ActiveBabyContext);
  if (!context) {
    throw new Error('useActiveBaby must be used within an ActiveBabyProvider');
  }
  return context;
};
