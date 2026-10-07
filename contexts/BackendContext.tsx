import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

/**
 * BackendContext
 *
 * Provides the active Supabase backend and local admin status.
 */

export type BackendType = 'supabase';

interface BackendContextValue {
  activeBackend: BackendType;
  isAdmin: boolean;
  isLoading: boolean;
}

const BackendContext = createContext<BackendContextValue>({
  activeBackend: 'supabase',
  isAdmin: false,
  isLoading: true,
});

export const useBackend = () => {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error('useBackend must be used within BackendProvider');
  }
  return context;
};

interface BackendProviderProps {
  children: React.ReactNode;
}

// Admin user IDs (replace with your actual admin IDs)
const ADMIN_USER_IDS = [
  '1d874a8a-d80e-4869-8c94-a8f71915194a',
  'c26168c0-9193-470a-abb8-c463762cc4ac',
  '70cd5134-24ea-4476-bc3d-fc15e5946ce0' 
  // Add your admin user IDs here
];

export const BackendProvider: React.FC<BackendProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [activeBackend, setActiveBackendState] = useState<BackendType>('supabase');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Always use Supabase as backend
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Check if user is admin
    const userIsAdmin = ADMIN_USER_IDS.includes(user.id);
    setIsAdmin(userIsAdmin);

    // Always set Supabase as active backend
    setActiveBackendState('supabase');
    setIsLoading(false);
  }, [user]);

  return (
    <BackendContext.Provider
      value={{
        activeBackend,
        isAdmin,
        isLoading,
      }}
    >
      {children}
    </BackendContext.Provider>
  );
};
