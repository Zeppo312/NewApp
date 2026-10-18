import { clearLocalHealthData } from '@/lib/localHealthStorage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BabyInfo, createBaby, listBabies, readSavedBabies, syncBabiesForLinkedUsers } from '@/lib/baby';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import { refreshBabyListWithRetry, type BabyListLoadResult } from '@/lib/babyListLoading';
import {
  getActiveBabyResolutionScope,
  isResolutionCurrent,
} from '@/lib/startupResolution';

type ActiveBabyContextType = {
  babies: BabyInfo[];
  activeBabyId: string | null;
  activeBaby: BabyInfo | null;
  isLoading: boolean;
  isReady: boolean;
  loadError: string | null;
  savedListAt?: string;
  setActiveBabyId: (babyId: string) => Promise<void>;
  refreshBabies: () => Promise<void>;
};

const ACTIVE_BABY_STORAGE_KEY_PREFIX = 'active_baby_id';

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
  const [resolvedScope, setResolvedScope] = useState<string | null>(null);
  const [savedListAt, setSavedListAt] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentScope = getActiveBabyResolutionScope(user?.id);
  const isDataForCurrentUser = isResolutionCurrent(resolvedScope, currentScope);
  const isReadyForCurrentUser =
    isReady && isDataForCurrentUser;
  const userId = user?.id;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const latestState = useRef({ babies, activeBabyId, resolvedScope });
  latestState.current = { babies, activeBabyId, resolvedScope };
  const selectionRevision = useRef(0);
  const pendingLoad = useRef<{
    userId: string;
    forced: boolean;
    controller: AbortController;
    promise: Promise<void>;
  } | null>(null);

  const getActiveBabyStorageKey = useCallback((userId: string) => {
    return `${ACTIVE_BABY_STORAGE_KEY_PREFIX}:${userId}`;
  }, []);

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

  const shouldSkipPlaceholderBabyCreation = useCallback(async () => {
    if (!user?.id) return false;

    try {
      const { data, error } = await supabase
        .from('account_links')
        .select('id, status')
        .eq('invited_id', user.id)
        .in('status', ['pending', 'accepted'])
        .limit(1);

      if (error) {
        console.error('Error checking incoming account links before placeholder baby creation:', error);
        return false;
      }

      return (data?.length ?? 0) > 0;
    } catch (error) {
      console.error('Unexpected error checking incoming account links:', error);
      return false;
    }
  }, [user?.id]);

  /**
   * Resolves which baby should be active:
   * 1) Current selection, then stored baby id (AsyncStorage)
   * 2) First baby in list
   * 3) null
   *
   * IMPORTANT:
   * - Returns resolvedId so caller can decide when state is stable
   */
  const resolveActiveBabyId = useCallback(
    async (nextBabies: BabyInfo[], isCurrent: () => boolean): Promise<string | null> => {
      if (!user?.id) {
        return null;
      }

      const scopedStorageKey = getActiveBabyStorageKey(user.id);
      const revision = selectionRevision.current;
      const storedId =
        await AsyncStorage.getItem(scopedStorageKey) ??
        await AsyncStorage.getItem(ACTIVE_BABY_STORAGE_KEY_PREFIX);
      if (!isCurrent() || revision !== selectionRevision.current) return latestState.current.activeBabyId;
      const firstWithBirthDate = nextBabies.find((b) => Boolean(b.birth_date))?.id ?? null;
      const currentId = latestState.current.resolvedScope === currentScope
        ? latestState.current.activeBabyId
        : null;

      const resolvedId =
        nextBabies.find((b) => b.id === currentId)?.id ??
        nextBabies.find((b) => b.id === storedId)?.id ??
        firstWithBirthDate ??
        nextBabies[0]?.id ??
        null;

      await AsyncStorage.removeItem(ACTIVE_BABY_STORAGE_KEY_PREFIX);
      if (!isCurrent() || revision !== selectionRevision.current) return latestState.current.activeBabyId;

      if (resolvedId) {
        await AsyncStorage.setItem(scopedStorageKey, resolvedId);
      } else {
        await AsyncStorage.removeItem(scopedStorageKey);
      }
      if (!isCurrent() || revision !== selectionRevision.current) return latestState.current.activeBabyId;

      return resolvedId;
    },
    [currentScope, getActiveBabyStorageKey, user?.id],
  );

  /**
   * Loads babies from DB and guarantees:
   * - at least one baby exists
   * - activeBabyId is resolved BEFORE isReady = true
   *
   * OPTIMIZATION: Nutzt Cache für schnelles Laden (5 Min Cache)
   */
  const loadBabies = useCallback((forceRefresh = false): Promise<void> => {
    if (!userId) {
      pendingLoad.current?.controller.abort();
      pendingLoad.current = null;
      setBabies([]);
      setActiveBabyIdState(null);
      setIsLoading(false);
      setIsReady(true);
      setResolvedScope(getActiveBabyResolutionScope(null));
      setLoadError(null);
      return Promise.resolve();
    }

    const existing = pendingLoad.current;
    if (existing?.userId === userId && !existing.controller.signal.aborted && (!forceRefresh || existing.forced)) return existing.promise;
    existing?.controller.abort();
    const request = {
      userId,
      forced: forceRefresh,
      controller: new AbortController(),
      promise: Promise.resolve(),
    };
    pendingLoad.current = request;
    const isCurrent = () => pendingLoad.current === request &&
      userIdRef.current === userId && !request.controller.signal.aborted;
    const scope = getActiveBabyResolutionScope(userId);
    const handleError = (result: BabyListLoadResult) => {
      if (!isCurrent()) return;
      const canKeepExisting = result.retryable === true &&
        latestState.current.resolvedScope === scope && latestState.current.babies.length > 0;
      if (!canKeepExisting) {
        if ((result.error as any)?.code === '42501') void clearLocalHealthData(userId);
        setBabies([]);
        setActiveBabyIdState(null);
      }
      setIsLoading(false);
      setIsReady(true);
      setResolvedScope(scope);
      setLoadError(formatLoadError(result.error));
    };
    const readFresh = () => refreshBabyListWithRetry(
      (signal) => listBabies(true, signal), request.controller.signal,
    );

    request.promise = (async () => {
      setIsLoading(true);
      setLoadError(null);
      if (latestState.current.resolvedScope !== scope) setSavedListAt(undefined);
      // Refreshing the selector must not invalidate a usable active child.
      if (latestState.current.resolvedScope !== scope || latestState.current.babies.length === 0) {
        setIsReady(false);
      }

      const saved = await readSavedBabies(userId);
      if (!isCurrent()) return;
      if (saved && saved.data.length > 0) {
        const storedId = await AsyncStorage.getItem(getActiveBabyStorageKey(userId));
        if (!isCurrent()) return;
        if (storedId && saved.data.some(baby => baby.id === storedId)) {
          setSavedListAt(saved.verifiedAt); setBabies(saved.data); setActiveBabyIdState(storedId); setIsReady(true); setResolvedScope(scope);
          latestState.current = { babies: saved.data, activeBabyId: storedId, resolvedScope: scope };
        }
      }
      let result = forceRefresh ? await readFresh() : await listBabies(false, request.controller.signal);
      if (result.fromCache && !result.error) result = await readFresh();
      if (!isCurrent()) return;
      if (result.error) { handleError(result); return; }

      let nextBabies = result.data ?? [];
      const removedIds = latestState.current.babies.filter(baby => !nextBabies.some(next => next.id === baby.id)).map(baby => baby.id);
      for (const removedId of removedIds) await clearLocalHealthData(userId, removedId);
      if (!isCurrent()) return;
      setLoadError(null);

      // Try to pull shared babies from linked accounts before creating a placeholder
      if (nextBabies.length === 0) {
        const syncResult = await syncBabiesForLinkedUsers();
        if (!isCurrent()) return;
        if (syncResult.success) {
          const reloaded = await readFresh();
          if (!isCurrent()) return;
          if (reloaded.error) { handleError(reloaded); return; }
          nextBabies = reloaded.data ?? [];
        }
      }

      // Skip auto-creation while the profile is unfinished (early onboarding)
      if (nextBabies.length === 0) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', userId)
            .maybeSingle();
          if (!isCurrent()) return;

          if (!profileError || profileError?.code === 'PGRST116') {
            if (!profileData || !profileData.first_name) {
              setBabies([]);
              setActiveBabyIdState(null);
              setIsLoading(false);
              setIsReady(true);
              setResolvedScope(scope);
              setLoadError(null);
              return;
            }
          }

          if (profileError && profileError.code !== 'PGRST116') {
            setBabies([]);
            setActiveBabyIdState(null);
            setIsLoading(false);
            setIsReady(true);
            setResolvedScope(scope);
            setLoadError(null);
            console.error('Error loading profile during baby sync:', profileError);
            return;
          }
        } catch (profileCheckError) {
          if (!isCurrent()) return;
          console.error('Unexpected error during profile check:', profileCheckError);
        }
      }

      // Ensure at least one baby exists
      if (nextBabies.length === 0) {
        // Give partner sync one final chance before creating a local placeholder baby.
        const finalSyncResult = await syncBabiesForLinkedUsers();
        if (!isCurrent()) return;
        if (finalSyncResult.success) {
          const reloaded = await readFresh();
          if (!isCurrent()) return;
          if (reloaded.error) { handleError(reloaded); return; }
          nextBabies = reloaded.data ?? [];
        }
      }

      if (nextBabies.length === 0) {
        const skipPlaceholderBabyCreation = await shouldSkipPlaceholderBabyCreation();
        if (!isCurrent()) return;
        if (skipPlaceholderBabyCreation) {
          setBabies([]);
          setActiveBabyIdState(null);
          setIsLoading(false);
          setIsReady(true);
          setResolvedScope(scope);
          setLoadError(null);
          return;
        }

        const { error: createError } = await createBaby({});
        if (!isCurrent()) return;
        if (createError) {
          console.error('Error creating default baby:', createError);
          setLoadError(formatLoadError(createError));
        } else {
          // Force refresh after creating baby to skip cache
          const reloaded = await readFresh();
          if (!isCurrent()) return;
          if (reloaded.error) { handleError(reloaded); return; }
          nextBabies = reloaded.data ?? [];
        }
      }

      const resolvedId = await resolveActiveBabyId(nextBabies, isCurrent);
      if (!isCurrent()) return;
      // Commit list and selection together, keeping the old active child usable
      // while persisted selection is being resolved.
      setSavedListAt(undefined); setBabies(nextBabies);
      setActiveBabyIdState(resolvedId);

      if (!resolvedId) {
        console.warn('[ActiveBaby] No active baby could be resolved');
      }

      setIsLoading(false);
      setIsReady(true);
      setResolvedScope(scope);
    })().catch((error: unknown) => {
      handleError({ data: null, error, retryable: false });
    }).finally(() => {
      if (pendingLoad.current === request) pendingLoad.current = null;
    });
    return request.promise;
  }, [formatLoadError, resolveActiveBabyId, shouldSkipPlaceholderBabyCreation, userId, getActiveBabyStorageKey]);

  /**
   * Initial load + reload on login change
   */
  useEffect(() => {
    void loadBabies();
    return () => { pendingLoad.current?.controller.abort(); };
  }, [loadBabies]);

  /**
   * Explicit baby switch (BabySwitcher)
   * IMPORTANT:
   * - temporarily sets isReady=false to avoid race conditions
   */
  const setActiveBabyId = useCallback(async (babyId: string) => {
    if (!user?.id) return;

    setIsReady(false);

    selectionRevision.current += 1;
    latestState.current.activeBabyId = babyId;
    setActiveBabyIdState(babyId);
    await AsyncStorage.removeItem(ACTIVE_BABY_STORAGE_KEY_PREFIX);
    await AsyncStorage.setItem(getActiveBabyStorageKey(user.id), babyId);
    if (userIdRef.current !== user.id) return;

    setIsReady(true);
    setResolvedScope(getActiveBabyResolutionScope(user.id));
  }, [getActiveBabyStorageKey, user?.id]);

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
        babies: isDataForCurrentUser ? babies : [],
        activeBabyId: isDataForCurrentUser ? activeBabyId : null,
        activeBaby: isDataForCurrentUser ? activeBaby : null,
        isLoading: isLoading || !isDataForCurrentUser,
        isReady: isReadyForCurrentUser,
        loadError,
        savedListAt: isDataForCurrentUser ? savedListAt : undefined,
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
