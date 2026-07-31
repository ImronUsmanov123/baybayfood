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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          delivered_to_telegram: boolean
          id: string
          image_url: string | null
          kind: string
          order_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          delivered_to_telegram?: boolean
          id?: string
          image_url?: string | null
          kind: string
          order_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          delivered_to_telegram?: boolean
          id?: string
          image_url?: string | null
          kind?: string
          order_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          comment: string | null
          created_at: string
          delivery: number
          discount: number
          id: string
          items: Json
          paid: boolean
          paid_amount: number | null
          paid_at: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          phone: string | null
          promo_code: string | null
          receipt_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          comment?: string | null
          created_at?: string
          delivery?: number
          discount?: number
          id?: string
          items: Json
          paid?: boolean
          paid_amount?: number | null
          paid_at?: string | null
          payment_method: string
          payment_reference?: string | null
          payment_status?: string
          phone?: string | null
          promo_code?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          subtotal: number
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          comment?: string | null
          created_at?: string
          delivery?: number
          discount?: number
          id?: string
          items?: Json
          paid?: boolean
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          phone?: string | null
          promo_code?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          language: string
          last_name: string | null
          latitude: number | null
          location_updated_at: string | null
          longitude: number | null
          notifications_enabled: boolean
          phone: string | null
          telegram_chat_id: number | null
          telegram_username: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          language?: string
          last_name?: string | null
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          notifications_enabled?: boolean
          phone?: string | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          language?: string
          last_name?: string | null
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          notifications_enabled?: boolean
          phone?: string | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_amount: number
          discount_percent: number
          expires_at: string | null
          free_delivery: boolean
          min_subtotal: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_amount?: number
          discount_percent?: number
          expires_at?: string | null
          free_delivery?: boolean
          min_subtotal?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_amount?: number
          discount_percent?: number
          expires_at?: string | null
          free_delivery?: boolean
          min_subtotal?: number
        }
        Relationships: []
      }
      telegram_accounts: {
        Row: {
          chat_id: number
          created_at: string
          first_name: string | null
          last_name: string | null
          phone: string
          updated_at: string
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          first_name?: string | null
          last_name?: string | null
          phone: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_admins: {
        Row: {
          chat_id: number
          created_at: string
          label: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          label?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          label?: string | null
        }
        Relationships: []
      }
      telegram_login_requests: {
        Row: {
          attempts: number
          chat_id: number | null
          code_hash: string | null
          code_sent_at: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          resend_count: number
          start_token: string
          telegram_first_name: string | null
          telegram_last_name: string | null
          telegram_username: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          chat_id?: number | null
          code_hash?: string | null
          code_sent_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          resend_count?: number
          start_token: string
          telegram_first_name?: string | null
          telegram_last_name?: string | null
          telegram_username?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          chat_id?: number | null
          code_hash?: string | null
          code_sent_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          resend_count?: number
          start_token?: string
          telegram_first_name?: string | null
          telegram_last_name?: string | null
          telegram_username?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      order_status_copy: {
        Args: { _lang: string; _short: string; _status: string }
        Returns: string[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    },
  },
} as const
