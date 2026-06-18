"""
Regenera supabase/seed/seed_catalogo_blufin.sql desde el estado actual de la BD
(catalogo_sku, proveedor blufin). Útil tras editar el catálogo en la app/SQL para
mantener el seed versionado consistente. Idempotente (ON CONFLICT DO UPDATE).

Uso: python scripts/regenerar_seed_catalogo.py
"""
import json
import urllib.request
from pathlib import Path


def load_env(path=".env.local"):
    env = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def lit(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def main():
    env = load_env()
    url = env["VITE_SUPABASE_URL"].rstrip("/")
    key = env["VITE_SUPABASE_ANON_KEY"]
    cols = "code,producto,marca,pct,talla,kg_caja,descripcion,activo"
    req = urllib.request.Request(
        f"{url}/rest/v1/catalogo_sku?select={cols}&proveedor=eq.blufin&empresa_id=eq.pml&order=code.asc&limit=2000",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept-Profile": "crm"},
    )
    rows = json.loads(urllib.request.urlopen(req).read())

    out = []
    out.append("-- Seed idempotente del catalogo Blufin (regenerado desde la BD 2026-06-18).")
    out.append("-- Descripciones ALINEADAS CON INTELISIS (editables en la app; no se generan).")
    out.append("-- Clasificacion por 'producto'. Cada producto+marca+talla+% es un SKU distinto.")
    out.append("insert into crm.catalogo_sku (empresa_id, proveedor, code, producto, marca, pct, talla, kg_caja, descripcion, activo)")
    out.append("values")
    vals = []
    for r in rows:
        kg = r["kg_caja"]
        kg_str = str(float(kg)) if kg is not None else "null"
        vals.append(
            "('pml','blufin',{},{},{},{},{},{},{},{})".format(
                lit(r["code"]), lit(r["producto"]), lit(r["marca"]), lit(r["pct"]),
                lit(r["talla"]), kg_str, lit(r["descripcion"]),
                "true" if r["activo"] else "false",
            )
        )
    out.append(",\n".join(vals))
    out.append("on conflict (empresa_id, proveedor, code) do update set")
    out.append("  producto = excluded.producto, marca = excluded.marca, pct = excluded.pct,")
    out.append("  talla = excluded.talla, kg_caja = excluded.kg_caja,")
    out.append("  descripcion = excluded.descripcion, activo = excluded.activo;")
    Path("supabase/seed/seed_catalogo_blufin.sql").write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"Seed regenerado con {len(rows)} SKUs.")


if __name__ == "__main__":
    main()
