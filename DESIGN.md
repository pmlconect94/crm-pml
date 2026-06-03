# DESIGN.md — CRM Grupo Lizárraga

## Color strategy

**Restrained.** Tinted neutrals + un acento azul ≤ 10% de la superficie. Usado para acciones primarias, selección activa, indicadores de estado positivo. No decoración.

Paleta en OKLCH conceptual (los CSS vars siguen siendo hex por compat):

| Rol | Token | Hex | Uso |
|---|---|---|---|
| Surface base | `--ink-50` | `#F8FAFC` | Background de página |
| Surface raised | `white` | — | Cards, inputs |
| Surface dark | `--navy-900` | `#0A2540` | Sidebar, botones primarios |
| Border subtle | `--ink-200` | `#E2E8EF` | Bordes de card/input |
| Border strong | `--ink-300` | `#C4CDD8` | Border en hover/focus |
| Text primary | `--ink-900` | `#0B1A2B` | Body, headings |
| Text secondary | `--ink-500` | `#6B7A8F` | Labels, captions |
| Text muted | `--ink-400` | `#94A3B5` | Placeholders, disabled |
| Accent | `--blue-500` | `#0073E6` | Primary actions, focus |
| Success | `--green-500` | `#10B981` | Pagado, completado |
| Warning | `--amber-500` | `#F59E0B` | En tránsito, pendiente |
| Danger | `--red-500` | `#EF4444` | Errores, urgente |
| Info | `#8B5CF6` | — | En puerto (estado intermedio) |

No se usa `#000` ni `#fff` puros.

## Theme

**Light.** Coordinadores de logística y contadores trabajan con la luz del día encendida en oficina. Pantallas de captura en ambiente brillante. El sidebar usa navy oscuro como anclaje visual + reserva una decisión futura para un dark mode opcional (no MVP).

## Typography

**Una familia: Geist** + **Geist Mono** para números tabulares. (Nota: el product register de impeccable permite Inter/system; mantenemos Geist por decisión consciente — la diferencia es marginal pero Geist tiene mejores tabular nums y feel ligeramente más afilado para tablas densas.)

### Type scale (fixed rem, no fluid)

| Rol | Class | Tamaño | Weight | Tracking |
|---|---|---|---|---|
| Display (page hero) | — | 22px | 700 | -0.02em |
| Page title | `.page-title` | 22px | 700 | -0.02em |
| Card title | `.card-title` | 14px | 600 | -0.01em |
| Section heading | `h2` inline | 16-18px | 600-700 | -0.02em |
| Body | default | 14px | 400 | 0 |
| Label | `.field-label` | 12px | 600 | 0 |
| Caption | `.text-xs` | 11px | 400-600 | 0.04em (uppercase only) |
| KPI value | `.kpi-value` | 26px | 700 | -0.02em |
| Mono / numbers | `.mono` | inherit | inherit | tabular-nums |

Ratio entre pasos: ~1.18 (12 → 14 → 16 → 22 → 26). Hierarchy por weight + color, no solo escala.

Line length: 65-75ch para prose. Tablas dejan correr.

## Layout

### Grid

- Container max-width: 1400px, padded `24px`.
- Sidebar fijo: 248px. Topbar fijo: 60px.
- Content lleva grid-2 / grid-3 / grid-4 para KPIs y card layouts.
- Layouts asimétricos (`minmax(0, 1.6fr) minmax(0, 1fr)`) en surfaces clave (Picker, Dashboard split) para evitar la card-grid genérica.

### Spacing scale

| Token / valor | Uso |
|---|---|
| `4px` | Gap entre badges, dot indicators |
| `6px` | Gap dentro de inline groups |
| `8px` | `vstack` / `hstack` default gap |
| `12px` | Padding interno chico, gap entre items en list |
| `16px` | Padding interno default, gap entre cards en grids |
| `20px` | Padding generoso (card-body) |
| `24px` | Section gap, page padding |
| `28px` | Padding en hero cards |
| `32px` | Padding en login form / page section gap |

Usar siempre múltiplos de 4. No `15px`, no `13px`, no `7px`.

