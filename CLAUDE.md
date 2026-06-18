# CRM Grupo Lizárraga — Guía maestra para Claude Code

> **LEER COMPLETO ANTES DE ESCRIBIR UNA SOLA LÍNEA DE CÓDIGO.**
> Este documento es la fuente de verdad del proyecto. Define la arquitectura, las reglas, los flujos de negocio, el esquema de base de datos y todo lo que se necesita para construir la plataforma correctamente desde el primer intento.

---

## 1. Visión del producto

**CRM empresarial completo para Grupo Lizárraga** — empresa familiar dedicada a la importación, distribución y producción de productos del mar en México.

### Empresas del grupo

| Empresa | Tipo | ID interno | Estado |
|---|---|---|---|
| Productos Marinos Lizárraga, S. de R.L. de C.V. | Distribuidora — importa y vende | `pml` | Activa en plataforma |
| Marlin Lizárraga, S. de R.L. de C.V. | Productora — maquila para PML | `marlin` | Deshabilitada por ahora |

### Ciclo del negocio que cubre la plataforma

```
Importación → Logística → Inventario → Ventas → Cobranza → Contabilidad → RH
```

### Estado actual de construcción

**Solo el módulo de Importaciones está activo.** Todos los demás módulos existen en la UI como "Próximamente" y se irán activando uno a uno conforme se diseñen y validen en el prototipo HTML.

**El objetivo es construir la plataforma completa** — no solo importaciones. Importaciones es el primer módulo porque es donde el negocio tiene más urgencia. Cada módulo nuevo seguirá el mismo patrón.

---

## 2. Stack de producción (lo que Claude Code debe construir)

```
Frontend:    Vite + React 18 + TypeScript
Backend:     Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
Auth:        Supabase Auth con Google Workspace OAuth2 Y Microsoft Entra ID (SSO corporativo)
Estilos:     Tailwind CSS v3 + design tokens del sistema (ver sección 9)
Routing:     React Router v6
Estado:      React Query (TanStack Query) para datos del servidor, Zustand para UI local
Fonts:       Inter (sans-serif) + JetBrains Mono (monoespaciado) — Google Fonts
Deploy:      Vercel (frontend) + Supabase cloud (backend)
```

### Lo que NO usar
- Redux (demasiado pesado para este proyecto)
- Next.js (no es necesario SSR)
- Axios (usar fetch nativo o React Query)
- Cualquier CSS-in-JS (usar Tailwind)

---

## 3. Referencia del prototipo HTML

El prototipo en este repositorio es el **spec de UI definitivo**. Antes de construir cualquier pantalla, revisar cómo está implementada en el prototipo.

### Archivos del prototipo

```
CRM Lizarraga.html          ← Shell completo, login, switcher, routing
styles.css                   ← Design system con variables CSS
data.js                      ← Datos mock generales (CRM_DATA)
blufin-data.js               ← Datos mock Blufin Seafood
calendario-data.js           ← Datos calendario Blufin
camanchaca-data.js           ← Datos mock Camanchaca (SA + MX)
neptuno-data.js              ← Datos mock Neptuno
catalogo.jsx                 ← Componente SkuCatalogo (compartido entre los 3 módulos)
components.jsx               ← Icon, Sidebar, Topbar, DEPTS, logos
dashboards.jsx               ← Dashboards + picker de proveedores
tweaks-panel.jsx             ← Panel de diseño (ignorar en producción)

── Blufin Seafood ─────────────────────────────────────────────────────────────
blufin.jsx / blufin-bulk.jsx / blufin-pagos.jsx / blufin-contrato.jsx
blufin-recepcion.jsx / blufin-notas.jsx / blufin-facturas.jsx
blufin-calendario.jsx / blufin-costos.jsx

── Salmones Camanchaca ────────────────────────────────────────────────────────
camanchaca-sa-forms.jsx / camanchaca.jsx / camanchaca-pagos.jsx
camanchaca-recepcion.jsx / camanchaca-mx.jsx / camanchaca-costos.jsx
camanchaca-calendario.jsx

── Neptuno Seafood ────────────────────────────────────────────────────────────
neptuno.jsx

── Assets ─────────────────────────────────────────────────────────────────────
assets/marlin-logo.png           ← Fondo oscuro nativo
assets/pml-logo.png              ← Fondo blanco (no usar sobre oscuro)
assets/pml-logo-transparent.png  ← Sin fondo (usar sobre oscuro)
assets/blufin-logo.png           ← Logo Blufin Seafood
assets/camanchaca-logo.png       ← Logo Salmones Camanchaca
assets/neptuno-logo.png          ← Logo Neptuno Alimentos del Mar
```

---

## 4. Arquitectura de navegación (producción)

```
/ (login)
  └── /app
        ├── /dashboard
        ├── /importaciones
        │     ├── /importaciones/blufin
        │     │     ├── contratos
        │     │     ├── recepcion
        │     │     ├── pagos
        │     │     ├── notas-credito
        │     │     ├── facturas
        │     │     ├── calendario
        │     │     ├── costos
        │     │     └── productos (catálogo SKUs)
        │     ├── /importaciones/camanchaca
        │     │     ├── [sa] contenedores / pagos / recepcion / calendario / costos / productos
        │     │     └── [mx] compras / pagos / costos / calendario / productos
        │     └── /importaciones/neptuno
        │           ├── facturas
        │           ├── pagos
        │           ├── notas-credito
        │           ├── costos
        │           ├── calendario
        │           └── productos (catálogo SKUs)
        ├── /logistica          ← PRÓXIMAMENTE
        ├── /administracion     ← PRÓXIMAMENTE
        ├── /ventas             ← PRÓXIMAMENTE
        ├── /cobranza           ← PRÓXIMAMENTE
        ├── /contabilidad       ← PRÓXIMAMENTE
        └── /rh                 ← PRÓXIMAMENTE
```

### Protección de rutas
- Todo `/app/*` requiere sesión activa
- Sidebar muestra solo departamentos permitidos según el rol del usuario
- Un `coord_logistica` no puede ver ni acceder a `/administracion`, `/ventas`, etc.
- Redirigir a `/login` si no hay sesión, a `/app/dashboard` si la hay

---

## 5. Autenticación y roles

### Proveedores de auth
1. **Google Workspace** — para cuentas @lizarraga.mx
2. **Microsoft Entra ID (Azure AD)** — SSO corporativo alternativo
3. **Email/Password** — para cuentas locales de prueba

### Roles y permisos

```typescript
type Rol = 'admin_total' | 'director_ops' | 'coord_logistica' | 'gerente_rh' | 'contador' | 'vendedor';

const PERMISOS: Record<Rol, { depts: string[] }> = {
  admin_total:     { depts: ['importaciones','logistica','administracion','ventas','cobranza','contabilidad','rh'] },
  director_ops:    { depts: ['importaciones','logistica','administracion','rh'] },
  coord_logistica: { depts: ['importaciones','logistica'] },
  gerente_rh:      { depts: ['rh','administracion'] },
  contador:        { depts: ['contabilidad','cobranza','administracion'] },
  vendedor:        { depts: ['ventas'] },
};
```

Los roles se guardan en la tabla `usuarios` y se leen del JWT de Supabase Auth. Usar RLS para filtrar datos por `empresa_id` automáticamente.

### Flujo de alta de usuarios
1. El usuario llega a `/registro` y llena nombre, correo, empresa
2. O hace SSO con Google/Microsoft → se crea cuenta en `usuarios` con `activo = false`
3. Un `admin_total` activa la cuenta y asigna rol desde el panel de administración
4. El usuario recibe email de bienvenida

---

## 6. Módulo de Importaciones — Blufin Seafood ✅

**Proveedor:** Menita Comercial Oceánica, S.A. de C.V.
**RFC:** MCO060711537
**Dirección:** Priv. Pino Suárez Bodegas No. 14, 15 y 20, Col. El Vigía, Zapopan, Jalisco, CP 45140
**Logo:** `assets/blufin-logo.png`

### Tabs del módulo

| Tab | Ruta | Descripción |
|---|---|---|
| Contratos | `/blufin/contratos` | Lista, alta manual, carga masiva PDF |
| Recepción | `/blufin/recepcion` | Recepción en bodega, match kg por SKU |
| Pagos | `/blufin/pagos` | Anticipos, saldos, forwards cambiarios, pago múltiple |
| Notas de crédito | `/blufin/notas-credito` | NCs por presentación/descuento/faltante, aplicación a contratos |
| Facturas | `/blufin/facturas` | Revisión de factura del proveedor vs contrato, diff por línea |
| Calendario | `/blufin/calendario` | ETAs en puerto y bodega, vencimientos de pagos |
| Central de costos | `/blufin/costos` | Inventario + costo promedio ponderado + histórico precios |
| Productos | `/blufin/productos` | Catálogo de SKUs del proveedor |

### Estructura de un contrato Blufin

```typescript
interface BlufinContrato {
  id: string;                    // UUID
  empresaId: string;             // 'pml'
  folio: string;                 // 'MCO-CV-003542'
  fecha: Date;
  lote: string;
  status: 'Contratado' | 'En tránsito' | 'En puerto' | 'Entregado';
  etaPuerto: Date;
  etaBodega: Date;               // CLAVE para ordenar en Central de Costos
  contenedor: string;
  naviera: string;
  totalUSD: number;
  totalKg: number;
  anticipoUSD: number;
  anticipoFecha: Date;
  anticipoPagado: boolean;       // REQUERIDO — sin este campo los pagos crashean
  saldoUSD: number;
  saldoFecha: Date;
  saldoPagado: boolean;          // REQUERIDO
  tcPonderado: number;           // TC de respaldo si no hay pagos/forwards
  productos: BlufinProducto[];
}
```

### Lógica crítica: Costo promedio ponderado

```typescript
// Central de Costos — cálculo de costo promedio
// fuentes: ordenadas de más nuevo (etaBodega DESC) a más viejo
// stockKg: kg que el usuario tiene en bodega
function calcularPromedio(fuentes: Fuente[], stockKg: number) {
  let restante = stockKg;
  let sumUSD = 0, sumTC = 0, totalKgUsado = 0;
  
  for (const f of fuentes) {
    if (restante <= 0) break;
    const usado = Math.min(f.kg, restante);
    sumUSD += f.precioUSD * usado;
    sumTC  += f.tc * usado;
    totalKgUsado += usado;
    restante -= usado;
  }
  
  const avgUSD = sumUSD / totalKgUsado;
  const avgTC  = sumTC  / totalKgUsado;
  return { avgUSD, avgTC, avgMXN: avgUSD * avgTC };
}

// TC por contenedor (orden de prioridad):
// 1. Promedio ponderado de pagos reales: Σ(tc × monto) / Σ(monto)
// 2. tcForward del forward asociado
// 3. tcPonderado del contrato
// 4. Fallback: tcDelDia (integrar con Banxico API)
```

### Notas de crédito Blufin

Las NCs de Blufin son más complejas que las de otros proveedores:
- Pueden ser por presentación, descuento o faltante
- Tienen folio timbrado (CFDI)
- Se aplican a contratos específicos (puede ser un contrato diferente al de origen)
- Tienen saldo pendiente que se va consumiendo en múltiples aplicaciones

---

## 7. Módulo de Importaciones — Salmones Camanchaca ✅

**Folio interno compartido:** CAM-001..N (impares = SA, pares = MX)
**Logo:** `assets/camanchaca-logo.png`

### 7a. Salmones Camanchaca, S.A. (importación USD)

**Dirección:** Diego Portales 2000, Puerto Montt, Los Lagos, Chile
**Vendedor:** Felipe Rodríguez Aránguiz
**Moneda:** USD

**Flujo completo:**

1. **Planeación** — Felipe manda calendario por WhatsApp con: OC#, descripción estimada, kg estimados, llegada estimada (texto libre). Se captura en `cam_ordenes_planeadas`.

2. **Confirmación con factura** — Cuando llega la factura formal:
   - Se asigna folio interno (CAM-001, CAM-003, ...)
   - Se captura: # factura, fecha, fecha vencimiento, ETA Manzanillo
   - **ETA Bodega = ETA Manzanillo + 7 días** (automático, editable)
   - Naviera
   - SKUs con precios en USD

