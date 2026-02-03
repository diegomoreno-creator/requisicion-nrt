export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      catalogo_empresas: {
        Row: {
          activo: boolean | null
          created_at: string
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      catalogo_sucursales: {
        Row: {
          activo: boolean | null
          created_at: string
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      catalogo_tipos_requisicion: {
        Row: {
          activo: boolean | null
          color_class: string
          color_hsl: string
          created_at: string
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean | null
          color_class?: string
          color_hsl?: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean | null
          color_class?: string
          color_hsl?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      catalogo_unidades_negocio: {
        Row: {
          activo: boolean | null
          created_at: string
          empresa_id: string | null
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_unidades_negocio_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "catalogo_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contabilidad_gastos: {
        Row: {
          created_at: string
          id: string
          importe_16: number | null
          importe_8: number | null
          importe_exento: number | null
          ispt: number | null
          isr_ret_arre: number | null
          isr_ret_hono: number | null
          isr_ret_resico: number | null
          iva_acred_16: number | null
          iva_acred_8: number | null
          iva_ret: number | null
          iva_ret_extra: number | null
          mes_operacion: string
          nombre_proveedor: string | null
          nota: string | null
          numero_cheque: string | null
          rfc: string | null
          sucursal: string
          sueldo: number | null
          tipo_proveedor: string | null
          total: number | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          importe_16?: number | null
          importe_8?: number | null
          importe_exento?: number | null
          ispt?: number | null
          isr_ret_arre?: number | null
          isr_ret_hono?: number | null
          isr_ret_resico?: number | null
          iva_acred_16?: number | null
          iva_acred_8?: number | null
          iva_ret?: number | null
          iva_ret_extra?: number | null
          mes_operacion: string
          nombre_proveedor?: string | null
          nota?: string | null
          numero_cheque?: string | null
          rfc?: string | null
          sucursal: string
          sueldo?: number | null
          tipo_proveedor?: string | null
          total?: number | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          importe_16?: number | null
          importe_8?: number | null
          importe_exento?: number | null
          ispt?: number | null
          isr_ret_arre?: number | null
          isr_ret_hono?: number | null
          isr_ret_resico?: number | null
          iva_acred_16?: number | null
          iva_acred_8?: number | null
          iva_ret?: number | null
          iva_ret_extra?: number | null
          mes_operacion?: string
          nombre_proveedor?: string | null
          nota?: string | null
          numero_cheque?: string | null
          rfc?: string | null
          sucursal?: string
          sueldo?: number | null
          tipo_proveedor?: string | null
          total?: number | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          notify_reposiciones: boolean
          notify_requisiciones: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_reposiciones?: boolean
          notify_requisiciones?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_reposiciones?: boolean
          notify_requisiciones?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reposicion_archivos: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          reposicion_id: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          reposicion_id?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          reposicion_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposicion_archivos_reposicion_id_fkey"
            columns: ["reposicion_id"]
            isOneToOne: false
            referencedRelation: "reposiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      reposicion_gastos: {
        Row: {
          created_at: string
          departamento: string | null
          descripcion: string | null
          empresa_id: string | null
          factura_no: string | null
          fecha_gasto: string | null
          id: string
          importe: number | null
          proveedor_negocio: string | null
          reposicion_id: string
          unidad_negocio_id: string | null
        }
        Insert: {
          created_at?: string
          departamento?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          factura_no?: string | null
          fecha_gasto?: string | null
          id?: string
          importe?: number | null
          proveedor_negocio?: string | null
          reposicion_id: string
          unidad_negocio_id?: string | null
        }
        Update: {
          created_at?: string
          departamento?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          factura_no?: string | null
          fecha_gasto?: string | null
          id?: string
          importe?: number | null
          proveedor_negocio?: string | null
          reposicion_id?: string
          unidad_negocio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reposicion_gastos_reposicion_id_fkey"
            columns: ["reposicion_id"]
            isOneToOne: false
            referencedRelation: "reposiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      reposiciones: {
        Row: {
          asunto: string | null
          autorizado_por: string | null
          autorizador_id: string | null
          banco: string | null
          created_at: string
          cuenta_clabe: string | null
          estado: string
          fecha_autorizacion: string | null
          fecha_pago: string | null
          fecha_solicitud: string
          folio: string
          gastos_semana: number | null
          id: string
          justificacion: string | null
          justificacion_rechazo: string | null
          monto_total: number | null
          pagado_por: string | null
          reponer_a: string | null
          solicitado_por: string
          tipo_reposicion: string
          updated_at: string
        }
        Insert: {
          asunto?: string | null
          autorizado_por?: string | null
          autorizador_id?: string | null
          banco?: string | null
          created_at?: string
          cuenta_clabe?: string | null
          estado?: string
          fecha_autorizacion?: string | null
          fecha_pago?: string | null
          fecha_solicitud?: string
          folio: string
          gastos_semana?: number | null
          id?: string
          justificacion?: string | null
          justificacion_rechazo?: string | null
          monto_total?: number | null
          pagado_por?: string | null
          reponer_a?: string | null
          solicitado_por: string
          tipo_reposicion?: string
          updated_at?: string
        }
        Update: {
          asunto?: string | null
          autorizado_por?: string | null
          autorizador_id?: string | null
          banco?: string | null
          created_at?: string
          cuenta_clabe?: string | null
          estado?: string
          fecha_autorizacion?: string | null
          fecha_pago?: string | null
          fecha_solicitud?: string
          folio?: string
          gastos_semana?: number | null
          id?: string
          justificacion?: string | null
          justificacion_rechazo?: string | null
          monto_total?: number | null
          pagado_por?: string | null
          reponer_a?: string | null
          solicitado_por?: string
          tipo_reposicion?: string
          updated_at?: string
        }
        Relationships: []
      }
      requisicion_archivos: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          requisicion_id: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          requisicion_id?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          requisicion_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicion_archivos_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "requisiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicion_partidas: {
        Row: {
          cantidad: number | null
          categoria_gasto: string | null
          costo_estimado: number | null
          created_at: string
          descripcion: string | null
          fecha_necesidad: string | null
          id: string
          modelo_parte: string | null
          numero_partida: number
          requisicion_id: string
          tipo_gasto: string | null
          unidad_medida: string | null
        }
        Insert: {
          cantidad?: number | null
          categoria_gasto?: string | null
          costo_estimado?: number | null
          created_at?: string
          descripcion?: string | null
          fecha_necesidad?: string | null
          id?: string
          modelo_parte?: string | null
          numero_partida: number
          requisicion_id: string
          tipo_gasto?: string | null
          unidad_medida?: string | null
        }
        Update: {
          cantidad?: number | null
          categoria_gasto?: string | null
          costo_estimado?: number | null
          created_at?: string
          descripcion?: string | null
          fecha_necesidad?: string | null
          id?: string
          modelo_parte?: string | null
          numero_partida?: number
          requisicion_id?: string
          tipo_gasto?: string | null
          unidad_medida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisicion_partidas_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "requisiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicion_texto_compras_historial: {
        Row: {
          created_at: string
          editado_at: string
          editado_por: string
          estado_al_comentar: string | null
          id: string
          requisicion_id: string
          texto: string
        }
        Insert: {
          created_at?: string
          editado_at?: string
          editado_por: string
          estado_al_comentar?: string | null
          id?: string
          requisicion_id: string
          texto: string
        }
        Update: {
          created_at?: string
          editado_at?: string
          editado_por?: string
          estado_al_comentar?: string | null
          id?: string
          requisicion_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicion_texto_compras_historial_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: false
            referencedRelation: "requisiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      requisiciones: {
        Row: {
          apuntes_compras: string | null
          apuntes_licitacion: string | null
          apuntes_presupuesto: string | null
          apuntes_tesoreria: string | null
          asunto: string | null
          autorizado_por: string | null
          autorizador_id: string | null
          created_at: string
          datos_banco: string | null
          datos_proveedor: string | null
          deleted_at: string | null
          departamento_solicitante: string | null
          empresa: string | null
          estado: Database["public"]["Enums"]["requisition_status"] | null
          fecha_autorizacion: string | null
          fecha_autorizacion_real: string | null
          fecha_licitacion: string | null
          fecha_pago: string | null
          fecha_pedido_autorizado: string | null
          fecha_pedido_colocado: string | null
          fecha_rechazo_presupuestos: string | null
          folio: string
          id: string
          justificacion: string | null
          justificacion_rechazo: string | null
          justificacion_rechazo_presupuestos: string | null
          licitado_por: string | null
          monto_total_compra: number | null
          nombre_proyecto: string | null
          pagado_por: string | null
          pedido_autorizado_por: string | null
          pedido_colocado_por: string | null
          porcentaje_cada_un: string | null
          presupuesto_aproximado: number | null
          rechazado_por_presupuestos_id: string | null
          rechazado_por_presupuestos_nombre: string | null
          rechazado_por_presupuestos_rol: string | null
          se_dividira_gasto: boolean | null
          solicitado_por: string
          sucursal: string | null
          texto_compras: string | null
          texto_compras_editado_at: string | null
          texto_compras_editado_por: string | null
          tipo_requisicion: string | null
          un_division_gasto: string | null
          unidad_negocio: string | null
          updated_at: string
        }
        Insert: {
          apuntes_compras?: string | null
          apuntes_licitacion?: string | null
          apuntes_presupuesto?: string | null
          apuntes_tesoreria?: string | null
          asunto?: string | null
          autorizado_por?: string | null
          autorizador_id?: string | null
          created_at?: string
          datos_banco?: string | null
          datos_proveedor?: string | null
          deleted_at?: string | null
          departamento_solicitante?: string | null
          empresa?: string | null
          estado?: Database["public"]["Enums"]["requisition_status"] | null
          fecha_autorizacion?: string | null
          fecha_autorizacion_real?: string | null
          fecha_licitacion?: string | null
          fecha_pago?: string | null
          fecha_pedido_autorizado?: string | null
          fecha_pedido_colocado?: string | null
          fecha_rechazo_presupuestos?: string | null
          folio: string
          id?: string
          justificacion?: string | null
          justificacion_rechazo?: string | null
          justificacion_rechazo_presupuestos?: string | null
          licitado_por?: string | null
          monto_total_compra?: number | null
          nombre_proyecto?: string | null
          pagado_por?: string | null
          pedido_autorizado_por?: string | null
          pedido_colocado_por?: string | null
          porcentaje_cada_un?: string | null
          presupuesto_aproximado?: number | null
          rechazado_por_presupuestos_id?: string | null
          rechazado_por_presupuestos_nombre?: string | null
          rechazado_por_presupuestos_rol?: string | null
          se_dividira_gasto?: boolean | null
          solicitado_por: string
          sucursal?: string | null
          texto_compras?: string | null
          texto_compras_editado_at?: string | null
          texto_compras_editado_por?: string | null
          tipo_requisicion?: string | null
          un_division_gasto?: string | null
          unidad_negocio?: string | null
          updated_at?: string
        }
        Update: {
          apuntes_compras?: string | null
          apuntes_licitacion?: string | null
          apuntes_presupuesto?: string | null
          apuntes_tesoreria?: string | null
          asunto?: string | null
          autorizado_por?: string | null
          autorizador_id?: string | null
          created_at?: string
          datos_banco?: string | null
          datos_proveedor?: string | null
          deleted_at?: string | null
          departamento_solicitante?: string | null
          empresa?: string | null
          estado?: Database["public"]["Enums"]["requisition_status"] | null
          fecha_autorizacion?: string | null
          fecha_autorizacion_real?: string | null
          fecha_licitacion?: string | null
          fecha_pago?: string | null
          fecha_pedido_autorizado?: string | null
          fecha_pedido_colocado?: string | null
          fecha_rechazo_presupuestos?: string | null
          folio?: string
          id?: string
          justificacion?: string | null
          justificacion_rechazo?: string | null
          justificacion_rechazo_presupuestos?: string | null
          licitado_por?: string | null
          monto_total_compra?: number | null
          nombre_proyecto?: string | null
          pagado_por?: string | null
          pedido_autorizado_por?: string | null
          pedido_colocado_por?: string | null
          porcentaje_cada_un?: string | null
          presupuesto_aproximado?: number | null
          rechazado_por_presupuestos_id?: string | null
          rechazado_por_presupuestos_nombre?: string | null
          rechazado_por_presupuestos_rol?: string | null
          se_dividira_gasto?: boolean | null
          solicitado_por?: string
          sucursal?: string | null
          texto_compras?: string | null
          texto_compras_editado_at?: string | null
          texto_compras_editado_por?: string | null
          tipo_requisicion?: string | null
          un_division_gasto?: string | null
          unidad_negocio?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_notifications: {
        Row: {
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          message: string
          notification_type: string
          recipients_count: number | null
          scheduled_at: string
          sent_at: string | null
          status: string
          target_role: string | null
          target_user_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          message: string
          notification_type: string
          recipients_count?: number | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          target_role?: string | null
          target_user_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          message?: string
          notification_type?: string
          recipients_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          target_role?: string | null
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      sugerencias: {
        Row: {
          contenido: string
          created_at: string
          estado: string
          id: string
          justificacion_rechazo: string | null
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          contenido: string
          created_at?: string
          estado?: string
          id?: string
          justificacion_rechazo?: string | null
          updated_at?: string
          user_email: string
          user_id: string
          user_name: string
        }
        Update: {
          contenido?: string
          created_at?: string
          estado?: string
          id?: string
          justificacion_rechazo?: string | null
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_requisicion: {
        Args: { _requisicion_id: string; _user_id: string }
        Returns: boolean
      }
      get_autorizadores: {
        Args: never
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_profile_name: { Args: { _user_id: string }; Returns: string }
      get_solicitante_info: {
        Args: { _user_id: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role_text: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "superadmin"
        | "admin"
        | "comprador"
        | "solicitador"
        | "inactivo"
        | "autorizador"
        | "presupuestos"
        | "tesoreria"
        | "contabilidad1"
        | "contabilidad_gastos"
        | "contabilidad_ingresos"
      requisition_status:
        | "borrador"
        | "pendiente"
        | "aprobado"
        | "rechazado"
        | "en_licitacion"
        | "completado"
        | "pedido_colocado"
        | "pedido_autorizado"
        | "pedido_pagado"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "superadmin",
        "admin",
        "comprador",
        "solicitador",
        "inactivo",
        "autorizador",
        "presupuestos",
        "tesoreria",
        "contabilidad1",
        "contabilidad_gastos",
        "contabilidad_ingresos",
      ],
      requisition_status: [
        "borrador",
        "pendiente",
        "aprobado",
        "rechazado",
        "en_licitacion",
        "completado",
        "pedido_colocado",
        "pedido_autorizado",
        "pedido_pagado",
        "cancelado",
      ],
    },
  },
} as const
