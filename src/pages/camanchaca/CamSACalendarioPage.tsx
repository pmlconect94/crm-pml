import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtKg, fmtFechaCorta, diasDesde } from '@/lib/format';
import { fetchContenedoresSA } from '@/features/camanchaca/sa-queries';
import { fetchRecepcionesSA } from '@/features/camanchaca/sa-recepcion-queries';
import { statusContenedorSA } from '@/features/camanchaca/sa-status';
import type { CamContenedorSAConProductos, CamRecepcionSAEnriquecida } from '@/types/database';

type View = 'producto' | 'calendario';

export function CamSACalendarioPage() {
  const { empresaId } = useAuth();
  const [view, setView] = useState<View>('producto');

  const { data: contenedores = [], isLoading } = useQuery({
    queryKey: ['cam_sa_contenedores', empresaId],
    queryFn: () => fetchContenedoresSA(empresaId),
  });
  const { data: recepciones = [] } = useQuery({
    queryKey: ['cam_sa_recepciones', empresaId],
    queryFn: () => fetchRecepcionesSA(empresaId),
  });

  // Solo contenedores NO recibidos (mercancía por llegar)
  const porLlegar = useMemo(
    () => contenedores.filter((c) => !c.llegada_real && c.status !== 'Entregado'),
    [contenedores],
  );

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Llegadas</h2>
        <p className="page-subtitle">Mercancía por llegar de Camanchaca SA, para ventas y planeación</p>
      </PageEnter>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'producto', label: 'Por producto', icon: 'package' },
            { id: 'calendario', label: 'Calendario', icon: 'calendar' },
          ] as const
        ).map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {view === 'producto' && <PorProductoView porLlegar={porLlegar} isLoading={isLoading} />}
      {view === 'calendario' && <CalendarioGrid contenedores={contenedores} recepciones={recepciones} />}
    </>
  );
}

/* ─── Por producto (vista de ventas) ──────────────────────────────── */

type SkuGroup = {
  sku_id: string;
  descripcion: string;
  talla: string | null;
  totalKg: number;
  contenedores: {
    folio: string;
    contenedorId: string;
    status: string;
    eta: string | null;
    etaEstimada: boolean;
    kg: number;
    cajas: number | null;
  }[];
};

