import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RoleNotificationPayload {
  role: string;
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
      console.error("[RoleNotif] OneSignal API key not configured");
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
      console.error("[RoleNotif] Claims error:", claimsError);
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
      console.error("[RoleNotif] Not superadmin:", requesterId);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden - Superadmin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { role, title, message }: RoleNotificationPayload = await req.json();

    if (!role || !title || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "role, title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[RoleNotif] Sending notification to role:", role);

    // Get all users with the specified role
    const { data: usersWithRole, error: usersError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", role);

    if (usersError) {
      console.error("[RoleNotif] Error fetching users with role:", usersError);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!usersWithRole || usersWithRole.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: `No hay usuarios con el rol "${role}"` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = usersWithRole.map(u => u.user_id);
    console.log(`[RoleNotif] Found ${userIds.length} users with role ${role}`);

    // Get push subscriptions for these users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("auth, user_id")
      .in("user_id", userIds);

    if (subError) {
      console.error("[RoleNotif] Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract valid subscription IDs
    const subscriptionIds = Array.from(
      new Set(
        (subscriptions ?? [])
          .map((sub) => sub.auth)
          .filter((id) => typeof id === "string" && id.length > 10)
      )
    );

    console.log(`[RoleNotif] Found ${subscriptionIds.length} active subscriptions for role ${role}`);

    if (subscriptionIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No hay suscripciones push activas para usuarios con rol "${role}"`,
          usersWithRole: userIds.length,
          subscriptionsFound: 0
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get role display name
    const roleDisplayNames: Record<string, string> = {
      superadmin: "Superadministradores",
      admin: "Administradores",
      autorizador: "Autorizadores",
      comprador: "Compradores",
      presupuestos: "Presupuestos",
      tesoreria: "Tesorería",
      solicitador: "Solicitadores",
      inactivo: "Inactivos"
    };

    const roleDisplayName = roleDisplayNames[role] || role;

    // Send notification
    const oneSignalPayload = {
      app_id: oneSignalAppId,
      include_subscription_ids: subscriptionIds,
      target_channel: "push",
      headings: { en: title, es: title },
      contents: { en: message, es: message },
      web_url: "https://requisicion-nrt.lovable.app/dashboard",
      chrome_web_icon: "https://requisicion-nrt.lovable.app/pwa-192x192.png",
      firefox_icon: "https://requisicion-nrt.lovable.app/pwa-192x192.png",
    };

    console.log("[RoleNotif] OneSignal payload:", JSON.stringify(oneSignalPayload));

    const oneSignalResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${oneSignalApiKey}`,
      },
      body: JSON.stringify(oneSignalPayload),
    });

    const oneSignalResult = await oneSignalResponse.json();

    console.log("[RoleNotif] OneSignal response status:", oneSignalResponse.status);
    console.log("[RoleNotif] OneSignal response:", JSON.stringify(oneSignalResult));

    if (!oneSignalResponse.ok) {
      console.error("[RoleNotif] OneSignal error:", oneSignalResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: oneSignalResult.errors?.[0] || "Error de OneSignal",
          details: oneSignalResult
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success detection based on oneSignalId
    const hasNotificationId = !!oneSignalResult?.id;
    const recipients = typeof oneSignalResult?.recipients === "number" 
      ? oneSignalResult.recipients 
      : (hasNotificationId ? subscriptionIds.length : 0);

    return new Response(
      JSON.stringify({
        success: hasNotificationId,
        recipients,
        oneSignalId: oneSignalResult.id,
        errors: oneSignalResult?.errors ?? null,
        role,
        roleDisplayName,
        usersWithRole: userIds.length,
        subscriptionsFound: subscriptionIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[RoleNotif] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
