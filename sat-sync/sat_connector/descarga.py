from __future__ import annotations

import base64
from datetime import date, datetime, time as dtime, timedelta
from typing import Iterator, Literal

from satcfdi.pacs.sat import SAT, EstadoComprobante, TipoDescargaMasivaTerceros

# El SAT no permite solicitudes con un rango mayor a 12 meses (Regla 2.7.2.4 RMF).
# Usamos un margen de seguridad de 364 días por bloque.
MAX_DIAS_POR_SOLICITUD = 364

TipoFactura = Literal["emitidas", "recibidas"]


def chunk_date_range(desde: date, hasta: date, max_dias: int = MAX_DIAS_POR_SOLICITUD) -> Iterator[tuple[date, date]]:
    if desde > hasta:
        raise ValueError("La fecha 'desde' no puede ser posterior a 'hasta'")

    cursor = desde
    while cursor <= hasta:
        fin_bloque = min(cursor + timedelta(days=max_dias - 1), hasta)
        yield cursor, fin_bloque
        cursor = fin_bloque + timedelta(days=1)


def _rango_completo(desde: date, hasta: date) -> tuple[datetime, datetime]:
    inicio = datetime.combine(desde, dtime.min)
    fin = datetime.combine(hasta, dtime(23, 59, 59))
    return inicio, fin


def solicitar_descarga_datetime(sat_service: SAT, tipo: TipoFactura, fecha_inicial: datetime, fecha_final: datetime) -> dict:
    """Version de bajo nivel: recibe el rango ya como datetime exacto (con hora/minuto/
    segundo). El SAT trata como 'solicitud duplicada' dos peticiones con los mismos
    parametros (fecha_inicial, fecha_final, rfc); usar un timestamp preciso (no solo
    la fecha) evita chocar con ese limite cuando se sincroniza varias veces al dia."""
    if tipo == "emitidas":
        return sat_service.recover_comprobante_emitted_request(
            fecha_inicial=fecha_inicial,
            fecha_final=fecha_final,
            tipo_solicitud=TipoDescargaMasivaTerceros.CFDI,
            estado_comprobante=EstadoComprobante.VIGENTE,
        )
    if tipo == "recibidas":
        return sat_service.recover_comprobante_received_request(
            fecha_inicial=fecha_inicial,
            fecha_final=fecha_final,
            tipo_solicitud=TipoDescargaMasivaTerceros.CFDI,
            estado_comprobante=EstadoComprobante.VIGENTE,
        )
    raise ValueError(f"Tipo de factura desconocido: {tipo!r} (usa 'emitidas' o 'recibidas')")


def solicitar_descarga(sat_service: SAT, tipo: TipoFactura, desde: date, hasta: date) -> dict:
    """Version de calendario: desde/hasta son dias completos (00:00:00 a 23:59:59).
    Pensada para pedidos manuales de un rango historico (ver cli.py `solicitar`)."""
    fecha_inicial, fecha_final = _rango_completo(desde, hasta)
    return solicitar_descarga_datetime(sat_service, tipo, fecha_inicial, fecha_final)


def consultar_estado(sat_service: SAT, id_solicitud: str) -> dict:
    return sat_service.recover_comprobante_status(id_solicitud)


def descargar_paquete(sat_service: SAT, id_paquete: str) -> bytes:
    _, paquete_b64 = sat_service.recover_comprobante_download(id_paquete=id_paquete)
    return base64.b64decode(paquete_b64)
