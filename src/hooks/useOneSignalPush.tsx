import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// OneSignal App ID
const ONESIGNAL_APP_ID = "e9acc76a-6d64-4a22-a386-6bbc611980b9";

// Extend Window interface for OneSignal
declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => Promise<void>>;
    OneSignal?: any;
  }
}

interface OneSignalState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | null;
}

const isLovablePreviewHost = (hostname: string) => {
  // Detectar dominios de preview de Lovable
  // Los dominios de preview terminan en .lovableproject.com o id-preview--*.lovable.app
  // El dominio publicado es requisicion-nrt.lovable.app (NO debe ser bloqueado)
  if (hostname.endsWith(".lovableproject.com")) return true;
  if (hostname.includes("id-preview--")) return true;
  // Cualquier otro dominio .lovable.app (que no sea id-preview) es válido
  return false;
};

const normalizeOneSignalPermission = (permission: any): NotificationPermission => {
  if (permission === true) return "granted";
  if (permission === false) return "denied";
  if (permission === "granted" || permission === "denied" || permission === "default") return permission;
  return typeof Notification !== "undefined" ? Notification.permission : "default";
};

// Check if subscription exists in database
const checkSubscriptionInDB = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (error) {
      console.error("[OneSignal] Error checking DB subscription:", error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error("[OneSignal] Error checking DB subscription:", error);
    return false;
  }
};

