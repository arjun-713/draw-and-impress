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
      drawings: {
        Row: {
          created_at: string
          id: string
          image_data: string
          player_id: string
          room_id: string
          round: number
          vote_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_data: string
          player_id: string
          room_id: string
          round: number
          vote_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_data?: string
          player_id?: string
          room_id?: string
          round?: number
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "drawings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_color: string
          created_at: string
          id: string
          is_connected: boolean
          is_host: boolean
          is_ready: boolean
          room_id: string
          score: number
          session_id: string
          user_id: string | null
          username: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          id?: string
          is_connected?: boolean
          is_host?: boolean
          is_ready?: boolean
          room_id: string
          score?: number
          session_id: string
          user_id?: string | null
          username: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          id?: string
          is_connected?: boolean
          is_host?: boolean
          is_ready?: boolean
          room_id?: string
          score?: number
          session_id?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          category: string | null
          id: string
          is_custom: boolean
          text: string
        }
        Insert: {
          category?: string | null
          id?: string
          is_custom?: boolean
          text: string
        }
        Update: {
          category?: string | null
          id?: string
          is_custom?: boolean
          text?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          created_at: string
          id: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          current_prompt: string | null
          current_round: number
          draw_time: number
          host_id: string
          id: string
          max_players: number
          phase_end_at: string | null
          status: string
          total_rounds: number
          updated_at: string
          vote_time: number
        }
        Insert: {
          code: string
          created_at?: string
          current_prompt?: string | null
          current_round?: number
          draw_time?: number
          host_id: string
          id?: string
          max_players?: number
          phase_end_at?: string | null
          status?: string
          total_rounds?: number
          updated_at?: string
          vote_time?: number
        }
        Update: {
          code?: string
          created_at?: string
          current_prompt?: string | null
          current_round?: number
          draw_time?: number
          host_id?: string
          id?: string
          max_players?: number
          phase_end_at?: string | null
          status?: string
          total_rounds?: number
          updated_at?: string
          vote_time?: number
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          drawing_id: string
          id: string
          room_id: string
          round: number
          voter_id: string
        }
        Insert: {
          created_at?: string
          drawing_id: string
          id?: string
          room_id: string
          round: number
          voter_id: string
        }
        Update: {
          created_at?: string
          drawing_id?: string
          id?: string
          room_id?: string
          round?: number
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_action_type: string
          p_max_count: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      increment_player_score: {
        Args: { p_player_id: string; p_points: number }
        Returns: undefined
      }
      is_room_host: { Args: { p_room_id: string }; Returns: boolean }
      is_room_participant: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      record_rate_limit_action: {
        Args: { p_action_type: string; p_room_id?: string; p_user_id: string }
        Returns: undefined
      }
      user_is_in_room: { Args: { p_room_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