3. **Pagos al proveedor (USD)** — Pago completo o abonos parciales. Sin anticipos (diferencia clave vs Blufin).
   - TC capturado por pago → CLAVE para calcular costo promedio
   - Opción de Forward cambiario (MONEX / SANTANDER)

4. **Costo de importación (MXN)** — Pagos a agencias aduanales en Manzanillo (LTP Importaciones, MAFA, etc.). Pueden ser múltiples agencias por contenedor.

5. **Costo total internado** = FOB (USD × TC efectivo) + Σ(costo importación MXN)

6. **Recepción en bodega** — Match de kg recibidos vs contratados por SKU.

7. **Descuento simplificado** — Monto USD + motivo (sin flujo de NC complejo).

8. **NC por descuento** — Nota de crédito simplificada (monto USD + motivo, sin CFDI).

**Fórmula costo total:**
```
tcEfectivo   = Σ(pago.tc × pago.monto) / Σ(pago.monto)   // pagos reales
             ó tcForward                                    // si tiene forward
             ó tcDelDia                                     // fallback

costoFOBmxn  = totalUSD × tcEfectivo
costoImpMXN  = Σ(costoImportacion.montoMXN)
costoTotalKg = (costoFOBmxn + costoImpMXN) / totalKg
```

**Tab "Comparación internación"** (dentro de Pagos):
Tabla por contenedor: FOB USD | TC | FOB MXN | [agencia 1] | [agencia 2] | Total importación | % del FOB (verde <8%, amarillo 8-12%, rojo >12%) | Costo total MXN/kg.

### 7b. Camanchaca México, S.A. de C.V. (compras MXN)

**RFC:** CME190315XY2
**Ciudad:** Ciudad de México
**Moneda:** MXN
**Crédito:** 30 días

**Flujo:**
1. Llega factura → se da de alta directamente (sin planeación previa)
2. Campos: folio interno, # factura, entrada Intelisis, fecha, SKUs con precios MXN
3. Vencimiento = fecha factura + 30 días (automático)
4. Pagos parciales (abonos) en MXN
5. NC por descuento en MXN

---

## 8. Módulo de Importaciones — Neptuno Seafood ✅

**Proveedor:** Neptuno Alimentos del Mar
**Dirección:** Av. de Todos los Santos 9105, Pacífico, Tijuana, Baja California
**Moneda:** USD
**Logo:** `assets/neptuno-logo.png`

**Diferencias clave vs Camanchaca SA:**
- Sin folio interno — el **número de factura ES el identificador**
- Sin planeación previa ni OC de referencia
- Se da de alta cuando llega la factura, directo
- Sin naviera (entrega directa en bodega)
- Sin costo de importación separado (costo directo a bodega)
- Con entrada de compra Intelisis
- NC por descuento (USD)

**Tabs:** Facturas | Pagos | Notas de crédito | Central de Costos | Calendario | Productos

**Flujo:**
1. Llega factura → alta directa con: # factura, entrada Intelisis, fecha, vencimiento, SKUs con precios USD
2. Pagos en USD (completo o abonos)
3. NC por descuento cuando hay diferencias de calidad/peso

**SKUs:** Pez Espada Loin, Merluza Filete, Bacalao, Pulpo, Calamar, Rape

---

## 9. Design System

### Paleta de colores (variables CSS → Tailwind config)

```css
/* Estructura */
--navy-900: #0A2540   /* sidebar, botones primarios */
--navy-800: #0F2F52
--navy-700: #143C66

/* Acento principal */
--blue-500: #0073E6
--cyan-500: #00A3FF

/* Texto */
--ink-900: #0B1A2B    /* texto principal */
--ink-700: #334156
--ink-500: #6B7A8F    /* texto secundario */
--ink-400: #94A3B5
--ink-200: #E2E8EF    /* bordes */
--ink-100: #F1F5F9
--ink-50:  #F8FAFC    /* fondo de página */

/* Semánticos */
--green-500: #10B981
--amber-500: #F59E0B
--red-500:   #EF4444
--violet-500:#8B5CF6

/* Módulos / proveedores */
--camanchaca: #0EA5A1  /* Camanchaca y Neptuno — color teal */

/* Tipografía */
--font-sans: 'Inter', system-ui
--font-mono: 'JetBrains Mono', monospace
```

### Componentes base

| Clase | Descripción |
|---|---|
| `.btn`, `.btn-primary`, `.btn-accent`, `.btn-ghost`, `.btn-sm`, `.btn-lg` | Botones |
| `.card` | Tarjeta con sombra suave |
| `.badge`, `.badge-green`, `.badge-blue`, `.badge-amber`, `.badge-red` | Etiquetas de estado |
| `.tbl` | Tablas de datos |
| `.field-input`, `.field-label` | Inputs de formulario |
| `.kpi`, `.kpi-value`, `.kpi-label` | KPI cards |
| `.page-header`, `.page-title`, `.page-subtitle` | Encabezados de página |
| `.hstack`, `.vstack` | Flexbox helpers |
| `.mono`, `.muted`, `.fw-600`, `.fw-700` | Utilities de texto |

### Assets de marca

| Archivo | Uso |
|---|---|
| `assets/marlin-logo.png` | Logo Marlin — fondo oscuro nativo (badge oval negro/dorado) |
| `assets/pml-logo.png` | Logo PML — fondo blanco, solo sobre fondos claros |
| `assets/pml-logo-transparent.png` | Logo PML — sin fondo, usar sobre navys |
| `assets/blufin-logo.png` | Logo Blufin Seafood — fondo blanco |
| `assets/camanchaca-logo.png` | Logo Salmones Camanchaca — fondo blanco |
| `assets/neptuno-logo.png` | Logo Neptuno Alimentos del Mar — fondo blanco |

Para logos con fondo blanco sobre fondos oscuros, envolver en un `div` blanco con `border-radius`.

---

## 10. Catálogo de SKUs (componente compartido)

Cada SKU es la ficha completa del producto: código, **producto** ("lo que es"), marca, **% de peso neto** (producto real vs glaseo — NO es "limpieza"), talla y kg/caja. **La descripción es EDITABLE y debe coincidir con Intelisis** (cambio 2026-06-18): antes se generaba sola con `PRODUCTO - MARCA - PESO NETO - TALLA`, ahora ese formato es solo un atajo ("Generar de la ficha" en el modal) y la descripción real se captura/edita para quedar igual que el ERP (ej. `Basa Pangabay 100% 5/7 (5.00 kg / Caja)`).

Este catálogo es el master de productos — se referencia en contratos, facturas, recepciones y costos.

**Clasificación por `producto`** (decisión del usuario 2026-06-13): no hay campo `categoria` ni `cajas_tipo` — el "producto" ES la clasificación. La página filtra por los productos presentes en el catálogo (chips dinámicos) y los KPIs muestran los productos con más SKUs.
- **Blufin (productos reales):** Filete Basa · Filete Basa Rosa · Posta Basa · Filete Tilapia · Tilapia Entera · Camaron · Atun lomo · Atun medallon · Aros/Tubo/Tentaculo de calamar · Callo de almeja/hacha · Sopa de mariscos · Surimi
- **Camanchaca / Neptuno:** cuando se construyan, mismo modelo (clasificar por producto).

El prototipo `catalogo.jsx` es referencia visual, pero el modelo de datos vigente es el de arriba (ficha estructurada + descripción generada).

---

## 11. Módulos PRÓXIMAMENTE

Todos estos módulos se activarán uno por uno. Se diseñan primero en el prototipo HTML, se validan con el equipo, y luego se migran a producción.

### Logística (distribución PML)
- Gestión de rutas, flota propia
- Entregas a clientes (retail, mayoristas, restaurantes)
- Tracking de vehículos y órdenes de entrega
- Firmas digitales de recepción

### Ventas
- Pipeline de clientes: retail, mayoristas, HORECA, exportación
- Cotizaciones, pedidos, catálogo de productos
- Historial de precios por cliente
- Diferente para PML (clientes externos) vs Marlin (solo PML)

### Cobranza
- CxC de clientes PML
- Antigüedad de saldos
- Recordatorios automáticos (WhatsApp + email)
- Gestión de cheques y referencias bancarias

### Administración
- KPIs ejecutivos
- Bancos y flujo de caja
- Relación PML ↔ Marlin (órdenes de maquila)

### Contabilidad
- CxP a proveedores
- Timbrado de CFDI (integración con PAC)
- Conciliaciones bancarias
- Polizas contables

### Recursos Humanos
- Expedientes de empleados
- Nómina
- Vacaciones y permisos
- Evaluaciones de desempeño

### Marlin Lizárraga
- Misma plataforma pero con datos de Marlin
- Producción: órdenes de maquila, materia prima, almacenes
- Habilitado cuando el módulo esté completo

---

## 12. Esquema Supabase — COMPLETO

> **Este esquema es la base de datos de producción.** Toda tabla nueva se documenta aquí antes de implementarse.
> Usar PostgreSQL + RLS filtrado por `empresa_id`. Habilitar RLS en TODAS las tablas.

### Tablas core (compartidas)

```sql
-- ─────────────────────────────────────────────
-- EMPRESAS DEL GRUPO
-- ─────────────────────────────────────────────
create table empresas (
  id       text primary key,   -- 'pml' | 'marlin'
  nombre   text not null,
  rfc      text,
  tipo     text,               -- 'Distribuidora' | 'Productora'
  ciudad   text,
  activo   boolean default true
);

insert into empresas values
  ('pml',    'Productos Marinos Lizárraga, S. de R.L. de C.V.', 'PML123456789', 'Distribuidora', 'Zapopan, Jalisco', true),
  ('marlin', 'Marlin Lizárraga, S. de R.L. de C.V.',           'MAR987654321', 'Productora',    'Zapopan, Jalisco', false);

-- ─────────────────────────────────────────────
-- USUARIOS Y ROLES
-- ─────────────────────────────────────────────
create table usuarios (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id) on delete cascade,  -- Supabase Auth
  nombre        text not null,
  email         text unique not null,
  rol           text not null default 'vendedor',
    -- 'admin_total' | 'director_ops' | 'coord_logistica' | 'gerente_rh' | 'contador' | 'vendedor'
  empresa_id    text references empresas(id),
  activo        boolean default false,  -- admin debe activar manualmente
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS: usuario solo ve su propio registro y los de su empresa si es admin
alter table usuarios enable row level security;

-- ─────────────────────────────────────────────
-- CATÁLOGO MAESTRO DE SKUS
-- ─────────────────────────────────────────────
create table catalogo_sku (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  text references empresas(id),
  proveedor   text not null,  -- 'blufin' | 'camanchaca' | 'neptuno'
  code        text not null,
  producto    text,           -- "lo que es": 'Filete Basa' | 'Tilapia Entera' | etc — ESTA es la clasificación
  marca       text,           -- 'Pangabay' | 'Mekong' | 'Blufin' | etc
  pct         text,           -- % de PESO NETO (producto real vs glaseo): '70%' | '85%' | '100%'
  talla       text,           -- '5/7 oz' | '350/550 g' | '41/50' | etc
  descripcion text not null,  -- GENERADA, no se captura: producto - marca - peso neto - talla
  kg_caja     numeric(8,3) not null,
  activo      boolean default true,
  created_at  timestamptz default now(),
  unique(empresa_id, proveedor, code)
);
-- NOTA: ya NO hay columnas `categoria` ni `cajas_tipo` (eliminadas 2026-06-13).
-- La clasificación se hace por `producto`. Cada combinación producto+marca+talla+%
-- es un SKU distinto (ej. 104001 = Filete Basa Pangabay 5/7 oz).

-- ─────────────────────────────────────────────
-- CATÁLOGOS DE REFERENCIA
-- ─────────────────────────────────────────────
create table bancos (
  id     serial primary key,
  nombre text not null unique  -- 'MONEX' | 'SANTANDER' | 'BBVA' | etc
);

insert into bancos (nombre) values ('MONEX'), ('SANTANDER');

create table agencias_importadoras (
  id           serial primary key,
  razon_social text not null,
  rfc          text,
  ciudad       text,
  activo       boolean default true
);

insert into agencias_importadoras (razon_social, rfc) values
  ('LTP IMPORTACIONES', null),
  ('MAFA', null),
  ('AGENCIA ADUANAL PACIFICO', null),
  ('GLOBAL CUSTOMS MX', null);

create table navieras (
  id     serial primary key,
  nombre text not null unique
);

insert into navieras (nombre) values ('COSCO'),('HAPAG-LLOYD'),('MSC'),('MAERSK'),('EVERGREEN'),('CMA CGM'),('OOCL'),('CSAV');

create table bodegas (
  id         serial primary key,
  nombre     text not null,
  ciudad     text,
  empresa_id text references empresas(id)
);

insert into bodegas (nombre, ciudad, empresa_id) values
  ('FRIOMEX', 'Guadalajara', 'pml'),
  ('JALNAY',  'Guadalajara', 'pml'),
  ('ALMACEN GENERAL', 'Guadalajara', 'pml');
```

