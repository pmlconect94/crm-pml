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
        ├── /contabilidad       ✅ (ContabilidadFacturasPage)
        └── /rh                 ✅ NÓMINA — ver §18
              ├── (índice)      Resumen / dashboard RH
              ├── nominas
              ├── nominas/:semanaId   (detalle con pestañas internas)
              ├── empleados
              ├── prestamos
              └── vacaciones    ← PRÓXIMAMENTE
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

### ~~Recursos Humanos~~ → ✅ YA CONSTRUIDO — ver **§18**
- Expedientes de empleados ✅ · Nómina ✅ · Préstamos ✅
- Vacaciones y permisos → PRÓXIMAMENTE (única parte pendiente)
- Evaluaciones de desempeño → PRÓXIMAMENTE

### Marlin Lizárraga
- Misma plataforma pero con datos de Marlin
- Producción: órdenes de maquila, materia prima, almacenes
- ✅ **Ya habilitado en el switcher de empresa** (lo usa el módulo de RH/Nómina, que
  opera PML y Marlin con modelos de cálculo distintos — ver §18). Los demás módulos
  todavía no leen `empresaId`.

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
| **Contabilidad** | Sin prototipo HTML | **✅ Construido directo en producción** (2026-07-09/13, saltó el flujo de prototipo — pedido explícito del usuario). Ver §16 |
| Recursos Humanos | 🔜 Dashboard básico | Diseñar en prototipo primero |
| Marlin Lizárraga | 🔜 Deshabilitado | Habilitar cuando esté listo |

---

## 16. Estado de construcción real (lo que está live en producción)

**EN PRODUCCIÓN ✅ (2026-06-23):** desplegado en Vercel → **https://pml-connect.vercel.app** (auto-deploy en cada push a `main`). Backend Supabase project `crm-pml` (`xjbhfeqcjjqyjkvdbyxy`, us-east-1), **schema namespace `crm`**. ⚠️ La base de Supabase es **COMPARTIDA** con otros sistemas del usuario (RH/Logística/WMS) — **NO borrar nada que no sea del CRM**, limitar cambios al schema `crm` (ver [[project-supabase-db-compartida]]). Ya con **Supabase Auth real** (correo+contraseña), **RLS endurecida** (`auth_all`, solo `authenticated`; la anon key sola ya no accede) y **bitácora de auditoría** (`crm.audit_log`, quién hizo cada movimiento). **Desde 2026-07-13 también corre infraestructura fuera de Vercel/Supabase:** GitHub Actions (`.github/workflows/sat-sync.yml`) sincroniza facturas del SAT 3x/día (repo `pmlconect94/crm-pml`), y una función Python serverless de Vercel (`api/pdf.py`) genera PDFs de factura on-demand — ver la subsección `### Contabilidad` más abajo.

### Infraestructura del proyecto

| Pieza | Valor |
|---|---|
| **Producción (Vercel)** ✅ | **https://pml-connect.vercel.app** · proyecto `crm-pml` (id `prj_YOcR0ZEDnSaiVGzmDjDqNqbCLYB9`, team `team_50ehqq8196yW0uMKTuEO8eXF` = `ddlpml2-6030s-projects`). Ligado al repo GitHub → **auto-deploy en cada push a `main`** (~1 min). Framework Vite. `vercel.json` con rewrite SPA. **Env vars en Vercel**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (SOLO esas 2; la service_role NUNCA va a Vercel). El conector MCP de Vercel está conectado a la cuenta del usuario (deploy/logs vía MCP) |
| Repo GitHub | `https://github.com/pmlconect94/crm-pml` (privado, rama `main`) |
| Supabase | proyecto `crm-pml` · ref `xjbhfeqcjjqyjkvdbyxy` · us-east-1 · schema `crm` · **base COMPARTIDA con RH/Logística/WMS — no borrar lo ajeno** |
| **Auth** ✅ | **Supabase Auth real** correo+contraseña (sin SSO). **5 usuarios** (nombre/rol/permisos en `user_metadata`, marcados `app:'crm-pml'`): 3 admin_total (ddl.pml2@gmail.com, anasilvia_lizarraga@hotmail.com, lizarragajesus@hotmail.com) + 2 operativos (aleabaroa@hotmail.com = ALEJANDRO ABAROA solo-ver, jefealmacenlizarraga@gmail.com = FERNANDO MAGALLANES captura). **Crear usuarios** = re-habilitar Edge Function `seed-users` (neutralizada/410) con `{email,password,nombre,rol,tabs,capturar}`. **Cambiar password** = engrane del topbar (solo ddl.pml2) → `UsuariosModal` → Edge Function `admin-set-password` (filtra por `app:'crm-pml'`) |
| Dev server | `npm run dev` → puerto 5174 (5173 lo ocupa el sistema de nómina local; `strictPort: false`) |
| Credenciales frontend | `.env.local` (NO versionado — plantilla `.env.example`; keys en Supabase Dashboard → Settings → API). **Los scripts de `scripts/` ahora requieren `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`** (la RLS bloquea la anon key) |
| PIN super admin | default `1234`, override en `localStorage.crm_admin_pin` (para borrados destructivos con `<DeleteConfirmModal>`) |
| Workflow de cierre | al terminar un bloque: actualizar §16, commit en español, push a `main` (**se auto-despliega a Vercel**) |

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

**ÚLTIMA SESIÓN (2026-07-16) — Nómina portada al CRM como módulo RH `/app/rh`. LEER §18.**

Se unieron los dos proyectos: la app de **Nómina** (que corría aparte en `nomina-empresa.vercel.app`)
ahora vive dentro del CRM como el módulo de **Recursos Humanos**. Fue viable porque **ya compartían
el mismo proyecto Supabase** (`xjbhfeqcjjqyjkvdbyxy`, solo cambia el schema: `crm` vs `nomina`) y el
**mismo design system**.

- ✅ Portado: `src/pages/rh/*` (10 pantallas + 8 pestañas) y `src/lib/nomina/*` (calc, format,
  empresas, db, auth). Se descartó el shell propio de la nómina (usa el del CRM).
- ✅ **3 piezas clave** (detalle en §18): `db.ts` (`dbNomina` = schema `nomina`, **sin tipar**),
  `auth.tsx` (adaptador CRM→nómina, mapea roles), `empresas.tsx` (lee el switcher pml/marlin del CRM).
- ✅ **`rh.css`** — el port trajo los componentes pero NO los estilos y el módulo salía amontonado,
  sin filtros y con las tablas rotas: la nómina usa un design system **más denso** y **15 clases que
  el CRM no tiene** (`.segmented`, `.switch`, `.tbl-freeze`…). Se replicó scopeado a `.rh-module`.
  **Verificado con estilos computados; el usuario lo aprobó ("quedó perfecto").**
- ✅ Sidebar: RH desplegable (como Importaciones) + fix del gate hardcodeado a `contabilidad` +
  **Marlin habilitado** en el switcher. Icon: `lock`, `user-plus`. Dep nueva: `xlsx`.

**ESTADO:** rama **`feat/rh-nomina`** (`a1c4b0a` = port, `b6ad5ba` = estilos). **NO mergeada a `main`.**
La nómina vieja **sigue siendo la de producción** y es la que usa RH a diario.

**SIGUIENTE PASO (F5):** el usuario debe **validar los cálculos** del módulo contra la nómina viva
(comparar una nómina real, sin guardar). Cuando cuadre → merge a `main` → activar RH para los
usuarios → retirar el repo/deploy separado de la nómina (`pmlconect94/nomina-empresa`).
⚠️ **Ambas apps escriben en la MISMA BD**: guardar/timbrar desde el CRM afecta nóminas reales.

---

**SESIÓN PREVIA (2026-06-26 → 07-02):** la app se renombró a **ERP** (solo el nombre VISIBLE — título de pestaña "ERP Grupo Lizárraga" + login "ERP Corporativo"; schema `crm`, repo y metadata `app:'crm-pml'` intactos). **La URL de producción cambió a https://pml-connect.vercel.app** (antes `crm-pml.vercel.app`; mismo proyecto Vercel `crm-pml`, auto-deploy en cada push a `main`). Cerrado:
- ✅ **Facturas de correo migradas a Storage** (41): las que solo vivían en Google Drive (`drive_pdf_id`) se copiaron al bucket `documentos-importacion` (`facturas-correo/<C####>.pdf`) y se ligaron (`blufin_facturas.storage_path` + `blufin_contratos.factura_pdf_path`). Antes la app las abría con link de Drive → Google pedía "Solicitar acceso" a quien no era dueño del Drive. Script `scripts/ligar_facturas_correo.py` (modos local y `--drive`; requiere `SUPABASE_SERVICE_ROLE_KEY`). Verificado: abren por URL firmada para cualquier autenticado.
- ✅ **Visor de PDF embebido** (`src/features/blufin/PdfViewerModal.tsx`): Contrato/Factura/Ver PDF abren DENTRO de la app (iframe); el botón "Imprimir" abre pestaña nueva. Los PDFs de Storage se embeben (sin `X-Frame-Options`); los de Drive usan `/preview` (embed) + `/view` (abrir). `resolveFacturaPdf` + `signedUrlAnyBucket` (prueba `documentos-importacion` y luego `facturas-pdf`) en `import-queries.ts`. Usado en ContratoDetalleModal, BlufinRecepcionRegistrarPage, FacturaDetalleModal y Pagos→Pendientes.
- ✅ **4 mejoras Blufin**: (a) ficha con **precios en MXN** (TC real ponderado si liquidado; TC del día estimado, en ámbar, si no). (b) Llegadas→Por producto: folio del contenedor clicable → `SkusContratoModal` (sin precios). (c) Recepción→Por recibir: **fix del "mismo día"** con columna real `blufin_contratos.eta_bodega_confirmada` (migración `20260626120000` + backfill; `updateLlegadaContrato` la pone `true` — ya NO se infiere comparando fechas). (d) Recepción→Historial: buscador + folio clicable → `RecepcionDetalleModal`.
- ✅ **Llegadas: exportar Excel línea-por-SKU** de mercancía por llegar (`exportLlegadasPorSku`: Contrato, Código, Producto, Cantidad, Precio USD, Total USD, ETA bodega, Status).
- ✅ **Pagos→Pendientes**: el monto del **saldo ahora es el REAL** = total − pagado − NCs (con o sin descuentos), no el saldo programado fijo (usa `fetchSaldosPorContrato`); + **botón "Factura"** por contrato (visor embebido). **Costos→Por contenedor**: el buscador ahora también filtra por **producto/SKU** (`ContenedorCosto.lineas` incluye `code`).
- ✅ **Camanchaca (SA + MX) y Neptuno — 1ª versión construida** (commit `0009037`; sidebar + picker habilitados en `27604db`; ver §16 y §7/§8).

