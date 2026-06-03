import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';

export function BlufinCargaMasivaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Carga masiva desde PDF</h2>
          <p className="page-subtitle">
            Sube el PDF con varias órdenes de compra y captúralas de un golpe
          </p>
        </div>
        <Link to="/app/importaciones/blufin/contratos" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
          <Icon name="arrow-left" size={13} /> Volver a contratos
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              border: '2px dashed ' + (dragging ? 'var(--blue-500)' : 'var(--ink-300)'),
              borderRadius: 14,
              padding: '48px 24px',
              background: dragging ? 'var(--blue-50)' : 'var(--ink-50)',
              textAlign: 'center',
              transition: 'all 0.2s',
            }}
          >
            <Icon name="upload" size={42} style={{ color: 'var(--blue-500)', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Arrastra el PDF aquí
            </div>
            <div className="muted text-sm" style={{ marginBottom: 16 }}>
              o selecciónalo desde tu computadora · máx 50 MB
            </div>
            <label
              className="btn btn-primary btn-sm"
              style={{ cursor: 'pointer', display: 'inline-flex' }}
            >
              <Icon name="upload" size={13} /> Seleccionar archivo
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <div
                style={{
                  marginTop: 20,
                  padding: '10px 14px',
                  background: 'white',
                  borderRadius: 10,
                  border: '1px solid var(--ink-200)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Icon name="file-text" size={16} style={{ color: 'var(--blue-500)' }} />
                <div style={{ textAlign: 'left' }}>
                  <div className="fw-600" style={{ fontSize: 13 }}>{file.name}</div>
                  <div className="text-xs muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Procesar PDF</h3>
            <p className="card-subtitle">
              Próximamente: extracción automática con LLM. Hoy es un stub funcional.
            </p>
          </div>
        </div>
        <div className="card-body">
          <div
            style={{
              padding: 16,
              background: 'var(--amber-100)',
              borderRadius: 10,
              border: '1px solid #FCD34D',
              color: '#92400E',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
              <Icon name="warning" size={14} />
              <strong>En construcción</strong>
            </div>
            <div>
              La extracción automática del PDF (multi-contratos por archivo) se implementará en un siguiente
              sprint con una Edge Function que use un LLM para parsear órdenes de compra de Menita.
              Por ahora, captura los contratos con el formulario manual.
            </div>
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            <Link
              to="/app/importaciones/blufin/contratos/nuevo"
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <Icon name="plus" size={13} /> Captura manual en su lugar
            </Link>
            <button
              className="btn btn-outline"
              disabled={!file}
              onClick={() => toast.info('Función pendiente — el PDF no se procesará todavía.')}
            >
              <Icon name="download" size={13} /> Procesar PDF (stub)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