---

### Tablas Blufin Seafood

```sql
-- ─────────────────────────────────────────────
-- CONTRATOS
-- ─────────────────────────────────────────────
create table blufin_contratos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       text references empresas(id),
  folio            text unique not null,    -- 'MCO-CV-003542'
  fecha            date,
  lote             text,
  status           text not null default 'Contratado',
    -- 'Contratado' | 'En tránsito' | 'En puerto' | 'Entregado'
  eta_puerto       date,
  eta_bodega       date,                    -- CLAVE para Central de Costos (ordenar DESC)
  contenedor       text,
  naviera_id       int references navieras(id),
  total_usd        numeric(14,2),
  total_kg         numeric(12,3),
  anticipo_usd     numeric(14,2),
  anticipo_fecha   date,
  anticipo_pagado  boolean default false,   -- CRÍTICO: sin este campo el módulo de pagos falla
  saldo_usd        numeric(14,2),
  saldo_fecha      date,
  saldo_pagado     boolean default false,   -- CRÍTICO
  tc_ponderado     numeric(10,4),           -- TC de respaldo si no hay pagos ni forwards
  created_at       timestamptz default now(),
  created_by       uuid references usuarios(id)
);

alter table blufin_contratos enable row level security;

-- ─────────────────────────────────────────────
-- PRODUCTOS POR CONTRATO
-- ─────────────────────────────────────────────
create table blufin_contrato_productos (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid references blufin_contratos(id) on delete cascade,
  sku_id       uuid references catalogo_sku(id),
  marca        text,
  pct          text,   -- % de peso neto, snapshot del SKU ('100%', '85%')
  talla        text,   -- '3-5' | '5-7' | '350-550' | etc
  kg           numeric(12,3),
  kg_caja      numeric(8,3),
  cajas        int,
  precio_usd   numeric(10,4),
  total_usd    numeric(14,2)
);

-- ─────────────────────────────────────────────
-- PAGOS (anticipos y saldos)
-- ─────────────────────────────────────────────
create table blufin_pagos (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid references blufin_contratos(id),
  tipo          text not null,  -- 'anticipo' | 'saldo'
  monto_usd     numeric(14,2) not null,
  tc            numeric(10,4) not null,  -- TC aplicado — CLAVE para costo promedio ponderado
  monto_mxn     numeric(16,2),           -- calculado: monto_usd × tc
  fecha         date not null,
  banco_id      int references bancos(id),
  referencia    text,
  capturado_por uuid references usuarios(id),
  created_at    timestamptz default now()
);

alter table blufin_pagos enable row level security;

-- ─────────────────────────────────────────────
-- FORWARDS CAMBIARIOS
-- ─────────────────────────────────────────────
create table blufin_forwards (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid references blufin_contratos(id),
  asociado_a    text,       -- 'anticipo' | 'saldo'
  monto_usd     numeric(14,2),
  tc_forward    numeric(10,4),  -- TC pactado — usado en costos si no hay pagos reales
  monto_mxn     numeric(16,2),
  fecha_cierre  date,
  fecha_entrega date,
  banco_id      int references bancos(id),
  status        text default 'Pendiente',  -- 'Pendiente' | 'Ejecutado'
  capturado_por uuid references usuarios(id),
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────
-- RECEPCIONES EN BODEGA
-- ─────────────────────────────────────────────
create table blufin_recepciones (
  id              uuid primary key default gen_random_uuid(),
  contrato_id     uuid references blufin_contratos(id),
  fecha_recepcion date not null,
  bodega_id       int references bodegas(id),
  observaciones   text,
  capturado_por   uuid references usuarios(id),
  created_at      timestamptz default now()
);

create table blufin_recepcion_lineas (
  id             uuid primary key default gen_random_uuid(),
  recepcion_id   uuid references blufin_recepciones(id) on delete cascade,
  sku_id         uuid references catalogo_sku(id),
  kg_contratados numeric(12,3) not null,
  kg_recibidos   numeric(12,3) not null,
  diferencia     numeric(12,3) generated always as (kg_recibidos - kg_contratados) stored,
  observaciones  text
);

-- ─────────────────────────────────────────────
-- NOTAS DE CRÉDITO (complejas — con CFDI)
-- ─────────────────────────────────────────────
create table blufin_notas_credito (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          text references empresas(id),
  folio_interno       text not null,
  folio_timbrado      text,            -- UUID del CFDI timbrado con el SAT
  razon               text not null,   -- 'presentacion' | 'descuento' | 'faltante'
  contrato_origen_id  uuid references blufin_contratos(id),
  recepcion_origen_id uuid references blufin_recepciones(id),
  monto_usd           numeric(14,2) not null,
  tc                  numeric(10,4),
  monto_mxn           numeric(16,2),
  status              text default 'Pendiente',  -- 'Pendiente' | 'Aplicada'
  saldo_pendiente_usd numeric(14,2),
  created_at          timestamptz default now()
);

create table blufin_nc_aplicaciones (
  id                  uuid primary key default gen_random_uuid(),
  nc_id               uuid references blufin_notas_credito(id),
  contrato_destino_id uuid references blufin_contratos(id),
  monto_usd           numeric(14,2) not null,
  fecha               date not null,
  created_at          timestamptz default now()
);

-- ─────────────────────────────────────────────
-- REVISIÓN DE FACTURAS DEL PROVEEDOR
-- ─────────────────────────────────────────────
create table blufin_facturas (
  id               uuid primary key default gen_random_uuid(),
  contrato_id      uuid references blufin_contratos(id),
  fecha_subida     date,
  nombre_archivo   text,
  storage_path     text,    -- path en Supabase Storage
  status           text default 'Pendiente revisión',  -- | 'Aprobada'
  total_contrato   numeric(14,2),
  total_factura    numeric(14,2),
  diferencia_monto numeric(14,2) generated always as (total_factura - total_contrato) stored,
  revisado_por     uuid references usuarios(id),
  created_at       timestamptz default now()
);

create table blufin_factura_lineas (
  id                   uuid primary key default gen_random_uuid(),
  factura_id           uuid references blufin_facturas(id) on delete cascade,
  -- Datos de la factura del proveedor
  sku_factura          text,
  descripcion_factura  text,
  kg_factura           numeric(12,3),
  precio_factura       numeric(10,4),
  total_factura        numeric(14,2),
  -- Datos del contrato PML
  sku_contrato         text,
  descripcion_contrato text,
  kg_contrato          numeric(12,3),
  precio_contrato      numeric(10,4),
  total_contrato       numeric(14,2),
  -- Resultado de la comparación
  match                text,   -- 'ok' | 'diferente'
  diferencias          jsonb,  -- [{ campo, valorContrato, valorFactura, delta }]
  aceptado             boolean,
  nota_revision        text
);
```

---

### Tablas Salmones Camanchaca

```sql
-- ─────────────────────────────────────────────
-- PROVEEDOR
-- ─────────────────────────────────────────────
create table proveedores (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      text references empresas(id),
  nombre          text not null,
  nombre_interno  text,           -- nombre que PML usa internamente
  pais            text,
  ciudad          text,
  rfc             text,
  moneda          text,           -- 'USD' | 'MXN' | 'EUR'
  credito_dias    int default 0,
  contacto        text,
  email           text,
  activo          boolean default true,
  logo_path       text,           -- path en Supabase Storage
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
-- ÓRDENES PLANEADAS (calendario de Felipe vía WhatsApp)
-- ─────────────────────────────────────────────
create table cam_ordenes_planeadas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       text references empresas(id),
  oc_proveedor     text not null,       -- # de OC que viene en la factura
  descripcion      text,                -- texto libre de Felipe: '18 ton salmón lonja premium'
  kg_estimados     numeric(12,3),
  llegada_estimada text,                -- texto libre: 'principios mayo 2026'
  status           text default 'planeado',
    -- 'planeado' | 'confirmado' | 'cancelado'
  folio_interno    text,                -- se asigna al confirmar con factura
  capturado_por    uuid references usuarios(id),
  created_at       timestamptz default now()
);

-- ─────────────────────────────────────────────
-- SECUENCIA DE FOLIOS COMPARTIDA SA/MX
-- CAM-001 (SA), CAM-002 (MX), CAM-003 (SA), etc.
-- ─────────────────────────────────────────────
create sequence cam_folio_seq start 1;

create function next_cam_folio() returns text as $$
  select 'CAM-' || lpad(nextval('cam_folio_seq')::text, 3, '0')
$$ language sql;

-- ─────────────────────────────────────────────
-- CONTENEDORES SA (Camanchaca Chile — importación USD)
-- ─────────────────────────────────────────────
create table cam_contenedores_sa (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        text references empresas(id),
  folio_interno     text unique not null default next_cam_folio(),
    -- 'CAM-001', 'CAM-003', ... (impares = SA)
  orden_planeada_id uuid references cam_ordenes_planeadas(id),
  oc_proveedor      text,
  factura           text,             -- # factura del proveedor (null si solo planeado)
  fecha_factura     date,
  fecha_vencimiento date,             -- REQUERIDO para calendario
  status            text not null default 'Planeado',
    -- 'Planeado' | 'En tránsito' | 'En Manzanillo' | 'Entregado'
  eta_manzanillo    date,
  eta_bodega        date,             -- = eta_manzanillo + 7 días (editable)
  naviera_id        int references navieras(id),
  total_usd         numeric(14,2),
  total_kg          numeric(12,3),
  capturado_por     uuid references usuarios(id),
  created_at        timestamptz default now()
);

create table cam_productos_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references cam_contenedores_sa(id) on delete cascade,
  sku_id        uuid references catalogo_sku(id),
  kg_caja       numeric(8,3),
  cajas         int,
  kg            numeric(12,3),
  precio_usd    numeric(10,4),
  total_usd     numeric(14,2)
);

-- Pagos al proveedor USD (sin anticipos — completo o abonos)
create table cam_pagos_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references cam_contenedores_sa(id),
  tipo          text not null,  -- 'completo' | 'abono'
  monto_usd     numeric(14,2) not null,
  tc            numeric(10,4) not null,  -- TC aplicado — CLAVE para costo promedio
  monto_mxn     numeric(16,2),
  fecha         date not null,
  banco_id      int references bancos(id),
  referencia    text,
  created_at    timestamptz default now()
);

-- Forwards cambiarios SA
create table cam_forwards_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references cam_contenedores_sa(id),
  monto_usd     numeric(14,2) not null,
  tc_forward    numeric(10,4) not null,  -- TC fijo a futuro — usado en costos si no hay pagos
  monto_mxn     numeric(16,2),
  fecha_cierre  date,
  fecha_entrega date,
  banco_id      int references bancos(id),
  status        text default 'Pendiente',  -- 'Pendiente' | 'Ejecutado'
  created_at    timestamptz default now()
);

-- Costo importación (pagos en MXN a agencias aduanales)
-- Pueden ser MÚLTIPLES agencias por contenedor (LTP + MAFA, etc.)
-- Fórmula: costoTotalKg = (totalUSD × tcEfectivo + Σmonto_mxn) / totalKg
create table cam_costo_importacion (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references cam_contenedores_sa(id),
  agencia_id    int references agencias_importadoras(id),
  monto_mxn     numeric(14,2) not null,
  pagado        boolean default false,
  fecha         date,
  observaciones text,  -- 'Pedimento 06/2026-001'
  created_at    timestamptz default now()
);

-- Recepciones SA en bodega
create table cam_recepcion_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references cam_contenedores_sa(id) unique,  -- 1 recepción por contenedor
  fecha         date not null,
  bodega_id     int references bodegas(id),
  capturado_por uuid references usuarios(id),
  created_at    timestamptz default now()
);

create table cam_recepcion_sa_lineas (
  id             uuid primary key default gen_random_uuid(),
  recepcion_id   uuid references cam_recepcion_sa(id) on delete cascade,
  sku_id         uuid references catalogo_sku(id),
  kg_contratados numeric(12,3) not null,
  kg_recibidos   numeric(12,3) not null,
  diferencia     numeric(12,3) generated always as (kg_recibidos - kg_contratados) stored,
  observaciones  text
);

-- NC por descuento SA (simplificada — solo monto + motivo, sin CFDI)
create table cam_nc_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references cam_contenedores_sa(id),
  monto_usd     numeric(14,2) not null,
  motivo        text not null,
  fecha         date not null,
  status        text default 'Aplicada',
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────
-- COMPRAS MX (Camanchaca México — facturas en MXN)
-- ─────────────────────────────────────────────
create table cam_compras_mx (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        text references empresas(id),
  folio_interno     text unique not null default next_cam_folio(),
    -- 'CAM-002', 'CAM-004', ... (pares = MX)
  factura_num       text not null,    -- 'MX-8841'
  entrada_intelisis text,             -- 'EI-2026-0234' — número en ERP Intelisis
  fecha_factura     date not null,
  fecha_vencimiento date,             -- = fecha_factura + 30 días (automático)
  status            text default 'Pendiente',
    -- 'Pendiente' | 'Parcial' | 'Liquidada'
  total_mxn         numeric(16,2) not null,
  saldo_pendiente   numeric(16,2),   -- = total_mxn - Σ(cam_pagos_mx.monto) - Σ(cam_nc_mx.monto_mxn)
  capturado_por     uuid references usuarios(id),
  created_at        timestamptz default now()
);

create table cam_productos_mx (
  id         uuid primary key default gen_random_uuid(),
  compra_id  uuid references cam_compras_mx(id) on delete cascade,
  sku_id     uuid references catalogo_sku(id),
  kg_caja    numeric(8,3),
  cajas      int,
  kg         numeric(12,3),
  precio_mxn numeric(10,4),
  total_mxn  numeric(16,2)
);

-- Pagos MX (abonos parciales en MXN, crédito 30 días)
create table cam_pagos_mx (
  id         uuid primary key default gen_random_uuid(),
  compra_id  uuid references cam_compras_mx(id),
  monto      numeric(16,2) not null,
  fecha      date not null,
  banco_id   int references bancos(id),
  referencia text,
  created_at timestamptz default now()
);

-- NC por descuento MX (en MXN)
create table cam_nc_mx (
  id        uuid primary key default gen_random_uuid(),
  compra_id uuid references cam_compras_mx(id),
  monto_mxn numeric(16,2) not null,
  motivo    text not null,
  fecha     date not null,
  status    text default 'Aplicada',
  created_at timestamptz default now()
);
```