**Editor de contratos ✅ (2026-07-06):** botón **"Editar"** en la ficha del contrato (`ContratoDetalleModal`, gated a admin_total/`capturar`) → reusa `BlufinNuevoContratoPage` en **modo edición** (ruta `contratos/editar/:contratoId`): precarga cabecera + renglones (resuelve el SKU-label desde el catálogo), y al guardar hace `updateContrato` (UPDATE de cabecera + **REEMPLAZA** los renglones de producto — borra e inserta) en vez de INSERT, recalculando totales y luego `recalcFlagsContrato`. **NO toca** pagos/forwards/NCs/recepción ni `anticipo_pagado`/`saldo_pagado`/`tc_ponderado`/`lote`/`naviera`/`llegada_real`. El borrador `useDraft` se desactiva en edición (la precarga del contrato manda). Ojo: editar los renglones no re-sincroniza una recepción ya registrada (son snapshots independientes).

**Recepción + almacenes curados ✅ (2026-07-06):** (a) **Editar recepción** en Historial (`EditarRecepcionModal`, botón lápiz por fila) → `updateRecepcion` corrige **fecha y lugar de llegada** (refleja `llegada_real` + `bodega_destino` en el contrato); no toca líneas ni status. (b) **Registrar recepción** ahora precarga por default la **fecha** y el **almacén** que ya se fijaron en "Programar llegada" (usa `eta_bodega_confirmada`/`eta_bodega` + `bodega_destino`). (c) **Almacenes curados a 5** (migración `20260706120000`: columna `crm.bodegas.activo`; `fetchCatalogos` filtra `activo=true`): **MERCADO** (default), FRIZAJAL, JALNAY, VASOKADI, **VENTA DIRECTA**. Las demás bodegas se conservan (FK de recepciones históricas) pero quedan ocultas de los dropdowns. **VENTA DIRECTA** despliega **cliente + ciudad** (columnas `blufin_recepciones.venta_cliente`/`venta_ciudad`; el cliente es obligatorio); se muestran en la ficha de recepción y son editables desde el editor de Historial.

**Versión celular — fundación ✅ (2026-07-06):** shell responsivo — en pantallas `<= 768px` el sidebar pasa a **drawer** (cajón deslizante) con botón **hamburguesa** en el topbar + backdrop (estado `menuOpen` lifteado en `AppLayout`, se cierra al navegar por `useEffect` sobre `location.pathname`); contenido a todo el ancho con padding reducido; `.card { overflow-x:auto }` + `.tabs` con scroll para que las tablas densas no desborden la pantalla. Cambios: `AppLayout`/`Sidebar` (prop `open`)/`Topbar` (prop `onToggleMenu` + botón `.topbar-menu-btn`) + media query `@media (max-width:768px)` en `index.css` + icono `menu`. **Pase global de responsive ✅ (2026-07-06):** en `@media (max-width:768px)` — `.grid-2/3/4` → 1 columna, `.page-header`/`.card-header` apilan, `.tbl`/`.card-body` más compactos, y **`input,select,textarea,.field-input { font-size:16px !important }`** para evitar el **auto-zoom de iOS Safari** al enfocar inputs (causa típica del "mal escalado" en iPhone; el `!important` vence al font-size inline). Verificado en el login a 375px (inputs=16px, sin overflow horizontal). **Falta:** las **filas de datos armadas con `display:grid` inline** (Pagos→Pendientes, Recepción→Por recibir, y varias listas) NO reflowean por CSS (los estilos inline no se pueden sobrescribir con media query) — hacen scroll horizontal dentro de su tarjeta; **refactor por pantalla pendiente** (idealmente con screenshot del usuario para targetear). App usada mayormente en **iPhone**.

**Contabilidad — módulo completo (2026-07-09 → 07-13):** construido de cero (saltó el flujo de prototipo, pedido directo del usuario) — sync SAT→Supabase corriendo en GitHub Actions 3x/día, visor de facturas con filtros, PDF on-demand vía función de Vercel, relaciones (NC↔factura) y pagos/saldo pendiente en el detalle, export a Excel línea-por-concepto con desglose de impuestos, y un fix de robustez en el sync (el SAT a veces "pierde" una solicitud y sin manejarlo tumbaba TODA la sincronización). **Detalle completo, gotchas y las 9 propuestas de features contables pendientes: ver la subsección `### Contabilidad` arriba (dentro de §16) y la fila de §15.**

**PENDIENTE para otra sesión:**
1. **Contabilidad**: ver la lista de 9 propuestas en la subsección `### Contabilidad` arriba — las más directas de construir con lo que ya está son **antigüedad de saldos (AP aging)** y la **alerta de PPD sin complemento de pago**.
2. **Versión celular — pulir pantalla por pantalla** (la fundación/shell ya está — ver nota arriba). Priorizar con el usuario: ventas en Llegadas→Por producto, almacén en Recepción, Pagos→Pendientes, Contratos.
3. Pulir Camanchaca/Neptuno conforme el usuario los pruebe (no verificados interactivamente — se generaron con subagentes).

---

**Sesión 2026-06-22/23 (previa):** la app quedó LIVE, Blufin funcionalmente completo y endurecido para producción. Lo que se cerró:
- ✅ **Deploy a Vercel** (auto-deploy desde GitHub; env vars configuradas — verificado en el bundle).
- ✅ **Supabase Auth real** (correo+contraseña, sin SSO) — `signInWithPassword` + sesión persistente; nombre/rol/permisos en `user_metadata` (ver fila Auth en Foundation).
- ✅ **RLS endurecida** `auth_all` (solo `authenticated`) — migración `20260623120000`. La anon key sola ya no lee/escribe; los scripts usan `SUPABASE_SERVICE_ROLE_KEY`.
- ✅ **Bitácora de auditoría** `crm.audit_log` + trigger `crm.fn_audit` (migración `20260623130000`) — cada movimiento guarda quién (auth.uid()), qué, cuándo. Verificado.
- ✅ **Permisos por usuario** (`user_metadata`: rol + tabs + capturar; rol `operativo`). `BlufinLayout` filtra pestañas + guard de ruta; Recepción oculta captura si `capturar=false`.
- ✅ **Sync del Calendario de llegadas** automático (Apps Script + tarea local `calendario-menita`).
- ✅ **Tab "Llegadas"** (antes Calendario): "Por producto" (default, mercancía por llegar para ventas) + "Calendario" (solo llegadas, sin precios). **Header Blufin** compacto sin datos de Menita.

Pendientes que NO bloquean operación (en orden de valor):
- **RLS por-permiso**: hoy el "solo ver" es de UI (el RLS `auth_all` deja escribir a cualquier autenticado — la bitácora da rendición de cuentas). Endurecer si se quiere candado a prueba de API directa.
- **Pantalla de "restablecer contraseña"** + envío de correo (para que el "¿Olvidaste tu contraseña?" funcione; hoy solo el admin cambia passwords desde el engrane).
- Extender el borrador `useDraft` a `BlufinRecepcionRegistrarPage` y `BlufinPagoMultiplePage` (ver §17).
- Facturación por correo de Menita: Increments 2-3 (ver [[project_facturacion_correo]]).
- TC del día: opción de migrar la fuente al FIX oficial de Banxico (token gratis).
- Las 5 contraseñas se escribieron en el chat de esta sesión — recordar al usuario cambiarlas desde el engrane.

**Camanchaca (SA + MX) y Neptuno YA están construidos** (1ª versión, 2026-06-26 — ver la subsección abajo y §7/§8). Lo que sigue: probarlos/pulirlos, el **editor de contratos** y la **versión celular** (ver el bloque de PENDIENTE arriba).

### Foundation ✅

| Pieza | Detalle |
|---|---|
| Stack | Vite 5 + React 18 + TS estricto + Tailwind v3 + Supabase JS + React Router v6 + TanStack Query + **Framer Motion 12** + Sonner |
| Auth | **Supabase Auth real ✅ LIVE (2026-06-23)** — login propio correo+contraseña (`LoginPage.tsx` portada con logos; **SIN SSO ni auto-registro**). `src/lib/auth.tsx` usa `supabase.auth.signInWithPassword` + `getSession`/`onAuthStateChange`; `supabase.ts` con `persistSession:true`. El **nombre y rol viven en `user_metadata`** del usuario de Auth (no en código ni tabla): `usuarioDeSesion()` los lee. `AppLayout` espera `loading` antes de decidir (sin parpadeo). **3 usuarios creados a mano** (todos `admin_total`/ven todo): DIEGO DIAZ (ddl.pml2@gmail.com), ANA SILVIA (anasilvia_lizarraga@hotmail.com), JESUS (lizarragajesus@hotmail.com). Se crearon con una Edge Function temporal `seed-users` (service_role, contraseñas solo en el body de la llamada, **neutralizada** tras usarse — devuelve 410). NO hay módulo de usuarios. Para agregar/cambiar usuarios: dashboard de Supabase Auth (o re-habilitar seed-users). |
| Cliente Supabase | `src/lib/supabase.ts` con `db: { schema: 'crm' }` por default |
| Tipos | `src/types/database.ts` manual con tablas core + Blufin (contratos, productos, pagos, forwards, recepciones + líneas). Regenerar con CLI cuando schema crezca mucho |
| Shell | Sidebar con switcher PML/Marlin, topbar con switcher de empresa (popover Framer Motion), AppLayout con Outlet |
| Migraciones empacadas | `supabase/migrations/*.sql` versionadas para re-aplicar a cualquier proyecto |
| Context para skills | `PRODUCT.md` y `DESIGN.md` en raíz |

### Importaciones — Blufin Seafood

