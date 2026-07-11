from __future__ import annotations

import io
from decimal import Decimal

import qrcode
from num2words import num2words
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from satcfdi.cfdi import CFDI

NAVY = colors.HexColor("#0f2942")
BLUE = colors.HexColor("#2563eb")
INK = colors.HexColor("#111827")
GRAY_TEXT = colors.HexColor("#6b7280")
GRAY_BG = colors.HexColor("#f3f4f6")
GRAY_BORDER = colors.HexColor("#d9dde3")
GREEN = colors.HexColor("#16a34a")
WHITE = colors.white

MONEDA_SIMBOLO = {"MXN": "$", "USD": "US$", "EUR": "€"}
MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
          "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

PAGE_MARGIN = 16 * mm
CONTENT_WIDTH = letter[0] - 2 * PAGE_MARGIN


def _code(value):
    return getattr(value, "code", value)


def _desc(value):
    d = getattr(value, "description", None)
    return str(d) if d else None


def _money(value, moneda="MXN") -> str:
    simbolo = MONEDA_SIMBOLO.get(moneda, f"{moneda} ")
    return f"{simbolo}{Decimal(value if value is not None else 0):,.2f}"


def _fecha_larga(dt) -> str:
    if not dt:
        return "-"
    return f"{dt.day:02d} de {MESES[dt.month]} de {dt.year}, {dt.strftime('%H:%M:%S')}"


def _importe_en_letra(total, moneda: str) -> str:
    currency = moneda if moneda in ("MXN", "USD", "EUR") else "MXN"
    texto = num2words(float(total or 0), lang="es", to="currency", currency=currency)
    sufijo = " M.N." if moneda == "MXN" else ""
    return texto[0:1].upper() + texto[1:] + sufijo


def _chunk_monospace(s: str, width: int = 100) -> str:
    """Inserta <br/> cada N caracteres para que un blob sin espacios (sello,
    cadena original) haga wrap dentro de un Paragraph de reportlab."""
    if not s:
        return "-"
    return "<br/>".join(s[i:i + width] for i in range(0, len(s), width))


def _qr_image(url: str, size_mm: float = 26) -> Image:
    qr = qrcode.QRCode(border=1, box_size=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Image(buf, width=size_mm * mm, height=size_mm * mm)


def _styles() -> dict:
    return {
        "empresa": ParagraphStyle("empresa", fontName="Helvetica-Bold", fontSize=14, textColor=NAVY, leading=17),
        "empresa_sub": ParagraphStyle("empresa_sub", fontName="Helvetica", fontSize=8.5, textColor=GRAY_TEXT, leading=12),
        "doc_tipo": ParagraphStyle("doc_tipo", fontName="Helvetica-Bold", fontSize=11, textColor=WHITE, leading=13, alignment=TA_CENTER),
        "doc_folio": ParagraphStyle("doc_folio", fontName="Helvetica-Bold", fontSize=15, textColor=WHITE, leading=18, alignment=TA_CENTER),
        "doc_badge": ParagraphStyle("doc_badge", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, leading=10, alignment=TA_CENTER),
        "label": ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=7, textColor=GRAY_TEXT, leading=9, spaceAfter=1),
        "value": ParagraphStyle("value", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=12),
        "value_mono": ParagraphStyle("value_mono", fontName="Courier", fontSize=8.5, textColor=INK, leading=11),
        "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, textColor=INK, leading=11),
        "cell_r": ParagraphStyle("cell_r", fontName="Helvetica", fontSize=8.5, textColor=INK, leading=11, alignment=TA_RIGHT),
        "cell_head": ParagraphStyle("cell_head", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, leading=10),
        "cell_head_r": ParagraphStyle("cell_head_r", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, leading=10, alignment=TA_RIGHT),
        "total_label": ParagraphStyle("total_label", fontName="Helvetica", fontSize=9, textColor=GRAY_TEXT, alignment=TA_RIGHT),
        "total_value": ParagraphStyle("total_value", fontName="Helvetica-Bold", fontSize=9, textColor=INK, alignment=TA_RIGHT),
        "gran_total_label": ParagraphStyle("gran_total_label", fontName="Helvetica-Bold", fontSize=11, textColor=WHITE, alignment=TA_RIGHT),
        "gran_total_value": ParagraphStyle("gran_total_value", fontName="Helvetica-Bold", fontSize=13, textColor=WHITE, alignment=TA_RIGHT),
        "letra": ParagraphStyle("letra", fontName="Helvetica-Oblique", fontSize=8.5, textColor=GRAY_TEXT, leading=11),
        "mono_small": ParagraphStyle("mono_small", fontName="Courier", fontSize=6, textColor=GRAY_TEXT, leading=7.5),
        "mono_label": ParagraphStyle("mono_label", fontName="Helvetica-Bold", fontSize=6.5, textColor=NAVY, leading=8, spaceBefore=4, spaceAfter=1),
        "legal": ParagraphStyle("legal", fontName="Helvetica", fontSize=6.5, textColor=GRAY_TEXT, leading=9, alignment=TA_CENTER),
    }