function PorProductoView({
  porLlegar,
  isLoading,
}: {
  porLlegar: CamContenedorSAConProductos[];
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grupos = useMemo(() => {
    const map = new Map<string, SkuGroup>();
    for (const c of porLlegar) {
      for (const p of c.productos ?? []) {
        const key = p.sku_id ?? p.descripcion ?? 'sin-sku';
        let g = map.get(key);
        if (!g) {
          g = {
            sku_id: key,
            descripcion: p.descripcion ?? '—',
            talla: p.talla ?? null,
            totalKg: 0,
            contenedores: [],
          };
          map.set(key, g);
        }
        const kg = Number(p.kg ?? 0);
        g.totalKg += kg;
        g.contenedores.push({
          folio: c.folio_interno,
          contenedorId: c.id,
          status: statusContenedorSA(c),
          eta: c.eta_bodega,
          etaEstimada: !!c.eta_bodega && !c.eta_bodega_confirmada,
          kg,
          cajas: p.cajas ?? null,
        });
      }
    }
    for (const g of map.values()) {
      g.contenedores.sort((a, b) => (a.eta ?? '9999').localeCompare(b.eta ?? '9999'));
    }
    return Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg);
  }, [porLlegar]);

  const filtrados = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return grupos;
    return grupos.filter(
      (g) =>
        g.descripcion.toLowerCase().includes(s) ||
        (g.talla ?? '').toLowerCase().includes(s) ||
        g.contenedores.some((c) => c.folio.toLowerCase().includes(s)),
    );
  }, [grupos, search]);

  const totales = useMemo(() => {
    const productos = grupos.length;
    const contenedores = new Set(grupos.flatMap((g) => g.contenedores.map((c) => c.folio))).size;
    const kg = grupos.reduce((s, g) => s + g.totalKg, 0);
    return { productos, contenedores, kg };
  }, [grupos]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
        <div className="skeleton-bar" style={{ width: '70%' }} />
      </div>
    );
  }

  return (
    <>
      <StatStrip
        stats={[
          { value: totales.productos, label: 'productos' },
          { value: totales.contenedores, label: 'contenedores' },
          { value: fmtKg(totales.kg), label: 'kg en camino' },
        ]}
      />

      <div
        className="hstack"
        style={{ gap: 8, padding: '7px 12px', marginBottom: 10, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)' }}
      >
        <Icon name="search" size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto, talla o folio…"
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13, color: 'var(--ink-900)' }}
        />
      </div>

      <div className="card">
        {filtrados.length === 0 ? (
          <div className="empty">
            <Icon name="package" size={36} />
            <div className="empty-title">Sin mercancía por llegar</div>
            <p className="muted">Cuando haya contenedores en camino, aquí verás el resumen por producto.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 26 }}></th>
                <th>Producto</th>
                <th style={{ textAlign: 'right' }}>Total kg</th>
                <th style={{ textAlign: 'right' }}>Contenedores</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((g) => {
                const isExp = expanded.has(g.sku_id);
                return (
                  <FragmentRow key={g.sku_id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggle(g.sku_id)}>
                      <td className="muted" style={{ textAlign: 'center' }}>
                        <Icon name={isExp ? 'chevron-down' : 'chevron-right'} size={13} />
                      </td>
                      <td className="text-sm fw-600">
                        {g.descripcion}
                        {g.talla ? <span className="muted"> · {g.talla}</span> : null}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtKg(g.totalKg)}</td>
                      <td style={{ textAlign: 'right' }} className="mono fw-600">{g.contenedores.length}</td>
                    </tr>
                    {isExp && (
                      <tr>
                        <td colSpan={4} style={{ padding: 0, background: 'var(--ink-50)' }}>
                          <table className="tbl" style={{ margin: 0 }}>
                            <thead>
                              <tr>
                                <th>Contenedor</th>
                                <th>Status</th>
                                <th>Cuándo llega</th>
                                <th style={{ textAlign: 'right' }}>Kg</th>
                                <th style={{ textAlign: 'right' }}>Cajas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.contenedores.map((c, i) => {
                                const dias = diasDesde(c.eta);
                                return (
                                  <tr key={i}>
                                    <td className="mono text-sm fw-600">{c.folio}</td>
                                    <td className="text-sm">{c.status}</td>
                                    <td className="text-sm">
                                      {c.eta ? (
                                        <>
                                          {fmtFechaCorta(c.eta)}
                                          {c.etaEstimada && <span className="text-xs muted"> est.</span>}
                                          {dias !== null && dias >= 0 && (
                                            <span className="text-xs muted"> · en {dias}d</span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="muted">Por definir</span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right' }} className="mono">{fmtKg(c.kg)}</td>
                                    <td style={{ textAlign: 'right' }} className="mono">{c.cajas ?? '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ─── Calendario (solo llegadas) ──────────────────────────────────── */

type Evento = { tipo: 'manzanillo' | 'bodega' | 'recibido'; folio: string; estimada?: boolean };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function CalendarioGrid({
  contenedores,
  recepciones,
}: {
  contenedores: CamContenedorSAConProductos[];
  recepciones: CamRecepcionSAEnriquecida[];
}) {
  const hoy = new Date();
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  const recibidos = useMemo(() => new Set(recepciones.map((r) => r.contenedor_id)), [recepciones]);

  const eventos = useMemo(() => {
    const map = new Map<string, Evento[]>();
    const add = (fecha: string | null | undefined, ev: Evento) => {
      if (!fecha) return;
      const arr = map.get(fecha) ?? [];
      arr.push(ev);
      map.set(fecha, arr);
    };
    recepciones.forEach((r) => add(r.fecha, { tipo: 'recibido', folio: r.contenedor?.folio_interno ?? '—' }));
    for (const c of contenedores) {
      if (recibidos.has(c.id) || c.status === 'Entregado') continue;
      add(c.eta_manzanillo, { tipo: 'manzanillo', folio: c.folio_interno });
      add(c.eta_bodega, { tipo: 'bodega', folio: c.folio_interno, estimada: !c.eta_bodega_confirmada });
    }
    return map;
  }, [contenedores, recepciones, recibidos]);

  const stats = useMemo(() => {
    const enTransito = contenedores.filter((c) => statusContenedorSA(c) === 'En tránsito').length;
    const enManzanillo = contenedores.filter((c) => statusContenedorSA(c) === 'En Manzanillo').length;
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    const etasSemana = contenedores.filter((c) => {
      if (recibidos.has(c.id)) return false;
      const f = c.eta_bodega ?? c.eta_manzanillo;
      if (!f) return false;
      const d = new Date(f + 'T12:00:00');
      return d >= inicioSemana && d <= finSemana;
    }).length;
    return { enTransito, enManzanillo, etasSemana };
  }, [contenedores, recibidos, hoy]);

  const celdas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const offsetLunes = (primero.getDay() + 6) % 7;
    const inicio = new Date(primero);
    inicio.setDate(primero.getDate() - offsetLunes);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [mes]);

  const hoyISO = isoDe(hoy);

  return (
    <>
      <StatStrip
        stats={[
          { value: stats.enTransito, label: 'en tránsito', color: 'var(--amber-500)' },
          { value: stats.enManzanillo, label: 'en Manzanillo', color: 'var(--violet-500)' },
          { value: stats.etasSemana, label: 'ETAs esta semana' },
        ]}
      />
      <div className="card">
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--ink-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="hstack" style={{ gap: 8 }}>
            <span className="fw-700" style={{ fontSize: 14 }}>{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
            <span className="hstack text-xs muted" style={{ gap: 10, marginLeft: 8, flexWrap: 'wrap' }}>
              <span className="hstack" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--blue-500)' }} /> ETA Manzanillo
              </span>
              <span className="hstack" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--violet-500)' }} /> ETA bodega
              </span>
              <span className="hstack" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--green-500)' }} /> Recibido
              </span>
            </span>
          </div>
          <div className="hstack" style={{ gap: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} aria-label="Mes anterior" style={{ padding: 6 }}>
              <Icon name="chevron-left" size={14} />
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1))}>Hoy</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} aria-label="Mes siguiente" style={{ padding: 6 }}>
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
            const delMes = d.getMonth() === mes.getMonth();
            const esHoy = iso === hoyISO;
            const evs = eventos.get(iso) ?? [];
            return (
              <div
                key={i}
                style={{
                  minHeight: 72,
                  padding: 6,
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--ink-100)' : 'none',
                  borderBottom: i < 35 ? '1px solid var(--ink-100)' : 'none',
                  background: delMes ? 'white' : 'var(--ink-50)',
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: esHoy ? 700 : 500,
                    color: esHoy ? 'white' : delMes ? 'var(--ink-700)' : 'var(--ink-400)',
                    background: esHoy ? 'var(--blue-500)' : 'transparent',
                    borderRadius: 999,
                    width: 20,
                    height: 20,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 4,
                  }}
                >
                  {d.getDate()}
                </div>
                <div className="vstack" style={{ gap: 2 }}>
                  {evs.map((ev, j) => {
                    const estilo =
                      ev.tipo === 'recibido'
                        ? { bg: 'color-mix(in srgb, var(--green-500) 12%, white)', fg: '#065F46', t: 'Recibido' }
                        : ev.tipo === 'manzanillo'
                          ? { bg: 'color-mix(in srgb, var(--blue-500) 12%, white)', fg: '#1E40AF', t: 'ETA Manzanillo' }
                          : { bg: `color-mix(in srgb, var(--violet-500) ${ev.estimada ? 12 : 18}%, white)`, fg: '#5B21B6', t: ev.estimada ? 'ETA bodega estimada' : 'ETA bodega oficial' };
                    return (
                      <div
                        key={j}
                        className="mono"
                        title={`${ev.folio} · ${estilo.t}`}
                        style={{
                          fontSize: 9.5,
                          fontWeight: 600,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: estilo.bg,
                          color: estilo.fg,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ev.folio}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
