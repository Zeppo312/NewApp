import React, { createContext, useContext, useEffect, useState } from 'react';
import { ConvexReactClient } from 'convex/react';
import { useAuth } from './AuthContext';
import { api } from '@/convex/_generated/api';
import { supabase } from '@/lib/supabase';

/**
 * ConvexContext
 *
 * Provides Convex client with Supabase auth token sync.
 * The client is initialized with the Supabase access token to ensure
 * authenticated requests to Convex backend.
 */

interface ConvexContextValue {
  convexClient: ConvexReactClient | null;
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
  const { user } = useAuth();
  const [convexClient, setConvexClient] = useState<ConvexReactClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<Error | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

    if (!convexUrl) {
      console.warn('EXPO_PUBLIC_CONVEX_URL not set, Convex client will not be initialized');
      setIsReady(true); // Mark as ready even without Convex to allow app to function
      return;
    }

    // Initialize Convex client
    const client = new ConvexReactClient(convexUrl);
    setConvexClient(client);
    setIsReady(true);

    // Cleanup on unmount
    return () => {
      client.close();
    };
  }, []);

  // Manual sync function exposed to components
  const syncUser = async (): Promise<boolean> => {
    if (!user || !convexClient || isSyncing) {
      console.warn('[ConvexSync] Cannot sync: user or client not available, or already syncing');
      return false;
    }

    setIsSyncing(true);
    setLastSyncError(null);

    try {
      console.log('[ConvexSync] Syncing user data to Convex:', user.id, user.email);

      // Add delay to ensure Convex client is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));

      await convexClient.mutation(api.auth.verifyAndSyncUser, {
        supabaseUserId: user.id,
        email: user.email,
      });

      const [profileResult, linksResult, babiesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name, last_name, user_role, created_at, updated_at')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('account_links')
          .select('*')
          .or(`creator_id.eq.${user.id},invited_id.eq.${user.id}`),
        supabase
          .from('baby_info')
          .select('*')
          .order('created_at', { ascending: true }),
      ]);

      if (profileResult.error && profileResult.error.code !== 'PGRST116') {
        throw profileResult.error;
      }
      if (linksResult.error) {
        throw linksResult.error;
      }
      if (babiesResult.error) {
        throw babiesResult.error;
      }

      if (profileResult.data) {
        await convexClient.mutation(api.profiles.syncProfile, {
          userId: user.id,
          firstName: profileResult.data.first_name ?? undefined,
          lastName: profileResult.data.last_name ?? undefined,
          userRole: profileResult.data.user_role ?? undefined,
          createdAt: profileResult.data.created_at
            ? String(profileResult.data.created_at)
            : undefined,
          updatedAt: profileResult.data.updated_at
            ? String(profileResult.data.updated_at)
            : undefined,
        });
      }

      if (linksResult.data && linksResult.data.length > 0) {
        await Promise.all(
          linksResult.data.map((link: any) =>
            convexClient.mutation(api.accountLinks.syncAccountLink, {
              supabaseLinkId: link.id,
              creatorId: link.creator_id,
              invitedId: link.invited_id ?? undefined,
              invitationCode: link.invitation_code,
              status: link.status,
              relationshipType: link.relationship_type ?? undefined,
              createdAt: String(link.created_at),
              expiresAt: String(link.expires_at),
              acceptedAt: link.accepted_at ? String(link.accepted_at) : undefined,
            })
          )
        );
      }

      if (babiesResult.data && babiesResult.data.length > 0) {
        await Promise.all(
          babiesResult.data.map((baby: any) =>
            convexClient.mutation(api.babies.syncBaby, {
              supabaseBabyId: baby.id,
              userId: baby.user_id,
              name: baby.name ?? undefined,
              birthDate: baby.birth_date ? String(baby.birth_date) : undefined,
              babyGender: baby.baby_gender ?? undefined,
              weight: baby.weight ?? undefined,
              height: baby.height ?? undefined,
              photoUrl: baby.photo_url ?? undefined,
              createdAt: baby.created_at ? String(baby.created_at) : undefined,
              updatedAt: baby.updated_at ? String(baby.updated_at) : undefined,
            })
          )
        );
      }

      const babyIds = (babiesResult.data ?? [])
        .map((baby: any) => baby?.id)
        .filter(Boolean);

      if (babyIds.length > 0) {
        const membersResult = await supabase
          .from('baby_members')
          .select('*')
          .in('baby_id', babyIds);

        if (membersResult.error) {
          throw membersResult.error;
        }

        if (membersResult.data && membersResult.data.length > 0) {
          await Promise.all(
            membersResult.data.map((member: any) =>
              convexClient.mutation(api.babies.syncBabyMember, {
                babyId: member.baby_id,
                userId: member.user_id,
                role: member.role ?? undefined,
                createdAt: member.created_at ? String(member.created_at) : undefined,
              })
            )
          );
        }
      }

      console.log('[ConvexSync] User data synced successfully.');
      setIsSyncing(false);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[ConvexSync] Failed to sync user data to Convex:', err);
      setLastSyncError(err);
      setIsSyncing(false);
      return false;
    }
  };

  // Automatic sync on user login with retry
  useEffect(() => {
    if (!user || !convexClient || !isReady) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;

    const attemptSync = async () => {
      const success = await syncUser();

      if (!success && retryCount < maxRetries) {
        retryCount++;
        console.log(`[ConvexSync] Retry attempt ${retryCount}/${maxRetries}`);
        setTimeout(attemptSync, 2000 * retryCount); // Exponential backoff
      }
    };

    // Initial delay to ensure everything is ready
    const timer = setTimeout(attemptSync, 1000);

    return () => clearTimeout(timer);
  }, [user, convexClient, isReady]);

  return (
    <ConvexContext.Provider value={{ convexClient, isReady, syncUser, lastSyncError }}>
      {children}
    </ConvexContext.Provider>
  );
};
