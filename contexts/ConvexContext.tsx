import React, { createContext, useContext, useMemo } from 'react';

/**
 * ConvexContext
 *
 * Provides Convex client with Supabase auth token sync.
 * The client is initialized with the Supabase access token to ensure
 * authenticated requests to Convex backend.
 */

interface ConvexContextValue {
  convexClient: null;
  isReady: boolean;
  syncUser: () => Promise<boolean>;
  lastSyncError: Error | null;
}

const ConvexContext = createContext<ConvexContextValue>({
  convexClient: null,
  isReady: false,
  syncUser: async () => false,
  lastSyncError: null,
});

export const useConvex = () => {
  const context = useContext(ConvexContext);
  if (!context) {
    throw new Error('useConvex must be used within ConvexProvider');
  }
  return context;
};

interface ConvexProviderProps {
  children: React.ReactNode;
}

export const ConvexProvider: React.FC<ConvexProviderProps> = ({ children }) => {
  // Convex ist deaktiviert: kein Client, kein Socket, kein Sync.
  const value = useMemo<ConvexContextValue>(
    () => ({
      convexClient: null,
      isReady: true,
      syncUser: async () => false,
      lastSyncError: null,
    }),
    [],
  );

  return <ConvexContext.Provider value={value}>{children}</ConvexContext.Provider>;
};
