# CRM Grupo Lizárraga

Plataforma empresarial para Grupo Lizárraga — importación, distribución y producción de productos del mar en México.

**Empresas:** Productos Marinos Lizárraga (PML, distribución, activa) · Marlin Lizárraga (producción, pendiente).

**Stack:** Vite · React 18 · TypeScript · Tailwind v3 · Supabase · React Router v6 · TanStack Query · Framer Motion · Sonner.

---

## Estado del módulo Importaciones — Blufin Seafood

| Tab | Estado |
|---|---|
| Contratos | ✅ Live — base real (336 contratos), filtros Activos/Terminados, status calculado, export Excel |
| Recepción | ✅ Live — por recibir / historial / calendario, programar llegada, recepción con líneas |
| Pagos | ✅ Live — anticipos / saldos / forwards, pago múltiple, delete con PIN |
| Notas de crédito | ✅ Live — flujo Sin monto → Aplicada, auto-NC desde recepción |
| Facturas | ✅ Live — comparador factura vs contrato + subir PDF a Storage |
| Central de costos · Productos | ✅ Live |
| Calendario | 🔜 Próximo |

Camanchaca y Neptuno: schema y frontend pendientes (ver `CLAUDE.md` §16 para roadmap completo y estado al día).

---

## Setup en otra computadora

### Requisitos

- Node.js 20+ (yo uso 24)
- npm 10+
- Git
- Acceso al proyecto Supabase `crm-pml` (`xjbhfeqcjjqyjkvdbyxy`, us-east-1)

### Pasos

```bash
# 1. Clonar el repo (privado — hay que estar logueado en la cuenta
#    pmlconect94 de GitHub, o ser colaborador del repo)
git clone https://github.com/pmlconect94/crm-pml.git
cd crm-pml

# 2. Instalar dependencias
npm install

# 3. Crear .env.local desde la plantilla y llenar
cp .env.example .env.local
# Editar .env.local con la URL y la anon (publishable) key del proyecto
# Supabase crm-pml — Dashboard → Project Settings → API, o copiarlas del
# .env.local de la computadora donde ya funciona.

# 4. Levantar dev server
npm run dev
# Abre http://localhost:5174 (el 5173 lo ocupa el sistema de nómina local;
# si está libre toma ese).
```

> La base de datos vive en Supabase (la nube), así que es la misma desde
> cualquier computadora — solo necesitas el repo + el `.env.local`.

### Variables de entorno (.env.local)

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxx
```

### Scripts

```bash
npm run dev          # Dev server con HMR
npm run typecheck    # Validar tipos TS (CI)
npm run build        # Build de producción → ./dist
npm run preview      # Servir el build localmente
```

---

## Estructura del proyecto

```
src/
├── App.tsx                       # Rutas
├── main.tsx                      # Entry point (Providers)
├── index.css                     # Design tokens + clases base
├── components/                   # Shell + reusables
│   ├── AppLayout.tsx
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── TopbarClock.tsx
│   ├── Icon.tsx                  # Wrapper sobre lucide-react
│   ├── motion.tsx                # <PageEnter>, <Stagger>, <Popover>, SPRING
│   └── DeleteConfirmModal.tsx    # Modal destructivo con PIN
├── pages/
│   ├── LoginPage.tsx             # Split asymmetric con stub admin
│   ├── DashboardPage.tsx         # KPIs + asymmetric atajos
│   ├── ImportacionesPickerPage.tsx
│   ├── PlaceholderPage.tsx       # Para tabs SOON
│   └── blufin/
│       ├── BlufinLayout.tsx
│       ├── BlufinContratosListPage.tsx
│       ├── BlufinNuevoContratoPage.tsx
│       ├── BlufinCargaMasivaPage.tsx
│       ├── BlufinPagosPage.tsx
│       └── BlufinPagoMultiplePage.tsx
├── features/
│   └── blufin/
│       ├── queries.ts            # fetchContratos, createContrato, fetchCatalogos
│       ├── pagos-queries.ts      # fetchPagos, createPago, executeForward, etc.
│       ├── PagoModal.tsx
│       ├── ForwardModal.tsx
│       └── StatusPill.tsx
├── lib/
│   ├── supabase.ts               # Cliente con schema 'crm'
│   ├── auth.tsx                  # Stub admin_total
│   ├── format.ts                 # fmtUSD, fmtMXN, fmtKg, fmtFecha
│   ├── tc.ts                     # getTcDelDia() stub (TODO Banxico)
│   └── pin.ts                    # PIN super admin (localStorage stub)
└── types/
    └── database.ts               # Tipos manuales del schema crm

