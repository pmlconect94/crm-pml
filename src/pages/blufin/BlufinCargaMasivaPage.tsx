/**
 * Carga masiva de contratos Blufin desde PDF.
 *
 * Flujo (decidido 2026-06-17): los PDFs de Menita se leen y extraen en Cowork
 * (Claude, sin costo de API extra) y se cargan a la zona de staging. Esta
 * pantalla LISTA los lotes importados; al "Revisar" se abre la página dedicada
 * donde se corrige el match de SKU y se confirma la importación a las tablas
 * reales. Nada toca los contratos reales hasta confirmar.
 */
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { fetchImportLotes, descartarLote } from '@/features/blufin/import-queries';
import { useAuth } from '@/lib/auth';
import { fmtFechaCorta } from '@/lib/format';
import type { BlufinImportLoteEnriquecido } from '@/types/database';

type Conteos = {
  total: number;
  listos: number;
  duplicados: number;
  importados: number;
  omitidos: number;
};

const conteosDe = (lote: BlufinImportLoteEnriquecido): Conteos => {
  const cs = lote.contratos ?? [];
  return {
    total: cs.length,
    listos: cs.filter((c) => c.status === 'pendiente' && !c.duplicado).length,
    duplicados: cs.filter((c) => c.duplicado && c.status !== 'importado').length,
    importados: cs.filter((c) => c.status === 'importado').length,
    omitidos: cs.filter((c) => c.status === 'omitido').length,
  };
};

