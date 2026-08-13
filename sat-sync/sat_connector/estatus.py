"""Verificacion del estatus real de un CFDI contra el SAT.

Por que existe este modulo
--------------------------
El conector de descarga (descarga.py) solo le pide al SAT comprobantes
VIGENTES, y cfdi_extract escribe `"estatus_sat": "vigente"` a mano. O sea que
una factura que el proveedor CANCELA despues de que la descargamos se queda
marcada como vigente para siempre: el semaforo Vigente/Cancelado de la app
nunca podia pintarse rojo. Eso importa porque una factura cancelada que ya se
pago o ya se dedujo es un problema fiscal, no un detalle cosmetico.

Este modulo le pregunta al SAT, factura por factura, con el servicio publico de
consulta -- el mismo que hay detras del codigo QR impreso en cualquier CFDI.
NO necesita e.firma ni descarga masiva: es una llamada SOAP abierta. Por eso
puede correr en cualquier lado (workflow, local) siempre que tenga la llave de
Supabase para escribir el resultado.

De pilon trae la ValidacionEFOS: si el RFC del emisor aparece en el listado
definitivo del art. 69-B del CFF (empresas que facturan operaciones simuladas),
sus facturas no son deducibles. Ese dato solo se puede saber preguntando.
"""
from __future__ import annotations

import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from .config import Config
from .supabase_sink import SupabaseSink

CONSULTA_URL = "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc"
SOAP_ACTION = "http://tempuri.org/IConsultaCFDIService/Consulta"

TIMEOUT_SEG = 30
REINTENTOS = 3

CAMPOS = ("CodigoEstatus", "EsCancelable", "Estado", "EstatusCancelacion", "ValidacionEFOS")

# Codigos de ValidacionEFOS que significan "el emisor NO esta en el listado del
# 69-B". El SAT no publica la tabla completa de este campo (su documentacion del
# servicio ni la menciona), asi que esto sale de la practica:
#
#   - "200" es la respuesta normal, la que devuelve la enorme mayoria.
#   - "201" TAMBIEN es limpia. Se descubrio con datos reales: 96 facturas de
#     PML contestaron 201 y entre sus emisores estaban TELEFONOS DE MEXICO y una
#     concesionaria de casetas -- gente que evidentemente no es una empresa
#     fantasma. La libreria de referencia phpcfdi/sat-estado-cfdi mapea 200 y 201
#     a "Excluded" (fuera del listado), lo que cuadra con lo observado.
#   - cfdiutils documenta "100" como "se encontro en el listado de EFOS".
#
# Por eso la regla es una LISTA BLANCA: se marca lo que no sea 200/201, y se
# guarda el codigo crudo para que un humano decida. Al reves (marcar solo el
# 100) se correria el riesgo de dejar pasar un codigo desconocido que si importe.
EFOS_LIMPIOS = {"200", "201"}


def _sobre_soap(expresion: str) -> bytes:
    # La expresion va en CDATA porque trae `&` entre parametros y romperia el XML.
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">'
        "<s:Header/><s:Body><tem:Consulta><tem:expresionImpresa>"
        f"<![CDATA[{expresion}]]>"
        "</tem:expresionImpresa></tem:Consulta></s:Body></s:Envelope>"
    ).encode("utf-8")


def _expresion(emisor: str, receptor: str, total: Any, uuid: str) -> str:
    """La misma cadena que codifica el QR de una factura. El servicio es
    tolerante con el formato del total (probado con 2, 6 y 18 decimales
    rellenados: los tres devuelven el mismo resultado), asi que se manda tal
    como viene de la base."""
    return f"?re={emisor}&rr={receptor}&tt={total}&id={uuid}"


def _campos(xml: str) -> dict[str, str | None]:
    """Los campos vienen con prefijo `a:` y los vacios llegan como
    `<a:EstatusCancelacion i:nil="true"/>` (sin cierre) -> quedan en None."""
    out: dict[str, str | None] = {}
    for campo in CAMPOS:
        m = re.search(rf"<a:{campo}[^>]*>(.*?)</a:{campo}>", xml, re.S)
        valor = m.group(1).strip() if m else None
        out[campo] = valor or None
    return out


def consultar_estatus(session: requests.Session, emisor: str, receptor: str, total: Any, uuid: str) -> dict[str, str | None]:
    """Una consulta al SAT, con reintentos. Lanza la ultima excepcion si los
    REINTENTOS se agotan (el llamador la convierte en 'error' y sigue con las
    demas facturas)."""
    ultimo_error: Exception | None = None
    for intento in range(REINTENTOS):
        try:
            resp = session.post(
                CONSULTA_URL,
                data=_sobre_soap(_expresion(emisor, receptor, total, uuid)),
                headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": SOAP_ACTION},
                timeout=TIMEOUT_SEG,
            )
            resp.raise_for_status()
            # requests adivina mal el encoding de esta respuesta (los acentos de
            # "Cancelable sin aceptacion" salen rotos); el XML declara utf-8.
            return _campos(resp.content.decode("utf-8", errors="replace"))
        except Exception as e:  # noqa: BLE001 - se reintenta cualquier fallo de red/HTTP
            ultimo_error = e
            if intento < REINTENTOS - 1:
                time.sleep(0.5 * (intento + 1))
    raise ultimo_error  # type: ignore[misc]


