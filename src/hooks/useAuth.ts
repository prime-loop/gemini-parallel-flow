import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Mock data for Test Mode
const TEST_USER: Partial<User> = {
  id: '00000000-0000-4000-8000-000000000000',
  email: 'test@example.com',
};

const TEST_SESSION: Partial<Session> = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  user: TEST_USER as User,
};

export function useAuth() {
  // Determine Test Mode synchronously on first render
  const initialTestMode = typeof window !== 'undefined' && localStorage.getItem('research_copilot_test_mode') === 'true';

  const [user, setUser] = useState<User | null>(initialTestMode ? (TEST_USER as User) : null);
  const [session, setSession] = useState<Session | null>(initialTestMode ? (TEST_SESSION as Session) : null);
  const [loading, setLoading] = useState(!initialTestMode);
  const [isTestMode] = useState(initialTestMode);

  useEffect(() => {
    if (isTestMode) {
      // In test mode, no Supabase listeners; we’re already "authenticated"
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isTestMode]);

  const signIn = async (email: string, password: string) => {
    if (isTestMode) return { error: null } as const;

    console.log('Attempting sign in for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('Sign in result:', { data, error });
    return { error } as const;
  };

  const signUp = async (email: string, password: string) => {
    if (isTestMode) return { error: null } as const;

    console.log('Attempting sign up for:', email);
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    console.log('Sign up result:', { data, error });
    return { error } as const;
  };

  const signOut = async () => {
    if (isTestMode) {
      localStorage.removeItem('research_copilot_test_mode');
      window.location.reload();
      return { error: null } as const;
    }
    const { error } = await supabase.auth.signOut();
    return { error } as const;
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    isTestMode,
  };
}
