/**
 * Calendario Neptuno — vencimientos de pago + fechas de factura.
 * Vista de calendario mensual + lista de próximos vencimientos.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { FacturaDetalleModal } from '@/features/neptuno/FacturaDetalleModal';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtFecha, fmtFechaCorta, diasDesde } from '@/lib/format';
import { fetchFacturas, fetchSaldosPorFactura } from '@/features/neptuno/queries';
import type { NepFacturaConProductos } from '@/types/database';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoyISO = () => isoDe(new Date());
const addDiasISO = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return isoDe(d);
};

type TipoEvento = 'factura' | 'vencimiento';

type CalEvento = {
  tipo: TipoEvento;
  fecha: string;
  facturaId: string;
  facturaNum: string;
  monto: number; // total para factura, saldo para vencimiento
  pagada: boolean; // solo vencimiento
};

const EVENTO_META: Record<TipoEvento, { label: string; color: string }> = {
  factura: { label: 'Factura', color: 'var(--blue-500)' },
  vencimiento: { label: 'Vence pago', color: 'var(--amber-500)' },
};

const folioCorto = (f: string) => f.split('-').pop() ?? f;

type Vista = 'lista' | 'calendario';

export function NeptunoCalendarioPage() {
  const { empresaId } = useAuth();
  const [vista, setVista] = useState<Vista>('lista');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const hoy = hoyISO();
  const [mesAncla, setMesAncla] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { data: facturas = [] } = useQuery({
    queryKey: ['neptuno_facturas', empresaId],
    queryFn: () => fetchFacturas(empresaId),
  });
  const { data: saldos } = useQuery({
    queryKey: ['neptuno_saldos', empresaId],
    queryFn: () => fetchSaldosPorFactura(empresaId),
  });

  const saldoDe = (f: NepFacturaConProductos) =>
    Math.max(
      0,
      Number(f.total_usd ?? 0) -
        (saldos?.get(f.id)?.pagado ?? 0) -
        (saldos?.get(f.id)?.ncAplicado ?? 0),
    );

  const eventos = useMemo<CalEvento[]>(() => {
    const out: CalEvento[] = [];
    for (const f of facturas) {
      if (f.fecha_factura) {
        out.push({
          tipo: 'factura',
          fecha: f.fecha_factura,
          facturaId: f.id,
          facturaNum: f.factura_num,
          monto: Number(f.total_usd ?? 0),
          pagada: f.status === 'Liquidada',
        });
      }
      if (f.fecha_vencimiento) {
        out.push({
          tipo: 'vencimiento',
          fecha: f.fecha_vencimiento,
          facturaId: f.id,
          facturaNum: f.factura_num,
          monto: saldoDe(f),
          pagada: f.status === 'Liquidada',
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturas, saldos]);

  const stats = useMemo(() => {
    const finSemana = addDiasISO(hoy, 7);
    const vencSemana = eventos.filter(
      (e) => e.tipo === 'vencimiento' && !e.pagada && e.fecha >= hoy && e.fecha <= finSemana,
    );
    const vencidos = eventos.filter((e) => e.tipo === 'vencimiento' && !e.pagada && e.fecha < hoy);
    const montoSemana = vencSemana.reduce((s, e) => s + e.monto, 0);
    return {
      vencSemana: vencSemana.length,
      montoSemana,
      vencidos: vencidos.length,
      montoVencido: vencidos.reduce((s, e) => s + e.monto, 0),
    };
  }, [eventos, hoy]);

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Calendario
        </h2>
        <p className="page-subtitle">Vencimientos de pago y fechas de factura</p>
      </PageEnter>

      <StatStrip
        stats={[
          { value: stats.vencSemana, label: 'vencen esta semana' },
          { value: fmtUSD(stats.montoSemana), label: 'por pagar esta semana', color: stats.montoSemana > 0 ? 'var(--blue-500)' : undefined },
          { value: stats.vencidos, label: 'vencidos', color: stats.vencidos > 0 ? 'var(--red-500)' : undefined },
          { value: fmtUSD(stats.montoVencido), label: 'monto vencido', color: stats.montoVencido > 0 ? 'var(--red-500)' : undefined },
        ]}
      />

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'lista', label: 'Próximos vencimientos', icon: 'inbox' },
            { id: 'calendario', label: 'Calendario', icon: 'calendar' },
          ] as const
        ).map((t) => (
          <button key={t.id} className={`tab ${vista === t.id ? 'active' : ''}`} onClick={() => setVista(t.id as Vista)}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {vista === 'lista' ? (
        <ListaVencimientos facturas={facturas} saldoDe={saldoDe} hoy={hoy} onVer={setDetalleId} />
      ) : (
        <CalendarioGrid eventos={eventos} mesAncla={mesAncla} hoy={hoy} onMes={setMesAncla} onVer={setDetalleId} />
      )}

      <FacturaDetalleModal facturaId={detalleId} onClose={() => setDetalleId(null)} />
    </>
  );
}

/* ─── Lista de próximos vencimientos ──────────────────────────────── */

