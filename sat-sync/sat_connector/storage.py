from __future__ import annotations

import zipfile
from pathlib import Path

from satcfdi.cfdi import CFDI

from .cfdi_extract import extract_conceptos, extract_factura, extract_pagos, extract_relaciones
from .config import Config
from .supabase_sink import SupabaseSink


def import_zip(sink: SupabaseSink, config: Config, zip_path: Path, tipo: str, id_solicitud: str | None) -> int:
    """Descomprime un paquete de la Descarga Masiva, sube cada XML a Supabase
    Storage, y hace upsert de la factura + sus conceptos/impuestos en
    crm.cont_facturas/cont_conceptos/cont_concepto_impuestos.

    En CI (GitHub Actions) el runner es efimero, asi que la copia local en
    data/xml/<tipo>/ solo dura esa corrida — Supabase Storage es la fuente de
    verdad persistente. El servicio local de PDF (Contabilidad PML) ya sabe
    caer a Storage si no encuentra el XML en su cache local."""
    xml_dir = config.data_dir / "xml" / tipo
    xml_dir.mkdir(parents=True, exist_ok=True)

    imported = 0
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            if not name.lower().endswith(".xml"):
                continue

            raw = zf.read(name)
            try:
                invoice = CFDI.from_string(raw)
            except Exception:
                continue  # no es un CFDI valido (metadata u otro formato) - se omite

            uuid = (invoice.get("Complemento") or {}).get("TimbreFiscalDigital", {}).get("UUID")
            if not uuid:
                continue
            uuid = str(uuid)

            (xml_dir / f"{uuid}.xml").write_bytes(raw)

            storage_path = f"{tipo}/{uuid}.xml"
            sink.upload_xml(storage_path, raw)

            factura = extract_factura(
                invoice,
                tipo="recibida" if tipo == "recibidas" else "emitida",
                empresa_id=config.empresa_id,
                xml_storage_path=storage_path,
                id_solicitud=id_solicitud,
            )
            sink.upsert_factura(factura)

            conceptos = extract_conceptos(invoice)
            sink.replace_conceptos(uuid, conceptos)

            relaciones = extract_relaciones(invoice)
            sink.replace_relaciones(uuid, relaciones)

            pagos = extract_pagos(invoice)
            sink.replace_pagos(uuid, pagos)

            imported += 1

    return imported
