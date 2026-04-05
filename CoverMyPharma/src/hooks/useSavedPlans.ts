import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { planFromMedicalDocumentRow } from "@/app/lib/plan-transform";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { ensureSupabaseUserId } from "@/lib/ensureSupabaseUser";
import type { PlanCard } from "@/app/components/types";

export function useSavedPlans() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth0();
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!hasSupabaseConfig || !supabase || !isAuthenticated || !user) {
      setPlans([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userId = await ensureSupabaseUserId(user);

      if (!userId) {
        setPlans([]);
        return;
      }

      const { data: rows, error: docError } = await supabase
        .from("medical_documents")
        .select("*")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false });

      if (docError) {
        throw docError;
      }

      const next: PlanCard[] = (rows ?? [])
        .map((row) => planFromMedicalDocumentRow(row))
        .filter((p): p is PlanCard => p != null);

      setPlans(next);
    } catch (e) {
      console.error("useSavedPlans:", e);
      setError(
        e instanceof Error ? e.message : "Failed to load saved documents",
      );
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { plans, isLoading, error, reload: load };
}
