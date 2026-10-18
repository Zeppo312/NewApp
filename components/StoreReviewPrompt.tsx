import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { addLottiMomentListener } from '@/lib/lottiMomentEvents';
import { recordReviewMoment, requestReviewIfEligible } from '@/lib/storeReview';

type Props = { userId: string | null; canPrompt: boolean };

// A completed save arms one opportunity in this session. Returning home without
// a recent save never prompts, and leaving/backgrounding cancels the idle timer.
export function StoreReviewPrompt({ userId, canPrompt }: Props) {
  const [moment, setMoment] = useState(0);
  const consumedMoment = useRef(0);
  const [appState, setAppState] = useState(AppState.currentState);
  const current = useRef({ userId, canPrompt, moment });
  useLayoutEffect(() => { current.current = { userId, canPrompt, moment }; }, [userId, canPrompt, moment]);

  useEffect(() => {
    consumedMoment.current = current.current.moment;
    if (!userId) return;
    const listener = addLottiMomentListener(() => {
      if (AppState.currentState !== 'active') return;
      void recordReviewMoment();
      setMoment(value => value + 1);
    });
    return () => listener.remove();
  }, [userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!userId || !canPrompt || appState !== 'active' || moment <= consumedMoment.current) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      consumedMoment.current = moment;
      void requestReviewIfEligible(() => !cancelled &&
        current.current.userId === userId && current.current.canPrompt &&
        current.current.moment === moment && AppState.currentState === 'active');
    }, 8000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId, canPrompt, appState, moment]);

  return null;
}
