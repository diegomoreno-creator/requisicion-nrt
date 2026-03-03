import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch the configured forced authorizer IDs from the database.
 */
export const useForcedAuthorizers = () => {
  const [forcedIds, setForcedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("autorizadores_presupuesto")
        .select("user_id, orden")
        .order("orden", { ascending: true });
      if (!error && data) {
        setForcedIds(data.map((d: any) => d.user_id));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return { forcedIds, loading };
};

/**
 * Check if budget amount triggers multi-auth requirement.
 */
export const isBudgetMultiAuth = (presupuesto: number): boolean => {
  return presupuesto > MULTI_AUTH_BUDGET_THRESHOLD;
};

/**
 * Hook to manage multi-authorizer state for a requisition.
 */
export const useMultiAuth = (requisicionId: string | null) => {
  const [autorizadores, setAutorizadores] = useState<AutorizadorEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMultiAuth, setIsMultiAuth] = useState(false);

  const fetchAutorizadores = useCallback(async () => {
    if (!requisicionId) {
      setAutorizadores([]);
      setIsMultiAuth(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("requisicion_autorizadores")
        .select("*")
        .eq("requisicion_id", requisicionId);

      if (error) throw error;

      if (data && data.length > 0) {
        setIsMultiAuth(true);
        // Fetch names for each authorizer
        const withNames = await Promise.all(
          data.map(async (entry: any) => {
            const { data: name } = await supabase.rpc("get_profile_name", {
              _user_id: entry.autorizador_id,
            });
            return {
              ...entry,
              orden: entry.orden ?? 0,
              autorizador_nombre: name || "Usuario",
            } as AutorizadorEntry;
          })
        );
        // Sort by orden
        withNames.sort((a, b) => a.orden - b.orden);
        setAutorizadores(withNames);
      } else {
        setAutorizadores([]);
        setIsMultiAuth(false);
      }
    } catch (error) {
      console.error("Error fetching multi-auth:", error);
    } finally {
      setLoading(false);
    }
  }, [requisicionId]);

  useEffect(() => {
    fetchAutorizadores();
  }, [fetchAutorizadores]);

  const allApproved = isMultiAuth && autorizadores.length > 0 && 
    autorizadores.every(a => a.estado === "aprobado");

  const anyRejected = isMultiAuth && autorizadores.some(a => a.estado === "rechazado");

  const pendingCount = autorizadores.filter(a => a.estado === "pendiente").length;

  // Sequential auth: check if all authorizers have orden > 0 (sequential mode)
  const isSequential = isMultiAuth && autorizadores.length > 0 && autorizadores.every(a => a.orden > 0);

  // Get the current authorizer whose turn it is (lowest orden with estado pendiente)
  const currentTurnAutorizador = isSequential 
    ? autorizadores.find(a => a.estado === "pendiente")
    : null;

  // Check if it's a specific user's turn in sequential flow
  const isUserTurn = (userId: string): boolean => {
    if (!isSequential) {
      // Parallel mode: any pending user can act
      return autorizadores.some(a => a.autorizador_id === userId && a.estado === "pendiente");
    }
    // Sequential mode: only the current turn user can act
    return currentTurnAutorizador?.autorizador_id === userId;
  };

  const getUserApprovalStatus = (userId: string): AutorizadorEntry | undefined => {
    return autorizadores.find(a => a.autorizador_id === userId);
  };

  const isUserAssigned = (userId: string): boolean => {
    return autorizadores.some(a => a.autorizador_id === userId);
  };

  return {
    autorizadores,
    isMultiAuth,
    isSequential,
    loading,
    allApproved,
    anyRejected,
    pendingCount,
    currentTurnAutorizador,
    isUserTurn,
    getUserApprovalStatus,
    isUserAssigned,
    refetch: fetchAutorizadores,
  };
};
