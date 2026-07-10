from __future__ import annotations

import argparse
from datetime import datetime

from .config import load_config
from .supabase_sink import SupabaseSink
from .sync import revisar_pendientes, solicitar_incremental, solicitar_rango


def _parse_date(value: str):
    return datetime.strptime(value, "%Y-%m-%d").date()


def cmd_solicitar(args: argparse.Namespace) -> None:
    config = load_config()
    tipos = ["emitidas", "recibidas"] if args.tipo == "ambas" else [args.tipo]
    resultados = solicitar_rango(config, tipos, args.desde, args.hasta)

    print(f"\n{len(resultados)} solicitud(es) enviada(s) al SAT:\n")
    for r in resultados:
        if r["ok"]:
            print(f"  [OK]    {r['tipo']:10s} {r['desde']} -> {r['hasta']}   id_solicitud={r['id_solicitud']}")
        else:
            print(f"  [FALLO] {r['tipo']:10s} {r['desde']} -> {r['hasta']}   {r['detalle']}")

    print("\nEl SAT tarda en procesar las solicitudes (de minutos a horas).")
    print("Corre 'revisar' mas tarde para descargar los paquetes que ya esten listos.\n")


def cmd_revisar(args: argparse.Namespace) -> None:
    config = load_config()
    resultados = revisar_pendientes(config)

    if not resultados:
        print("\nNo hay solicitudes pendientes por revisar.\n")
        return

    print(f"\n{len(resultados)} solicitud(es) revisada(s):\n")
    for r in resultados:
        estado = r["estado"]
        if estado == "TERMINADA":
            print(f"  [LISTO]   {r['tipo']:10s} id_solicitud={r['id_solicitud']}   facturas importadas: {r['facturas_importadas']}")
        elif estado in ("ERROR", "RECHAZADA", "VENCIDA"):
            detalle = r.get("mensaje") or r.get("codigo") or ""
            print(f"  [{estado:9s}] {r['tipo']:10s} id_solicitud={r['id_solicitud']}   {detalle}")
        else:
            print(f"  [{estado:9s}] {r['tipo']:10s} id_solicitud={r['id_solicitud']}   (sigue en proceso, intenta mas tarde)")
    print()


def cmd_sincronizar(args: argparse.Namespace) -> None:
    """Pensado para correr desapercibido via GitHub Actions (ver
    .github/workflows/sat-sync.yml): primero recoge lo que ya haya terminado de
    solicitudes previas, luego pide lo mas reciente. Imprime un resumen a stdout
    (visible en el log de la corrida del Action)."""
    config = load_config()
    inicio = datetime.now()
    lineas_log = [f"\n=== {inicio.isoformat(timespec='seconds')} ==="]

    revisados = revisar_pendientes(config)
    importadas_total = 0
    for r in revisados:
        if r["estado"] == "TERMINADA":
            importadas_total += r["facturas_importadas"]
            lineas_log.append(f"revisar: {r['tipo']} id_solicitud={r['id_solicitud']} -> {r['facturas_importadas']} facturas importadas")
        elif r["estado"] in ("ERROR", "RECHAZADA", "VENCIDA"):
            lineas_log.append(f"revisar: {r['tipo']} id_solicitud={r['id_solicitud']} -> {r['estado']} ({r.get('mensaje') or r.get('codigo') or ''})")
        else:
            lineas_log.append(f"revisar: {r['tipo']} id_solicitud={r['id_solicitud']} -> sigue en proceso ({r['estado']})")

    tipos = ["emitidas", "recibidas"] if args.tipo == "ambas" else [args.tipo]
    solicitados = solicitar_incremental(config, tipos, dias_atras=args.dias)
    for r in solicitados:
        if r["ok"]:
            lineas_log.append(f"solicitar: {r['tipo']} desde={r['desde'].isoformat(timespec='seconds')} -> id_solicitud={r['id_solicitud']}")
        else:
            lineas_log.append(f"solicitar: {r['tipo']} FALLO -> {r['detalle']}")

    lineas_log.append(f"facturas importadas en esta corrida: {importadas_total}")
    print("\n".join(lineas_log) + "\n")


def cmd_resumen(args: argparse.Namespace) -> None:
    config = load_config()
    sink = SupabaseSink(config)
    rows = sink.resumen_facturas()

    if not rows:
        print("\nAun no hay facturas importadas en Supabase. Corre 'solicitar' y luego 'revisar'.\n")
        return

    por_tipo: dict[str, dict] = {}
    for row in rows:
        acc = por_tipo.setdefault(row["tipo"], {"n": 0, "total": 0.0, "desde": row["fecha_emision"], "hasta": row["fecha_emision"]})
        acc["n"] += 1
        acc["total"] += float(row["total"] or 0)
        acc["desde"] = min(acc["desde"], row["fecha_emision"])
        acc["hasta"] = max(acc["hasta"], row["fecha_emision"])

    print("\nResumen de facturas en Supabase (crm.cont_facturas):\n")
    for tipo, acc in por_tipo.items():
        print(f"  {tipo:10s}  {acc['n']:5d} facturas   {acc['desde']} -> {acc['hasta']}   total: ${acc['total']:,.2f}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Conector de facturas SAT para PRODUCTOS MARINOS LIZARRAGA (CI)")
    sub = parser.add_subparsers(dest="comando", required=True)

    p_sol = sub.add_parser("solicitar", help="Solicita al SAT la descarga de facturas en un rango de fechas")
    p_sol.add_argument("--desde", required=True, type=_parse_date, help="YYYY-MM-DD")
    p_sol.add_argument("--hasta", required=True, type=_parse_date, help="YYYY-MM-DD")
    p_sol.add_argument("--tipo", choices=["emitidas", "recibidas", "ambas"], default="ambas")
    p_sol.set_defaults(func=cmd_solicitar)

    p_rev = sub.add_parser("revisar", help="Revisa solicitudes pendientes y descarga los paquetes ya listos")
    p_rev.set_defaults(func=cmd_revisar)

    p_sync = sub.add_parser("sincronizar", help="Revisa pendientes + solicita lo mas reciente (para GitHub Actions)")
    p_sync.add_argument("--dias", type=int, default=5, help="Dias hacia atras a solicitar (default 5)")
    p_sync.add_argument("--tipo", choices=["emitidas", "recibidas", "ambas"], default="recibidas")
    p_sync.set_defaults(func=cmd_sincronizar)

    p_res = sub.add_parser("resumen", help="Muestra un resumen de las facturas ya importadas en Supabase")
    p_res.set_defaults(func=cmd_resumen)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
