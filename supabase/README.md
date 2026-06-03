# Supabase — CRM Grupo Lizárraga

Esquema PostgreSQL del CRM. Todas las tablas viven en el schema `crm`
para no colisionar con otros sistemas (e.g. WMS) que vivan en `public`.

## Cómo aplicar las migraciones

### Opción A — Vía MCP (recomendado, dentro de Claude Code)

Con el MCP de Supabase conectado a la cuenta correcta:

```
mcp__plugin_supabase_supabase__apply_migration({
  project_id: "<ref-del-proyecto>",
  name: "crm_schema_init",
  query: "<contenido de 20260526120000_crm_schema_init.sql>"
})
```

Repetir para los otros 2 archivos en orden.

### Opción B — Vía Supabase CLI (si está instalado)

```bash
supabase link --project-ref <ref-del-proyecto>
supabase db push
```

### Opción C — Dashboard SQL Editor

Copy/paste el contenido de cada archivo en orden:

1. `20260526120000_crm_schema_init.sql`
2. `20260526120001_crm_schema_blufin.sql`
3. `20260526120002_crm_expose_to_api.sql`

## Después de aplicar

1. Dashboard → Settings → API → "Exposed schemas" → asegurar que `crm` aparece.
2. Copiar Project URL + anon/publishable key a `.env.local` del frontend.
3. El cliente Supabase ya está configurado con `db: { schema: 'crm' }` en `src/lib/supabase.ts`.

## Notas sobre RLS

Las políticas `dev_open` son temporales (`USING (true) WITH CHECK (true)`)
para desarrollar sin auth. Cuando integremos Supabase Auth con Google
Workspace / Entra ID, hay que reemplazarlas por políticas que filtren
por `empresa_id` desde el JWT.