| Tab | Estado | Archivos | Notas |
|---|---|---|---|
| **Contratos** | ✅ LIVE | `BlufinContratosListPage.tsx` · `BlufinNuevoContratoPage.tsx` · `BlufinCargaMasivaPage.tsx` (carga masiva ✅ — ver fila abajo) | Auto-cálculos: ETA bodega = ETA puerto + 7d · anticipo 10%. **Líneas de producto SKU-first** (rediseño 2026-06-12): se elige el SKU y su ficha (descripción, marca, %, talla, kg/caja) se copia del catálogo como **snapshot de solo lectura** — solo se capturan kg ↔ cajas (conversión bidireccional) y precio USD; inputs deshabilitados hasta elegir SKU; línea válida requiere SKU + kg. El mismo flujo servirá para la carga masiva PDF: el parser mapeará líneas del PDF contra el catálogo. **Buscador de SKU** (2026-06-13): la celda SKU es un `<input list>` con datalist compartido — se escribe código o nombre y autocompleta; resuelve por etiqueta `código — descripción` o por código suelto. **Columna Saldo** (2026-06-15): junto a "Costo USD" se muestra el saldo por liquidar = `total − pagado − NCs aplicadas` (o "Liquidado" si anticipo+saldo cubiertos; usa `fetchSaldosPorContrato`). **Ficha de detalle**: clic en una fila abre `ContratoDetalleModal` con todo el contrato (resumen de saldo, productos, pagos, forwards, recepción con líneas, NCs de origen) vía `fetchContratoDetalle`. **Borrador automático** (`useDraft`, `src/lib/useDraft.ts`): todo lo capturado se persiste en `localStorage` (`crm:draft:blufin-nuevo-contrato:<empresa>`) en cada cambio; al volver a la pantalla se restaura. Chip "Borrador guardado" + botón "Descartar" (con confirm) en el header; "Salir" conserva el borrador; al guardar con éxito se limpia. Lote y naviera NO se capturan al crear (van en Recepción/Embarque). TC ponderado se llena con `getTcDelDia()` (Edge Function `tc-del-dia` LIVE 2026-06-22 → tasa de mercado del día; null si no carga). **Exportar Excel** (2026-06-16): menú `ExportMenu` en el header con 2 opciones → `exportContratos` (lista con folios, fechas de llegada, totales, estado de pago y saldo pendiente) y `exportProductosPorContrato` (cada producto en su fila con su contrato y fechas de llegada, ordenado por ETA bodega ASC). Ambos vía `downloadXlsx` (`src/features/blufin/blufin-export.ts`). **Rediseño 2026-06-16** (feedback: tabla muy apretada): KPIs de 4 tarjetas → **stat strip de una línea** (contratos · en tránsito · terminados · USD comprometido · kg); filtros = **Activos (default) / Terminados / Todos** con conteo en el chip (`esTerminado` = `status==='Entregado' && saldo_pagado`); columna **Kg quitada**; columna **ETA puerto** (la tabla se **ordena por esta fecha ascendente** — próximos primero, nulos al final; feedback 2026-06-17): muestra el ETA a puerto y, si ya llegó, "llegó {fecha} · {lugar}"; columna **Contenedor** ahora trae contenedor + naviera (del Calendario PDF). En **Recepción → Por recibir** la ETA bodega estimada (= ETA puerto + 7d, helper `etaBodegaAuto`) sale con badge **"ETA estimada +7d"**; al **Programar llegada** se pone la fecha oficial y deja de ser estimada. **Status calculado** (feedback 2026-06-17, `statusContrato` en `src/features/blufin/status.ts`): el status NO se confía del campo guardado (depende de hoy) — se deriva: **Entregado** = tiene recepción (el `status` guardado solo se usa para detectar esto, invariante Entregado ⟺ recepción); **En puerto** = tiene contenedor+naviera y su ETA puerto ya llegó (**hoy ≥ ETA, incluye el día del ETA** — fix 2026-06-18; además `hoyISO` usa la **fecha local del navegador**, no UTC, para que el cambio ocurra a medianoche local y no se adelante en CST); **En tránsito** = tiene contenedor+naviera y ETA puerto futura (hoy < ETA); **Contratado** = aún sin contenedor ni naviera. Se usa en todos los `<StatusPill>` (lista, ficha, recepción, registrar, factura) + KPIs + export. El campo guardado se backfillea para que labels secundarios/consultas crudas queden consistentes, pero el display siempre usa la función en vivo. La ficha (`ContratoDetalleModal`) agrega fila de logística: naviera, contenedor, ETA puerto, llegó a bodega, fecha anticipo, fecha pago saldo. **Descarga de PDFs (2026-06-17):** la ficha tiene en la cabecera 2 botones — **Contrato** (PDF de la orden de compra) y **Factura** (PDF de la factura del proveedor) — que se muestran solo si el contrato tiene ligado `contrato_pdf_path` / `factura_pdf_path` (migración `20260617130000`) y abren el PDF con URL firmada del bucket `documentos-importacion` (`abrirPdf` reusa `getImportPdfUrl`). Los PDFs viven en Google Drive del usuario (carpeta de contratos `CT-####.pdf` 1:1 con folio; facturas por año `C####.pdf` que matchean el "Factura proveedor C####" de observaciones) y se cargan a Storage + se ligan con scripts locales (`scripts/`, ver §16 "Carga de PDFs"). `importarLote` de la carga masiva también setea `contrato_pdf_path`. **Indicador de PDFs en la lista (2026-06-18):** junto al folio, 2 iconitos (`file-text` = contrato, `receipt` = factura) en azul si el contrato tiene ese PDF ligado y gris tenue (`--ink-200`) si no — para ver de un vistazo desde la lista sin abrir la ficha, sin agregar columna ni alto a la tabla. **Orden por columnas (2026-06-18):** los títulos de la tabla son clicables para ordenar (folio, producto, status, contenedor, costo USD, saldo, pagos) con indicador ▲/▼ en la activa y ↕ tenue en las demás; el **orden por defecto siempre es ETA puerto ascendente** (estado `sort` con default `{by:'eta',dir:'asc'}`, las demás columnas hacen tie-break por ETA) |
| **Carga masiva (PDF)** | ✅ LIVE | `BlufinCargaMasivaPage.tsx` · `BlufinCargaMasivaRevisarPage.tsx` · `import-queries.ts` · `scripts/split_contratos_pdf.py` | Sub-página de Contratos (`contratos/carga-masiva`). **Decisión 2026-06-17**: en vez de Edge Function con LLM (sería un cargo de API aparte), el procesamiento se hace **en Cowork** (Claude lee los PDFs nativamente en la sesión, sin costo extra). Flujo: (1) el usuario pone los PDFs de Menita en `uploads/contratos-blufin/` (gitignored); (2) Claude lee cada PDF, separa las órdenes de compra, extrae folio/fechas/ETA/totales/anticipo/saldo/renglones y **mapea cada renglón al SKU del catálogo con nivel de confianza** (alta/media/baja); (3) separa el PDF en un PDF por orden (`split_contratos_pdf.py`, pypdf — detecta cada OC por `NÚMERO: MCO-CV-…`) y lo sube al bucket **`documentos-importacion`** vía REST; (4) inserta todo en **staging** (`crm.blufin_import_lotes` / `blufin_import_contratos` / `blufin_import_lineas`, migración `20260617120000`) con `duplicado=true` para folios que ya existen. **La pantalla** lista los lotes (badges: listos/duplicados/importados/omitidos) → "Revisar" abre la página dedicada con KPIs + una tabla editable por contrato: cada renglón tiene `Combobox` de SKU pre-cargado con el sugerido + badge de confianza, badge "Duplicado"/"Falta SKU", botón "Ver PDF" (URL firmada 1h) y "Omitir". **Importar** (`importarLote`): promueve cada contrato pendiente no-duplicado con todas sus líneas con SKU a `blufin_contratos` + `blufin_contrato_productos` reusando `createContrato` (la línea final usa la **ficha del SKU** del catálogo + las cantidades/precio del PDF, igual que captura manual); duplicados → omitidos; líneas sin SKU bloquean ese contrato. Nada toca las tablas reales hasta confirmar. Verificado end-to-end 2026-06-17 (importación probada con folios TST y limpiada). **Pendiente**: extender `useDraft`, y aplicar el mismo flujo a Camanchaca/Neptuno cuando se construyan |
| **Pagos** | ✅ LIVE | `BlufinPagosPage.tsx` · `PagoModal.tsx` · `ForwardModal.tsx` · `BlufinPagoMultiplePage.tsx` · `pagos-queries.ts` | Sub-tabs Pendientes / Realizados / Forwards. **Pendientes rediseñado por semana** (feedback 2026-06-18): la vista ya NO agrupa por contrato sino que separa con un **toggle Anticipos / Saldos** (con conteo) y, dentro del tipo elegido, **agrupa los pagos por semana de su fecha programada** (`anticipo_fecha` / `saldo_fecha`). Grupos en orden: **Atrasado** (rojo — lo no pagado de semanas previas, lunes de su semana < lunes de hoy; es la "lista de lo pendiente que rodó") → **Esta semana** (azul, resaltado) → semanas futuras ("Semana del DD-mmm al DD-mmm") → **Sin fecha programada** (gris). Semana = lunes-domingo en **hora local** (helpers `lunesDe`/`isoLocal`/`addDias` en la página). Cada grupo es un card con cabecera (punto de color + label + nº pagos + total USD) y filas (folio + status · monto + "Programado <fecha>" · vencimiento/badge forward · botón Pagar/Pagar spot). Arriba, un `StatStrip` resume **"$ esta semana"** (azul) y **"$ atrasado"** (rojo) para responder de un vistazo "¿qué tengo que pagar esta semana?". El botón Pagar conserva la lógica de forward (badge "FORWARD CERRADO PARA …" + "Pagar spot"). **3 modos de captura**: (1) Pago individual vía `PagoModal` con auto-fill monto + auto-update flag contrato. (2) Forward vía `ForwardModal` con TC pactado + fecha entrega futura. (3) Pago múltiple vía `BlufinPagoMultiplePage` — página dedicada con checkbox-multiselect, TC/banco/fecha compartidos, override de monto por fila, sticky footer con totales, mutación batch `createPagosMultiples`. **Ejecutar forward**: botón "Ejecutar" en sub-tab Forwards convierte forward Pendiente en pago real (`executeForward`) — inserta pago con TC pactado + referencia `FORWARD ejecutado <fecha>` + cambia status a Ejecutado + recalcula flag. **Bloqueos**: 1 solo forward Pendiente por (contrato, asociado_a) — opción "Cubre anticipo/saldo" se deshabilita en modal si ya existe. **Pendientes con forward** muestran badge "FORWARD CERRADO PARA <fecha entrega>" y CTA cambia a "Pagar spot" para distinguir pago al TC del día vs ejecución del forward. **Pago spot libera el forward** (feedback 2026-06-13): cuando un pago spot cubre el tipo, `liberarForwardsCubiertos` pasa los forwards Pendientes de ese tipo a status **`Liberado`** — quedan cerrados con el banco pero ya no asignados al contenedor (no generan doble pago si después se "ejecutan"). La pestaña Forwards muestra badge gris "Liberado" sin botón Ejecutar; `executeForward` rechaza forwards no-Pendientes y además bloquea si el tipo ya está cubierto. **Validación anti doble-pago** (`validarNuevoPago` en create/múltiple, mismo criterio de "cubierto" que los flags): no se puede pagar un anticipo/saldo ya cubierto ni un contrato ya saldado — lanza toast con mensaje claro. **Saldo = lo que falta** (feedback 2026-06-14): el monto sugerido para "Saldo" ya no es el 90% fijo sino `total − todo lo pagado` (cubre: todo, resto tras anticipo, o resto tras abono); el modal muestra "Falta por pagar". **Reasignar forward liberado** (`reassignForward` + `AsignarForwardModal`): un forward Liberado tiene botón "Asignar" que lo reapunta a otro contrato con anticipo/saldo pendiente sin forward activo (vuelve a `Pendiente`) — como ya está pactado con el banco, de todos modos se paga. **Realizados** tiene filtros: search · chips tipo · select banco · rango fechas con suma filtrada en vivo. **Liquidado** = `saldo_pagado` (no requiere anticipo_pagado). **Flags centralizados en `recalcFlagsContrato`** (única fuente de verdad → `leerEstadoPago` + `cubiertos`; la usan create/delete/forward/múltiple **y NC**) con reglas: (a) el **saldo cubierto POR PAGOS** implica anticipo saldado (feedback 2026-06-11); (b) las **NCs aplicadas reducen lo que se debe imputándose al saldo** pero NO implican anticipo pagado (2026-06-15); (c) "saldado" = pagos+NCs cubren el total. Selector de contrato = **`Combobox`** buscable (escribir el número). El "falta por pagar" resta pagos **y NCs** (`fetchSaldosPorContrato`). **Delete con PIN**: cada row tiene botón trash → `DeleteConfirmModal` con PIN 4 dígitos; `deletePago` recalcula flags a la baja. Bloqueo: `deleteContrato` rechaza si tiene pagos o forwards |
| **Recepción** | ✅ LIVE | `BlufinRecepcionPage.tsx` · `BlufinRecepcionRegistrarPage.tsx` · `recepcion-queries.ts` | KPIs (por recibir / recibidos / kg recibidos / kg faltantes) + **sub-tabs Por recibir / Historial / Calendario** (feedback de uso 2026-06-11). **Por recibir**: ventana operativa **ETA bodega hasta hoy+7d** (incluye atrasados; sin límite inferior desde 2026-06-15 — antes era −3d; contratos sin ETA siempre visibles con badge "Sin ETA"; toggle "Ver todos"), orden ETA ASC. Cada row tiene 2 CTAs: "Registrar recepción" y **"Programar llegada"** (`ProgramarLlegadaModal` → edita `eta_bodega` + `bodega_destino` vía `updateLlegadaContrato`; la ETA auto +7d es estimado, la definitiva se acuerda con el agente al llegar a puerto — implementa regla §14.4). **Calendario**: grid mensual (lunes-domingo, 42 celdas, nav ‹ Hoy ›) con badges por día — verde = recepción registrada, amber = ETA bodega por recibir. Registro en **página dedicada** (`recepcion/registrar/:contratoId`): datos del contenedor (fecha, bodega, presentación recibida vs pactada con warning, **lote**, **naviera real**, **entrada Intelisis OBLIGATORIA** — sin ella el confirmar queda deshabilitado) (ya **no** se captura "Naviera real" — quitado 2026-06-15) + tabla por SKU: **kg recibidos PRE-LLENADOS con los contratados** (solo se teclea si difiere) + **columna Cajas con conversión bidireccional** kg ↔ cajas usando kg/caja del producto (deshabilitada si el producto no tiene kg_caja) + preview de diferencias + sticky footer. `createRecepcion`: 1 recepción por contrato → líneas batch (diferencia = columna generada) → contrato: lote + naviera + llegada_real + bodega_destino + status `Entregado`. `deleteRecepcion` simétrico con PIN: revierte a `En puerto` limpiando lo capturado. Migración `20260611120000`: `entrada_intelisis` + `presentacion_recibida`. **Mejoras 2026-06-18:** (a) **Programar llegada** — si la ETA bodega ya es oficial (no la estimada +7d), el botón cambia a "Llegada programada" (verde, con check) y al picarlo pide confirmación "¿Te gustaría reprogramarla?" antes de abrir el modal. (b) **Calendario** con 3 colores + leyenda arriba: verde = Recibido, **violeta = Llegada programada** (ETA oficial), amber = ETA estimada (+7d); cada chip de contrato es **clicable y abre la ficha** (`ContratoDetalleModal`). (c) **Historial** muestra bajo el folio las **descripciones de los productos** de esa recepción (de `lineas[].sku.descripcion`, máx 3 + "+N más"). (d) **Registrar recepción** tiene en la cabecera botones **Contrato** y **Factura** que descargan el PDF (URL firmada) si el contrato los tiene ligados |
| **Notas de crédito** | ✅ LIVE | `BlufinNotasCreditoPage.tsx` · `nc-queries.ts` · `NuevaNCModal.tsx` · `CapturarMontoNCModal.tsx` · `AplicarNCModal.tsx` | Flujo **Sin monto → Pendiente → Parcial → Aplicada**. KPIs (sin monto / saldo por aplicar / total emitido / timbradas) + sub-tabs **Por aplicar / Aplicadas / Todas** (sin tab "Sin monto" desde 2026-06-15 — "Por aplicar" = todo lo no Aplicado, incluidas las Sin monto; ahí se captura monto y se aplica) + tabla con **filas expandibles** (detalle + aplicaciones). **Razón** presentación/descuento/faltante (`NC_RAZON_META`). **Nueva NC**: descuento exige monto; presentación/faltante pueden crearse "Sin monto" (checkbox "ya tengo el monto"). **Folio interno auto** `NC-0001…` (secuencia `crm.blufin_nc_folio_seq` + `next_blufin_nc_folio()` como default — migración `20260614120000`, que además agregó `fecha` y `nota`). **Capturar monto** (`capturarMontoNC`): NC sin monto → Pendiente, calcula monto_mxn. **Aplicar** (`aplicarNC`): **solo a contratos con saldo pendiente** (decisión 2026-06-15 — lo ya pagado por completo no recibe NC; el dropdown usa `fetchContratosConPendiente` y `aplicarNC` rechaza si el destino tiene anticipo+saldo pagados), a mismo u otro contrato (selector = `Combobox` buscable), valida monto ≤ saldo, inserta en `blufin_nc_aplicaciones`, recalcula saldo + status (Parcial/Aplicada) **y llama `recalcFlagsContrato` del destino** → la NC baja el saldo del contrato y se refleja en Pagos, contenedores y pendientes (fix 2026-06-15; `deleteNotaCredito` revierte). Una NC que cubre el saldo NO marca el anticipo como pagado. **Folio timbrado SAT** se captura inline. **Delete con PIN** (`deleteNotaCredito` borra aplicaciones + NC). **Auto-NC desde Recepción** (2026-06-15): al confirmar una recepción con diferencia de **presentación** (pactada ≠ recibida) o **faltante** (Σ kg recibidos < contratados), `createRecepcion` genera 1 NC "Sin monto" por cada caso (razón correspondiente, `recepcion_origen_id` ligado, nota descriptiva) y devuelve el conteo para el toast. `deleteRecepcion` borra solo las auto-NCs que sigan "Sin monto" (si el usuario ya les capturó monto/aplicó, se conservan). El usuario solo captura el monto y aplica |
| **Facturas** | ✅ LIVE | `BlufinFacturasPage.tsx` · `BlufinFacturaRevisarPage.tsx` · `FacturaDetalleModal.tsx` · `facturas-queries.ts` | Revisión de la factura del proveedor vs contrato, **diff por línea**. **Lista** con KPIs (por revisar / aprobadas / con diferencia / diferencia neta USD) + sub-tabs **Por revisar / Aprobadas / Todas** + tabla (folio, archivo, total contrato, total factura, diferencia, status). **Revisar** en página dedicada (`facturas/revisar`): se elige el contrato (`Combobox`), se **precarga la comparación con los valores del contrato** (kg + precio por línea) y solo se teclea lo que difiere; `total factura = kg × precio`, **match ok/diferente** por línea (tolerancia kg 0.001 / precio 0.0001) con las `diferencias` en jsonb, checkbox aceptar + nota por línea; footer sticky total contrato vs total factura vs diferencia. **Subir PDF/foto** (opcional) → bucket privado `facturas-pdf` (migración `20260616120000`, política dev_open para anon); se abre con **URL firmada** (1h). **Guardar (pendiente)** o **Aprobar** (status `Pendiente revisión` → `Aprobada`; `diferencia_monto` es **columna generada** en BD — no se inserta). **Ficha** (`FacturaDetalleModal`) read-only + Ver archivo + Aprobar. **Delete con PIN** (`deleteFactura` borra líneas + factura + archivo vía **Storage API**, no SQL directo). **Aprobar = la factura reescribe el contrato** (decisión 2026-06-18, `approveFactura` reescrito): al aprobar, las **líneas del contrato** (`blufin_contrato_productos`) se reemplazan con lo facturado (SKU mapeado + kg/precio de la factura, snapshot del catálogo) y se recalcula `total_usd`/`total_kg`/`saldo_usd` (= total − anticipo). Los **pagos ya hechos NO se tocan** — se conservan; solo se recalculan `saldo`/flags vía `recalcFlagsContrato` (un contrato nunca se liquida antes de tener la factura, así que no hay conflicto). Requiere que TODAS las líneas tengan **`sku_id` mapeado** (la página de revisión tiene un `Combobox` de SKU por línea con badge "Falta SKU"; bloquea Aprobar si falta alguno). Migración `20260618140000`: `blufin_facturas` += `origen`('manual'/'correo')/`factura_num`/`xml_path`/`email_message_id` (idempotencia); `blufin_factura_lineas` += `sku_id`/`confianza`. Validado con test transaccional (cambio de qty+sku+precio → contrato reescrito, pago conservado). **Al aprobar también se liga el PDF de la factura al contrato** (2026-06-22, migración `20260622120000`: `blufin_contratos` += `factura_drive_pdf_id`): `approveFactura` copia el `drive_pdf_id` de la factura al contrato para que la **lista de contratos muestre el indicador "tiene factura"** (icono receipt azul) y se pueda **descargar la factura desde el contrato** (ficha + Registrar recepción), sin copiar el binario a Storage. Helper `abrirFacturaDeContrato` (en `import-queries.ts`) resuelve el PDF de la factura de un contrato venga de Storage (`factura_pdf_path`, históricas) o de Drive (`factura_drive_pdf_id`, las de correo); lo usan `ContratoDetalleModal` y `BlufinRecepcionRegistrarPage`, y el indicador de la lista prende con cualquiera de los dos. Backfill aplicado a las facturas ya aprobadas. **Pendiente**: que la rutina copie el PDF a Storage (hoy se referencia de Drive). **Ver PDF + verificación de mapeo** (2026-06-18, migración `20260618150000`: `blufin_facturas` += `drive_pdf_id`): la ficha (`FacturaDetalleModal`) tiene botón **"Ver PDF"** que abre el PDF de la factura — de Storage (`storage_path`) si hay copia, o **directo de Google Drive** (`https://drive.google.com/file/d/<drive_pdf_id>/view`) para las que llegan por correo (no se pudo copiar el binario de Drive a Storage a mano; la rutia podrá copiarlo después) — y bajo cada línea muestra **"En factura: \<descripción cruda\>"** cuando difiere del SKU mapeado, para verificar el mapeo contra el PDF. **EN CONSTRUCCIÓN — facturación por correo** (idea del usuario 2026-06-18): las facturas de Menita llegan por correo de `facturacion@menita.com.mx` (PDF + **XML CFDI**) a `ddl.pml2@gmail.com`. Plan en 3 fases: (1) ✅ esquema + "aprobar reescribe el contrato"; (2) 🔜 auto-subida: leer el correo (XML+PDF), mapear SKU/precio/cantidad vs contrato y dejar la factura "Por revisar" pre-llenada (patrón Cowork, igual que carga masiva); (3) 🔜 rutina en la nube a las 8am (verificar disponibilidad de Gmail+Supabase MCP en entorno headless). El parser PDF con LLM como Edge Function queda descartado (igual que carga masiva — se procesa en sesión) |
| **Calendario** | ✅ LIVE | `BlufinCalendarioPage.tsx` | Tab propio (header renombrado **"Llegadas"**). **2 sub-vistas** (default **"Por producto"**); la sub-vista **"Lista" se ELIMINÓ** el 2026-06-23 (con su `downloadICS`/.ics). **Por producto** (`PorProductoView`, para ventas): buscador de mercancía POR LLEGAR que **agrupa por SKU** (solo contratos NO recibidos) mostrando **total kg + nº de contenedores**; **clic en el SKU despliega los contenedores ordenados por ETA ascendente** (más próximo → más viejo) con cuándo llega (ETA bodega, badge "est." si estimada), contrato+status, kg y cajas. **Sin precios ni ficha** (decisión usuario 2026-06-23: este tab es para ventas — clic en contenedor NO abre `ContratoDetalleModal`). StatStrip: productos · contenedores · kg en camino; búsqueda por producto/talla/folio/contenedor. **Calendario** (`CalendarioGrid`): grid mensual SOLO de **llegadas** (ETA puerto azul · ETA bodega violeta-oficial / ámbar-estimada · recibido verde; **sin eventos de pago** desde 2026-06-23), chips por día **no clicables** (sin ficha), leyenda de 4 colores, StatStrip en tránsito · en puerto · ETAs esta semana. Reúsa `fetchContratos`+`fetchRecepciones` (queryKeys `['blufin_contratos']`/`['blufin_recepciones']` compartidas, sin queries nuevas), `statusContrato`, `etaBodegaAuto`. Los recibidos (recepción/`llegada_real`/Entregado) se excluyen. **Historial**: la 1ª versión (2026-06-22) tenía 3 vistas (Calendario/Lista) con eventos de pago + `.ics` + ficha al clic; se simplificó a estas 2 sin precios. |
| **Central de Costos** | ✅ LIVE | `BlufinCostosPage.tsx` · `costos-queries.ts` | Sub-tabs **Inventario & Costo Promedio** + **Por contenedor** + **Histórico de Precios** (3 tabs desde 2026-06-22). **TC del día (estimado)** (feedback 2026-06-22): barra ámbar arriba con input editable de TC, **prellenado automáticamente con la tasa de mercado USD→MXN de hoy** vía la Edge Function `tc-del-dia` (`getTcDelDiaInfo` en `src/lib/tc.ts`; el texto dice "Tomado automáticamente de la tasa de mercado del &lt;fecha&gt;"). La tasa en vivo **gana** sobre el respaldo (TC del último pago `tcDelDiaSugerido`, que solo se usa si la función no carga) y no se sobreescribe si el usuario teclea manual (`tcTouchedRef`). Se usa para los contenedores SIN TC oficial — esos costos MXN salen en **ámbar con "est."** marcados como ESTIMADOS al día de hoy (helpers `TcCell`/`MxnKgCell`; `calcularPromedio` recibe `tcEstimado` y reporta `kgEstimado`/`usaEstimado`). **Inventario separa llegados vs futuras cargas** (feedback 2026-06-22): solo los contenedores que YA llegaron a bodega (`llegada_real != null`, campo `llego` en `FuenteCosto`) cuentan para los "últimos 5" y el costo promedio; los que no han llegado salen en una tabla aparte **"Futuras cargas"** (no cuentan para el costo). **Pestaña "Por contenedor"** (nueva 2026-06-22): lista TODOS los contenedores (un contrato = un contenedor, tipo `ContenedorCosto`), buscable por folio/contenedor/naviera, con badges Liquidado/Pendiente/En camino; cada fila es expandible y muestra el costo en MXN — **oficial si está liquidado (TC real) o ESTIMADO en ámbar con el TC del día si no** — con detalle por producto. `fetchCostosData` reutiliza fetchContratos/fetchPagos/fetchForwards/fetchSkusBlufin (sin duplicar queries), agrupa las líneas por `sku_id` y arma las **fuentes** (un contenedor por contrato) ordenadas por `eta_bodega` DESC. **TC efectivo por contenedor** (`tcEfectivo`): **el TC solo es OFICIAL cuando el contenedor está LIQUIDADO (saldo pagado)** — decisión usuario 2026-07-07. Antes bastaba con tener cualquier pago (el anticipo) y tomaba ese TC, lo que daba un costo MXN engañoso en contenedores con anticipo pagado pero saldo pendiente. Ahora, si **no está pagado completo → `tc=null`** y el contenedor usa el **TC del día estimado de la barra** (tasa de mercado en vivo) saliendo en **ámbar como ESTIMADO**, tanto en Inventario como en Por contenedor. Cuando SÍ está liquidado: pagos reales ponderados `Σ(tc×monto)/Σ(monto)` → `tc_forward` → `tc_ponderado`. Si no está liquidado y tampoco hay TC del día se muestra "—" (no se inventa TC). `fetchCostosData` pasa `liquidado = saldo_pagado === true` a `tcEfectivo`. **Inventario**: buscador de SKU (dropdown custom, no datalist porque no está en tabla con overflow) → últimos 5 contenedores con USD/kg, TC (tooltip de origen) y MXN/kg → input **manual** de kg en bodega (decisión usuario 2026-06-13: solo manual, sin pre-llenado) → `calcularPromedio` (§6: toma del más nuevo al más viejo) devuelve avgUSD, avgTC (ponderado solo sobre kg con TC), avgMXN, valor total y **desglose** con barras de % por contenedor. Avisa si el stock excede el historial o si hay kg sin TC. **Histórico**: por SKU, precio FOB a lo largo de los contratos (fecha ASC) con flechas ▲▼ y cambio % punta a punta — datos reales, no mock. **Filtro por producto** + **tarjeta de detalle** (feedback 2026-06-14): clic en una fila del histórico abre un modal con dos **gráficas SVG sin dependencias** (`MiniLineChart`: precio USD/kg y costo MXN/kg por fecha de entrega), las últimas 6 compras (folio, entrega, kg, TC, USD/kg, MXN/kg) y columna de Nota de crédito (placeholder hasta que exista el módulo NC) |
| **Productos** | ✅ LIVE | `BlufinProductosPage.tsx` · `SkuModal.tsx` · `productos-queries.ts` | CRUD del catálogo master de SKUs Blufin (se referencia en contratos, recepciones, costos; servirá para **mapear productos al leer contratos PDF** en carga masiva — pendiente). **El catálogo es la ficha completa**: código, **producto** ("lo que es"), marca, **% peso neto** (producto real vs glaseo, NO "limpieza"), talla, kg/caja — cada combinación producto+marca+talla+% es un SKU distinto (104001 = Filete Basa Pangabay 5/7 oz). **Clasificación por `producto`** (decisión 2026-06-13: se eliminaron `categoria` y `cajas_tipo`, migración `20260613120000`): KPIs muestran los productos con más SKUs, chips de filtro **dinámicos** (productos presentes en el catálogo), search por código/descripción/producto/marca/talla. **La descripción es EDITABLE y debe coincidir con Intelisis** (cambio 2026-06-18, migración `20260618120000` que actualizó las 62 descripciones desde `Catalogo_productos_Blufin_2026-06-18.xlsx`): el modal tiene un input de descripción libre + botón "Generar de la ficha" que la arma con `composeDescripcion` = `PRODUCTO - MARCA - PESO NETO - TALLA` como atajo. Antes se generaba sola; ahora se respeta lo capturado (ej. `Basa Pangabay 100% 5/7 (5.00 kg / Caja)`). Seed `seed_catalogo_blufin.sql` regenerado desde la BD con `scripts/regenerar_seed_catalogo.py`. Alta/edición vía `SkuModal` (producto/marca/talla/% con datalist de sugerencias `PRODUCTOS_BLUFIN`/`MARCAS_BLUFIN`/`TALLAS_BLUFIN`/`PORCENTAJES_BLUFIN` pero texto libre; valida duplicado `23505`). **Sin hard delete**: toggle Activar/Desactivar (`toggleSkuActivo`) — los inactivos desaparecen de los forms de captura (`fetchCatalogos` filtra `activo=true`) y se ven con toggle "Ver inactivos". **Exportar Excel** (2026-06-16): botón en el header → `exportProductos` descarga el catálogo completo (activos + inactivos) como `.xlsx` real |

