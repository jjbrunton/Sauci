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
      admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          permissions: Json | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          permissions?: Json | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          answer_gap_threshold: number | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          answer_gap_threshold?: number | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          answer_gap_threshold?: number | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          admin_role: Database["public"]["Enums"]["admin_role"]
          admin_user_id: string
          changed_fields: string[] | null
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          admin_role: Database["public"]["Enums"]["admin_role"]
          admin_user_id: string
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          admin_role?: Database["public"]["Enums"]["admin_role"]
          admin_user_id?: string
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      code_redemptions: {
        Row: {
          code_id: string
          id: string
          redeemed_at: string | null
          user_id: string
        }
        Insert: {
          code_id: string
          id?: string
          redeemed_at?: string | null
          user_id: string
        }
        Update: {
          code_id?: string
          id?: string
          redeemed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "redemption_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_packs: {
        Row: {
          couple_id: string
          created_at: string | null
          enabled: boolean | null
          pack_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string | null
          enabled?: boolean | null
          pack_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string | null
          enabled?: boolean | null
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_packs_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "question_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string | null
          id: string
          invite_code: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invite_code?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invite_code?: string | null
        }
        Relationships: []
      }
      feature_interests: {
        Row: {
          created_at: string
          feature_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          description: string
          device_info: Json
          id: string
          question_id: string | null
          screenshot_url: string | null
          status: Database["public"]["Enums"]["feedback_status"]
          title: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          description: string
          device_info?: Json
          id?: string
          question_id?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          title: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          description?: string
          device_info?: Json
          id?: string
          question_id?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          title?: string
          type?: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          couple_id: string
          created_at: string | null
          id: string
          is_new: boolean | null
          match_type: Database["public"]["Enums"]["match_type"]
          question_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string | null
          id?: string
          is_new?: boolean | null
          match_type: Database["public"]["Enums"]["match_type"]
          question_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string | null
          id?: string
          is_new?: boolean | null
          match_type?: Database["public"]["Enums"]["match_type"]
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          match_id: string
          media_expired: boolean | null
          media_expires_at: string | null
          media_path: string | null
          media_type: string | null
          media_viewed_at: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          match_id: string
          media_expired?: boolean | null
          media_expires_at?: string | null
          media_path?: string | null
          media_type?: string | null
          media_viewed_at?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          match_id?: string
          media_expired?: boolean | null
          media_expires_at?: string | null
          media_path?: string | null
          media_type?: string | null
          media_viewed_at?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_topics: {
        Row: {
          pack_id: string
          topic_id: string
        }
        Insert: {
          pack_id: string
          topic_id: string
        }
        Update: {
          pack_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_topics_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "question_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          couple_id: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          is_premium: boolean | null
          name: string | null
          onboarding_completed: boolean | null
          push_token: string | null
          show_explicit_content: boolean | null
          updated_at: string | null
          usage_reason: string | null
        }
        Insert: {
          avatar_url?: string | null
          couple_id?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id: string
          is_premium?: boolean | null
          name?: string | null
          onboarding_completed?: boolean | null
          push_token?: string | null
          show_explicit_content?: boolean | null
          updated_at?: string | null
          usage_reason?: string | null
        }
        Update: {
          avatar_url?: string | null
          couple_id?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          is_premium?: boolean | null
          name?: string | null
          onboarding_completed?: boolean | null
          push_token?: string | null
          show_explicit_content?: boolean | null
          updated_at?: string | null
          usage_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      question_packs: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_explicit: boolean
          is_premium: boolean | null
          is_public: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_explicit?: boolean
          is_premium?: boolean | null
          is_public?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_explicit?: boolean
          is_premium?: boolean | null
          is_public?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_packs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          allowed_couple_genders: string[] | null
          created_at: string | null
          id: string
          intensity: number | null
          pack_id: string
          partner_text: string | null
          target_user_genders: string[] | null
          text: string
        }
        Insert: {
          allowed_couple_genders?: string[] | null
          created_at?: string | null
          id?: string
          intensity?: number | null
          pack_id: string
          partner_text?: string | null
          target_user_genders?: string[] | null
          text: string
        }
        Update: {
          allowed_couple_genders?: string[] | null
          created_at?: string | null
          id?: string
          intensity?: number | null
          pack_id?: string
          partner_text?: string | null
          target_user_genders?: string[] | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "question_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      redemption_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      responses: {
        Row: {
          answer: Database["public"]["Enums"]["answer_type"]
          couple_id: string
          created_at: string | null
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          answer: Database["public"]["Enums"]["answer_type"]
          couple_id: string
          created_at?: string | null
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          answer?: Database["public"]["Enums"]["answer_type"]
          couple_id?: string
          created_at?: string | null
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revenuecat_webhook_events: {
        Row: {
          app_user_id: string
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
        }
        Insert: {
          app_user_id: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
        }
        Update: {
          app_user_id?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_reason: string | null
          created_at: string | null
          entitlement_ids: string[] | null
          expires_at: string | null
          grace_period_expires_at: string | null
          id: string
          is_sandbox: boolean | null
          original_transaction_id: string | null
          product_id: string
          purchased_at: string
          revenuecat_app_user_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          store: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_reason?: string | null
          created_at?: string | null
          entitlement_ids?: string[] | null
          expires_at?: string | null
          grace_period_expires_at?: string | null
          id?: string
          is_sandbox?: boolean | null
          original_transaction_id?: string | null
          product_id: string
          purchased_at: string
          revenuecat_app_user_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          store?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_reason?: string | null
          created_at?: string | null
          entitlement_ids?: string[] | null
          expires_at?: string | null
          grace_period_expires_at?: string | null
          id?: string
          is_sandbox?: boolean | null
          original_transaction_id?: string | null
          product_id?: string
          purchased_at?: string
          revenuecat_app_user_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          store?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_videos: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_count: number
          deleted_paths: string[]
        }[]
      }
      get_admin_role: {
        Args: { check_user_id?: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      get_answer_gap_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_blocked: boolean
          threshold: number
          unanswered_by_partner: number
        }[]
      }
      get_auth_user_couple_id: { Args: Record<PropertyKey, never>; Returns: string }
      get_pack_teaser_questions: {
        Args: { target_pack_id: string }
        Returns: {
          id: string
          intensity: number
          text: string
        }[]
      }
      get_profiles_with_auth_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          couple_id: string
          created_at: string
          email: string
          email_confirmed_at: string
          id: string
          is_premium: boolean
          last_sign_in_at: string
          name: string
        }[]
      }
      get_recommended_questions: {
        Args: { target_pack_id?: string }
        Returns: {
          allowed_couple_genders: string[]
          id: string
          intensity: number
          is_two_part: boolean
          pack_id: string
          partner_answered: boolean
          partner_text: string
          target_user_genders: string[]
          text: string
        }[]
      }
      get_user_media_files: {
        Args: { user_id: string }
        Returns: {
          bucket_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
        }[]
      }
      get_user_storage_usage: {
        Args: Record<PropertyKey, never>
        Returns: {
          owner: string
          total_bytes: number
        }[]
      }
      has_premium_access: { Args: { check_user_id: string }; Returns: boolean }
      is_admin: { Args: { check_user_id?: string }; Returns: boolean }
      is_super_admin: { Args: { check_user_id?: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_new_values?: Json
          p_old_values?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      redeem_code_by_email: {
        Args: { p_code: string; p_email: string }
        Returns: Json
      }
    }
    Enums: {
      admin_role: "pack_creator" | "super_admin"
      answer_type: "yes" | "no" | "maybe"
      audit_action: "INSERT" | "UPDATE" | "DELETE"
      feedback_status:
        | "new"
        | "reviewed"
        | "in_progress"
        | "resolved"
        | "closed"
      feedback_type: "bug" | "feature_request" | "general" | "question"
      match_type: "yes_yes" | "yes_maybe" | "maybe_maybe"
      subscription_status:
        | "active"
        | "cancelled"
        | "expired"
        | "billing_issue"
        | "paused"
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
      admin_role: ["pack_creator", "super_admin"],
      answer_type: ["yes", "no", "maybe"],
      audit_action: ["INSERT", "UPDATE", "DELETE"],
      feedback_status: ["new", "reviewed", "in_progress", "resolved", "closed"],
      feedback_type: ["bug", "feature_request", "general", "question"],
      match_type: ["yes_yes", "yes_maybe", "maybe_maybe"],
      subscription_status: [
        "active",
        "cancelled",
        "expired",
        "billing_issue",
        "paused",
      ],
    },
  },
} as const
