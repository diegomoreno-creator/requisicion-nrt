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
    const oneSignalAppId = "e9acc76a-6d64-4a22-a386-6bbc611980b9";
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!oneSignalApiKey) {
      console.log("[Notify] OneSignal API key not configured, skipping push");
      return new Response(
        JSON.stringify({ success: true, message: "OneSignal not configured" }),
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

    // Build notification content
    const folio = newRecord.folio as string;
    const newEstado = newRecord.estado as string;
    const tramiteType = payload.table === "requisiciones" ? "Requisición" : "Reposición";
    const estadoLabel = estadoLabels[newEstado] || newEstado;
    
    console.log(`[Notify] Sending OneSignal notification to ${usersWithNotifs.length} users`);

    // Send notification via OneSignal API using external_user_ids
    const oneSignalPayload = {
      app_id: oneSignalAppId,
      include_aliases: {
        external_id: usersWithNotifs
      },
      target_channel: "push",
      headings: { en: `${tramiteType} ${folio}`, es: `${tramiteType} ${folio}` },
      contents: { en: `Estado: ${estadoLabel}`, es: `Estado: ${estadoLabel}` },
      web_url: "https://requisicion-nrt.lovable.app/tramites",
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
      console.error("[Notify] OneSignal error:", oneSignalResult);
      return new Response(
        JSON.stringify({ success: false, error: oneSignalResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Notify] OneSignal response:", oneSignalResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipients: usersWithNotifs.length,
        oneSignalId: oneSignalResult.id 
      }),
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
