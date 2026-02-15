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
    // Validate JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(
        JSON.stringify({ error: "Token inválido o expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("Authenticated user:", userId);

    const { tramiteData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Eres un asistente experto en análisis de trámites empresariales (requisiciones y reposiciones de gastos) para una empresa mexicana.
Tu tarea es analizar la información del trámite y proporcionar:
1. Un resumen ejecutivo del trámite
2. Puntos clave a considerar para la aprobación
3. Posibles riesgos o banderas rojas
4. Recomendación final (aprobar, revisar con más detalle, o rechazar)

IMPORTANTE: TODA tu respuesta DEBE estar completamente en español. No uses inglés en ninguna parte de tu análisis, incluyendo títulos, subtítulos, viñetas y recomendaciones. Usa formato con viñetas cuando sea apropiado.`;

    const userPrompt = `Analiza el siguiente trámite:

Tipo: ${tramiteData.tipo}
Folio: ${tramiteData.folio}
Estado actual: ${tramiteData.estado}
Fecha: ${tramiteData.fecha}
Solicitante: ${tramiteData.solicitante}
${tramiteData.autorizador ? `Autorizador asignado: ${tramiteData.autorizador}` : ''}

${tramiteData.tipo === 'Reposición' ? `
Tipo de reposición: ${tramiteData.tipoReposicion}
Gastos de semana: ${tramiteData.gastosSemana}
Monto total a reponer: ${tramiteData.montoTotal}
Reponer a: ${tramiteData.reponerA || 'No especificado'}
${tramiteData.banco ? `Banco: ${tramiteData.banco}` : ''}
${tramiteData.cuentaClabe ? `Cuenta/CLABE: ${tramiteData.cuentaClabe}` : ''}

Gastos detallados:
${tramiteData.gastos?.map((g: any) => `- ${g.descripcion}: ${g.importe} (${g.proveedor}, Factura: ${g.factura})`).join('\n') || 'Sin gastos detallados'}
` : `
Empresa: ${tramiteData.empresa || 'No especificada'}
Unidad de Negocio: ${tramiteData.unidadNegocio || 'No especificada'}
Sucursal: ${tramiteData.sucursal || 'No especificada'}
Departamento: ${tramiteData.departamento || 'No especificado'}
Presupuesto aproximado: ${tramiteData.presupuesto || 'No especificado'}
Proyecto: ${tramiteData.proyecto || 'No especificado'}

Partidas:
${tramiteData.partidas?.map((p: any) => `- ${p.descripcion}: ${p.cantidad} ${p.unidad}`).join('\n') || 'Sin partidas detalladas'}
`}

Justificación: ${tramiteData.justificacion || 'No proporcionada'}

Por favor proporciona tu análisis y recomendación.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta más tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se requiere agregar créditos para usar el análisis con IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Error del servicio de IA");
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "No se pudo generar el análisis.";

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-tramite:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