### Radii

Tokens: `--r-sm: 6px`, `--r-md: 10px`, `--r-lg: 14px`, `--r-xl: 20px`.

| Surface | Radio | Token |
|---|---|---|
| Button, badge, input | 10px | `--r-md` |
| Card | 14px | `--r-lg` |
| Modal | 14px | `--r-lg` |
| Avatar / dot | 999px | full |
| Tag / chip | 999px | full |

No `2.5rem` en surfaces principales. Es una herramienta, no un dashboard de portfolio.

## Components

Vocabulario consistente:

- `.btn` con variantes `-primary` / `-accent` / `-ghost` / `-outline` / `-danger`. Tamaños `-sm` / `-lg`. Press feedback `scale(0.97)`.
- `.card` (subtle shadow + border) vs `.card-elevated` (diffusion shadow para hero tiles).
- `.field-label` arriba de `.field-input`. Helper text debajo en `.text-xs.muted`. Error text reemplaza helper.
- `.badge` con variantes -green/-amber/-red/-blue/-violet/-gray con dot opcional.
- `.tbl` para tablas con thead uppercase tracking + tbody con hover-row gating por media query.
- `.kpi` para métricas: label uppercase pequeño + value 26px tabular + delta opcional.
- `.skeleton` y `.skeleton-bar` para loading states. Sin spinners en medio del contenido.
- `.empty` con icono + título + descripción + CTA.

### Estados requeridos en cada interactivo

default · hover · focus · active · disabled · loading · error · success.

## Motion

Productos serios no se ven cargar. Política:

- **Mounting (entrada de página/sección):** mínima. Solo `PageEnter` en headers principales. Stagger reservado para hero tiles, NO para listas de datos.
- **State changes:** 150-250ms con `--ease-soft` (`cubic-bezier(0.4, 0, 0.2, 1)`) para cambios de propiedad CSS. Springs framer-motion `SPRING.snappy` solo en mount/dismount de popovers y drawers.
- **Press feedback:** `scale(0.97)` con 160ms ease-out en todo botón.
- **Hover lift:** sutil `translateY(-2px)` solo en cards primarias (no en cards de data list).
- **Skeletons:** shimmer 1.8s constante.
- **Reduced motion:** `prefers-reduced-motion: reduce` apaga transforms y duraciones.

**Bans:** perpetual loops decorativos, parallax, bounce/elastic curves, animar layout properties (`width`/`height`/`top`), magnetic buttons, page-load orchestration de listas de datos.

## Images / assets

| Asset | Container | Notas |
|---|---|---|
| Logo proveedor (Blufin/Camanchaca/Neptuno) en picker hero | 120×60 con `padding: 10`, border subtle, fondo blanco | Logo ya viene en fondo blanco; padding evita que toque borde |
| Logo proveedor en module header (BlufinLayout) | 120×60 con `padding: 8-10` | Más chico que antes (era 160×80) |
| Logo PML/Marlin en sidebar brand | 32×32 contenedor, padding 4 | Logo se adapta a `objectFit: contain` |
| Logo PML en login form panel | 48×48 contenedor navy con padding 8 | Sobre fondo oscuro usar `pml-logo-transparent.png` |
| Avatar usuario en sidebar bottom | 32×32 círculo con iniciales (acepted) | NO usar SVG generic |

Todas las imágenes con `objectFit: contain`, `maxWidth: 100%`, `maxHeight: 100%`.

## Naming / labels

Español neutro. Verbos imperativos en CTAs ("Nuevo contrato", "Guardar", "Volver a contratos"). Etiquetas descriptivas no genéricas ("Folio del contrato" no "ID"). Estados en pasado-participio ("Contratado", "Entregado") o gerundio para in-progress ("En tránsito").

## What gets locked next

- Auth real → reemplaza `dev_open` RLS por filter por `empresa_id`.
- Detail page pattern (cuando se construya detalle de contrato).
- Form modal vs full-page pattern (decisión por longitud del form).
- Data table column persistence (qué columnas se ven, en qué orden).
