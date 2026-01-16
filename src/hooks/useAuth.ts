import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

import { useToast } from "@/hooks/use-toast";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

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
            console.error('Anonymous auth failed:', error);
            // Alert user that they might need to enable it
            toast({
              variant: "destructive",
              title: "Authentication Failed",
              description: "Could not sign in anonymously. Please enable Anonymous Sign-ins in your Supabase Authentication settings.",
            });

            // 3. Fallback: Generate/Get local ID (will likely fail RLS but keeps app running)
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
