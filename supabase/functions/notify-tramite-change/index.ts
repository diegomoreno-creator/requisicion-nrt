import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente de Autorización",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  en_licitacion: "En Licitación",
  pedido_colocado: "Pedido Colocado",
  pedido_autorizado: "Pedido Autorizado",
  pedido_pagado: "Pagado",
};

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
  schema: string;
}

// Determine which users should be notified based on the new state
function getNotificationTargets(
  table: string,
  newRecord: Record<string, unknown>,
  oldRecord: Record<string, unknown> | null
): { userIds: string[]; roles: string[] } {
  const userIds: string[] = [];
  const roles: string[] = [];
  
  const newEstado = newRecord.estado as string;
  const oldEstado = oldRecord?.estado as string | undefined;
  
  // Only notify if estado actually changed
  if (oldEstado === newEstado) {
    return { userIds, roles };
  }
  
  const solicitadoPor = newRecord.solicitado_por as string | undefined;
  const autorizadorId = newRecord.autorizador_id as string | undefined;
  
  if (table === "requisiciones") {
    switch (newEstado) {
      case "pendiente":
        // New requisition pending - notify the assigned authorizer
        if (autorizadorId) userIds.push(autorizadorId);
        break;
        
      case "aprobado":
        // Approved - notify requester and compradores
        if (solicitadoPor) userIds.push(solicitadoPor);
        roles.push("comprador");
        break;
        
      case "rechazado":
        // Rejected - notify only the requester
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
        
      case "en_licitacion":
        // In bidding - notify requester
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
        
      case "pedido_colocado":
        // Order placed - notify requester and presupuestos
        if (solicitadoPor) userIds.push(solicitadoPor);
        roles.push("presupuestos");
        break;
        
      case "pedido_autorizado":
        // Order authorized - notify requester and tesoreria
        if (solicitadoPor) userIds.push(solicitadoPor);
        roles.push("tesoreria");
        break;
        
      case "pedido_pagado":
        // Paid - notify requester
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
        
      case "cancelado":
        // Cancelled - notify authorizer if exists
        if (autorizadorId) userIds.push(autorizadorId);
        break;
    }
  } else if (table === "reposiciones") {
    switch (newEstado) {
      case "pendiente":
        // Pending - notify authorizer
        if (autorizadorId) userIds.push(autorizadorId);
        break;
        
      case "aprobado":
        // Approved - notify requester
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
        
      case "rechazado":
        // Rejected - notify requester
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
        
      case "pagado":
        // Paid - notify requester
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
    }
  }
  
  return { userIds, roles };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[Notify] VAPID keys not configured, skipping push");
      return new Response(
        JSON.stringify({ success: true, message: "VAPID not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: WebhookPayload = await req.json();
    
    console.log("[Notify] Webhook received:", {
      type: payload.type,
      table: payload.table,
      newEstado: payload.record?.estado,
      oldEstado: payload.old_record?.estado,
    });

    // Only process UPDATE events
    if (payload.type !== "UPDATE") {
      return new Response(
        JSON.stringify({ success: true, message: "Not an update" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newRecord = payload.record;
    const oldRecord = payload.old_record;
    
    // Check if estado changed
    if (newRecord.estado === oldRecord?.estado) {
      console.log("[Notify] Estado unchanged, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Estado unchanged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userIds, roles } = getNotificationTargets(payload.table, newRecord, oldRecord);
    
    if (userIds.length === 0 && roles.length === 0) {
      console.log("[Notify] No targets for notification");
      return new Response(
        JSON.stringify({ success: true, message: "No targets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Collect all user IDs (direct + from roles)
    const allUserIds = new Set(userIds);
    
    if (roles.length > 0) {
      const { data: roleUsers, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", roles);
      
      if (!roleError && roleUsers) {
        roleUsers.forEach(u => allUserIds.add(u.user_id));
      }
    }
    
    if (allUserIds.size === 0) {
      console.log("[Notify] No users to notify after role resolution");
      return new Response(
        JSON.stringify({ success: true, message: "No users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check notification preferences
    const userIdArray = Array.from(allUserIds);
    const prefColumn = payload.table === "requisiciones" ? "notify_requisiciones" : "notify_reposiciones";
    
    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .in("user_id", userIdArray)
      .eq(prefColumn, true);
    
    if (prefsError) {
      console.error("[Notify] Error fetching preferences:", prefsError);
    }
    
    // Filter to only users who have notifications enabled
    const usersWithNotifs = prefs?.map(p => p.user_id) || userIdArray;
    
    if (usersWithNotifs.length === 0) {
      console.log("[Notify] All users have notifications disabled");
      return new Response(
        JSON.stringify({ success: true, message: "Notifications disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", usersWithNotifs);
    
    if (subError) throw subError;
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log("[Notify] No push subscriptions found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Notify] Sending to ${subscriptions.length} devices`);

    // Build notification content
    const folio = newRecord.folio as string;
    const newEstado = newRecord.estado as string;
    const tramiteType = payload.table === "requisiciones" ? "Requisición" : "Reposición";
    const estadoLabel = estadoLabels[newEstado] || newEstado;
    
    const notificationPayload = JSON.stringify({
      title: `${tramiteType} ${folio}`,
      body: `Estado: ${estadoLabel}`,
      url: "/tramites",
      tag: `tramite-${newRecord.id}`,
      icon: "/pwa-192x192.png"
    });

    let sent = 0;
    let failed = 0;
    const expiredSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        const audience = new URL(sub.endpoint).origin;
        const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
        
        const header = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" }));
        const claims = btoa(JSON.stringify({
          aud: audience,
          exp: expiration,
          sub: "mailto:admin@nrt.com.mx"
        }));

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "TTL": "86400",
            "Authorization": `vapid t=${header}.${claims}., k=${vapidPublicKey}`,
          },
          body: notificationPayload,
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
          console.log(`[Notify] Sent to ${sub.user_id}`);
        } else if (response.status === 410 || response.status === 404) {
          console.log(`[Notify] Subscription expired for ${sub.user_id}`);
          expiredSubscriptions.push(sub.id);
          failed++;
        } else {
          const text = await response.text();
          console.error(`[Notify] Failed for ${sub.user_id}: ${response.status} - ${text}`);
          failed++;
        }
      } catch (error) {
        console.error(`[Notify] Error sending to ${sub.user_id}:`, error);
        failed++;
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubscriptions);
    }

    console.log(`[Notify] Results - Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Notify] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
