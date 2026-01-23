import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// VAPID Public Key - safe to expose in frontend
const VAPID_PUBLIC_KEY = "BEQEiUELkT0DZtn2WpBy5J3J4kFM2c1BGSzrH1JXzaomGwZorEZN4gt6pk_Yl7cXzu16P1NGokI4hGweknunl2k";

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: null,
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported = 
      "serviceWorker" in navigator && 
      "PushManager" in window && 
      "Notification" in window;
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : null,
    }));
    
    return isSupported;
  }, []);

  // Register service worker for push
  const registerServiceWorker = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw-push.js", {
        scope: "/"
      });
      console.log("[Push] Service worker registered:", registration);
      return registration;
    } catch (error) {
      console.error("[Push] Service worker registration failed:", error);
      throw error;
    }
  }, []);

  // Get existing subscription
  const getExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription;
    } catch (error) {
      console.error("[Push] Error getting subscription:", error);
      return null;
    }
  }, []);

  // Check subscription status in database
  const checkSubscriptionInDB = useCallback(async () => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) {
        console.error("[Push] Error checking subscription:", error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error("[Push] Error checking subscription:", error);
      return false;
    }
  }, [user]);

  // Initialize and check current status
  useEffect(() => {
    const init = async () => {
      if (!user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const isSupported = checkSupport();
      if (!isSupported) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Register SW first
        await registerServiceWorker();
        
        // Check if already subscribed
        const existingSub = await getExistingSubscription();
        const isInDB = await checkSubscriptionInDB();
        
        setState(prev => ({
          ...prev,
          isSubscribed: !!existingSub && isInDB,
          isLoading: false,
          permission: Notification.permission,
        }));
      } catch (error) {
        console.error("[Push] Init error:", error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    init();
  }, [user, checkSupport, registerServiceWorker, getExistingSubscription, checkSubscriptionInDB]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user || !VAPID_PUBLIC_KEY) {
      toast.error("No se puede activar las notificaciones push");
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      
      if (permission !== "granted") {
        toast.error("Permiso de notificaciones denegado");
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const subscriptionJson = subscription.toJSON();
      
      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        throw new Error("Invalid subscription data");
      }

      // Save subscription to database
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id"
        });

      if (error) throw error;

      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      toast.success("Notificaciones push activadas");
      return true;
    } catch (error: any) {
      console.error("[Push] Subscribe error:", error);
      toast.error(error.message || "Error al activar notificaciones push");
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Remove from browser
      const subscription = await getExistingSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove from database
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      toast.success("Notificaciones push desactivadas");
      return true;
    } catch (error: any) {
      console.error("[Push] Unsubscribe error:", error);
      toast.error("Error al desactivar notificaciones push");
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user, getExistingSubscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
};
