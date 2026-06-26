import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { CamSAStatusPill } from '@/features/camanchaca/CamSAStatusPill';
import { statusContenedorSA } from '@/features/camanchaca/sa-status';
import { useAuth } from '@/lib/auth';
import { fmtKg, fmtUSD, fmtFechaCorta } from '@/lib/format';
import { fetchCatalogosSA } from '@/features/camanchaca/sa-queries';
import { createRecepcionSA, fetchContenedorSAById } from '@/features/camanchaca/sa-recepcion-queries';

type LineaForm = {
  sku_id: string | null;
  descripcion: string;
  kg_contratados: number;
  kg_caja: number | null;
  kg_recibidos: string;
  cajas: string;
  observaciones: string;
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const trimNum = (n: number, decimales: number) => String(Number(n.toFixed(decimales)));
const cajasDesdeKg = (kg: number, kgCaja: number | null) => (kgCaja && kgCaja > 0 ? trimNum(kg / kgCaja, 2) : '');
const kgDesdeCajas = (cajas: number, kgCaja: number | null) => (kgCaja && kgCaja > 0 ? trimNum(cajas * kgCaja, 3) : '');

export function CamSARecepcionRegistrarPage() {
  const { contenedorId } = useParams<{ contenedorId: string }>();
  const { empresaId, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (user && !user.capturar) navigate('/app/importaciones/camanchaca/sa/recepcion', { replace: true });
  }, [user, navigate]);

  const { data: contenedor, isLoading } = useQuery({
    queryKey: ['cam_sa_contenedor', contenedorId],
    queryFn: () => fetchContenedorSAById(contenedorId!),
    enabled: !!contenedorId,
  });
  const { data: cat } = useQuery({
    queryKey: ['cam_sa_catalogos', empresaId],
    queryFn: () => fetchCatalogosSA(empresaId),
  });

  const [fecha, setFecha] = useState(hoyISO());
  const [bodegaId, setBodegaId] = useState<string>('');
  const [presRecibida, setPresRecibida] = useState('');
  const [intelisis, setIntelisis] = useState('');
  const [lote, setLote] = useState('');
  const [obsGenerales, setObsGenerales] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([]);

  useEffect(() => {
    if (!contenedor) return;
    setLineas(
      (contenedor.productos ?? []).map((p) => {
        const kg = Number(p.kg ?? 0);
        const kgCaja = p.kg_caja != null ? Number(p.kg_caja) : null;
        return {
          sku_id: p.sku_id,
          descripcion: [p.descripcion, p.marca, p.talla].filter(Boolean).join(' · '),
          kg_contratados: kg,
          kg_caja: kgCaja,
          kg_recibidos: kg > 0 ? trimNum(kg, 3) : '',
          cajas: p.cajas != null ? String(p.cajas) : kg > 0 ? cajasDesdeKg(kg, kgCaja) : '',
          observaciones: '',
        };
      }),
    );
    setPresRecibida(contenedor.presentacion ?? '');
    setLote(contenedor.lote ?? '');
  }, [contenedor]);

  useEffect(() => {
    if (!bodegaId && cat?.bodegas.length) {
      const porDefecto = contenedor?.bodega_destino
        ? cat.bodegas.find((b) => b.nombre === contenedor.bodega_destino)
        : null;
      setBodegaId(String((porDefecto ?? cat.bodegas[0]).id));
    }
  }, [cat, contenedor, bodegaId]);

  const updateLinea = (idx: number, field: 'observaciones', value: string) =>
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));

  const updateKg = (idx: number, value: string) =>
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const kg = parseFloat(value);
        return { ...l, kg_recibidos: value, cajas: !Number.isNaN(kg) ? cajasDesdeKg(kg, l.kg_caja) : '' };
      }),
    );

  const updateCajas = (idx: number, value: string) =>
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const cajas = parseFloat(value);
        return { ...l, cajas: value, kg_recibidos: !Number.isNaN(cajas) ? kgDesdeCajas(cajas, l.kg_caja) : l.kg_recibidos };
      }),
    );

  const totales = useMemo(() => {
    const contratados = lineas.reduce((s, l) => s + l.kg_contratados, 0);
    const recibidos = lineas.reduce((s, l) => s + (parseFloat(l.kg_recibidos) || 0), 0);
    return { contratados, recibidos, diferencia: recibidos - contratados };
  }, [lineas]);

  const faltantes = useMemo(
    () =>
      lineas.filter((l) => {
        const kg = parseFloat(l.kg_recibidos);
        return l.kg_recibidos !== '' && !Number.isNaN(kg) && kg < l.kg_contratados;
      }),
    [lineas],
  );

  const faltaIntelisis = intelisis.trim() === '';
  const canConfirm =
    !!fecha &&
    !faltaIntelisis &&
    lineas.length > 0 &&
    lineas.every((l) => l.kg_recibidos !== '' && (parseFloat(l.kg_recibidos) || 0) > 0);

  const crearMut = useMutation({
    mutationFn: () => {
      const bodega = cat?.bodegas.find((b) => String(b.id) === bodegaId) ?? null;
      return createRecepcionSA({
        contenedor_id: contenedor!.id,
        fecha,
        bodega_id: bodega?.id ?? null,
        bodega_nombre: bodega?.nombre ?? null,
        entrada_intelisis: intelisis.trim() || null,
        presentacion_recibida: presRecibida || null,
        observaciones: obsGenerales.trim() || null,
        lote: lote.trim() || null,
        lineas: lineas.map((l) => ({
          sku_id: l.sku_id,
          kg_contratados: l.kg_contratados,
          kg_recibidos: parseFloat(l.kg_recibidos) || 0,
          observaciones: l.observaciones.trim() || null,
        })),
      });
    },
    onSuccess: () => {
      toast.success(`Recepción de ${contenedor?.folio_interno} registrada — contenedor Entregado`);
      qc.invalidateQueries({ queryKey: ['cam_sa_recepciones'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores_por_recibir'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedor', contenedorId] });
      navigate('/app/importaciones/camanchaca/sa/recepcion');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="skeleton-bar" style={{ width: '30%', marginBottom: 10 }} />
        <div className="skeleton-bar" style={{ width: '60%' }} />
      </div>
    );
  }

  if (!contenedor) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="alert" size={36} />
          <div className="empty-title">Contenedor no encontrado</div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/app/importaciones/camanchaca/sa/recepcion')} style={{ marginTop: 12 }}>
            <Icon name="arrow-left" size={13} /> Volver a Recepción
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/app/importaciones/camanchaca/sa/recepcion')}
          style={{ marginBottom: 8, padding: '4px 8px' }}
        >
          <Icon name="arrow-left" size={13} /> Recepción
        </button>
        <div className="hstack" style={{ gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Registrar recepción de mercancía
          </h2>
          <span className="mono fw-700 text-sm">{contenedor.folio_interno}</span>
          <CamSAStatusPill status={statusContenedorSA(contenedor)} />
        </div>
      </PageEnter>

      <div className="card" style={{ marginBottom: 12, padding: '10px 16px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Contenedor', value: contenedor.contenedor ?? 'Por asignar', mono: true },
          { label: 'ETA bodega', value: fmtFechaCorta(contenedor.eta_bodega) },
          { label: 'Total kg', value: fmtKg(contenedor.total_kg), mono: true },
          { label: 'Total USD', value: fmtUSD(contenedor.total_usd), mono: true },
          { label: 'Presentación pactada', value: contenedor.presentacion ?? '—', blue: true },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-xs muted">{item.label}</div>
            <div className={`text-sm fw-600 ${item.mono ? 'mono' : ''}`} style={item.blue ? { color: 'var(--blue-500)' } : undefined}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 16 }}>
        <div className="fw-700" style={{ fontSize: 13, marginBottom: 12 }}>Datos del contenedor</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <label className="field-label">Fecha de recepción *</label>
            <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Bodega</label>
            <select className="field-input" value={bodegaId} onChange={(e) => setBodegaId(e.target.value)}>
              {(cat?.bodegas ?? []).map((b) => (
                <option key={b.id} value={String(b.id)}>{b.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Presentación recibida</label>
            <select className="field-input" value={presRecibida} onChange={(e) => setPresRecibida(e.target.value)}>
              <option value="">— Selecciona —</option>
              <option value="Paletizado">Paletizado</option>
              <option value="Granel">Granel</option>
            </select>
          </div>
          <div>
            <label className="field-label">Lote</label>
            <input className="field-input mono" value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Lote del contenedor" />
            <div className="text-xs muted" style={{ marginTop: 3 }}>Se captura al recibir — actualiza el contenedor</div>
          </div>
          <div>
            <label className="field-label">Entrada de compra Intelisis *</label>
            <input
              className="field-input mono"
              value={intelisis}
              onChange={(e) => setIntelisis(e.target.value)}
              placeholder="EC-2026-XXXX"
              style={{ borderColor: !faltaIntelisis ? 'var(--green-500)' : undefined }}
            />
            <div className="text-xs" style={{ marginTop: 3, color: faltaIntelisis ? 'var(--amber-500)' : 'var(--ink-500)' }}>
              {faltaIntelisis ? 'Obligatoria — sin entrada Intelisis no se puede confirmar' : 'Entrada registrada en el ERP'}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--ink-100)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="fw-700" style={{ fontSize: 13 }}>Verificación por SKU</span>
          <span className="text-xs muted">
            {totales.recibidos > 0 ? (
              <span className="mono fw-700" style={{ color: totales.recibidos < totales.contratados ? 'var(--red-500)' : 'var(--green-500)' }}>
                {fmtKg(totales.recibidos)} / {fmtKg(totales.contratados)}
              </span>
            ) : (
              <span className="mono">{fmtKg(totales.contratados)} contratados</span>
            )}
          </span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Producto</th>
              <th style={{ textAlign: 'right', width: 130 }}>Kg contratados</th>
              <th style={{ width: 140 }}>Kg recibidos *</th>
              <th style={{ width: 110 }}>Cajas</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const kg = parseFloat(l.kg_recibidos) || 0;
              const hayFaltante = l.kg_recibidos !== '' && kg < l.kg_contratados;
              const completo = l.kg_recibidos !== '' && kg >= l.kg_contratados;
              const borde = hayFaltante ? 'var(--red-500)' : completo ? 'var(--green-500)' : undefined;
              return (
                <tr key={i}>
                  <td>
                    <div className="text-sm fw-600">{l.descripcion || 'Producto sin descripción'}</div>
                    {l.kg_caja != null && l.kg_caja > 0 && (
                      <div className="text-xs muted mono">{trimNum(l.kg_caja, 3)} kg/caja</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtKg(l.kg_contratados)}</td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="field-input mono"
                      value={l.kg_recibidos}
                      onChange={(e) => updateKg(i, e.target.value)}
                      placeholder={String(l.kg_contratados)}
                      style={{ fontWeight: 700, borderColor: borde }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="field-input mono"
                      value={l.cajas}
                      onChange={(e) => updateCajas(i, e.target.value)}
                      disabled={!l.kg_caja || l.kg_caja <= 0}
                      placeholder={!l.kg_caja || l.kg_caja <= 0 ? '—' : ''}
                      style={{ fontWeight: 700, borderColor: borde }}
                    />
                  </td>
                  <td>
                    <input
                      className="field-input"
                      value={l.observaciones}
                      onChange={(e) => updateLinea(i, 'observaciones', e.target.value)}
                      placeholder="Notas de la línea…"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {faltantes.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            padding: 14,
            background: 'color-mix(in srgb, var(--amber-500) 6%, white)',
            border: '1px solid color-mix(in srgb, var(--amber-500) 30%, white)',
          }}
        >
          <div className="hstack" style={{ gap: 8, marginBottom: 8 }}>
            <Icon name="alert" size={14} />
            <span className="fw-700 text-sm" style={{ color: '#92400E' }}>
              {faltantes.length} faltante{faltantes.length > 1 ? 's' : ''} detectado{faltantes.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="vstack" style={{ gap: 4 }}>
            {faltantes.map((l, i) => (
              <div key={i} className="text-xs" style={{ color: 'var(--ink-700)' }}>
                <span className="fw-700" style={{ color: 'var(--red-500)' }}>FALTANTE</span> · {l.descripcion} ·{' '}
                <span className="mono fw-600">−{fmtKg(l.kg_contratados - (parseFloat(l.kg_recibidos) || 0))}</span>
              </div>
            ))}
          </div>
          <div className="text-xs muted" style={{ marginTop: 8 }}>
            Si el proveedor reconoce un descuento por el faltante, captúralo en <strong>Notas de crédito</strong> (monto USD + motivo).
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12, padding: 16 }}>
        <label className="field-label">Observaciones generales (opcional)</label>
        <textarea
          className="field-input"
          rows={2}
          value={obsGenerales}
          onChange={(e) => setObsGenerales(e.target.value)}
          placeholder="Estado del contenedor, incidencias generales…"
          style={{ resize: 'vertical' }}
        />
      </div>

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
            <div className="text-xs muted">Kg recibidos</div>
            <div className="mono fw-700">{fmtKg(totales.recibidos)}</div>
          </div>
          <div>
            <div className="text-xs muted">Kg contratados</div>
            <div className="mono fw-700">{fmtKg(totales.contratados)}</div>
          </div>
          <div>
            <div className="text-xs muted">Diferencia</div>
            <div
              className="mono fw-700"
              style={{ color: totales.recibidos === 0 ? undefined : totales.diferencia < 0 ? 'var(--red-500)' : 'var(--green-500)' }}
            >
              {totales.recibidos === 0 ? '—' : `${totales.diferencia < 0 ? '−' : ''}${fmtKg(Math.abs(totales.diferencia))}`}
            </div>
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/importaciones/camanchaca/sa/recepcion')}>
            Cancelar
          </button>
          <button className="btn btn-primary btn-sm" disabled={!canConfirm || crearMut.isPending} onClick={() => crearMut.mutate()}>
            {crearMut.isPending ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="check" size={13} />}
            Confirmar recepción
          </button>
        </div>
      </div>
    </>
  );
}