function ListaVencimientos({
  facturas,
  saldoDe,
  hoy,
  onVer,
}: {
  facturas: NepFacturaConProductos[];
  saldoDe: (f: NepFacturaConProductos) => number;
  hoy: string;
  onVer: (id: string) => void;
}) {
  const filas = useMemo(() => {
    return facturas
      .filter((f) => f.status !== 'Liquidada' && f.fecha_vencimiento)
      .map((f) => ({ f, saldo: saldoDe(f) }))
      .filter((r) => r.saldo > 0.01)
      .sort((a, b) => (a.f.fecha_vencimiento ?? '').localeCompare(b.f.fecha_vencimiento ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturas]);

  if (filas.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="check-circle" size={36} />
          <div className="empty-title">Sin vencimientos pendientes</div>
          <p className="muted">Todas las facturas con vencimiento están liquidadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <table className="tbl">
        <thead>
          <tr>
            <th>Factura</th>
            <th>Vence</th>
            <th>Cuándo</th>
            <th style={{ textAlign: 'right' }}>Saldo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ f, saldo }) => {
            const dias = diasDesde(f.fecha_vencimiento, new Date(hoy + 'T12:00:00'));
            const vencido = dias !== null && dias < 0;
            const proximo = dias !== null && dias >= 0 && dias <= 3;
            return (
              <tr key={f.id} onClick={() => onVer(f.id)} style={{ cursor: 'pointer' }} title="Ver factura">
                <td className="mono fw-700 text-sm" style={{ color: 'var(--blue-500)' }}>{f.factura_num}</td>
                <td className="text-sm">{fmtFecha(f.fecha_vencimiento)}</td>
                <td>
                  {dias !== null && (
                    <span
                      className="text-xs fw-600"
                      style={{ color: vencido ? 'var(--red-500)' : proximo ? 'var(--amber-500)' : 'var(--ink-500)' }}
                    >
                      {vencido ? `Vencido hace ${-dias}d` : dias === 0 ? 'Vence hoy' : `En ${dias} días`}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }} className="mono fw-700" >
                  <span style={{ color: 'var(--amber-500)' }}>{fmtUSD(saldo)}</span>
                </td>
                <td>
                  <span className={`badge ${f.status === 'Parcial' ? 'badge-blue' : 'badge-amber'}`}>
                    {f.status ?? 'Pendiente'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Leyenda ─────────────────────────────────────────────────────── */

function Leyenda() {
  const items: { color: string; label: string }[] = [
    { color: 'var(--blue-500)', label: 'Factura emitida' },
    { color: 'var(--amber-500)', label: 'Vence pago' },
    { color: 'var(--green-500)', label: 'Liquidada' },
  ];
  return (
    <span className="hstack text-xs muted" style={{ gap: 10, flexWrap: 'wrap' }}>
      {items.map((it) => (
        <span key={it.label} className="hstack" style={{ gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: it.color }} />
          {it.label}
        </span>
      ))}
    </span>
  );
}

/* ─── Calendario grid ─────────────────────────────────────────────── */

function CalendarioGrid({
  eventos,
  mesAncla,
  hoy,
  onMes,
  onVer,
}: {
  eventos: CalEvento[];
  mesAncla: Date;
  hoy: string;
  onMes: (d: Date) => void;
  onVer: (id: string) => void;
}) {
  const porDia = useMemo(() => {
    const map = new Map<string, CalEvento[]>();
    for (const e of eventos) {
      const arr = map.get(e.fecha) ?? [];
      arr.push(e);
      map.set(e.fecha, arr);
    }
    return map;
  }, [eventos]);

  const celdas = useMemo(() => {
    const primero = new Date(mesAncla.getFullYear(), mesAncla.getMonth(), 1);
    const offsetLunes = (primero.getDay() + 6) % 7;
    const inicio = new Date(primero);
    inicio.setDate(primero.getDate() - offsetLunes);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [mesAncla]);

  const colorEvento = (e: CalEvento) =>
    e.tipo === 'vencimiento' && e.pagada ? 'var(--green-500)' : EVENTO_META[e.tipo].color;

  return (
    <div className="card">
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--ink-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div className="hstack" style={{ gap: 12, flexWrap: 'wrap' }}>
          <span className="fw-700" style={{ fontSize: 14, minWidth: 130 }}>
            {MESES[mesAncla.getMonth()]} {mesAncla.getFullYear()}
          </span>
          <Leyenda />
        </div>
        <div className="hstack" style={{ gap: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onMes(new Date(mesAncla.getFullYear(), mesAncla.getMonth() - 1, 1))} aria-label="Mes anterior" style={{ padding: 6 }}>
            <Icon name="chevron-left" size={14} />
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              const d = new Date();
              onMes(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Hoy
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onMes(new Date(mesAncla.getFullYear(), mesAncla.getMonth() + 1, 1))} aria-label="Mes siguiente" style={{ padding: 6 }}>
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ink-100)' }}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {celdas.map((d, i) => {
          const iso = isoDe(d);
          const delMes = d.getMonth() === mesAncla.getMonth();
          const esHoy = iso === hoy;
          const evs = porDia.get(iso) ?? [];
          const visibles = evs.slice(0, 3);
          const extra = evs.length - visibles.length;
          return (
            <div
              key={i}
              style={{
                minHeight: 76,
                padding: 6,
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--ink-100)' : 'none',
                borderBottom: i < 35 ? '1px solid var(--ink-100)' : 'none',
                background: delMes ? 'white' : 'var(--ink-50)',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4,
                  fontSize: 11,
                  fontWeight: esHoy ? 800 : 600,
                  background: esHoy ? 'var(--blue-500)' : 'transparent',
                  color: esHoy ? 'white' : delMes ? 'var(--ink-700)' : 'var(--ink-400)',
                }}
              >
                {d.getDate()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibles.map((e, ci) => {
                  const color = colorEvento(e);
                  return (
                    <button
                      key={ci}
                      onClick={() => onVer(e.facturaId)}
                      title={`${EVENTO_META[e.tipo].label} · ${e.facturaNum} · ${fmtUSD(e.monto)}`}
                      className="mono"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 5px',
                        borderRadius: 5,
                        background: `color-mix(in srgb, ${color} 12%, white)`,
                        color,
                        fontSize: 10,
                        fontWeight: 700,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0 }} />
                      {folioCorto(e.facturaNum)}
                    </button>
                  );
                })}
                {extra > 0 && (
                  <span className="text-xs" style={{ color: 'var(--ink-500)', paddingLeft: 4 }}>
                    +{extra} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
