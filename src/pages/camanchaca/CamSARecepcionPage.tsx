import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter, SPRING } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { CamSAStatusPill } from '@/features/camanchaca/CamSAStatusPill';
import { statusContenedorSA } from '@/features/camanchaca/sa-status';
import { SkusContratoModal } from '@/features/blufin/SkusContratoModal';
import { useAuth } from '@/lib/auth';
import { fmtKg, fmtFechaCorta, fmtFecha, diasDesde } from '@/lib/format';
import { fetchCatalogosSA } from '@/features/camanchaca/sa-queries';
import {
  fetchRecepcionesSA,
  fetchContenedoresPorRecibirSA,
  deleteRecepcionSA,
  updateLlegadaContenedorSA,
} from '@/features/camanchaca/sa-recepcion-queries';
import type { CamContenedorSAConProductos, CamRecepcionSAEnriquecida } from '@/types/database';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

type View = 'por-recibir' | 'historial' | 'calendario';
const VENTANA_ADELANTE = 7;

export function CamSARecepcionPage() {
  const { empresaId, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('por-recibir');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
  const [programarTarget, setProgramarTarget] = useState<CamContenedorSAConProductos | null>(null);

  const { data: porRecibir = [], isLoading: loadingPorRecibir } = useQuery({
    queryKey: ['cam_sa_contenedores_por_recibir', empresaId],
    queryFn: () => fetchContenedoresPorRecibirSA(empresaId),
  });
  const { data: recepciones = [], isLoading: loadingRecepciones } = useQuery({
    queryKey: ['cam_sa_recepciones', empresaId],
    queryFn: () => fetchRecepcionesSA(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRecepcionSA(id),
    onSuccess: () => {
      toast.success('Recepción eliminada — el contenedor volvió a "En Manzanillo"');
      qc.invalidateQueries({ queryKey: ['cam_sa_recepciones'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores_por_recibir'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const lineas = recepciones.flatMap((r) => r.lineas ?? []);
    const kgRecibidos = lineas.reduce((s, l) => s + Number(l.kg_recibidos), 0);
    const kgFaltantes = lineas.reduce((s, l) => s + Math.max(0, -Number(l.diferencia ?? 0)), 0);
    const skusConFaltante = lineas.filter((l) => Number(l.diferencia ?? 0) < 0).length;
    return { kgRecibidos, kgFaltantes, skusConFaltante };
  }, [recepciones]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Recepción en bodega
          </h2>
          <p className="page-subtitle">Verificación de kg por SKU y captura de lote del contenedor</p>
        </div>
      </PageEnter>

      <StatStrip
        stats={[
          { value: porRecibir.length, label: 'por recibir', color: porRecibir.length > 0 ? 'var(--amber-500)' : undefined },
          { value: recepciones.length, label: 'recepciones' },
          { value: fmtKg(kpis.kgRecibidos), label: 'recibidos' },
          {
            value: fmtKg(kpis.kgFaltantes),
            label: `faltantes${kpis.skusConFaltante > 0 ? ` · ${kpis.skusConFaltante} SKU${kpis.skusConFaltante !== 1 ? 's' : ''}` : ''}`,
            color: kpis.kgFaltantes > 0 ? 'var(--red-500)' : undefined,
          },
        ]}
      />

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'por-recibir', label: 'Por recibir', icon: 'inbox' },
            { id: 'historial', label: 'Historial', icon: 'check' },
            { id: 'calendario', label: 'Calendario', icon: 'calendar' },
          ] as const
        ).map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>
            <Icon name={t.icon} size={13} />
            {t.label}
            {t.id === 'por-recibir' && porRecibir.length > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  background: 'var(--amber-500)',
                  color: 'white',
                  padding: '0 6px',
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                {porRecibir.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === 'por-recibir' && (
        <PorRecibirView
          contenedores={porRecibir}
          isLoading={loadingPorRecibir}
          capturar={user?.capturar ?? false}
          onReceive={(c) => navigate(`/app/importaciones/camanchaca/sa/recepcion/registrar/${c.id}`)}
          onProgramar={(c) => setProgramarTarget(c)}
        />
      )}
      {view === 'historial' && (
        <HistorialView
          recepciones={recepciones}
          isLoading={loadingRecepciones}
          onDelete={(r) =>
            setDeleteTarget({
              id: r.id,
              description: `${r.contenedor?.folio_interno ?? '—'} · ${fmtFechaCorta(r.fecha)} · ${r.bodega?.nombre ?? 'sin bodega'}`,
            })
          }
        />
      )}
      {view === 'calendario' && <CalendarioView porRecibir={porRecibir} recepciones={recepciones} />}

      <ProgramarLlegadaModal contenedor={programarTarget} onClose={() => setProgramarTarget(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta recepción"
        itemDescription={deleteTarget?.description}
        consequences='Se borran las líneas por SKU y el contenedor regresa a "En Manzanillo", limpiando lote y llegada real.'
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

/* ─── Por recibir ─────────────────────────────────────────────────── */

function PorRecibirView({
  contenedores,
  isLoading,
  capturar,
  onReceive,
  onProgramar,
}: {
  contenedores: CamContenedorSAConProductos[];
  isLoading: boolean;
  capturar: boolean;
  onReceive: (c: CamContenedorSAConProductos) => void;
  onProgramar: (c: CamContenedorSAConProductos) => void;
}) {
  const [verTodos, setVerTodos] = useState(false);
  const [verSkus, setVerSkus] = useState<CamContenedorSAConProductos | null>(null);

  const { visibles, ocultos } = useMemo(() => {
    const enVentana = (c: CamContenedorSAConProductos) => {
      if (!c.eta_bodega) return true;
      const dias = diasDesde(c.eta_bodega);
      return dias !== null && dias <= VENTANA_ADELANTE;
    };
    const visibles = verTodos ? contenedores : contenedores.filter(enVentana);
    return { visibles, ocultos: contenedores.length - visibles.length };
  }, [contenedores, verTodos]);

  if (isLoading) return <SkeletonRows rows={2} />;

  // Adaptador para reusar SkusContratoModal (espera la forma de Blufin)
  const skusAdapter = verSkus
    ? ({
        folio: verSkus.folio_interno,
        productos: verSkus.productos,
      } as unknown as Parameters<typeof SkusContratoModal>[0]['contrato'])
    : null;

  return (
    <div className="card">
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--ink-100)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="hstack" style={{ gap: 8 }}>
          <span className="fw-700" style={{ fontSize: 14 }}>Por recibir</span>
          <span className="text-xs muted">ETA bodega hasta {VENTANA_ADELANTE} días adelante</span>
        </div>
        {(ocultos > 0 || verTodos) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setVerTodos((v) => !v)} style={{ fontSize: 11 }}>
            {verTodos ? 'Ver solo ventana' : `Ver todos (+${ocultos} fuera de ventana)`}
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="empty">
          <Icon name="check-circle" size={36} />
          <div className="empty-title">
            {contenedores.length === 0 ? 'Sin contenedores pendientes' : 'Nada por recibir en esta ventana'}
          </div>
          <p className="muted">
            {contenedores.length === 0
              ? 'Todos los contenedores activos ya fueron recibidos en bodega.'
              : `Hay ${contenedores.length} contenedor${contenedores.length !== 1 ? 'es' : ''} con ETA fuera de la ventana.`}
          </p>
          {contenedores.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => setVerTodos(true)} style={{ marginTop: 12 }}>
              Ver todos
            </button>
          )}
        </div>
      ) : (
        visibles.map((c, i) => {
          const dias = diasDesde(c.eta_bodega);
          const productos = c.productos ?? [];
          const eta = c.eta_bodega ? new Date(c.eta_bodega + 'T12:00:00') : null;
          const yaProgramada = !!c.eta_bodega_confirmada;
          const etaEstimada = !!c.eta_bodega && !yaProgramada;
          return (
            <div
              key={c.id}
              style={{
                padding: '14px 20px',
                borderBottom: i < visibles.length - 1 ? '1px solid var(--ink-100)' : 'none',
                display: 'grid',
                gridTemplateColumns: '46px 1fr 130px 110px 80px 180px',
                gap: 16,
                alignItems: 'center',
                background: yaProgramada ? 'color-mix(in srgb, var(--green-500) 12%, white)' : undefined,
              }}
            >
              <div
                style={{
                  width: 44,
                  padding: '4px 5px',
                  borderRadius: 'var(--r-sm)',
                  textAlign: 'center',
                  background: 'var(--ink-50)',
                  border: '1px solid var(--ink-200)',
                }}
              >
                <div className="text-xs fw-700" style={{ textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink-500)' }}>
                  {eta ? eta.toLocaleDateString('es-MX', { month: 'short' }) : '—'}
                </div>
                <div className="fw-700" style={{ fontSize: 17, lineHeight: 1 }}>{eta ? eta.getDate() : ''}</div>
              </div>
              <div>
                <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                  <button
                    onClick={() => setVerSkus(c)}
                    className="mono fw-700 text-sm"
                    title="Ver SKUs y cantidades"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--blue-500)' }}
                  >
                    {c.folio_interno}
                  </button>
                  <CamSAStatusPill status={statusContenedorSA(c)} />
                  {!c.eta_bodega && (
                    <span className="badge badge-amber" style={{ fontSize: 10 }}>
                      Sin ETA — programar llegada
                    </span>
                  )}
                  {etaEstimada && (
                    <span className="text-xs muted" title="ETA bodega estimada (ETA Manzanillo + 7d).">
                      ETA estimada +7d
                    </span>
                  )}
                  {dias !== null && dias < 0 && (
                    <span className="text-xs fw-600" style={{ color: 'var(--red-500)' }}>
                      ETA vencida hace {-dias}d
                    </span>
                  )}
                </div>
                <div className="text-sm fw-600">
                  {productos[0]
                    ? `${productos[0].descripcion ?? ''}${productos[0].marca ? ' · ' + productos[0].marca : ''}`
                    : 'Sin productos'}
                  {productos.length > 1 && <span className="muted"> +{productos.length - 1} más</span>}
                </div>
                <div className="hstack text-xs" style={{ gap: 8, flexWrap: 'wrap', rowGap: 4 }}>
                  <span className="muted">
                    {[c.contenedor, c.naviera].filter(Boolean).join(' · ') || 'Contenedor por asignar'}
                  </span>
                  {c.bodega_destino && (
                    <span
                      className="hstack"
                      style={{
                        gap: 4,
                        fontWeight: 700,
                        fontSize: 11,
                        color: '#065F46',
                        background: 'color-mix(in srgb, var(--green-500) 14%, white)',
                        border: '1px solid color-mix(in srgb, var(--green-500) 28%, white)',
                        padding: '1px 8px',
                        borderRadius: 999,
                      }}
                      title="Lugar de llegada acordado"
                    >
                      <Icon name="building" size={11} />
                      {c.bodega_destino}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs muted">Kg contratados</div>
                <div className="mono fw-700">{fmtKg(c.total_kg)}</div>
              </div>
              <div>
                <div className="text-xs muted">Presentación</div>
                <div className="fw-700 text-sm" style={{ color: 'var(--blue-500)' }}>{c.presentacion ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs muted">SKUs</div>
                <div className="fw-700 text-sm">{productos.length}</div>
              </div>
              {capturar ? (
                <div className="vstack" style={{ gap: 6, justifySelf: 'end' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => onReceive(c)} style={{ width: 170, justifyContent: 'center' }}>
                    <Icon name="inbox" size={13} /> Registrar recepción
                  </button>
                  {yaProgramada ? (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        if (window.confirm('La llegada de este contenedor ya está programada. ¿Te gustaría reprogramarla?')) onProgramar(c);
                      }}
                      title="Llegada ya programada — clic para reprogramar"
                      style={{ width: 170, justifyContent: 'center', color: 'var(--green-500)', borderColor: 'color-mix(in srgb, var(--green-500) 35%, white)' }}
                    >
                      <Icon name="check" size={13} /> Llegada programada
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onProgramar(c)}
                      title="La ETA bodega auto (+7d) es un estimado — asigna aquí la fecha y bodega acordadas"
                      style={{ width: 170, justifyContent: 'center' }}
                    >
                      <Icon name="calendar" size={13} /> Programar llegada
                    </button>
                  )}
                </div>
              ) : (
                <div />
              )}
            </div>
          );
        })
      )}
      <SkusContratoModal contrato={skusAdapter} onClose={() => setVerSkus(null)} />
    </div>
  );
}

/* ─── Programar llegada (modal) ───────────────────────────────────── */

function ProgramarLlegadaModal({
  contenedor,
  onClose,
}: {
  contenedor: CamContenedorSAConProductos | null;
  onClose: () => void;
}) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [fecha, setFecha] = useState('');
  const [bodega, setBodega] = useState('');
  const backdrop = useBackdropDismiss(onClose);

  const { data: cat } = useQuery({
    queryKey: ['cam_sa_catalogos', empresaId],
    queryFn: () => fetchCatalogosSA(empresaId),
    enabled: !!contenedor,
  });

  useEffect(() => {
    if (!contenedor) return;
    setFecha(contenedor.eta_bodega ?? '');
    setBodega(contenedor.bodega_destino ?? '');
  }, [contenedor]);

  const mutation = useMutation({
    mutationFn: () =>
      updateLlegadaContenedorSA({
        contenedor_id: contenedor!.id,
        eta_bodega: fecha,
        bodega_destino: bodega || null,
      }),
    onSuccess: () => {
      toast.success(`Llegada de ${contenedor?.folio_interno} programada para ${fmtFecha(fecha)}`);
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores_por_recibir'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      {contenedor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          {...backdrop}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 37, 64, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 100,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xl)', maxWidth: 440, width: '100%' }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Programar llegada</h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  <span className="mono fw-600">{contenedor.folio_interno}</span> — fecha y bodega acordadas
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', display: 'grid', gap: 12 }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--ink-50)',
                  border: '1px solid var(--ink-200)',
                  fontSize: 12,
                  color: 'var(--ink-600)',
                }}
              >
                ETA bodega actual:{' '}
                <span className="mono fw-600" style={{ color: 'var(--ink-900)' }}>{fmtFecha(contenedor.eta_bodega)}</span>{' '}
                <span className="text-xs muted">(auto +7d sobre ETA Manzanillo — estimado)</span>
              </div>
              <div>
                <label className="field-label">Fecha oficial de llegada a bodega *</label>
                <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Bodega destino</label>
                <select className="field-input" value={bodega} onChange={(e) => setBodega(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {(cat?.bodegas ?? []).map((b) => (
                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                background: 'var(--ink-50)',
                borderRadius: '0 0 var(--r-lg) var(--r-lg)',
              }}
            >
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={!fecha || mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="check" size={13} />}
                Guardar llegada
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Historial ───────────────────────────────────────────────────── */

function HistorialView({
  recepciones,
  isLoading,
  onDelete,
}: {
  recepciones: CamRecepcionSAEnriquecida[];
  isLoading: boolean;
  onDelete: (r: CamRecepcionSAEnriquecida) => void;
}) {
  const [q, setQ] = useState('');
  const [verDetalle, setVerDetalle] = useState<CamRecepcionSAEnriquecida | null>(null);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return recepciones;
    return recepciones.filter(
      (r) =>
        (r.contenedor?.folio_interno ?? '').toLowerCase().includes(query) ||
        (r.bodega?.nombre ?? '').toLowerCase().includes(query) ||
        (r.entrada_intelisis ?? '').toLowerCase().includes(query) ||
        (r.lineas ?? []).some((l) => (l.sku?.descripcion ?? '').toLowerCase().includes(query)),
    );
  }, [recepciones, q]);

  if (isLoading) return <SkeletonRows rows={3} />;

  if (recepciones.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="inbox" size={36} />
          <div className="empty-title">Sin recepciones registradas</div>
          <p className="muted">Cuando llegue un contenedor, regístralo desde la pestaña "Por recibir".</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <div
        className="hstack"
        style={{ gap: 8, padding: '7px 12px', background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)' }}
      >
        <Icon name="search" size={14} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca por folio, bodega, Intelisis o producto"
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13, color: 'var(--ink-900)' }}
        />
        {q && (
          <button onClick={() => setQ('')} className="btn btn-ghost btn-sm" style={{ padding: 4 }} aria-label="Limpiar">
            <Icon name="x" size={13} />
          </button>
        )}
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Contenedor</th>
              <th>Bodega</th>
              <th>Intelisis</th>
              <th>Presentación</th>
              <th style={{ textAlign: 'right' }}>Kg recibidos</th>
              <th style={{ textAlign: 'right' }}>Diferencia</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted text-sm" style={{ textAlign: 'center', padding: 20 }}>
                  Ninguna recepción coincide con la búsqueda.
                </td>
              </tr>
            ) : (
              filtradas.map((r) => {
                const lineas = r.lineas ?? [];
                const kgRecibidos = lineas.reduce((s, l) => s + Number(l.kg_recibidos), 0);
                const kgDif = lineas.reduce((s, l) => s + Number(l.diferencia ?? 0), 0);
                return (
                  <tr key={r.id}>
                    <td><div className="fw-600">{fmtFecha(r.fecha)}</div></td>
                    <td>
                      <button
                        onClick={() => setVerDetalle(r)}
                        className="mono text-sm fw-600"
                        title="Ver SKUs recibidos"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--blue-500)' }}
                      >
                        {r.contenedor?.folio_interno ?? '—'}
                      </button>
                      <div className="text-xs muted" style={{ marginTop: 2, maxWidth: 300 }}>
                        {lineas.slice(0, 3).map((l, i) => (
                          <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.sku?.descripcion ?? ''}>
                            {l.sku?.descripcion ?? '—'}
                          </div>
                        ))}
                        {lineas.length > 3 && <div>+{lineas.length - 3} más</div>}
                      </div>
                    </td>
                    <td className="text-sm">{r.bodega?.nombre ?? '—'}</td>
                    <td className="mono text-sm">{r.entrada_intelisis ?? '—'}</td>
                    <td className="text-sm">{r.presentacion_recibida ?? '—'}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtKg(kgRecibidos)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {kgDif < 0 ? (
                        <span className="mono fw-600" style={{ color: 'var(--red-500)' }}>−{fmtKg(-kgDif)}</span>
                      ) : (
                        <span className="badge badge-green">Completo</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => onDelete(r)} title="Eliminar recepción" style={{ padding: 6, color: 'var(--red-500)' }}>
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <RecepcionDetalleModal recepcion={verDetalle} onClose={() => setVerDetalle(null)} />
    </div>
  );
}

function RecepcionDetalleModal({
  recepcion,
  onClose,
}: {
  recepcion: CamRecepcionSAEnriquecida | null;
  onClose: () => void;
}) {
  const backdrop = useBackdropDismiss(onClose);
  const lineas = recepcion?.lineas ?? [];
  const totalContratado = lineas.reduce((s, l) => s + Number(l.kg_contratados), 0);
  const totalRecibido = lineas.reduce((s, l) => s + Number(l.kg_recibidos), 0);

  return (
    <AnimatePresence>
      {recepcion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          {...backdrop}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 37, 64, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 100,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: 580,
              width: '100%',
              maxHeight: '82vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div>
                <div className="mono fw-700 text-sm">{recepcion.contenedor?.folio_interno ?? '—'}</div>
                <div className="text-xs muted" style={{ marginTop: 2 }}>
                  Recibido {fmtFecha(recepcion.fecha)} · {recepcion.bodega?.nombre ?? 'sin bodega'} · Intelisis{' '}
                  <span className="mono">{recepcion.entrada_intelisis ?? '—'}</span>
                  {recepcion.presentacion_recibida ? ` · ${recepcion.presentacion_recibida}` : ''}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }} aria-label="Cerrar">
                <Icon name="x" size={14} />
              </button>
            </div>
            <div style={{ overflowY: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'right' }}>Contratado</th>
                    <th style={{ textAlign: 'right' }}>Recibido</th>
                    <th style={{ textAlign: 'right' }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted text-sm" style={{ textAlign: 'center', padding: 16 }}>
                        Esta recepción no tiene líneas capturadas.
                      </td>
                    </tr>
                  ) : (
                    lineas.map((l, i) => (
                      <tr key={i}>
                        <td className="text-sm fw-600">{l.sku?.descripcion ?? '—'}</td>
                        <td className="mono text-sm" style={{ textAlign: 'right' }}>{fmtKg(l.kg_contratados)}</td>
                        <td className="mono text-sm" style={{ textAlign: 'right' }}>{fmtKg(l.kg_recibidos)}</td>
                        <td
                          className="mono fw-700 text-sm"
                          style={{ textAlign: 'right', color: Number(l.diferencia ?? 0) < 0 ? 'var(--red-500)' : 'var(--green-500)' }}
                        >
                          {Number(l.diferencia ?? 0) < 0 ? `−${fmtKg(-Number(l.diferencia ?? 0))}` : 'OK'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {lineas.length > 0 && (
                  <tfoot>
                    <tr>
                      <td className="fw-700">Total</td>
                      <td className="mono fw-700" style={{ textAlign: 'right' }}>{fmtKg(totalContratado)}</td>
                      <td className="mono fw-700" style={{ textAlign: 'right' }}>{fmtKg(totalRecibido)}</td>
                      <td
                        className="mono fw-700"
                        style={{ textAlign: 'right', color: totalRecibido < totalContratado ? 'var(--red-500)' : 'var(--green-500)' }}
                      >
                        {totalRecibido < totalContratado ? `−${fmtKg(totalContratado - totalRecibido)}` : 'OK'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Calendario ──────────────────────────────────────────────────── */

type EventoDia = { tipo: 'recepcion' | 'eta'; folio: string; programada?: boolean };

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function CalendarioView({
  porRecibir,
  recepciones,
}: {
  porRecibir: CamContenedorSAConProductos[];
  recepciones: CamRecepcionSAEnriquecida[];
}) {
  const hoy = new Date();
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  const eventos = useMemo(() => {
    const map = new Map<string, EventoDia[]>();
    const add = (fecha: string | null | undefined, ev: EventoDia) => {
      if (!fecha) return;
      const arr = map.get(fecha) ?? [];
      arr.push(ev);
      map.set(fecha, arr);
    };
    recepciones.forEach((r) => add(r.fecha, { tipo: 'recepcion', folio: r.contenedor?.folio_interno ?? '—' }));
    porRecibir.forEach((c) => add(c.eta_bodega, { tipo: 'eta', folio: c.folio_interno, programada: !!c.eta_bodega_confirmada }));
    return map;
  }, [porRecibir, recepciones]);

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
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--green-500)' }} /> Recibido
            </span>
            <span className="hstack" style={{ gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--violet-500)' }} /> Llegada programada
            </span>
            <span className="hstack" style={{ gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--amber-500)' }} /> ETA estimada (+7d)
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
                    ev.tipo === 'recepcion'
                      ? { bg: 'color-mix(in srgb, var(--green-500) 12%, white)', fg: '#065F46', t: 'Recepción registrada' }
                      : ev.programada
                        ? { bg: 'color-mix(in srgb, var(--violet-500) 16%, white)', fg: '#5B21B6', t: 'Llegada programada (fecha oficial)' }
                        : { bg: 'color-mix(in srgb, var(--amber-500) 14%, white)', fg: '#92400E', t: 'ETA bodega estimada (+7d)' };
                  return (
                    <div
                      key={j}
                      className="mono"
                      title={estilo.t}
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
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────── */

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div className="card">
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          style={{
            padding: '14px 20px',
            borderBottom: i < rows - 1 ? '1px solid var(--ink-100)' : 'none',
            display: 'grid',
            gridTemplateColumns: '46px 1fr 120px 100px 140px',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <div className="skeleton-bar" style={{ width: 44, height: 36 }} />
          <div>
            <div className="skeleton-bar" style={{ width: '40%', marginBottom: 6 }} />
            <div className="skeleton-bar" style={{ width: '60%', height: 10 }} />
          </div>
          <div className="skeleton-bar" style={{ width: 80 }} />
          <div className="skeleton-bar" style={{ width: 60 }} />
          <div className="skeleton-bar" style={{ width: 120 }} />
        </div>
      ))}
    </div>
  );
}
