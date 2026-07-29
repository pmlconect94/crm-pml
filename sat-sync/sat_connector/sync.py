from __future__ import annotations

from datetime import date, datetime, timedelta

from satcfdi.pacs.sat import EstadoSolicitud

from . import storage
from .auth import build_sat_service
from .config import Config
from .descarga import chunk_date_range, consultar_estado, descargar_paquete, solicitar_descarga, solicitar_descarga_datetime
from .supabase_sink import SupabaseSink

# RECHAZADA y VENCIDA si son definitivos: el SAT no va a entregar nada de esa
# solicitud por mas que se le vuelva a preguntar. ERROR *no* entra aqui a
# proposito, ver _registrar_fallo_transitorio.
ESTADOS_FINALES_SIN_PAQUETES = {EstadoSolicitud.RECHAZADA, EstadoSolicitud.VENCIDA}

# Cuantas consultas de estado seguidas tienen que fallar antes de dar una
# solicitud por muerta. Con 3 corridas al dia son ~24h de margen.
MAX_FALLOS_CONSECUTIVOS = 3


def _registrar_fallo_transitorio(sink: SupabaseSink, solicitud: dict, *, mensaje: str | None, codigo: str | None) -> dict:
    """El SAT respondio algo que no deja avanzar con esta solicitud (ERROR, o un
    EstadoSolicitud fuera de su propio catalogo con CodEstatus 5004/404).

    Ojo: eso NO significa que la solicitud este muerta. El SAT es intermitente
    consultando estados y se le ha visto reportar ERROR sobre una solicitud que
    minutos despues vuelve a salir EN_PROCESO y termina entregando su paquete
    (caso real 2026-07-29: la solicitud 802d8780 se reporto ERROR "Error no
    controlado" y 15 min despues el propio SAT la daba por viva). Por eso se
    cuenta el fallo y se deja pendiente para reintentarla en las siguientes
    corridas; solo tras MAX_FALLOS_CONSECUTIVOS seguidos se abandona.

    Aun abandonandola no se pierden facturas: el sync incremental pide siempre
    los ultimos `dias_atras` dias (5 por default), asi que ese rango de fechas
    se vuelve a cubrir con una solicitud nueva. Lo que este manejo evita es
    tirar a la basura solicitudes buenas y retrasar la sincronizacion un dia."""
    id_solicitud = solicitud["id_solicitud"]
    intentos = int(solicitud.get("intentos_fallidos") or 0) + 1
    agotada = intentos >= MAX_FALLOS_CONSECUTIVOS
    estado = "ERROR" if agotada else "REINTENTAR"

    sink.update_solicitud(id_solicitud, estado=estado, procesada=agotada, intentos_fallidos=intentos)
    return {
        "id_solicitud": id_solicitud,
        "tipo": solicitud["tipo"],
        "estado": estado,
        "mensaje": mensaje,
        "codigo": codigo,
        "intentos_fallidos": intentos,
    }


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
    sink = SupabaseSink(config)

    resultados = []
    for solicitud in sink.pending_solicitudes():
        # Se renueva el servicio/token del SAT en cada iteracion: si un paquete
        # grande tarda varios minutos en descargarse+importarse, el token de la
        # sesion anterior puede expirar para cuando le toca al siguiente
        # (observado real: el primer paquete de un lote se procesaba bien y los
        # que seguian tronaban con CodEstatus 5004 / "token invalido").
        sat_service = build_sat_service(config)
        id_solicitud = solicitud["id_solicitud"]
        tipo = solicitud["tipo"]

        estado_resp = consultar_estado(sat_service, id_solicitud)
        try:
            estado = EstadoSolicitud(estado_resp["EstadoSolicitud"])
        except ValueError:
            # El SAT a veces "pierde" una solicitud (ej. CodEstatus 5004 "No se
            # encontro la informacion" o 404 "Error no controlado") y regresa un
            # EstadoSolicitud fuera del catalogo (0) en vez de un estado valido
            # (1-6). Se reintenta unas corridas antes de abandonarla; sin este
            # manejo (o marcandola muerta al primer fallo) una respuesta mala
            # pasajera tumba la sincronizacion o tira una solicitud buena.
            resultados.append(_registrar_fallo_transitorio(
                sink, solicitud,
                mensaje=estado_resp.get("Mensaje") or f"EstadoSolicitud invalido: {estado_resp.get('EstadoSolicitud')!r}",
                codigo=estado_resp.get("CodEstatus") or estado_resp.get("CodigoEstadoSolicitud"),
            ))
            continue

        if estado == EstadoSolicitud.TERMINADA:
            try:
                total_importadas = 0
                for id_paquete in estado_resp.get("IdsPaquetes", []):
                    zip_bytes = descargar_paquete(sat_service, id_paquete)
                    zip_dir = config.data_dir / "paquetes"
                    zip_dir.mkdir(parents=True, exist_ok=True)
                    zip_path = zip_dir / f"{id_paquete}.zip"
                    zip_path.write_bytes(zip_bytes)

                    total_importadas += storage.import_zip(sink, config, zip_path, tipo, id_solicitud)
            except Exception as e:
                # descargar_paquete ya reintenta solo; si aun asi falla (u otro
                # error de red/import) se deja pendiente para reintentar en la
                # proxima corrida (reimportar es seguro, todo el pipeline usa
                # upsert). Sin este manejo, un solo paquete con problemas tumba
                # el resto de la revision.
                resultados.append(_registrar_fallo_transitorio(
                    sink, solicitud, mensaje=f"{type(e).__name__}: {e}", codigo=None,
                ))
                continue

            sink.update_solicitud(
                id_solicitud, estado="TERMINADA", procesada=True,
                facturas_importadas=total_importadas, intentos_fallidos=0,
            )
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

        else:  # ACEPTADA o EN_PROCESO: el SAT todavia no termina de generar los paquetes.
            # El contador de fallos se reinicia: solo importan los fallos
            # *consecutivos*, y el SAT acaba de contestar un estado valido.
            sink.update_solicitud(id_solicitud, estado=estado.name, procesada=False, intentos_fallidos=0)
            resultados.append({
                "id_solicitud": id_solicitud, "tipo": tipo, "estado": estado.name,
            })

    return resultados
