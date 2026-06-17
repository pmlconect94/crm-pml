/**
 * Revisión de la factura del proveedor contra el contrato.
 * Página dedicada (form largo): elegir contrato → comparar línea-por-línea
 * (precargado del contrato, se edita solo lo que difiere) → subir PDF →
 * guardar (pendiente) o aprobar.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { StatusPill } from '@/features/blufin/StatusPill';
import { statusContrato } from '@/features/blufin/status';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtKg, fmtFechaCorta } from '@/lib/format';
import { fetchContratos } from '@/features/blufin/queries';
import {
  createFactura,
  uploadFacturaArchivo,
  type FacturaDiferencia,
  type NuevaFacturaLinea,
} from '@/features/blufin/facturas-queries';
import type { BlufinContratoConProductos } from '@/types/database';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};
const trimNum = (n: number, dec: number) => String(Number(n.toFixed(dec)));
const EPS_KG = 0.001;
const EPS_PRECIO = 0.0001;
const EPS_TOTAL = 0.01;

type LineaCmp = {
  descripcion: string;
  kg_contrato: number;
  precio_contrato: number;
  total_contrato: number;
  kg_factura: string;
  precio_factura: string;
  aceptado: boolean;
  nota: string;
};

export function BlufinFacturaRevisarPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: contratos = [] } = useQuery({
    queryKey: ['blufin_contratos', empresaId],
    queryFn: () => fetchContratos(empresaId),
  });

  const [contratoId, setContratoId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [lineas, setLineas] = useState<LineaCmp[]>([]);

  const contrato: BlufinContratoConProductos | undefined = useMemo(
    () => contratos.find((c) => c.id === contratoId),
    [contratos, contratoId],
  );

  // Precargar la comparación con los valores del contrato al elegirlo.
  useEffect(() => {
    if (!contrato) {
      setLineas([]);
      return;
    }
    setLineas(
      (contrato.productos ?? []).map((p) => {
        const kg = Number(p.kg ?? 0);
        const precio = Number(p.precio_usd ?? 0);
        const total = p.total_usd != null ? Number(p.total_usd) : kg * precio;
        return {
          descripcion: [p.descripcion, p.marca, p.talla].filter(Boolean).join(' · '),
          kg_contrato: kg,
          precio_contrato: precio,
          total_contrato: total,
          kg_factura: kg > 0 ? trimNum(kg, 3) : '',
          precio_factura: precio > 0 ? trimNum(precio, 4) : '',
          aceptado: true,
          nota: '',
        };
      }),
    );
  }, [contrato]);

  const setLinea = (idx: number, patch: Partial<LineaCmp>) =>
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  // Cálculo por línea: total factura, match y diferencias.
  const calc = (l: LineaCmp) => {
    const kgF = toNum(l.kg_factura);
    const prF = toNum(l.precio_factura);
    const totalF = kgF * prF;
    const difKg = Math.abs(kgF - l.kg_contrato) > EPS_KG;
    const difPr = Math.abs(prF - l.precio_contrato) > EPS_PRECIO;
    const difTot = Math.abs(totalF - l.total_contrato) > EPS_TOTAL;
    const diferencias: FacturaDiferencia[] = [];
    if (difKg) diferencias.push({ campo: 'kg', valorContrato: l.kg_contrato, valorFactura: kgF, delta: kgF - l.kg_contrato });
    if (difPr) diferencias.push({ campo: 'precio', valorContrato: l.precio_contrato, valorFactura: prF, delta: prF - l.precio_contrato });
    if (difTot) diferencias.push({ campo: 'total', valorContrato: l.total_contrato, valorFactura: totalF, delta: totalF - l.total_contrato });
    return { totalF, diferente: difKg || difPr, diferencias };
  };

  const totales = useMemo(() => {
    let tc = 0;
    let tf = 0;
    let nDif = 0;
    for (const l of lineas) {
      const { totalF, diferente } = calc(l);
      tc += l.total_contrato;
      tf += totalF;
      if (diferente) nDif += 1;
    }
    return { tc, tf, dif: tf - tc, nDif };
  }, [lineas]);

  const canSave = !!contratoId && lineas.length > 0;

  const guardar = useMutation({
    mutationFn: async (aprobar: boolean) => {
      let storage: { path: string | null; nombre: string | null } = { path: null, nombre: null };
      if (archivo) {
        const up = await uploadFacturaArchivo(archivo, contrato?.folio ?? 'factura');
        storage = { path: up.path, nombre: up.nombre };
      }
      const lineasPayload: NuevaFacturaLinea[] = lineas.map((l) => {
        const { totalF, diferente, diferencias } = calc(l);
        return {
          descripcion: l.descripcion,
          sku_contrato: null,
          kg_contrato: l.kg_contrato,
          precio_contrato: l.precio_contrato,
          total_contrato: l.total_contrato,
          kg_factura: toNum(l.kg_factura),
          precio_factura: toNum(l.precio_factura),
          total_factura: totalF,
          match: diferente ? 'diferente' : 'ok',
          diferencias,
          aceptado: l.aceptado,
          nota_revision: l.nota.trim() || null,
        };
      });
      await createFactura({
        contrato_id: contratoId,
        fecha_subida: fecha,
        nombre_archivo: storage.nombre,
        storage_path: storage.path,
        status: aprobar ? 'Aprobada' : 'Pendiente revisión',
        total_contrato: totales.tc,
        total_factura: totales.tf,
        lineas: lineasPayload,
      });
      return aprobar;
    },
    onSuccess: (aprobar) => {
      toast.success(aprobar ? 'Factura revisada y aprobada' : 'Factura guardada — pendiente de revisión');
      qc.invalidateQueries({ queryKey: ['blufin_facturas'] });
      navigate('/app/importaciones/blufin/facturas');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/app/importaciones/blufin/facturas')}
          style={{ marginBottom: 8, padding: '4px 8px' }}
        >
          <Icon name="arrow-left" size={13} /> Facturas
        </button>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Revisar factura del proveedor
        </h2>
        <p className="page-subtitle">Compara lo facturado contra lo contratado, línea por línea</p>
      </PageEnter>

      {/* Selección de contrato + datos de la factura */}
      <div className="card" style={{ marginBottom: 12, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr', gap: 12 }}>
          <div>
            <label className="field-label">Contrato * (escribe el número)</label>
            <Combobox
              options={contratos.map((c) => ({
                id: c.id,
                label: `${c.folio} · ${c.status} · ${fmtUSD(c.total_usd)}`,
              }))}
              value={contratoId || null}
              onChange={(id) => setContratoId(id ?? '')}
              placeholder="MCO-CV-003502…"
            />
          </div>
          <div>
            <label className="field-label">Fecha de la factura</label>
            <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="field-label">PDF / foto de la factura (opcional)</label>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="field-input"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              style={{ padding: '6px 8px' }}
            />
            {archivo && (
              <div className="text-xs muted" style={{ marginTop: 4 }}>
                <Icon name="receipt" size={11} /> {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
              </div>
            )}
          </div>
        </div>

        {contrato && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--ink-100)',
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'Contrato', value: contrato.folio, mono: true },
              { label: 'Contenedor', value: contrato.contenedor ?? 'Por asignar', mono: true },
              { label: 'ETA bodega', value: fmtFechaCorta(contrato.eta_bodega) },
              { label: 'Total kg', value: fmtKg(contrato.total_kg), mono: true },
              { label: 'Total contrato', value: fmtUSD(contrato.total_usd), mono: true },
            ].map((it) => (
              <div key={it.label}>
                <div className="text-xs muted">{it.label}</div>
                <div className={`text-sm fw-600 ${it.mono ? 'mono' : ''}`}>{it.value}</div>
              </div>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              <StatusPill status={statusContrato(contrato)} />
            </div>
          </div>
        )}
      </div>

      {/* Comparación línea-por-línea */}
      {!contratoId ? (
        <div className="card">
          <div className="empty">
            <Icon name="receipt" size={36} />
            <div className="empty-title">Elige un contrato para empezar</div>
            <p className="muted">
              Cargaremos sus productos con los kg y precios contratados; tú capturas lo que dice la
              factura y marcamos las diferencias.
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 12, overflowX: 'auto' }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--ink-100)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="fw-700" style={{ fontSize: 13 }}>
              Comparación factura vs contrato
            </span>
            <span className="text-xs muted">
              {totales.nDif > 0 ? (
                <span className="fw-700" style={{ color: 'var(--amber-500)' }}>
                  {totales.nDif} línea{totales.nDif > 1 ? 's' : ''} con diferencia
                </span>
              ) : (
                <span className="fw-700" style={{ color: 'var(--green-500)' }}>
                  Todo coincide
                </span>
              )}
            </span>
          </div>
          <table className="tbl" style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ textAlign: 'right' }}>Kg contrato</th>
                <th style={{ width: 110 }}>Kg factura</th>
                <th style={{ textAlign: 'right' }}>$/kg contrato</th>
                <th style={{ width: 110 }}>$/kg factura</th>
                <th style={{ textAlign: 'right' }}>Total contrato</th>
                <th style={{ textAlign: 'right' }}>Total factura</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center', width: 50 }}>OK</th>
                <th style={{ width: 140 }}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => {
                const { totalF, diferente } = calc(l);
                const borde = diferente ? 'var(--amber-500)' : undefined;
                return (
                  <tr key={i}>
                    <td className="text-sm fw-600" style={{ minWidth: 180 }}>
                      {l.descripcion || 'Producto'}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{fmtKg(l.kg_contrato)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        className="field-input mono"
                        value={l.kg_factura}
                        onChange={(e) => setLinea(i, { kg_factura: e.target.value })}
                        style={{ fontWeight: 700, borderColor: borde }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      ${l.precio_contrato.toFixed(4)}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        className="field-input mono"
                        value={l.precio_factura}
                        onChange={(e) => setLinea(i, { precio_factura: e.target.value })}
                        style={{ fontWeight: 700, borderColor: borde }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{fmtUSD(l.total_contrato)}</td>
                    <td
                      style={{ textAlign: 'right' }}
                      className="mono fw-700"
                    >
                      {fmtUSD(totalF)}
                    </td>
                    <td>
                      {diferente ? (
                        <span className="badge badge-amber">Diferente</span>
                      ) : (
                        <span className="badge badge-green">OK</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={l.aceptado}
                        onChange={(e) => setLinea(i, { aceptado: e.target.checked })}
                        title="Aceptar esta línea"
                      />
                    </td>
                    <td>
                      <input
                        className="field-input"
                        value={l.nota}
                        onChange={(e) => setLinea(i, { nota: e.target.value })}
                        placeholder="Motivo…"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer sticky con totales + acciones */}
      {!!contratoId && (
        <div
          className="card"
          style={{
            position: 'sticky',
            bottom: 12,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 -4px 16px rgba(10,37,64,0.08)',
          }}
        >
          <div className="hstack" style={{ gap: 20 }}>
            <div>
              <div className="text-xs muted">Total contrato</div>
              <div className="mono fw-700">{fmtUSD(totales.tc)}</div>
            </div>
            <div>
              <div className="text-xs muted">Total factura</div>
              <div className="mono fw-700">{fmtUSD(totales.tf)}</div>
            </div>
            <div>
              <div className="text-xs muted">Diferencia</div>
              <div
                className="mono fw-700"
                style={{
                  color:
                    Math.abs(totales.dif) < 0.01
                      ? 'var(--green-500)'
                      : totales.dif > 0
                        ? 'var(--red-500)'
                        : 'var(--amber-500)',
                }}
              >
                {Math.abs(totales.dif) < 0.01
                  ? 'Sin diferencia'
                  : `${totales.dif > 0 ? '+' : '−'}${fmtUSD(Math.abs(totales.dif))}`}
              </div>
            </div>
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={!canSave || guardar.isPending}
              onClick={() => guardar.mutate(false)}
            >
              {guardar.isPending ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="check" size={13} />}
              Guardar (pendiente)
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!canSave || guardar.isPending}
              onClick={() => guardar.mutate(true)}
            >
              {guardar.isPending ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="check-circle" size={13} />}
              Aprobar factura
            </button>
          </div>
        </div>
      )}
    </>
  );
}