def _header(invoice: dict, s: dict) -> Table:
    emisor = invoice.get("Emisor") or {}
    tfd = (invoice.get("Complemento") or {}).get("TimbreFiscalDigital") or {}
    tipo_map = {"I": "FACTURA", "E": "NOTA DE CRÉDITO", "T": "CARTA PORTE", "N": "NÓMINA", "P": "PAGO"}
    tipo_txt = tipo_map.get(_code(invoice.get("TipoDeComprobante")), "COMPROBANTE")
    folio_txt = "-".join(x for x in [invoice.get("Serie"), invoice.get("Folio")] if x) or (str(tfd.get("UUID"))[:8] if tfd.get("UUID") else "")

    izq = Paragraph(
        f"{emisor.get('Nombre') or ''}<br/>"
        f"<font size=8.5 color='#6b7280'>RFC {emisor.get('Rfc') or ''}"
        f"{' &middot; ' + _desc(emisor.get('RegimenFiscal')) if _desc(emisor.get('RegimenFiscal')) else ''}</font>",
        s["empresa"],
    )

    der = Table(
        [[Paragraph(tipo_txt, s["doc_tipo"])],
         [Paragraph(folio_txt or "&nbsp;", s["doc_folio"])],
         [Paragraph("VIGENTE", s["doc_badge"])]],
        colWidths=[55 * mm],
    )
    der.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("BACKGROUND", (0, 2), (-1, 2), GREEN),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
        ("TOPPADDING", (0, 2), (-1, 2), 3),
        ("BOTTOMPADDING", (0, 2), (-1, 2), 3),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    outer = Table([[izq, der]], colWidths=[CONTENT_WIDTH - 55 * mm, 55 * mm])
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
    ]))
    return outer


def _metadata_strip(invoice: dict, s: dict) -> Table:
    tfd = (invoice.get("Complemento") or {}).get("TimbreFiscalDigital") or {}

    def cell(label, value, mono=False):
        return [Paragraph(label.upper(), s["label"]), Paragraph(value or "-", s["value_mono"] if mono else s["value"])]

    data = [[
        cell("Folio fiscal (UUID)", str(tfd.get("UUID") or "-"), mono=True),
    ]]
    row1 = Table(data, colWidths=[CONTENT_WIDTH])
    row1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))

    c1, c2, c3 = CONTENT_WIDTH / 3, CONTENT_WIDTH / 3, CONTENT_WIDTH / 3
    data2 = [[
        [Paragraph("FECHA DE EMISIÓN", s["label"]), Paragraph(_fecha_larga(invoice.get("Fecha")), s["value"])],
        [Paragraph("FECHA DE TIMBRADO", s["label"]), Paragraph(_fecha_larga(tfd.get("FechaTimbrado")), s["value"])],
        [Paragraph("LUGAR DE EXPEDICIÓN", s["label"]), Paragraph(invoice.get("LugarExpedicion") or "-", s["value"])],
    ]]
    row2 = Table(data2, colWidths=[c1, c2, c3])
    row2.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]))

    wrap = Table([[row1], [row2]], colWidths=[CONTENT_WIDTH])
    wrap.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    return wrap


def _emisor_receptor(invoice: dict, s: dict) -> Table:
    emisor = invoice.get("Emisor") or {}
    receptor = invoice.get("Receptor") or {}

    def card(titulo, rfc, nombre, extra_label, extra_value):
        rows = [
            [Paragraph(titulo, s["label"])],
            [Paragraph(nombre or "-", s["value"])],
            [Paragraph(f"RFC: {rfc or '-'}", s["value"])],
        ]
        if extra_value:
            rows.append([Paragraph(f"{extra_label}: {extra_value}", s["value"])])
        t = Table(rows, colWidths=[CONTENT_WIDTH / 2 - 4 * mm])
        t.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.6, GRAY_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (0, 0), 6),
        ]))
        return t

    izq = card("EMISOR", emisor.get("Rfc"), emisor.get("Nombre"), "Régimen fiscal", _desc(emisor.get("RegimenFiscal")))
    der = card("RECEPTOR (NOSOTROS)", receptor.get("Rfc"), receptor.get("Nombre"), "Uso CFDI", _desc(receptor.get("UsoCFDI")))

    outer = Table([[izq, "", der]], colWidths=[CONTENT_WIDTH / 2 - 4 * mm, 8 * mm, CONTENT_WIDTH / 2 - 4 * mm])
    outer.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return outer


