import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signInWithApple,
  resendOTPToken,
  verifyOTPToken,
  checkEmailVerification,
  signOut,
  checkSupabaseConnection,
  isSupabaseReady,
  invalidateUserCache
} from '@/lib/supabase';
import { invalidateAllCaches } from '@/lib/appCache';

// Typdefinitionen für den Kontext
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  refreshSession: () => Promise<Session | null>;
  // E-Mail-Authentifizierung
  signInWithEmail: (email: string, password: string) => Promise<{ data?: any, error: any }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ data?: any, error: any }>;
  // Apple Sign-In
  signInWithApple: () => Promise<{ data?: any, error: any }>;
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

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isSupabaseReady()) {
      applySession(null);
      return null;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error refreshing session:', error);
      applySession(null);
      return null;
    }

    const nextSession = data.session ?? null;
    applySession(nextSession);
    return nextSession;
  }, [applySession]);

  // Initialisierung und Überwachung des Authentifizierungsstatus
  useEffect(() => {
    let isMounted = true;

    const applySessionSafe = (nextSession: Session | null) => {
      if (!isMounted) return;
      applySession(nextSession);
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
      const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
        console.log('Auth state changed:', _event, nextSession ? 'session exists' : 'no session');
        applySessionSafe(nextSession);
      });

      subscription = authListener.data.subscription;
    } catch (error) {
      console.error('Error setting up auth state change:', error);
    }

    const initAuth = async () => {
      try {
        // Optionales Connectivity-Logging (darf Auth nicht blockieren)
        checkSupabaseConnection()
          .then((result) => {
            if (!result.success) {
              console.warn('Supabase connection check warning:', result.error);
            } else {
              console.log('Supabase connection check: ok');
            }
          })
          .catch((connectionError) => {
            console.warn('Supabase connection check exception:', connectionError);
          });

        // Abrufen der aktuellen Session beim Start
        const nextSession = await refreshSession();
        console.log('Got session:', nextSession ? 'session exists' : 'no session');
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Bei einem Fehler setzen wir den Benutzer auf null
        applySessionSafe(null);
      } finally {
        // Sicherstellen, dass der Ladeindikator ausgeblendet wird
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initialisierung starten
    initAuth();

    // Cleanup-Funktion
    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [applySession, refreshSession]);

  // E-Mail-Authentifizierung
  const handleSignInWithEmail = async (email: string, password: string) => {
    const { data, error } = await signInWithEmail(email, password);
    if (!error && data?.session) {
      applySession(data.session);
    }
    return { data, error };
  };

  const handleSignUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await signUpWithEmail(email, password);
    if (!error && data?.session) {
      applySession(data.session);
    }
    return { data, error };
  };

  const handleSignInWithApple = async () => {
    const { data, error } = await signInWithApple();
    if (!error && data?.session) {
      applySession(data.session);
    }
    return { data, error };
  };

  const handleVerifyOTPToken = async (email: string, token: string) => {
    const { data, error } = await verifyOTPToken(email, token);
    if (!error && data?.session) {
      applySession(data.session);
    }
    return { data, error };
  };

  // Abmeldung
  const handleSignOut = async () => {
    // Alle Caches invalidieren bei Logout
    invalidateUserCache();
    await invalidateAllCaches();

    const { error } = await signOut();
    if (!error) {
      applySession(null);
    }
    return { error };
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
