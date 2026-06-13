/**
 * Pago múltiple — captura N pagos con TC, banco y fecha compartidos.
 * Página dedicada porque tiene muchas decisiones simultáneas:
 * filtrar tipo, seleccionar contratos, override de montos, etc.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtMXN, fmtFechaCorta, diasDesde } from '@/lib/format';
import { fetchCatalogos } from '@/features/blufin/queries';
import {
  fetchContratosConPendiente,
  createPagosMultiples,
  type ContratoConPendiente,
  type PagoMultipleItem,
} from '@/features/blufin/pagos-queries';

type FiltroTipo = 'todos' | 'anticipo' | 'saldo';
type ClavePendiente = `${string}|${'anticipo' | 'saldo'}`;

type Pendiente = {
  clave: ClavePendiente;
  contrato: ContratoConPendiente;
  tipo: 'anticipo' | 'saldo';
  monto: number;
  fecha: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

const TIPO_META: Record<string, { bg: string; text: string; label: string }> = {
  anticipo: { bg: 'var(--blue-100)', text: '#1E40AF', label: 'Anticipo' },
  saldo: { bg: 'var(--violet-100)', text: '#5B21B6', label: 'Saldo' },
};

function TipoPill({ tipo }: { tipo: string }) {
  const m = TIPO_META[tipo];
  if (!m) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 999,
        background: m.bg,
        color: m.text,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {m.label}
    </span>
  );
}

export function BlufinPagoMultiplePage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cat } = useQuery({
    queryKey: ['blufin_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
  });

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['blufin_contratos_pendientes', empresaId],
    queryFn: () => fetchContratosConPendiente(empresaId),
  });

  // Construir lista de pendientes (uno por contrato × tipo)
  const pendientes: Pendiente[] = useMemo(() => {
    const out: Pendiente[] = [];
    for (const c of contratos) {
      if (!c.anticipo_pagado && c.anticipo_usd && Number(c.anticipo_usd) > 0) {
        out.push({
          clave: `${c.id}|anticipo`,
          contrato: c,
          tipo: 'anticipo',
          monto: Number(c.anticipo_usd),
          fecha: c.anticipo_fecha,
        });
      }
      if (!c.saldo_pagado && c.saldo_usd && Number(c.saldo_usd) > 0) {
        out.push({
          clave: `${c.id}|saldo`,
          contrato: c,
          tipo: 'saldo',
          monto: Number(c.saldo_usd),
          fecha: c.saldo_fecha,
        });
      }
    }
    return out;
  }, [contratos]);

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [seleccion, setSeleccion] = useState<Set<ClavePendiente>>(new Set());
  const [overrides, setOverrides] = useState<Record<ClavePendiente, string>>({});

  // Common inputs
  const [tc, setTc] = useState('17.50');
  const [fecha, setFecha] = useState(todayISO());
  const [bancoId, setBancoId] = useState<number | ''>('');
  const [referencia, setReferencia] = useState('');

  const filtrados = useMemo(
    () => pendientes.filter((p) => filtroTipo === 'todos' || p.tipo === filtroTipo),
    [pendientes, filtroTipo],
  );

  const allFiltradosSelected =
    filtrados.length > 0 && filtrados.every((p) => seleccion.has(p.clave));

  const toggleAll = () => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (allFiltradosSelected) {
        filtrados.forEach((p) => next.delete(p.clave));
      } else {
        filtrados.forEach((p) => next.add(p.clave));
      }
      return next;
    });
  };

  const toggle = (clave: ClavePendiente) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  };

  const itemsSeleccionados = useMemo(() => {
    return Array.from(seleccion)
      .map((clave) => pendientes.find((p) => p.clave === clave))
      .filter(Boolean) as Pendiente[];
  }, [seleccion, pendientes]);

  const getMonto = (p: Pendiente) => {
    const override = overrides[p.clave];
    if (override != null && override !== '') return toNum(override);
    return p.monto;
  };

  const totales = useMemo(() => {
    const tcNum = toNum(tc);
    const usd = itemsSeleccionados.reduce((s, p) => s + getMonto(p), 0);
    return { usd, mxn: usd * tcNum, count: itemsSeleccionados.length };
  }, [itemsSeleccionados, overrides, tc]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (itemsSeleccionados.length === 0) throw new Error('Selecciona al menos un pago');
      if (toNum(tc) <= 0) throw new Error('Captura el TC');
      if (!bancoId) throw new Error('Selecciona el banco');

      const items: PagoMultipleItem[] = itemsSeleccionados.map((p) => ({
        contrato_id: p.contrato.id,
        tipo: p.tipo,
        monto_usd: getMonto(p),
      }));

      return createPagosMultiples({
        tc: toNum(tc),
        fecha,
        banco_id: bancoId as number,
        referencia: referencia || null,
        items,
      });
    },
    onSuccess: (count) => {
      toast.success(`${count} pago${count !== 1 ? 's' : ''} registrados`);
      qc.invalidateQueries({ queryKey: ['blufin_pagos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
      qc.invalidateQueries({ queryKey: ['blufin_forwards'] });
      qc.invalidateQueries({ queryKey: ['blufin_forwards_activos'] });
      navigate('/app/importaciones/blufin/pagos');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageEnter
        className="hstack"
        style={{ justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Pago múltiple
          </h2>
          <p className="page-subtitle">
            Selecciona pendientes y aplica un mismo TC, banco y fecha a todos
          </p>
        </div>
        <Link
          to="/app/importaciones/blufin/pagos"
          className="btn btn-ghost btn-sm"
          style={{ textDecoration: 'none' }}
        >
          <Icon name="arrow-left" size={13} /> Volver a pagos
        </Link>
      </PageEnter>

      {/* Configuración común */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Configuración compartida</h3>
            <p className="card-subtitle">Estos valores se aplican a todos los pagos</p>
          </div>
        </div>
        <div
          className="card-body"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}
        >
          <div>
            <label className="field-label">TC capturado *</label>
            <input
              className="field-input mono"
              type="number"
              step="0.0001"
              value={tc}
              onChange={(e) => setTc(e.target.value)}
              placeholder="17.5000"
            />
          </div>
          <div>
            <label className="field-label">Fecha *</label>
            <input
              type="date"
              className="field-input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Banco *</label>
            <select
              className="field-input"
              value={bancoId}
              onChange={(e) => setBancoId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— Selecciona —</option>
              {cat?.bancos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Referencia (opcional)</label>
            <input
              className="field-input mono"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Batch 2026-05-29"
            />
          </div>
        </div>
      </div>

      {/* Filtro tipo */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div className="hstack" style={{ gap: 6 }}>
            {(['todos', 'anticipo', 'saldo'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroTipo(f)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid ' + (filtroTipo === f ? 'var(--blue-500)' : 'var(--ink-200)'),
                  background: filtroTipo === f ? 'var(--blue-500)' : 'white',
                  color: filtroTipo === f ? 'white' : 'var(--ink-700)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {f === 'todos' ? 'Todos' : f === 'anticipo' ? 'Anticipos' : 'Saldos'}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  {f === 'todos'
                    ? pendientes.length
                    : pendientes.filter((p) => p.tipo === f).length}
                </span>
              </button>
            ))}
          </div>
          <div className="text-xs muted">
            {filtrados.length === 0
              ? 'Sin pendientes en este filtro'
              : `${seleccion.size} de ${filtrados.length} seleccionados`}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{ marginBottom: 100 }}>
        {isLoading ? (
          <div className="empty">
            <div className="spinner" />
            <div className="empty-title" style={{ marginTop: 12 }}>Cargando pendientes…</div>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty">
            <Icon name="check-circle" size={36} />
            <div className="empty-title">Sin pagos pendientes</div>
            <p className="muted">No hay contratos con anticipo o saldo por pagar.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allFiltradosSelected}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th>Contrato</th>
                <th>Tipo</th>
                <th>Vencimiento</th>
                <th style={{ textAlign: 'right' }}>Monto sugerido</th>
                <th style={{ textAlign: 'right', minWidth: 140 }}>Monto a pagar</th>
                <th style={{ textAlign: 'right' }}>MXN</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const checked = seleccion.has(p.clave);
                const monto = getMonto(p);
                const dias = diasDesde(p.fecha);
                const vencido = dias !== null && dias < 0;
                return (
                  <tr key={p.clave} style={{ opacity: checked ? 1 : 0.6 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.clave)}
                      />
                    </td>
                    <td>
                      <div className="mono fw-700" style={{ fontSize: 13 }}>
                        {p.contrato.folio}
                      </div>
                      <div className="text-xs muted">{p.contrato.status}</div>
                    </td>
                    <td>
                      <TipoPill tipo={p.tipo} />
                    </td>
                    <td>
                      <div className="text-sm">{fmtFechaCorta(p.fecha)}</div>
                      {dias !== null && (
                        <div
                          className="text-xs fw-600"
                          style={{
                            color: vencido
                              ? 'var(--red-500)'
                              : dias <= 3
                                ? 'var(--amber-500)'
                                : 'var(--ink-500)',
                          }}
                        >
                          {vencido
                            ? `vencido ${-dias}d`
                            : dias === 0
                              ? 'hoy'
                              : `en ${dias}d`}
                        </div>
                      )}
                    </td>
                    <td
                      style={{ textAlign: 'right' }}
                      className="mono text-sm muted"
                    >
                      {fmtUSD(p.monto)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="field-input mono"
                        value={overrides[p.clave] ?? ''}
                        onChange={(e) =>
                          setOverrides((prev) => ({ ...prev, [p.clave]: e.target.value }))
                        }
                        placeholder={p.monto.toFixed(2)}
                        disabled={!checked}
                        style={{
                          fontSize: 12,
                          padding: '6px 8px',
                          textAlign: 'right',
                          width: 130,
                          marginLeft: 'auto',
                        }}
                      />
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        color: checked ? 'var(--blue-500)' : 'var(--ink-400)',
                      }}
                      className="mono fw-600"
                    >
                      {fmtMXN(monto * toNum(tc))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Sticky footer */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'white',
          padding: 16,
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--ink-200)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          marginTop: 24,
        }}
      >
        <div className="hstack" style={{ gap: 24 }}>
          <div>
            <div className="kpi-label">Pagos seleccionados</div>
            <div className="fw-700" style={{ fontSize: 16 }}>
              {totales.count}
            </div>
          </div>
          <div>
            <div className="kpi-label">Total USD</div>
            <div className="mono fw-700" style={{ fontSize: 16 }}>
              {fmtUSD(totales.usd)}
            </div>
          </div>
          <div>
            <div className="kpi-label">× TC {tc || '—'}</div>
            <div
              className="mono fw-700"
              style={{ fontSize: 16, color: 'var(--blue-500)' }}
            >
              {fmtMXN(totales.mxn)}
            </div>
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <Link
            to="/app/importaciones/blufin/pagos"
            className="btn btn-outline"
            style={{ textDecoration: 'none' }}
          >
            Cancelar
          </Link>
          <button
            className="btn btn-primary"
            disabled={mutation.isPending || totales.count === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} /> Guardando…
              </>
            ) : (
              <>
                <Icon name="check" size={14} /> Registrar {totales.count} pago
                {totales.count !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
