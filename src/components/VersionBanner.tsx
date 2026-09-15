/**
 * Aviso de "hay una versión nueva de la app".
 *
 * El problema que resuelve: la app es una SPA — si una pestaña se queda abierta
 * días, sigue corriendo el JavaScript de cuando se cargó, aunque ya se hayan
 * desplegado versiones nuevas. Un cambio de columnas en la BD (ej. id_toka →
 * id_efectivale, 2026-08-28) hace que ese código viejo truene con errores
 * crípticos de "column not found in the schema cache" (le pasó a Efraín).
 *
 * Cómo: cada build sella __BUILD_ID__ dentro del bundle y publica el mismo valor
 * en /version.json (vite.config.ts). Aquí se consulta ese archivo cada 5 minutos
 * y cada vez que la pestaña vuelve a primer plano; si ya no coinciden, sale un
 * aviso fijo con botón "Actualizar".
 *
 * A propósito NO se recarga solo: el usuario puede estar a media captura de
 * nómina. El aviso persiste hasta que él recargue. Cerrar sesión NO serviría:
 * el bundle viejo seguiría cargado en la pestaña.
 */
import { useEffect, useState } from 'react';
import { Icon } from './Icon';

const CADA_MS = 5 * 60 * 1000;

export function VersionBanner() {
  const [hayNueva, setHayNueva] = useState(false);

  useEffect(() => {
    // En dev no existe version.json (solo se emite en build) y no aplica.
    if (!import.meta.env.PROD || typeof __BUILD_ID__ === 'undefined') return;

    let activo = true;
    const checar = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: string };
        if (activo && data.build && data.build !== __BUILD_ID__) setHayNueva(true);
      } catch {
        // Sin red o respuesta rara: no molestar — se reintenta en el siguiente ciclo.
      }
    };

    const alVolver = () => {
      if (document.visibilityState === 'visible') checar();
    };

    checar();
    const timer = setInterval(checar, CADA_MS);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      activo = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, []);

  if (!hayNueva) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 4000,
        maxWidth: 380,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: 'white',
        border: '1px solid color-mix(in srgb, var(--amber-500) 45%, white)',
        borderRadius: 'var(--r-md)',
        boxShadow: '0 12px 32px -12px rgba(10, 37, 64, 0.35)',
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--r-sm)',
          background: 'color-mix(in srgb, var(--amber-500) 14%, white)',
          color: '#92400E',
        }}
      >
        <Icon name="bell" size={17} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="fw-700" style={{ fontSize: 13, color: 'var(--ink-900)' }}>
          Hay una versión nueva del ERP
        </div>
        <div className="text-xs muted" style={{ marginTop: 2 }}>
          Termina lo que estés capturando y actualiza para evitar errores.
        </div>
      </div>
      <button
        className="btn btn-primary btn-sm"
        style={{ flexShrink: 0 }}
        onClick={() => window.location.reload()}
      >
        Actualizar
      </button>
    </div>
  );
}
