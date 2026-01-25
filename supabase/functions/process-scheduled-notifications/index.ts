import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const oneSignalAppId = "e9acc76a-6d64-4a22-a386-6bbc611980b9";
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!oneSignalApiKey) {
      console.error("[ScheduledNotif] OneSignal API key not configured");
      return new Response(
        JSON.stringify({ success: false, error: "OneSignal not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending notifications that are due
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from("scheduled_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (fetchError) {
      console.error("[ScheduledNotif] Error fetching pending:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching pending notifications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ScheduledNotif] Found ${pendingNotifications?.length || 0} pending notifications`);

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending notifications" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const notification of pendingNotifications) {
      console.log(`[ScheduledNotif] Processing: ${notification.id} (${notification.notification_type})`);

      try {
        let subscriptionIds: string[] = [];
        let targetDescription = "";

        // Get subscription IDs based on notification type
        if (notification.notification_type === "broadcast") {
          // Get all subscriptions
          const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("auth");
          
          subscriptionIds = (subs || [])
            .map(s => s.auth)
            .filter(id => typeof id === "string" && id.length > 10);
          targetDescription = "todos";

        } else if (notification.notification_type === "role") {
          // Get users with the role
          const { data: usersWithRole } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", notification.target_role);

          if (usersWithRole && usersWithRole.length > 0) {
            const userIds = usersWithRole.map(u => u.user_id);
            const { data: subs } = await supabase
              .from("push_subscriptions")
              .select("auth")
              .in("user_id", userIds);

            subscriptionIds = (subs || [])
              .map(s => s.auth)
              .filter(id => typeof id === "string" && id.length > 10);
          }
          targetDescription = `rol ${notification.target_role}`;

        } else if (notification.notification_type === "personal") {
          // Get specific user's subscription
          const { data: sub } = await supabase
            .from("push_subscriptions")
            .select("auth")
            .eq("user_id", notification.target_user_id)
            .single();

          if (sub?.auth && sub.auth.length > 10) {
            subscriptionIds = [sub.auth];
          }
          targetDescription = `usuario ${notification.target_user_id}`;
        }

        // Remove duplicates
        subscriptionIds = [...new Set(subscriptionIds)];

        if (subscriptionIds.length === 0) {
          // No subscriptions found - mark as failed
          await supabase
            .from("scheduled_notifications")
            .update({
              status: "failed",
              sent_at: new Date().toISOString(),
              error_message: `No hay suscripciones activas para ${targetDescription}`,
              recipients_count: 0,
            })
            .eq("id", notification.id);

          results.push({ id: notification.id, success: false, error: "No subscriptions" });
          continue;
        }

        // Send notification via OneSignal
        const oneSignalPayload = {
          app_id: oneSignalAppId,
          include_subscription_ids: subscriptionIds,
          target_channel: "push",
          headings: { en: notification.title, es: notification.title },
          contents: { en: notification.message, es: notification.message },
          web_url: "https://requisicion-nrt.lovable.app/dashboard",
          chrome_web_icon: "https://requisicion-nrt.lovable.app/pwa-192x192.png",
          firefox_icon: "https://requisicion-nrt.lovable.app/pwa-192x192.png",
        };

        const oneSignalResponse = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${oneSignalApiKey}`,
          },
          body: JSON.stringify(oneSignalPayload),
        });

        const oneSignalResult = await oneSignalResponse.json();

        if (!oneSignalResponse.ok) {
          console.error(`[ScheduledNotif] OneSignal error for ${notification.id}:`, oneSignalResult);
          await supabase
            .from("scheduled_notifications")
            .update({
              status: "failed",
              sent_at: new Date().toISOString(),
              error_message: oneSignalResult.errors?.[0] || "Error de OneSignal",
              recipients_count: 0,
            })
            .eq("id", notification.id);

          results.push({ id: notification.id, success: false, error: "OneSignal error" });
          continue;
        }

        // Success
        const hasNotificationId = !!oneSignalResult?.id;
        const recipients = typeof oneSignalResult?.recipients === "number"
          ? oneSignalResult.recipients
          : (hasNotificationId ? subscriptionIds.length : 0);

        await supabase
          .from("scheduled_notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            recipients_count: recipients,
          })
          .eq("id", notification.id);

        console.log(`[ScheduledNotif] Sent ${notification.id} to ${recipients} recipients`);
        results.push({ id: notification.id, success: true });

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[ScheduledNotif] Error processing ${notification.id}:`, errorMsg);
        
        await supabase
          .from("scheduled_notifications")
          .update({
            status: "failed",
            sent_at: new Date().toISOString(),
            error_message: errorMsg,
          })
          .eq("id", notification.id);

        results.push({ id: notification.id, success: false, error: errorMsg });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[ScheduledNotif] Completed: ${successful} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ScheduledNotif] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
