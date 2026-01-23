import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  user_ids?: string[];
  role?: string;
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
      console.error("[Push] VAPID keys not configured");
      return new Response(
        JSON.stringify({ success: false, error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { title, body, url, tag, user_ids, role }: PushPayload = await req.json();
    
    console.log("[Push] Request received:", { title, body, url, tag, user_ids, role });

    // Build query to get subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    
    if (user_ids && user_ids.length > 0) {
      query = query.in("user_id", user_ids);
    } else if (role) {
      // Get users with specific role
      const { data: roleUsers, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", role);
      
      if (roleError) throw roleError;
      
      if (!roleUsers || roleUsers.length === 0) {
        return new Response(
          JSON.stringify({ success: true, sent: 0, message: "No users with role" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const userIdsFromRole = roleUsers.map(u => u.user_id);
      query = query.in("user_id", userIdsFromRole);
    }

    const { data: subscriptions, error: subError } = await query;
    
    if (subError) throw subError;
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log("[Push] No subscriptions found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Push] Found ${subscriptions.length} subscriptions`);

    const payload = JSON.stringify({ 
      title, 
      body, 
      url: url || "/tramites", 
      tag: tag || "tramite",
      icon: "/pwa-192x192.png"
    });
    
    let sent = 0;
    let failed = 0;
    const expiredSubscriptions: string[] = [];

    // Send notifications using simple fetch (no encryption for now - just log intent)
    // In production, you'd use a proper web-push library
    for (const sub of subscriptions) {
      try {
        // For now, we'll store the notification intent and log it
        // The actual push would require the web-push npm package
        console.log(`[Push] Would send to user ${sub.user_id}: ${payload}`);
        
        // Attempt to send using VAPID (simplified version)
        const audience = new URL(sub.endpoint).origin;
        const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
        
        // Create a simple JWT-like token for VAPID
        const header = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" }));
        const claims = btoa(JSON.stringify({
          aud: audience,
          exp: expiration,
          sub: "mailto:admin@nrt.com.mx"
        }));
        
        // Note: This is a simplified implementation
        // For full encryption, you'd need the web-push library
        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "TTL": "86400",
            "Authorization": `vapid t=${header}.${claims}., k=${vapidPublicKey}`,
          },
          body: payload,
        });
        
        if (response.status === 201 || response.status === 200) {
          sent++;
          console.log(`[Push] Sent to ${sub.user_id}`);
        } else if (response.status === 410 || response.status === 404) {
          console.log(`[Push] Subscription expired for ${sub.user_id}`);
          expiredSubscriptions.push(sub.id);
          failed++;
        } else {
          const text = await response.text();
          console.error(`[Push] Failed for ${sub.user_id}: ${response.status} - ${text}`);
          failed++;
        }
      } catch (error) {
        console.error(`[Push] Error sending to ${sub.user_id}:`, error);
        failed++;
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      console.log(`[Push] Cleaning up ${expiredSubscriptions.length} expired subscriptions`);
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubscriptions);
    }

    console.log(`[Push] Results - Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Push] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
