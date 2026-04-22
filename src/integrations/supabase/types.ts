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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      building_notes: {
        Row: {
          content: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checkin_miss_log: {
        Row: {
          created_at: string
          id: string
          missed_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          missed_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          missed_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_miss_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_statuses: {
        Row: {
          created_at: string
          id: string
          journey_id: string
          status: Database["public"]["Enums"]["status_kind"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          journey_id: string
          status: Database["public"]["Enums"]["status_kind"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          journey_id?: string
          status?: Database["public"]["Enums"]["status_kind"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_statuses_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          body: string
          created_at: string
          encrypted_body: string | null
          id: string
          iv: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          encrypted_body?: string | null
          id?: string
          iv?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          encrypted_body?: string | null
          id?: string
          iv?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      journeys: {
        Row: {
          allow_private_deletes: boolean
          created_at: string
          has_been_reset: boolean
          id: string
          nc_start_date: string
          talking_since: string | null
        }
        Insert: {
          allow_private_deletes?: boolean
          created_at?: string
          has_been_reset?: boolean
          id?: string
          nc_start_date?: string
          talking_since?: string | null
        }
        Update: {
          allow_private_deletes?: boolean
          created_at?: string
          has_been_reset?: boolean
          id?: string
          nc_start_date?: string
          talking_since?: string | null
        }
        Relationships: []
      }
      memory_vault: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          unlock_day: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          unlock_day: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          unlock_day?: number
          user_id?: string
        }
        Relationships: []
      }
      mood_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          mood: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          mood: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string
          user_id?: string
        }
        Relationships: []
      }
      nc_breaks: {
        Row: {
          broken_by: Database["public"]["Enums"]["broken_by"]
          created_at: string
          id: string
          journey_id: string
          note: string | null
        }
        Insert: {
          broken_by: Database["public"]["Enums"]["broken_by"]
          created_at?: string
          id?: string
          journey_id: string
          note?: string | null
        }
        Update: {
          broken_by?: Database["public"]["Enums"]["broken_by"]
          created_at?: string
          id?: string
          journey_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_breaks_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_duas: {
        Row: {
          created_at: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_duas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          birthday: string | null
          counter_label: string
          created_at: string
          display_name: string | null
          id: string
          is_claimed: boolean
          journey_id: string
          must_set_password: boolean
          push_endpoint: string | null
          reminder_enabled: boolean
          reminder_time: string
          role: Database["public"]["Enums"]["user_role"]
          username: string
        }
        Insert: {
          bio?: string | null
          birthday?: string | null
          counter_label?: string
          created_at?: string
          display_name?: string | null
          id: string
          is_claimed?: boolean
          journey_id: string
          must_set_password?: boolean
          push_endpoint?: string | null
          reminder_enabled?: boolean
          reminder_time?: string
          role: Database["public"]["Enums"]["user_role"]
          username: string
        }
        Update: {
          bio?: string | null
          birthday?: string | null
          counter_label?: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_claimed?: boolean
          journey_id?: string
          must_set_password?: boolean
          push_endpoint?: string | null
          reminder_enabled?: boolean
          reminder_time?: string
          role?: Database["public"]["Enums"]["user_role"]
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sealed_letters: {
        Row: {
          content: string
          sealed_at: string
          user_id: string
        }
        Insert: {
          content: string
          sealed_at?: string
          user_id: string
        }
        Update: {
          content?: string
          sealed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strong_moments: {
        Row: {
          created_at: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      thinking_pings: {
        Row: {
          id: string
          receiver_id: string
          sender_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          receiver_id: string
          sender_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          receiver_id?: string
          sender_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thinking_pings_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thinking_pings_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_logs: {
        Row: {
          created_at: string
          id: string
          the_urge: string | null
          user_id: string
          what_happened: string
        }
        Insert: {
          created_at?: string
          id?: string
          the_urge?: string | null
          user_id: string
          what_happened: string
        }
        Update: {
          created_at?: string
          id?: string
          the_urge?: string | null
          user_id?: string
          what_happened?: string
        }
        Relationships: []
      }
      unlock_prefs: {
        Row: {
          is_unlocked: boolean
          share_building: boolean
          share_goals: boolean
          share_journal: boolean
          share_letter: boolean
          share_mood: boolean
          share_reflections: boolean
          share_strong: boolean
          share_triggers: boolean
          share_unsent_audio: boolean
          share_unsent_text: boolean
          share_why: boolean
          share_worship: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          is_unlocked?: boolean
          share_building?: boolean
          share_goals?: boolean
          share_journal?: boolean
          share_letter?: boolean
          share_mood?: boolean
          share_reflections?: boolean
          share_strong?: boolean
          share_triggers?: boolean
          share_unsent_audio?: boolean
          share_unsent_text?: boolean
          share_why?: boolean
          share_worship?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          is_unlocked?: boolean
          share_building?: boolean
          share_goals?: boolean
          share_journal?: boolean
          share_letter?: boolean
          share_mood?: boolean
          share_reflections?: boolean
          share_strong?: boolean
          share_triggers?: boolean
          share_unsent_audio?: boolean
          share_unsent_text?: boolean
          share_why?: boolean
          share_worship?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unsent_thoughts: {
        Row: {
          audio_path: string | null
          created_at: string
          encrypted_body: string | null
          id: string
          iv: string | null
          kind: string
          text_content: string | null
          user_id: string
        }
        Insert: {
          audio_path?: string | null
          created_at?: string
          encrypted_body?: string | null
          id?: string
          iv?: string | null
          kind: string
          text_content?: string | null
          user_id: string
        }
        Update: {
          audio_path?: string | null
          created_at?: string
          encrypted_body?: string | null
          id?: string
          iv?: string | null
          kind?: string
          text_content?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_reflections: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          user_id: string
          year_week: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          user_id: string
          year_week: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          user_id?: string
          year_week?: string
        }
        Relationships: []
      }
      why_notes: {
        Row: {
          content: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      worship_logs: {
        Row: {
          adhkar: number
          created_at: string
          entry_date: string
          id: string
          pages: number
          user_id: string
        }
        Insert: {
          adhkar?: number
          created_at?: string
          entry_date?: string
          id?: string
          pages?: number
          user_id: string
        }
        Update: {
          adhkar?: number
          created_at?: string
          entry_date?: string
          id?: string
          pages?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_journey_id: { Args: never; Returns: string }
      partner_shares: { Args: { section: string }; Returns: boolean }
      partner_user_id: { Args: never; Returns: string }
    }
    Enums: {
      broken_by: "him" | "her"
      status_kind: "okay" | "praying" | "miss" | "strong" | "hard" | "proud"
      user_role: "owner" | "partner"
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
      broken_by: ["him", "her"],
      status_kind: ["okay", "praying", "miss", "strong", "hard", "proud"],
      user_role: ["owner", "partner"],
    },
  },
} as const