---

### Tablas Neptuno Seafood

```sql
-- ─────────────────────────────────────────────
-- FACTURAS (el número de factura ES el identificador)
-- Sin folio interno, sin planeación previa, sin naviera
-- ─────────────────────────────────────────────
create table nep_facturas (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        text references empresas(id),
  factura_num       text not null,           -- 'NEP-2026-001' — identificador principal
  entrada_intelisis text,                    -- 'EI-2026-0900'
  fecha_factura     date not null,
  fecha_vencimiento date,
  status            text default 'Pendiente',
    -- 'Pendiente' | 'Parcial' | 'Liquidada'
  total_usd         numeric(14,2) not null,
  total_kg          numeric(12,3),
  saldo_usd         numeric(14,2),  -- = total_usd - Σ(pagos.monto) - Σ(nc.monto_usd)
  capturado_por     uuid references usuarios(id),
  created_at        timestamptz default now(),
  unique(empresa_id, factura_num)
);

alter table nep_facturas enable row level security;

create table nep_factura_productos (
  id          uuid primary key default gen_random_uuid(),
  factura_id  uuid references nep_facturas(id) on delete cascade,
  sku_id      uuid references catalogo_sku(id),
  kg_caja     numeric(8,3),
  cajas       int,
  kg          numeric(12,3),
  precio_usd  numeric(10,4),
  total_usd   numeric(14,2)
);

-- Pagos en USD (completo o abonos)
create table nep_pagos (
  id         uuid primary key default gen_random_uuid(),
  factura_id uuid references nep_facturas(id),
  tipo       text not null,  -- 'completo' | 'abono'
  monto_usd  numeric(14,2) not null,
  tc         numeric(10,4) not null,  -- TC aplicado
  monto_mxn  numeric(16,2),
  fecha      date not null,
  banco_id   int references bancos(id),
  referencia text,
  created_at timestamptz default now()
);

-- Notas de crédito por descuento (simplificadas, solo monto + motivo)
create table nep_notas_credito (
  id         uuid primary key default gen_random_uuid(),
  factura_id uuid references nep_facturas(id),
  monto_usd  numeric(14,2) not null,
  motivo     text not null,
  fecha      date not null,
  status     text default 'Aplicada',
  created_at timestamptz default now()
);
```

---

### Tablas para módulos futuros (esqueleto)

```sql
-- ─────────────────────────────────────────────
-- LOGÍSTICA (distribución PML) — PRÓXIMAMENTE
-- ─────────────────────────────────────────────
-- log_vehiculos (id, empresa_id, placa, tipo, capacidad_kg, activo)
-- log_clientes  (id, empresa_id, razon_social, rfc, tipo, ciudad, credito_dias)
-- log_rutas     (id, empresa_id, nombre, descripcion, activo)
-- log_entregas  (id, empresa_id, cliente_id, vehiculo_id, fecha, status, total_kg)
-- log_entrega_lineas (id, entrega_id, sku_id, kg, precio_mxn)

-- ─────────────────────────────────────────────
-- VENTAS — PRÓXIMAMENTE
-- ─────────────────────────────────────────────
-- ven_clientes     (id, empresa_id, razon_social, rfc, tipo, ciudad, credito_dias)
-- ven_cotizaciones (id, empresa_id, cliente_id, fecha, status, total_mxn)
-- ven_pedidos      (id, empresa_id, cliente_id, cotizacion_id, fecha, status, total_mxn)
-- ven_pedido_lineas (id, pedido_id, sku_id, kg, precio_mxn)

-- ─────────────────────────────────────────────
-- COBRANZA — PRÓXIMAMENTE
-- ─────────────────────────────────────────────
-- cob_cuentas_cobrar (id, empresa_id, cliente_id, pedido_id, monto, fecha_vencimiento, status)
-- cob_pagos_recibidos (id, cuenta_id, monto, fecha, banco_id, referencia)

-- ─────────────────────────────────────────────
-- CONTABILIDAD — PRÓXIMAMENTE
-- ─────────────────────────────────────────────
-- cont_cfdi    (id, empresa_id, tipo, rfc_emisor, rfc_receptor, monto, fecha, uuid_sat)
-- cont_polizas (id, empresa_id, tipo, fecha, concepto, monto)

-- ─────────────────────────────────────────────
-- RECURSOS HUMANOS — PRÓXIMAMENTE
-- ─────────────────────────────────────────────
-- rh_empleados  (id, empresa_id, nombre, puesto, departamento, fecha_ingreso, salario, activo)
-- rh_nomina     (id, empresa_id, periodo, empleado_id, salario_bruto, deducciones, neto)
-- rh_vacaciones (id, empleado_id, fecha_inicio, fecha_fin, dias, status)
```

---

### Configuración de Supabase

```sql
-- 1. Habilitar RLS en TODAS las tablas de negocio
-- 2. Política base: usuario solo ve datos de su empresa
create policy "empresa_isolation" on blufin_contratos
  for all using (empresa_id = (
    select empresa_id from usuarios where auth_user_id = auth.uid()
  ));
-- Aplicar política similar a todas las tablas

-- 3. TC del día — Edge Function que llama a Banxico API
-- Endpoint: /functions/v1/tc-del-dia
-- Responde: { tc: 18.435, fecha: '2026-05-26', fuente: 'banxico' }

-- 4. Storage buckets
-- 'facturas-pdf' — facturas de proveedores
-- 'documentos-importacion' — pedimentos, BLs, etc.
-- 'logos-proveedores' — logos de empresas
-- Policy: solo usuarios de la misma empresa pueden leer/escribir

-- 5. Realtime — habilitar en tablas de pagos para notificaciones
alter publication supabase_realtime add table blufin_pagos;
alter publication supabase_realtime add table cam_pagos_sa;
alter publication supabase_realtime add table cam_pagos_mx;
alter publication supabase_realtime add table nep_pagos;
```

---

## 13. Patrones de código críticos

### Patrón de formularios que guardan datos

Todo formulario debe:
1. Hacer la mutación a Supabase
2. Invalidar el cache de React Query para que la tabla se refresque
3. Cerrar el modal
4. Mostrar toast de éxito/error

```typescript
// Ejemplo con React Query + Supabase
const { mutate: registrarPago } = useMutation({
  mutationFn: async (pago: NuevoPago) => {
    const { error } = await supabase
      .from('blufin_pagos')
      .insert(pago);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['blufin_pagos', contratoId] });
    queryClient.invalidateQueries({ queryKey: ['blufin_contratos'] });
    onClose();
    toast.success('Pago registrado correctamente');
  },
  onError: (err) => toast.error('Error: ' + err.message),
});
```

### Cálculo de TC efectivo

```typescript
// Usado en Central de Costos para calcular costo promedio
function tcEfectivo(pagos: Pago[], forwards: Forward[], tcDelDia: number): number {
  if (pagos.length > 0) {
    // Promedio ponderado de pagos reales
    const sumProd = pagos.reduce((s, p) => s + p.tc * p.monto_usd, 0);
    const sumMonto = pagos.reduce((s, p) => s + p.monto_usd, 0);
    return sumProd / sumMonto;
  }
  if (forwards.length > 0) {
    return forwards[0].tc_forward; // primer forward
  }
  return tcDelDia; // fallback — leer de Edge Function
}
```

### Actualización de saldo_pendiente

Cada vez que se registra un pago o NC, actualizar `saldo_pendiente` en la tabla padre:

```sql
-- Trigger en cam_pagos_mx para actualizar saldo automáticamente
create or replace function update_cam_compra_saldo()
returns trigger as $$
begin
  update cam_compras_mx
  set
    saldo_pendiente = total_mxn
      - (select coalesce(sum(monto), 0) from cam_pagos_mx where compra_id = new.compra_id)
      - (select coalesce(sum(monto_mxn), 0) from cam_nc_mx where compra_id = new.compra_id),
    status = case
      when saldo_pendiente <= 0.01 then 'Liquidada'
      when (select sum(monto) from cam_pagos_mx where compra_id = new.compra_id) > 0 then 'Parcial'
      else 'Pendiente'
    end
  where id = new.compra_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_update_cam_compra_saldo
after insert or update on cam_pagos_mx
for each row execute function update_cam_compra_saldo();
```

Aplicar trigger similar para: `nep_pagos`, `cam_nc_mx`, `nep_notas_credito`.

---

## 14. Reglas críticas que NO romper

1. **`blufin_contratos.anticipo_pagado` y `saldo_pagado` son REQUERIDOS.** El módulo de pagos de Blufin usa estos campos para calcular si hay saldo pendiente. Sin ellos el cálculo falla.

2. **TC por contenedor — siempre calcular en este orden:**
   - Promedio ponderado de pagos reales registrados
   - TC del forward asociado
   - TC ponderado del contrato
   - Fallback: tcDelDia (Banxico API)

3. **Nunca mutar `saldo_pendiente` directamente.** Usar triggers o funciones que lo recalculen a partir de los pagos y NCs registrados.

4. **ETA Bodega de Camanchaca SA = ETA Manzanillo + 7 días.** Este cálculo es automático pero editable. Mostrar siempre la nota "auto +7d" en el UI.

5. **Folios TST-CV-001..005 son datos de prueba de Blufin.** Eliminar antes de pasar a producción. Son contratos de prueba para verificar el cálculo de costo promedio.

6. **Reglas de Hooks de React.** Nunca llamar hooks después de un `if (condition) return ...`. Si una pantalla tiene diferentes vistas (lista vs detalle), separarlas en dos componentes distintos.

