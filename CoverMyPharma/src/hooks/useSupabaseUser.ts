import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "@/lib/supabase";

export function useSupabaseUser() {
  const { user, isAuthenticated } = useAuth0();

  useEffect(() => {
    const syncUser = async () => {
      if (isAuthenticated && user?.sub) {
        try {
          const { error } = await supabase.from("users").upsert(
            {
              auth0_id: user.sub,
              email: user.email ?? "",
              name: user.name ?? null,
            },
            { onConflict: "auth0_id" },
          );

          if (error) {
            console.error("Failed to sync user with Supabase:", error);
          }
        } catch (err) {
          console.error("Error syncing user:", err);
        }
      }
    };

    syncUser();
  }, [isAuthenticated, user]);

  return { user, isAuthenticated };
}
