"""
Motor de sincronización del Calendario de llegadas de Menita (Alfonso Gutiérrez,
alfonso.gutierrez@menita.com.mx — llega por correo martes y viernes).

Lee el PDF del calendario, lo cruza por folio (MCO-CV-######) contra los
contratos Blufin de la base y:

  1. Actualiza CONTENEDOR, NAVIERA y ETA A PUERTO (FECHA APROX. DE LLEGADA)
     cuando cambian. Si la ETA puerto cambia, recalcula la ETA bodega ESTIMADA
     (= ETA puerto + 7d, regla §14.4) SOLO si la guardada seguía siendo la
     estimada (no pisa una ETA bodega ya oficial).
  2. NO toca contratos ya recibidos (llegada_real != null) — su dato está cerrado.
  3. Reporta los CONTRATOS NUEVOS: folios que vienen en el calendario y NO existen
     en la base = los que hay que pedir/dar de alta. No los crea (eso requiere el
     PDF de la orden de compra; ver carga masiva).

Uso:
  python scripts/sync_calendario.py <ruta_pdf> [--dry] [--json]

  --dry   No escribe en la base; solo reporta lo que cambiaría.
  --json  Imprime además un bloque JSON con el resumen (para la rutina en la nube).

Salida (stdout): reporte legible + (opcional) JSON. Código de salida 0 siempre.
"""
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

FOLIO_RE = re.compile(r"MCO-CV-\d+")
DATE_RE = re.compile(r"\b(\d{2})/(\d{2})/(\d{4})\b")
# Número de contenedor ISO 6346: 4 letras + 7 dígitos (ej. SEGU9691915).
CONTENEDOR_RE = re.compile(r"\b([A-Z]{4}\d{7})\b")

DRY = "--dry" in sys.argv
WANT_JSON = "--json" in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]


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


def rest_patch(folio, fields):
    body = json.dumps(fields).encode()
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


def iso(d_ddmmyyyy):
    """'27/05/2026' -> '2026-05-27'."""
    return datetime.strptime(d_ddmmyyyy, "%d/%m/%Y").strftime("%Y-%m-%d")


def mas_7d(iso_date):
    return (datetime.strptime(iso_date, "%Y-%m-%d") + timedelta(days=7)).strftime("%Y-%m-%d")


def parse_pdf(path):
    """Devuelve [{folio, eta, contenedor, naviera}] del calendario."""
    from pypdf import PdfReader

    txt = ""
    for pg in PdfReader(path).pages:
        txt += (pg.extract_text() or "") + "\n"

    # Cortar el pie de página (leyenda de navieras + links) si existe, para no
    # confundirlo con datos de la última fila.
    corte = txt.rfind("\nNAVIERA\n")
    if corte != -1:
        txt = txt[:corte]

    # Trocear en registros: desde cada folio hasta el siguiente.
    spans = [m.start() for m in FOLIO_RE.finditer(txt)]
    registros = []
    for i, ini in enumerate(spans):
        fin = spans[i + 1] if i + 1 < len(spans) else len(txt)
        bloque = txt[ini:fin]
        folio = FOLIO_RE.search(bloque).group(0)

        fecha = DATE_RE.search(bloque)  # 1ª fecha = FECHA APROX. DE LLEGADA (ETA puerto)
        eta = iso("/".join(fecha.groups())) if fecha else None

        cont_m = CONTENEDOR_RE.search(bloque)
        contenedor = cont_m.group(1) if cont_m else None
        naviera = None
        if cont_m:
            # La naviera va justo después del contenedor, en la misma línea.
            resto = bloque[cont_m.end():]
            naviera = resto.split("\n", 1)[0].strip() or None

        registros.append({"folio": folio, "eta": eta, "contenedor": contenedor, "naviera": naviera})
    return registros


def main():
    if not ARGS:
        print("Falta la ruta del PDF. Uso: python scripts/sync_calendario.py <ruta_pdf> [--dry]")
        return
    pdf_path = ARGS[0]

    registros = parse_pdf(pdf_path)
    db = {c["folio"]: c for c in rest_get(
        "blufin_contratos?select=folio,contenedor,naviera,eta_puerto,eta_bodega,llegada_real&limit=3000"
    )}

    cambios = []        # contratos actualizados (con detalle)
    nuevos = []         # folios del calendario que no existen en la base
    recibidos_skip = [] # ya recibidos, no se tocan
    sin_cambio = 0

    for r in registros:
        folio, eta, contenedor, naviera = r["folio"], r["eta"], r["contenedor"], r["naviera"]
        c = db.get(folio)
        if c is None:
            nuevos.append(r)
            continue
        if c.get("llegada_real"):
            recibidos_skip.append(folio)
            continue

        patch, detalle = {}, []
        if contenedor and contenedor != c.get("contenedor"):
            patch["contenedor"] = contenedor
            detalle.append(f"contenedor {c.get('contenedor') or '—'} -> {contenedor}")
        if naviera and naviera != c.get("naviera"):
            patch["naviera"] = naviera
            detalle.append(f"naviera {c.get('naviera') or '—'} -> {naviera}")
        if eta and eta != c.get("eta_puerto"):
            patch["eta_puerto"] = eta
            detalle.append(f"ETA puerto {c.get('eta_puerto') or '—'} -> {eta}")
            # Recalcular ETA bodega SOLO si seguía siendo la estimada (+7d) o estaba vacía.
            old_eta = c.get("eta_puerto")
            estimada_vieja = mas_7d(old_eta) if old_eta else None
            if not c.get("eta_bodega") or c.get("eta_bodega") == estimada_vieja:
                patch["eta_bodega"] = mas_7d(eta)
                detalle.append(f"ETA bodega (est.) -> {mas_7d(eta)}")

        if not patch:
            sin_cambio += 1
            continue

        if not DRY:
            rest_patch(folio, patch)
        cambios.append({"folio": folio, "detalle": detalle})

    # ── Reporte ──────────────────────────────────────────────────────────────
    modo = "DRY-RUN (no se escribió nada)" if DRY else "APLICADO"
    print(f"== Sync calendario [{modo}] — {Path(pdf_path).name} ==")
    print(f"Filas en el PDF: {len(registros)} · en base sin cambio: {sin_cambio} · "
          f"recibidos (omitidos): {len(recibidos_skip)}")
    print()
    print(f"CAMBIOS ({len(cambios)}):")
    for ch in cambios:
        print(f"  {ch['folio']}: " + " · ".join(ch["detalle"]))
    print()
    if nuevos:
        print(f"** CONTRATOS NUEVOS PARA PEDIR ({len(nuevos)}) — no están en el sistema: **")
        for n in nuevos:
            print(f"  {n['folio']}  ETA {n['eta'] or '—'}  {n['contenedor'] or 'sin contenedor'}")
    else:
        print("CONTRATOS NUEVOS PARA PEDIR (0): ninguno, todos los del calendario ya existen.")

    if WANT_JSON:
        print()
        print("===JSON===")
        print(json.dumps({
            "pdf": Path(pdf_path).name,
            "aplicado": not DRY,
            "filas": len(registros),
            "cambios": cambios,
            "nuevos": nuevos,
            "recibidos_omitidos": recibidos_skip,
            "sin_cambio": sin_cambio,
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