7. **Folio compartido SA/MX en Camanchaca.** Usar la secuencia PostgreSQL `cam_folio_seq` para garantizar unicidad entre SA (impares) y MX (pares). No generar folios en el frontend.

8. **Neptuno no tiene naviera.** Entrega directa en bodega — no registrar campo de naviera.

9. **Camanchaca MX requiere Entrada Intelisis.** Es el número de entrada en el ERP Intelisis de PML — capturar siempre al dar de alta una compra.

---

## 15. Módulos del prototipo HTML → estado

| Módulo | Estado en prototipo | Acción en producción |
|---|---|---|
| Login / Auth | ✅ UI completa | Conectar con Supabase Auth |
| Company Switcher | ✅ UI completa | Conectar con tabla `empresas` |
| Dashboard General | ✅ KPIs mock | Conectar con queries reales |
| Importaciones — Picker | ✅ Completo | Conectar con tabla `proveedores` |
| **Blufin Seafood** | ✅ **Todos los tabs** | **Construir primero** |
| **Salmones Camanchaca** | ✅ **SA + MX completos** | **Construir segundo** |
| **Neptuno Seafood** | ✅ **Completo** | **Construir tercero** |
| Catálogo SKUs | ✅ Compartido | Conectar con `catalogo_sku` |
| Logística | 🔜 Placeholder | Diseñar en prototipo primero |
| Administración | 🔜 Dashboard básico | Diseñar en prototipo primero |
| Ventas | 🔜 Placeholder | Diseñar en prototipo primero |
| Cobranza | 🔜 Placeholder | Diseñar en prototipo primero |
| Contabilidad | 🔜 Placeholder | Diseñar en prototipo primero |
| Recursos Humanos | 🔜 Dashboard básico | Diseñar en prototipo primero |
| Marlin Lizárraga | 🔜 Deshabilitado | Habilitar cuando esté listo |

---

## 16. Estado de construcción real (lo que está live en producción)

Schema PostgreSQL en Supabase project `crm-pml` (`xjbhfeqcjjqyjkvdbyxy`, us-east-1), **schema namespace `crm`** (coexiste con WMS en `public`). RLS habilitado con políticas `dev_open` temporales — endurecer al integrar Supabase Auth.

### Infraestructura del proyecto

| Pieza | Valor |
|---|---|
| Repo GitHub | `https://github.com/pmlconect94/crm-pml` (privado, rama `main`) |
| Supabase | proyecto `crm-pml` · ref `xjbhfeqcjjqyjkvdbyxy` · región us-east-1 · schema `crm` |
| Dev server | `npm run dev` → puerto 5174 (5173 lo ocupa el sistema de nómina local; `strictPort: false`, toma el siguiente libre) |
| Credenciales frontend | `.env.local` (NO versionado — plantilla en `.env.example`; keys en Supabase Dashboard → Settings → API) |
| PIN super admin | default `1234`, override en `localStorage.crm_admin_pin` (stub hasta auth real) |
| Workflow de cierre | al terminar un bloque de trabajo: actualizar §16, commit descriptivo en español, push a `main` |

### Cuentas y sesiones conectadas (LEER ANTES de operar GitHub o Supabase)

| Servicio | Cuenta / sesión | Identificador | Estado |
|---|---|---|---|
| **GitHub — repo** | `pmlconect94` | `https://github.com/pmlconect94/crm-pml` (privado) | Push autorizado vía Git Credential Manager de Windows (sin PAT manual). En máquina nueva: el primer push abre el navegador para autorizar |
| **Git local** | `pml-diego` / `ventas.lizarraga2@gmail.com` | `git config --global` | Identidad de commits configurada |
| **gh CLI** | sin sesión | instalado en `C:\Users\ddlpm\AppData\Local\gh-cli\bin\gh.exe` | NO logueado y PowerShell no lo encuentra en PATH (funciona desde Git Bash). NO es necesario: usar git puro |
| **Supabase — cuenta CORRECTA** ✅ | org slug `lznqkeztbfiyxdsujrlw` | proyecto **`crm-pml`** · ref **`xjbhfeqcjjqyjkvdbyxy`** · us-east-1 | Conectada al MCP de Supabase (plugin OAuth). Aquí vive el schema `crm` del CRM |
| **Supabase — cuenta EQUIVOCADA** ⚠️ | org slug `uftqommephkoszdkzoqb` (`grupo-lizarraga`) | proyecto `grupo-lizarraga-crm` · ref `mipzuzlirylztfjekwtv` · us-west-1 | NO usar. Contiene el WMS del usuario en `public` + un schema `crm` huérfano con datos de prueba que quedó por error (2026-05-26). Pendiente de limpiar algún día con `DROP SCHEMA crm CASCADE` |

**Regla de oro antes de tocar Supabase:** correr `list_projects` del MCP. Si aparece `crm-pml` (`xjbhfeqcjjqyjkvdbyxy`) estás en la cuenta correcta. Si aparece `grupo-lizarraga-crm` (`mipzuzlirylztfjekwtv`) estás en la cuenta equivocada — pedir al usuario reautenticar el MCP (`/mcp` → supabase → re-authenticate con la cuenta correcta en el navegador) antes de aplicar cualquier migración o SQL.

**Nota:** el MCP de Supabase es el plugin oficial OAuth (`mcp.supabase.com`) — se conecta con la cuenta que esté logueada en supabase.com en el navegador al momento de autorizar. El usuario tiene 2+ cuentas Supabase; este fue el origen del incidente del schema huérfano.

### SIGUIENTE PASO (handoff de sesión)

Con **Facturas ✅ LIVE** (2026-06-16) y **Carga masiva ✅ LIVE** (2026-06-17), el único tab operativo de Blufin que falta es:
- **Calendario** (tab propio) — reutilizable: ETAs + vencimientos de pagos (ya existe un mini-calendario en Recepción que puede servir de base).
- Pendiente transversal: extender el borrador `useDraft` a `BlufinRecepcionRegistrarPage` y `BlufinPagoMultiplePage` (ver §17).
- Infra que desbloquearía MXN reales en costos: Edge Function `tc-del-dia` (Banxico) — pendiente #1.

Con Blufin casi completo, el siguiente módulo grande es **Salmones Camanchaca** (SA + MX) — schema aún sin migrar (ver §7).

### Foundation ✅

| Pieza | Detalle |
|---|---|
| Stack | Vite 5 + React 18 + TS estricto + Tailwind v3 + Supabase JS + React Router v6 + TanStack Query + **Framer Motion 12** + Sonner |
| Auth | Stub con usuario `admin_total` quemado (`src/lib/auth.tsx`). SSO Google/Microsoft pendiente |
| Cliente Supabase | `src/lib/supabase.ts` con `db: { schema: 'crm' }` por default |
| Tipos | `src/types/database.ts` manual con tablas core + Blufin (contratos, productos, pagos, forwards, recepciones + líneas). Regenerar con CLI cuando schema crezca mucho |
| Shell | Sidebar con switcher PML/Marlin, topbar con switcher de empresa (popover Framer Motion), AppLayout con Outlet |
| Migraciones empacadas | `supabase/migrations/*.sql` versionadas para re-aplicar a cualquier proyecto |
| Context para skills | `PRODUCT.md` y `DESIGN.md` en raíz |

### Importaciones — Blufin Seafood

