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
      announcement_attachments: {
        Row: {
          announcement_id: string
          attachment_type: string
          created_at: string
          id: string
          metadata: Json
          related_id: string | null
        }
        Insert: {
          announcement_id: string
          attachment_type: string
          created_at?: string
          id?: string
          metadata?: Json
          related_id?: string | null
        }
        Update: {
          announcement_id?: string
          attachment_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          related_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_receipts: {
        Row: {
          acknowledged_at: string | null
          announcement_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          announcement_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          announcement_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_receipts_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          pinned: boolean
          require_acknowledgment: boolean
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          require_acknowledgment?: boolean
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          require_acknowledgment?: boolean
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_targets: {
        Row: {
          assignment_id: string
          completed_at: string | null
          created_at: string
          id: string
          player_id: string | null
          status: string
          updated_at: string
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          assignment_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          player_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          assignment_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          player_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_targets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assignment_type: string
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          instructions: string | null
          linked_id: string | null
          linked_type: string | null
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignment_type?: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          linked_id?: string | null
          linked_type?: string | null
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignment_type?: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          linked_id?: string | null
          linked_type?: string | null
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          connection_ref: string | null
          created_at: string
          enabled: boolean
          id: string
          provider: string
          provider_account_email: string | null
          sync_direction: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_ref?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          provider?: string
          provider_account_email?: string | null
          sync_direction?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_ref?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          provider?: string
          provider_account_email?: string | null
          sync_direction?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_mappings: {
        Row: {
          created_at: string
          id: string
          provider: string
          provider_calendar_id: string
          provider_calendar_name: string | null
          sync_direction: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider?: string
          provider_calendar_id: string
          provider_calendar_name?: string | null
          sync_direction?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          provider_calendar_id?: string
          provider_calendar_name?: string | null
          sync_direction?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
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
      conversation_members: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          muted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          muted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          muted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          team_id: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          team_id: string
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          team_id?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          created_at: string
          delivery_method: string
          event_id: string
          fixed_time: string | null
          id: string
          minutes_before: number | null
          reminder_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_method?: string
          event_id: string
          fixed_time?: string | null
          id?: string
          minutes_before?: number | null
          reminder_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_method?: string
          event_id?: string
          fixed_time?: string | null
          id?: string
          minutes_before?: number | null
          reminder_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "team_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sync_links: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string
          provider: string
          provider_calendar_id: string | null
          provider_event_id: string
          sync_source: string
          sync_status: string
          team_event_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string
          provider?: string
          provider_calendar_id?: string | null
          provider_event_id: string
          sync_source?: string
          sync_status?: string
          team_event_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string
          provider?: string
          provider_calendar_id?: string | null
          provider_event_id?: string
          sync_source?: string
          sync_status?: string
          team_event_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sync_links_team_event_id_fkey"
            columns: ["team_event_id"]
            isOneToOne: false
            referencedRelation: "team_events"
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
      google_calendar_connections: {
        Row: {
          access_token_ciphertext: string | null
          connection_key_ciphertext: string | null
          created_at: string
          google_account_email: string | null
          google_calendar_id: string | null
          google_calendar_name: string | null
          id: string
          last_sync_error: string | null
          last_synced_at: string | null
          needs_reauth: boolean
          refresh_token_ciphertext: string | null
          scope: string | null
          sync_enabled: boolean
          sync_status: string
          team_id: string
          token_expiry: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          connection_key_ciphertext?: string | null
          created_at?: string
          google_account_email?: string | null
          google_calendar_id?: string | null
          google_calendar_name?: string | null
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          needs_reauth?: boolean
          refresh_token_ciphertext?: string | null
          scope?: string | null
          sync_enabled?: boolean
          sync_status?: string
          team_id: string
          token_expiry?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          connection_key_ciphertext?: string | null
          created_at?: string
          google_account_email?: string | null
          google_calendar_id?: string | null
          google_calendar_name?: string | null
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          needs_reauth?: boolean
          refresh_token_ciphertext?: string | null
          scope?: string | null
          sync_enabled?: boolean
          sync_status?: string
          team_id?: string
          token_expiry?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          redirect_uri: string
          return_to: string
          state: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          redirect_uri: string
          return_to: string
          state: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          return_to?: string
          state?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_states_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          id: string
          message_id: string
          metadata: Json
          related_id: string | null
        }
        Insert: {
          attachment_type: string
          created_at?: string
          id?: string
          message_id: string
          metadata?: Json
          related_id?: string | null
        }
        Update: {
          attachment_type?: string
          created_at?: string
          id?: string
          message_id?: string
          metadata?: Json
          related_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          announcement_notifications: boolean
          assignment_notifications: boolean
          challenge_notifications: boolean
          created_at: string
          email_enabled: boolean
          game_reminders: boolean
          id: string
          new_play_notifications: boolean
          practice_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          announcement_notifications?: boolean
          assignment_notifications?: boolean
          challenge_notifications?: boolean
          created_at?: string
          email_enabled?: boolean
          game_reminders?: boolean
          id?: string
          new_play_notifications?: boolean
          practice_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          announcement_notifications?: boolean
          assignment_notifications?: boolean
          challenge_notifications?: boolean
          created_at?: string
          email_enabled?: boolean
          game_reminders?: boolean
          id?: string
          new_play_notifications?: boolean
          practice_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          id: string
          read_at: string | null
          related_id: string | null
          related_type: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          team_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          team_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          team_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_team_id_fkey"
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
      play_team_assignments: {
        Row: {
          assigned_by: string | null
          category_override: string | null
          created_at: string
          id: string
          is_visible: boolean
          notes: string | null
          play_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          category_override?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          notes?: string | null
          play_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          category_override?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          notes?: string | null
          play_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_team_assignments_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_team_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
          arrival_at: string | null
          attachments: Json
          created_at: string
          created_by: string | null
          ends_at: string | null
          event_type: string
          external_calendar_id: string | null
          external_event_id: string | null
          external_provider: string | null
          external_updated_at: string | null
          game_id: string | null
          home_away: string | null
          id: string
          kind: string
          last_modified_at: string
          location: string | null
          notes: string | null
          opponent: string | null
          source: string
          starts_at: string
          status: string
          team_id: string
          timezone: string | null
          title: string
          uniform: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          arrival_at?: string | null
          attachments?: Json
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_type?: string
          external_calendar_id?: string | null
          external_event_id?: string | null
          external_provider?: string | null
          external_updated_at?: string | null
          game_id?: string | null
          home_away?: string | null
          id?: string
          kind?: string
          last_modified_at?: string
          location?: string | null
          notes?: string | null
          opponent?: string | null
          source?: string
          starts_at: string
          status?: string
          team_id: string
          timezone?: string | null
          title: string
          uniform?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          arrival_at?: string | null
          attachments?: Json
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_type?: string
          external_calendar_id?: string | null
          external_event_id?: string | null
          external_provider?: string | null
          external_updated_at?: string | null
          game_id?: string | null
          home_away?: string | null
          id?: string
          kind?: string
          last_modified_at?: string
          location?: string | null
          notes?: string | null
          opponent?: string | null
          source?: string
          starts_at?: string
          status?: string
          team_id?: string
          timezone?: string | null
          title?: string
          uniform?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          invite_type: string
          team_id: string
          token: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          invite_type: string
          team_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          invite_type?: string
          team_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          id: string
          player_id: string | null
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          player_id?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          player_id?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_resources: {
        Row: {
          audience: string
          body: string | null
          category: string
          created_at: string
          created_by: string | null
          id: string
          team_id: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          audience?: string
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          team_id: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          audience?: string
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          team_id?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_resources_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          allow_player_posting: boolean
          assistant_coaches: string | null
          created_at: string
          default_arrival_offset_minutes: number
          default_game_reminder_minutes: number
          default_overtime_minutes: number
          default_period_minutes: number
          default_periods: number
          default_practice_location: string | null
          default_practice_reminder_minutes: number
          head_coach_name: string | null
          home_gym: string | null
          id: string
          locker_enabled: boolean
          locker_token: string
          logo_url: string | null
          name: string
          org_id: string | null
          require_ack_default: boolean
          season: string
          timezone: string
        }
        Insert: {
          allow_player_posting?: boolean
          assistant_coaches?: string | null
          created_at?: string
          default_arrival_offset_minutes?: number
          default_game_reminder_minutes?: number
          default_overtime_minutes?: number
          default_period_minutes?: number
          default_periods?: number
          default_practice_location?: string | null
          default_practice_reminder_minutes?: number
          head_coach_name?: string | null
          home_gym?: string | null
          id?: string
          locker_enabled?: boolean
          locker_token?: string
          logo_url?: string | null
          name: string
          org_id?: string | null
          require_ack_default?: boolean
          season?: string
          timezone?: string
        }
        Update: {
          allow_player_posting?: boolean
          assistant_coaches?: string | null
          created_at?: string
          default_arrival_offset_minutes?: number
          default_game_reminder_minutes?: number
          default_overtime_minutes?: number
          default_period_minutes?: number
          default_periods?: number
          default_practice_location?: string | null
          default_practice_reminder_minutes?: number
          head_coach_name?: string | null
          home_gym?: string | null
          id?: string
          locker_enabled?: boolean
          locker_token?: string
          logo_url?: string | null
          name?: string
          org_id?: string | null
          require_ack_default?: boolean
          season?: string
          timezone?: string
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
      accept_team_invite: {
        Args: { _player_id?: string; _token: string }
        Returns: Json
      }
      can_post_conversation: { Args: { _conv: string }; Returns: boolean }
      can_read_conversation: { Args: { _conv: string }; Returns: boolean }
      ensure_direct_conversation: {
        Args: { _other: string; _team: string }
        Returns: string
      }
      ensure_team_conversation: {
        Args: { _team: string; _type: string }
        Returns: string
      }
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
      get_team_invite: {
        Args: { _token: string }
        Returns: {
          invite_type: string
          locker_enabled: boolean
          locker_token: string
          season: string
          status: string
          team_id: string
          team_name: string
        }[]
      }
      invite_roster: {
        Args: { _token: string }
        Returns: {
          id: string
          jersey: string
          name: string
          taken: boolean
        }[]
      }
      is_game_coach: { Args: { _game: string }; Returns: boolean }
      is_head_coach: { Args: never; Returns: boolean }
      is_team_coach: { Args: { _team: string }; Returns: boolean }
      is_team_head_coach: { Args: { _team: string }; Returns: boolean }
      is_team_member: { Args: { _team: string }; Returns: boolean }
      is_team_staff_or_player: { Args: { _team: string }; Returns: boolean }
      my_access: { Args: never; Returns: Json }
      my_org_id: { Args: never; Returns: string }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["coach_role"]
      }
      my_team_role: { Args: { _team: string }; Returns: string }
      my_verified_email: { Args: never; Returns: string }
      play_visible: { Args: { _play: string }; Returns: boolean }
      queue_team_notification: {
        Args: {
          _body: string
          _pref_column: string
          _related_id: string
          _related_type: string
          _team: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      team_directory: {
        Args: { _team: string }
        Returns: {
          email: string
          full_name: string
          jersey: string
          player_id: string
          player_name: string
          role: string
          user_id: string
        }[]
      }
      team_visible: { Args: { _team: string }; Returns: boolean }
    }
    Enums: {
      coach_role: "head_coach" | "assistant_coach"
      team_role: "head_coach" | "assistant_coach" | "player" | "parent"
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
      team_role: ["head_coach", "assistant_coach", "player", "parent"],
    },
  },
} as const