### Importaciones — Camanchaca y Neptuno

**Construidos — 1ª versión (2026-06-26, commit `0009037`).** Esquemas migrados (`supabase/migrations/20260626130000_camanchaca_schema.sql` con `cam_*` + secuencia `next_cam_folio`; `20260626140000_neptuno_schema.sql` con `nep_*`; RLS `auth_all`). Tipos en `src/types/database.ts`. Picker + sidebar habilitados; `CamanchacaLayout` (switch SA/MX) + `NeptunoLayout`; rutas en `App.tsx`. Páginas en `src/pages/{camanchaca,neptuno}/`, queries/modales en `src/features/{camanchaca,neptuno}/`.

- **Camanchaca SA** (USD): planeación → contenedores (folio `CAM-###` por secuencia BD; ETA bodega = ETA Manzanillo +7d con `eta_bodega_confirmada`), pagos sin anticipos (completo/abono) + forwards + costo de importación MXN a agencias + **"Comparación internación"** (% del FOB con semáforo), recepción, NC simplificada, central de costos (FOB + importación), calendario, productos.
- **Camanchaca MX** (MXN): compras (Intelisis obligatoria, vencimiento +30d), pagos parciales, NC MXN, central de costos MXN directo. Comparte el catálogo `proveedor='camanchaca'` con SA.
- **Neptuno** (USD): la **factura ES el ID** (sin folio interno/planeación/naviera/recepción) — facturas con líneas SKU-first, pagos completo/abono, NC simplificada, central de costos (la factura es el inventario), calendario, productos.

