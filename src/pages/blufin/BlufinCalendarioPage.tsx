import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtFechaCorta } from '@/lib/format';
import { fetchContratos } from '@/features/blufin/queries';
import { fetchRecepciones } from '@/features/blufin/recepcion-queries';
import { statusContrato } from '@/features/blufin/status';
import { ContratoDetalleModal } from '@/features/blufin/ContratoDetalleModal';

/* ─── Helpers de fecha (todo en hora local, formato YYYY-MM-DD) ──────── */

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoyISO = () => isoDe(new Date());

// ETA bodega "auto" = ETA puerto + 7d (regla §14.4). Si la ETA bodega guardada
// coincide con esto, es estimada; si difiere, ya es oficial.
const etaBodegaAuto = (etaPuerto: string) => {
  const d = new Date(etaPuerto + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  return isoDe(d);
};
const addDiasISO = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return isoDe(d);
};
const lunesDeISO = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDe(d);
};

/* ─── Eventos del calendario ─────────────────────────────────────────── */

type TipoEvento = 'eta-puerto' | 'eta-bodega' | 'recepcion' | 'anticipo' | 'saldo';

type CalEvento = {
  tipo: TipoEvento;
  fecha: string;
  folio: string;
  contratoId: string;
  contenedor?: string | null;
  naviera?: string | null;
  monto?: number | null;
  estimada?: boolean; // solo eta-bodega
};

const EVENTO_META: Record<TipoEvento, { label: string; color: string }> = {
  'eta-puerto': { label: 'ETA puerto', color: 'var(--blue-500)' },
  'eta-bodega': { label: 'ETA bodega', color: 'var(--violet-500)' },
  recepcion: { label: 'Recepción', color: 'var(--green-500)' },
  anticipo: { label: 'Pago anticipo', color: 'var(--red-500)' },
  saldo: { label: 'Pago saldo', color: 'var(--red-500)' },
};

const colorEvento = (e: CalEvento) =>
  e.tipo === 'eta-bodega' && e.estimada ? 'var(--amber-500)' : EVENTO_META[e.tipo].color;

const folioCorto = (f: string) => f.split('-').pop() ?? f;

