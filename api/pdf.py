"""Funcion serverless de Vercel: genera el PDF de una factura al momento
(GET /api/pdf?uuid=<uuid>). No guarda nada — lee el XML de Supabase Storage y
lo regresa como PDF en la misma respuesta. Reemplaza al servicio local
(Contabilidad PML/sat_connector/pdf_service.py) para no depender de que una
computadora especifica este prendida.

Nota de seguridad: no hay autenticacion propia — cualquiera con el UUID exacto
de una factura puede generar su PDF. Los UUID de CFDI son aleatorios (v4, 122
bits), asi que adivinarlos no es practico, pero si en algun momento se quiere
restringir a usuarios con sesion de CRM PML, aqui es donde se agregaria la
verificacion del JWT de Supabase Auth.
"""
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import requests

from pdf_generator import generar_pdf_desde_xml

BUCKET = "cont-facturas"


def _fetch_xml(uuid: str) -> bytes | None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    for tipo_dir in ("recibidas", "emitidas"):
        url = f"{supabase_url}/storage/v1/object/{BUCKET}/{tipo_dir}/{uuid}.xml"
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.content
    return None


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        uuid = (query.get("uuid") or [""])[0].strip()

        if not uuid:
            self.send_response(400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("Uso: GET /api/pdf?uuid=<uuid>".encode("utf-8"))
            return

        try:
            xml_bytes = _fetch_xml(uuid)
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"Error consultando Supabase Storage: {e}".encode("utf-8"))
            return

        if xml_bytes is None:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"No se encontro el XML de la factura {uuid}".encode("utf-8"))
            return

        try:
            pdf_bytes = generar_pdf_desde_xml(xml_bytes)
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"Error generando el PDF: {e}".encode("utf-8"))
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition", f'inline; filename="factura-{uuid}.pdf"')
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(pdf_bytes)
