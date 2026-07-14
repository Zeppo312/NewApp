import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { differenceInMonths } from 'date-fns';
import { getBabyBornStatus, setBabyBornStatus } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { getBabyInfo } from '@/lib/baby';
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
  const { activeBabyId } = useActiveBaby();
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (user) {
      // Beim ersten Laden zeigen wir den Loading-Screen
      // Beim Baby-Wechsel (activeBabyId ändert sich) laden wir im Hintergrund ohne Loading-Screen
      const showLoading = isInitialLoadRef.current;
      loadBabyBornStatus(showLoading);
      loadBabyDetails();

      // Nach dem ersten Laden setzen wir isInitialLoadRef auf false
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      }
    } else {
      setIsLoading(false);
    }
  }, [user, activeBabyId]);

  const loadBabyBornStatus = async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const { data } = await getBabyBornStatus();
      setIsBabyBornState(data);
    } catch (error) {
      console.error('Error loading baby born status:', error);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const loadBabyDetails = async () => {
    try {
      const { data } = await getBabyInfo(activeBabyId ?? undefined);
      
      // Wenn das Geburtsdatum verfügbar ist, berechne das Alter in Monaten
      if (data && data.birth_date) {
        const birthDate = new Date(data.birth_date);
        const today = new Date();
        const ageInMonths = differenceInMonths(today, birthDate);
        setBabyAgeMonths(Math.max(0, ageInMonths));
      } else {
        setBabyAgeMonths(0);
      }
      
      // Für die Gewichtsperzentile verwenden wir momentan einen Standardwert
      // In einer vollständigen App würde dies basierend auf Gewicht und Alter berechnet
      setBabyWeightPercentile(50);
      
    } catch (error) {
      console.error('Error loading baby details:', error);
    }
  };

  const setIsBabyBorn = async (value: boolean) => {
    try {
      await setBabyBornStatus(value);
      setIsBabyBornState(value);
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