// Exportar un evento como archivo .ics (Google Calendar / Outlook / Apple).
function downloadICS(e: CalEvento) {
  const dt = e.fecha.replace(/-/g, '');
  const meta = EVENTO_META[e.tipo];
  const desc = [
    e.contenedor ? `Contenedor: ${e.contenedor}` : null,
    e.naviera ? `Naviera: ${e.naviera}` : null,
    e.monto ? `Monto: ${fmtUSD(e.monto)} USD` : null,
  ]
    .filter(Boolean)
    .join('\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grupo Lizarraga//CRM//ES',
    'BEGIN:VEVENT',
    `UID:${e.contratoId}-${e.tipo}-${dt}@crm-pml`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dt}`,
    `SUMMARY:${meta.label} — ${e.folio}`,
    desc ? `DESCRIPTION:${desc}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${e.folio}-${e.tipo}.ics`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Página ─────────────────────────────────────────────────────────── */

type Vista = 'calendario' | 'lista';

export function BlufinCalendarioPage() {
  const { empresaId } = useAuth();
  const [vista, setVista] = useState<Vista>('calendario');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const hoy = hoyISO();
  const [mesAncla, setMesAncla] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ['blufin_contratos', empresaId],
    queryFn: () => fetchContratos(empresaId),
  });
  const { data: recepciones = [] } = useQuery({
    queryKey: ['blufin_recepciones', empresaId],
    queryFn: () => fetchRecepciones(empresaId),
  });

  const eventos = useMemo<CalEvento[]>(() => {
    const out: CalEvento[] = [];
    const recibidoIds = new Set(
      recepciones.map((r) => r.contrato_id).filter((id): id is string => !!id),
    );
    for (const c of contratos) {
      const recibido = recibidoIds.has(c.id) || c.status === 'Entregado' || !!c.llegada_real;
      if (!recibido) {
        if (c.eta_puerto)
          out.push({
            tipo: 'eta-puerto',
            fecha: c.eta_puerto,
            folio: c.folio,
            contratoId: c.id,
            contenedor: c.contenedor,
            naviera: c.naviera,
          });
        if (c.eta_bodega)
          out.push({
            tipo: 'eta-bodega',
            fecha: c.eta_bodega,
            folio: c.folio,
            contratoId: c.id,
            contenedor: c.contenedor,
            naviera: c.naviera,
            estimada: !!c.eta_puerto && etaBodegaAuto(c.eta_puerto) === c.eta_bodega,
          });
      }
      if (c.anticipo_fecha && !c.anticipo_pagado)
        out.push({
          tipo: 'anticipo',
          fecha: c.anticipo_fecha,
          folio: c.folio,
          contratoId: c.id,
          monto: c.anticipo_usd,
        });
      if (c.saldo_fecha && !c.saldo_pagado)
        out.push({
          tipo: 'saldo',
          fecha: c.saldo_fecha,
          folio: c.folio,
          contratoId: c.id,
          monto: c.saldo_usd,
        });
    }
    for (const r of recepciones) {
      if (r.fecha_recepcion)
        out.push({
          tipo: 'recepcion',
          fecha: r.fecha_recepcion,
          folio: r.contrato?.folio ?? '—',
          contratoId: r.contrato_id ?? '',
        });
    }
    return out;
  }, [contratos, recepciones]);

  const stats = useMemo(() => {
    const finSemana = addDiasISO(hoy, 7);
    let enTransito = 0;
    let enPuerto = 0;
    for (const c of contratos) {
      const s = statusContrato(c, hoy);
      if (s === 'En tránsito') enTransito++;
      else if (s === 'En puerto') enPuerto++;
    }
    const esEta = (e: CalEvento) => e.tipo === 'eta-puerto' || e.tipo === 'eta-bodega';
    const esPago = (e: CalEvento) => e.tipo === 'anticipo' || e.tipo === 'saldo';
    const etasSemana = eventos.filter((e) => esEta(e) && e.fecha >= hoy && e.fecha <= finSemana).length;
    const pagosSemana = eventos.filter((e) => esPago(e) && e.fecha >= hoy && e.fecha <= finSemana);
    const pagosAtras = eventos.filter((e) => esPago(e) && e.fecha < hoy);
    const sumaSemana = pagosSemana.reduce((s, e) => s + (e.monto ?? 0), 0);
    return {
      enTransito,
      enPuerto,
      etasSemana,
      pagosSemanaN: pagosSemana.length,
      sumaSemana,
      pagosAtrasN: pagosAtras.length,
    };
  }, [contratos, eventos, hoy]);

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Calendario
        </h2>
        <p className="page-subtitle">
          Llegadas a puerto y bodega, recepciones y vencimientos de pago en un solo lugar
        </p>
      </PageEnter>

      <StatStrip
        stats={[
          { value: stats.enTransito, label: 'en tránsito' },
          { value: stats.enPuerto, label: 'en puerto' },
          { value: stats.etasSemana, label: 'ETAs esta semana', color: 'var(--blue-500)' },
          {
            value: stats.pagosSemanaN,
            label: `pagos esta semana · ${fmtUSD(stats.sumaSemana)}`,
            color: 'var(--amber-500)',
          },
          {
            value: stats.pagosAtrasN,
            label: 'pagos atrasados',
            color: stats.pagosAtrasN > 0 ? 'var(--red-500)' : undefined,
          },
        ]}
      />

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'calendario', label: 'Calendario', icon: 'calendar' },
            { id: 'lista', label: 'Lista', icon: 'file-text' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={`tab ${vista === t.id ? 'active' : ''}`}
            onClick={() => setVista(t.id as Vista)}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {vista === 'calendario' ? (
        <CalendarioGrid
          eventos={eventos}
          mesAncla={mesAncla}
          hoy={hoy}
          onMes={setMesAncla}
          onVer={setDetalleId}
        />
      ) : (
        <ListaView eventos={eventos} hoy={hoy} onVer={setDetalleId} />
      )}

      <ContratoDetalleModal contratoId={detalleId} onClose={() => setDetalleId(null)} />
    </>
  );
}

/* ─── Leyenda de colores (compartida) ────────────────────────────────── */

function Leyenda() {
  const items: { color: string; label: string }[] = [
    { color: 'var(--blue-500)', label: 'ETA puerto' },
    { color: 'var(--violet-500)', label: 'ETA bodega' },
    { color: 'var(--amber-500)', label: 'ETA estimada (+7d)' },
    { color: 'var(--green-500)', label: 'Recibido' },
    { color: 'var(--red-500)', label: 'Pago pendiente' },
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

/* ─── Vista calendario (grid mensual) ────────────────────────────────── */

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

  // 42 celdas: arranca el lunes de la semana del día 1, 6 semanas.
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
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onMes(new Date(mesAncla.getFullYear(), mesAncla.getMonth() - 1, 1))}
            aria-label="Mes anterior"
            style={{ padding: 6 }}
          >
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
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onMes(new Date(mesAncla.getFullYear(), mesAncla.getMonth() + 1, 1))}
            aria-label="Mes siguiente"
            style={{ padding: 6 }}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--ink-100)',
        }}
      >
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            style={{
              padding: '6px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--ink-500)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              textAlign: 'center',
            }}
          >
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
                      onClick={() => e.contratoId && onVer(e.contratoId)}
                      title={`${EVENTO_META[e.tipo].label} · ${e.folio}`}
                      className="mono"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 5px',
                        borderRadius: 5,
                        border: 'none',
                        cursor: 'pointer',
                        background: `color-mix(in srgb, ${color} 12%, white)`,
                        color,
                        fontSize: 10,
                        fontWeight: 700,
                        width: '100%',
                        textAlign: 'left',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      {folioCorto(e.folio)}
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

/* ─── Vista lista (agrupada por semana) ──────────────────────────────── */

function ListaView({
  eventos,
  hoy,
  onVer,
}: {
  eventos: CalEvento[];
  hoy: string;
  onVer: (id: string) => void;
}) {
  const [verPasados, setVerPasados] = useState(false);
  const [q, setQ] = useState('');

  const grupos = useMemo(() => {
    const desde = lunesDeISO(hoy);
    const query = q.trim().toLowerCase();
    const filtrados = eventos.filter((e) => {
      if (!verPasados && e.fecha < desde) return false;
      if (!query) return true;
      return (
        e.folio.toLowerCase().includes(query) ||
        (e.contenedor ?? '').toLowerCase().includes(query) ||
        (e.naviera ?? '').toLowerCase().includes(query)
      );
    });
    filtrados.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo));
    const map = new Map<string, CalEvento[]>();
    for (const e of filtrados) {
      const k = lunesDeISO(e.fecha);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([semana, items]) => ({ semana, items }));
  }, [eventos, hoy, verPasados, q]);

  const semanaActual = lunesDeISO(hoy);

  return (
    <div className="vstack" style={{ gap: 14 }}>
      <div className="hstack" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div
          className="hstack"
          style={{
            flex: 1,
            minWidth: 220,
            gap: 8,
            padding: '7px 12px',
            background: 'var(--ink-50)',
            border: '1px solid var(--ink-200)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <Icon name="search" size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por folio, contenedor o naviera…"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              flex: 1,
              fontSize: 13,
              color: 'var(--ink-900)',
            }}
          />
        </div>
        <label className="hstack text-xs" style={{ gap: 6, cursor: 'pointer', color: 'var(--ink-600)' }}>
          <input type="checkbox" checked={verPasados} onChange={(e) => setVerPasados(e.target.checked)} />
          Ver eventos pasados
        </label>
        <Leyenda />
      </div>

      {grupos.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Icon name="calendar" size={28} />
          <div className="fw-700" style={{ marginTop: 8 }}>
            Sin eventos {verPasados ? '' : 'próximos'}
          </div>
          <div className="text-sm muted" style={{ marginTop: 2 }}>
            {q
              ? 'Ningún evento coincide con la búsqueda.'
              : verPasados
                ? 'No hay ETAs, recepciones ni pagos registrados.'
                : 'No hay ETAs ni vencimientos de pago próximos. Activa “Ver eventos pasados” para ver el historial.'}
          </div>
        </div>
      ) : (
        grupos.map((g) => (
          <div key={g.semana} className="card" style={{ overflow: 'hidden' }}>
            <div
              className="hstack"
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--ink-100)',
                gap: 8,
                background: g.semana === semanaActual ? 'color-mix(in srgb, var(--blue-500) 6%, white)' : undefined,
              }}
            >
              <span className="fw-700" style={{ fontSize: 13 }}>
                Semana del {fmtFechaCorta(g.semana)}
              </span>
              {g.semana === semanaActual && (
                <span
                  className="text-xs fw-700"
                  style={{
                    color: 'var(--blue-500)',
                    background: 'color-mix(in srgb, var(--blue-500) 12%, white)',
                    padding: '1px 8px',
                    borderRadius: 999,
                  }}
                >
                  Esta semana
                </span>
              )}
              <span className="text-xs muted">
                · {g.items.length} evento{g.items.length !== 1 ? 's' : ''}
              </span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Folio</th>
                  <th>Contenedor</th>
                  <th>Naviera</th>
                  <th style={{ textAlign: 'right' }}>Monto USD</th>
                  <th style={{ textAlign: 'center' }}>.ics</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((e, i) => {
                  const color = colorEvento(e);
                  const atrasado =
                    (e.tipo === 'anticipo' || e.tipo === 'saldo') && e.fecha < hoy;
                  return (
                    <tr
                      key={i}
                      style={{ cursor: e.contratoId ? 'pointer' : 'default' }}
                      onClick={() => e.contratoId && onVer(e.contratoId)}
                    >
                      <td className="mono text-sm" style={{ color: atrasado ? 'var(--red-500)' : undefined }}>
                        {fmtFechaCorta(e.fecha)}
                      </td>
                      <td>
                        <span
                          className="hstack"
                          style={{
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            color,
                            background: `color-mix(in srgb, ${color} 12%, white)`,
                            padding: '2px 8px',
                            borderRadius: 999,
                            width: 'fit-content',
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
                          {e.tipo === 'eta-bodega' && e.estimada
                            ? 'ETA bodega (est.)'
                            : EVENTO_META[e.tipo].label}
                        </span>
                      </td>
                      <td className="mono fw-700 text-sm">{e.folio}</td>
                      <td className="mono text-xs">{e.contenedor || <span className="muted">—</span>}</td>
                      <td className="text-sm">{e.naviera || <span className="muted">—</span>}</td>
                      <td className="mono text-sm" style={{ textAlign: 'right' }}>
                        {e.monto != null ? fmtUSD(e.monto) : <span className="muted">—</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: 4 }}
                          title="Guardar en mi calendario (.ics)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            downloadICS(e);
                          }}
                        >
                          <Icon name="download" size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
