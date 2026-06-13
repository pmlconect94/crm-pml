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
import { BlufinPagosPage } from '@/pages/blufin/BlufinPagosPage';
import { BlufinPagoMultiplePage } from '@/pages/blufin/BlufinPagoMultiplePage';
import { BlufinRecepcionPage } from '@/pages/blufin/BlufinRecepcionPage';
import { BlufinRecepcionRegistrarPage } from '@/pages/blufin/BlufinRecepcionRegistrarPage';
import { BlufinProductosPage } from '@/pages/blufin/BlufinProductosPage';
import { BlufinCostosPage } from '@/pages/blufin/BlufinCostosPage';

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
            <Route path="contratos/carga-masiva" element={<BlufinCargaMasivaPage />} />
            <Route path="pagos" element={<BlufinPagosPage />} />
            <Route path="pagos/multiple" element={<BlufinPagoMultiplePage />} />
            <Route path="recepcion" element={<BlufinRecepcionPage />} />
            <Route path="recepcion/registrar/:contratoId" element={<BlufinRecepcionRegistrarPage />} />
            <Route path="productos" element={<BlufinProductosPage />} />
            <Route path="costos" element={<BlufinCostosPage />} />
          </Route>

          {/* Stubs */}
          <Route
            path="camanchaca/*"
            element={<PlaceholderPage title="Salmones Camanchaca" subtitle="Próximamente" />}
          />
          <Route
            path="neptuno/*"
            element={<PlaceholderPage title="Neptuno Seafood" subtitle="Próximamente" />}
          />
        </Route>

        {/* Resto de departamentos */}
        <Route path="logistica" element={<PlaceholderPage title="Logística" subtitle="Próximamente" />} />
        <Route path="administracion" element={<PlaceholderPage title="Administración" subtitle="Próximamente" />} />
        <Route path="ventas" element={<PlaceholderPage title="Ventas" subtitle="Próximamente" />} />
        <Route path="cobranza" element={<PlaceholderPage title="Cobranza" subtitle="Próximamente" />} />
        <Route path="contabilidad" element={<PlaceholderPage title="Contabilidad" subtitle="Próximamente" />} />
        <Route path="rh" element={<PlaceholderPage title="Recursos Humanos" subtitle="Próximamente" />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
