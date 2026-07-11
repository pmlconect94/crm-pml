/**
 * Catálogos SAT usados en Contabilidad — compartidos entre la lista y el detalle
 * de facturas para no duplicar el mapeo.
 */

// c_TipoDeComprobante — los 4 valores que de hecho aparecen en lo sincronizado
// del SAT para PML (no incluye 'N' Nómina: no aplica a facturas recibidas).
export const TIPO_COMPROBANTE_SAT: Record<string, string> = {
  I: 'Factura',
  E: 'Nota de crédito',
  T: 'Carta porte',
  P: 'Pago',
};

export const TIPO_COMPROBANTE_FILTROS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: 'Todas' },
  { value: 'I', label: 'Facturas' },
  { value: 'E', label: 'Notas de crédito' },
  { value: 'T', label: 'Cartas porte' },
  { value: 'P', label: 'Pagos' },
];

export const METODO_PAGO_FILTROS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 'PUE', label: 'PUE' },
  { value: 'PPD', label: 'PPD' },
];

// c_FormaPago — solo las claves observadas en datos reales + fallback genérico.
// No es el catálogo completo (serían ~50 claves); ampliar si el sync trae una
// clave que no está aquí.
export const FORMA_PAGO_SAT: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica',
  '04': 'Tarjeta de crédito',
  '15': 'Condonación',
  '28': 'Tarjeta de débito',
  '31': 'Intermediario pagos',
  '99': 'Por definir',
};

export const formaPagoLabel = (c: string | null) => (c ? `${c} · ${FORMA_PAGO_SAT[c] ?? 'Otro'}` : '—');
export const formaPagoCorto = (c: string | null) => (c ? (FORMA_PAGO_SAT[c] ?? c) : '—');
export const tipoComprobanteLabel = (c: string | null) => (c ? (TIPO_COMPROBANTE_SAT[c] ?? c) : '—');
