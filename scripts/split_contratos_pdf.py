"""
Separa un PDF de órdenes de compra de Menita en un PDF por contrato y los sube
al bucket de Storage `documentos-importacion`.

Detecta cada orden de compra por su folio (NÚMERO: MCO-CV-XXXXXX) en las páginas
que dicen "ORDEN DE COMPRA"; las páginas del contrato marco (sin orden) se ignoran.
Páginas consecutivas con el mismo folio se agrupan en el mismo PDF.

Uso:
    python scripts/split_contratos_pdf.py <pdf> <prefijo-en-storage>

Ej:
    python scripts/split_contratos_pdf.py uploads/contratos-blufin/abril.pdf abril-2026

Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY de .env.local (bucket con política
dev_open, por eso la anon key basta mientras no haya auth real).
"""
import json
import re
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from pypdf import PdfReader, PdfWriter

BUCKET = "documentos-importacion"
FOLIO_RE = re.compile(r"(MCO-CV-\d+)")


def load_env(path=".env.local"):
    env = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def main():
    if len(sys.argv) < 3:
        print("uso: python scripts/split_contratos_pdf.py <pdf> <prefijo-storage>")
        sys.exit(1)
    src, prefix = sys.argv[1], sys.argv[2]
    env = load_env()
    url = env["VITE_SUPABASE_URL"].rstrip("/")
    # Desde la RLS auth_all (2026-06-23) la anon key ya no puede subir a Storage:
    # usar la service_role si está en .env.local (igual que los demás scripts).
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env["VITE_SUPABASE_ANON_KEY"]

    reader = PdfReader(src)
    groups: dict[str, list[int]] = {}
    order: list[str] = []
    for i, page in enumerate(reader.pages):
        txt = (page.extract_text() or "").upper()
        m = FOLIO_RE.search(txt)
        if "ORDEN DE COMPRA" in txt and m:
            folio = m.group(1)
            if folio not in groups:
                groups[folio] = []
                order.append(folio)
            groups[folio].append(i)

    tmp = Path(tempfile.mkdtemp())
    results = {}
    for folio in order:
        writer = PdfWriter()
        for idx in groups[folio]:
            writer.add_page(reader.pages[idx])
        out = tmp / f"{folio}.pdf"
        with open(out, "wb") as fo:
            writer.write(fo)
        data = out.read_bytes()
        path = f"{prefix}/{folio}.pdf"
        req = urllib.request.Request(
            f"{url}/storage/v1/object/{BUCKET}/{path}",
            data=data,
            method="POST",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/pdf",
                "x-upsert": "true",
            },
        )
        try:
            urllib.request.urlopen(req)
            results[folio] = path
        except urllib.error.HTTPError as e:
            results[folio] = f"ERROR {e.code}: {e.read().decode()[:200]}"

    print(json.dumps({"contratos": len(order), "subidos": results}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
