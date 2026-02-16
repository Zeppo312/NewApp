import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { differenceInMonths } from 'date-fns';
import { setBabyBornStatus } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { getBabyInfo, saveBabyInfo } from '@/lib/baby';
import { useActiveBaby } from './ActiveBabyContext';

interface BabyStatusContextType {
  isBabyBorn: boolean;
  setIsBabyBorn: (value: boolean) => Promise<void>;
  isLoading: boolean;
  babyAgeMonths: number;
  babyWeightPercentile: number;
  refreshBabyDetails: () => Promise<void>;
}

const BabyStatusContext = createContext<BabyStatusContextType | undefined>(undefined);

export const BabyStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBabyBorn, setIsBabyBornState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [babyAgeMonths, setBabyAgeMonths] = useState(0); // Standardwert: 0 Monate
  const [babyWeightPercentile, setBabyWeightPercentile] = useState(50); // Standardwert: 50. Perzentile
  const { user } = useAuth();
  const { activeBabyId, isReady: isActiveBabyReady } = useActiveBaby();
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!user) {
      isInitialLoadRef.current = true;
      setIsBabyBornState(false);
      setBabyAgeMonths(0);
      setIsLoading(false);
      return;
    }

    if (!isActiveBabyReady) {
      if (isInitialLoadRef.current) setIsLoading(true);
      return;
    }

    const showLoading = isInitialLoadRef.current;
    loadBabyDetails(showLoading);
    if (isInitialLoadRef.current) isInitialLoadRef.current = false;
  }, [user, activeBabyId, isActiveBabyReady]);

  const loadBabyDetails = async (showLoading: boolean = false) => {
    try {
      if (showLoading) setIsLoading(true);

      if (!activeBabyId) {
        setIsBabyBornState(false);
        setBabyAgeMonths(0);
        return;
      }

      const { data } = await getBabyInfo(activeBabyId);
      setIsBabyBornState(!!(data && data.birth_date));

      if (data?.birth_date) {
        const ageInMonths = differenceInMonths(new Date(), new Date(data.birth_date));
        setBabyAgeMonths(Math.max(0, ageInMonths));
      } else {
        setBabyAgeMonths(0);
      }
      setBabyWeightPercentile(50);
    } catch (error) {
      console.error('Error loading baby details:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const setIsBabyBorn = async (value: boolean) => {
    try {
      if (activeBabyId) {
        if (value) {
          const { data: currentBaby } = await getBabyInfo(activeBabyId);
          if (!currentBaby?.birth_date) {
            await saveBabyInfo({ birth_date: new Date().toISOString() }, activeBabyId);
          }
        } else {
          await saveBabyInfo({ birth_date: null }, activeBabyId);
        }
      }
      await setBabyBornStatus(value); // Partner-Sync
      setIsBabyBornState(value);
      await loadBabyDetails();
    } catch (error) {
      console.error('Error setting baby born status:', error);
    }
  };

  return (
    <BabyStatusContext.Provider 
      value={{ 
        isBabyBorn, 
        setIsBabyBorn, 
        isLoading, 
        babyAgeMonths,
        babyWeightPercentile,
        refreshBabyDetails: loadBabyDetails
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
