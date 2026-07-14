import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Session hook. Guarantees `loading` only becomes `false` AFTER the first
 * `getSession()` resolves. This prevents a false-null flicker from the
 * INITIAL_SESSION event firing before the persisted session is restored,
 * which was bouncing signed-in users back to `/` on reload.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let bootstrapped = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (bootstrapped) setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      bootstrapped = true;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
