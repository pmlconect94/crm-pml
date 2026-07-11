// Tipos manuales para las tablas del CRM. Cuando el esquema crezca,
// regenerar con: supabase gen types typescript --project-id mipzuzlirylztfjekwtv

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Empty = [];

export type Database = {
  crm: {
    Tables: {
      empresas: {
        Row: { id: string; nombre: string; rfc: string | null; tipo: string | null; ciudad: string | null; activo: boolean | null };
        Insert: { id: string; nombre: string; rfc?: string | null; tipo?: string | null; ciudad?: string | null; activo?: boolean | null };
        Update: { id?: string; nombre?: string; rfc?: string | null; tipo?: string | null; ciudad?: string | null; activo?: boolean | null };
        Relationships: Empty;
      };
      usuarios: {
        Row: { id: string; auth_user_id: string | null; nombre: string; email: string; rol: string; empresa_id: string | null; activo: boolean | null; created_at: string | null; updated_at: string | null };
        Insert: { id?: string; auth_user_id?: string | null; nombre: string; email: string; rol?: string; empresa_id?: string | null; activo?: boolean | null };
        Update: { id?: string; auth_user_id?: string | null; nombre?: string; email?: string; rol?: string; empresa_id?: string | null; activo?: boolean | null };
        Relationships: Empty;
      };
      catalogo_sku: {
        Row: { id: string; empresa_id: string | null; proveedor: string; code: string; producto: string | null; descripcion: string; marca: string | null; pct: string | null; talla: string | null; kg_caja: number; activo: boolean | null; created_at: string | null };
        Insert: { id?: string; empresa_id?: string | null; proveedor: string; code: string; producto?: string | null; descripcion: string; marca?: string | null; pct?: string | null; talla?: string | null; kg_caja: number; activo?: boolean | null };
        Update: { id?: string; empresa_id?: string | null; proveedor?: string; code?: string; producto?: string | null; descripcion?: string; marca?: string | null; pct?: string | null; talla?: string | null; kg_caja?: number; activo?: boolean | null };
        Relationships: Empty;
      };
      bancos: {
        Row: { id: number; nombre: string };
        Insert: { id?: number; nombre: string };
        Update: { id?: number; nombre?: string };
        Relationships: Empty;
      };
      navieras: {
        Row: { id: number; nombre: string };
        Insert: { id?: number; nombre: string };
        Update: { id?: number; nombre?: string };
        Relationships: Empty;
      };
      agencias_importadoras: {
        Row: { id: number; razon_social: string; rfc: string | null; ciudad: string | null; activo: boolean | null };
        Insert: { id?: number; razon_social: string; rfc?: string | null; ciudad?: string | null; activo?: boolean | null };
        Update: { id?: number; razon_social?: string; rfc?: string | null; ciudad?: string | null; activo?: boolean | null };
        Relationships: Empty;
      };
      bodegas: {
        Row: { id: number; nombre: string; ciudad: string | null; empresa_id: string | null; activo: boolean };
        Insert: { id?: number; nombre: string; ciudad?: string | null; empresa_id?: string | null; activo?: boolean };
        Update: { id?: number; nombre?: string; ciudad?: string | null; empresa_id?: string | null; activo?: boolean };
        Relationships: Empty;
      };

      // ─── Blufin ───────────────────────────────────────────────────────────
      blufin_contratos: {
        Row: {
          id: string;
          empresa_id: string | null;
          folio: string;
          fecha: string | null;
          lote: string | null;
          status: string;
          eta_puerto: string | null;
          eta_bodega: string | null;
          eta_bodega_confirmada: boolean; // true = llegada programada (oficial); false = estimada +7d
          llegada_real: string | null;
          presentacion: string | null;
          bodega_destino: string | null;
          contenedor: string | null;
          naviera: string | null;
          total_usd: number | null;
          total_kg: number | null;
          anticipo_usd: number | null;
          anticipo_fecha: string | null;
          anticipo_pagado: boolean | null;
          saldo_usd: number | null;
          saldo_fecha: string | null;
          saldo_pagado: boolean | null;
          tc_ponderado: number | null;
          observaciones: string | null;
          contrato_pdf_path: string | null;
          factura_pdf_path: string | null;
          factura_drive_pdf_id: string | null;
          created_at: string | null;
          created_by: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id?: string | null;
          folio: string;
          fecha?: string | null;
          lote?: string | null;
          status?: string;
          eta_puerto?: string | null;
          eta_bodega?: string | null;
          llegada_real?: string | null;
          presentacion?: string | null;
          bodega_destino?: string | null;
          contenedor?: string | null;
          naviera?: string | null;
          total_usd?: number | null;
          total_kg?: number | null;
          anticipo_usd?: number | null;
          anticipo_fecha?: string | null;
          anticipo_pagado?: boolean | null;
          saldo_usd?: number | null;
          saldo_fecha?: string | null;
          saldo_pagado?: boolean | null;
          tc_ponderado?: number | null;
          observaciones?: string | null;
          contrato_pdf_path?: string | null;
          factura_pdf_path?: string | null;
          factura_drive_pdf_id?: string | null;
          eta_bodega_confirmada?: boolean;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string | null;
          folio?: string;
          fecha?: string | null;
          lote?: string | null;
          status?: string;
          eta_puerto?: string | null;
          eta_bodega?: string | null;
          llegada_real?: string | null;
          presentacion?: string | null;
          bodega_destino?: string | null;
          contenedor?: string | null;
          naviera?: string | null;
          total_usd?: number | null;
          total_kg?: number | null;
          anticipo_usd?: number | null;
          anticipo_fecha?: string | null;
          anticipo_pagado?: boolean | null;
          saldo_usd?: number | null;
          saldo_fecha?: string | null;
          saldo_pagado?: boolean | null;
          tc_ponderado?: number | null;
          observaciones?: string | null;
          contrato_pdf_path?: string | null;
          factura_pdf_path?: string | null;
          factura_drive_pdf_id?: string | null;
          eta_bodega_confirmada?: boolean;
        };
        Relationships: Empty;
      };
      blufin_contrato_productos: {
        Row: {
          id: string;
          contrato_id: string | null;
          sku_id: string | null;
          descripcion: string | null;
          marca: string | null;
          pct: string | null;
          talla: string | null;
          kg: number | null;
          kg_caja: number | null;
          cajas: number | null;
          precio_usd: number | null;
          total_usd: number | null;
          orden: number | null;
        };
        Insert: {
          id?: string;
          contrato_id?: string | null;
          sku_id?: string | null;
          descripcion?: string | null;
          marca?: string | null;
          pct?: string | null;
          talla?: string | null;
          kg?: number | null;
          kg_caja?: number | null;
          cajas?: number | null;
          precio_usd?: number | null;
          total_usd?: number | null;
          orden?: number | null;
        };
        Update: {
          id?: string;
          contrato_id?: string | null;
          sku_id?: string | null;
          descripcion?: string | null;
          marca?: string | null;
          pct?: string | null;
          talla?: string | null;
          kg?: number | null;
          kg_caja?: number | null;
          cajas?: number | null;
          precio_usd?: number | null;
          total_usd?: number | null;
          orden?: number | null;
        };
        Relationships: Empty;
      };
      blufin_pagos: {
        Row: {
          id: string;
          contrato_id: string | null;
          tipo: string;
          monto_usd: number;
          tc: number;
          monto_mxn: number | null;
          fecha: string;
          banco_id: number | null;
          referencia: string | null;
          capturado_por: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          contrato_id?: string | null;
          tipo: string;
          monto_usd: number;
          tc: number;
          monto_mxn?: number | null;
          fecha: string;
          banco_id?: number | null;
          referencia?: string | null;
          capturado_por?: string | null;
        };
        Update: {
          id?: string;
          contrato_id?: string | null;
          tipo?: string;
          monto_usd?: number;
          tc?: number;
          monto_mxn?: number | null;
          fecha?: string;
          banco_id?: number | null;
          referencia?: string | null;
          capturado_por?: string | null;
        };
        Relationships: Empty;
      };
      blufin_forwards: {
        Row: {
          id: string;
          contrato_id: string | null;
          asociado_a: string | null;
          monto_usd: number | null;
          tc_forward: number | null;
          monto_mxn: number | null;
          fecha_cierre: string | null;
          fecha_entrega: string | null;
          banco_id: number | null;
          status: string | null;
          capturado_por: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          contrato_id?: string | null;
          asociado_a?: string | null;
          monto_usd?: number | null;
          tc_forward?: number | null;
          monto_mxn?: number | null;
          fecha_cierre?: string | null;
          fecha_entrega?: string | null;
          banco_id?: number | null;
          status?: string | null;
          capturado_por?: string | null;
        };
        Update: {
          id?: string;
          contrato_id?: string | null;
          asociado_a?: string | null;
          monto_usd?: number | null;
          tc_forward?: number | null;
          monto_mxn?: number | null;
          fecha_cierre?: string | null;
          fecha_entrega?: string | null;
          banco_id?: number | null;
          status?: string | null;
          capturado_por?: string | null;
        };
        Relationships: Empty;
      };
      blufin_recepciones: {
        Row: {
          id: string;
          contrato_id: string | null;
          fecha_recepcion: string;
          bodega_id: number | null;
          entrada_intelisis: string | null;
          presentacion_recibida: string | null;
          venta_cliente: string | null;
          venta_ciudad: string | null;
          observaciones: string | null;
          capturado_por: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          contrato_id?: string | null;
          fecha_recepcion: string;
          bodega_id?: number | null;
          entrada_intelisis?: string | null;
          presentacion_recibida?: string | null;
          venta_cliente?: string | null;
          venta_ciudad?: string | null;
          observaciones?: string | null;
          capturado_por?: string | null;
        };
        Update: {
          id?: string;
          contrato_id?: string | null;
          fecha_recepcion?: string;
          bodega_id?: number | null;
          entrada_intelisis?: string | null;
          presentacion_recibida?: string | null;
          venta_cliente?: string | null;
          venta_ciudad?: string | null;
          observaciones?: string | null;
          capturado_por?: string | null;
        };
        Relationships: Empty;
      };
      blufin_recepcion_lineas: {
        Row: {
          id: string;
          recepcion_id: string | null;
          sku_id: string | null;
          kg_contratados: number;
          kg_recibidos: number;
          diferencia: number | null; // generada en BD: kg_recibidos - kg_contratados
          observaciones: string | null;
        };
        Insert: {
          id?: string;
          recepcion_id?: string | null;
          sku_id?: string | null;
          kg_contratados: number;
          kg_recibidos: number;
          observaciones?: string | null;
        };
        Update: {
          id?: string;
          recepcion_id?: string | null;
          sku_id?: string | null;
          kg_contratados?: number;
          kg_recibidos?: number;
          observaciones?: string | null;
        };
        Relationships: Empty;
      };
      blufin_notas_credito: {
        Row: {
          id: string;
          empresa_id: string | null;
          folio_interno: string;
          folio_timbrado: string | null;
          razon: string; // 'presentacion' | 'descuento' | 'faltante'
          contrato_origen_id: string | null;
          recepcion_origen_id: string | null;
          monto_usd: number;
          tc: number | null;
          monto_mxn: number | null;
          status: string | null; // 'Sin monto' | 'Pendiente' | 'Parcial' | 'Aplicada'
          saldo_pendiente_usd: number | null;
          fecha: string | null;
          nota: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id?: string | null;
          folio_interno?: string; // default crm.next_blufin_nc_folio()
          folio_timbrado?: string | null;
          razon: string;
          contrato_origen_id?: string | null;
          recepcion_origen_id?: string | null;
          monto_usd: number;
          tc?: number | null;
          monto_mxn?: number | null;
          status?: string | null;
          saldo_pendiente_usd?: number | null;
          fecha?: string | null;
          nota?: string | null;
        };
        Update: {
          folio_timbrado?: string | null;
          razon?: string;
          monto_usd?: number;
          tc?: number | null;
          monto_mxn?: number | null;
          status?: string | null;
          saldo_pendiente_usd?: number | null;
          fecha?: string | null;
          nota?: string | null;
        };
        Relationships: Empty;
      };
      blufin_nc_aplicaciones: {
        Row: {
          id: string;
          nc_id: string | null;
          contrato_destino_id: string | null;
          monto_usd: number;
          fecha: string;
          nota: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          nc_id?: string | null;
          contrato_destino_id?: string | null;
          monto_usd: number;
          fecha: string;
          nota?: string | null;
        };
        Update: {
          monto_usd?: number;
          fecha?: string;
          nota?: string | null;
        };
        Relationships: Empty;
      };
      blufin_facturas: {
        Row: {
          id: string;
          contrato_id: string | null;
          fecha_subida: string | null;
          nombre_archivo: string | null;
          storage_path: string | null;
          status: string | null; // 'Pendiente revisión' | 'Aprobada'
          total_contrato: number | null;
          total_factura: number | null;
          diferencia_monto: number | null; // generada en BD: total_factura - total_contrato
          revisado_por: string | null;
          created_at: string | null;
          origen: string | null; // 'manual' | 'correo'
          factura_num: string | null; // folio CFDI, ej. 'C4000'
          xml_path: string | null; // ruta del XML (CFDI) en Storage
          email_message_id: string | null; // idempotencia de la rutina de correo
          drive_pdf_id: string | null; // id del PDF en Google Drive (facturas por correo)
        };
        Insert: {
          id?: string;
          contrato_id?: string | null;
          fecha_subida?: string | null;
          nombre_archivo?: string | null;
          storage_path?: string | null;
          status?: string | null;
          total_contrato?: number | null;
          total_factura?: number | null;
          revisado_por?: string | null;
          origen?: string | null;
          factura_num?: string | null;
          xml_path?: string | null;
          email_message_id?: string | null;
          drive_pdf_id?: string | null;
        };
        Update: {
          fecha_subida?: string | null;
          nombre_archivo?: string | null;
          storage_path?: string | null;
          status?: string | null;
          total_contrato?: number | null;
          total_factura?: number | null;
          revisado_por?: string | null;
          origen?: string | null;
          factura_num?: string | null;
          xml_path?: string | null;
          email_message_id?: string | null;
          drive_pdf_id?: string | null;
        };
        Relationships: Empty;
      };
      blufin_factura_lineas: {
        Row: {
          id: string;
          factura_id: string | null;
          sku_factura: string | null;
          descripcion_factura: string | null;
          kg_factura: number | null;
          precio_factura: number | null;
          total_factura: number | null;
          sku_contrato: string | null;
          descripcion_contrato: string | null;
          kg_contrato: number | null;
          precio_contrato: number | null;
          total_contrato: number | null;
          match: string | null; // 'ok' | 'diferente'
          diferencias: Record<string, unknown>[] | null; // jsonb
          aceptado: boolean | null;
          nota_revision: string | null;
          sku_id: string | null; // SKU del catálogo al que mapea la línea de la factura
          confianza: string | null; // 'alta' | 'media' | 'baja' | 'sin_match'
        };
        Insert: {
          id?: string;
          factura_id?: string | null;
          sku_factura?: string | null;
          descripcion_factura?: string | null;
          kg_factura?: number | null;
          precio_factura?: number | null;
          total_factura?: number | null;
          sku_contrato?: string | null;
          descripcion_contrato?: string | null;
          kg_contrato?: number | null;
          precio_contrato?: number | null;
          total_contrato?: number | null;
          match?: string | null;
          diferencias?: Record<string, unknown>[] | null;
          aceptado?: boolean | null;
          nota_revision?: string | null;
          sku_id?: string | null;
          confianza?: string | null;
        };
        Update: {
          match?: string | null;
          aceptado?: boolean | null;
          nota_revision?: string | null;
          sku_id?: string | null;
          confianza?: string | null;
        };
        Relationships: Empty;
      };

      // ─── Carga masiva (staging de importación PDF) ──────────────────────────
      blufin_import_lotes: {
        Row: {
          id: string;
          empresa_id: string | null;
          nombre: string;
          fuente: string | null;
          total_contratos: number | null;
          status: string; // 'pendiente' | 'importado' | 'descartado'
          created_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id?: string | null;
          nombre: string;
          fuente?: string | null;
          total_contratos?: number | null;
          status?: string;
        };
        Update: {
          nombre?: string;
          total_contratos?: number | null;
          status?: string;
        };
        Relationships: Empty;
      };
      blufin_import_contratos: {
        Row: {
          id: string;
          lote_id: string | null;
          empresa_id: string | null;
          folio: string;
          fecha: string | null;
          eta_puerto: string | null;
          eta_bodega: string | null;
          bodega_destino: string | null;
          presentacion: string | null;
          contenedor: string | null;
          total_usd: number | null;
          total_kg: number | null;
          anticipo_usd: number | null;
          anticipo_fecha: string | null;
          saldo_usd: number | null;
          saldo_fecha: string | null;
          observaciones: string | null;
          pdf_path: string | null;
          duplicado: boolean | null;
          status: string; // 'pendiente' | 'importado' | 'omitido'
          contrato_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          lote_id?: string | null;
          empresa_id?: string | null;
          folio: string;
          fecha?: string | null;
          eta_puerto?: string | null;
          eta_bodega?: string | null;
          bodega_destino?: string | null;
          presentacion?: string | null;
          contenedor?: string | null;
          total_usd?: number | null;
          total_kg?: number | null;
          anticipo_usd?: number | null;
          anticipo_fecha?: string | null;
          saldo_usd?: number | null;
          saldo_fecha?: string | null;
          observaciones?: string | null;
          pdf_path?: string | null;
          duplicado?: boolean | null;
          status?: string;
          contrato_id?: string | null;
        };
        Update: {
          folio?: string;
          fecha?: string | null;
          eta_puerto?: string | null;
          eta_bodega?: string | null;
          bodega_destino?: string | null;
          presentacion?: string | null;
          contenedor?: string | null;
          total_usd?: number | null;
          total_kg?: number | null;
          anticipo_usd?: number | null;
          anticipo_fecha?: string | null;
          saldo_usd?: number | null;
          saldo_fecha?: string | null;
          observaciones?: string | null;
          duplicado?: boolean | null;
          status?: string;
          contrato_id?: string | null;
        };
        Relationships: Empty;
      };
      blufin_import_lineas: {
        Row: {
          id: string;
          import_contrato_id: string | null;
          orden: number | null;
          descripcion_pdf: string | null;
          marca_pdf: string | null;
          talla_pdf: string | null;
          pct_pdf: string | null;
          kg_caja: number | null;
          kg: number | null;
          cajas: number | null;
          precio_usd: number | null;
          total_usd: number | null;
          sku_id: string | null;
          match_confianza: string | null; // 'alta' | 'media' | 'baja' | 'sin_match'
          created_at: string | null;
        };
        Insert: {
          id?: string;
          import_contrato_id?: string | null;
          orden?: number | null;
          descripcion_pdf?: string | null;
          marca_pdf?: string | null;
          talla_pdf?: string | null;
          pct_pdf?: string | null;
          kg_caja?: number | null;
          kg?: number | null;
          cajas?: number | null;
          precio_usd?: number | null;
          total_usd?: number | null;
          sku_id?: string | null;
          match_confianza?: string | null;
        };
        Update: {
          sku_id?: string | null;
          match_confianza?: string | null;
          kg?: number | null;
          cajas?: number | null;
          precio_usd?: number | null;
          total_usd?: number | null;
        };
        Relationships: Empty;
      };

      // ─── Camanchaca SA (importación USD) ────────────────────────────────────
      cam_ordenes_planeadas: {
        Row: { id: string; empresa_id: string | null; oc_proveedor: string; descripcion: string | null; kg_estimados: number | null; llegada_estimada: string | null; status: string; folio_interno: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; empresa_id?: string | null; oc_proveedor: string; descripcion?: string | null; kg_estimados?: number | null; llegada_estimada?: string | null; status?: string; folio_interno?: string | null; capturado_por?: string | null };
        Update: { oc_proveedor?: string; descripcion?: string | null; kg_estimados?: number | null; llegada_estimada?: string | null; status?: string; folio_interno?: string | null };
        Relationships: Empty;
      };
      cam_contenedores_sa: {
        Row: { id: string; empresa_id: string | null; folio_interno: string; orden_planeada_id: string | null; oc_proveedor: string | null; factura: string | null; fecha_factura: string | null; fecha_vencimiento: string | null; status: string; eta_manzanillo: string | null; eta_bodega: string | null; eta_bodega_confirmada: boolean; naviera_id: number | null; naviera: string | null; contenedor: string | null; lote: string | null; presentacion: string | null; bodega_destino: string | null; llegada_real: string | null; entrada_intelisis: string | null; total_usd: number | null; total_kg: number | null; observaciones: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; empresa_id?: string | null; folio_interno?: string; orden_planeada_id?: string | null; oc_proveedor?: string | null; factura?: string | null; fecha_factura?: string | null; fecha_vencimiento?: string | null; status?: string; eta_manzanillo?: string | null; eta_bodega?: string | null; eta_bodega_confirmada?: boolean; naviera_id?: number | null; naviera?: string | null; contenedor?: string | null; lote?: string | null; presentacion?: string | null; bodega_destino?: string | null; llegada_real?: string | null; entrada_intelisis?: string | null; total_usd?: number | null; total_kg?: number | null; observaciones?: string | null; capturado_por?: string | null };
        Update: { empresa_id?: string | null; oc_proveedor?: string | null; factura?: string | null; fecha_factura?: string | null; fecha_vencimiento?: string | null; status?: string; eta_manzanillo?: string | null; eta_bodega?: string | null; eta_bodega_confirmada?: boolean; naviera_id?: number | null; naviera?: string | null; contenedor?: string | null; lote?: string | null; presentacion?: string | null; bodega_destino?: string | null; llegada_real?: string | null; entrada_intelisis?: string | null; total_usd?: number | null; total_kg?: number | null; observaciones?: string | null };
        Relationships: Empty;
      };
      cam_productos_sa: {
        Row: { id: string; contenedor_id: string | null; sku_id: string | null; descripcion: string | null; marca: string | null; pct: string | null; talla: string | null; kg_caja: number | null; cajas: number | null; kg: number | null; precio_usd: number | null; total_usd: number | null; orden: number | null };
        Insert: { id?: string; contenedor_id?: string | null; sku_id?: string | null; descripcion?: string | null; marca?: string | null; pct?: string | null; talla?: string | null; kg_caja?: number | null; cajas?: number | null; kg?: number | null; precio_usd?: number | null; total_usd?: number | null; orden?: number | null };
        Update: { sku_id?: string | null; descripcion?: string | null; kg?: number | null; cajas?: number | null; precio_usd?: number | null; total_usd?: number | null };
        Relationships: Empty;
      };
      cam_pagos_sa: {
        Row: { id: string; contenedor_id: string | null; tipo: string; monto_usd: number; tc: number; monto_mxn: number | null; fecha: string; banco_id: number | null; referencia: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; contenedor_id?: string | null; tipo: string; monto_usd: number; tc: number; monto_mxn?: number | null; fecha: string; banco_id?: number | null; referencia?: string | null; capturado_por?: string | null };
        Update: { tipo?: string; monto_usd?: number; tc?: number; monto_mxn?: number | null; fecha?: string; banco_id?: number | null; referencia?: string | null };
        Relationships: Empty;
      };
      cam_forwards_sa: {
        Row: { id: string; contenedor_id: string | null; monto_usd: number; tc_forward: number; monto_mxn: number | null; fecha_cierre: string | null; fecha_entrega: string | null; banco_id: number | null; status: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; contenedor_id?: string | null; monto_usd: number; tc_forward: number; monto_mxn?: number | null; fecha_cierre?: string | null; fecha_entrega?: string | null; banco_id?: number | null; status?: string | null; capturado_por?: string | null };
        Update: { monto_usd?: number; tc_forward?: number; monto_mxn?: number | null; fecha_cierre?: string | null; fecha_entrega?: string | null; banco_id?: number | null; status?: string | null; contenedor_id?: string | null };
        Relationships: Empty;
      };
      cam_costo_importacion: {
        Row: { id: string; contenedor_id: string | null; agencia_id: number | null; concepto: string | null; monto_mxn: number; pagado: boolean | null; fecha: string | null; observaciones: string | null; created_at: string | null };
        Insert: { id?: string; contenedor_id?: string | null; agencia_id?: number | null; concepto?: string | null; monto_mxn: number; pagado?: boolean | null; fecha?: string | null; observaciones?: string | null };
        Update: { agencia_id?: number | null; concepto?: string | null; monto_mxn?: number; pagado?: boolean | null; fecha?: string | null; observaciones?: string | null };
        Relationships: Empty;
      };
      cam_recepcion_sa: {
        Row: { id: string; contenedor_id: string | null; fecha: string; bodega_id: number | null; entrada_intelisis: string | null; presentacion_recibida: string | null; observaciones: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; contenedor_id?: string | null; fecha: string; bodega_id?: number | null; entrada_intelisis?: string | null; presentacion_recibida?: string | null; observaciones?: string | null; capturado_por?: string | null };
        Update: { fecha?: string; bodega_id?: number | null; entrada_intelisis?: string | null; presentacion_recibida?: string | null; observaciones?: string | null };
        Relationships: Empty;
      };
      cam_recepcion_sa_lineas: {
        Row: { id: string; recepcion_id: string | null; sku_id: string | null; kg_contratados: number; kg_recibidos: number; diferencia: number | null; observaciones: string | null };
        Insert: { id?: string; recepcion_id?: string | null; sku_id?: string | null; kg_contratados: number; kg_recibidos: number; observaciones?: string | null };
        Update: { kg_contratados?: number; kg_recibidos?: number; observaciones?: string | null };
        Relationships: Empty;
      };
      cam_nc_sa: {
        Row: { id: string; contenedor_id: string | null; monto_usd: number; motivo: string; fecha: string; status: string | null; created_at: string | null };
        Insert: { id?: string; contenedor_id?: string | null; monto_usd: number; motivo: string; fecha: string; status?: string | null };
        Update: { monto_usd?: number; motivo?: string; fecha?: string; status?: string | null };
        Relationships: Empty;
      };
      // ─── Camanchaca MX (compras MXN) ────────────────────────────────────────
      cam_compras_mx: {
        Row: { id: string; empresa_id: string | null; folio_interno: string; factura_num: string; entrada_intelisis: string | null; fecha_factura: string; fecha_vencimiento: string | null; status: string | null; total_mxn: number; saldo_pendiente: number | null; observaciones: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; empresa_id?: string | null; folio_interno?: string; factura_num: string; entrada_intelisis?: string | null; fecha_factura: string; fecha_vencimiento?: string | null; status?: string | null; total_mxn: number; saldo_pendiente?: number | null; observaciones?: string | null; capturado_por?: string | null };
        Update: { factura_num?: string; entrada_intelisis?: string | null; fecha_factura?: string; fecha_vencimiento?: string | null; status?: string | null; total_mxn?: number; saldo_pendiente?: number | null; observaciones?: string | null };
        Relationships: Empty;
      };
      cam_productos_mx: {
        Row: { id: string; compra_id: string | null; sku_id: string | null; descripcion: string | null; marca: string | null; pct: string | null; talla: string | null; kg_caja: number | null; cajas: number | null; kg: number | null; precio_mxn: number | null; total_mxn: number | null; orden: number | null };
        Insert: { id?: string; compra_id?: string | null; sku_id?: string | null; descripcion?: string | null; marca?: string | null; pct?: string | null; talla?: string | null; kg_caja?: number | null; cajas?: number | null; kg?: number | null; precio_mxn?: number | null; total_mxn?: number | null; orden?: number | null };
        Update: { sku_id?: string | null; descripcion?: string | null; kg?: number | null; cajas?: number | null; precio_mxn?: number | null; total_mxn?: number | null };
        Relationships: Empty;
      };
      cam_pagos_mx: {
        Row: { id: string; compra_id: string | null; monto: number; fecha: string; banco_id: number | null; referencia: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; compra_id?: string | null; monto: number; fecha: string; banco_id?: number | null; referencia?: string | null; capturado_por?: string | null };
        Update: { monto?: number; fecha?: string; banco_id?: number | null; referencia?: string | null };
        Relationships: Empty;
      };
      cam_nc_mx: {
        Row: { id: string; compra_id: string | null; monto_mxn: number; motivo: string; fecha: string; status: string | null; created_at: string | null };
        Insert: { id?: string; compra_id?: string | null; monto_mxn: number; motivo: string; fecha: string; status?: string | null };
        Update: { monto_mxn?: number; motivo?: string; fecha?: string; status?: string | null };
        Relationships: Empty;
      };
      // ─── Neptuno (factura = ID) ─────────────────────────────────────────────
      nep_facturas: {
        Row: { id: string; empresa_id: string | null; factura_num: string; entrada_intelisis: string | null; fecha_factura: string; fecha_vencimiento: string | null; status: string | null; total_usd: number; total_kg: number | null; saldo_usd: number | null; observaciones: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; empresa_id?: string | null; factura_num: string; entrada_intelisis?: string | null; fecha_factura: string; fecha_vencimiento?: string | null; status?: string | null; total_usd: number; total_kg?: number | null; saldo_usd?: number | null; observaciones?: string | null; capturado_por?: string | null };
        Update: { factura_num?: string; entrada_intelisis?: string | null; fecha_factura?: string; fecha_vencimiento?: string | null; status?: string | null; total_usd?: number; total_kg?: number | null; saldo_usd?: number | null; observaciones?: string | null };
        Relationships: Empty;
      };
      nep_factura_productos: {
        Row: { id: string; factura_id: string | null; sku_id: string | null; descripcion: string | null; marca: string | null; pct: string | null; talla: string | null; kg_caja: number | null; cajas: number | null; kg: number | null; precio_usd: number | null; total_usd: number | null; orden: number | null };
        Insert: { id?: string; factura_id?: string | null; sku_id?: string | null; descripcion?: string | null; marca?: string | null; pct?: string | null; talla?: string | null; kg_caja?: number | null; cajas?: number | null; kg?: number | null; precio_usd?: number | null; total_usd?: number | null; orden?: number | null };
        Update: { sku_id?: string | null; descripcion?: string | null; kg?: number | null; cajas?: number | null; precio_usd?: number | null; total_usd?: number | null };
        Relationships: Empty;
      };
      nep_pagos: {
        Row: { id: string; factura_id: string | null; tipo: string; monto_usd: number; tc: number; monto_mxn: number | null; fecha: string; banco_id: number | null; referencia: string | null; capturado_por: string | null; created_at: string | null };
        Insert: { id?: string; factura_id?: string | null; tipo: string; monto_usd: number; tc: number; monto_mxn?: number | null; fecha: string; banco_id?: number | null; referencia?: string | null; capturado_por?: string | null };
        Update: { tipo?: string; monto_usd?: number; tc?: number; monto_mxn?: number | null; fecha?: string; banco_id?: number | null; referencia?: string | null };
        Relationships: Empty;
      };
      nep_notas_credito: {
        Row: { id: string; factura_id: string | null; monto_usd: number; motivo: string; fecha: string; status: string | null; created_at: string | null };
        Insert: { id?: string; factura_id?: string | null; monto_usd: number; motivo: string; fecha: string; status?: string | null };
        Update: { monto_usd?: number; motivo?: string; fecha?: string; status?: string | null };
        Relationships: Empty;
      };
      // ─── Contabilidad (facturas recibidas, sincronizadas del SAT) ───────────
      cont_facturas: {
        Row: {
          uuid: string;
          empresa_id: string | null;
          tipo: string; // 'recibida' | 'emitida' (hoy solo 'recibida' tiene datos)
          version: string | null;
          serie: string | null;
          folio: string | null;
          fecha_emision: string;
          fecha_timbrado: string | null;
          lugar_expedicion: string | null;
          no_certificado: string | null;
          no_certificado_sat: string | null;
          subtotal: number | null;
          descuento: number | null;
          total: number;
          moneda: string | null; // 'MXN' | 'USD' | 'EUR' | 'XXX' (sin efecto monetario — comprobantes P/T)
          tipo_cambio: number | null;
          tipo_comprobante: string | null; // I/E/T/N/P (catálogo SAT c_TipoDeComprobante)
          metodo_pago: string | null; // 'PUE' | 'PPD'
          forma_pago: string | null; // clave SAT, ej. '99','03'
          condiciones_de_pago: string | null;
          confirmacion: string | null;
          total_impuestos_trasladados: number | null;
          total_impuestos_retenidos: number | null;
          emisor_rfc: string;
          emisor_nombre: string | null;
          emisor_regimen_fiscal: string | null;
          receptor_rfc: string;
          receptor_nombre: string | null;
          receptor_domicilio_fiscal: string | null;
          receptor_regimen_fiscal: string | null;
          receptor_uso_cfdi: string | null;
          sello_cfdi: string | null;
          sello_sat: string | null;
          rfc_prov_certif: string | null;
          estatus_sat: string; // 'vigente' | 'cancelado'
          xml_storage_path: string; // path en el bucket privado 'cont-facturas'
          id_solicitud: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          uuid: string;
          empresa_id?: string | null;
          tipo?: string;
          version?: string | null;
          serie?: string | null;
          folio?: string | null;
          fecha_emision: string;
          fecha_timbrado?: string | null;
          lugar_expedicion?: string | null;
          no_certificado?: string | null;
          no_certificado_sat?: string | null;
          subtotal?: number | null;
          descuento?: number | null;
          total: number;
          moneda?: string | null;
          tipo_cambio?: number | null;
          tipo_comprobante?: string | null;
          metodo_pago?: string | null;
          forma_pago?: string | null;
          condiciones_de_pago?: string | null;
          confirmacion?: string | null;
          total_impuestos_trasladados?: number | null;
          total_impuestos_retenidos?: number | null;
          emisor_rfc: string;
          emisor_nombre?: string | null;
          emisor_regimen_fiscal?: string | null;
          receptor_rfc: string;
          receptor_nombre?: string | null;
          receptor_domicilio_fiscal?: string | null;
          receptor_regimen_fiscal?: string | null;
          receptor_uso_cfdi?: string | null;
          sello_cfdi?: string | null;
          sello_sat?: string | null;
          rfc_prov_certif?: string | null;
          estatus_sat?: string;
          xml_storage_path: string;
          id_solicitud?: string | null;
        };
        Update: {
          empresa_id?: string | null;
          tipo?: string;
          version?: string | null;
          serie?: string | null;
          folio?: string | null;
          fecha_emision?: string;
          fecha_timbrado?: string | null;
          lugar_expedicion?: string | null;
          no_certificado?: string | null;
          no_certificado_sat?: string | null;
          subtotal?: number | null;
          descuento?: number | null;
          total?: number;
          moneda?: string | null;
          tipo_cambio?: number | null;
          tipo_comprobante?: string | null;
          metodo_pago?: string | null;
          forma_pago?: string | null;
          condiciones_de_pago?: string | null;
          confirmacion?: string | null;
          total_impuestos_trasladados?: number | null;
          total_impuestos_retenidos?: number | null;
          emisor_rfc?: string;
          emisor_nombre?: string | null;
          emisor_regimen_fiscal?: string | null;
          receptor_rfc?: string;
          receptor_nombre?: string | null;
          receptor_domicilio_fiscal?: string | null;
          receptor_regimen_fiscal?: string | null;
          receptor_uso_cfdi?: string | null;
          sello_cfdi?: string | null;
          sello_sat?: string | null;
          rfc_prov_certif?: string | null;
          estatus_sat?: string;
          xml_storage_path?: string;
          id_solicitud?: string | null;
        };
        Relationships: Empty;
      };
      cont_conceptos: {
        Row: {
          id: string;
          factura_uuid: string;
          num_linea: number;
          clave_prod_serv: string | null;
          clave_prod_serv_desc: string | null;
          no_identificacion: string | null;
          cantidad: number | null;
          clave_unidad: string | null;
          clave_unidad_desc: string | null;
          unidad: string | null;
          descripcion: string | null;
          valor_unitario: number | null;
          importe: number | null;
          descuento: number | null;
          objeto_imp: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          factura_uuid: string;
          num_linea?: number;
          clave_prod_serv?: string | null;
          clave_prod_serv_desc?: string | null;
          no_identificacion?: string | null;
          cantidad?: number | null;
          clave_unidad?: string | null;
          clave_unidad_desc?: string | null;
          unidad?: string | null;
          descripcion?: string | null;
          valor_unitario?: number | null;
          importe?: number | null;
          descuento?: number | null;
          objeto_imp?: string | null;
        };
        Update: {
          factura_uuid?: string;
          num_linea?: number;
          clave_prod_serv?: string | null;
          clave_prod_serv_desc?: string | null;
          no_identificacion?: string | null;
          cantidad?: number | null;
          clave_unidad?: string | null;
          clave_unidad_desc?: string | null;
          unidad?: string | null;
          descripcion?: string | null;
          valor_unitario?: number | null;
          importe?: number | null;
          descuento?: number | null;
          objeto_imp?: string | null;
        };
        Relationships: Empty;
      };
      cont_concepto_impuestos: {
        Row: {
          id: string;
          concepto_id: string;
          tipo: string; // 'traslado' | 'retencion'
          impuesto: string; // '001' ISR | '002' IVA | '003' IEPS
          tipo_factor: string | null;
          tasa_o_cuota: number | null;
          base: number | null;
          importe: number | null;
        };
        Insert: {
          id?: string;
          concepto_id: string;
          tipo: string;
          impuesto: string;
          tipo_factor?: string | null;
          tasa_o_cuota?: number | null;
          base?: number | null;
          importe?: number | null;
        };
        Update: {
          concepto_id?: string;
          tipo?: string;
          impuesto?: string;
          tipo_factor?: string | null;
          tasa_o_cuota?: number | null;
          base?: number | null;
          importe?: number | null;
        };
        Relationships: Empty;
      };
      cont_solicitudes: {
        Row: {
          id_solicitud: string;
          empresa_id: string | null;
          tipo: string;
          fecha_inicial: string;
          fecha_final: string;
          estado: string;
          procesada: boolean;
          facturas_importadas: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id_solicitud: string;
          empresa_id?: string | null;
          tipo: string;
          fecha_inicial: string;
          fecha_final: string;
          estado?: string;
          procesada?: boolean;
          facturas_importadas?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          empresa_id?: string | null;
          tipo?: string;
          fecha_inicial?: string;
          fecha_final?: string;
          estado?: string;
          procesada?: boolean;
          facturas_importadas?: number;
          updated_at?: string;
        };
        Relationships: Empty;
      };
      cont_relaciones: {
        Row: {
          id: string;
          factura_uuid: string;
          uuid_relacionado: string;
          tipo_relacion: string | null; // clave SAT c_TipoRelacion, ej. '01' nota de crédito
          tipo_relacion_desc: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          factura_uuid: string;
          uuid_relacionado: string;
          tipo_relacion?: string | null;
          tipo_relacion_desc?: string | null;
        };
        Update: {
          factura_uuid?: string;
          uuid_relacionado?: string;
          tipo_relacion?: string | null;
          tipo_relacion_desc?: string | null;
        };
        Relationships: Empty;
      };
      cont_pagos: {
        Row: {
          id: string;
          factura_uuid: string; // factura del Complemento de Pago (REP)
          fecha_pago: string | null;
          forma_pago: string | null; // clave SAT
          moneda: string | null;
          tipo_cambio: number | null;
          monto: number | null;
          num_operacion: string | null;
          rfc_emisor_cta_ord: string | null;
          rfc_emisor_cta_ben: string | null;
          cta_beneficiario: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          factura_uuid: string;
          fecha_pago?: string | null;
          forma_pago?: string | null;
          moneda?: string | null;
          tipo_cambio?: number | null;
          monto?: number | null;
          num_operacion?: string | null;
          rfc_emisor_cta_ord?: string | null;
          rfc_emisor_cta_ben?: string | null;
          cta_beneficiario?: string | null;
        };
        Update: {
          fecha_pago?: string | null;
          forma_pago?: string | null;
          moneda?: string | null;
          tipo_cambio?: number | null;
          monto?: number | null;
          num_operacion?: string | null;
          rfc_emisor_cta_ord?: string | null;
          rfc_emisor_cta_ben?: string | null;
          cta_beneficiario?: string | null;
        };
        Relationships: Empty;
      };
      cont_pagos_documentos: {
        Row: {
          id: string;
          pago_id: string;
          id_documento: string; // UUID de la factura que se esta pagando (DoctoRelacionado)
          serie: string | null;
          folio: string | null;
          moneda_dr: string | null;
          num_parcialidad: number | null;
          imp_saldo_ant: number | null;
          imp_pagado: number | null;
          imp_saldo_insoluto: number | null;
          objeto_imp_dr: string | null;
        };
        Insert: {
          id?: string;
          pago_id: string;
          id_documento: string;
          serie?: string | null;
          folio?: string | null;
          moneda_dr?: string | null;
          num_parcialidad?: number | null;
          imp_saldo_ant?: number | null;
          imp_pagado?: number | null;
          imp_saldo_insoluto?: number | null;
          objeto_imp_dr?: string | null;
        };
        Update: {
          serie?: string | null;
          folio?: string | null;
          moneda_dr?: string | null;
          num_parcialidad?: number | null;
          imp_saldo_ant?: number | null;
          imp_pagado?: number | null;
          imp_saldo_insoluto?: number | null;
          objeto_imp_dr?: string | null;
        };
        Relationships: Empty;
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// Tipos de conveniencia
export type BlufinContrato = Database['crm']['Tables']['blufin_contratos']['Row'];
export type BlufinContratoInsert = Database['crm']['Tables']['blufin_contratos']['Insert'];
export type BlufinProducto = Database['crm']['Tables']['blufin_contrato_productos']['Row'];
export type BlufinProductoInsert = Database['crm']['Tables']['blufin_contrato_productos']['Insert'];
export type CatalogoSku = Database['crm']['Tables']['catalogo_sku']['Row'];
export type Naviera = Database['crm']['Tables']['navieras']['Row'];
export type Bodega = Database['crm']['Tables']['bodegas']['Row'];
export type Banco = Database['crm']['Tables']['bancos']['Row'];

export type BlufinContratoConProductos = BlufinContrato & {
  productos?: BlufinProducto[];
};

export type BlufinNotaCredito = Database['crm']['Tables']['blufin_notas_credito']['Row'];
export type BlufinNotaCreditoInsert = Database['crm']['Tables']['blufin_notas_credito']['Insert'];
export type BlufinNcAplicacion = Database['crm']['Tables']['blufin_nc_aplicaciones']['Row'];

// NC + contrato origen y aplicaciones (con folio de contrato destino)
export type BlufinNotaCreditoEnriquecida = BlufinNotaCredito & {
  contrato_origen?: { folio: string } | null;
  aplicaciones?: (BlufinNcAplicacion & { contrato_destino?: { folio: string } | null })[];
};

export type BlufinPago = Database['crm']['Tables']['blufin_pagos']['Row'];
export type BlufinPagoInsert = Database['crm']['Tables']['blufin_pagos']['Insert'];
export type BlufinForward = Database['crm']['Tables']['blufin_forwards']['Row'];
export type BlufinForwardInsert = Database['crm']['Tables']['blufin_forwards']['Insert'];

export type BlufinFactura = Database['crm']['Tables']['blufin_facturas']['Row'];
export type BlufinFacturaInsert = Database['crm']['Tables']['blufin_facturas']['Insert'];
export type BlufinFacturaLinea = Database['crm']['Tables']['blufin_factura_lineas']['Row'];
export type BlufinFacturaLineaInsert = Database['crm']['Tables']['blufin_factura_lineas']['Insert'];

// Factura + datos del contrato (denormalizado para la lista)
export type BlufinFacturaEnriquecida = BlufinFactura & {
  contrato?: { folio: string; total_usd: number | null; status: string } | null;
};

// Pago + datos del contrato y banco (denormalizado para list view)
export type BlufinPagoEnriquecido = BlufinPago & {
  contrato?: { folio: string; total_usd: number | null; anticipo_usd: number | null; saldo_usd: number | null } | null;
  banco?: { nombre: string } | null;
};

export type BlufinForwardEnriquecido = BlufinForward & {
  contrato?: { folio: string } | null;
  banco?: { nombre: string } | null;
};

export type BlufinRecepcion = Database['crm']['Tables']['blufin_recepciones']['Row'];
export type BlufinRecepcionInsert = Database['crm']['Tables']['blufin_recepciones']['Insert'];
export type BlufinRecepcionLinea = Database['crm']['Tables']['blufin_recepcion_lineas']['Row'];
export type BlufinRecepcionLineaInsert = Database['crm']['Tables']['blufin_recepcion_lineas']['Insert'];

// Recepción + contrato, bodega y líneas con SKU (denormalizado para list view)
export type BlufinRecepcionEnriquecida = BlufinRecepcion & {
  contrato?: { folio: string; presentacion: string | null; total_kg: number | null } | null;
  bodega?: { nombre: string } | null;
  lineas?: (BlufinRecepcionLinea & { sku?: { code: string; descripcion: string } | null })[];
};

// ─── Carga masiva (staging) ───────────────────────────────────────────────
export type BlufinImportLote = Database['crm']['Tables']['blufin_import_lotes']['Row'];
export type BlufinImportLoteInsert = Database['crm']['Tables']['blufin_import_lotes']['Insert'];
export type BlufinImportContrato = Database['crm']['Tables']['blufin_import_contratos']['Row'];
export type BlufinImportContratoInsert = Database['crm']['Tables']['blufin_import_contratos']['Insert'];
export type BlufinImportLinea = Database['crm']['Tables']['blufin_import_lineas']['Row'];
export type BlufinImportLineaInsert = Database['crm']['Tables']['blufin_import_lineas']['Insert'];

// Lote + conteo de contratos por status (para la lista de lotes)
export type BlufinImportLoteEnriquecido = BlufinImportLote & {
  contratos?: { status: string; duplicado: boolean | null }[];
};

// Contrato de staging + sus líneas con el SKU sugerido (para la pantalla de revisión)
export type BlufinImportContratoConLineas = BlufinImportContrato & {
  lineas?: (BlufinImportLinea & { sku?: { code: string; descripcion: string } | null })[];
};

// ─── Camanchaca SA (importación USD) ──────────────────────────────────────
export type CamOrdenPlaneada = Database['crm']['Tables']['cam_ordenes_planeadas']['Row'];
export type CamOrdenPlaneadaInsert = Database['crm']['Tables']['cam_ordenes_planeadas']['Insert'];
export type CamContenedorSA = Database['crm']['Tables']['cam_contenedores_sa']['Row'];
export type CamContenedorSAInsert = Database['crm']['Tables']['cam_contenedores_sa']['Insert'];
export type CamProductoSA = Database['crm']['Tables']['cam_productos_sa']['Row'];
export type CamProductoSAInsert = Database['crm']['Tables']['cam_productos_sa']['Insert'];
export type CamPagoSA = Database['crm']['Tables']['cam_pagos_sa']['Row'];
export type CamPagoSAInsert = Database['crm']['Tables']['cam_pagos_sa']['Insert'];
export type CamForwardSA = Database['crm']['Tables']['cam_forwards_sa']['Row'];
export type CamForwardSAInsert = Database['crm']['Tables']['cam_forwards_sa']['Insert'];
export type CamCostoImportacion = Database['crm']['Tables']['cam_costo_importacion']['Row'];
export type CamCostoImportacionInsert = Database['crm']['Tables']['cam_costo_importacion']['Insert'];
export type CamRecepcionSA = Database['crm']['Tables']['cam_recepcion_sa']['Row'];
export type CamRecepcionSALinea = Database['crm']['Tables']['cam_recepcion_sa_lineas']['Row'];
export type CamNcSa = Database['crm']['Tables']['cam_nc_sa']['Row'];
export type CamNcSaInsert = Database['crm']['Tables']['cam_nc_sa']['Insert'];

export type CamContenedorSAConProductos = CamContenedorSA & { productos?: CamProductoSA[] };
export type CamRecepcionSAEnriquecida = CamRecepcionSA & {
  contenedor?: { folio_interno: string; presentacion: string | null; total_kg: number | null } | null;
  bodega?: { nombre: string } | null;
  lineas?: (CamRecepcionSALinea & { sku?: { code: string; descripcion: string } | null })[];
};

// ─── Camanchaca MX (compras MXN) ──────────────────────────────────────────
export type CamCompraMX = Database['crm']['Tables']['cam_compras_mx']['Row'];
export type CamCompraMXInsert = Database['crm']['Tables']['cam_compras_mx']['Insert'];
export type CamProductoMX = Database['crm']['Tables']['cam_productos_mx']['Row'];
export type CamProductoMXInsert = Database['crm']['Tables']['cam_productos_mx']['Insert'];
export type CamPagoMX = Database['crm']['Tables']['cam_pagos_mx']['Row'];
export type CamPagoMXInsert = Database['crm']['Tables']['cam_pagos_mx']['Insert'];
export type CamNcMx = Database['crm']['Tables']['cam_nc_mx']['Row'];
export type CamNcMxInsert = Database['crm']['Tables']['cam_nc_mx']['Insert'];
export type CamCompraMXConProductos = CamCompraMX & { productos?: CamProductoMX[] };

// ─── Neptuno (factura = ID) ───────────────────────────────────────────────
export type NepFactura = Database['crm']['Tables']['nep_facturas']['Row'];
export type NepFacturaInsert = Database['crm']['Tables']['nep_facturas']['Insert'];
export type NepFacturaProducto = Database['crm']['Tables']['nep_factura_productos']['Row'];
export type NepFacturaProductoInsert = Database['crm']['Tables']['nep_factura_productos']['Insert'];
export type NepPago = Database['crm']['Tables']['nep_pagos']['Row'];
export type NepPagoInsert = Database['crm']['Tables']['nep_pagos']['Insert'];
export type NepNotaCredito = Database['crm']['Tables']['nep_notas_credito']['Row'];
export type NepNotaCreditoInsert = Database['crm']['Tables']['nep_notas_credito']['Insert'];
export type NepFacturaConProductos = NepFactura & { productos?: NepFacturaProducto[] };

// ─── Contabilidad (facturas recibidas, sincronizadas del SAT) ─────────────
export type ContFactura = Database['crm']['Tables']['cont_facturas']['Row'];
export type ContConcepto = Database['crm']['Tables']['cont_conceptos']['Row'];
export type ContConceptoImpuesto = Database['crm']['Tables']['cont_concepto_impuestos']['Row'];

// Concepto + sus impuestos anidados (traslados/retenciones), tal como los devuelve
// el select embebido `cont_conceptos(*, cont_concepto_impuestos(*))` — para el detalle.
export type ContConceptoConImpuestos = ContConcepto & {
  cont_concepto_impuestos?: ContConceptoImpuesto[];
};

export type ContRelacion = Database['crm']['Tables']['cont_relaciones']['Row'];
export type ContPago = Database['crm']['Tables']['cont_pagos']['Row'];
export type ContPagoDocumento = Database['crm']['Tables']['cont_pagos_documentos']['Row'];

// Pago (Complemento de Pago) + los documentos que liquida, tal como lo devuelve
// el select embebido `cont_pagos(*, cont_pagos_documentos(*))` — para el detalle.
export type ContPagoConDocumentos = ContPago & {
  cont_pagos_documentos?: ContPagoDocumento[];
};
