import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

/** Device-local favorites, isolated by account. Writes finish before UI confirmation. */
export function useRecipeFavorites(userId: string | undefined) {
  const [state, setState] = useState<{ userId?: string; ids: string[]; ready: boolean }>({ ids: [], ready: false });
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const generation = useRef(0);
  const writing = useRef(false);
  const key = userId ? `recipe-favorites:v1:${userId}` : null;

  useEffect(() => {
    const current = ++generation.current;
    let active = true;
    writing.current = false;
    // Reset account-scoped UI before loading the next account’s persisted data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(false);
    setLoadError(false);
    setState({ userId, ids: [], ready: false });
    if (key) {
      void AsyncStorage.getItem(key).then(raw => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed) || !parsed.every(id => typeof id === 'string')) {
          throw new Error('Invalid recipe favorites');
        }
        if (active && generation.current === current) setState({ userId, ids: [...new Set(parsed)], ready: true });
      }).catch(() => {
        if (active) setLoadError(true);
      });
    }
    return () => { active = false; generation.current = current + 1; };
  }, [key, userId]);

  const ready = state.userId === userId && state.ready;
  const ids = ready ? state.ids : [];
  const toggle = async (id: string) => {
    if (!key || !ready || writing.current) return;
    writing.current = true;
    setBusy(true);
    const current = generation.current;
    const next = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
    try {
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (generation.current === current) setState({ userId, ids: next, ready: true });
    } catch (error) {
      if (generation.current === current) throw error;
    } finally {
      if (generation.current === current) {
        writing.current = false;
        setBusy(false);
      }
    }
  };

  return { ids, ready, busy, loadError, toggle };
}