⚠️ **Construidos con 3 subagentes en paralelo calcando Blufin; build (`tsc -b && vite build`) en verde pero NO probados interactivamente** (login) — el usuario itera sobre el live. Catálogos arrancan vacíos (dar de alta SKUs en la pestaña Productos). Sin datos aún.

### Contabilidad ✅ (2026-07-09 → 07-13)

**Qué es:** visor de facturas recibidas (CFDI) de PML, sincronizadas **directo del SAT** (no de Intelisis — decisión explícita del usuario) vía e.firma. Construido saltando el flujo de prototipo HTML habitual (pedido directo del usuario: "métete a ver las facturas... conecta el sistema"). Hermano de este repo: **`Contabilidad PML`** (`C:\Users\ddlpm\Proyectos\GrupoLizarraga\Contabilidad PML`, NO es repo git) — ahí vive el conector Python original (`sat_connector/`) que se **copió trimeado** a `sat-sync/` dentro de este repo para poder correr en GitHub Actions. **Las dos copias de `sat_connector/` se mantienen a mano** — si se toca la lógica de sync/extracción en una, replicar en la otra.

**Infraestructura — nada depende de una computadora prendida:**
- **Sync**: GitHub Actions (`.github/workflows/sat-sync.yml`), cron 3x/día (7:30/11:00/13:00 hora CDMX = UTC-6 fijo, sin horario de verano). Corre `sat-sync/run_sync.py --dias 5 --tipo recibidas`. Credenciales de e.firma como GitHub Secrets (`SAT_EFIRMA_CERT_B64`/`KEY_B64`/`PASSWORD`, cert/key en base64). El flujo real: pide el rango de los últimos 5 días con timestamp exacto (`solicitar_incremental`) y revisa solicitudes previas pendientes (`revisar_pendientes`) — el SAT tarda de minutos a horas en tener listo el paquete, por eso el margen de 5 días y el revisar-antes-de-pedir.
- **PDF on-demand**: función serverless de Vercel (`api/pdf.py` + `api/pdf_generator.py`, mismo repo) — genera el PDF al momento desde el XML en Supabase Storage, nada se pre-renderiza ni se guarda. **Gotcha de Vercel Python**: el runtime carga el entrypoint con un loader que NO agrega su propio directorio a `sys.path`, así que un import de un archivo hermano (`from pdf_generator import ...`) truena con `ModuleNotFoundError` en producción aunque funcione en local — se resuelve con `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))` antes del import. Revisar si se agrega OTRA función Python a `api/` con imports propios.
- **Supabase**: schema `crm`, tablas `cont_facturas` (header CFDI) / `cont_conceptos` + `cont_concepto_impuestos` (líneas + impuestos) / `cont_relaciones` (CfdiRelacionados — liga NC↔factura original) / `cont_pagos` + `cont_pagos_documentos` (Complemento de Pago — qué se pagó, cuánto, saldo) / `cont_solicitudes` (tracking de las solicitudes al SAT, una fila por request). **Gotcha de PostgREST**: un embed (`select=*,cont_pagos(...)`) anida bajo el **nombre real de la tabla**, no bajo un alias inventado — asumir un campo renombrado ahí (ej. `pago` en vez de `cont_pagos`) da `undefined` en silencio, no un error, y se ve como un loading que nunca termina.

