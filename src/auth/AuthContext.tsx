import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../services/supabase/supabaseClient';
import { setCurrentOwnerUserId } from '../services/ownership/ownership';
import { claimAnonymousData } from '../services/ownership/claimAnonymousData';

interface AuthContextValue {
  configured: boolean;
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const userId = data.session?.user?.id ?? null;
      if (userId) await claimAnonymousData(userId);
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setCurrentOwnerUserId(userId);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      const userId = nextSession?.user?.id ?? null;
      if (userId) await claimAnonymousData(userId);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setCurrentOwnerUserId(userId);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      user,
      session,
      loading,
      async signIn(email, password) {
        if (!supabase) return { error: '云同步未配置' };
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (!error && data.user) {
          await ensureProfile(data.user.id);
        }
        return { error: error?.message };
      },
      async signUp(email, password) {
        if (!supabase) return { error: '云同步未配置' };
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (!error && data.user) {
          await ensureProfile(data.user.id);
        }
        return { error: error?.message };
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setCurrentOwnerUserId(null);
      }
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function ensureProfile(userId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('profiles').upsert({
    id: userId,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
  });
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
