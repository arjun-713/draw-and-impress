import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Try to get existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          setUserId(session.user.id);
        } else {
          // 2. Try anonymous sign-in
          const { data, error } = await supabase.auth.signInAnonymously();
          if (!error && data.user) {
            setUser(data.user);
            setUserId(data.user.id);
          } else {
            console.log('Anonymous auth disabled or failed, using local ID fallback');
            // 3. Fallback: Generate/Get local ID
            let localId = localStorage.getItem('draw_impress_anon_id');
            if (!localId) {
              localId = crypto.randomUUID();
              localStorage.setItem('draw_impress_anon_id', localId);
            }
            setUserId(localId);
            // Mock a user object if needed, or just leave null
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Fallback on error
        let localId = localStorage.getItem('draw_impress_anon_id');
        if (!localId) {
          localId = crypto.randomUUID();
          localStorage.setItem('draw_impress_anon_id', localId);
        }
        setUserId(localId);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          setUserId(session.user.id);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, userId };
};