export function BlufinCargaMasivaPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ['blufin_import_lotes', empresaId],
    queryFn: () => fetchImportLotes(empresaId),
  });

  const descartarMut = useMutation({
    mutationFn: (loteId: string) => descartarLote(loteId),
    onSuccess: () => {
      toast.success('Lote descartado');
      qc.invalidateQueries({ queryKey: ['blufin_import_lotes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendientes = useMemo(() => lotes.filter((l) => l.status !== 'importado'), [lotes]);
  const importados = useMemo(() => lotes.filter((l) => l.status === 'importado'), [lotes]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Carga masiva desde PDF
          </h2>
          <p className="page-subtitle">
            Revisa los contratos extraídos de los PDFs de Menita y confírmalos de un golpe
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <Link
            to="/app/importaciones/blufin/contratos/nuevo"
            className="btn btn-outline btn-sm"
            style={{ textDecoration: 'none' }}
          >
            <Icon name="plus" size={13} /> Captura manual
          </Link>
          <Link
            to="/app/importaciones/blufin/contratos"
            className="btn btn-ghost btn-sm"
            style={{ textDecoration: 'none' }}
          >
            <Icon name="arrow-left" size={13} /> Volver a contratos
          </Link>
        </div>
      </PageEnter>

      {/* Cómo funciona el flujo */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          background: 'color-mix(in srgb, var(--blue-500) 5%, white)',
          border: '1px solid color-mix(in srgb, var(--blue-500) 22%, white)',
        }}
      >
        <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Icon name="upload" size={18} style={{ color: 'var(--blue-500)', marginTop: 2, flexShrink: 0 }} />
          <div className="text-sm" style={{ color: 'var(--ink-700)' }}>
            <strong>Cómo cargar un lote:</strong> coloca los PDFs de órdenes de compra de Menita en la
            carpeta <span className="mono">uploads/contratos-blufin/</span> del proyecto y pídele a Claude
            que los procese. Aparecerán aquí como un lote para que revises el match de SKU, corrijas lo que
            haga falta y confirmes la importación. Nada se guarda en los contratos reales hasta que tú
            confirmas.
          </div>
        </div>
      </div>

      {/* Lista de lotes */}
      {isLoading ? (
        <div className="vstack" style={{ gap: 8 }}>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--r-md)' }} />
          ))}
        </div>
      ) : lotes.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '48px 24px' }}
        >
          <Icon name="inbox" size={42} style={{ color: 'var(--ink-400)', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            No hay lotes por revisar
          </div>
          <div className="muted text-sm" style={{ marginBottom: 16, maxWidth: 460, margin: '0 auto 16px' }}>
            Sube los PDFs de Menita a la carpeta <span className="mono">uploads/contratos-blufin/</span> y
            pídele a Claude que los procese. O captura un contrato manualmente.
          </div>
          <Link
            to="/app/importaciones/blufin/contratos/nuevo"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: 'none', display: 'inline-flex' }}
          >
            <Icon name="plus" size={13} /> Captura manual
          </Link>
        </div>
      ) : (
        <div className="vstack" style={{ gap: 16 }}>
          {pendientes.length > 0 && (
            <LoteSection
              titulo="Por revisar"
              lotes={pendientes}
              onRevisar={(id) => navigate(`/app/importaciones/blufin/contratos/carga-masiva/${id}`)}
              onDescartar={(l) => {
                if (window.confirm(`¿Descartar el lote "${l.nombre}" y sus PDFs? Esto no afecta contratos ya importados.`))
                  descartarMut.mutate(l.id);
              }}
            />
          )}
          {importados.length > 0 && (
            <LoteSection
              titulo="Importados"
              lotes={importados}
              onRevisar={(id) => navigate(`/app/importaciones/blufin/contratos/carga-masiva/${id}`)}
              onDescartar={(l) => {
                if (window.confirm(`¿Descartar el registro del lote "${l.nombre}"? Los contratos ya importados se conservan.`))
                  descartarMut.mutate(l.id);
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

function LoteSection({
  titulo,
  lotes,
  onRevisar,
  onDescartar,
}: {
  titulo: string;
  lotes: BlufinImportLoteEnriquecido[];
  onRevisar: (id: string) => void;
  onDescartar: (l: BlufinImportLoteEnriquecido) => void;
}) {
  return (
    <div>
      <div className="text-xs fw-700 muted" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        {titulo} · {lotes.length}
      </div>
      <div className="vstack" style={{ gap: 8 }}>
        {lotes.map((l) => {
          const c = conteosDe(l);
          const importado = l.status === 'importado';
          return (
            <div
              key={l.id}
              className="card"
              style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                  <Icon name="file-text" size={15} style={{ color: 'var(--blue-500)' }} />
                  <span className="fw-700" style={{ fontSize: 14 }}>{l.nombre}</span>
                  {importado && (
                    <span className="badge badge-green"><span className="dot" /> Importado</span>
                  )}
                </div>
                <div className="hstack text-xs muted" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <span>{fmtFechaCorta(l.created_at?.slice(0, 10))}</span>
                  {l.fuente && <span className="mono">{l.fuente}</span>}
                  <span>· {c.total} contrato{c.total === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="hstack" style={{ gap: 6, flexShrink: 0 }}>
                {c.listos > 0 && <Chip color="blue" label={`${c.listos} listos`} />}
                {c.duplicados > 0 && <Chip color="amber" label={`${c.duplicados} duplicados`} />}
                {c.importados > 0 && <Chip color="green" label={`${c.importados} importados`} />}
                {c.omitidos > 0 && <Chip color="gray" label={`${c.omitidos} omitidos`} />}
              </div>

              <div className="hstack" style={{ gap: 6, flexShrink: 0 }}>
                <button className="btn btn-primary btn-sm" onClick={() => onRevisar(l.id)}>
                  <Icon name={importado ? 'file-text' : 'edit'} size={13} />
                  {importado ? 'Ver' : 'Revisar'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  title="Descartar lote"
                  onClick={() => onDescartar(l)}
                  style={{ padding: 6 }}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  blue: { bg: '#E6F4FF', text: '#1E40AF' },
  amber: { bg: '#FEF3C7', text: '#92400E' },
  green: { bg: '#D1FAE5', text: '#065F46' },
  gray: { bg: 'var(--ink-100)', text: 'var(--ink-500)' },
};

function Chip({ color, label }: { color: keyof typeof CHIP_COLORS | string; label: string }) {
  const c = CHIP_COLORS[color] ?? CHIP_COLORS.gray;
  return (
    <span
      className="text-xs fw-600"
      style={{ background: c.bg, color: c.text, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}
    >
      {label}
    </span>
  );
}
