import { clearPersonalDeviceData, waitForPersonalDeviceCleanup } from '@/lib/accountDeletionCleanup';
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signInWithApple,
  signInWithGoogle,
  resendOTPToken,
  verifyOTPToken,
  checkEmailVerification,
  signOut,
  isSupabaseReady,
  invalidateUserCache
} from '@/lib/supabase';
import { invalidateAllCaches } from '@/lib/appCache';
import { setRevenueCatSessionUser } from '@/lib/revenuecat';
import {
  clearGoogleSignIn,
  completeGoogleSignIn as exchangeGoogleSignIn,
  type GoogleAuthOptions,
  type GoogleAuthResult,
  type GoogleStartResult,
} from '@/lib/google-auth';

// Typdefinitionen für den Kontext
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  refreshSession: () => Promise<Session | null>;
  // E-Mail-Authentifizierung
  signInWithEmail: (email: string, password: string) => Promise<{ data?: any, error: any }>;
  signUpWithEmail: (
    email: string,
    password: string,
    termsConsent: { version: string; acceptedAt: string },
  ) => Promise<{ data?: any, error: any }>;
  // Apple Sign-In
  signInWithApple: () => Promise<{ data?: any, error: any }>;
  signInWithGoogle: (options: GoogleAuthOptions) => Promise<GoogleStartResult>;
  completeGoogleSignIn: (url: string) => Promise<GoogleAuthResult>;
  // OTP-Verifikation
  resendOTPToken: (email: string) => Promise<{ data?: any, error: any }>;
  verifyOTPToken: (email: string, token: string) => Promise<{ data?: any, error: any }>;
  checkEmailVerification: () => Promise<{ isVerified: boolean, user: any }>;
  // Abmeldung
  signOut: () => Promise<{ error: any }>;
};

