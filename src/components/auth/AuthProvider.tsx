'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Profile } from '@/lib/types';
import { getSupabase } from '@/lib/supabase';
import {
  enterDemoMode,
  exitDemoMode,
  getDemoDB,
  isDemoMode,
} from '@/lib/demo/store';
import { DEMO_USER_ID } from '@/lib/demo/seed';
import { getProfile } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  profile: Profile | null;
  isDemo: boolean;
  isAdmin: boolean;
  supabaseReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  leaveDemo: () => void;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const next = await getProfile();
      setProfile(next);
    } catch {
      // A missing profile row should not sign the member out; show a retry state instead.
      setProfile(null);
    }
  }, []);

  const activateDemo = useCallback(() => {
    enterDemoMode();
    setIsDemo(true);
    setUser({ id: DEMO_USER_ID, email: 'aarav@swapstay.demo' });
    setProfile(getDemoDB().profile);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    let active = true;

    if (isDemoMode()) {
      activateDemo();
      return () => {
        active = false;
      };
    }

    const supabase = getSupabase();
    if (!supabase) {
      setStatus('unauthenticated');
      return () => {
        active = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (data.session?.user) {
          setUser({ id: data.session.user.id, email: data.session.user.email });
          setStatus('authenticated');
          void loadProfile();
        } else {
          setStatus('unauthenticated');
        }
      })
      .catch(() => {
        if (active) setStatus('unauthenticated');
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        setStatus('authenticated');
        void loadProfile();
      } else {
        setUser(null);
        setProfile(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [activateDemo, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error(
        'Authentication is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or continue in demo mode.',
      );
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (displayName: string, email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error(
        'Authentication is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or continue in demo mode.',
      );
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/login?confirmed=1`
            : undefined,
      },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (isDemo) {
      exitDemoMode();
      setIsDemo(false);
      setUser(null);
      setProfile(null);
      setStatus('unauthenticated');
      return;
    }
    const supabase = getSupabase();
    await supabase?.auth.signOut();
    setUser(null);
    setProfile(null);
    setStatus('unauthenticated');
  }, [isDemo]);

  const enterDemo = useCallback(() => activateDemo(), [activateDemo]);

  const leaveDemo = useCallback(() => {
    exitDemoMode();
    setIsDemo(false);
    setUser(null);
    setProfile(null);
    setStatus('unauthenticated');
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Authentication is not configured on this deployment.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
    });
    if (error) throw new Error(error.message);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (isDemo) {
      setProfile(getDemoDB().profile);
      return;
    }
    await loadProfile();
  }, [isDemo, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      isDemo,
      isAdmin: profile?.role === 'admin',
      supabaseReady: Boolean(getSupabase()),
      signIn,
      signUp,
      signOut,
      enterDemo,
      leaveDemo,
      resetPassword,
      refreshProfile,
    }),
    [
      status,
      user,
      profile,
      isDemo,
      signIn,
      signUp,
      signOut,
      enterDemo,
      leaveDemo,
      resetPassword,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
