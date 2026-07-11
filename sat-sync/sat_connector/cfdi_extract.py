from __future__ import annotations

from typing import Any


def _code(value: Any) -> str | None:
    if value is None:
        return None
    return getattr(value, "code", value)


def _code_desc(value: Any) -> str | None:
    if value is None:
        return None
    desc = getattr(value, "description", None)
    return str(desc) if desc is not None else None


def _num(value: Any) -> float | None:
    return float(value) if value is not None else None


def _iso(value: Any) -> str | None:
    return value.isoformat() if value is not None else None


def extract_factura(invoice: dict, *, tipo: str, empresa_id: str, xml_storage_path: str, id_solicitud: str | None) -> dict:
    """Convierte un CFDI parseado (satcfdi.cfdi.CFDI) en el dict listo para
    insertar en crm.cont_facturas."""
    emisor = invoice.get("Emisor") or {}
    receptor = invoice.get("Receptor") or {}
    impuestos = invoice.get("Impuestos") or {}
    tfd = (invoice.get("Complemento") or {}).get("TimbreFiscalDigital") or {}
    uuid = tfd.get("UUID")

    if not uuid:
        raise ValueError("El CFDI no trae Complemento.TimbreFiscalDigital.UUID (no esta timbrado)")

    return {
        "uuid": str(uuid),
        "empresa_id": empresa_id,
        "tipo": tipo,

        "version": invoice.get("Version"),
        "serie": invoice.get("Serie"),
        "folio": invoice.get("Folio"),
        "fecha_emision": _iso(invoice.get("Fecha")),
        "fecha_timbrado": _iso(tfd.get("FechaTimbrado")),
        "lugar_expedicion": invoice.get("LugarExpedicion"),
        "no_certificado": invoice.get("NoCertificado"),
        "no_certificado_sat": tfd.get("NoCertificadoSAT"),

        "subtotal": _num(invoice.get("SubTotal")),
        "descuento": _num(invoice.get("Descuento")),
        "total": _num(invoice.get("Total")),
        "moneda": _code(invoice.get("Moneda")),
        "tipo_cambio": _num(invoice.get("TipoCambio")),

        "tipo_comprobante": _code(invoice.get("TipoDeComprobante")),
        "metodo_pago": _code(invoice.get("MetodoPago")),
        "forma_pago": _code(invoice.get("FormaPago")),
        "condiciones_de_pago": invoice.get("CondicionesDePago"),
        "confirmacion": invoice.get("Confirmacion"),

        "total_impuestos_trasladados": _num(impuestos.get("TotalImpuestosTrasladados")),
        "total_impuestos_retenidos": _num(impuestos.get("TotalImpuestosRetenidos")),

        "emisor_rfc": str(emisor.get("Rfc") or ""),
        "emisor_nombre": emisor.get("Nombre"),
        "emisor_regimen_fiscal": _code(emisor.get("RegimenFiscal")),

        "receptor_rfc": str(receptor.get("Rfc") or ""),
        "receptor_nombre": receptor.get("Nombre"),
        "receptor_domicilio_fiscal": receptor.get("DomicilioFiscalReceptor"),
        "receptor_regimen_fiscal": _code(receptor.get("RegimenFiscalReceptor")),
        "receptor_uso_cfdi": _code(receptor.get("UsoCFDI")),

        "sello_cfdi": invoice.get("Sello"),
        "sello_sat": tfd.get("SelloSAT"),
        "rfc_prov_certif": tfd.get("RfcProvCertif"),

        "exportacion": _code(invoice.get("Exportacion")),

        "estatus_sat": "vigente",
        "xml_storage_path": xml_storage_path,
        "id_solicitud": id_solicitud,
    }


