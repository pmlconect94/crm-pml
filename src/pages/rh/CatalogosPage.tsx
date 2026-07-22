/**
 * RH → Catálogos: administra las listas que las pestañas de captura consumen
 * como <select> (para que ya no se tecleen): motivos de horas extra, motivos de
 * bono y — solo PML — destinos de viaje. Listas separadas por empresa (la
 * empresa activa viene del switcher global). Sin monto sugerido: solo etiqueta.
 * Sin hard-delete: activar/desactivar (los inactivos dejan de aparecer en los
 * selects pero el histórico capturado con ellos no se toca).
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { useAuth } from '@/lib/nomina/auth';
import { useEmpresa } from '@/lib/nomina/empresas';
import {
  fetchCatalogoMotivos, crearMotivo, toggleMotivoActivo,
  TIPO_LABEL, type Motivo, type TipoMotivo,
} from '@/lib/nomina/catalogos';

export function CatalogosPage() {
  const { user } = useAuth();
  const { code: empresa } = useEmpresa();
  const canEdit = user?.rol !== 'viewer';
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [verInactivos, setVerInactivos] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      setMotivos(await fetchCatalogoMotivos(empresa));
    } catch (err: any) {
      toast.error('Error al cargar catálogos: ' + err.message);
    }
    setLoading(false);
  }
  useEffect(() => { cargar(); }, [empresa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Viajes solo existe en PML (Marlin no tiene viajes).
  const tipos: TipoMotivo[] = empresa === 'PML' ? ['horas_extra', 'bono', 'viaje'] : ['horas_extra', 'bono'];

  return (
    <PageEnter>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogos</h1>
          <p className="page-subtitle">
            Listas de {empresa === 'PML' ? 'motivos y destinos' : 'motivos'} de {empresa} — lo que
            aparece en los selectores de captura
          </p>
        </div>
        <label className="hstack" style={{ gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--ink-500)' }}>
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tipos.length}, minmax(0, 1fr))`, gap: 16 }}>
          {tipos.map((tipo) => (
            <SeccionCatalogo
              key={tipo}
              tipo={tipo}
              empresa={empresa}
              motivos={motivos.filter((m) => m.tipo === tipo && (verInactivos || m.activo))}
              canEdit={canEdit}
              onChanged={cargar}
            />
          ))}
        </div>
      )}
    </PageEnter>
  );
}

function SeccionCatalogo({ tipo, empresa, motivos, canEdit, onChanged }: {
  tipo: TipoMotivo;
  empresa: 'PML' | 'MARLIN';
  motivos: Motivo[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [nuevo, setNuevo] = useState('');
  const [saving, setSaving] = useState(false);
  const activos = useMemo(() => motivos.filter((m) => m.activo).length, [motivos]);

  async function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    setSaving(true);
    try {
      await crearMotivo(empresa, tipo, nombre);
      toast.success(`"${nombre}" agregado`);
      setNuevo('');
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  }

  async function toggle(m: Motivo) {
    try {
      await toggleMotivoActivo(m.id, !m.activo);
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-body">
        <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="fw-700" style={{ fontSize: 13.5 }}>{TIPO_LABEL[tipo]}</div>
          <span className="text-xs muted">{activos} activo{activos !== 1 ? 's' : ''}</span>
        </div>

        {canEdit && (
          <div className="hstack" style={{ gap: 6, marginBottom: 10 }}>
            <input
              className="field-input"
              placeholder="Agregar…"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={agregar} disabled={saving || !nuevo.trim()}>
              <Icon name="plus" size={13} />
            </button>
          </div>
        )}

        {motivos.length === 0 ? (
          <p className="text-sm muted" style={{ margin: 0 }}>Sin elementos.</p>
        ) : (
          <div className="vstack" style={{ gap: 0 }}>
            {motivos.map((m, i) => (
              <div
                key={m.id}
                className="hstack"
                style={{
                  justifyContent: 'space-between', gap: 8, padding: '7px 2px',
                  borderTop: i > 0 ? '1px solid var(--ink-100)' : 'none',
                  opacity: m.activo ? 1 : 0.5,
                }}
              >
                <span style={{ fontSize: 13 }}>{m.nombre}</span>
                {canEdit && (
                  <button
                    className={`switch ${m.activo ? 'on' : ''}`}
                    onClick={() => toggle(m)}
                    title={m.activo ? 'Desactivar (deja de salir en el selector)' : 'Reactivar'}
                    aria-label={m.activo ? 'Desactivar' : 'Activar'}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
