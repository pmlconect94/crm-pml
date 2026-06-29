import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtKg, fmtFechaCorta } from '@/lib/format';
import { fetchContratos } from '@/features/blufin/queries';
import { fetchRecepciones } from '@/features/blufin/recepcion-queries';
import { statusContrato } from '@/features/blufin/status';
import { StatusPill } from '@/features/blufin/StatusPill';
import { SkusContratoModal } from '@/features/blufin/SkusContratoModal';
import { fetchSkusBlufin } from '@/features/blufin/productos-queries';
import { exportLlegadasPorSku } from '@/features/blufin/blufin-export';
import type { BlufinContratoConProductos, BlufinRecepcionEnriquecida, CatalogoSku } from '@/types/database';

/* ─── Helpers de fecha (hora local, YYYY-MM-DD) ──────────────────────── */

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

/* ─── Eventos del calendario (SOLO llegadas) ─────────────────────────── */

type TipoEvento = 'eta-puerto' | 'eta-bodega' | 'recepcion';

type CalEvento = {
  tipo: TipoEvento;
  fecha: string;
  folio: string;
  estimada?: boolean; // solo eta-bodega
};

const EVENTO_META: Record<TipoEvento, { label: string; color: string }> = {
  'eta-puerto': { label: 'ETA puerto', color: 'var(--blue-500)' },
  'eta-bodega': { label: 'ETA bodega', color: 'var(--violet-500)' },
  recepcion: { label: 'Recibido', color: 'var(--green-500)' },
};

const colorEvento = (e: CalEvento) =>
  e.tipo === 'eta-bodega' && e.estimada ? 'var(--amber-500)' : EVENTO_META[e.tipo].color;

const folioCorto = (f: string) => f.split('-').pop() ?? f;

/* ─── Página ─────────────────────────────────────────────────────────── */

type Vista = 'producto' | 'calendario';

export function BlufinCalendarioPage() {
  const { empresaId } = useAuth();
  const [vista, setVista] = useState<Vista>('producto');
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
  const { data: skus = [] } = useQuery({
    queryKey: ['blufin_catalogo_skus', empresaId],
    queryFn: () => fetchSkusBlufin(empresaId),
  });

  // Solo eventos de LLEGADA: ETA puerto, ETA bodega y recepciones. Sin pagos.
  const eventos = useMemo<CalEvento[]>(() => {
    const out: CalEvento[] = [];
    const recibidoIds = new Set(
      recepciones.map((r) => r.contrato_id).filter((id): id is string => !!id),
    );
    for (const c of contratos) {
      const recibido = recibidoIds.has(c.id) || c.status === 'Entregado' || !!c.llegada_real;
      if (recibido) continue;
      if (c.eta_puerto) out.push({ tipo: 'eta-puerto', fecha: c.eta_puerto, folio: c.folio });
      if (c.eta_bodega)
        out.push({
          tipo: 'eta-bodega',
          fecha: c.eta_bodega,
          folio: c.folio,
          estimada: !c.eta_bodega_confirmada,
        });
    }
    for (const r of recepciones) {
      if (r.fecha_recepcion)
        out.push({ tipo: 'recepcion', fecha: r.fecha_recepcion, folio: r.contrato?.folio ?? '—' });
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
    const etasSemana = eventos.filter(
      (e) => e.tipo !== 'recepcion' && e.fecha >= hoy && e.fecha <= finSemana,
    ).length;
    return { enTransito, enPuerto, etasSemana };
  }, [contratos, eventos, hoy]);

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Llegadas
        </h2>
        <p className="page-subtitle">
          Mercancía por llegar por producto y calendario de arribos a puerto y bodega
        </p>
      </PageEnter>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'producto', label: 'Por producto', icon: 'search' },
            { id: 'calendario', label: 'Calendario', icon: 'calendar' },
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

      {vista === 'producto' ? (
        <PorProductoView contratos={contratos} recepciones={recepciones} hoy={hoy} skus={skus} />
      ) : (
        <>
          <StatStrip
            stats={[
              { value: stats.enTransito, label: 'en tránsito' },
              { value: stats.enPuerto, label: 'en puerto' },
              { value: stats.etasSemana, label: 'ETAs esta semana', color: 'var(--blue-500)' },
            ]}
          />
          <CalendarioGrid eventos={eventos} mesAncla={mesAncla} hoy={hoy} onMes={setMesAncla} />
        </>
      )}
    </>
  );
}

/* ─── Por producto — mercancía por llegar (agrupada por SKU) ──────────── */

