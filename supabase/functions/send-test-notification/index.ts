import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestNotificationPayload {
  user_id: string;
}

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
      console.error("[TestNotif] OneSignal API key not configured");
      return new Response(
        JSON.stringify({ success: false, error: "OneSignal not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is a superadmin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with anon key and auth header for JWT validation
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate JWT using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("[TestNotif] Claims error:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requesterId = claimsData.claims.sub as string;

    // Use service role client to check role and get data
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if requester is superadmin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .single();

    if (roleError || roleData?.role !== "superadmin") {
      console.error("[TestNotif] Not superadmin:", requesterId);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden - Superadmin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id }: TestNotificationPayload = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[TestNotif] Sending test notification to user:", user_id);

    // Get user's push subscription
    const { data: subscription, error: subError } = await supabase
      .from("push_subscriptions")
      .select("auth")
      .eq("user_id", user_id)
      .single();

    if (subError || !subscription) {
      console.error("[TestNotif] No subscription found for user:", user_id, subError);
      return new Response(
        JSON.stringify({ success: false, error: "El usuario no tiene suscripción push activa" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscriptionId = subscription.auth;
    
    if (!subscriptionId || subscriptionId.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "ID de suscripción inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info for the notification
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user_id)
      .single();

    const userName = profile?.full_name || profile?.email || user_id;

    console.log("[TestNotif] Subscription ID:", subscriptionId);
    console.log("[TestNotif] User name:", userName);

    // Send test notification
    // Target by subscription id
    const oneSignalPayload = {
      app_id: oneSignalAppId,
      include_subscription_ids: [subscriptionId],
      target_channel: "push",
      headings: { en: "🔔 Notificación de Prueba", es: "🔔 Notificación de Prueba" },
      contents: { 
        en: `Hola ${userName}, esta es una prueba del sistema de notificaciones.`, 
        es: `Hola ${userName}, esta es una prueba del sistema de notificaciones.` 
      },
      web_url: "https://requisicion-nrt.lovable.app/perfil",
      chrome_web_icon: "https://requisicion-nrt.lovable.app/pwa-192x192.png",
      firefox_icon: "https://requisicion-nrt.lovable.app/pwa-192x192.png",
    };

    console.log("[TestNotif] OneSignal payload:", JSON.stringify(oneSignalPayload));

    const oneSignalResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${oneSignalApiKey}`,
      },
      body: JSON.stringify(oneSignalPayload),
    });

    const oneSignalResult = await oneSignalResponse.json();

    console.log("[TestNotif] OneSignal response status:", oneSignalResponse.status);
    console.log("[TestNotif] OneSignal response:", JSON.stringify(oneSignalResult));

    if (!oneSignalResponse.ok) {
      console.error("[TestNotif] OneSignal error:", oneSignalResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: oneSignalResult.errors?.[0] || "Error de OneSignal",
          details: oneSignalResult
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // When using include_subscription_ids, OneSignal may not return recipients count
    // If we got a 200 OK and an ID, consider it successful
    const hasNotificationId = !!oneSignalResult?.id;
    const recipients = typeof oneSignalResult?.recipients === "number" 
      ? oneSignalResult.recipients 
      : (hasNotificationId ? 1 : 0);

    return new Response(
      JSON.stringify({
        success: hasNotificationId,
        recipients,
        oneSignalId: oneSignalResult.id,
        errors: oneSignalResult?.errors ?? null,
        userName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[TestNotif] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
