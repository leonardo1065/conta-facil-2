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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          kind: Database["public"]["Enums"]["entry_kind"]
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: Database["public"]["Enums"]["entry_kind"]
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: Database["public"]["Enums"]["entry_kind"]
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          amount: number
          attachment_path: string | null
          barcode: string | null
          category_id: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          installment_no: number | null
          installment_total: number | null
          is_avulsa: boolean
          is_recurring: boolean
          kind: Database["public"]["Enums"]["entry_kind"]
          month_ref: string | null
          notes: string | null
          paid_at: string | null
          recurrence_interval_months: number
          recurrence_unit: string
          series_id: string | null
          status: Database["public"]["Enums"]["entry_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          attachment_path?: string | null
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          installment_no?: number | null
          installment_total?: number | null
          is_avulsa?: boolean
          is_recurring?: boolean
          kind?: Database["public"]["Enums"]["entry_kind"]
          month_ref?: string | null
          notes?: string | null
          paid_at?: string | null
          recurrence_interval_months?: number
          recurrence_unit?: string
          series_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          installment_no?: number | null
          installment_total?: number | null
          is_avulsa?: boolean
          is_recurring?: boolean
          kind?: Database["public"]["Enums"]["entry_kind"]
          month_ref?: string | null
          notes?: string | null
          paid_at?: string | null
          recurrence_interval_months?: number
          recurrence_unit?: string
          series_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      health_events: {
        Row: {
          cep: string | null
          city: string | null
          complement: string | null
          created_at: string
          district: string | null
          done: boolean
          id: string
          is_recurring: boolean
          kind: string
          notes: string | null
          number: string | null
          phone: string | null
          place_name: string | null
          place_type: string
          recurrence_interval_months: number
          scheduled_date: string
          scheduled_time: string | null
          series_id: string | null
          state: string | null
          street: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          done?: boolean
          id?: string
          is_recurring?: boolean
          kind?: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          place_name?: string | null
          place_type?: string
          recurrence_interval_months?: number
          scheduled_date: string
          scheduled_time?: string | null
          series_id?: string | null
          state?: string | null
          street?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          done?: boolean
          id?: string
          is_recurring?: boolean
          kind?: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          place_name?: string | null
          place_type?: string
          recurrence_interval_months?: number
          scheduled_date?: string
          scheduled_time?: string | null
          series_id?: string | null
          state?: string | null
          street?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          detail: string | null
          id: string
          kind: string
          ref_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          ref_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          ref_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email_body_tpl: string | null
          email_subject_tpl: string | null
          health_days_before: number
          id: string
          notify_days_before: number
          notify_email: string | null
          notify_enabled: boolean
          notify_health: boolean
          notify_hour: number
          notify_whatsapp: boolean
          smtp_config: Json | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_body_tpl?: string | null
          email_subject_tpl?: string | null
          health_days_before?: number
          id: string
          notify_days_before?: number
          notify_email?: string | null
          notify_enabled?: boolean
          notify_health?: boolean
          notify_hour?: number
          notify_whatsapp?: boolean
          smtp_config?: Json | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_body_tpl?: string | null
          email_subject_tpl?: string | null
          health_days_before?: number
          id?: string
          notify_days_before?: number
          notify_email?: string | null
          notify_enabled?: boolean
          notify_health?: boolean
          notify_hour?: number
          notify_whatsapp?: boolean
          smtp_config?: Json | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      entry_kind: "despesa" | "receita"
      entry_status: "pendente" | "pago"
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
      app_role: ["admin", "moderator", "user"],
      entry_kind: ["despesa", "receita"],
      entry_status: ["pendente", "pago"],
    },
  },
} as const
