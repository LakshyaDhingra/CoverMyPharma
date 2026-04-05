import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { hasSupabaseConfig } from "@/lib/supabase";
import { ensureSupabaseUserId } from "@/lib/ensureSupabaseUser";

export function useSupabaseUser() {
  const { user, isAuthenticated } = useAuth0();

  useEffect(() => {
    const syncUser = async () => {
      if (!hasSupabaseConfig) {
        return;
      }

      if (isAuthenticated && user?.sub) {
        try {
          await ensureSupabaseUserId(user);
        } catch (err) {
          console.error("Error syncing user:", err);
        }
      }
    };

    void syncUser();
  }, [isAuthenticated, user]);

  return { user, isAuthenticated };
}