**Frontend** (`src/pages/contabilidad/ContabilidadFacturasPage.tsx` + `src/features/contabilidad/`):
- Lista con filtros (razón social/RFC del emisor, rango de fechas, chips de tipo de comprobante I/E/T/P, chips PUE/PPD), tabla densa, paginada de 50 en 50, timestamp de "última actualización" (lee `cont_solicitudes`).
- `FacturaDetalleModal.tsx`: ficha completa (emisor/receptor, metadata fiscal, conceptos con impuestos desglosados, totales) + botón **Generar PDF** (llama `/api/pdf`) + **Descargar XML** (URL firmada del bucket privado `cont-facturas`) + secciones condicionales: **"Comprobantes relacionados"** (si hay CfdiRelacionados) y **"Pagos"** — si la factura ES un comprobante de Pago (tipo P) muestra qué liquida; si es una factura normal PPD muestra los pagos que la liquidaron (dirección inversa vía `cont_pagos_documentos.id_documento`) + **saldo pendiente** real.
- `facturas-export.ts`: botón "Descargar Excel" — exporta TODO lo que matchea los filtros activos (no solo la página visible, pagina internamente en bloques de 1000), una fila por concepto/línea con IVA/IEPS/ISR/retenciones desglosados + saldo pendiente por factura. Generador de xlsx sin dependencias ya existente (`src/lib/excel.ts`), reusado tal cual.
- `catalogos-sat.ts`: mapeos de catálogos SAT usados (tipo de comprobante, forma de pago) — no es el catálogo completo del SAT, solo las claves observadas en datos reales.

**Gotcha operativo del SAT (2026-07-13, ver caso real):** el SAT a veces "pierde" una solicitud y responde `CodEstatus 5004 "No se encontró la información"` + `EstadoSolicitud=0` (fuera de su propio catálogo 1-6) al consultar su estado. Como `revisar_pendientes()` corre **antes** de pedir facturas nuevas en cada corrida, si el código no maneja ese caso la sincronización completa se queda muerta (nunca llega a pedir nada nuevo) hasta que alguien lo note manualmente — pasó real: ~24h sin sincronizar nada. Ya está manejado (`sync.py`: si `EstadoSolicitud(...)` truena con `ValueError`, se marca esa solicitud como `ERROR` y se sigue con el resto) — **si la automatización vuelve a fallar, revisar primero `gh run list --repo pmlconect94/crm-pml --workflow sat-sync.yml` y el log del run fallido antes de asumir que es este mismo bug** (podría ser otra causa).

**Pendiente / propuesto para otra sesión** (pedido explícito del usuario: "proponme cosas de contabilidad, como si fueras un contador experimentado"):
1. **Antigüedad de saldos (AP aging)** — ya existe el saldo pendiente por factura (calculado de `cont_pagos_documentos`); falta el dashboard agrupado por proveedor y rangos (0-30/31-60/61-90/90+ días). Es lo más directo de construir con lo que ya está.
2. **Alerta de PPD sin complemento de pago** — facturas PPD sin ningún `cont_pagos_documentos` 30+ días después de emitidas arriesgan no ser deducibles ante el SAT por falta de REP. Query directo sobre lo que ya se sincroniza.
3. **DIOT automática** — ya se tiene RFC/monto/IVA por factura; generar el archivo mensual que hoy se arma a mano.
4. **Facturas canceladas después de usadas** — `estatus_sat` ya se guarda pero solo se ve al abrir la factura; falta una alerta si una factura vigente pasa a cancelada después de haberse usado/pagado.
5. **Folios con hueco** — por proveedor, detectar folios faltantes en la secuencia (factura no sincronizada o proveedor que no la mandó).
6. **Conciliación NC↔factura visible en la lista** (no solo en el detalle) — ya se liga vía `cont_relaciones`, falta mostrar el saldo neto (factura − NC) sin que alguien reste a mano.
7. **Retenciones acumuladas por proveedor/periodo** — para constancias de retención.
8. **Gasto por categoría** (agrupado por `clave_prod_serv` del concepto) — cuánto se va en fletes vs. materia prima vs. servicios, sin clasificar nada a mano.
9. **Facturas emitidas (ventas de PML)** — hoy solo se sincroniza `recibidas`. Emitidas necesitaría o bien Descarga Masiva también (mismo mecanismo, más lento) o un webhook del PAC que PML use para timbrar (más rápido, pero requiere saber cuál PAC usan — no identificado aún).

---

### Recursos Humanos / Nómina ✅ (2026-07-16) — en rama, NO en producción

Se **portó la app de Nómina** (que vivía aparte) dentro del CRM como el módulo **`/app/rh`**.
**Documentación completa: §18.** Resumen:

- Código en `src/pages/rh/*` + `src/lib/nomina/*`. `tsc` 0 errores, build OK.
- **Schema `nomina`** (no `crm`) del MISMO Supabase → se consulta con **`dbNomina.from(...)`**
  (`lib/nomina/db.ts` = `supabase.schema('nomina')` sin tipar). Nunca `supabase.from`.
- Auth y empresa por **adaptadores** (`lib/nomina/auth.tsx`, `empresas.tsx`) → usan el `useAuth` y el
  switcher pml/marlin del CRM. **Marlin quedó habilitado** en el switcher.
- **`pages/rh/rh.css`** replica el design system (más denso) de la nómina, scopeado a `.rh-module`
  + `.content-wide` en AppLayout. **Sin esto el módulo se ve roto** (ver §18.4).
- Sidebar: RH es desplegable como Importaciones; `DEPTS` ahora usa flag `enabled` (antes solo
  `contabilidad` podía activarse).
- 🌿 Rama **`feat/rh-nomina`** (`a1c4b0a` + `b6ad5ba`), **sin mergear a `main`**.
- 🔴 Producción de nómina sigue siendo la app vieja: **nomina-empresa.vercel.app**.
- ⚠️ **Misma BD que la nómina viva** → guardar desde aquí afecta nóminas reales.

### Resto de módulos

Logística, Ventas, Cobranza, Administración, Marlin — sidebar los muestra con badge PRÓX. Schema sin crear, frontend sin crear. **Contabilidad y RH ya no están en este bucket — ver sus subsecciones arriba (y §18 para RH).**

### Pendientes de infraestructura

