import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
        } else {
          // Sign in anonymously if no session exists
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error('Anonymous sign-in error:', error);
          } else {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        // If signed out, sign in anonymously again
        if (event === 'SIGNED_OUT') {
          const { data } = await supabase.auth.signInAnonymously();
          setUser(data.user ?? null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, userId: user?.id ?? null };
};