def _pago_strip(invoice: dict, s: dict) -> Table:
    moneda = _code(invoice.get("Moneda")) or "MXN"
    tc = invoice.get("TipoCambio")
    items = [
        ("FORMA DE PAGO", _desc(invoice.get("FormaPago")) or _code(invoice.get("FormaPago")) or "-"),
        ("MÉTODO DE PAGO", f"{_code(invoice.get('MetodoPago')) or '-'} – {_desc(invoice.get('MetodoPago')) or ''}".strip(" –")),
        ("MONEDA", f"{moneda}" + (f"  (TC {tc})" if tc and float(tc) != 1 else "")),
        ("CONDICIONES", invoice.get("CondicionesDePago") or "-"),
    ]
    w = CONTENT_WIDTH / len(items)
    row = [[Paragraph(lbl, s["label"]), Paragraph(str(val), s["value"])] for lbl, val in items]
    t = Table([row], colWidths=[w] * len(items))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBEFORE", (1, 0), (-1, 0), 0.6, GRAY_BORDER),
    ]))
    return t


def _conceptos_tabla(invoice: dict, s: dict) -> Table:
    conceptos = invoice.get("Conceptos") or []
    moneda = _code(invoice.get("Moneda")) or "MXN"

    header = [
        Paragraph("CANT.", s["cell_head_r"]), Paragraph("UNIDAD SAT", s["cell_head"]),
        Paragraph("CLAVE SAT", s["cell_head"]), Paragraph("DESCRIPCIÓN", s["cell_head"]),
        Paragraph("P. UNITARIO", s["cell_head_r"]), Paragraph("IMPORTE", s["cell_head_r"]),
    ]
    rows = [header]
    for c in conceptos:
        clave_unidad = _code(c.get("ClaveUnidad")) or "-"
        clave_prod = _code(c.get("ClaveProdServ")) or "-"
        desc = c.get("Descripcion") or ""
        no_id = c.get("NoIdentificacion")
        if no_id:
            desc = f"{desc}<br/><font size=7 color='#6b7280'>Artículo: {no_id}</font>"
        rows.append([
            Paragraph(f"{Decimal(c.get('Cantidad') or 0):,.2f}", s["cell_r"]),
            Paragraph(f"{clave_unidad}<br/><font size=7 color='#6b7280'>{c.get('Unidad') or ''}</font>", s["cell"]),
            Paragraph(clave_prod, s["cell"]),
            Paragraph(desc, s["cell"]),
            Paragraph(_money(c.get("ValorUnitario"), moneda), s["cell_r"]),
            Paragraph(_money(c.get("Importe"), moneda), s["cell_r"]),
        ])

    col_widths = [20 * mm, 22 * mm, 22 * mm, CONTENT_WIDTH - 20 * mm - 22 * mm - 22 * mm - 26 * mm - 26 * mm, 26 * mm, 26 * mm]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, GRAY_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), GRAY_BG))
    t.setStyle(TableStyle(style))
    return t


