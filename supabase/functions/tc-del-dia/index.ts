import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// TC del día USD->MXN. Trae el tipo de cambio de una API en vivo (sin token),
// lo cachea por día en crm.tc_dia y lo devuelve. La usa Central de Costos para
// prellenar el "TC del día estimado". No requiere cron: cada llamada del día
// usa el cache; la primera del día consulta la fuente en vivo y lo guarda.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Fecha de hoy en zona horaria de México (YYYY-MM-DD)
function fechaMX(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Trae el TC USD->MXN de una API en vivo (sin token). Primario: frankfurter
// (BCE, fecha del día); respaldo: open.er-api. null si ninguna responde.
async function traerTcEnVivo(): Promise<{ tc: number; fuente: string } | null> {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN");
    if (r.ok) {
      const j = await r.json();
      const tc = Number(j?.rates?.MXN);
      if (tc > 0) return { tc, fuente: "frankfurter" };
    }
  } catch (_) { /* sigue al respaldo */ }

  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    if (r.ok) {
      const j = await r.json();
      const tc = Number(j?.rates?.MXN);
      if (tc > 0) return { tc, fuente: "open-er-api" };
    }
  } catch (_) { /* sin fuente */ }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: "crm" } });
  const fecha = fechaMX();

  // 1. Cache del día
  const { data: cache } = await sb
    .from("tc_dia")
    .select("tc, fuente, fecha")
    .eq("fecha", fecha)
    .maybeSingle();

  if (cache) {
    return new Response(
      JSON.stringify({ tc: Number(cache.tc), fecha: cache.fecha, fuente: cache.fuente, cached: true }),
      { headers: CORS },
    );
  }

  // 2. En vivo
  const vivo = await traerTcEnVivo();

  if (!vivo) {
    // 3a. Sin fuente: devolver el último guardado (marcado viejo)
    const { data: ultimo } = await sb
      .from("tc_dia")
      .select("tc, fuente, fecha")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultimo) {
      return new Response(
        JSON.stringify({ tc: Number(ultimo.tc), fecha: ultimo.fecha, fuente: ultimo.fuente, stale: true }),
        { headers: CORS },
      );
    }
    return new Response(JSON.stringify({ tc: null, error: "sin_fuente" }), { headers: CORS });
  }

  // 3b. Guardar (upsert por fecha) y devolver
  await sb.from("tc_dia").upsert(
    { fecha, tc: vivo.tc, fuente: vivo.fuente, updated_at: new Date().toISOString() },
    { onConflict: "fecha" },
  );

  return new Response(
    JSON.stringify({ tc: vivo.tc, fecha, fuente: vivo.fuente, cached: false }),
    { headers: CORS },
  );
});