supabase/
└── migrations/                   # 3 SQL files versionadas
    ├── 20260526120000_crm_schema_init.sql
    ├── 20260526120001_crm_schema_blufin.sql
    └── 20260526120002_crm_expose_to_api.sql
```

---

## Documentación de diseño y producto

- **`CLAUDE.md`** — Fuente de verdad del proyecto. Visión, esquema, reglas críticas, patrones, estado de construcción.
- **`PRODUCT.md`** — Register, users, anti-references, principios estratégicos.
- **`DESIGN.md`** — Color, theme, typography, spacing, motion, image scaling rules.
- **`prototype/`** — HTML/JSX del prototipo original (referencia visual para tabs futuros).

---

## Base de datos

**Proyecto Supabase:** `crm-pml` (`xjbhfeqcjjqyjkvdbyxy`).

**Schema:** `crm` (separado del schema `public` donde vive el WMS).

**17 tablas:**

```
crm.empresas, crm.usuarios, crm.catalogo_sku, crm.bancos, crm.navieras,
crm.bodegas, crm.agencias_importadoras,
crm.blufin_contratos, crm.blufin_contrato_productos,
crm.blufin_pagos, crm.blufin_forwards,
crm.blufin_recepciones, crm.blufin_recepcion_lineas,
crm.blufin_notas_credito, crm.blufin_nc_aplicaciones,
crm.blufin_facturas, crm.blufin_factura_lineas
```

RLS habilitado con políticas `dev_open` (todas abiertas — endurecer al integrar Auth real).

---

## Pendientes de infraestructura

| # | Pendiente | Bloquea |
|---|---|---|
| 1 | Edge Function `tc-del-dia` con Banxico SIE | Central de Costos, autorrellenar TC en Pagos |
| 2 | Edge Function parser PDF con LLM | Carga masiva real de contratos Blufin |
| 3 | Supabase Auth real (Google + Microsoft) | RLS endurecida + PIN del super admin movido a DB |
| 4 | RLS por `empresa_id` desde JWT | Multi-usuario seguro |
| 5 | Supabase Storage buckets para PDFs | Subir facturas, pedimentos, BLs |
| 6 | PIN super admin con hash en DB | Hoy `localStorage` (default `1234`) |

---

## Convenciones de código

- **NO emojis** en código, UI o copy
- **NO Inter** para el font — usar Geist + Geist Mono
- **Spacing scale fija:** 4 / 8 / 12 / 16 / 20 / 24 / 28 / 32
- **Radius tokens:** `--r-sm: 6px` / `--r-md: 10px` / `--r-lg: 14px` / `--r-xl: 20px`
- **Transitions con custom easing:** usar `var(--ease-out)` / `var(--ease-soft)`, nunca `transition: all`
- **Press feedback `scale(0.97)`** en todo botón (heredado de `.btn`)
- **Skeleton loaders**, NO spinners centrados
- **Sin Stagger en data lists ni KPIs** (impeccable product register)
- **`<PageEnter>`** sí en headers de página

Detalles en `CLAUDE.md` §17 (Patrones de diseño establecidos).

---

## Política de commits

- Commits descriptivos en español neutro, presente, voz activa
- No `--no-verify` ni `--no-gpg-sign`
- Crear nuevos commits en vez de amendar
- Documentar cambios mayores en CLAUDE.md §16 (Estado de construcción)

---

Empresa familiar · operación de seafood premium · este sistema es para uso interno 8h/día.
Las decisiones de UI priorizan **densidad y velocidad de captura** sobre decoración.