def _totales(invoice: dict, s: dict) -> Table:
    moneda = _code(invoice.get("Moneda")) or "MXN"
    impuestos = invoice.get("Impuestos") or {}

    filas = [("Subtotal", invoice.get("SubTotal"))]
    if invoice.get("Descuento"):
        filas.append(("Descuento", -Decimal(invoice.get("Descuento"))))

    traslados = impuestos.get("Traslados") or {}
    for detalle in traslados.values():
        nombre = _desc(detalle.get("Impuesto")) or _code(detalle.get("Impuesto")) or "Impuesto"
        tasa = detalle.get("TasaOCuota")
        etiqueta = f"{nombre} ({Decimal(tasa) * 100:.0f}%)" if tasa else nombre
        filas.append((etiqueta, detalle.get("Importe")))

    retenciones = impuestos.get("Retenciones") or {}
    for detalle in retenciones.values():
        nombre = _desc(detalle.get("Impuesto")) or _code(detalle.get("Impuesto")) or "Retención"
        filas.append((f"Retención {nombre}", -Decimal(detalle.get("Importe") or 0)))

    rows = [[Paragraph(lbl, s["total_label"]), Paragraph(_money(val, moneda), s["total_value"])] for lbl, val in filas]
    rows.append([Paragraph("TOTAL", s["gran_total_label"]), Paragraph(_money(invoice.get("Total"), moneda), s["gran_total_value"])])

    t = Table(rows, colWidths=[38 * mm, 40 * mm])
    style = [
        ("TOPPADDING", (0, 0), (-1, -2), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -2), 2),
        ("BACKGROUND", (0, -1), (-1, -1), NAVY),
        ("TOPPADDING", (0, -1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
        ("RIGHTPADDING", (0, -1), (-1, -1), 8),
        ("LEFTPADDING", (0, -1), (-1, -1), 8),
    ]
    t.setStyle(TableStyle(style))

    outer = Table([["", t]], colWidths=[CONTENT_WIDTH - 78 * mm, 78 * mm])
    outer.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (1, 0), (1, 0), 0), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return outer


def _footer(invoice: dict, s: dict) -> Table:
    tfd = (invoice.get("Complemento") or {}).get("TimbreFiscalDigital") or {}
    verifica_url = invoice.verifica_url if hasattr(invoice, "verifica_url") else ""

    try:
        qr = _qr_image(verifica_url) if verifica_url else Spacer(26 * mm, 26 * mm)
    except Exception:
        qr = Spacer(26 * mm, 26 * mm)

    bloque = [
        Paragraph("SELLO DIGITAL DEL CFDI", s["mono_label"]),
        Paragraph(_chunk_monospace(invoice.get("Sello")), s["mono_small"]),
        Paragraph("SELLO DIGITAL DEL SAT", s["mono_label"]),
        Paragraph(_chunk_monospace(tfd.get("SelloSAT")), s["mono_small"]),
        Paragraph("CADENA ORIGINAL DEL COMPLEMENTO DE CERTIFICACIÓN DIGITAL DEL SAT", s["mono_label"]),
        Paragraph(_chunk_monospace(_cadena_original_segura(invoice)), s["mono_small"]),
    ]
    bloque_tabla = Table([[b] for b in bloque], colWidths=[CONTENT_WIDTH - 34 * mm])
    bloque_tabla.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))

    outer = Table([[qr, bloque_tabla]], colWidths=[30 * mm, CONTENT_WIDTH - 30 * mm])
    outer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), 4)]))
    return outer


def _cadena_original_segura(invoice: dict) -> str:
    try:
        return invoice.cadena_original()
    except Exception:
        return "-"


def generar_pdf(invoice: CFDI) -> bytes:
    """Genera la representación impresa (PDF) de un CFDI ya cargado con
    satcfdi.cfdi.CFDI.from_file/from_string. Diseño propio (no el template
    default de satcfdi)."""
    s = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=PAGE_MARGIN, rightMargin=PAGE_MARGIN, topMargin=PAGE_MARGIN, bottomMargin=PAGE_MARGIN,
        title=f"Factura {invoice.get('Serie') or ''}{invoice.get('Folio') or ''}",
    )

    story = [
        _header(invoice, s),
        Spacer(1, 8),
        _metadata_strip(invoice, s),
        Spacer(1, 8),
        _emisor_receptor(invoice, s),
        Spacer(1, 8),
        _pago_strip(invoice, s),
        Spacer(1, 10),
        _conceptos_tabla(invoice, s),
        Spacer(1, 8),
        _totales(invoice, s),
        Spacer(1, 6),
        Paragraph(f"Importe con letra: {_importe_en_letra(invoice.get('Total'), _code(invoice.get('Moneda')) or 'MXN')}.", s["letra"]),
        Spacer(1, 12),
        HRFlowable(width=CONTENT_WIDTH, thickness=0.6, color=GRAY_BORDER),
        Spacer(1, 8),
        _footer(invoice, s),
        Spacer(1, 8),
        Paragraph(
            "Este documento es una representación impresa de un Comprobante Fiscal Digital por Internet (CFDI). "
            "Puede verificar su autenticidad escaneando el código QR o en el portal del SAT.",
            s["legal"],
        ),
    ]

    doc.build(story)
    return buf.getvalue()


def generar_pdf_desde_xml(xml_bytes: bytes) -> bytes:
    invoice = CFDI.from_string(xml_bytes)
    return generar_pdf(invoice)
