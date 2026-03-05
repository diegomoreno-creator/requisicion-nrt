import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AutorizadorEntry {
  id: string;
  requisicion_id: string;
  autorizador_id: string;
  estado: string;
  justificacion_rechazo: string | null;
  fecha_accion: string | null;
  orden: number;
  autorizador_nombre?: string;
}

// Budget threshold for automatic multi-auth (MXN) — triggers when amount > 49999 (i.e. >= 50000)
export const MULTI_AUTH_BUDGET_THRESHOLD = 49999;

/**
 * Hook to fetch the configured forced authorizer IDs from the database.
 */
export const useForcedAuthorizers = () => {
  const [forcedIds, setForcedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("autorizadores_presupuesto")
      .select("user_id, orden")
      .order("orden", { ascending: true });
    if (!error && data) {
      setForcedIds(data.map((d: any) => d.user_id));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { forcedIds, loading, refetch };
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

  const isSequential = isMultiAuth && autorizadores.length > 0 && autorizadores.every(a => a.orden > 0);

  const currentTurnAutorizador = isSequential 
    ? autorizadores.find(a => a.estado === "pendiente")
    : null;

  const isUserTurn = (userId: string): boolean => {
    if (!isSequential) {
      return autorizadores.some(a => a.autorizador_id === userId && a.estado === "pendiente");
    }
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
