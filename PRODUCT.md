# PRODUCT.md — CRM Grupo Lizárraga

## Register

`product` — CRM operativo para uso interno 8h/día. La UI sirve a la tarea; no es marketing.

## Product purpose

Plataforma única para gestionar el ciclo completo del negocio de Grupo Lizárraga: importación de productos del mar, distribución, ventas, cobranza, contabilidad y RH. Dos empresas en la misma plataforma: Productos Marinos Lizárraga (distribución, activa) y Marlin Lizárraga (producción, pendiente).

## Users

- **Daniel Lizárraga** (admin_total, dueño) — usa todo el sistema.
- **Director de operaciones** — Importaciones, Logística, Administración, RH.
- **Coordinadores de logística** — solo Importaciones y Logística.
- **Contadores** — Contabilidad, Cobranza, Administración.
- **Vendedores** — solo Ventas.
- **Gerente RH** — RH y Administración.

Todos trabajan en computadora de escritorio, monitor estándar (24-27"). Sesiones largas. Necesitan rapidez de captura, no entretenimiento visual.

## Brand and tone

Empresa familiar, productos del mar premium, operación profesional. Tono interno: directo, sobrio, en español neutro. **No** lenguaje aspiracional. **No** "elevar", "potenciar", "transformar".

## Anti-references

- Dashboards SaaS con perpetual loops y micro-animaciones flotantes.
- "AI purple/blue" glow, glassmorphism decorativo, holographic foils.
- Cards uniformes de 3 columnas con icon + title + text repetidos.
- Display fonts en labels o data tables.
- Lenguaje vendedor o marketing-speak en copy.
- Orchestrated page-load sequences en módulos de captura.

## Strategic principles

1. **El sistema debe desaparecer en la tarea.** El usuario no debe pensar en la UI; debe pensar en el contrato que está capturando.
2. **Consistencia > sorpresa.** Mismos patrones en todas las pantallas. Misma forma de botón, mismo input, mismo modal.
3. **Densidad cuando hace falta.** Tablas de contratos, pagos y facturas pueden ser densas. No diluir con whitespace decorativo.
4. **Captura rápida.** Folio → kg → precio → save. Cero pasos extra. Auto-cálculos donde sea posible (cajas desde kg, anticipo 10%, ETA bodega +7d, TC del día).
5. **Estados de carga reales.** Skeletons, no spinners centrados.
6. **Empty states que enseñan.** "Crea tu primer contrato con el botón…" no solo "Sin datos".
7. **El módulo más urgente primero.** Blufin antes que Camanchaca antes que Neptuno antes que Logística antes que el resto.

## Existing constraints

- Stack fijo: Vite + React 18 + TypeScript + Tailwind v3 + Supabase + React Router v6 + TanStack Query + Framer Motion + Sonner.
- Schema PostgreSQL en Supabase, namespace `crm.*` (coexiste con WMS en `public.*`).
- Auth real (Google Workspace + Microsoft Entra) pendiente; hoy stub admin_total.
- TC del día (Banxico SIE) pendiente; hoy `null`.
- Carga masiva de contratos por PDF: stub; Edge Function con LLM pendiente.
- Lote y naviera se capturan en Recepción / al confirmar embarque, NO al crear contrato.

## What "done" looks like (Blufin module)

8 tabs funcionando contra Supabase con RLS por empresa: Contratos, Recepción, Pagos, Notas de Crédito, Facturas, Calendario, Central de Costos, Productos. Cada tab tiene lista + alta + edit + skeleton + empty + error states. Toda la lógica financiera de CLAUDE.md §6 cubierta: TC efectivo por contenedor (promedio ponderado de pagos), costo promedio por kg restante, NCs con saldo pendiente.
