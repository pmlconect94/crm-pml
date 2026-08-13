from __future__ import annotations

import urllib.parse
from datetime import date, datetime, timezone

import requests

from .config import Config

SCHEMA = "crm"
BUCKET = "cont-facturas"

# Cuantos UUID caben en un solo `uuid=in.(...)`. Cada UUID son ~37 caracteres;
# con 100 la URL queda en ~3.8 KB, comodamente por debajo del limite de 8 KB
# que tienen nginx/PostgREST por default.
UUIDS_POR_PATCH = 100


class SupabaseSink:
    """Escribe en el proyecto Supabase de CRM PML (schema `crm`) usando la misma
    convencion REST/PostgREST que ya usan los scripts de ese repo (service_role
    key, headers Accept-Profile/Content-Profile: crm - la anon key no puede
    escribir, la RLS de crm.* solo permite 'authenticated')."""

    def __init__(self, config: Config):
        self.base_url = config.supabase_url.rstrip("/")
        self.empresa_id = config.empresa_id
        self.session = requests.Session()
        self.session.headers.update({
            "apikey": config.supabase_service_key,
            "Authorization": f"Bearer {config.supabase_service_key}",
        })

    def _headers(self, *, write: bool = False, prefer: str | None = None) -> dict:
        headers = {"Accept-Profile": SCHEMA}
        if write:
            headers["Content-Profile"] = SCHEMA
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer
        return headers

    # ---- facturas / conceptos / impuestos ---------------------------------

    def upload_xml(self, storage_path: str, xml_bytes: bytes) -> None:
        resp = self.session.post(
            f"{self.base_url}/storage/v1/object/{BUCKET}/{urllib.parse.quote(storage_path)}",
            data=xml_bytes,
            headers={"Content-Type": "application/xml", "x-upsert": "true"},
        )
        resp.raise_for_status()

    def upsert_factura(self, factura: dict) -> None:
        resp = self.session.post(
            f"{self.base_url}/rest/v1/cont_facturas",
            json=factura,
            headers=self._headers(write=True, prefer="resolution=merge-duplicates,return=minimal"),
        )
        resp.raise_for_status()

    def replace_conceptos(self, factura_uuid: str, conceptos: list[dict]) -> None:
        """Reemplaza (delete+insert) los conceptos de una factura para que
        reimportar el mismo CFDI sea idempotente. Los impuestos por concepto
        caen solos por ON DELETE CASCADE."""
        del_resp = self.session.delete(
            f"{self.base_url}/rest/v1/cont_conceptos",
            params={"factura_uuid": f"eq.{factura_uuid}"},
            headers=self._headers(write=True, prefer="return=minimal"),
        )
        del_resp.raise_for_status()

        if not conceptos:
            return

        rows = []
        impuestos_por_linea = []
        for c in conceptos:
            impuestos = c.pop("impuestos", [])
            row = {**c, "factura_uuid": factura_uuid}
            rows.append(row)
            impuestos_por_linea.append(impuestos)

        resp = self.session.post(
            f"{self.base_url}/rest/v1/cont_conceptos",
            json=rows,
            headers=self._headers(write=True, prefer="return=representation"),
        )
        resp.raise_for_status()
        inserted = resp.json()

        all_impuestos = []
        for concepto_row, impuestos in zip(inserted, impuestos_por_linea):
            for imp in impuestos:
                all_impuestos.append({**imp, "concepto_id": concepto_row["id"]})

        if all_impuestos:
            imp_resp = self.session.post(
                f"{self.base_url}/rest/v1/cont_concepto_impuestos",
                json=all_impuestos,
                headers=self._headers(write=True, prefer="return=minimal"),
            )
            imp_resp.raise_for_status()

    def replace_relaciones(self, factura_uuid: str, relaciones: list[dict]) -> None:
        del_resp = self.session.delete(
            f"{self.base_url}/rest/v1/cont_relaciones",
            params={"factura_uuid": f"eq.{factura_uuid}"},
            headers=self._headers(write=True, prefer="return=minimal"),
        )
        del_resp.raise_for_status()

        if not relaciones:
            return
        rows = [{**r, "factura_uuid": factura_uuid} for r in relaciones]
        resp = self.session.post(
            f"{self.base_url}/rest/v1/cont_relaciones",
            json=rows,
            headers=self._headers(write=True, prefer="return=minimal"),
        )
        resp.raise_for_status()

    def replace_pagos(self, factura_uuid: str, pagos: list[dict]) -> None:
        """Borra los pagos previos de esta factura (P-type) y reinserta — mismo
        patron delete+insert que replace_conceptos para que reimportar sea idempotente."""
        del_resp = self.session.delete(
            f"{self.base_url}/rest/v1/cont_pagos",
            params={"factura_uuid": f"eq.{factura_uuid}"},
            headers=self._headers(write=True, prefer="return=minimal"),
        )
        del_resp.raise_for_status()

        if not pagos:
            return

        rows = []
        documentos_por_pago = []
        for p in pagos:
            documentos = p.pop("documentos", [])
            rows.append({**p, "factura_uuid": factura_uuid})
            documentos_por_pago.append(documentos)

        resp = self.session.post(
            f"{self.base_url}/rest/v1/cont_pagos",
            json=rows,
            headers=self._headers(write=True, prefer="return=representation"),
        )
        resp.raise_for_status()
        inserted = resp.json()

        all_documentos = []
        for pago_row, documentos in zip(inserted, documentos_por_pago):
            for doc in documentos:
                all_documentos.append({**doc, "pago_id": pago_row["id"]})

        if all_documentos:
            doc_resp = self.session.post(
                f"{self.base_url}/rest/v1/cont_pagos_documentos",
                json=all_documentos,
                headers=self._headers(write=True, prefer="return=minimal"),
            )
            doc_resp.raise_for_status()

    # ---- verificacion de estatus (cancelaciones) ---------------------------

    def facturas_por_verificar(self, *, limite: int, revisadas_antes_de: str) -> list[dict]:
        """Las facturas mas 'rancias' de esta empresa: primero las que nunca se
        han consultado con el SAT (`estatus_verificado_at is null`) y despues las
        revisadas hace mas de `revisadas_antes_de`. Ese orden hace que el padron
        entero rote solo, sin llevar cursores ni marcas de lote.

        Se pagina de mil en mil porque PostgREST tiene un tope duro de 1000 filas
        por respuesta (`db-max-rows` de Supabase) y lo aplica EN SILENCIO: pedir
        `limit=11000` devuelve 1000 sin error ni aviso, asi que un barrido
        completo se quedaba corto sin que nada fallara."""
        PAGINA = 1000
        filas: list[dict] = []
        while len(filas) < limite:
            faltan = min(PAGINA, limite - len(filas))
            resp = self.session.get(
                f"{self.base_url}/rest/v1/cont_facturas",
                params={
                    "select": "uuid,emisor_rfc,emisor_nombre,receptor_rfc,total,serie,folio,fecha_emision,estatus_sat",
                    "empresa_id": f"eq.{self.empresa_id}",
                    "or": f"(estatus_verificado_at.is.null,estatus_verificado_at.lt.{revisadas_antes_de})",
                    "order": "estatus_verificado_at.asc.nullsfirst,fecha_emision.desc",
                    "limit": str(faltan),
                    "offset": str(len(filas)),
                },
                headers=self._headers(),
            )
            resp.raise_for_status()
            lote = resp.json()
            filas.extend(lote)
            if len(lote) < faltan:
                break  # ya no hay mas facturas que cumplan el filtro
        return filas

    def marcar_estatus(self, uuids: list[str], patch: dict) -> None:
        """Aplica el MISMO patch a muchas facturas de un golpe. El verificador
        agrupa por resultado identico, asi que un lote de 1500 facturas suele
        resolverse en ~15 PATCH en vez de 1500."""
        for i in range(0, len(uuids), UUIDS_POR_PATCH):
            lote = uuids[i:i + UUIDS_POR_PATCH]
            resp = self.session.patch(
                f"{self.base_url}/rest/v1/cont_facturas",
                params={"uuid": f"in.({','.join(lote)})"},
                json=patch,
                headers=self._headers(write=True, prefer="return=minimal"),
            )
            resp.raise_for_status()

    # ---- solicitudes --------------------------------------------------------

    def save_solicitud(self, id_solicitud: str, empresa_id: str, tipo: str, fecha_inicial: date, fecha_final: date) -> None:
        resp = self.session.post(
            f"{self.base_url}/rest/v1/cont_solicitudes",
            json={
                "id_solicitud": id_solicitud,
                "empresa_id": empresa_id,
                "tipo": tipo,
                "fecha_inicial": fecha_inicial.isoformat(),
                "fecha_final": fecha_final.isoformat(),
            },
            headers=self._headers(write=True, prefer="resolution=merge-duplicates,return=minimal"),
        )
        resp.raise_for_status()

    def update_solicitud(
        self,
        id_solicitud: str,
        *,
        estado: str,
        procesada: bool,
        facturas_importadas: int = 0,
        intentos_fallidos: int | None = None,
    ) -> None:
        payload = {
            "estado": estado,
            "procesada": procesada,
            "facturas_importadas": facturas_importadas,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if intentos_fallidos is not None:
            payload["intentos_fallidos"] = intentos_fallidos

        resp = self.session.patch(
            f"{self.base_url}/rest/v1/cont_solicitudes",
            params={"id_solicitud": f"eq.{id_solicitud}"},
            json=payload,
            headers=self._headers(write=True, prefer="return=minimal"),
        )
        resp.raise_for_status()

    def pending_solicitudes(self) -> list[dict]:
        # Filtrado por empresa_id: sin esto, correr el conector para una empresa
        # (ej. Marlin) recoge tambien las solicitudes pendientes de OTRA empresa
        # (ej. PML) y las intenta revisar con el token/sesion SAT equivocado ->
        # "Token invalido" y la solicitud ajena queda marcada ERROR sin serlo.
        resp = self.session.get(
            f"{self.base_url}/rest/v1/cont_solicitudes",
            params={"procesada": "eq.false", "empresa_id": f"eq.{self.empresa_id}", "select": "*"},
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    def resumen_facturas(self) -> list[dict]:
        resp = self.session.get(
            f"{self.base_url}/rest/v1/cont_facturas",
            params={"select": "tipo,total,fecha_emision"},
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()