export const useOneSignalPush = () => {
  const { user } = useAuth();
  const [state, setState] = useState<OneSignalState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: null,
  });
  const initializedRef = useRef(false);
  const warnedPreviewRef = useRef(false);

  // Initialize OneSignal
  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) return;
    
    const initOneSignal = async () => {
      console.log("[OneSignal] Init starting, hostname:", window.location.hostname);
      
      // OneSignal está restringido al dominio publicado; en dominios de preview fallará.
      if (isLovablePreviewHost(window.location.hostname)) {
        console.log("[OneSignal] Preview host detected, skipping init");
        if (!warnedPreviewRef.current) {
          warnedPreviewRef.current = true;
          toast.info(
            "Las notificaciones push solo se pueden activar desde la app publicada (reinstala la PWA desde ahí)"
          );
        }
        setState(prev => ({
          ...prev,
          isSupported: false,
          isSubscribed: false,
          isLoading: false,
          permission: ("Notification" in window) ? Notification.permission : null,
        }));
        return;
      }

      console.log("[OneSignal] Valid domain, proceeding with init");

      // Check if browser supports notifications
      if (!("Notification" in window)) {
        console.log("[OneSignal] Notifications not supported");
        setState(prev => ({ ...prev, isSupported: false, isLoading: false }));
        return;
      }

      setState(prev => ({ ...prev, isSupported: true, permission: Notification.permission }));

      // If user is logged in, first check database for existing subscription
      // This is the source of truth for subscription state
      if (user) {
        const hasDBSubscription = await checkSubscriptionInDB(user.id);
        console.log("[OneSignal] DB subscription check:", hasDBSubscription);
        
        // If DB says subscribed but browser permission is denied, clean up DB
        if (hasDBSubscription && Notification.permission === "denied") {
          console.log("[OneSignal] Cleaning up stale DB subscription");
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id);
          setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
          return;
        }
        
        // Use DB as source of truth combined with browser permission
        if (hasDBSubscription && Notification.permission === "granted") {
          setState(prev => ({ ...prev, isSubscribed: true, permission: "granted", isLoading: false }));
        }
      }

      // Wait for OneSignal SDK to load
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          // Check if already initialized
          if (initializedRef.current) return;
          initializedRef.current = true;

          console.log("[OneSignal] Calling OneSignal.init()");
          
          // Initialize OneSignal
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            safari_web_id: "web.onesignal.auto.69a0d04c-4cfa-4f80-8d34-652264ce8748",
            notifyButton: {
              enable: false, // We'll use our own UI
            },
            allowLocalhostAsSecureOrigin: true,
            // Dejar que OneSignal maneje el service worker automáticamente
            // Esto funciona mejor en PWAs instaladas
          });

          console.log("[OneSignal] Initialized successfully");

          // Check current subscription state from OneSignal
          const permission = normalizeOneSignalPermission(await OneSignal.Notifications.permission);
          const isPushEnabled = permission === "granted";
          const isOptedIn = await OneSignal.User.PushSubscription.optedIn;
          
          // Cross-check with database
          let isSubscribedInDB = false;
          if (user) {
            isSubscribedInDB = await checkSubscriptionInDB(user.id);
          }
          
          // Final subscription state: DB + permiso (especialmente importante en iOS PWA,
          // donde el flag 'optedIn' puede desincronizarse al re-montar)
          const finalIsSubscribed = isPushEnabled && isSubscribedInDB;
          
          console.log(
            "[OneSignal] State check - Permission granted:",
            isPushEnabled,
            "OptedIn:",
            isOptedIn,
            "DB:",
            isSubscribedInDB,
            "Final:",
            finalIsSubscribed
          );
          
          setState(prev => ({
            ...prev,
            isSubscribed: finalIsSubscribed,
            permission,
            isLoading: false,
          }));

          // Set external user ID if logged in
          if (user) {
            await OneSignal.login(user.id);
            console.log("[OneSignal] User logged in:", user.id);
            
            // If subscribed in OneSignal but not in DB, sync to DB
            if (isPushEnabled && isOptedIn && !isSubscribedInDB) {
              console.log("[OneSignal] Syncing subscription to DB");
              const saved = await saveSubscriptionToDatabase(OneSignal, user.id);
              if (saved) setState(prev => ({ ...prev, isSubscribed: true }));
            }
          }

          // Listen for subscription changes
          OneSignal.Notifications.addEventListener("permissionChange", (permission: boolean) => {
            const normalized = normalizeOneSignalPermission(permission);
            console.log("[OneSignal] Permission changed:", normalized);
            setState(prev => ({
              ...prev,
              isSubscribed: normalized === "granted" ? prev.isSubscribed : false,
              permission: normalized,
            }));
          });

        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[OneSignal] Init error:", error);
          if (message.includes("Can only be used on:")) {
            toast.info("Las notificaciones push requieren abrir la app publicada y reinstalar la PWA desde esa URL");
          }
          setState(prev => ({ ...prev, isLoading: false }));
        }
      });
      
      // Timeout fallback: si OneSignal no carga en 10 segundos, marcar como no soportado
      setTimeout(() => {
        setState(prev => {
          if (prev.isLoading) {
            console.warn("[OneSignal] SDK load timeout");
            return { ...prev, isLoading: false };
          }
          return prev;
        });
      }, 10000);
    };

    initOneSignal();
  }, [user]);

  // Save subscription to database
  // Returns true only if the record was persisted successfully.
  const saveSubscriptionToDatabase = async (OneSignal: any, userId?: string): Promise<boolean> => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return false;

    try {
      const playerId = await OneSignal.User.PushSubscription.id;
      
      if (playerId) {
        // Store OneSignal player ID in push_subscriptions table
        const { error } = await supabase
          .from("push_subscriptions")
          .upsert({
            user_id: targetUserId,
            endpoint: `onesignal:${playerId}`,
            p256dh: "onesignal",
            auth: playerId,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id"
          });

        if (error) {
          console.error("[OneSignal] Error saving subscription:", error);
          return false;
        } else {
          console.log("[OneSignal] Subscription saved to database");
          return true;
        }
      }

      console.warn("[OneSignal] Missing player/subscription id; cannot persist subscription");
      return false;
    } catch (error) {
      console.error("[OneSignal] Error getting player ID:", error);
      return false;
    }
  };

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error("Debes iniciar sesión para activar notificaciones");
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      
      return new Promise<boolean>((resolve) => {
        window.OneSignalDeferred!.push(async (OneSignal: any) => {
          try {
            // Request permission and opt in
            await OneSignal.Notifications.requestPermission();
            
            const permission = normalizeOneSignalPermission(await OneSignal.Notifications.permission);
            
            if (permission === "granted") {
              // Opt in to push
              await OneSignal.User.PushSubscription.optIn();
              
              // Login user
              await OneSignal.login(user.id);
              
              // Save to database
              const saved = await saveSubscriptionToDatabase(OneSignal);
              if (!saved) {
                toast.error("No se pudo guardar la suscripción push; intenta de nuevo");
                setState(prev => ({
                  ...prev,
                  isSubscribed: false,
                  permission,
                  isLoading: false,
                }));
                resolve(false);
                return;
              }
              
              setState(prev => ({ 
                ...prev, 
                isSubscribed: true, 
                permission: "granted",
                isLoading: false 
              }));
              
              toast.success("Notificaciones push activadas");
              resolve(true);
            } else {
              toast.error("Permiso de notificaciones denegado");
              setState(prev => ({ 
                ...prev, 
                isSubscribed: false, 
                permission,
                isLoading: false 
              }));
              resolve(false);
            }
          } catch (error: any) {
            console.error("[OneSignal] Subscribe error:", error);
            toast.error("Error al activar notificaciones push");
            setState(prev => ({ ...prev, isLoading: false }));
            resolve(false);
          }
        });
      });
    } catch (error: any) {
      console.error("[OneSignal] Subscribe error:", error);
      toast.error("Error al activar notificaciones push");
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      
      return new Promise<boolean>((resolve) => {
        window.OneSignalDeferred!.push(async (OneSignal: any) => {
          try {
            // Opt out of push
            await OneSignal.User.PushSubscription.optOut();
            
            // Logout user
            await OneSignal.logout();
            
            // Remove from database
            const { error } = await supabase
              .from("push_subscriptions")
              .delete()
              .eq("user_id", user.id);

            if (error) {
              console.error("[OneSignal] Error removing subscription:", error);
            }
            
            setState(prev => ({ 
              ...prev, 
              isSubscribed: false, 
              isLoading: false 
            }));
            
            toast.success("Notificaciones push desactivadas");
            resolve(true);
          } catch (error: any) {
            console.error("[OneSignal] Unsubscribe error:", error);
            toast.error("Error al desactivar notificaciones push");
            setState(prev => ({ ...prev, isLoading: false }));
            resolve(false);
          }
        });
      });
    } catch (error: any) {
      console.error("[OneSignal] Unsubscribe error:", error);
      toast.error("Error al desactivar notificaciones push");
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
};
