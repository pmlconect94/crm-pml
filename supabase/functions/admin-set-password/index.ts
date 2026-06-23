import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Panel de usuarios del admin. SOLO ddl.pml2@gmail.com puede:
//   - action 'list' -> lista los usuarios (id, email, nombre)
//   - action 'set'  -> cambia la contraseña de un usuario (userId, password)
// Verifica el JWT del que llama (debe ser el admin) y usa la service_role
// (inyectada por Supabase, nunca sale al cliente) para la operación admin.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = "ddl.pml2@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. El que llama debe ser el admin.
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who?.user || (who.user.email ?? "").toLowerCase() !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: CORS });
  }

  let body: { action?: string; userId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers: CORS });
  }

  if (body.action === "list") {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: CORS });
    const usuarios = (data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      nombre: (u.user_metadata?.nombre as string) || u.email,
    }));
    return new Response(JSON.stringify({ usuarios }), { headers: CORS });
  }

  if (body.action === "set") {
    const { userId, password } = body;
    if (!userId || !password || String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Falta usuario o contraseña (mínimo 6 caracteres)" }), { status: 400, headers: CORS });
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: CORS });
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: "action inválida" }), { status: 400, headers: CORS });
});
