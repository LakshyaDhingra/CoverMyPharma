import type { User } from "@auth0/auth0-react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

/**
 * Upsert the Auth0 user into `public.users` and return the Supabase user id.
 * Call this before queries that join on `user_id` so refresh / deep links work
 * even when the upload page (which used to be the only sync site) was skipped.
 */
export async function ensureSupabaseUserId(user: User): Promise<string | null> {
  if (!hasSupabaseConfig || !supabase || !user.sub) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        auth0_id: user.sub,
        email: user.email ?? "",
        name: user.name ?? null,
      },
      { onConflict: "auth0_id" },
    )
    .select("id")
    .single();

  if (error) {
    console.error("ensureSupabaseUserId:", error);
    return null;
  }

  return data?.id ?? null;
}
