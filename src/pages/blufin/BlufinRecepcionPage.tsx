import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter, SPRING } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { StatusPill } from '@/features/blufin/StatusPill';
import { statusContrato } from '@/features/blufin/status';
import { ContratoDetalleModal } from '@/features/blufin/ContratoDetalleModal';
import { useAuth } from '@/lib/auth';
import { fmtKg, fmtFechaCorta, fmtFecha, diasDesde } from '@/lib/format';
import { fetchCatalogos } from '@/features/blufin/queries';
import {
  fetchRecepciones,
  fetchContratosPorRecibir,
  deleteRecepcion,
  updateLlegadaContrato,
} from '@/features/blufin/recepcion-queries';
import type { BlufinContratoConProductos, BlufinRecepcionEnriquecida } from '@/types/database';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

type View = 'por-recibir' | 'historial' | 'calendario';

// Ventana operativa de "Por recibir": ETA bodega hasta hoy+7d (incluye
// vencidos/atrasados, que también hay que recibir). Contratos sin ETA siempre
// se muestran (necesitan que se les programe llegada).
const VENTANA_ADELANTE = 7;

/** ETA bodega auto = ETA puerto + 7d (regla §14.4). Si la eta_bodega del
 *  contrato coincide con esto, sigue siendo la ESTIMADA; al "Programar llegada"
 *  se le pone otra fecha y esa pasa a ser la oficial. */