| # | Pendiente | Bloquea |
|---|---|---|
| 1 | ~~Edge Function `tc-del-dia` con Banxico SIE~~ ✅ **LIVE 2026-06-22** — se hizo con **tasa de mercado en vivo** (frankfurter, respaldo open-er-api; sin token) cacheada por día en `crm.tc_dia`; función desplegada `verify_jwt:true` + tabla + `src/lib/tc.ts` (`getTcDelDiaInfo`). Prellena el "TC del día" en Central de Costos. **Pendiente opcional**: migrar la fuente al **FIX oficial de Banxico** (token gratis del usuario) y autorrellenar TC en Pagos/Forwards/Pago múltiple | Pagos/Forwards/Pago múltiple aún tecleados a mano |
| 2 | ~~Edge Function parser PDF con LLM~~ | **Resuelto distinto (2026-06-17)**: la carga masiva se hace en **Cowork** (Claude lee los PDFs en la sesión, sin costo de API extra) + zona de staging revisable en la app. No se usa Edge Function. Ver fila "Carga masiva" en la tabla de Blufin |
| 3 | ~~Supabase Auth real (correo+contraseña, SIN SSO)~~ ✅ **LIVE 2026-06-23** — 3 usuarios creados en Supabase Auth (nombre/rol en `user_metadata`); `signInWithPassword` + sesión persistente. Ver fila Auth en Foundation | — |
| 4 | ~~RLS — reemplazar `dev_open`~~ ✅ **LIVE 2026-06-23** (migración `20260623120000`): todas las tablas `crm` + storage pasaron de `dev_open`(public) a **`auth_all` solo `authenticated`**. La anon key sola ya no accede. **Pendiente futuro**: filtrar por `empresa_id` desde el JWT cuando haya multi-empresa real (hoy todos ven todo = admin_total). Los scripts locales (`sync_calendario.py`, `ligar_pdfs.py`) ahora requieren `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`; las otras 4 scripts de un-solo-uso (`split_contratos_pdf`, `inventario_pdfs`, `regenerar_seed_catalogo`, `upload_b64`) también si se re-corren | — |
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
- **2026-06-18: descripciones del catálogo alineadas con Intelisis.** (a) Migración `20260618120000`: las 62 descripciones de `catalogo_sku` se actualizaron desde `Catalogo_productos_Blufin_2026-06-18.xlsx` (ej. `Basa Pangabay 100% 5/7 (5.00 kg / Caja)`) — solo la descripción, demás campos intactos; la descripción del SKU pasó de generada a **editable** (`SkuModal`). (b) Migración `20260618130000`: **sync de los 677 snapshots** `blufin_contrato_productos.descripcion` con el catálogo, porque el usuario pidió que la nueva descripción salga en TODOS lados (ficha del contrato + export), no solo en Productos. Central de Costos y Recepción ya leían la descripción del catálogo por join (no requirieron cambio). **Ojo**: esto rompe a propósito la inmutabilidad del snapshot de descripción; si el catálogo se vuelve a editar, re-aplicar el UPDATE de `20260618130000` para propagar a los contratos existentes (los nuevos ya copian la descripción actual al crearse).
- **2026-06-22: motor de sincronización del Calendario de llegadas** (`scripts/sync_calendario.py`). El vendedor **Alfonso Gutiérrez (`alfonso.gutierrez@menita.com.mx`)** manda por correo, **martes y viernes**, un PDF "Calendario de llegadas" (`Calendario_Lizárraga_<fecha>.pdf`) con una tabla: CONTRATO (folio) · LOTE · **FECHA APROX. DE LLEGADA** (= ETA puerto, se mueve mucho) · FACTURA · PRODUCTO · MARCA · importes · STATUS · **CONTENEDOR** · **NAVIERA** (la "empresa"). El motor (pypdf + PostgREST) parsea el PDF, lo cruza por folio con `blufin_contratos` y **actualiza contenedor, naviera y eta_puerto**; si la ETA puerto cambia, **recalcula la eta_bodega estimada (+7d) solo si seguía siendo la estimada** (no pisa una oficial); **omite los recibidos** (`llegada_real != null`); y **reporta los folios del calendario que NO están en la base = "contratos nuevos para pedir"** (no los crea). Flags `--dry`/`--json`. **Aplicado el calendario del 19-jun (2026-06-22):** 24 contratos actualizados (4 con contenedor+naviera nuevos: 003662/003633/003561/003624; 20 con cambio de ETA), 15 sin cambio, 1 recibido omitido (003606), **0 nuevos** (los 40 ya existían). **Hallazgo Gmail (2026-06-22):** el MCP de Gmail SÍ detecta el correo (remitente + asunto "Calendario de llegadas" + nombre del adjunto PDF) pero **NO tiene herramienta para bajar el binario del adjunto** → para la automatización total el PDF debe aterrizar en **Google Drive** (vía Apps Script Gmail→Drive) y la rutina lo baja con el MCP de Drive. **Automatización ✅ LIVE (2026-06-22, "Automático total vía Drive"):** (1) Apps Script `guardarCalendarioMenita` (`scripts/apps_script_calendario.gs`, vive en la cuenta Google del usuario) busca `from:alfonso.gutierrez@menita.com.mx subject:"Calendario de llegadas" has:attachment` y guarda el PDF en la carpeta de Drive **"Calendario Menita CRM"** (id `19WhqL_qQm1Z6CAru9IdjPYzEh1PuIRgN`), idempotente por nombre, activador horario. (2) Tarea programada **`calendario-menita`** (LOCAL, `0 9 * * *`, mismo patrón que `facturas-menita-8am` — corre con los conectores Drive+Supabase de la sesión, sin riesgo de headless; SKILL.md en `~/.claude/scheduled-tasks/calendario-menita/`) lee el calendario más reciente de Drive, replica la lógica del motor (parse + diff + UPDATE vía Supabase MCP) y reporta cambios + el aviso de contratos nuevos. **Verificado end-to-end:** el Apps Script bajó 8 calendarios (26-may a 19-jun); idempotencia confirmada (reprocesar el 19-jun ya aplicado = 0 cambios). Ver [[project-facturacion-correo]] (mismo patrón Gmail→Drive→tarea local).
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

**Cuando una pestaña muestra KPIs orientativos arriba de una tabla:**
Usar `<StatStrip>` (`src/components/StatStrip.tsx`) — una **tira de una sola línea** con valores mono separados por puntos (`{value, label, color?}[]`), NO los KPI cards grandes (`grid grid-4` + `.kpi`). Feedback 2026-06-18: los KPI cards de 4 columnas se llevaban ~90px verticales y "casi no se veían las tablas"; el usuario opera 8h/día sobre las tablas, los KPIs son orientativos. La tira mide ~20px. Ya aplicado en **todas** las pestañas Blufin (Contratos usa su propia versión inline — fue el modelo; Pagos, Recepción, Notas de crédito, Facturas, Productos usan el componente). Acepta `style` para override (ej. `marginBottom: 0` cuando va inline en otra fila). Reutilizable para Camanchaca/Neptuno.

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

---

## 18. Módulo de Recursos Humanos / Nómina (RH) ✅

> **Origen:** era una **app aparte** (proyecto `Sistema de nomina WEB/Nomina PML_v2`, repo
> `pmlconect94/nomina-empresa`, prod `nomina-empresa.vercel.app`). En **2026-07-16** se **portó
> dentro del CRM** como el módulo `/app/rh`. Ambas apps ya usaban el mismo proyecto Supabase y el
> mismo design system, así que el port fue directo.
>
> ⚠️ **La app vieja SIGUE VIVA en producción y es la que usa RH hoy.** El módulo del CRM está en la
> rama **`feat/rh-nomina`** (commits `a1c4b0a` + `b6ad5ba`), **sin mergear a `main`**. Ver "Estado y
> pendientes" al final.

### 18.1 Dónde vive el código

```
src/pages/rh/
  RhLayout.tsx          layout del módulo (wrapper .rh-module + encabezado con empresa activa)
  rh.css                design system de la nómina, scopeado a .rh-module  ← LEER 18.4
  DashboardPage.tsx     resumen/KPIs de RH        (índice /app/rh)
  NominasPage.tsx       lista/crear nóminas
  NominaDetallePage.tsx detalle: orquesta las pestañas internas + guardar/desbloquear (PIN)
  EmpleadosPage.tsx     catálogo + ficha + Alta IMSS + switch Real/Fiscal + ficha del banco
  PrestamosPage.tsx     préstamos, abonos, avance
  CatalogosPage.tsx     RH → Catálogos: motivos de HE / bonos / destinos de viaje (ver nota abajo)
  SueldoModal.tsx       sueldos por movimientos (candado con contraseña)
  ViajesPage.tsx        exporta `ViajesPanel` — NO es una ruta: es una PESTAÑA del detalle
  tabs/                 TabResumen, TabAsistencias, TabComedor, TabFiscal, TabRetroactivos,
                        TabDescuentoProducto, TabBonos, TabPrestamosResumen, printNomina.ts

src/lib/nomina/
  db.ts                 cliente Supabase del schema `nomina`   ← LEER 18.2
  auth.tsx              adaptador de auth CRM → nómina         ← LEER 18.3
  empresas.tsx          config por empresa + useEmpresa (lee el switcher del CRM)
  calc.ts               TODA la lógica de cálculo (calcularNomina) — el corazón del módulo
  format.ts             fmt, fmtFecha, nomexLabel… (namespaceado: el CRM tiene su propio format.ts)
```

**NO se portaron** (el CRM ya los provee): el shell propio de la nómina (`AppLayout`, `Sidebar`,
`Topbar`), su `LoginPage` y su `UsuariosPage`.

### 18.2 Base de datos — schema `nomina` (⚠️ CRÍTICO)

Las tablas de nómina **NO están en el schema `crm`**, viven en el schema **`nomina`** del **mismo**
proyecto Supabase (`xjbhfeqcjjqyjkvdbyxy`). El cliente `supabase` del CRM apunta a `crm` por default.

```ts
// src/lib/nomina/db.ts
export const dbNomina = (supabase as unknown as SupabaseClient).schema('nomina');
```

- **En las pantallas de RH se usa `dbNomina.from('empleados')`, NUNCA `supabase.from(...)`.**
  (`supabase.from` resolvería al schema `crm` y la tabla no existe.)
- Va **sin tipar** a propósito: el `supabase` del CRM está tipado con `Database`, que solo declara
  el schema `crm`, así que `.schema('nomina')` no pasa el tipado. Las pantallas de nómina nunca
  usaron tipos generados (trabajan con `any`). **Si algún día se generan los tipos del schema
  `nomina`, `db.ts` es el único punto a cambiar.**
- Es el **mismo cliente** del CRM → un solo GoTrue y **una sola sesión** (no hay doble login).
- Para auth (login / `reauth` del candado de sueldos) se usa el `supabase` del CRM directamente.

