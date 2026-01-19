import { useEffect, useRef, useState } from "react";
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

interface NotificationPreferences {
  notify_requisiciones: boolean;
  notify_reposiciones: boolean;
}

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notify_requisiciones: true,
    notify_reposiciones: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from("notification_preferences")
          .select("notify_requisiciones, notify_reposiciones")
          .eq("user_id", user.id)
          .single();

        if (error) {
          // If no preferences exist, create them
          if (error.code === "PGRST116") {
            const { data: newData, error: insertError } = await supabase
              .from("notification_preferences")
              .insert({ user_id: user.id })
              .select("notify_requisiciones, notify_reposiciones")
              .single();

            if (!insertError && newData) {
              setPreferences(newData);
            }
          }
        } else if (data) {
          setPreferences(data);
        }
      } catch (err) {
        console.error("Error fetching notification preferences:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("notification_preferences")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      setPreferences((prev) => ({ ...prev, ...updates }));
      return true;
    } catch (err) {
      console.error("Error updating notification preferences:", err);
      return false;
    }
  };

  return { preferences, loading, updatePreferences };
};

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const { preferences } = useNotificationPreferences();
  const previousStatesRef = useRef<Map<string, string>>(new Map());
  const preferencesRef = useRef(preferences);

  // Keep preferences ref updated
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

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
          // Check if notifications are enabled for requisiciones
          if (!preferencesRef.current.notify_requisiciones) return;

          const newData = payload.new as { id: string; estado: string; folio: string; solicitado_por: string };
          const previousEstado = previousStatesRef.current.get(`req-${newData.id}`);

          // Only notify if estado changed
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
          // Check if notifications are enabled for reposiciones
          if (!preferencesRef.current.notify_reposiciones) return;

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