def _patch_desde_respuesta(campos: dict[str, str | None], ahora_iso: str) -> dict[str, Any]:
    """Traduce la respuesta del SAT a las columnas de crm.cont_facturas.

    Regla defensiva: `estatus_sat` SOLO se toca cuando el SAT contesta con codigo
    'S' (consulta satisfactoria). Si contesta 'N - 602: Comprobante no
    encontrado' o cualquier otra cosa, se guarda el codigo crudo y se estampa la
    fecha de revision, pero NO se degrada el estatus. Asi una racha de respuestas
    malas del SAT no marca media contabilidad como sospechosa.
    """
    codigo = (campos.get("CodigoEstatus") or "").strip()
    patch: dict[str, Any] = {
        "estatus_codigo": codigo[:300] or None,
        "estatus_cancelacion": campos.get("EstatusCancelacion"),
        "es_cancelable": campos.get("EsCancelable"),
        "validacion_efos": campos.get("ValidacionEFOS"),
        "estatus_verificado_at": ahora_iso,
    }
    if codigo.upper().startswith("S"):
        estado = (campos.get("Estado") or "").strip().lower()
        if estado.startswith("vigente"):
            patch["estatus_sat"] = "vigente"
        elif estado.startswith("cancelado"):
            patch["estatus_sat"] = "cancelado"
    return patch


def verificar_estatus(
    config: Config,
    *,
    maximo: int = 1500,
    dias_reverificar: int = 2,
    workers: int = 5,
) -> dict[str, Any]:
    """Revisa contra el SAT un lote de facturas de la empresa configurada.

    No barre las 15 mil de un jalon: toma las `maximo` mas rancias (las que nunca
    se han revisado primero) y las deja estampadas. Corriendo 3 veces al dia el
    padron entero rota en un par de dias, y ninguna corrida es lo bastante pesada
    como para que importe si falla.
    """
    sink = SupabaseSink(config)
    limite_iso = (datetime.now(timezone.utc) - timedelta(days=dias_reverificar)).isoformat().replace("+00:00", "Z")
    facturas = sink.facturas_por_verificar(limite=maximo, revisadas_antes_de=limite_iso)

    if not facturas:
        return {"consultadas": 0, "canceladas_nuevas": [], "efos": [], "errores": [], "revertidas": []}

    ahora_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    session = requests.Session()

    def revisar(f: dict) -> tuple[dict, dict[str, Any] | None, str | None]:
        try:
            campos = consultar_estatus(session, f["emisor_rfc"], f["receptor_rfc"], f["total"], f["uuid"])
            return f, _patch_desde_respuesta(campos, ahora_iso), None
        except Exception as e:  # noqa: BLE001
            return f, None, f"{type(e).__name__}: {e}"

    with ThreadPoolExecutor(max_workers=workers) as pool:
        resultados = list(pool.map(revisar, facturas))

    # Se agrupan las filas por patch identico: la enorme mayoria cae en el mismo
    # cubo ("vigente / sin cancelacion / EFOS 200"), asi que miles de filas se
    # actualizan con un puñado de PATCH en vez de uno por factura.
    grupos: dict[str, tuple[dict[str, Any], list[str]]] = {}
    canceladas_nuevas: list[dict] = []
    revertidas: list[dict] = []
    efos: list[dict] = []
    errores: list[dict] = []

    for factura, patch, error in resultados:
        if error is not None:
            errores.append({"uuid": factura["uuid"], "emisor": factura.get("emisor_nombre") or factura["emisor_rfc"], "error": error})
            continue

        assert patch is not None
        nuevo = patch.get("estatus_sat")
        previo = factura.get("estatus_sat")
        resumen = {
            "uuid": factura["uuid"],
            "emisor": factura.get("emisor_nombre") or factura["emisor_rfc"],
            "emisor_rfc": factura["emisor_rfc"],
            "folio": f"{factura.get('serie') or ''}{('-' if factura.get('serie') else '')}{factura.get('folio') or ''}".strip("-"),
            "fecha": (factura.get("fecha_emision") or "")[:10],
            "total": factura.get("total"),
            "detalle": patch.get("estatus_cancelacion"),
        }
        if nuevo == "cancelado" and previo != "cancelado":
            canceladas_nuevas.append(resumen)
        elif nuevo == "vigente" and previo == "cancelado":
            # Raro pero posible: una cancelacion "en proceso" que el receptor
            # rechaza vuelve a dejar la factura vigente.
            revertidas.append(resumen)
        if (patch.get("validacion_efos") or "200") not in EFOS_LIMPIOS:
            efos.append({**resumen, "detalle": patch.get("validacion_efos")})

        clave = repr(sorted(patch.items(), key=lambda kv: kv[0]))
        grupos.setdefault(clave, (patch, []))[1].append(factura["uuid"])

    for patch, uuids in grupos.values():
        sink.marcar_estatus(uuids, patch)

    return {
        "consultadas": len(resultados) - len(errores),
        "canceladas_nuevas": canceladas_nuevas,
        "revertidas": revertidas,
        "efos": efos,
        "errores": errores,
    }
