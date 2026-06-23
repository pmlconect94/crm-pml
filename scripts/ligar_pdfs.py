"""
Liga masivamente los PDFs de contratos y facturas (descargados de Google Drive
a disco local) a cada contrato Blufin en la base.

- Contratos: uploads/contratos-blufin/**/CT-####.pdf  -> folio MCO-CV-00####
- Facturas:  uploads/facturas-blufin/**/C####.pdf     -> contrato cuya observación
             dice "Factura proveedor C####"

Cada PDF se sube al bucket documentos-importacion (contratos/<folio>.pdf y
facturas/<folio>.pdf) y se setea contrato_pdf_path / factura_pdf_path vía PostgREST.
Idempotente (x-upsert). Reporta cobertura y los que no hicieron match.

Uso: python scripts/ligar_pdfs.py [--dry]   (--dry = no sube ni escribe, solo reporta el match)
"""
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BUCKET = "documentos-importacion"
CT_RE = re.compile(r"CT[-_ ]?(\d{3,})", re.I)
FACT_RE = re.compile(r"(C\d{3,})", re.I)
DRY = "--dry" in sys.argv


def load_env(path=".env.local"):
    env = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


ENV = load_env()
URL = ENV["VITE_SUPABASE_URL"].rstrip("/")
# Con RLS endurecida (solo authenticated), la anon key ya no tiene acceso a la
# base: usar la service_role. Ponla en .env.local como SUPABASE_SERVICE_ROLE_KEY
# (Supabase Dashboard -> Settings -> API). NO la subas a Vercel ni al frontend.
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY") or ENV.get("VITE_SUPABASE_ANON_KEY")
if not KEY:
    raise SystemExit("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local")


def rest_get(path):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept-Profile": "crm"},
    )
    return json.loads(urllib.request.urlopen(req).read())


def storage_upload(path, data):
    req = urllib.request.Request(
        f"{URL}/storage/v1/object/{BUCKET}/{path}",
        data=data,
        method="POST",
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        },
    )
    urllib.request.urlopen(req)


def rest_patch(folio, field, value):
    body = json.dumps({field: value}).encode()
    req = urllib.request.Request(
        f"{URL}/rest/v1/blufin_contratos?folio=eq.{urllib.parse.quote(folio)}",
        data=body,
        method="PATCH",
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Profile": "crm",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    urllib.request.urlopen(req)


def main():
    contratos = rest_get("blufin_contratos?select=folio,observaciones&limit=2000")
    folios = {c["folio"] for c in contratos}
    # numero de factura (solo digitos, de "Factura proveedor C####") -> folio.
    # El archivo puede llamarse C#### o F-#### indistintamente; lo que liga es el NÚMERO.
    fact_to_folio = {}
    for c in contratos:
        m = re.search(r"C(\d{3,})", c.get("observaciones") or "")
        if m:
            fact_to_folio.setdefault(m.group(1), c["folio"])

    rep = {"contratos_ligados": 0, "contratos_sin_match": [], "facturas_ligadas": 0, "facturas_sin_match": []}

    # ── Contratos ──
    for pdf in sorted(Path("uploads/contratos-blufin").rglob("*.pdf")):
        m = CT_RE.search(pdf.stem)
        if not m:
            rep["contratos_sin_match"].append(pdf.name + " (nombre sin CT-####)")
            continue
        folio = "MCO-CV-" + m.group(1).zfill(6)
        if folio not in folios:
            rep["contratos_sin_match"].append(f"{pdf.name} -> {folio} (no en BD)")
            continue
        spath = f"contratos/{folio}.pdf"
        if not DRY:
            storage_upload(spath, pdf.read_bytes())
            rest_patch(folio, "contrato_pdf_path", spath)
        rep["contratos_ligados"] += 1

    # ── Facturas ── (archivo C#### o F-####; el número liga, el prefijo no)
    for pdf in sorted(Path("uploads/facturas-blufin").rglob("*.pdf")):
        s = pdf.stem.strip().upper()
        if s.startswith("CT"):
            rep["facturas_sin_match"].append(pdf.name + " (es contrato CT, ignorado)")
            continue
        mm = re.match(r"^C(\d{3,})", s) or re.match(r"^F-?(\d{3,})", s)
        if not mm:
            rep["facturas_sin_match"].append(pdf.name + " (nombre no reconocido)")
            continue
        num = mm.group(1)
        folio = fact_to_folio.get(num)
        if not folio:
            rep["facturas_sin_match"].append(f"{pdf.name} (factura {num} sin contrato en BD)")
            continue
        spath = f"facturas/{folio}.pdf"
        if not DRY:
            storage_upload(spath, pdf.read_bytes())
            rest_patch(folio, "factura_pdf_path", spath)
        rep["facturas_ligadas"] += 1

    print(json.dumps({
        "dry_run": DRY,
        "contratos_ligados": rep["contratos_ligados"],
        "contratos_sin_match": len(rep["contratos_sin_match"]),
        "facturas_ligadas": rep["facturas_ligadas"],
        "facturas_sin_match": len(rep["facturas_sin_match"]),
        "detalle_contratos_sin_match": rep["contratos_sin_match"][:40],
        "detalle_facturas_sin_match": rep["facturas_sin_match"][:40],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
