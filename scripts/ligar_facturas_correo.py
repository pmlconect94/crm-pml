"""
Liga a Storage las facturas de Menita que llegaron por CORREO y hoy solo viven
en Google Drive (crm.blufin_facturas con storage_path NULL y drive_pdf_id).

Por qué: la app abre esas facturas con un link de Google Drive
(drive.google.com/file/d/<id>/view). Como los archivos son del Drive del admin
y no están compartidos, a los demás usuarios Google les pide "Solicitar acceso"
cada vez. Al copiarlas a Supabase Storage, la app las abre con URL firmada (igual
que los contratos) y funciona para cualquier usuario autenticado, sin Google.

Flujo:
  1) Bajar la carpeta de Drive "Facturas Menita CRM" a uploads/facturas-correo/
     (o dejarlas en uploads/facturas-blufin/ — busca en ambas).
  2) Correr este script. Por cada factura sin storage_path:
       - encuentra el PDF local por su número (C#### dentro del nombre),
       - lo sube al bucket documentos-importacion en facturas-correo/<C####>.pdf,
       - setea blufin_facturas.storage_path,
       - si el contrato ligado no tiene factura_pdf_path, también se lo setea.
  Idempotente (x-upsert; solo toca las que aún están en NULL). Reporta faltantes.

Modos para obtener el binario:
  - LOCAL (default): lee los PDFs de uploads/facturas-correo/ (o facturas-blufin/).
  - --drive: los baja directo de Google Drive por su drive_pdf_id. Requiere que la
    carpeta "Facturas Menita CRM" esté compartida temporalmente como "Cualquiera
    con el enlace -> Lector" mientras corre (segundos); luego la vuelves a privar.

Uso:  python scripts/ligar_facturas_correo.py [--dry] [--drive]
      (--dry = no sube ni escribe; solo reporta el emparejamiento)

Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local (la RLS bloquea la anon key).
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BUCKET = "documentos-importacion"
DRY = "--dry" in sys.argv
DRIVE = "--drive" in sys.argv
# Carpetas donde buscar los PDFs bajados de Drive (modo LOCAL).
SEARCH_DIRS = ["uploads/facturas-correo", "uploads/facturas-blufin"]
NUM_RE = re.compile(r"(\d{3,})")


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
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY")
if not KEY:
    raise SystemExit(
        "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local "
        "(Supabase Dashboard -> Settings -> API -> service_role)."
    )


def rest_get(path):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept-Profile": "crm"},
    )
    return json.loads(urllib.request.urlopen(req).read())


def storage_upload(path, data):
    req = urllib.request.Request(
        f"{URL}/storage/v1/object/{BUCKET}/{urllib.parse.quote(path)}",
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


def rest_patch(table, row_id, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{URL}/rest/v1/{table}?id=eq.{urllib.parse.quote(row_id)}",
        data=data,
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


def index_local_files():
    """num (str de dígitos) -> Path del PDF local."""
    by_num = {}
    for d in SEARCH_DIRS:
        base = Path(d)
        if not base.exists():
            continue
        for pdf in base.rglob("*.pdf"):
            m = NUM_RE.search(pdf.stem)
            if m:
                by_num.setdefault(m.group(1), pdf)
    return by_num


def drive_download(file_id):
    """Baja el PDF de Drive por id (requiere la carpeta compartida 'cualquiera con
    el enlace'). Devuelve los bytes, o None si falló o no parece un PDF."""
    if not file_id:
        return None
    url = f"https://drive.google.com/uc?export=download&id={urllib.parse.quote(file_id)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req).read()
    except Exception:
        return None
    # Si no está compartida, Drive devuelve una página HTML, no el binario.
    return data if data[:5] == b"%PDF-" else None


def main():
    # Facturas que aún solo viven en Drive.
    facturas = rest_get(
        "blufin_facturas?select=id,factura_num,drive_pdf_id,contrato_id,storage_path"
        "&storage_path=is.null&order=factura_num"
    )
    # Contratos -> factura_pdf_path actual (para no pisar los que ya tienen).
    contratos = rest_get("blufin_contratos?select=id,folio,factura_pdf_path&limit=2000")
    cmap = {c["id"]: c for c in contratos}

    local = {} if DRIVE else index_local_files()
    rep = {"ligadas": 0, "contratos_seteados": 0, "sin_binario": [], "sin_contrato": []}

    for f in facturas:
        fnum = (f.get("factura_num") or "").strip()
        if DRIVE:
            data = drive_download(f.get("drive_pdf_id"))
        else:
            m = NUM_RE.search(fnum)
            pdf = local.get(m.group(1)) if m else None
            data = pdf.read_bytes() if pdf else None
        if not data:
            rep["sin_binario"].append(fnum or f["id"])
            continue

        spath = f"facturas-correo/{fnum}.pdf"
        if not DRY:
            storage_upload(spath, data)
            rest_patch("blufin_facturas", f["id"], {"storage_path": spath})
        rep["ligadas"] += 1

        cid = f.get("contrato_id")
        contrato = cmap.get(cid) if cid else None
        if not contrato:
            rep["sin_contrato"].append(fnum)
        elif not contrato.get("factura_pdf_path"):
            if not DRY:
                rest_patch("blufin_contratos", cid, {"factura_pdf_path": spath})
            rep["contratos_seteados"] += 1

    print(json.dumps({
        "modo": "drive" if DRIVE else "local",
        "dry_run": DRY,
        "facturas_objetivo": len(facturas),
        "ligadas": rep["ligadas"],
        "contratos_seteados": rep["contratos_seteados"],
        "sin_binario": len(rep["sin_binario"]),
        "detalle_sin_binario": rep["sin_binario"],
        "sin_contrato": rep["sin_contrato"],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