Tablas del schema `nomina`: `empleados`, `semanas`, `nominas`, `asistencias`, `viajes`, `prestamos`,
`prestamo_descuentos`, `prestamo_omitir`, `empleado_sueldo_movimientos`, `empleado_descuentos`,
`comedor_registro`, `nomina_descuento_producto`, `nomina_bono`, `nomina_retroactivo`,
`bono_permanente` (+ `_excluido`), `usuarios_roles` (legado, ya no se usa), vista `v_incidencias`,
y **`catalogo_motivos`** ✅ (2026-07-17, migración `20260717120000` — la ÚNICA tabla de `nomina`
versionada en este repo): catálogo de **motivos de horas extra / motivos de bono / destinos de
viaje**, listas separadas por empresa (`empresa` PML|MARLIN, `tipo` horas_extra|bono|viaje,
`nombre`, `activo`, unique(empresa,tipo,nombre)); RLS patrón lec_/esc_ como sus hermanas. Se
administra en **RH → Catálogos** (`CatalogosPage`, sin hard-delete: activar/desactivar) y lo
consumen como `<select>` (vía `lib/nomina/catalogos.ts` con respaldo hardcodeado si no carga):
`TabAsistencias` (motivo HE — antes MOTIVOS_TE fijo), `TabBonos` (motivo de bono del periodo y
permanente — antes texto libre) y `ViajesPage` (destino; viajes solo PML). **El destino de viaje
se captura con input+datalist** (feedback 2026-07-17: "escribir y que mapee el más parecido"):
se teclea, el navegador filtra los parecidos, y al guardar `resolverDestino` lo NORMALIZA al
nombre canónico del catálogo ignorando mayúsculas/acentos ("leon" → "León"); si lo tecleado no
matchea ningún destino se BLOQUEA el guardado (toast que manda a RH → Catálogos), con una
excepción: el destino original de un viaje viejo que se está editando (para poder corregirle la
hora sin pelear con el catálogo). Sembrado con el histórico DEPURADO (León/leon/león → León,
etc.); en HE/bonos los valores viejos fuera de catálogo se inyectan como opción en su fila.

### 18.3 Auth y empresa — adaptadores

Las pantallas de nómina esperaban su propio `useAuth`. En vez de reescribirlas, hay **adaptadores**:

- **`lib/nomina/auth.tsx`** envuelve el `useAuth` del CRM y expone la forma vieja
  (`{ user{id,email,nombre,rol}, rolPendiente, loading, signOut, reauth }`).
  **Mapa de roles:** `admin_total`/`gerente_rh` → `admin` · `capturar: true` → `editor` · resto → `viewer`.
  Las pantallas checan `rol !== 'viewer'` (capturar) y `rol === 'admin'|'editor'` (sueldos).
  `reauth(password)` re-verifica la contraseña del usuario logueado (candado de Sueldos / Ficha del banco).
- **`lib/nomina/empresas.tsx`** — `useEmpresa()` lee la **empresa activa del switcher global del CRM**
  (`empresaId` pml/marlin de `useAuth`), no un provider propio. Devuelve `{ empresa, code, setCode }`
  con `code` = `'PML' | 'MARLIN'`. Aquí vive también la config por empresa (razón social, cuenta de
  vales Toka, emisora/cuenta de cargo Banorte).

Acceso al módulo: `hasDept('rh')` → roles `admin_total`, `director_ops`, `gerente_rh`.

### 18.4 Estilos — `.rh-module` (⚠️ NO BORRAR)

La app de nómina se diseñó **más densa y a ancho completo** que el CRM (tablas de 15+ columnas,
captura con un input por día). Su `index.css` difiere del CRM y **al portarla sin estilos todo salía
amontonado, sin filtros y con las tablas rotas**. Por eso existe `pages/rh/rh.css`, scopeado a
`.rh-module` (el `RhLayout` envuelve todo en ese div):

1. **Densidad:** fuente base **13px** (CRM 14px), `.tbl td` **8px 12px** (CRM 14px 16px),
   `.field-input` **7px 10px** (CRM 10px 12px), + `card-body`/`kpi`/`modal-*`/`page-title`.
2. **15 clases que el CRM NO tiene:** `.segmented` (filtros Activos/Bajas/Todos y por área),
   `.switch` (Alta IMSS, Real/Fiscal, omitir préstamo), `.tbl-freeze` + `.tbl-wrap` (encabezado y 1ª
   columna congelados — sin esto no se puede navegar la captura), `.form-grid(-2/-3)`,
   `.form-section-title`, `.pos/.neg/.zero/.blue/.orange/.right/.center`, `.row-inactive`,
   `.modal-lg`, y el quitado de spinners de los `input[type=number]`.
3. **Ancho completo:** `.content` es ancestro (vive en `AppLayout`), no se puede scopear desde el
   módulo → **`AppLayout` le añade `.content-wide` en las rutas `/app/rh`** (quita el `max-width:
   1400px`). El resto del CRM conserva su ancho.

> Si algo del módulo RH se ve "inflado" o sin estilo, **el problema casi siempre es `.rh-module`**:
> o falta el wrapper, o la clase no está en `rh.css`.

### 18.5 Otros cambios que tocó el port (en archivos del CRM)

- **`components/Sidebar.tsx`** — RH es un **desplegable** (como Importaciones): botón + `nav-sub`
  con Resumen/Nóminas/Empleados/Préstamos/Vacaciones. Se abre solo si estás en `/app/rh`.
  Además `DEPTS` ahora usa un flag **`enabled`**: antes el render tenía hardcodeado
  `d.id === 'contabilidad'`, así que **cualquier otro depto salía "PRÓX" aunque el rol lo permitiera**.
  Marlin quedó **habilitado** en el switcher de empresa.
- **`components/Icon.tsx`** — se agregaron `lock` y `user-plus` (los únicos 2 que faltaban).
- **`package.json`** — se agregó **`xlsx`** (SheetJS, tarball del CDN 0.20.3) que usa `printNomina.ts`
  para los exports de Vales y Depósito a banco.

### 18.6 Reglas de negocio de la nómina

**NO viven aquí.** Están en el `CLAUDE.md` del proyecto de nómina:
`C:\Users\ddlpm\Proyectos\GrupoLizarraga\Sistema de nomina WEB\Nomina PML_v2\nomina-empresa\CLAUDE.md`
(cálculo, séptimo día, incidencias, vales/previsión, comedor, préstamos, modelo Real/Fiscal de Marlin,
dispersión Banorte…). **Leerlo antes de tocar `lib/nomina/calc.ts`.** Lo más importante:

- El **switch Real/Fiscal** (solo Marlin, `empleados.usar_sueldo_real`) **manda TODO el modelo**;
  el **Alta IMSS** solo decide la distribución del pago. No confundirlos (ya se rompió una vez).
- El **depósito al banco SIEMPRE va sobre el sueldo fiscal**; la diferencia real−fiscal cae al efectivo.
- **Comedor en el depósito fiscal — DEPENDE DE EMPRESA + TIPO** (decisión del usuario 2026-07-17,
  afinada el mismo día): en **PML (semanal y quincenal) y MARLIN SEMANAL** el comedor **SÍ baja el
  depósito fiscal** (deducción normal al banco); **solo en MARLIN QUINCENAL NO** lo baja → cae al
  **efectivo** (el depósito no lo absorbe; el efectivo baja lo mismo, el neto total no cambia).
  En `calc.ts`: `comedorAlEfectivo = esMarlin && tipo === 'quincenal'` y
  `dedDeposito = comedorAlEfectivo ? (dedTotalesFiscal - comedor) : dedTotalesFiscal`. El flag
  `comedorAlEfectivo` se expone en el return y lo usan el recibo (`TabResumen`) y `TabFiscal.depFiscalDe`
  (que devuelve el comedor al depósito cuando aplica) — **una sola fuente de la regla**.

> **🐛 Bug corregido 2026-07-17 (discrepancia Fiscal vs Resumen en PML).** El usuario reportó que en
> una nómina PML el **depósito a banco NO cuadraba entre la pestaña Fiscal y el Resumen**. Causa: había
> **dos caminos de cálculo del depósito que trataban el comedor distinto**:
> - `lib/nomina/calc.ts` (lo que usa el **Resumen** y la dispersión real) restaba el comedor con
>   `dedDeposito = dedTotalesFiscal - comedor` **para TODOS** → el comedor NO bajaba el depósito (regla
>   que era **solo de Marlin**, aplicada por error también a PML).
> - `TabFiscal.tsx` (`depFiscalDe`, lo que muestra la **pestaña Fiscal**) restaba el comedor vía
>   `totalDed` (que lo incluye) → el comedor SÍ bajaba el depósito.
>
> Resultado: en PML, con comedor > 0 + Alta IMSS + sin `deposito_corregido` manual, el depósito del
> **Resumen salía exactamente `$comedor` MÁS ALTO** que el de la pestaña Fiscal. **NO era cruce con
> Marlin** (el cálculo ya usa `empleado.empresa` por persona y la nómina solo carga empleados de su
> empresa). Arreglo: (1) `calc.ts` gatea la resta del comedor a Marlin (commit `5afca89`); (2) el
> **recibo del Resumen** (`TabResumen`) quedó inconsistente — no mostraba el comedor como renglón (el
> total "saltaba" $comedor sin explicar) y la nota al pie seguía diciendo "el comedor NO se resta del
> depósito"; se hizo empresa-aware: **PML** muestra el renglón "Comedor" (−monto) en la parte fiscal y
> **Marlin** conserva la nota (commit `45e9e67`). **Lección:** el depósito se calcula en DOS lugares
> (`calc.ts` y `TabFiscal.depFiscalDe`) — si se toca la fórmula, revisar los dos o se desincronizan.

### 18.7 Estado y pendientes (2026-07-16)

- ✅ Portado, compila (`tsc` 0 errores) y build OK. Estilos verificados contra la nómina.
- 🌿 Vive en la rama **`feat/rh-nomina`** — **NO mergeado a `main`**.
- 🔴 **La nómina vieja (`nomina-empresa.vercel.app`) sigue siendo la de producción.**
- ⚠️ **Ambas apps escriben en la MISMA BD.** Es lo que hace segura la transición (no hay nada que
  migrar), pero **guardar/timbrar desde el módulo del CRM afecta nóminas reales**.
- 🔜 **Pendiente (F5):** validar cálculos contra la nómina viva → merge a `main` → activar RH para
  los usuarios → retirar el repo/deploy separado de la nómina.
- 🔜 Pendiente del módulo: **Vacaciones** (helpers `diasVacacionesLFT`/`antiguedadAnios` ya existen
  en `calc.ts`).

**Tip de entorno:** el dev server del CRM no arranca vía `npm --prefix` por el **espacio** en la ruta
`CRM PML`; usar el nombre corto 8.3 (`C:/Users/ddlpm/PROYEC~1/GRUPOL~1/CRMPML~1`) o correr `npm run
dev` dentro de la carpeta.
