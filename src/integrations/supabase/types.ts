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
      coach_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["coach_role"]
          team_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["coach_role"]
          team_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["coach_role"]
          team_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      game_events: {
        Row: {
          clock_seconds: number
          context: Json
          created_at: string
          current_lineup: Json
          event_type: string
          game_id: string
          id: string
          player_id: string | null
          points: number
          quarter: number
          related_event_id: string | null
          result: string | null
          x: number | null
          y: number | null
          zone: string | null
        }
        Insert: {
          clock_seconds?: number
          context?: Json
          created_at?: string
          current_lineup?: Json
          event_type: string
          game_id: string
          id?: string
          player_id?: string | null
          points?: number
          quarter?: number
          related_event_id?: string | null
          result?: string | null
          x?: number | null
          y?: number | null
          zone?: string | null
        }
        Update: {
          clock_seconds?: number
          context?: Json
          created_at?: string
          current_lineup?: Json
          event_type?: string
          game_id?: string
          id?: string
          player_id?: string | null
          points?: number
          quarter?: number
          related_event_id?: string | null
          result?: string | null
          x?: number | null
          y?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          clock_seconds: number
          created_at: string
          ended_at: string | null
          game_date: string
          home_away: string
          id: string
          opp_score: number
          opponent: string
          overtime_minutes: number
          period_minutes: number
          periods: number
          quarter: number
          starting_five: Json
          status: string
          team_id: string
          team_score: number
        }
        Insert: {
          clock_seconds?: number
          created_at?: string
          ended_at?: string | null
          game_date?: string
          home_away?: string
          id?: string
          opp_score?: number
          opponent: string
          overtime_minutes?: number
          period_minutes?: number
          periods?: number
          quarter?: number
          starting_five?: Json
          status?: string
          team_id: string
          team_score?: number
        }
        Update: {
          clock_seconds?: number
          created_at?: string
          ended_at?: string | null
          game_date?: string
          home_away?: string
          id?: string
          opp_score?: number
          opponent?: string
          overtime_minutes?: number
          period_minutes?: number
          periods?: number
          quarter?: number
          starting_five?: Json
          status?: string
          team_id?: string
          team_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["coach_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["coach_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["coach_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      play_frames: {
        Row: {
          actions: Json
          created_at: string
          id: string
          idx: number
          note: string | null
          play_id: string
          tokens: Json
        }
        Insert: {
          actions?: Json
          created_at?: string
          id?: string
          idx?: number
          note?: string | null
          play_id: string
          tokens?: Json
        }
        Update: {
          actions?: Json
          created_at?: string
          id?: string
          idx?: number
          note?: string | null
          play_id?: string
          tokens?: Json
        }
        Relationships: [
          {
            foreignKeyName: "play_frames_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          created_at: string
          id: string
          jersey: string
          name: string
          position: string | null
          team_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          jersey: string
          name: string
          position?: string | null
          team_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          jersey?: string
          name?: string
          position?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      plays: {
        Row: {
          attack_basket: string
          category: string
          created_at: string
          id: string
          is_shared: boolean
          name: string
          share_token: string | null
          team_id: string | null
        }
        Insert: {
          attack_basket?: string
          category?: string
          created_at?: string
          id?: string
          is_shared?: boolean
          name: string
          share_token?: string | null
          team_id?: string | null
        }
        Update: {
          attack_basket?: string
          category?: string
          created_at?: string
          id?: string
          is_shared?: boolean
          name?: string
          share_token?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plays_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          org_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      substitutions: {
        Row: {
          clock_seconds: number
          created_at: string
          game_id: string
          id: string
          lineup_after: Json
          player_in: string | null
          player_out: string | null
          quarter: number
        }
        Insert: {
          clock_seconds?: number
          created_at?: string
          game_id: string
          id?: string
          lineup_after?: Json
          player_in?: string | null
          player_out?: string | null
          quarter?: number
        }
        Update: {
          clock_seconds?: number
          created_at?: string
          game_id?: string
          id?: string
          lineup_after?: Json
          player_in?: string | null
          player_out?: string | null
          quarter?: number
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_player_in_fkey"
            columns: ["player_in"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_player_out_fkey"
            columns: ["player_out"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      team_events: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          location: string | null
          notes: string | null
          starts_at: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          assistant_coaches: string | null
          created_at: string
          default_overtime_minutes: number
          default_period_minutes: number
          default_periods: number
          head_coach_name: string | null
          id: string
          locker_enabled: boolean
          locker_token: string
          logo_url: string | null
          name: string
          org_id: string | null
          season: string
        }
        Insert: {
          assistant_coaches?: string | null
          created_at?: string
          default_overtime_minutes?: number
          default_period_minutes?: number
          default_periods?: number
          head_coach_name?: string | null
          id?: string
          locker_enabled?: boolean
          locker_token?: string
          logo_url?: string | null
          name: string
          org_id?: string | null
          season?: string
        }
        Update: {
          assistant_coaches?: string | null
          created_at?: string
          default_overtime_minutes?: number
          default_period_minutes?: number
          default_periods?: number
          head_coach_name?: string | null
          id?: string
          locker_enabled?: boolean
          locker_token?: string
          logo_url?: string | null
          name?: string
          org_id?: string | null
          season?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { _token: string }; Returns: Json }
      game_visible: { Args: { _game: string }; Returns: boolean }
      get_invite: {
        Args: { _token: string }
        Returns: {
          email: string
          org_name: string
          role: string
          status: string
          team_name: string
        }[]
      }
      is_head_coach: { Args: never; Returns: boolean }
      my_org_id: { Args: never; Returns: string }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["coach_role"]
      }
      play_visible: { Args: { _play: string }; Returns: boolean }
      team_visible: { Args: { _team: string }; Returns: boolean }
    }
    Enums: {
      coach_role: "head_coach" | "assistant_coach"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      coach_role: ["head_coach", "assistant_coach"],
    },
  },
} as const
