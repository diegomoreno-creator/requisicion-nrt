import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

const estadoLabels: Record<string, string> = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  en_licitacion: "En Licitación",
  completado: "Completado",
};

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const previousStatesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) return;

    // Fetch initial states to track changes
    const fetchInitialStates = async () => {
      const { data: requisiciones } = await supabase
        .from("requisiciones")
        .select("id, estado, folio");

      const { data: reposiciones } = await supabase
        .from("reposiciones")
        .select("id, estado, folio");

      requisiciones?.forEach((r) => {
        previousStatesRef.current.set(`req-${r.id}`, r.estado || "");
      });

      reposiciones?.forEach((r) => {
        previousStatesRef.current.set(`repo-${r.id}`, r.estado || "");
      });
    };

    fetchInitialStates();

    // Subscribe to requisiciones changes
    const requisicionesChannel = supabase
      .channel("requisiciones-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "requisiciones",
        },
        async (payload) => {
          const newData = payload.new as { id: string; estado: string; folio: string; solicitado_por: string };
          const previousEstado = previousStatesRef.current.get(`req-${newData.id}`);

          // Only notify if estado changed and it's relevant to the current user
          if (previousEstado && previousEstado !== newData.estado) {
            const newEstadoLabel = estadoLabels[newData.estado] || newData.estado;
            
            toast.info(`Requisición ${newData.folio}`, {
              description: `Estado actualizado a: ${newEstadoLabel}`,
              duration: 5000,
            });

            // Update the tracked state
            previousStatesRef.current.set(`req-${newData.id}`, newData.estado);
          }
        }
      )
      .subscribe();

    // Subscribe to reposiciones changes
    const reposicionesChannel = supabase
      .channel("reposiciones-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reposiciones",
        },
        async (payload) => {
          const newData = payload.new as { id: string; estado: string; folio: string; solicitado_por: string };
          const previousEstado = previousStatesRef.current.get(`repo-${newData.id}`);

          // Only notify if estado changed
          if (previousEstado && previousEstado !== newData.estado) {
            const newEstadoLabel = estadoLabels[newData.estado] || newData.estado;
            
            toast.info(`Reposición ${newData.folio}`, {
              description: `Estado actualizado a: ${newEstadoLabel}`,
              duration: 5000,
            });

            // Update the tracked state
            previousStatesRef.current.set(`repo-${newData.id}`, newData.estado);
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(requisicionesChannel);
      supabase.removeChannel(reposicionesChannel);
    };
  }, [user]);
};
