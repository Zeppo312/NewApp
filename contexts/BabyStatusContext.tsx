import React, { createContext, useState, useEffect, useContext } from 'react';
import { getBabyBornStatus, setBabyBornStatus } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface BabyStatusContextType {
  isBabyBorn: boolean;
  setIsBabyBorn: (value: boolean) => Promise<void>;
  isLoading: boolean;
}

const BabyStatusContext = createContext<BabyStatusContextType | undefined>(undefined);

export const BabyStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBabyBorn, setIsBabyBornState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadBabyBornStatus();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadBabyBornStatus = async () => {
    try {
      setIsLoading(true);
      const { data } = await getBabyBornStatus();
      setIsBabyBornState(data);
    } catch (error) {
      console.error('Error loading baby born status:', error);
    } finally {
      setIsLoading(false);
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
    <BabyStatusContext.Provider value={{ isBabyBorn, setIsBabyBorn, isLoading }}>
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
