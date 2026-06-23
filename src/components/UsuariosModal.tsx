import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Icon } from './Icon';
import { SPRING } from './motion';
import { supabase } from '@/lib/supabase';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

type UsuarioAdmin = { id: string; email: string; nombre: string };

/**
 * Panel de usuarios del admin (solo ddl.pml2). Lista los usuarios y permite
 * cambiar la contraseña de cualquiera (tecleada dos veces). Todo pasa por la
 * Edge Function `admin-set-password` (verifica admin + usa service_role).
 */
export function UsuariosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backdrop = useBackdropDismiss(onClose);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAbierto(null);
    setPwd('');
    setPwd2('');
    setCargando(true);
    supabase.functions
      .invoke('admin-set-password', { body: { action: 'list' } })
      .then(({ data, error }) => {
        const err = error?.message ?? (data as { error?: string })?.error;
        if (err) {
          toast.error('No se pudo cargar la lista de usuarios');
          setUsuarios([]);
        } else {
          setUsuarios((data as { usuarios?: UsuarioAdmin[] }).usuarios ?? []);
        }
      })
      .finally(() => setCargando(false));
  }, [open]);

  const abrirForm = (id: string) => {
    setAbierto((prev) => (prev === id ? null : id));
    setPwd('');
    setPwd2('');
  };

  const guardar = async (u: UsuarioAdmin) => {
    if (pwd.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres');
    if (pwd !== pwd2) return toast.error('Las contraseñas no coinciden');
    setGuardando(true);
    const { data, error } = await supabase.functions.invoke('admin-set-password', {
      body: { action: 'set', userId: u.id, password: pwd },
    });
    setGuardando(false);
    const err = error?.message ?? (data as { error?: string })?.error;
    if (err) return toast.error('Error: ' + err);
    toast.success(`Contraseña de ${u.nombre} actualizada`);
    setAbierto(null);
    setPwd('');
    setPwd2('');
  };

  return (
    <AnimatePresence>
      {open && (
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
              maxWidth: 480,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Usuarios</h2>
                <p className="text-xs muted" style={{ margin: '2px 0 0' }}>
                  Cambia la contraseña de cualquier usuario
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }} aria-label="Cerrar">
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 12 }}>
              {cargando ? (
                <div className="text-sm muted" style={{ padding: 16, textAlign: 'center' }}>Cargando…</div>
              ) : usuarios.length === 0 ? (
                <div className="text-sm muted" style={{ padding: 16, textAlign: 'center' }}>
                  No se pudieron cargar los usuarios.
                </div>
              ) : (
                <div className="vstack" style={{ gap: 8 }}>
                  {usuarios.map((u) => (
                    <div key={u.id} style={{ border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                      <div className="hstack" style={{ justifyContent: 'space-between', padding: '10px 12px', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-600 text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.nombre}
                          </div>
                          <div className="text-xs muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.email}
                          </div>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => abrirForm(u.id)} style={{ flexShrink: 0 }}>
                          Cambiar contraseña
                        </button>
                      </div>
                      {abierto === u.id && (
                        <div style={{ padding: 12, borderTop: '1px solid var(--ink-100)', background: 'var(--ink-50)' }}>
                          <div className="vstack" style={{ gap: 8 }}>
                            <div>
                              <label className="field-label">Nueva contraseña</label>
                              <input
                                type="password"
                                className="field-input"
                                value={pwd}
                                onChange={(e) => setPwd(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                autoComplete="new-password"
                                style={{ width: '100%' }}
                              />
                            </div>
                            <div>
                              <label className="field-label">Repite la contraseña</label>
                              <input
                                type="password"
                                className="field-input"
                                value={pwd2}
                                onChange={(e) => setPwd2(e.target.value)}
                                placeholder="Otra vez, para confirmar"
                                autoComplete="new-password"
                                style={{ width: '100%' }}
                              />
                            </div>
                            {pwd2.length > 0 && pwd !== pwd2 && (
                              <div className="text-xs" style={{ color: 'var(--red-500)' }}>Las contraseñas no coinciden.</div>
                            )}
                            <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setAbierto(null)} disabled={guardando}>
                                Cancelar
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => guardar(u)}
                                disabled={guardando || pwd.length < 6 || pwd !== pwd2}
                              >
                                {guardando ? 'Guardando…' : 'Guardar'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
