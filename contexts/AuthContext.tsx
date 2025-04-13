import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  signInWithApple,
  checkSupabaseConnection,
  isSupabaseReady
} from '@/lib/supabase';

// Typdefinitionen für den Kontext
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  // E-Mail-Authentifizierung
  signInWithEmail: (email: string, password: string) => Promise<{ data?: any, error: any }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ data?: any, error: any }>;
  // Social Logins
  signInWithApple: () => Promise<{ data?: any, error: any }>;
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

  // Initialisierung und Überwachung des Authentifizierungsstatus
  useEffect(() => {
    // Prüfen, ob wir im Browser sind und Supabase bereit ist
    if (!isSupabaseReady()) {
      console.log('Supabase is not ready yet (server-side rendering)');
      // Wir setzen einen Timeout, um sicherzustellen, dass die App nicht hängen bleibt
      setTimeout(() => {
        setLoading(false);
      }, 1000);
      return;
    }

    const initAuth = async () => {
      try {
        // Simulierte Verzögerung für stabileres Laden auf mobilen Geräten
        await new Promise(resolve => setTimeout(resolve, 500));

        // Prüfen der Supabase-Verbindung
        const connectionCheck = await checkSupabaseConnection();
        console.log('Supabase connection check:', connectionCheck);

        // Wenn die Supabase-Verbindung fehlschlägt, setzen wir den Benutzer auf null
        if (!connectionCheck.success) {
          console.log('Supabase connection failed, setting user to null');
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // Abrufen der aktuellen Session beim Start
        const { data } = await supabase.auth.getSession();
        console.log('Got session:', data.session ? 'session exists' : 'no session');
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Bei einem Fehler setzen wir den Benutzer auf null
        setSession(null);
        setUser(null);
      } finally {
        // Sicherstellen, dass der Ladeindikator ausgeblendet wird
        setLoading(false);
      }
    };

    // Initialisierung starten
    initAuth();

    // Überwachung von Authentifizierungsänderungen
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const authListener = supabase.auth.onAuthStateChange((_event, session) => {
        console.log('Auth state changed:', _event, session ? 'session exists' : 'no session');
        setSession(session);
        setUser(session?.user ?? null);
      });

      subscription = authListener.data.subscription;
    } catch (error) {
      console.error('Error setting up auth state change:', error);
    }

    // Cleanup-Funktion
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // E-Mail-Authentifizierung
  const handleSignInWithEmail = async (email: string, password: string) => {
    const { data, error } = await signInWithEmail(email, password);
    return { data, error };
  };

  const handleSignUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await signUpWithEmail(email, password);
    return { data, error };
  };

  // Social Logins
  const handleSignInWithApple = async () => {
    const { data, error } = await signInWithApple();
    return { data, error };
  };

  // Abmeldung
  const handleSignOut = async () => {
    const { error } = await signOut();
    return { error };
  };

  // Bereitstellung des Kontexts
  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signInWithEmail: handleSignInWithEmail,
        signUpWithEmail: handleSignUpWithEmail,
        signInWithApple: handleSignInWithApple,
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