| Tab | Estado | Archivos | Notas |
|---|---|---|---|
| **Contratos** | ✅ LIVE | `BlufinContratosListPage.tsx` · `BlufinNuevoContratoPage.tsx` · `BlufinCargaMasivaPage.tsx` (carga masiva ✅ — ver fila abajo) | Auto-cálculos: ETA bodega = ETA puerto + 7d · anticipo 10%. **Líneas de producto SKU-first** (rediseño 2026-06-12): se elige el SKU y su ficha (descripción, marca, %, talla, kg/caja) se copia del catálogo como **snapshot de solo lectura** — solo se capturan kg ↔ cajas (conversión bidireccional) y precio USD; inputs deshabilitados hasta elegir SKU; línea válida requiere SKU + kg. El mismo flujo servirá para la carga masiva PDF: el parser mapeará líneas del PDF contra el catálogo. **Buscador de SKU** (2026-06-13): la celda SKU es un `<input list>` con datalist compartido — se escribe código o nombre y autocompleta; resuelve por etiqueta `código — descripción` o por código suelto. **Columna Saldo** (2026-06-15): junto a "Costo USD" se muestra el saldo por liquidar = `total − pagado − NCs aplicadas` (o "Liquidado" si anticipo+saldo cubiertos; usa `fetchSaldosPorContrato`). **Ficha de detalle**: clic en una fila abre `ContratoDetalleModal` con todo el contrato (resumen de saldo, productos, pagos, forwards, recepción con líneas, NCs de origen) vía `fetchContratoDetalle`. **Borrador automático** (`useDraft`, `src/lib/useDraft.ts`): todo lo capturado se persiste en `localStorage` (`crm:draft:blufin-nuevo-contrato:<empresa>`) en cada cambio; al volver a la pantalla se restaura. Chip "Borrador guardado" + botón "Descartar" (con confirm) en el header; "Salir" conserva el borrador; al guardar con éxito se limpia. Lote y naviera NO se capturan al crear (van en Recepción/Embarque). TC ponderado se llena con `getTcDelDia()` (stub null hasta Edge Function Banxico). **Exportar Excel** (2026-06-16): menú `ExportMenu` en el header con 2 opciones → `exportContratos` (lista con folios, fechas de llegada, totales, estado de pago y saldo pendiente) y `exportProductosPorContrato` (cada producto en su fila con su contrato y fechas de llegada, ordenado por ETA bodega ASC). Ambos vía `downloadXlsx` (`src/features/blufin/blufin-export.ts`). **Rediseño 2026-06-16** (feedback: tabla muy apretada): KPIs de 4 tarjetas → **stat strip de una línea** (contratos · en tránsito · terminados · USD comprometido · kg); filtros = **Activos (default) / Terminados / Todos** con conteo en el chip (`esTerminado` = `status==='Entregado' && saldo_pagado`); columna **Kg quitada**; columna **ETA puerto** (la tabla se **ordena por esta fecha ascendente** — próximos primero, nulos al final; feedback 2026-06-17): muestra el ETA a puerto y, si ya llegó, "llegó {fecha} · {lugar}"; columna **Contenedor** ahora trae contenedor + naviera (del Calendario PDF). En **Recepción → Por recibir** la ETA bodega estimada (= ETA puerto + 7d, helper `etaBodegaAuto`) sale con badge **"ETA estimada +7d"**; al **Programar llegada** se pone la fecha oficial y deja de ser estimada. **Status calculado** (feedback 2026-06-17, `statusContrato` en `src/features/blufin/status.ts`): el status NO se confía del campo guardado (depende de hoy) — se deriva: **Entregado** = tiene recepción (el `status` guardado solo se usa para detectar esto, invariante Entregado ⟺ recepción); **En puerto** = tiene contenedor+naviera y su ETA puerto ya pasó (hoy > ETA); **En tránsito** = tiene contenedor+naviera y ETA puerto futura; **Contratado** = aún sin contenedor ni naviera. Se usa en todos los `<StatusPill>` (lista, ficha, recepción, registrar, factura) + KPIs + export. El campo guardado se backfillea para que labels secundarios/consultas crudas queden consistentes, pero el display siempre usa la función en vivo. La ficha (`ContratoDetalleModal`) agrega fila de logística: naviera, contenedor, ETA puerto, llegó a bodega, fecha anticipo, fecha pago saldo. **Descarga de PDFs (2026-06-17):** la ficha tiene en la cabecera 2 botones — **Contrato** (PDF de la orden de compra) y **Factura** (PDF de la factura del proveedor) — que se muestran solo si el contrato tiene ligado `contrato_pdf_path` / `factura_pdf_path` (migración `20260617130000`) y abren el PDF con URL firmada del bucket `documentos-importacion` (`abrirPdf` reusa `getImportPdfUrl`). Los PDFs viven en Google Drive del usuario (carpeta de contratos `CT-####.pdf` 1:1 con folio; facturas por año `C####.pdf` que matchean el "Factura proveedor C####" de observaciones) y se cargan a Storage + se ligan con scripts locales (`scripts/`, ver §16 "Carga de PDFs"). `importarLote` de la carga masiva también setea `contrato_pdf_path` |
| **Carga masiva (PDF)** | ✅ LIVE | `BlufinCargaMasivaPage.tsx` · `BlufinCargaMasivaRevisarPage.tsx` · `import-queries.ts` · `scripts/split_contratos_pdf.py` | Sub-página de Contratos (`contratos/carga-masiva`). **Decisión 2026-06-17**: en vez de Edge Function con LLM (sería un cargo de API aparte), el procesamiento se hace **en Cowork** (Claude lee los PDFs nativamente en la sesión, sin costo extra). Flujo: (1) el usuario pone los PDFs de Menita en `uploads/contratos-blufin/` (gitignored); (2) Claude lee cada PDF, separa las órdenes de compra, extrae folio/fechas/ETA/totales/anticipo/saldo/renglones y **mapea cada renglón al SKU del catálogo con nivel de confianza** (alta/media/baja); (3) separa el PDF en un PDF por orden (`split_contratos_pdf.py`, pypdf — detecta cada OC por `NÚMERO: MCO-CV-…`) y lo sube al bucket **`documentos-importacion`** vía REST; (4) inserta todo en **staging** (`crm.blufin_import_lotes` / `blufin_import_contratos` / `blufin_import_lineas`, migración `20260617120000`) con `duplicado=true` para folios que ya existen. **La pantalla** lista los lotes (badges: listos/duplicados/importados/omitidos) → "Revisar" abre la página dedicada con KPIs + una tabla editable por contrato: cada renglón tiene `Combobox` de SKU pre-cargado con el sugerido + badge de confianza, badge "Duplicado"/"Falta SKU", botón "Ver PDF" (URL firmada 1h) y "Omitir". **Importar** (`importarLote`): promueve cada contrato pendiente no-duplicado con todas sus líneas con SKU a `blufin_contratos` + `blufin_contrato_productos` reusando `createContrato` (la línea final usa la **ficha del SKU** del catálogo + las cantidades/precio del PDF, igual que captura manual); duplicados → omitidos; líneas sin SKU bloquean ese contrato. Nada toca las tablas reales hasta confirmar. Verificado end-to-end 2026-06-17 (importación probada con folios TST y limpiada). **Pendiente**: extender `useDraft`, y aplicar el mismo flujo a Camanchaca/Neptuno cuando se construyan |
| **Pagos** | ✅ LIVE | `BlufinPagosPage.tsx` · `PagoModal.tsx` · `ForwardModal.tsx` · `BlufinPagoMultiplePage.tsx` · `pagos-queries.ts` | Sub-tabs Pendientes / Realizados / Forwards. **3 modos de captura**: (1) Pago individual vía `PagoModal` con auto-fill monto + auto-update flag contrato. (2) Forward vía `ForwardModal` con TC pactado + fecha entrega futura. (3) Pago múltiple vía `BlufinPagoMultiplePage` — página dedicada con checkbox-multiselect, TC/banco/fecha compartidos, override de monto por fila, sticky footer con totales, mutación batch `createPagosMultiples`. **Ejecutar forward**: botón "Ejecutar" en sub-tab Forwards convierte forward Pendiente en pago real (`executeForward`) — inserta pago con TC pactado + referencia `FORWARD ejecutado <fecha>` + cambia status a Ejecutado + recalcula flag. **Bloqueos**: 1 solo forward Pendiente por (contrato, asociado_a) — opción "Cubre anticipo/saldo" se deshabilita en modal si ya existe. **Pendientes con forward** muestran badge "FORWARD CERRADO PARA <fecha entrega>" y CTA cambia a "Pagar spot" para distinguir pago al TC del día vs ejecución del forward. **Pago spot libera el forward** (feedback 2026-06-13): cuando un pago spot cubre el tipo, `liberarForwardsCubiertos` pasa los forwards Pendientes de ese tipo a status **`Liberado`** — quedan cerrados con el banco pero ya no asignados al contenedor (no generan doble pago si después se "ejecutan"). La pestaña Forwards muestra badge gris "Liberado" sin botón Ejecutar; `executeForward` rechaza forwards no-Pendientes y además bloquea si el tipo ya está cubierto. **Validación anti doble-pago** (`validarNuevoPago` en create/múltiple, mismo criterio de "cubierto" que los flags): no se puede pagar un anticipo/saldo ya cubierto ni un contrato ya saldado — lanza toast con mensaje claro. **Saldo = lo que falta** (feedback 2026-06-14): el monto sugerido para "Saldo" ya no es el 90% fijo sino `total − todo lo pagado` (cubre: todo, resto tras anticipo, o resto tras abono); el modal muestra "Falta por pagar". **Reasignar forward liberado** (`reassignForward` + `AsignarForwardModal`): un forward Liberado tiene botón "Asignar" que lo reapunta a otro contrato con anticipo/saldo pendiente sin forward activo (vuelve a `Pendiente`) — como ya está pactado con el banco, de todos modos se paga. **Realizados** tiene filtros: search · chips tipo · select banco · rango fechas con suma filtrada en vivo. **Liquidado** = `saldo_pagado` (no requiere anticipo_pagado). **Flags centralizados en `recalcFlagsContrato`** (única fuente de verdad → `leerEstadoPago` + `cubiertos`; la usan create/delete/forward/múltiple **y NC**) con reglas: (a) el **saldo cubierto POR PAGOS** implica anticipo saldado (feedback 2026-06-11); (b) las **NCs aplicadas reducen lo que se debe imputándose al saldo** pero NO implican anticipo pagado (2026-06-15); (c) "saldado" = pagos+NCs cubren el total. Selector de contrato = **`Combobox`** buscable (escribir el número). El "falta por pagar" resta pagos **y NCs** (`fetchSaldosPorContrato`). **Delete con PIN**: cada row tiene botón trash → `DeleteConfirmModal` con PIN 4 dígitos; `deletePago` recalcula flags a la baja. Bloqueo: `deleteContrato` rechaza si tiene pagos o forwards |
| **Recepción** | ✅ LIVE | `BlufinRecepcionPage.tsx` · `BlufinRecepcionRegistrarPage.tsx` · `recepcion-queries.ts` | KPIs (por recibir / recibidos / kg recibidos / kg faltantes) + **sub-tabs Por recibir / Historial / Calendario** (feedback de uso 2026-06-11). **Por recibir**: ventana operativa **ETA bodega hasta hoy+7d** (incluye atrasados; sin límite inferior desde 2026-06-15 — antes era −3d; contratos sin ETA siempre visibles con badge "Sin ETA"; toggle "Ver todos"), orden ETA ASC. Cada row tiene 2 CTAs: "Registrar recepción" y **"Programar llegada"** (`ProgramarLlegadaModal` → edita `eta_bodega` + `bodega_destino` vía `updateLlegadaContrato`; la ETA auto +7d es estimado, la definitiva se acuerda con el agente al llegar a puerto — implementa regla §14.4). **Calendario**: grid mensual (lunes-domingo, 42 celdas, nav ‹ Hoy ›) con badges por día — verde = recepción registrada, amber = ETA bodega por recibir. Registro en **página dedicada** (`recepcion/registrar/:contratoId`): datos del contenedor (fecha, bodega, presentación recibida vs pactada con warning, **lote**, **naviera real**, **entrada Intelisis OBLIGATORIA** — sin ella el confirmar queda deshabilitado) (ya **no** se captura "Naviera real" — quitado 2026-06-15) + tabla por SKU: **kg recibidos PRE-LLENADOS con los contratados** (solo se teclea si difiere) + **columna Cajas con conversión bidireccional** kg ↔ cajas usando kg/caja del producto (deshabilitada si el producto no tiene kg_caja) + preview de diferencias + sticky footer. `createRecepcion`: 1 recepción por contrato → líneas batch (diferencia = columna generada) → contrato: lote + naviera + llegada_real + bodega_destino + status `Entregado`. `deleteRecepcion` simétrico con PIN: revierte a `En puerto` limpiando lo capturado. Migración `20260611120000`: `entrada_intelisis` + `presentacion_recibida` |
| **Notas de crédito** | ✅ LIVE | `BlufinNotasCreditoPage.tsx` · `nc-queries.ts` · `NuevaNCModal.tsx` · `CapturarMontoNCModal.tsx` · `AplicarNCModal.tsx` | Flujo **Sin monto → Pendiente → Parcial → Aplicada**. KPIs (sin monto / saldo por aplicar / total emitido / timbradas) + sub-tabs **Por aplicar / Aplicadas / Todas** (sin tab "Sin monto" desde 2026-06-15 — "Por aplicar" = todo lo no Aplicado, incluidas las Sin monto; ahí se captura monto y se aplica) + tabla con **filas expandibles** (detalle + aplicaciones). **Razón** presentación/descuento/faltante (`NC_RAZON_META`). **Nueva NC**: descuento exige monto; presentación/faltante pueden crearse "Sin monto" (checkbox "ya tengo el monto"). **Folio interno auto** `NC-0001…` (secuencia `crm.blufin_nc_folio_seq` + `next_blufin_nc_folio()` como default — migración `20260614120000`, que además agregó `fecha` y `nota`). **Capturar monto** (`capturarMontoNC`): NC sin monto → Pendiente, calcula monto_mxn. **Aplicar** (`aplicarNC`): **solo a contratos con saldo pendiente** (decisión 2026-06-15 — lo ya pagado por completo no recibe NC; el dropdown usa `fetchContratosConPendiente` y `aplicarNC` rechaza si el destino tiene anticipo+saldo pagados), a mismo u otro contrato (selector = `Combobox` buscable), valida monto ≤ saldo, inserta en `blufin_nc_aplicaciones`, recalcula saldo + status (Parcial/Aplicada) **y llama `recalcFlagsContrato` del destino** → la NC baja el saldo del contrato y se refleja en Pagos, contenedores y pendientes (fix 2026-06-15; `deleteNotaCredito` revierte). Una NC que cubre el saldo NO marca el anticipo como pagado. **Folio timbrado SAT** se captura inline. **Delete con PIN** (`deleteNotaCredito` borra aplicaciones + NC). **Auto-NC desde Recepción** (2026-06-15): al confirmar una recepción con diferencia de **presentación** (pactada ≠ recibida) o **faltante** (Σ kg recibidos < contratados), `createRecepcion` genera 1 NC "Sin monto" por cada caso (razón correspondiente, `recepcion_origen_id` ligado, nota descriptiva) y devuelve el conteo para el toast. `deleteRecepcion` borra solo las auto-NCs que sigan "Sin monto" (si el usuario ya les capturó monto/aplicó, se conservan). El usuario solo captura el monto y aplica |
| **Facturas** | ✅ LIVE | `BlufinFacturasPage.tsx` · `BlufinFacturaRevisarPage.tsx` · `FacturaDetalleModal.tsx` · `facturas-queries.ts` | Revisión de la factura del proveedor vs contrato, **diff por línea**. **Lista** con KPIs (por revisar / aprobadas / con diferencia / diferencia neta USD) + sub-tabs **Por revisar / Aprobadas / Todas** + tabla (folio, archivo, total contrato, total factura, diferencia, status). **Revisar** en página dedicada (`facturas/revisar`): se elige el contrato (`Combobox`), se **precarga la comparación con los valores del contrato** (kg + precio por línea) y solo se teclea lo que difiere; `total factura = kg × precio`, **match ok/diferente** por línea (tolerancia kg 0.001 / precio 0.0001) con las `diferencias` en jsonb, checkbox aceptar + nota por línea; footer sticky total contrato vs total factura vs diferencia. **Subir PDF/foto** (opcional) → bucket privado `facturas-pdf` (migración `20260616120000`, política dev_open para anon); se abre con **URL firmada** (1h). **Guardar (pendiente)** o **Aprobar** (status `Pendiente revisión` → `Aprobada`; `diferencia_monto` es **columna generada** en BD — no se inserta). **Ficha** (`FacturaDetalleModal`) read-only + Ver archivo + Aprobar. **Delete con PIN** (`deleteFactura` borra líneas + factura + archivo vía **Storage API**, no SQL directo). El parser PDF con LLM (autollenar la factura) sigue pendiente (infra #2) |
| Calendario | 🔜 | — | Reutilizable: ETAs + vencimientos pagos |
| **Central de Costos** | ✅ LIVE | `BlufinCostosPage.tsx` · `costos-queries.ts` | Sub-tabs **Inventario & Costo Promedio** + **Histórico de Precios**. `fetchCostosData` reutiliza fetchContratos/fetchPagos/fetchForwards/fetchSkusBlufin (sin duplicar queries), agrupa las líneas por `sku_id` y arma las **fuentes** (un contenedor por contrato) ordenadas por `eta_bodega` DESC. **TC efectivo por contenedor** (`tcEfectivo`, orden §14.2): pagos reales ponderados `Σ(tc×monto)/Σ(monto)` → `tc_forward` → `tc_ponderado` → null (TC del día sigue stub; si null se muestra "—" y el costo MXN se omite, no se inventa TC). **Inventario**: buscador de SKU (dropdown custom, no datalist porque no está en tabla con overflow) → últimos 5 contenedores con USD/kg, TC (tooltip de origen) y MXN/kg → input **manual** de kg en bodega (decisión usuario 2026-06-13: solo manual, sin pre-llenado) → `calcularPromedio` (§6: toma del más nuevo al más viejo) devuelve avgUSD, avgTC (ponderado solo sobre kg con TC), avgMXN, valor total y **desglose** con barras de % por contenedor. Avisa si el stock excede el historial o si hay kg sin TC. **Histórico**: por SKU, precio FOB a lo largo de los contratos (fecha ASC) con flechas ▲▼ y cambio % punta a punta — datos reales, no mock. **Filtro por producto** + **tarjeta de detalle** (feedback 2026-06-14): clic en una fila del histórico abre un modal con dos **gráficas SVG sin dependencias** (`MiniLineChart`: precio USD/kg y costo MXN/kg por fecha de entrega), las últimas 6 compras (folio, entrega, kg, TC, USD/kg, MXN/kg) y columna de Nota de crédito (placeholder hasta que exista el módulo NC) |
| **Productos** | ✅ LIVE | `BlufinProductosPage.tsx` · `SkuModal.tsx` · `productos-queries.ts` | CRUD del catálogo master de SKUs Blufin (se referencia en contratos, recepciones, costos; servirá para **mapear productos al leer contratos PDF** en carga masiva — pendiente). **El catálogo es la ficha completa**: código, **producto** ("lo que es"), marca, **% peso neto** (producto real vs glaseo, NO "limpieza"), talla, kg/caja — cada combinación producto+marca+talla+% es un SKU distinto (104001 = Filete Basa Pangabay 5/7 oz). **Clasificación por `producto`** (decisión 2026-06-13: se eliminaron `categoria` y `cajas_tipo`, migración `20260613120000`): KPIs muestran los productos con más SKUs, chips de filtro **dinámicos** (productos presentes en el catálogo), search por código/descripción/producto/marca/talla. **La descripción es EDITABLE y debe coincidir con Intelisis** (cambio 2026-06-18, migración `20260618120000` que actualizó las 62 descripciones desde `Catalogo_productos_Blufin_2026-06-18.xlsx`): el modal tiene un input de descripción libre + botón "Generar de la ficha" que la arma con `composeDescripcion` = `PRODUCTO - MARCA - PESO NETO - TALLA` como atajo. Antes se generaba sola; ahora se respeta lo capturado (ej. `Basa Pangabay 100% 5/7 (5.00 kg / Caja)`). Seed `seed_catalogo_blufin.sql` regenerado desde la BD con `scripts/regenerar_seed_catalogo.py`. Alta/edición vía `SkuModal` (producto/marca/talla/% con datalist de sugerencias `PRODUCTOS_BLUFIN`/`MARCAS_BLUFIN`/`TALLAS_BLUFIN`/`PORCENTAJES_BLUFIN` pero texto libre; valida duplicado `23505`). **Sin hard delete**: toggle Activar/Desactivar (`toggleSkuActivo`) — los inactivos desaparecen de los forms de captura (`fetchCatalogos` filtra `activo=true`) y se ven con toggle "Ver inactivos". **Exportar Excel** (2026-06-16): botón en el header → `exportProductos` descarga el catálogo completo (activos + inactivos) como `.xlsx` real |

### Importaciones — Camanchaca y Neptuno

Picker UI los muestra como "Próximamente". Schema Camanchaca y Neptuno **no** migrado todavía. Habilitar cuando Blufin esté completo.

### Resto de módulos

Logística, Ventas, Cobranza, Administración, Contabilidad, RH, Marlin — sidebar los muestra con badge SOON. Schema sin crear, frontend sin crear.

### Pendientes de infraestructura

| # | Pendiente | Bloquea |
|---|---|---|
| 1 | Edge Function `tc-del-dia` con Banxico SIE | Central de Costos, autorrellenar TC en Pagos/Forwards/Pago múltiple |
| 2 | ~~Edge Function parser PDF con LLM~~ | **Resuelto distinto (2026-06-17)**: la carga masiva se hace en **Cowork** (Claude lee los PDFs en la sesión, sin costo de API extra) + zona de staging revisable en la app. No se usa Edge Function. Ver fila "Carga masiva" en la tabla de Blufin |
| 3 | Supabase Auth real (Google Workspace + Microsoft Entra) | RLS endurecida + PIN del super admin movido a DB |
| 4 | RLS por `empresa_id` desde JWT (reemplazar `dev_open`) | Multi-usuario seguro |
| 5 | Supabase Storage buckets — `facturas-pdf` ✅ (2026-06-16) y `documentos-importacion` ✅ (2026-06-17, PDFs de órdenes de compra separadas en carga masiva) creados (privados, política dev_open); falta `logos-proveedores` | Subir logos |
| 6 | PIN del super admin en `crm.usuarios.pin_eliminacion` con hash (bcrypt/argon2) + Edge Function `verify-admin-pin` | Hoy vive en `localStorage` (default `1234`) — stub para desarrollo |

### Datos en BD (capturados EN VIVO por el usuario — no asumir que son desechables)

- **2026-06-12: el usuario limpió la BD para arrancar con datos reales** — 0 contratos, 0 pagos, 0 recepciones
- **2026-06-16: importación masiva de la base real Blufin** (Excel `Base de datos Blufin.xlsx`, 336 contratos). Se borró todo lo de prueba (opción "empezar de cero") y se cargaron vía REST/PostgREST con la anon key + dev_open: **336 contratos · 677 productos · 522 pagos (anticipo+saldo, con TC real) · 79 NCs aplicadas · 308 recepciones** (recibido = contratado; bodegas nuevas para los lugares de llegada). Total ~**$28.8M USD / 7,668 ton**. FACTURA proveedor + Entrada Intelisis + Cliente → en `observaciones`. Luego, del **Calendario PDF** (12-jun) se actualizaron 29 contratos con status real, **ETA puerto** (`eta_puerto`), contenedor, naviera, lote y fechas de anticipo/pago (anticipo/saldo solo en los NO pagados). **Anomalía conocida e INTENCIONAL**: `MCO-CV-003583` está en **MXN** (no USD, TC=1, tilapia a $53) — son contratos "raros" en pesos; el usuario lo dejó así a propósito, NO "corregir". **Pendiente**: 15 contratos "contratada" del PDF (003620–003633, 003621–003632, 003662) NO están en la BD (no venían en el Excel base) — falta decidir si crearlos.
- **2026-06-17: backfill de ETA bodega + reclasificación de status.** (a) A los 27 contratos con `eta_puerto` pero sin `eta_bodega` (salían "Sin ETA" en Recepción) se les puso `eta_bodega = eta_puerto + 7d` (regla §14.4, estimada/editable). (b) Se reclasificaron **7 contratos** que estaban mal como `Entregado` sin recepción: venían de mapear "Liquidada"→Entregado al cargar el Calendario PDF, pero **"Liquidada" = saldo pagado, NO que llegó**. Ahora se rige la invariante **`Entregado` ⟺ tiene recepción** (308); los pagados-pero-en-camino quedan `En tránsito` (ETA futura) o `En puerto` (ETA pasada) y aparecen en Recepción → Por recibir.
- Catálogo: **58 SKUs reales importados** de `LISTA PRODUCTOS IMPORTACION.xlsx` del usuario (OneDrive → Programacion mercancia) con ficha completa: producto/marca/%peso-neto/talla/kg-caja y descripción generada (`PRODUCTO - MARCA - PESO NETO - TALLA`, el 100% se muestra). Upsert idempotente versionado en `supabase/seed/seed_catalogo_blufin.sql`. Productos con más SKUs: Filete Basa (18) · Filete Tilapia (17) · Tilapia Entera (5) · Camaron (3)
- `crm.bodegas` incluye los lugares de llegada del Excel (JALNAY, FRIZAJAL, FRIOMEX, MERCADO, AGUASCALIENTES, CDMX, DURANGO, LEON, LOMA DE ZEMPOALA, TAMPICO, VASOKADI) — varias agregadas en la importación 2026-06-16 para poder ligar las recepciones por FK
- **2026-06-17: carga masiva — lote de ejemplo en staging.** Al construir la carga masiva se procesó el PDF de ejemplo `uploads/contract_pdf-1779219956573.pdf` (17 OC de Menita, folios 003549–003570) a la zona de staging (`blufin_import_lotes` "Ejemplo Menita (17 OC)"). **Los 17 folios YA existían en `blufin_contratos`**, así que el lote sale 100% duplicado — sirve de demostración de la pantalla y de la detección de duplicados, NO se puede importar. Sus 17 PDFs individuales están en el bucket `documentos-importacion/ejemplo-menita/`. El usuario puede descartarlo con el botón "Descartar" cuando quiera. (La prueba de importación real se hizo con folios `TST-IMP-*` y se limpió: la BD sigue en 336 contratos.)
- **2026-06-17: carga de PDFs de contratos y facturas desde Google Drive.** El usuario tiene los PDFs en 2 carpetas de Drive: contratos `CT-####.pdf` (el número = folio: `CT-3549`→`MCO-CV-003549`) y facturas `C####.pdf` / `F-####.pdf` (**el prefijo F-/C del archivo es indistinto — lo que liga es el número**, que es el folio de la factura del CFDI; ese número aparece en `observaciones` como "Factura proveedor C####"). Se descargaron a `uploads/contratos-blufin/` y `uploads/facturas-blufin/` (gitignored) y se ligaron con `scripts/ligar_pdfs.py` (sube al bucket `documentos-importacion` en `contratos/<folio>.pdf` y `facturas/<folio>.pdf`, setea `contrato_pdf_path`/`factura_pdf_path` vía PostgREST). **Resultado: 331/336 contratos con PDF de contrato · 309 con factura · 308 con ambos.** Faltaron 5 contratos (CT-3182, 3405, 3583, 3606, 3656) y 14 facturas (C393x–C396x recientes + C3430) cuyos archivos no venían en el Drive — el usuario los subirá después y se re-corre el script (idempotente). **Aprendizaje**: mover archivos de Drive vía el conector MCP (base64 al contexto) NO sirve para volumen — descargar a disco local + script REST es el camino. Los 45 `CT-####` que venían en la carpeta de facturas se movieron a la de contratos para recuperarlos.
- **Regla aprendida**: el usuario opera la app en vivo sobre el preview mientras se desarrolla — verificar el origen de cualquier dato antes de borrarlo

---

## 17. Patrones de diseño establecidos

Tres skills se aplicaron sobre la base: **emil-design-eng** (Emil Kowalski), **design-taste-frontend-v1** (anti-slop visual) e **impeccable** (product register). Cuando entran en conflicto, **impeccable product gana** porque es un CRM operativo, no marketing.

### Decisiones cementadas

| Decisión | Por qué | Skill que pesó |
|---|---|---|
| **Geist + Geist Mono** como font family | Mejores tabular nums para tablas densas; mantenemos contra `Inter` del product register porque la diferencia es marginal y `Geist` se ve más afilado | design-taste-v1 |
| **Restrained color strategy** — un acento azul ≤10% surface | Producto, no marketing | impeccable |
| **`Geist Mono` para todo número/folio/referencia** con `tabular-nums` | Alineación correcta en tablas financieras | impeccable + emil |
| **Light theme único** sidebar navy + content claro | Operación oficina con luz de día | impeccable theme decision |
| **No Stagger en data lists ni KPIs** | "Product loads into a task; users don't want to watch it load" | impeccable product |
| **`<PageEnter>` sí en headers** (sutil 280ms) | Convey state change sin orquestar carga | impeccable + emil |
| **Press feedback `scale(0.97)`** en todo botón | Touch que se nota; universal good | emil |
| **Hover effects bajo `@media (hover: hover) and (pointer: fine)`** | No falsos hovers en touch | emil |
| **Skeleton loaders, NO spinners centrados** | Producto serio | impeccable + design-taste |
| **Diffusion shadow `0 20px 40px -15px`** en hero tiles únicamente | Premium sin glow | design-taste |
| **Springs Framer Motion solo en mount/dismount de popovers y modales** | Convey state, no decoración | emil + impeccable |
| **Modal para pago individual**, página dedicada para pago múltiple | Forms cortos → modal; con muchas decisiones → página | impeccable |
| **Spacing scale 4/8/12/16/20/24/28/32** (no `13`, `15`, `7`) | Token consistency | DESIGN.md |
| **KPI cards compactos** padding 12×14 · value 20px | Producto operativo: tablas se ganan el espacio, KPIs son orientativos | impeccable density |
| **Page header compact**: title 18px, subtitle 12px, margin-bottom 14px. Tabs 8×14 con 12px font. Grid gap 12px | Maximizar espacio vertical para listas — usuario opera 8h/día sobre tablas | impeccable density |
| **Acciones destructivas con PIN del super admin** (4 dígitos, `<DeleteConfirmModal>`) | Operación familiar — un solo dueño con poder absoluto + auditoría visual cuando borre algo | producto |
| **Radii tokens `--r-sm/md/lg/xl` (6/10/14/20px)** | No `2.5rem` en surfaces principales — esto es herramienta, no Bento dashboard | impeccable |
| **Empty states con icono + título + descripción + CTA**, no solo "Sin datos" | UX writing | impeccable |
| **Sin emojis en código/UI** (`✓`, `🔒`, `⏰` prohibidos) | Reemplazar por badges o Icon component | design-taste + impeccable |

### Patrones de componentes

**Cuando crear un módulo Blufin (tab) nuevo:**

1. Crear `<TabName>Page.tsx` en `src/pages/blufin/` con:
   - `<PageEnter>` solo en el header del tab (no en data)
   - Header con título + subtitle + CTA top-right
   - KPIs row de 4 columnas (instant mount, sin Stagger)
   - Sub-tabs si la tab tiene múltiples vistas (Pendientes/Realizados/Forwards)
   - Lista o tabla con skeleton loader
   - Empty state con CTA
2. Queries en `src/features/blufin/<tab>-queries.ts` con tipos en `src/types/database.ts`
3. Modal de captura `<Feature>Modal.tsx` en `src/features/blufin/` si form ≤ 10 campos
4. Página dedicada de captura `<TabName>Nuevo<X>Page.tsx` si form > 10 campos
5. Habilitar tab en `BlufinLayout.tsx` cambiando `enabled: false → true`
6. Agregar ruta en `App.tsx`
7. Smoke test: navegar → ver lista vacía → crear ítem → verificar persistencia en Supabase → confirmar invalidación de cache + toast
8. Documentar en CLAUDE.md §16

**Cuando el flag de un contrato cambia (anticipo_pagado, saldo_pagado, status):**
La mutación que registra el evento (pago, recepción, etc.) ES responsable de actualizar el flag. No usar triggers SQL todavía (vive en el frontend para que sea visible/testeable). Cuando integremos auth real y multi-usuario, mover a triggers para evitar race conditions.

**Cuando una acción requiere captura en batch (N items con config compartida):**
- Página dedicada (no modal) en `BlufinXMultiplePage.tsx`
- Sección superior con config compartida (TC, banco, fecha, referencia)
- Tabla de items con checkbox-multiselect y override individual por fila
- Sticky footer con count + total USD + total MXN + botón "Registrar N items"
- Mutación batch que (1) inserta N filas con un solo `.insert([...])`, (2) recalcula efectos secundarios (flags de contratos, totales) en paralelo con `Promise.all`, (3) si algún paso falla, todo el batch falla
- Patrón ya implementado en `createPagosMultiples` (`pagos-queries.ts`)

**Cuando una entidad puede eliminarse (pago, contrato, forward, NC, etc.):**
- Botón trash en cada row de la tabla → `setDeleteTarget({ kind, id, description })`
- Reutilizar `<DeleteConfirmModal>` (`src/components/DeleteConfirmModal.tsx`)
- Props: `what` (e.g. "este pago"), `itemDescription` (folio + tipo + monto), `consequences` (qué pasa con flags/datos relacionados)
- Requiere **PIN de 4 dígitos del super admin** (`src/lib/pin.ts`, default `1234`, override en localStorage)
- Solo accesible si `user.rol === 'admin_total'` — el modal muestra warning si no
- Mutación delete debe ser **simétrica al create**: si crear marca un flag, borrar debe **desmarcarlo** recalculando el acumulado. Ejemplo: `deletePago` borra el pago + recalcula `anticipo_pagado`/`saldo_pagado` del contrato según el nuevo acumulado.
- Invalidar todas las queries afectadas en `onSuccess`

**Cuando el módulo tiene `tipos` con metadata visual (anticipo/saldo/abono, tipo de NC, etc.):**
Definir un objeto `TIPO_META` con bg/text/label/icon y un componente `<TipoPill>` que lo renderiza. Mantener consistencia visual.

**Cuando una pantalla captura un formulario largo (contrato, recepción, pago múltiple…):**
Persistir el borrador con `useDraft` (`src/lib/useDraft.ts`) — el usuario opera 8h/día y a menudo sale a verificar algo: nada de lo capturado se debe perder. Patrón: (1) `useState` por cada campo como siempre; (2) un `snapshot` memoizado con todo el estado editable; (3) un `applyDraft(d)` que vuelca el borrador a los setters (con fallbacks por si el borrador es viejo/parcial); (4) `const draft = useDraft(key, snapshot, applyDraft)`. Key namespaced `crm:draft:<pantalla>:<empresa>`. Llamar `draft.clear()` en el `onSuccess` de la mutación y en "Descartar". Mostrar chip "Borrador guardado" + "Descartar" cuando hay contenido. Ya aplicado en `BlufinNuevoContratoPage`; **pendiente** extender a `BlufinRecepcionRegistrarPage` y `BlufinPagoMultiplePage` (ojo en Recepción: el borrador debe convivir con el `useEffect` que precarga líneas desde el contrato).

**Cuando una celda debe elegir de un catálogo grande (SKU, cliente, etc.):**
Usar `<input list="...">` + un `<datalist>` compartido (renderizado una sola vez) en lugar de `<select>`: permite escribir para buscar y el popup nativo no se recorta por `overflow` de la tabla. Guardar el texto en el estado de la fila y resolver a id por etiqueta exacta o por código suelto.

**Cuando un modal/form debe elegir un contrato (o similar) escribiendo:**
Usar `<Combobox>` (`src/components/Combobox.tsx`) — input+datalist genérico que recibe `options: {id,label}[]`, `value`, `onChange(id|null)`. Resuelve el texto a id por etiqueta exacta; el usuario escribe el número/folio y el popup nativo filtra. Ya aplicado en PagoModal, AplicarNCModal, NuevaNCModal, AsignarForwardModal.

**Cuando un modal/overlay se cierra al hacer clic en el backdrop:**
NUNCA poner `onClick={onClose}` directo en el `motion.div` del overlay. Si el usuario arrastra para seleccionar el texto de un input y **suelta el cursor sobre el fondo**, el navegador dispara un `click` cuyo `target` es el overlay y el modal se cierra solo ("seleccionar texto me saca de la ventana", bug 2026-06-15). Usar `useBackdropDismiss` (`src/lib/useBackdropDismiss.ts`): un hook que devuelve `{ onMouseDown, onClick }` y solo cierra cuando el gesto **empezó Y terminó sobre el propio overlay** (`e.target === e.currentTarget` en mousedown **y** en click). Patrón: (1) `const backdrop = useBackdropDismiss(onClose)` al **tope del componente** (regla de hooks — antes de cualquier render condicional `{open && …}`); (2) esparcir `<motion.div {...backdrop} style={overlay}>` en el overlay; (3) dejar el `onClick={(e) => e.stopPropagation()}` del contenido interno como está. Ya aplicado en los 11 modales (PagoModal, ForwardModal, SkuModal, CapturarMontoNCModal, AplicarNCModal, NuevaNCModal, AsignarForwardModal, ContratoDetalleModal, DeleteConfirmModal, ProgramarLlegadaModal en Recepción, SkuPrecioDetalle en Costos). Click-outside con `document.addEventListener('mousedown', …)` + `ref.contains()` es **seguro** (no se dispara en un arrastre que empieza dentro) — no requiere cambio.

**Cuando se exporta data a Excel:**
Usar `downloadXlsx(filename, sheets)` de `src/lib/excel.ts` — genera un `.xlsx` OOXML real (no CSV) **sin dependencias** (arma el ZIP + XML a mano con inline strings y CRC32). Ventajas sobre CSV: abre limpio en Excel español (columnas correctas, sin el problema del separador `;`), conserva acentos (UTF-8) y mantiene los números como números (se suman). Cada `sheet` es `{ name, rows }` con `rows[0]` = encabezados; celdas `string | number | null`. Para varias opciones de exportación en una pantalla, usar el botón-menú `<ExportMenu items={[{ label, hint, onSelect }]} />` (`src/components/ExportMenu.tsx`, click-outside con mousedown). Las funciones que arman las filas viven por módulo (ej. `src/features/blufin/blufin-export.ts`). Ya lo usan el catálogo de Productos y los Contratos de Blufin; reutilizable para Camanchaca/Neptuno y futuros módulos.

**Cuando una pantalla sube archivos (PDF, fotos) a Storage:**
Subir con `supabase.storage.from('<bucket>').upload(path, file)` y leer con **URL firmada** (`createSignedUrl(path, 3600)`) — los buckets son **privados**. El bucket se crea por migración (`insert into storage.buckets` + política dev_open `for all to public using(bucket_id=…)` mientras no haya auth real; endurecer con auth). Path namespaced por entidad (ej. `<folio>/<timestamp>.pdf`). El delete del registro debe quitar también el objeto vía la **Storage API** (`supabase.storage.from(bucket).remove([path])`) — NO se puede borrar `storage.objects` con SQL directo (Supabase lo bloquea con `protect_delete`). Ya aplicado en Facturas (`facturas-queries.ts`, bucket `facturas-pdf`).

### Animación / motion checklist

- [ ] `<PageEnter>` solo en header del módulo, no en data
- [ ] KPIs y filas de tabla aparecen instant (sin fade-up class)
- [ ] Springs (`SPRING.snappy`) solo en mount/dismount de popovers/modales
- [ ] `prefers-reduced-motion: reduce` apaga animaciones (ya en index.css)
- [ ] Press feedback `scale(0.97)` (heredado de `.btn`)
- [ ] Hover lift solo en hero cards (no en data tables)

### Image scaling checklist

- [ ] Logos proveedor en hero tile: `120×60 padding 8 border-radius var(--r-md)`
- [ ] Logos proveedor en module header: `120×60 padding 8`
- [ ] Logos proveedor en secondary tile: `80×40 padding 6 border-radius var(--r-sm)`
- [ ] Avatar de usuario: `32×32 círculo` con iniciales 2 chars, sin color decorativo
- [ ] Brand container sidebar: `32×32` con padding 4

### Anti-patterns que NO repetir

- `transition: all` → siempre propiedades específicas
- `borderRadius: 8` / `10` / `12` hardcoded → siempre `var(--r-sm/md/lg)`
- `padding: 18` / `30` / `42` → solo del scale (4/8/12/16/20/24/28/32)
- `<style>{`...`}</style>` inline en componentes → vive en `src/index.css`
- 3 cards iguales en grid simétrico → usar layout asym o list
- `border-left: 3px var(--accent)` como side-stripe → use badge o full border
- Glow/neon outer shadow → use plain shadow tinted to surface
- Emojis en cualquier lado → Icon component o badge
- `onClick={onClose}` directo en el overlay/backdrop de un modal → usar `{...useBackdropDismiss(onClose)}` (si no, seleccionar texto de un input y soltar sobre el fondo cierra el modal)
