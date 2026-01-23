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

  // Initialize OneSignal
  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) return;
    
    const initOneSignal = async () => {
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

          // Initialize OneSignal
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            safari_web_id: "web.onesignal.auto.69a0d04c-4cfa-4f80-8d34-652264ce8748",
            notifyButton: {
              enable: false, // We'll use our own UI
            },
            allowLocalhostAsSecureOrigin: true,
          });

          console.log("[OneSignal] Initialized successfully");

          // Check current subscription state from OneSignal
          const isPushEnabled = await OneSignal.Notifications.permission;
          const isOptedIn = await OneSignal.User.PushSubscription.optedIn;
          
          // Cross-check with database
          let isSubscribedInDB = false;
          if (user) {
            isSubscribedInDB = await checkSubscriptionInDB(user.id);
          }
          
          // Final subscription state: must be in both OneSignal AND database
          const finalIsSubscribed = isPushEnabled && isOptedIn && isSubscribedInDB;
          
          console.log("[OneSignal] State check - OneSignal:", isPushEnabled && isOptedIn, "DB:", isSubscribedInDB, "Final:", finalIsSubscribed);
          
          setState(prev => ({
            ...prev,
            isSubscribed: finalIsSubscribed,
            permission: Notification.permission,
            isLoading: false,
          }));

          // Set external user ID if logged in
          if (user) {
            await OneSignal.login(user.id);
            console.log("[OneSignal] User logged in:", user.id);
            
            // If subscribed in OneSignal but not in DB, sync to DB
            if (isPushEnabled && isOptedIn && !isSubscribedInDB) {
              console.log("[OneSignal] Syncing subscription to DB");
              await saveSubscriptionToDatabase(OneSignal, user.id);
              setState(prev => ({ ...prev, isSubscribed: true }));
            }
          }

          // Listen for subscription changes
          OneSignal.Notifications.addEventListener("permissionChange", (permission: boolean) => {
            console.log("[OneSignal] Permission changed:", permission);
            setState(prev => ({
              ...prev,
              isSubscribed: permission,
              permission: permission ? "granted" : "denied",
            }));
          });

        } catch (error) {
          console.error("[OneSignal] Init error:", error);
          setState(prev => ({ ...prev, isLoading: false }));
        }
      });
    };

    initOneSignal();
  }, [user]);

  // Save subscription to database
  const saveSubscriptionToDatabase = async (OneSignal: any, userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

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
        } else {
          console.log("[OneSignal] Subscription saved to database");
        }
      }
    } catch (error) {
      console.error("[OneSignal] Error getting player ID:", error);
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
            
            const permission = await OneSignal.Notifications.permission;
            
            if (permission) {
              // Opt in to push
              await OneSignal.User.PushSubscription.optIn();
              
              // Login user
              await OneSignal.login(user.id);
              
              // Save to database
              await saveSubscriptionToDatabase(OneSignal);
              
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
                permission: "denied",
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
