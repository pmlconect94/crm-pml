from __future__ import annotations

import argparse
from datetime import datetime

from .config import load_config
from .estatus import verificar_estatus
from .supabase_sink import SupabaseSink

# `sync` se importa DENTRO de cada comando que lo usa, no aqui arriba: arrastra
# satcfdi (la libreria pesada de descarga masiva con e.firma) y eso dejaria el
# comando `estatus` --que solo necesita requests-- inutilizable en cualquier
# entorno donde satcfdi no este instalado.


def _parse_date(value: str):
    return datetime.strptime(value, "%Y-%m-%d").date()


def cmd_solicitar(args: argparse.Namespace) -> None:
    from .sync import solicitar_rango

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
    from .sync import MAX_FALLOS_CONSECUTIVOS, revisar_pendientes

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
        elif estado == "REINTENTAR":
            detalle = r.get("mensaje") or r.get("codigo") or ""
            print(f"  [REINTENT] {r['tipo']:10s} id_solicitud={r['id_solicitud']}   fallo {r['intentos_fallidos']}/{MAX_FALLOS_CONSECUTIVOS}: {detalle}")
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
    from .sync import MAX_FALLOS_CONSECUTIVOS, revisar_pendientes, solicitar_incremental

    config = load_config()
    inicio = datetime.now()
    lineas_log = [f"\n=== {inicio.isoformat(timespec='seconds')} ==="]

    revisados = revisar_pendientes(config)
    importadas_total = 0
    for r in revisados:
        if r["estado"] == "TERMINADA":
            importadas_total += r["facturas_importadas"]
            lineas_log.append(f"revisar: {r['tipo']} id_solicitud={r['id_solicitud']} -> {r['facturas_importadas']} facturas importadas")
        elif r["estado"] == "REINTENTAR":
            lineas_log.append(
                f"revisar: {r['tipo']} id_solicitud={r['id_solicitud']} -> fallo {r['intentos_fallidos']}/{MAX_FALLOS_CONSECUTIVOS}, "
                f"se reintenta en la proxima corrida ({r.get('mensaje') or r.get('codigo') or ''})"
            )
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


def cmd_estatus(args: argparse.Namespace) -> None:
    """Pregunta al SAT si las facturas ya descargadas siguen vigentes. No usa
    e.firma (es el servicio publico del QR), asi que corre en cualquier lado con
    solo la llave de Supabase."""
    config = load_config(requiere_efirma=False)
    r = verificar_estatus(
        config, maximo=args.max, dias_reverificar=args.dias_reverificar, workers=args.workers,
    )

    print(f"\nestatus: {r['consultadas']} factura(s) verificadas contra el SAT ({config.empresa_id})")

    if r["canceladas_nuevas"]:
        print(f"\n  *** {len(r['canceladas_nuevas'])} FACTURA(S) CANCELADA(S) POR EL PROVEEDOR ***")
        for f in r["canceladas_nuevas"]:
            print(f"    {f['fecha']}  {f['folio'] or '(sin folio)':>14s}  ${float(f['total'] or 0):>14,.2f}  {f['emisor']}")
            print(f"      uuid={f['uuid']}  {f['detalle'] or ''}")

    if r["revertidas"]:
        print(f"\n  {len(r['revertidas'])} factura(s) volvieron a VIGENTE (cancelacion rechazada):")
        for f in r["revertidas"]:
            print(f"    {f['fecha']}  {f['folio']}  {f['emisor']}")

    if r["efos"]:
        print(f"\n  *** {len(r['efos'])} factura(s) con observacion EFOS del SAT -- revisar el RFC en el listado 69-B ***")
        for f in r["efos"]:
            print(f"    {f['emisor_rfc']}  {f['emisor']}  -> ValidacionEFOS={f['detalle']}")

    if r["errores"]:
        print(f"\n  {len(r['errores'])} consulta(s) fallaron (se reintentan en la proxima corrida):")
        for e in r["errores"][:10]:
            print(f"    {e['uuid']}  {e['error']}")

    if not (r["canceladas_nuevas"] or r["revertidas"] or r["efos"]):
        print("  Sin novedades: todas siguen vigentes y ningun emisor trae observacion de EFOS.")
    print()


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

    p_est = sub.add_parser("estatus", help="Verifica contra el SAT si las facturas ya descargadas siguen vigentes")
    p_est.add_argument("--max", type=int, default=1500, help="Cuantas facturas revisar en esta corrida (default 1500)")
    p_est.add_argument("--dias-reverificar", type=int, default=2, dest="dias_reverificar",
                       help="No volver a consultar las revisadas hace menos de N dias (default 2)")
    p_est.add_argument("--workers", type=int, default=5, help="Consultas simultaneas al SAT (default 5)")
    p_est.set_defaults(func=cmd_estatus)

    p_res = sub.add_parser("resumen", help="Muestra un resumen de las facturas ya importadas en Supabase")
    p_res.set_defaults(func=cmd_resumen)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
