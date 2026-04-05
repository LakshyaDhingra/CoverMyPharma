import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import type { PlanCard } from "@/app/components/types";
import { transformStoredDocumentToPlan } from "@/app/lib/plan-transform";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function useSavedPlans() {
  const { user, isAuthenticated } = useAuth0();
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasSupabaseConfig || !supabase || !isAuthenticated || !user?.sub) {
      setPlans([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("auth0_id", user.sub)
        .maybeSingle();

      if (userError) {
        throw userError;
      }

      if (!userRow) {
        setPlans([]);
        return;
      }

      const { data: documents, error: docError } = await supabase
        .from("medical_documents")
        .select("*")
        .eq("user_id", userRow.id)
        .order("uploaded_at", { ascending: false });

      if (docError) {
        throw docError;
      }

      setPlans((documents ?? []).map(transformStoredDocumentToPlan));
    } catch (loadError) {
      console.error("Failed to load saved plans:", loadError);
      setPlans([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load saved plans.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.sub]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { plans, isLoading, error, refresh };
}
