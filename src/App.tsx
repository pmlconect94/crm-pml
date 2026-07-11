import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ImportacionesPickerPage } from '@/pages/ImportacionesPickerPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { BlufinLayout } from '@/pages/blufin/BlufinLayout';
import { BlufinContratosListPage } from '@/pages/blufin/BlufinContratosListPage';
import { BlufinNuevoContratoPage } from '@/pages/blufin/BlufinNuevoContratoPage';
import { BlufinCargaMasivaPage } from '@/pages/blufin/BlufinCargaMasivaPage';
import { BlufinCargaMasivaRevisarPage } from '@/pages/blufin/BlufinCargaMasivaRevisarPage';
import { BlufinPagosPage } from '@/pages/blufin/BlufinPagosPage';
import { BlufinPagoMultiplePage } from '@/pages/blufin/BlufinPagoMultiplePage';
import { BlufinRecepcionPage } from '@/pages/blufin/BlufinRecepcionPage';
import { BlufinRecepcionRegistrarPage } from '@/pages/blufin/BlufinRecepcionRegistrarPage';
import { BlufinProductosPage } from '@/pages/blufin/BlufinProductosPage';
import { BlufinCostosPage } from '@/pages/blufin/BlufinCostosPage';
import { BlufinCalendarioPage } from '@/pages/blufin/BlufinCalendarioPage';
import { BlufinNotasCreditoPage } from '@/pages/blufin/BlufinNotasCreditoPage';
import { BlufinFacturasPage } from '@/pages/blufin/BlufinFacturasPage';
import { BlufinFacturaRevisarPage } from '@/pages/blufin/BlufinFacturaRevisarPage';
// Camanchaca (SA + MX)
import { CamanchacaLayout } from '@/pages/camanchaca/CamanchacaLayout';
import { CamSAPlaneacionPage } from '@/pages/camanchaca/CamSAPlaneacionPage';
import { CamSAContenedoresListPage } from '@/pages/camanchaca/CamSAContenedoresListPage';
import { CamSANuevoContenedorPage } from '@/pages/camanchaca/CamSANuevoContenedorPage';
import { CamSAPagosPage } from '@/pages/camanchaca/CamSAPagosPage';
import { CamSARecepcionPage } from '@/pages/camanchaca/CamSARecepcionPage';
import { CamSARecepcionRegistrarPage } from '@/pages/camanchaca/CamSARecepcionRegistrarPage';
import { CamSACostosPage } from '@/pages/camanchaca/CamSACostosPage';
import { CamSANotasCreditoPage } from '@/pages/camanchaca/CamSANotasCreditoPage';
import { CamSACalendarioPage } from '@/pages/camanchaca/CamSACalendarioPage';
import { CamanchacaProductosPage } from '@/pages/camanchaca/CamanchacaProductosPage';
import { CamMXComprasListPage } from '@/pages/camanchaca/CamMXComprasListPage';
import { CamMXNuevaCompraPage } from '@/pages/camanchaca/CamMXNuevaCompraPage';
import { CamMXPagosPage } from '@/pages/camanchaca/CamMXPagosPage';
import { CamMXNotasCreditoPage } from '@/pages/camanchaca/CamMXNotasCreditoPage';
import { CamMXCostosPage } from '@/pages/camanchaca/CamMXCostosPage';
// Neptuno
import { NeptunoLayout } from '@/pages/neptuno/NeptunoLayout';
import { NeptunoFacturasListPage } from '@/pages/neptuno/NeptunoFacturasListPage';
import { NeptunoNuevaFacturaPage } from '@/pages/neptuno/NeptunoNuevaFacturaPage';
import { NeptunoPagosPage } from '@/pages/neptuno/NeptunoPagosPage';
import { NeptunoNotasCreditoPage } from '@/pages/neptuno/NeptunoNotasCreditoPage';
import { NeptunoCostosPage } from '@/pages/neptuno/NeptunoCostosPage';
import { NeptunoCalendarioPage } from '@/pages/neptuno/NeptunoCalendarioPage';
import { NeptunoProductosPage } from '@/pages/neptuno/NeptunoProductosPage';
// Contabilidad
import { ContabilidadFacturasPage } from '@/pages/contabilidad/ContabilidadFacturasPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Importaciones */}
        <Route path="importaciones">
          <Route index element={<ImportacionesPickerPage />} />

          {/* Blufin */}
          <Route path="blufin" element={<BlufinLayout />}>
            <Route index element={<Navigate to="contratos" replace />} />
            <Route path="contratos" element={<BlufinContratosListPage />} />
            <Route path="contratos/nuevo" element={<BlufinNuevoContratoPage />} />
            <Route path="contratos/editar/:contratoId" element={<BlufinNuevoContratoPage />} />
            <Route path="contratos/carga-masiva" element={<BlufinCargaMasivaPage />} />
            <Route path="contratos/carga-masiva/:loteId" element={<BlufinCargaMasivaRevisarPage />} />
            <Route path="pagos" element={<BlufinPagosPage />} />
            <Route path="pagos/multiple" element={<BlufinPagoMultiplePage />} />
            <Route path="recepcion" element={<BlufinRecepcionPage />} />
            <Route path="recepcion/registrar/:contratoId" element={<BlufinRecepcionRegistrarPage />} />
            <Route path="productos" element={<BlufinProductosPage />} />
            <Route path="costos" element={<BlufinCostosPage />} />
            <Route path="calendario" element={<BlufinCalendarioPage />} />
            <Route path="notas-credito" element={<BlufinNotasCreditoPage />} />
            <Route path="facturas" element={<BlufinFacturasPage />} />
            <Route path="facturas/revisar" element={<BlufinFacturaRevisarPage />} />
          </Route>

          {/* Camanchaca (SA + MX) */}
          <Route path="camanchaca" element={<CamanchacaLayout />}>
            <Route index element={<Navigate to="sa/contenedores" replace />} />
            <Route path="sa">
              <Route index element={<Navigate to="contenedores" replace />} />
              <Route path="planeacion" element={<CamSAPlaneacionPage />} />
              <Route path="contenedores" element={<CamSAContenedoresListPage />} />
              <Route path="contenedores/nuevo" element={<CamSANuevoContenedorPage />} />
              <Route path="pagos" element={<CamSAPagosPage />} />
              <Route path="recepcion" element={<CamSARecepcionPage />} />
              <Route path="recepcion/registrar/:contenedorId" element={<CamSARecepcionRegistrarPage />} />
              <Route path="costos" element={<CamSACostosPage />} />
              <Route path="notas-credito" element={<CamSANotasCreditoPage />} />
              <Route path="calendario" element={<CamSACalendarioPage />} />
              <Route path="productos" element={<CamanchacaProductosPage />} />
            </Route>
            <Route path="mx">
              <Route index element={<Navigate to="compras" replace />} />
              <Route path="compras" element={<CamMXComprasListPage />} />
              <Route path="compras/nueva" element={<CamMXNuevaCompraPage />} />
              <Route path="pagos" element={<CamMXPagosPage />} />
              <Route path="notas-credito" element={<CamMXNotasCreditoPage />} />
              <Route path="costos" element={<CamMXCostosPage />} />
              <Route path="productos" element={<CamanchacaProductosPage />} />
            </Route>
          </Route>

          {/* Neptuno */}
          <Route path="neptuno" element={<NeptunoLayout />}>
            <Route index element={<Navigate to="facturas" replace />} />
            <Route path="facturas" element={<NeptunoFacturasListPage />} />
            <Route path="facturas/nueva" element={<NeptunoNuevaFacturaPage />} />
            <Route path="pagos" element={<NeptunoPagosPage />} />
            <Route path="notas-credito" element={<NeptunoNotasCreditoPage />} />
            <Route path="costos" element={<NeptunoCostosPage />} />
            <Route path="calendario" element={<NeptunoCalendarioPage />} />
            <Route path="productos" element={<NeptunoProductosPage />} />
          </Route>
        </Route>

        {/* Resto de departamentos */}
        <Route path="logistica" element={<PlaceholderPage title="Logística" subtitle="Próximamente" />} />
        <Route path="administracion" element={<PlaceholderPage title="Administración" subtitle="Próximamente" />} />
        <Route path="ventas" element={<PlaceholderPage title="Ventas" subtitle="Próximamente" />} />
        <Route path="cobranza" element={<PlaceholderPage title="Cobranza" subtitle="Próximamente" />} />
        <Route path="contabilidad" element={<ContabilidadFacturasPage />} />
        <Route path="rh" element={<PlaceholderPage title="Recursos Humanos" subtitle="Próximamente" />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
