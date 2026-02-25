import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AutorizadorEntry {
  id: string;
  requisicion_id: string;
  autorizador_id: string;
  estado: string;
  justificacion_rechazo: string | null;
  fecha_accion: string | null;
  autorizador_nombre?: string;
}

// Budget threshold for automatic multi-auth (MXN)
export const MULTI_AUTH_BUDGET_THRESHOLD = 50000;

// Fixed authorizer user IDs that must be included when budget exceeds threshold
export const FORCED_AUTHORIZER_IDS = [
  "f27c379d-47e5-4e6b-9046-a79d84f79f2b", // Gabriel Aguilar
  "d894fca9-4bcc-49f5-a011-7bdef16cb872", // Lic. Rolando A.
];

/**
 * Check if a requisition type name requires multiple authorizers.
 */
export const isMultiAuthType = (tipoNombre: string): boolean => {
  return tipoNombre.toLowerCase().includes("compra de vehículo") ||
         tipoNombre.toLowerCase().includes("compra de vehiculo");
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
              autorizador_nombre: name || "Usuario",
            } as AutorizadorEntry;
          })
        );
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

  const getUserApprovalStatus = (userId: string): AutorizadorEntry | undefined => {
    return autorizadores.find(a => a.autorizador_id === userId);
  };

  const isUserAssigned = (userId: string): boolean => {
    return autorizadores.some(a => a.autorizador_id === userId);
  };

  return {
    autorizadores,
    isMultiAuth,
    loading,
    allApproved,
    anyRejected,
    pendingCount,
    getUserApprovalStatus,
    isUserAssigned,
    refetch: fetchAutorizadores,
  };
};
