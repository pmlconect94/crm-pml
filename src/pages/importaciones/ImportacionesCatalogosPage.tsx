/**
 * Catálogos de Importaciones: navieras y bodegas de destino.
 *
 * Compartidos por Blufin, Camanchaca y Neptuno, por eso viven aquí y no dentro
 * de un módulo de proveedor. Sin borrado: se activa/desactiva (ver
 * catalogos-queries.ts).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import {
  fetchNavierasTodas,
  fetchBodegasTodas,
  fetchUsoCatalogos,
  crearNaviera,
  renombrarNaviera,
  toggleNaviera,
  crearBodega,
  actualizarBodega,
} from '@/features/importaciones/catalogos-queries';

type Tab = 'navieras' | 'bodegas';

function Toggle({ activo, onClick, disabled }: { activo: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className={`btn btn-sm ${activo ? '' : 'btn-ghost'}`}
      onClick={onClick}
      disabled={disabled}
      title={activo ? 'Desactivar — deja de ofrecerse al capturar' : 'Volver a activar'}
      style={{
        padding: '3px 10px',
        fontSize: 11.5,
        background: activo ? 'color-mix(in srgb, var(--green-500) 14%, white)' : undefined,
        color: activo ? '#065F46' : undefined,
      }}
    >
      {activo ? 'Activa' : 'Inactiva'}
    </button>
  );
}

export function ImportacionesCatalogosPage() {
  const { empresaId, user } = useAuth();
  const qc = useQueryClient();
  const puedeEditar = user?.rol === 'admin_total' || !!user?.capturar;
  const [tab, setTab] = useState<Tab>('navieras');
  const [verInactivos, setVerInactivos] = useState(false);
  const [nuevaNaviera, setNuevaNaviera] = useState('');
  const [nuevaBodega, setNuevaBodega] = useState({ nombre: '', ciudad: '' });

  const { data: navieras = [] } = useQuery({ queryKey: ['navieras_todas'], queryFn: fetchNavierasTodas });
  const { data: bodegas = [] } = useQuery({
    queryKey: ['bodegas_todas', empresaId],
    queryFn: () => fetchBodegasTodas(empresaId),
  });
  const { data: uso } = useQuery({ queryKey: ['uso_catalogos'], queryFn: fetchUsoCatalogos });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['navieras_todas'] });
    qc.invalidateQueries({ queryKey: ['bodegas_todas'] });
    // Los formularios de captura leen su propia copia de los catálogos.
    qc.invalidateQueries({ queryKey: ['blufin_catalogos'] });
    qc.invalidateQueries({ queryKey: ['cam_sa_catalogos'] });
    qc.invalidateQueries({ queryKey: ['cam_catalogos'] });
  };

  // Cada useMutation se declara directo, no dentro de un helper: envolverlos en
  // una función haría que el hook se llame desde algo que no es el componente
  // (§14 regla 6) — funciona mientras el orden no cambie, y truena en silencio
  // el día que alguien lo llame condicionalmente.
  const ok = (mensaje: string) => ({
    onSuccess: () => {
      toast.success(mensaje);
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNaviera = useMutation({ mutationFn: (nombre: string) => crearNaviera(nombre), ...ok('Naviera agregada') });
  const renNaviera = useMutation({
    mutationFn: (v: { id: number; nombre: string }) => renombrarNaviera(v.id, v.nombre),
    ...ok('Naviera renombrada'),
  });
  const togNaviera = useMutation({
    mutationFn: (v: { id: number; activo: boolean }) => toggleNaviera(v.id, v.activo),
    ...ok('Actualizada'),
  });
  const addBodega = useMutation({
    mutationFn: (v: { nombre: string; ciudad: string }) => crearBodega(empresaId, v.nombre, v.ciudad),
    ...ok('Bodega agregada'),
  });
  const updBodega = useMutation({
    mutationFn: (v: { id: number; patch: { nombre?: string; ciudad?: string | null; activo?: boolean } }) =>
      actualizarBodega(v.id, v.patch),
    ...ok('Bodega actualizada'),
  });

  const navierasVis = navieras.filter((n) => verInactivos || n.activo);
  const bodegasVis = bodegas.filter((b) => verInactivos || b.activo);

  return (
    <>
      <PageEnter className="page-header" style={{ marginBottom: 10 }}>
        <div>
          <h1 className="page-title">Catálogos de importaciones</h1>
          <p className="page-subtitle">
            Navieras y bodegas de destino — los comparten Blufin, Camanchaca y Neptuno
          </p>
        </div>
      </PageEnter>

      <div className="hstack" style={{ gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="hstack" style={{ gap: 4 }}>
          {(['navieras', 'bodegas'] as Tab[]).map((t) => (
            <button
              key={t}
              className="btn btn-sm"
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? 'var(--navy-900)' : 'white',
                color: tab === t ? 'white' : 'var(--ink-700)',
                boxShadow: tab === t ? 'none' : 'inset 0 0 0 1px var(--ink-200)',
                padding: '4px 12px',
                fontSize: 12,
                textTransform: 'capitalize',
              }}
            >
              {t} ({t === 'navieras' ? navieras.filter((n) => n.activo).length : bodegas.filter((b) => b.activo).length})
            </button>
          ))}
        </div>
        <label className="hstack text-xs muted" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Ver inactivas
        </label>
      </div>

      <div className="card">
        {tab === 'navieras' ? (
          <>
            {puedeEditar && (
              <div className="hstack" style={{ gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--ink-100)' }}>
                <input
                  className="field-input"
                  style={{ maxWidth: 280 }}
                  value={nuevaNaviera}
                  onChange={(e) => setNuevaNaviera(e.target.value.toUpperCase())}
                  placeholder="Nombre de la naviera…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nuevaNaviera.trim()) {
                      addNaviera.mutate(nuevaNaviera);
                      setNuevaNaviera('');
                    }
                  }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!nuevaNaviera.trim() || addNaviera.isPending}
                  onClick={() => {
                    addNaviera.mutate(nuevaNaviera);
                    setNuevaNaviera('');
                  }}
                >
                  <Icon name="plus" size={13} /> Agregar
                </button>
              </div>
            )}
            <table className="tbl">
              <thead>
                <tr>
                  <th>Naviera</th>
                  <th style={{ textAlign: 'right' }}>Embarques</th>
                  <th style={{ width: 110 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {navierasVis.map((n) => (
                  <tr key={n.id} style={{ opacity: n.activo ? 1 : 0.55 }}>
                    <td>
                      {puedeEditar ? (
                        <input
                          className="field-input"
                          defaultValue={n.nombre}
                          style={{ maxWidth: 280, padding: '4px 8px', fontSize: 13 }}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== n.nombre) renNaviera.mutate({ id: n.id, nombre: v });
                          }}
                        />
                      ) : (
                        <span className="fw-600 text-sm">{n.nombre}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono text-sm muted">
                      {uso?.navieras.get(n.id) ?? 0}
                    </td>
                    <td>
                      <Toggle
                        activo={n.activo}
                        disabled={!puedeEditar}
                        onClick={() => togNaviera.mutate({ id: n.id, activo: !n.activo })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            {puedeEditar && (
              <div className="hstack" style={{ gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--ink-100)' }}>
                <input
                  className="field-input"
                  style={{ maxWidth: 240 }}
                  value={nuevaBodega.nombre}
                  onChange={(e) => setNuevaBodega((b) => ({ ...b, nombre: e.target.value.toUpperCase() }))}
                  placeholder="Nombre de la bodega…"
                />
                <input
                  className="field-input"
                  style={{ maxWidth: 200 }}
                  value={nuevaBodega.ciudad}
                  onChange={(e) => setNuevaBodega((b) => ({ ...b, ciudad: e.target.value }))}
                  placeholder="Ciudad (opcional)"
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!nuevaBodega.nombre.trim() || addBodega.isPending}
                  onClick={() => {
                    addBodega.mutate(nuevaBodega);
                    setNuevaBodega({ nombre: '', ciudad: '' });
                  }}
                >
                  <Icon name="plus" size={13} /> Agregar
                </button>
              </div>
            )}
            <table className="tbl">
              <thead>
                <tr>
                  <th>Bodega</th>
                  <th>Ciudad</th>
                  <th style={{ width: 110 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {bodegasVis.map((b) => (
                  <tr key={b.id} style={{ opacity: b.activo ? 1 : 0.55 }}>
                    <td>
                      {puedeEditar ? (
                        <input
                          className="field-input"
                          defaultValue={b.nombre}
                          style={{ maxWidth: 260, padding: '4px 8px', fontSize: 13 }}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== b.nombre) updBodega.mutate({ id: b.id, patch: { nombre: v } });
                          }}
                        />
                      ) : (
                        <span className="fw-600 text-sm">{b.nombre}</span>
                      )}
                    </td>
                    <td>
                      {puedeEditar ? (
                        <input
                          className="field-input"
                          defaultValue={b.ciudad ?? ''}
                          style={{ maxWidth: 200, padding: '4px 8px', fontSize: 13 }}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (b.ciudad ?? '')) updBodega.mutate({ id: b.id, patch: { ciudad: v || null } });
                          }}
                        />
                      ) : (
                        <span className="text-sm muted">{b.ciudad ?? '—'}</span>
                      )}
                    </td>
                    <td>
                      <Toggle
                        activo={b.activo}
                        disabled={!puedeEditar}
                        onClick={() => updBodega.mutate({ id: b.id, patch: { activo: !b.activo } })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <p className="text-xs muted" style={{ marginTop: 8 }}>
        Nada se borra: al desactivar, deja de ofrecerse al capturar pero los embarques que ya la usan la conservan.
      </p>
    </>
  );
}
