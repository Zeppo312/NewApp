import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getAppSettings, saveAppSettings } from '@/lib/supabase';

/**
 * BackendContext
 *
 * Manages the active backend selection (Supabase or Convex).
 * The preference is stored in user_settings table and persisted across sessions.
 * Only admins can see and toggle the backend switch.
 */

export type BackendType = 'supabase' | 'convex';

interface BackendContextValue {
  activeBackend: BackendType;
  setActiveBackend: (backend: BackendType) => Promise<void>;
  isAdmin: boolean;
  isLoading: boolean;
}

const BackendContext = createContext<BackendContextValue>({
  activeBackend: 'supabase',
  setActiveBackend: async () => {},
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

  // Function to update backend preference
  const setActiveBackend = async (backend: BackendType) => {
    if (!user) {
      console.warn('Cannot set backend preference: user not logged in');
      return;
    }

    try {
      // Update local state immediately for better UX
      setActiveBackendState(backend);

      // Persist to database
      const { error } = await saveAppSettings({
        preferred_backend: backend,
      } as any);

      if (error) {
        console.error('Error saving backend preference:', error);
        // Revert on error
        setActiveBackendState(activeBackend);
      } else {
        console.log(`Backend preference saved: ${backend}`);
      }
    } catch (err) {
      console.error('Failed to save backend preference:', err);
      // Revert on error
      setActiveBackendState(activeBackend);
    }
  };

  return (
    <BackendContext.Provider
      value={{
        activeBackend,
        setActiveBackend,
        isAdmin,
        isLoading,
      }}
    >
      {children}
    </BackendContext.Provider>
  );
};
