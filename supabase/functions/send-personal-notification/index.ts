import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PersonalNotificationPayload {
  user_id: string;
  title: string;
  message: string;
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
      console.error("[PersonalNotif] OneSignal API key not configured");
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

    // Validate JWT using anon key client
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("[PersonalNotif] Claims error:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requesterId = claimsData.claims.sub as string;

    // Use service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if requester is superadmin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .single();

    if (roleError || roleData?.role !== "superadmin") {
      console.error("[PersonalNotif] Not superadmin:", requesterId);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden - Superadmin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, title, message }: PersonalNotificationPayload = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id, title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[PersonalNotif] Sending personal notification to user:", user_id);

    // Get user's push subscription
    const { data: subscription, error: subError } = await supabase
      .from("push_subscriptions")
      .select("auth")
      .eq("user_id", user_id)
      .single();

    if (subError || !subscription) {
      console.error("[PersonalNotif] No subscription found for user:", user_id, subError);
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

    // Get user info for logging
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user_id)
      .single();

    const userName = profile?.full_name || profile?.email || user_id;

    console.log("[PersonalNotif] Subscription ID:", subscriptionId);
    console.log("[PersonalNotif] User name:", userName);

    // Send notification using OneSignal aliases
    const oneSignalPayload = {
      app_id: oneSignalAppId,
      include_aliases: { onesignal_id: [subscriptionId] },
      target_channel: "push",
      headings: { en: title, es: title },
      contents: { en: message, es: message },
      web_url: "https://requisicion-nrt.lovable.app/dashboard",
      chrome_web_icon: "https://requisicion-nrt.lovable.app/pwa-192x192.png",
      firefox_icon: "https://requisicion-nrt.lovable.app/pwa-192x192.png",
    };

    console.log("[PersonalNotif] OneSignal payload:", JSON.stringify(oneSignalPayload));

    const oneSignalResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${oneSignalApiKey}`,
      },
      body: JSON.stringify(oneSignalPayload),
    });

    const oneSignalResult = await oneSignalResponse.json();

    console.log("[PersonalNotif] OneSignal response status:", oneSignalResponse.status);
    console.log("[PersonalNotif] OneSignal response:", JSON.stringify(oneSignalResult));

    if (!oneSignalResponse.ok) {
      console.error("[PersonalNotif] OneSignal error:", oneSignalResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: oneSignalResult.errors?.[0] || "Error de OneSignal",
          details: oneSignalResult
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipients = typeof oneSignalResult?.recipients === "number" ? oneSignalResult.recipients : 0;

    return new Response(
      JSON.stringify({
        success: true,
        recipients,
        oneSignalId: oneSignalResult.id,
        errors: oneSignalResult?.errors ?? null,
        userName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PersonalNotif] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