const etaBodegaAuto = (etaPuerto: string) => {
  const d = new Date(etaPuerto + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

export function BlufinRecepcionPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('por-recibir');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(
    null,
  );
  const [programarTarget, setProgramarTarget] = useState<BlufinContratoConProductos | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data: porRecibir = [], isLoading: loadingPorRecibir } = useQuery({
    queryKey: ['blufin_contratos_por_recibir', empresaId],
    queryFn: () => fetchContratosPorRecibir(empresaId),
  });
  const { data: recepciones = [], isLoading: loadingRecepciones } = useQuery({
    queryKey: ['blufin_recepciones', empresaId],
    queryFn: () => fetchRecepciones(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRecepcion(id),
    onSuccess: () => {
      toast.success('Recepción eliminada — el contrato volvió a "En puerto"');
      qc.invalidateQueries({ queryKey: ['blufin_recepciones'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_por_recibir'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const lineas = recepciones.flatMap((r) => r.lineas ?? []);
    const kgRecibidos = lineas.reduce((s, l) => s + Number(l.kg_recibidos), 0);
    // diferencia (BD) = recibidos - contratados → negativo = faltante
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
          <p className="page-subtitle">
            Verificación de kg por SKU, captura de lote y naviera real del contenedor
          </p>
        </div>
      </PageEnter>

      {/* Stat strip compacto — una sola línea para dar más espacio a la tabla */}
      <StatStrip
        stats={[
          {
            value: porRecibir.length,
            label: 'por recibir',
            color: porRecibir.length > 0 ? 'var(--amber-500)' : undefined,
          },
          { value: recepciones.length, label: 'recepciones' },
          { value: fmtKg(kpis.kgRecibidos), label: 'recibidos' },
          {
            value: fmtKg(kpis.kgFaltantes),
            label: `faltantes${kpis.skusConFaltante > 0 ? ` · ${kpis.skusConFaltante} SKU${kpis.skusConFaltante !== 1 ? 's' : ''}` : ''}`,
            color: kpis.kgFaltantes > 0 ? 'var(--red-500)' : undefined,
          },
        ]}
      />

      {/* Sub-tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'por-recibir', label: 'Por recibir', icon: 'inbox' },
            { id: 'historial', label: 'Historial', icon: 'check' },
            { id: 'calendario', label: 'Calendario', icon: 'calendar' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={`tab ${view === t.id ? 'active' : ''}`}
            onClick={() => setView(t.id)}
          >
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
          contratos={porRecibir}
          isLoading={loadingPorRecibir}
          onReceive={(c) => navigate(`/app/importaciones/blufin/recepcion/registrar/${c.id}`)}
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
              description: `${r.contrato?.folio ?? '—'} · ${fmtFechaCorta(r.fecha_recepcion)} · ${r.bodega?.nombre ?? 'sin bodega'}`,
            })
          }
        />
      )}
      {view === 'calendario' && (
        <CalendarioView
          porRecibir={porRecibir}
          recepciones={recepciones}
          onVerContrato={setDetalleId}
        />
      )}

      <ProgramarLlegadaModal
        contrato={programarTarget}
        onClose={() => setProgramarTarget(null)}
      />

      <ContratoDetalleModal contratoId={detalleId} onClose={() => setDetalleId(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta recepción"
        itemDescription={deleteTarget?.description}
        consequences='Se borran las líneas por SKU y el contrato regresa a "En puerto", limpiando lote, naviera y llegada real.'
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
  contratos,
  isLoading,
  onReceive,
  onProgramar,
}: {
  contratos: BlufinContratoConProductos[];
  isLoading: boolean;
  onReceive: (c: BlufinContratoConProductos) => void;
  onProgramar: (c: BlufinContratoConProductos) => void;
}) {
  const [verTodos, setVerTodos] = useState(false);

  const { visibles, ocultos } = useMemo(() => {
    const enVentana = (c: BlufinContratoConProductos) => {
      if (!c.eta_bodega) return true; // sin ETA: necesita programarse, siempre visible
      const dias = diasDesde(c.eta_bodega);
      return dias !== null && dias <= VENTANA_ADELANTE;
    };
    const visibles = verTodos ? contratos : contratos.filter(enVentana);
    return { visibles, ocultos: contratos.length - visibles.length };
  }, [contratos, verTodos]);

  if (isLoading) return <SkeletonRows rows={2} />;

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
          <span className="fw-700" style={{ fontSize: 14 }}>
            Por recibir
          </span>
          <span className="text-xs muted">
            ETA bodega hasta {VENTANA_ADELANTE} días adelante
          </span>
        </div>
        {(ocultos > 0 || verTodos) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setVerTodos((v) => !v)}
            style={{ fontSize: 11 }}
          >
            {verTodos
              ? 'Ver solo ventana'
              : `Ver todos (+${ocultos} fuera de ventana)`}
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="empty">
          <Icon name="check-circle" size={36} />
          <div className="empty-title">
            {contratos.length === 0
              ? 'Sin contenedores pendientes'
              : 'Nada por recibir en esta ventana'}
          </div>
          <p className="muted">
            {contratos.length === 0
              ? 'Todos los contratos activos ya fueron recibidos en bodega.'
              : `Hay ${contratos.length} contrato${contratos.length !== 1 ? 's' : ''} con ETA fuera de la ventana.`}
          </p>
          {contratos.length > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setVerTodos(true)}
              style={{ marginTop: 12 }}
            >
              Ver todos
            </button>
          )}
        </div>
      ) : (
        visibles.map((c, i) => {
          const dias = diasDesde(c.eta_bodega);
          const productos = c.productos ?? [];
          const eta = c.eta_bodega ? new Date(c.eta_bodega + 'T12:00:00') : null;
          const etaEstimada =
            !!c.eta_puerto && !!c.eta_bodega && etaBodegaAuto(c.eta_puerto) === c.eta_bodega;
          // Ya programada = tiene ETA bodega OFICIAL (no la estimada +7d ni vacía)
          const yaProgramada = !!c.eta_bodega && !etaEstimada;
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
                // Resalta los contenedores con llegada YA programada (fecha oficial).
                background: yaProgramada ? 'color-mix(in srgb, var(--green-500) 6%, white)' : undefined,
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
                <div
                  className="text-xs fw-700"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    color: 'var(--ink-500)',
                  }}
                >
                  {eta ? eta.toLocaleDateString('es-MX', { month: 'short' }) : '—'}
                </div>
                <div className="fw-700" style={{ fontSize: 17, lineHeight: 1 }}>
                  {eta ? eta.getDate() : ''}
                </div>
              </div>
              <div>
                <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="mono fw-700 text-sm">{c.folio}</span>
                  <StatusPill status={statusContrato(c)} />
                  {!c.eta_bodega && (
                    <span className="badge badge-amber" style={{ fontSize: 10 }}>
                      Sin ETA — programar llegada
                    </span>
                  )}
                  {etaEstimada && (
                    <span
                      className="text-xs muted"
                      title="ETA bodega estimada (ETA puerto + 7d). Programa la llegada para fijar la fecha oficial."
                    >
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
                  {productos.length > 1 && (
                    <span className="muted"> +{productos.length - 1} más</span>
                  )}
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
                <div className="fw-700 text-sm" style={{ color: 'var(--blue-500)' }}>
                  {c.presentacion ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-xs muted">SKUs</div>
                <div className="fw-700 text-sm">{productos.length}</div>
              </div>
              <div className="vstack" style={{ gap: 6, justifySelf: 'end' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onReceive(c)}
                  style={{ width: 170, justifyContent: 'center' }}
                >
                  <Icon name="inbox" size={13} /> Registrar recepción
                </button>
                {yaProgramada ? (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          'La llegada de este contenedor ya está programada. ¿Te gustaría reprogramarla?',
                        )
                      )
                        onProgramar(c);
                    }}
                    title="Llegada ya programada — clic para reprogramar"
                    style={{
                      width: 170,
                      justifyContent: 'center',
                      color: 'var(--green-500)',
                      borderColor: 'color-mix(in srgb, var(--green-500) 35%, white)',
                    }}
                  >
                    <Icon name="check" size={13} /> Llegada programada
                  </button>
                ) : (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onProgramar(c)}
                    title="La ETA bodega auto-calculada (+7d) es un estimado — asigna aquí la fecha y bodega acordadas con el agente"
                    style={{ width: 170, justifyContent: 'center' }}
                  >
                    <Icon name="calendar" size={13} /> Programar llegada
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Programar llegada (modal) ───────────────────────────────────── */

function ProgramarLlegadaModal({
  contrato,
  onClose,
}: {
  contrato: BlufinContratoConProductos | null;
  onClose: () => void;
}) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [fecha, setFecha] = useState('');
  const [bodega, setBodega] = useState('');
  const backdrop = useBackdropDismiss(onClose);

  const { data: cat } = useQuery({
    queryKey: ['blufin_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
    enabled: !!contrato,
  });

  useEffect(() => {
    if (!contrato) return;
    setFecha(contrato.eta_bodega ?? '');
    setBodega(contrato.bodega_destino ?? '');
  }, [contrato]);

  const mutation = useMutation({
    mutationFn: () =>
      updateLlegadaContrato({
        contrato_id: contrato!.id,
        eta_bodega: fecha,
        bodega_destino: bodega || null,
      }),
    onSuccess: () => {
      toast.success(`Llegada de ${contrato?.folio} programada para ${fmtFecha(fecha)}`);
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_por_recibir'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      {contrato && (
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
              maxWidth: 440,
              width: '100%',
            }}
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
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Programar llegada
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  <span className="mono fw-600">{contrato.folio}</span> — fecha y bodega acordadas
                  con el agente
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                aria-label="Cerrar"
                style={{ padding: 6 }}
              >
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
                <span className="mono fw-600" style={{ color: 'var(--ink-900)' }}>
                  {fmtFecha(contrato.eta_bodega)}
                </span>{' '}
                <span className="text-xs muted">(auto +7d sobre ETA puerto — estimado)</span>
              </div>
              <div>
                <label className="field-label">Fecha oficial de llegada a bodega *</label>
                <input
                  type="date"
                  className="field-input"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
                <div className="text-xs muted" style={{ marginTop: 3 }}>
                  Reemplaza la ETA estimada — esta queda como la fecha oficial.
                </div>
              </div>
              <div>
                <label className="field-label">Bodega destino</label>
                <select
                  className="field-input"
                  value={bodega}
                  onChange={(e) => setBodega(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {(cat?.bodegas ?? []).map((b) => (
                    <option key={b.id} value={b.nombre}>
                      {b.nombre}
                    </option>
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
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!fecha || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <div className="spinner" style={{ width: 12, height: 12 }} />
                ) : (
                  <Icon name="check" size={13} />
                )}
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
  recepciones: BlufinRecepcionEnriquecida[];
  isLoading: boolean;
  onDelete: (r: BlufinRecepcionEnriquecida) => void;
}) {
  if (isLoading) return <SkeletonRows rows={3} />;

  if (recepciones.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="inbox" size={36} />
          <div className="empty-title">Sin recepciones registradas</div>
          <p className="muted">
            Cuando llegue un contenedor, regístralo desde la pestaña "Por recibir".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <table className="tbl">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Contrato</th>
            <th>Bodega</th>
            <th>Intelisis</th>
            <th>Presentación</th>
            <th style={{ textAlign: 'right' }}>Kg recibidos</th>
            <th style={{ textAlign: 'right' }}>Diferencia</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {recepciones.map((r) => {
            const lineas = r.lineas ?? [];
            const kgRecibidos = lineas.reduce((s, l) => s + Number(l.kg_recibidos), 0);
            const kgDif = lineas.reduce((s, l) => s + Number(l.diferencia ?? 0), 0);
            const presDif =
              r.presentacion_recibida &&
              r.contrato?.presentacion &&
              r.presentacion_recibida !== r.contrato.presentacion;
            return (
              <tr key={r.id}>
                <td>
                  <div className="fw-600">{fmtFecha(r.fecha_recepcion)}</div>
                </td>
                <td>
                  <div className="mono text-sm fw-600">{r.contrato?.folio ?? '—'}</div>
                  <div className="text-xs muted" style={{ marginTop: 2, maxWidth: 300 }}>
                    {lineas.slice(0, 3).map((l, i) => (
                      <div
                        key={i}
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={l.sku?.descripcion ?? ''}
                      >
                        {l.sku?.descripcion ?? '—'}
                      </div>
                    ))}
                    {lineas.length > 3 && <div>+{lineas.length - 3} más</div>}
                  </div>
                </td>
                <td className="text-sm">{r.bodega?.nombre ?? '—'}</td>
                <td className="mono text-sm">{r.entrada_intelisis ?? '—'}</td>
                <td>
                  {presDif ? (
                    <span className="badge badge-amber">
                      {r.contrato?.presentacion} → {r.presentacion_recibida}
                    </span>
                  ) : (
                    <span className="text-sm">{r.presentacion_recibida ?? '—'}</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }} className="mono fw-600">
                  {fmtKg(kgRecibidos)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {kgDif < 0 ? (
                    <span className="mono fw-600" style={{ color: 'var(--red-500)' }}>
                      −{fmtKg(-kgDif)}
                    </span>
                  ) : (
                    <span className="badge badge-green">Completo</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onDelete(r)}
                    title="Eliminar recepción"
                    style={{ padding: 6, color: 'var(--red-500)' }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Calendario ──────────────────────────────────────────────────── */

type EventoDia = {
  tipo: 'recepcion' | 'eta';
  folio: string;
  contratoId: string | null;
  programada?: boolean; // solo para 'eta': true si la llegada ya fue programada (oficial)
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const isoDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function CalendarioView({
  porRecibir,
  recepciones,
  onVerContrato,
}: {
  porRecibir: BlufinContratoConProductos[];
  recepciones: BlufinRecepcionEnriquecida[];
  onVerContrato: (id: string) => void;
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
    recepciones.forEach((r) =>
      add(r.fecha_recepcion, {
        tipo: 'recepcion',
        folio: r.contrato?.folio ?? '—',
        contratoId: r.contrato_id ?? null,
      }),
    );
    porRecibir.forEach((c) => {
      const estimada =
        !!c.eta_puerto && !!c.eta_bodega && etaBodegaAuto(c.eta_puerto) === c.eta_bodega;
      add(c.eta_bodega, {
        tipo: 'eta',
        folio: c.folio,
        contratoId: c.id,
        programada: !!c.eta_bodega && !estimada,
      });
    });
    return map;
  }, [porRecibir, recepciones]);

  // Grid: arranca el lunes de la semana del día 1, 6 semanas (42 celdas)
  const celdas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const offsetLunes = (primero.getDay() + 6) % 7; // 0 = lunes
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
          <span className="fw-700" style={{ fontSize: 14 }}>
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </span>
          <span className="hstack text-xs muted" style={{ gap: 10, marginLeft: 8, flexWrap: 'wrap' }}>
            <span className="hstack" style={{ gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--green-500)' }} />
              Recibido
            </span>
            <span className="hstack" style={{ gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--violet-500)' }} />
              Llegada programada
            </span>
            <span className="hstack" style={{ gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--amber-500)' }} />
              ETA estimada (+7d)
            </span>
            <span className="muted" style={{ fontSize: 10 }}>· clic en un contrato para ver su ficha</span>
          </span>
        </div>
        <div className="hstack" style={{ gap: 4 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
            aria-label="Mes anterior"
            style={{ padding: 6 }}
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1))}
          >
            Hoy
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
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
                      title={`${estilo.t}${ev.contratoId ? ' — clic para ver la ficha' : ''}`}
                      onClick={ev.contratoId ? () => onVerContrato(ev.contratoId!) : undefined}
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
                        cursor: ev.contratoId ? 'pointer' : 'default',
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
