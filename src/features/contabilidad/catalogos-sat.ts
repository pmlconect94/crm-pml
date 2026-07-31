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
  '06': 'Dinero electrónico',
  '15': 'Condonación',
  '17': 'Compensación',
  '28': 'Tarjeta de débito',
  '30': 'Aplicación de anticipos',
  '31': 'Intermediario pagos',
  '99': 'Por definir',
};

// Orden explícito para el filtro: `Object.keys` reordena las claves numéricas
// canónicas ('15','99'…) antes que las que llevan cero a la izquierda ('01'),
// así que la lista se declara a mano en orden de clave.
const FORMA_PAGO_ORDEN = ['01', '02', '03', '04', '06', '15', '17', '28', '30', '31', '99'];

export const FORMA_PAGO_FILTROS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: 'Todas las formas de pago' },
  ...FORMA_PAGO_ORDEN.map((c) => ({ value: c, label: `${c} · ${FORMA_PAGO_SAT[c]}` })),
];

export const formaPagoLabel = (c: string | null) => (c ? `${c} · ${FORMA_PAGO_SAT[c] ?? 'Otro'}` : '—');
export const formaPagoCorto = (c: string | null) => (c ? (FORMA_PAGO_SAT[c] ?? c) : '—');
export const tipoComprobanteLabel = (c: string | null) => (c ? (TIPO_COMPROBANTE_SAT[c] ?? c) : '—');
