from __future__ import annotations

from datetime import date, datetime, timedelta

from satcfdi.pacs.sat import EstadoSolicitud

from . import storage
from .auth import build_sat_service
from .config import Config
from .descarga import chunk_date_range, consultar_estado, descargar_paquete, solicitar_descarga, solicitar_descarga_datetime
from .supabase_sink import SupabaseSink

ESTADOS_FINALES_SIN_PAQUETES = {EstadoSolicitud.ERROR, EstadoSolicitud.RECHAZADA, EstadoSolicitud.VENCIDA}


def solicitar_rango(config: Config, tipos: list[str], desde: date, hasta: date) -> list[dict]:
    sat_service = build_sat_service(config)
    sink = SupabaseSink(config)

    resultados = []
    for tipo in tipos:
        for bloque_desde, bloque_hasta in chunk_date_range(desde, hasta):
            response = solicitar_descarga(sat_service, tipo, bloque_desde, bloque_hasta)
            id_solicitud = response.get("IdSolicitud")

            if not id_solicitud:
                resultados.append({
                    "tipo": tipo, "desde": bloque_desde, "hasta": bloque_hasta,
                    "ok": False, "detalle": response,
                })
                continue

            sink.save_solicitud(id_solicitud, config.empresa_id, tipo, bloque_desde, bloque_hasta)
            resultados.append({
                "tipo": tipo, "desde": bloque_desde, "hasta": bloque_hasta,
                "ok": True, "id_solicitud": id_solicitud,
            })

    return resultados


def solicitar_incremental(config: Config, tipos: list[str], dias_atras: int = 5) -> list[dict]:
    """Pide al SAT lo emitido/recibido desde hace `dias_atras` dias hasta este
    momento exacto (con hora/minuto/segundo). Pensada para correr varias veces
    al dia via GitHub Actions (ver .github/workflows/sat-sync.yml): el timestamp
    preciso hace que cada corrida sea un rango distinto para el SAT aunque sea
    el mismo dia, y el margen de `dias_atras` cubre CFDIs que tardaron en quedar
    indexados. Reimportar facturas ya vistas es seguro (upsert por UUID)."""
    sat_service = build_sat_service(config)
    sink = SupabaseSink(config)

    hasta = datetime.now()
    desde = hasta - timedelta(days=dias_atras)

    resultados = []
    for tipo in tipos:
        response = solicitar_descarga_datetime(sat_service, tipo, desde, hasta)
        id_solicitud = response.get("IdSolicitud")

        if not id_solicitud:
            resultados.append({"tipo": tipo, "desde": desde, "hasta": hasta, "ok": False, "detalle": response})
            continue

        sink.save_solicitud(id_solicitud, config.empresa_id, tipo, desde.date(), hasta.date())
        resultados.append({"tipo": tipo, "desde": desde, "hasta": hasta, "ok": True, "id_solicitud": id_solicitud})

    return resultados


def revisar_pendientes(config: Config) -> list[dict]:
    sat_service = build_sat_service(config)
    sink = SupabaseSink(config)

    resultados = []
    for solicitud in sink.pending_solicitudes():
        id_solicitud = solicitud["id_solicitud"]
        tipo = solicitud["tipo"]

        estado_resp = consultar_estado(sat_service, id_solicitud)
        estado = EstadoSolicitud(estado_resp["EstadoSolicitud"])

        if estado == EstadoSolicitud.TERMINADA:
            total_importadas = 0
            for id_paquete in estado_resp.get("IdsPaquetes", []):
                zip_bytes = descargar_paquete(sat_service, id_paquete)
                zip_dir = config.data_dir / "paquetes"
                zip_dir.mkdir(parents=True, exist_ok=True)
                zip_path = zip_dir / f"{id_paquete}.zip"
                zip_path.write_bytes(zip_bytes)

                total_importadas += storage.import_zip(sink, config, zip_path, tipo, id_solicitud)

            sink.update_solicitud(id_solicitud, estado="TERMINADA", procesada=True, facturas_importadas=total_importadas)
            resultados.append({
                "id_solicitud": id_solicitud, "tipo": tipo, "estado": estado.name,
                "facturas_importadas": total_importadas,
            })

        elif estado in ESTADOS_FINALES_SIN_PAQUETES:
            sink.update_solicitud(id_solicitud, estado=estado.name, procesada=True)
            resultados.append({
                "id_solicitud": id_solicitud, "tipo": tipo, "estado": estado.name,
                "mensaje": estado_resp.get("Mensaje"),
                "codigo": estado_resp.get("CodigoEstadoSolicitud"),
            })

        else:  # ACEPTADA o EN_PROCESO: el SAT todavia no termina de generar los paquetes
            sink.update_solicitud(id_solicitud, estado=estado.name, procesada=False)
            resultados.append({
                "id_solicitud": id_solicitud, "tipo": tipo, "estado": estado.name,
            })

    return resultados
