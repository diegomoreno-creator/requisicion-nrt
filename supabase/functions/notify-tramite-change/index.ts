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

function getNotificationTargets(
  table: string,
  newRecord: Record<string, unknown>,
  oldRecord: Record<string, unknown> | null
): { userIds: string[]; roles: string[] } {
  const userIds: string[] = [];
  const roles: string[] = [];
  
  const newEstado = newRecord.estado as string;
  const oldEstado = oldRecord?.estado as string | undefined;
  
  if (oldEstado === newEstado) {
    return { userIds, roles };
  }
  
  const solicitadoPor = newRecord.solicitado_por as string | undefined;
  const autorizadorId = newRecord.autorizador_id as string | undefined;
  
  if (table === "requisiciones") {
    switch (newEstado) {
      case "pendiente":
        if (autorizadorId) userIds.push(autorizadorId);
        break;
      case "aprobado":
        if (solicitadoPor) userIds.push(solicitadoPor);
        roles.push("comprador");
        break;
      case "rechazado":
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
      case "en_licitacion":
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
      case "pedido_colocado":
        if (solicitadoPor) userIds.push(solicitadoPor);
        roles.push("presupuestos");
        break;
      case "pedido_autorizado":
        if (solicitadoPor) userIds.push(solicitadoPor);
        roles.push("tesoreria");
        break;
      case "pedido_pagado":
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
      case "cancelado":
        if (autorizadorId) userIds.push(autorizadorId);
        break;
    }
  } else if (table === "reposiciones") {
    switch (newEstado) {
      case "pendiente":
        if (autorizadorId) userIds.push(autorizadorId);
        break;
      case "aprobado":
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
      case "rechazado":
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
      case "pagado":
        if (solicitadoPor) userIds.push(solicitadoPor);
        break;
    }
  }
  
  return { userIds, roles };
}

async function sendEmails(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  subject: string,
  body: string,
  resendApiKey: string
) {
  if (userIds.length === 0 || !resendApiKey) return;

  // Get user emails from profiles
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, email, full_name")
    .in("user_id", userIds);

  if (error || !profiles) {
    console.error("[Notify] Error fetching profiles for email:", error);
    return;
  }

  const emailPromises = profiles
    .filter((p: { email: string | null }) => p.email)
    .map((p: { email: string; full_name: string | null }) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "NRT Requisiciones <onboarding@resend.dev>",
          to: [p.email],
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #1a1a2e; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="color: #ffffff; margin: 0; font-size: 18px;">NRT Requisiciones</h2>
              </div>
              <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151; font-size: 16px; margin-top: 0;">Hola${p.full_name ? ` ${p.full_name}` : ''},</p>
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
                  ${body}
                </div>
                <a href="https://requisicion-nrt.lovable.app/tramites" 
                   style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 12px;">
                  Ver Trámite
                </a>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; margin-bottom: 0;">
                  Puedes desactivar las notificaciones por correo en tu perfil.
                </p>
              </div>
            </div>
          `,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[Notify] Email error for ${p.email}:`, errBody);
        } else {
          console.log(`[Notify] Email sent to ${p.email}`);
        }
      }).catch((err) => {
        console.error(`[Notify] Email fetch error for ${p.email}:`, err);
      })
    );

  await Promise.allSettled(emailPromises);
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const payload: WebhookPayload = await req.json();
    
    console.log("[Notify] Webhook received:", {
      type: payload.type,
      table: payload.table,
      newEstado: payload.record?.estado,
      oldEstado: payload.old_record?.estado,
    });

    if (payload.type !== "UPDATE" && payload.type !== "INSERT") {
      return new Response(
        JSON.stringify({ success: true, message: "Not an insert or update" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newRecord = payload.record;
    const oldRecord = payload.old_record;
    
    if (payload.type === "UPDATE" && newRecord.estado === oldRecord?.estado) {
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

    const userIdArray = Array.from(allUserIds);
    
    // Build notification content
    const folio = newRecord.folio as string;
    const newEstado = newRecord.estado as string;
    const asunto = (newRecord.asunto as string) || (newRecord.justificacion as string) || folio;
    const tramiteType = payload.table === "requisiciones" ? "Requisición" : "Reposición";
    const estadoLabel = estadoLabels[newEstado] || newEstado;
    
    const maxAsuntoLength = 50;
    const truncatedAsunto = asunto.length > maxAsuntoLength 
      ? asunto.substring(0, maxAsuntoLength) + "..." 
      : asunto;
    const notificationTitle = `${tramiteType}: ${truncatedAsunto}`;
    const notificationBody = `${estadoLabel} • ${folio}`;

    // Fetch notification preferences for all users
    const prefColumn = payload.table === "requisiciones" ? "notify_requisiciones" : "notify_reposiciones";
    
    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, notify_email, " + prefColumn)
      .in("user_id", userIdArray);
    
    if (prefsError) {
      console.error("[Notify] Error fetching preferences:", prefsError);
    }

    // Separate users by notification type
    const usersForPush = prefs?.filter(p => p[prefColumn] === true).map(p => p.user_id) || userIdArray;
    const usersForEmail = prefs?.filter(p => p.notify_email === true).map(p => p.user_id) || userIdArray;

    // === SEND PUSH NOTIFICATIONS ===
    let pushResult = null;
    if (oneSignalApiKey && usersForPush.length > 0) {
      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("user_id, auth")
        .in("user_id", usersForPush);
      
      if (subError) {
        console.error("[Notify] Error fetching subscriptions:", subError);
      }
      
      const playerIds = subscriptions?.map(s => s.auth).filter(Boolean) || [];
      
      if (playerIds.length > 0) {
        console.log(`[Notify] Sending push to ${playerIds.length} players`);
        
        const oneSignalPayload = {
          app_id: oneSignalAppId,
          include_subscription_ids: playerIds,
          headings: { en: notificationTitle, es: notificationTitle },
          contents: { en: notificationBody, es: notificationBody },
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

        pushResult = await oneSignalResponse.json();
        
        if (!oneSignalResponse.ok) {
          console.error("[Notify] OneSignal error:", pushResult);
        } else {
          console.log("[Notify] OneSignal response:", pushResult);
        }
      }
    }

    // === SEND EMAIL NOTIFICATIONS ===
    if (resendApiKey && usersForEmail.length > 0) {
      const emailSubject = `${tramiteType} ${folio} - ${estadoLabel}`;
      const emailBody = `
        <p style="color: #111827; font-weight: 600; margin: 0 0 8px 0;">${notificationTitle}</p>
        <p style="color: #6b7280; margin: 0;">Estado: <strong style="color: #111827;">${estadoLabel}</strong></p>
        <p style="color: #6b7280; margin: 4px 0 0 0;">Folio: <strong style="color: #111827;">${folio}</strong></p>
      `;
      
      console.log(`[Notify] Sending email to ${usersForEmail.length} users`);
      await sendEmails(supabase, usersForEmail, emailSubject, emailBody, resendApiKey);
    } else if (!resendApiKey) {
      console.log("[Notify] Resend API key not configured, skipping email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pushRecipients: usersForPush.length,
        emailRecipients: usersForEmail.length,
        oneSignalId: pushResult?.id 
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
