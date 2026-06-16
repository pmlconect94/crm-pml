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
        Row: { id: number; nombre: string; ciudad: string | null; empresa_id: string | null };
        Insert: { id?: number; nombre: string; ciudad?: string | null; empresa_id?: string | null };
        Update: { id?: number; nombre?: string; ciudad?: string | null; empresa_id?: string | null };
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
        };
        Update: {
          fecha_subida?: string | null;
          nombre_archivo?: string | null;
          storage_path?: string | null;
          status?: string | null;
          total_contrato?: number | null;
          total_factura?: number | null;
          revisado_por?: string | null;
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
        };
        Update: {
          match?: string | null;
          aceptado?: boolean | null;
          nota_revision?: string | null;
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