type ItemContenedor = {
  folio: string;
  contratoId: string;
  status: ReturnType<typeof statusContrato>;
  contenedor: string | null;
  naviera: string | null;
  etaBodega: string | null;
  etaEstimada: boolean;
  kg: number;
  cajas: number | null;
};

type GrupoSku = {
  key: string;
  descripcion: string;
  talla: string | null;
  totalKg: number;
  items: ItemContenedor[];
};

function PorProductoView({
  contratos,
  recepciones,
  hoy,
  skus,
}: {
  contratos: BlufinContratoConProductos[];
  recepciones: BlufinRecepcionEnriquecida[];
  hoy: string;
  skus: CatalogoSku[];
}) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<Set<string>>(new Set());
  const [verSkus, setVerSkus] = useState<string | null>(null);

  // Para el reporte Excel línea-por-SKU: resolver el código del catálogo y la
  // lista de contratos POR LLEGAR (no recibidos), igual criterio que los grupos.
  const codeDeSku = useMemo(() => {
    const m = new Map(skus.map((s) => [s.id, s.code]));
    return (id: string | null) => (id ? m.get(id) ?? '' : '');
  }, [skus]);
  const porLlegar = useMemo(() => {
    const recibidoIds = new Set(
      recepciones.map((r) => r.contrato_id).filter((id): id is string => !!id),
    );
    return contratos.filter(
      (c) => !(recibidoIds.has(c.id) || c.status === 'Entregado' || !!c.llegada_real),
    );
  }, [contratos, recepciones]);

  // Agrupa por SKU sumando lo que viene en contratos NO recibidos.
  const grupos = useMemo<GrupoSku[]>(() => {
    const recibidoIds = new Set(
      recepciones.map((r) => r.contrato_id).filter((id): id is string => !!id),
    );
    const map = new Map<string, GrupoSku>();
    for (const c of contratos) {
      const recibido = recibidoIds.has(c.id) || c.status === 'Entregado' || !!c.llegada_real;
      if (recibido) continue;
      const etaEstimada = !!c.eta_bodega && !c.eta_bodega_confirmada;
      for (const p of c.productos ?? []) {
        const key = p.sku_id ?? p.descripcion ?? 'sin-sku';
        let g = map.get(key);
        if (!g) {
          g = { key, descripcion: p.descripcion ?? '—', talla: p.talla ?? null, totalKg: 0, items: [] };
          map.set(key, g);
        }
        g.totalKg += Number(p.kg ?? 0);
        g.items.push({
          folio: c.folio,
          contratoId: c.id,
          status: statusContrato(c, hoy),
          contenedor: c.contenedor,
          naviera: c.naviera,
          etaBodega: c.eta_bodega,
          etaEstimada,
          kg: Number(p.kg ?? 0),
          cajas: p.cajas ?? null,
        });
      }
    }
    const arr = Array.from(map.values());
    // Contenedores de cada SKU: del más PRÓXIMO al más viejo (ETA asc, sin fecha al final).
    for (const g of arr)
      g.items.sort((a, b) => {
        if (!a.etaBodega) return 1;
        if (!b.etaBodega) return -1;
        return a.etaBodega.localeCompare(b.etaBodega);
      });
    // Productos: el que trae más kg primero.
    arr.sort((a, b) => b.totalKg - a.totalKg);
    return arr;
  }, [contratos, recepciones, hoy]);

  const filtrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return grupos;
    return grupos.filter(
      (g) =>
        g.descripcion.toLowerCase().includes(query) ||
        (g.talla ?? '').toLowerCase().includes(query) ||
        g.items.some(
          (it) =>
            (it.contenedor ?? '').toLowerCase().includes(query) ||
            it.folio.toLowerCase().includes(query),
        ),
    );
  }, [grupos, q]);

  const resumen = useMemo(() => {
    const totalKg = filtrados.reduce((s, g) => s + g.totalKg, 0);
    const nCont = filtrados.reduce((s, g) => s + g.items.length, 0);
    return { nSku: filtrados.length, totalKg, nCont };
  }, [filtrados]);

  const toggle = (key: string) =>
    setAbierto((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <div className="hstack" style={{ gap: 8 }}>
      <div
        className="hstack"
        style={{
          flex: 1,
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
          placeholder="Busca un producto (Tilapia, Basa, Camarón…), folio o contenedor"
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            flex: 1,
            fontSize: 13,
            color: 'var(--ink-900)',
          }}
        />
        {q && (
          <button onClick={() => setQ('')} className="btn btn-ghost btn-sm" style={{ padding: 4 }} aria-label="Limpiar">
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => exportLlegadasPorSku(porLlegar, codeDeSku)}
          disabled={porLlegar.length === 0}
          title="Descargar Excel: una fila por SKU de la mercancía por llegar"
          style={{ flexShrink: 0 }}
        >
          <Icon name="download" size={13} /> Exportar
        </button>
      </div>

      <StatStrip
        stats={[
          { value: resumen.nSku, label: q ? 'productos (filtro)' : 'productos por llegar' },
          { value: resumen.nCont, label: 'contenedores' },
          { value: fmtKg(resumen.totalKg), label: 'en camino', color: 'var(--blue-500)' },
        ]}
        style={{ marginBottom: 0 }}
      />

      {filtrados.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Icon name="package" size={28} />
          <div className="fw-700" style={{ marginTop: 8 }}>
            Sin mercancía por llegar
          </div>
          <div className="text-sm muted" style={{ marginTop: 2 }}>
            {q
              ? 'Ningún producto por llegar coincide con la búsqueda.'
              : 'No hay contenedores pendientes de recibir.'}
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ textAlign: 'right' }}>Contenedores</th>
                <th style={{ textAlign: 'right' }}>Total kg</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((g) => {
                const open = abierto.has(g.key);
                return (
                  <Fragment key={g.key}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggle(g.key)}>
                      <td className="text-sm fw-600">
                        {g.descripcion}
                        {g.talla ? <span className="muted"> · {g.talla}</span> : null}
                      </td>
                      <td className="mono fw-700 text-sm" style={{ textAlign: 'right' }}>{g.items.length}</td>
                      <td className="mono fw-700 text-sm" style={{ textAlign: 'right' }}>{fmtKg(g.totalKg)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Icon name="chevron-right" size={13} className={`nav-chevron ${open ? 'open' : ''}`} />
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={4} style={{ padding: 0, background: 'var(--ink-50)' }}>
                          <table className="tbl" style={{ background: 'transparent' }}>
                            <thead>
                              <tr>
                                <th>Llega</th>
                                <th>Contenedor</th>
                                <th>Contrato</th>
                                <th style={{ textAlign: 'right' }}>Kg</th>
                                <th style={{ textAlign: 'right' }}>Cajas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.items.map((it, i) => (
                                <tr key={i}>
                                  <td className="mono text-sm">
                                    {it.etaBodega ? (
                                      <>
                                        {fmtFechaCorta(it.etaBodega)}
                                        {it.etaEstimada && (
                                          <span className="text-xs" style={{ color: 'var(--amber-500)' }}> est.</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="muted">sin ETA</span>
                                    )}
                                  </td>
                                  <td className="mono text-xs">
                                    {[it.contenedor, it.naviera].filter(Boolean).join(' · ') || (
                                      <span className="muted">por asignar</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className="hstack" style={{ gap: 6 }}>
                                      <button
                                        onClick={() => setVerSkus(it.contratoId)}
                                        className="mono fw-700 text-xs"
                                        title="Ver los productos de este contenedor"
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          padding: 0,
                                          cursor: 'pointer',
                                          color: 'var(--blue-500)',
                                        }}
                                      >
                                        {it.folio}
                                      </button>
                                      <StatusPill status={it.status} />
                                    </span>
                                  </td>
                                  <td className="mono fw-700 text-sm" style={{ textAlign: 'right' }}>{fmtKg(it.kg)}</td>
                                  <td className="mono text-sm" style={{ textAlign: 'right' }}>{it.cajas ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SkusContratoModal
        contrato={contratos.find((c) => c.id === verSkus) ?? null}
        onClose={() => setVerSkus(null)}
      />
    </div>
  );
}

/* ─── Leyenda de colores ─────────────────────────────────────────────── */

function Leyenda() {
  const items: { color: string; label: string }[] = [
    { color: 'var(--blue-500)', label: 'ETA puerto' },
    { color: 'var(--violet-500)', label: 'ETA bodega' },
    { color: 'var(--amber-500)', label: 'ETA estimada (+7d)' },
    { color: 'var(--green-500)', label: 'Recibido' },
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

/* ─── Vista calendario (grid mensual de llegadas) ────────────────────── */

function CalendarioGrid({
  eventos,
  mesAncla,
  hoy,
  onMes,
}: {
  eventos: CalEvento[];
  mesAncla: Date;
  hoy: string;
  onMes: (d: Date) => void;
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
                    <span
                      key={ci}
                      title={`${EVENTO_META[e.tipo].label} · ${e.folio}`}
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
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0 }} />
                      {folioCorto(e.folio)}
                    </span>
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