def extract_relaciones(invoice: dict) -> list[dict]:
    """CfdiRelacionados: liga este CFDI con el/los UUID de documentos originales
    (ej. la factura que una nota de credito esta corrigiendo)."""
    relaciones = []
    for rel in invoice.get("CfdiRelacionados") or []:
        tipo_code = _code(rel.get("TipoRelacion"))
        tipo_desc = _code_desc(rel.get("TipoRelacion"))
        for uuid_rel in rel.get("CfdiRelacionado") or []:
            relaciones.append({
                "uuid_relacionado": str(uuid_rel),
                "tipo_relacion": tipo_code,
                "tipo_relacion_desc": tipo_desc,
            })
    return relaciones


def extract_pagos(invoice: dict) -> list[dict]:
    """Complemento de Pago (comprobantes tipo P): que factura(s) se pagaron, cuanto,
    y el saldo que queda — la fuente real para saber que PPD ya esta liquidada."""
    pagos_complemento = (invoice.get("Complemento") or {}).get("Pagos") or {}
    result = []
    for pago in pagos_complemento.get("Pago") or []:
        documentos = []
        for doc in pago.get("DoctoRelacionado") or []:
            documentos.append({
                "id_documento": str(doc.get("IdDocumento") or ""),
                "serie": doc.get("Serie"),
                "folio": doc.get("Folio"),
                "moneda_dr": _code(doc.get("MonedaDR")),
                "num_parcialidad": doc.get("NumParcialidad"),
                "imp_saldo_ant": _num(doc.get("ImpSaldoAnt")),
                "imp_pagado": _num(doc.get("ImpPagado")),
                "imp_saldo_insoluto": _num(doc.get("ImpSaldoInsoluto")),
                "objeto_imp_dr": _code(doc.get("ObjetoImpDR")),
            })

        result.append({
            "fecha_pago": _iso(pago.get("FechaPago")),
            "forma_pago": _code(pago.get("FormaDePagoP")),
            "moneda": _code(pago.get("MonedaP")),
            "tipo_cambio": _num(pago.get("TipoCambioP")),
            "monto": _num(pago.get("Monto")),
            "num_operacion": pago.get("NumOperacion"),
            "rfc_emisor_cta_ord": pago.get("RfcEmisorCtaOrd"),
            "rfc_emisor_cta_ben": pago.get("RfcEmisorCtaBen"),
            "cta_beneficiario": pago.get("CtaBeneficiario"),
            "documentos": documentos,
        })
    return result


def extract_conceptos(invoice: dict) -> list[dict]:
    """Devuelve la lista de conceptos (lineas) con sus impuestos anidados bajo
    la clave 'impuestos' (se separan antes de insertar, ver supabase_sink)."""
    conceptos = invoice.get("Conceptos") or []
    result = []

    for idx, c in enumerate(conceptos, start=1):
        line_impuestos = []
        imp = c.get("Impuestos") or {}
        for grupo, tipo in (("Traslados", "traslado"), ("Retenciones", "retencion")):
            for detalle in (imp.get(grupo) or {}).values():
                line_impuestos.append({
                    "tipo": tipo,
                    "impuesto": _code(detalle.get("Impuesto")),
                    "tipo_factor": _code(detalle.get("TipoFactor")),
                    "tasa_o_cuota": _num(detalle.get("TasaOCuota")),
                    "base": _num(detalle.get("Base")),
                    "importe": _num(detalle.get("Importe")),
                })

        result.append({
            "num_linea": idx,
            "clave_prod_serv": _code(c.get("ClaveProdServ")),
            "clave_prod_serv_desc": _code_desc(c.get("ClaveProdServ")),
            "no_identificacion": c.get("NoIdentificacion"),
            "cantidad": _num(c.get("Cantidad")),
            "clave_unidad": _code(c.get("ClaveUnidad")),
            "clave_unidad_desc": _code_desc(c.get("ClaveUnidad")),
            "unidad": c.get("Unidad"),
            "descripcion": c.get("Descripcion"),
            "valor_unitario": _num(c.get("ValorUnitario")),
            "importe": _num(c.get("Importe")),
            "descuento": _num(c.get("Descuento")),
            "objeto_imp": _code(c.get("ObjetoImp")),
            "impuestos": line_impuestos,
        })

    return result
