import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BroadcastPayload {
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
      console.error("[Broadcast] OneSignal API key not configured");
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
      console.error("[Broadcast] Claims error:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Use service role client to check role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is superadmin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleError || roleData?.role !== "superadmin") {
      console.error("[Broadcast] Not superadmin:", userId);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden - Superadmin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { title, message }: BroadcastPayload = await req.json();

    if (!title || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active push subscriptions with player IDs
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("auth");  // auth column stores the OneSignal player_id

    if (subError) {
      console.error("[Broadcast] Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract player IDs (stored in 'auth' column)
    const playerIds = subscriptions
      ?.map(sub => sub.auth)
      .filter(id => id && id.length > 10) || [];  // Filter out invalid IDs

    console.log(`[Broadcast] Found ${playerIds.length} active subscriptions`);

    if (playerIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No active push subscriptions found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Broadcast] Sending notification:", { title, message, playerCount: playerIds.length });
    console.log("[Broadcast] Player IDs:", playerIds);

    // Send notification to specific player IDs instead of segments
    const oneSignalPayload = {
      app_id: oneSignalAppId,
      include_player_ids: playerIds,
      headings: { en: title, es: title },
      contents: { en: message, es: message },
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
      console.error("[Broadcast] OneSignal error:", oneSignalResult);
      return new Response(
        JSON.stringify({ success: false, error: oneSignalResult.errors?.[0] || "OneSignal error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Broadcast] OneSignal response:", oneSignalResult);

    return new Response(
      JSON.stringify({
        success: true,
        recipients: oneSignalResult.recipients || playerIds.length,
        oneSignalId: oneSignalResult.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Broadcast] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