// Erstellen des Kontexts
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider-Komponente
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signOutPromiseRef = useRef<Promise<{ error: any }> | null>(null);
  const sessionRevisionRef = useRef(0);
  const refreshPromiseRef = useRef<Promise<Session | null> | null>(null);
  const mountedRef = useRef(true);
  const lastSessionUserIdRef = useRef<string | null | undefined>(undefined);

  const applySession = useCallback((nextSession: Session | null) => {
    sessionRevisionRef.current++;
    const nextUserId = nextSession?.user?.id ?? null;
    const previousUserId = lastSessionUserIdRef.current;

    // Beim ersten Wiederherstellen derselben persistierten Sitzung bleiben die
    // nutzerspezifischen Offline-Caches erhalten. Nur ein echter Wechsel nach
    // initialer Auflösung darf sie verwerfen.
    if (previousUserId !== undefined && previousUserId !== nextUserId) {
      void invalidateAllCaches().catch((cacheError) => {
        console.error('Error invalidating caches after auth user change:', cacheError);
      });
    }
    if (previousUserId && nextUserId === null) {
      // Also handles a remote revocation/expired session. Never await Supabase
      // auth methods inside its auth-state callback (the auth lock is held).
      invalidateUserCache();
      void clearGoogleSignIn().catch(() => { console.warn('Google login cleanup failed'); });
      void clearPersonalDeviceData().then((failures) => {
        if (failures.length) console.warn('Local cleanup incomplete:', failures);
      });
    }
    lastSessionUserIdRef.current = nextUserId;
    setRevenueCatSessionUser(nextUserId);

    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const refreshSession = useCallback((): Promise<Session | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    if (signOutPromiseRef.current) return Promise.resolve(null);
    const revision = sessionRevisionRef.current;
    const operation = (async () => {
      try {
        const result = isSupabaseReady()
          ? await supabase.auth.getSession()
          : { data: { session: null }, error: null };
        if (!mountedRef.current || revision !== sessionRevisionRef.current) return null;
        if (result.error) {
          // A failed cold-start refresh is unresolved, not a signed-out session.
          // Keep the recovery screen until a retry or authoritative auth event.
          console.error('Error refreshing session:', result.error);
          return null;
        }
        const nextSession = result.data.session ?? null;
        applySession(nextSession);
        setLoading(false);
        return nextSession;
      } catch (error) {
        console.error('Error initializing auth:', error);
        return null;
      }
    })();
    refreshPromiseRef.current = operation;
    void operation.finally(() => {
      if (refreshPromiseRef.current === operation) refreshPromiseRef.current = null;
    });
    return operation;
  }, [applySession]);

  // Initialisierung und Überwachung des Authentifizierungsstatus
  useEffect(() => {
    let isMounted = true;
    mountedRef.current = true;

    const applySessionSafe = (nextSession: Session | null) => {
      if (!isMounted) return;
      applySession(nextSession);
      setLoading(false);
    };

    // Prüfen, ob wir im Browser sind und Supabase bereit ist
    if (!isSupabaseReady()) {
      console.log('Supabase is not ready yet (server-side rendering)');
      if (isMounted) setLoading(false);
      return;
    }

    // Überwachung von Authentifizierungsänderungen früh registrieren
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const authListener = supabase.auth.onAuthStateChange((event, nextSession) => {
        // INITIAL_SESSION can be null after a transient SDK recovery failure.
        // Only getSession without an error establishes anonymous startup.
        if (event === 'INITIAL_SESSION' && !nextSession) return;
        applySessionSafe(nextSession);
      });

      subscription = authListener.data.subscription;
    } catch (error) {
      console.error('Error setting up auth state change:', error);
    }

    void refreshSession();

    // Cleanup-Funktion
    return () => {
      isMounted = false;
      mountedRef.current = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [applySession, refreshSession]);

  // E-Mail-Authentifizierung
  const handleSignInWithEmail = async (email: string, password: string) => {
    await signOutPromiseRef.current;
    await waitForPersonalDeviceCleanup();
    const { data, error } = await signInWithEmail(email, password);
    if (!error && data?.session) {
      applySession(data.session);
    }
    return { data, error };
  };

  const handleSignUpWithEmail = async (
    email: string,
    password: string,
    termsConsent: { version: string; acceptedAt: string },
  ) => {
    await signOutPromiseRef.current;
    await waitForPersonalDeviceCleanup();
    const { data, error } = await signUpWithEmail(email, password, termsConsent);
    if (!error && data?.session) {
      applySession(data.session);
    }
    return { data, error };
  };

  const handleSignInWithApple = async () => {
    await signOutPromiseRef.current;
    await waitForPersonalDeviceCleanup();
    const { data, error } = await signInWithApple();
    if (!error && data?.session) {
      applySession(data.session);
    }
    return { data, error };
  };

  const handleSignInWithGoogle = async (options: GoogleAuthOptions) => {
    await signOutPromiseRef.current;
    await waitForPersonalDeviceCleanup();
    return signInWithGoogle(options);
  };

  const handleCompleteGoogleSignIn = async (url: string) => {
    await signOutPromiseRef.current;
    await waitForPersonalDeviceCleanup();
    const result = await exchangeGoogleSignIn(supabase, url);
    applySession(result.session);
    return result;
  };

  const handleVerifyOTPToken = async (email: string, token: string) => {
    await signOutPromiseRef.current;
    await waitForPersonalDeviceCleanup();
    const { data, error } = await verifyOTPToken(email, token);
    if (!error && data?.session) {
      applySession(data.session);
    }
    return { data, error };
  };

  // Abmeldung
  const handleSignOut = (): Promise<{ error: any }> => {
    if (signOutPromiseRef.current) return signOutPromiseRef.current;
    sessionRevisionRef.current++;
    // Hide private screens immediately, while preserving the persisted token
    // until Supabase has attempted remote session revocation.
    setSession(null);
    setUser(null);
    setRevenueCatSessionUser(null);
    invalidateUserCache();
    const operation = (async () => {
      let error: unknown = null;
      try {
        await clearGoogleSignIn().catch(() => { console.warn('Google login cleanup failed'); });
        ({ error } = await signOut());
      }
      catch (failure) { error = failure; }
      finally {
        applySession(null);
        const failures = await clearPersonalDeviceData();
        if (failures.length) console.warn('Local cleanup incomplete:', failures);
      }
      return { error };
    })();
    signOutPromiseRef.current = operation;
    void operation.finally(() => { signOutPromiseRef.current = null; });
    return operation;
  };

  // Bereitstellung des Kontexts
  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        refreshSession,
        signInWithEmail: handleSignInWithEmail,
        signUpWithEmail: handleSignUpWithEmail,
        signInWithApple: handleSignInWithApple,
        signInWithGoogle: handleSignInWithGoogle,
        completeGoogleSignIn: handleCompleteGoogleSignIn,
        resendOTPToken,
        verifyOTPToken: handleVerifyOTPToken,
        checkEmailVerification,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook für einfachen Zugriff auf den Kontext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
