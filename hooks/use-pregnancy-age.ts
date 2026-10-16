import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@/lib/navigation/useFocusEffect';
import { getPregnancyAge } from '@/lib/pregnancy-age';

/** Recalculate on local midnight, focus and return from the background. */
export function usePregnancyAge(dueDate: unknown) {
  const [today, setToday] = useState(() => new Date());
  useFocusEffect(useCallback(() => { setToday(new Date()); }, []));
  useEffect(() => {
    const next = new Date(today);
    next.setHours(24, 0, 0, 20);
    const timer = setTimeout(() => setToday(new Date()), Math.max(1, next.getTime() - Date.now()));
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') setToday(new Date());
    });
    return () => { clearTimeout(timer); listener.remove(); };
  }, [today]);
  return getPregnancyAge(dueDate, today);
}
