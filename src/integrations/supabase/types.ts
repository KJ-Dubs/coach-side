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
      access_code_redemptions: {
        Row: {
          access_code_id: string
          created_at: string
          id: string
          modules: string[]
          team_id: string
          user_id: string
        }
        Insert: {
          access_code_id: string
          created_at?: string
          id?: string
          modules?: string[]
          team_id: string
          user_id: string
        }
        Update: {
          access_code_id?: string
          created_at?: string
          id?: string
          modules?: string[]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_code_redemptions_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_code_redemptions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      access_codes: {
        Row: {
          active: boolean
          code_hash: string
          code_hint: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          grant_days: number | null
          id: string
          label: string | null
          max_uses: number | null
          modules: string[]
          per_team_limit: number
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          code_hash: string
          code_hint: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          grant_days?: number | null
          id?: string
          label?: string | null
          max_uses?: number | null
          modules?: string[]
          per_team_limit?: number
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          code_hash?: string
          code_hint?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          grant_days?: number | null
          id?: string
          label?: string | null
          max_uses?: number | null
          modules?: string[]
          per_team_limit?: number
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
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
      anon_funnel_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
        }
        Relationships: []
      }
      app_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
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
      billing_price_map: {
        Row: {
          plan_key: string
          stripe_price_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          plan_key: string
          stripe_price_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          plan_key?: string
          stripe_price_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      billing_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          livemode: boolean | null
          processed: boolean
          provider: string
          received_at: string
          team_id: string | null
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          livemode?: boolean | null
          processed?: boolean
          provider: string
          received_at?: string
          team_id?: string | null
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          livemode?: boolean | null
          processed?: boolean
          provider?: string
          received_at?: string
          team_id?: string | null
        }
        Relationships: []
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
      coach_follows: {
        Row: {
          created_at: string
          creator_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          follower_id?: string
          id?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
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
      coach_notes: {
        Row: {
          body: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      complimentary_grants: {
        Row: {
          access_code_id: string | null
          active: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          modules: string[]
          org_id: string | null
          reason: string | null
          source: string
          team_id: string
          updated_at: string
        }
        Insert: {
          access_code_id?: string | null
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          modules?: string[]
          org_id?: string | null
          reason?: string | null
          source?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          access_code_id?: string | null
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          modules?: string[]
          org_id?: string | null
          reason?: string | null
          source?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complimentary_grants_access_code_fk"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complimentary_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complimentary_grants_team_id_fkey"
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
      drill_frames: {
        Row: {
          actions: Json
          created_at: string
          drill_id: string
          id: string
          idx: number
          note: string | null
          objects: Json
          tokens: Json
        }
        Insert: {
          actions?: Json
          created_at?: string
          drill_id: string
          id?: string
          idx: number
          note?: string | null
          objects?: Json
          tokens?: Json
        }
        Update: {
          actions?: Json
          created_at?: string
          drill_id?: string
          id?: string
          idx?: number
          note?: string | null
          objects?: Json
          tokens?: Json
        }
        Relationships: [
          {
            foreignKeyName: "drill_frames_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_hearts: {
        Row: {
          created_at: string
          drill_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drill_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drill_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_hearts_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_team_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          drill_id: string
          id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          drill_id: string
          id?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          drill_id?: string
          id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_team_assignments_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_team_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      drills: {
        Row: {
          category: string
          coaching_points: string | null
          copied_at: string | null
          court_orientation: string
          created_at: string
          created_by: string | null
          creator_username: string | null
          difficulty: string
          duration_minutes: number
          equipment: string[]
          group_size: string
          hearts: number
          id: string
          instructions: string
          library_author_name: string | null
          name: string
          published_at: string | null
          published_to_library: boolean
          repetitions: string | null
          root_drill_id: string | null
          scoring_rules: string | null
          skill_focus: string[]
          source_creator_id: string | null
          source_drill_id: string | null
          style: string
          tags: string[]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          coaching_points?: string | null
          copied_at?: string | null
          court_orientation?: string
          created_at?: string
          created_by?: string | null
          creator_username?: string | null
          difficulty?: string
          duration_minutes?: number
          equipment?: string[]
          group_size?: string
          hearts?: number
          id?: string
          instructions?: string
          library_author_name?: string | null
          name: string
          published_at?: string | null
          published_to_library?: boolean
          repetitions?: string | null
          root_drill_id?: string | null
          scoring_rules?: string | null
          skill_focus?: string[]
          source_creator_id?: string | null
          source_drill_id?: string | null
          style?: string
          tags?: string[]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          coaching_points?: string | null
          copied_at?: string | null
          court_orientation?: string
          created_at?: string
          created_by?: string | null
          creator_username?: string | null
          difficulty?: string
          duration_minutes?: number
          equipment?: string[]
          group_size?: string
          hearts?: number
          id?: string
          instructions?: string
          library_author_name?: string | null
          name?: string
          published_at?: string | null
          published_to_library?: boolean
          repetitions?: string | null
          root_drill_id?: string | null
          scoring_rules?: string | null
          skill_focus?: string[]
          source_creator_id?: string | null
          source_drill_id?: string | null
          style?: string
          tags?: string[]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drills_team_id_fkey"
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
      featured_play: {
        Row: {
          id: boolean
          play_id: string | null
          set_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          play_id?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          play_id?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_play_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
        ]
      }
      film_job_events: {
        Row: {
          clock_seconds: number
          confidence: number | null
          created_at: string
          event_type: string
          external_id: string | null
          id: string
          jersey_detected: string | null
          job_id: string
          lineup_guess: Json
          player_id: string | null
          points: number
          promoted_event_id: string | null
          quarter: number
          raw: Json
          related_proposed_id: string | null
          result: string | null
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          side: string
          updated_at: string
          video_ts_ms: number
          x: number | null
          y: number | null
        }
        Insert: {
          clock_seconds?: number
          confidence?: number | null
          created_at?: string
          event_type: string
          external_id?: string | null
          id?: string
          jersey_detected?: string | null
          job_id: string
          lineup_guess?: Json
          player_id?: string | null
          points?: number
          promoted_event_id?: string | null
          quarter?: number
          raw?: Json
          related_proposed_id?: string | null
          result?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          side?: string
          updated_at?: string
          video_ts_ms?: number
          x?: number | null
          y?: number | null
        }
        Update: {
          clock_seconds?: number
          confidence?: number | null
          created_at?: string
          event_type?: string
          external_id?: string | null
          id?: string
          jersey_detected?: string | null
          job_id?: string
          lineup_guess?: Json
          player_id?: string | null
          points?: number
          promoted_event_id?: string | null
          quarter?: number
          raw?: Json
          related_proposed_id?: string | null
          result?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          side?: string
          updated_at?: string
          video_ts_ms?: number
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "film_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "film_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_job_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_job_events_promoted_event_id_fkey"
            columns: ["promoted_event_id"]
            isOneToOne: false
            referencedRelation: "game_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_job_events_related_proposed_id_fkey"
            columns: ["related_proposed_id"]
            isOneToOne: false
            referencedRelation: "film_job_events"
            referencedColumns: ["id"]
          },
        ]
      }
      film_job_logs: {
        Row: {
          created_at: string
          data: Json
          id: string
          job_id: string
          level: string
          message: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          job_id: string
          level?: string
          message: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          job_id?: string
          level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "film_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      film_job_substitutions: {
        Row: {
          clock_seconds: number
          confidence: number | null
          created_at: string
          external_id: string | null
          id: string
          job_id: string
          lineup_after: Json
          player_in: string | null
          player_out: string | null
          promoted_sub_id: string | null
          quarter: number
          raw: Json
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          video_ts_ms: number
        }
        Insert: {
          clock_seconds?: number
          confidence?: number | null
          created_at?: string
          external_id?: string | null
          id?: string
          job_id: string
          lineup_after?: Json
          player_in?: string | null
          player_out?: string | null
          promoted_sub_id?: string | null
          quarter?: number
          raw?: Json
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          video_ts_ms?: number
        }
        Update: {
          clock_seconds?: number
          confidence?: number | null
          created_at?: string
          external_id?: string | null
          id?: string
          job_id?: string
          lineup_after?: Json
          player_in?: string | null
          player_out?: string | null
          promoted_sub_id?: string | null
          quarter?: number
          raw?: Json
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          video_ts_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "film_job_substitutions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "film_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_job_substitutions_player_in_fkey"
            columns: ["player_in"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_job_substitutions_player_out_fkey"
            columns: ["player_out"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_job_substitutions_promoted_sub_id_fkey"
            columns: ["promoted_sub_id"]
            isOneToOne: false
            referencedRelation: "substitutions"
            referencedColumns: ["id"]
          },
        ]
      }
      film_jobs: {
        Row: {
          attack_basket_first_half: string
          consent_acknowledged_at: string | null
          consent_acknowledged_by: string | null
          created_at: string
          created_by: string
          duration_seconds: number | null
          error: string | null
          finalized_at: string | null
          game_id: string | null
          id: string
          opp_color: string | null
          our_color: string | null
          periods: number
          progress: number
          provider: string
          provider_job_id: string | null
          retention_until: string
          roster_snapshot: Json
          source_type: string
          source_url: string | null
          status: string
          status_detail: string | null
          storage_path: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          attack_basket_first_half?: string
          consent_acknowledged_at?: string | null
          consent_acknowledged_by?: string | null
          created_at?: string
          created_by: string
          duration_seconds?: number | null
          error?: string | null
          finalized_at?: string | null
          game_id?: string | null
          id?: string
          opp_color?: string | null
          our_color?: string | null
          periods?: number
          progress?: number
          provider?: string
          provider_job_id?: string | null
          retention_until?: string
          roster_snapshot?: Json
          source_type?: string
          source_url?: string | null
          status?: string
          status_detail?: string | null
          storage_path?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          attack_basket_first_half?: string
          consent_acknowledged_at?: string | null
          consent_acknowledged_by?: string | null
          created_at?: string
          created_by?: string
          duration_seconds?: number | null
          error?: string | null
          finalized_at?: string | null
          game_id?: string | null
          id?: string
          opp_color?: string | null
          our_color?: string | null
          periods?: number
          progress?: number
          provider?: string
          provider_job_id?: string | null
          retention_until?: string
          roster_snapshot?: Json
          source_type?: string
          source_url?: string | null
          status?: string
          status_detail?: string | null
          storage_path?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_jobs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_jobs_team_id_fkey"
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
      notification_broadcasts: {
        Row: {
          audience_kind: string
          audience_ref: string | null
          body: string
          channels: string[]
          created_at: string
          email_queued: number
          id: string
          link: string | null
          push_failed: number
          push_sent: number
          recipient_count: number
          sent_by: string | null
          title: string
        }
        Insert: {
          audience_kind: string
          audience_ref?: string | null
          body: string
          channels?: string[]
          created_at?: string
          email_queued?: number
          id?: string
          link?: string | null
          push_failed?: number
          push_sent?: number
          recipient_count?: number
          sent_by?: string | null
          title: string
        }
        Update: {
          audience_kind?: string
          audience_ref?: string | null
          body?: string
          channels?: string[]
          created_at?: string
          email_queued?: number
          id?: string
          link?: string | null
          push_failed?: number
          push_sent?: number
          recipient_count?: number
          sent_by?: string | null
          title?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          notification_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_email_queue: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: string
          last_error: string | null
          link: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: string
          last_error?: string | null
          link?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: string
          last_error?: string | null
          link?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          onboarding_tips: boolean
          play_of_the_day_notifications: boolean
          practice_reminders: boolean
          push_enabled: boolean
          schedule_change_notifications: boolean
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
          onboarding_tips?: boolean
          play_of_the_day_notifications?: boolean
          practice_reminders?: boolean
          push_enabled?: boolean
          schedule_change_notifications?: boolean
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
          onboarding_tips?: boolean
          play_of_the_day_notifications?: boolean
          practice_reminders?: boolean
          push_enabled?: boolean
          schedule_change_notifications?: boolean
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
          dedupe_key: string | null
          id: string
          link: string | null
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
          dedupe_key?: string | null
          id?: string
          link?: string | null
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
          dedupe_key?: string | null
          id?: string
          link?: string | null
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
      nurture_deliveries: {
        Row: {
          created_at: string
          day: number
          id: string
          message_key: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day: number
          id?: string
          message_key: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day?: number
          id?: string
          message_key?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: []
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
          auto_created: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          auto_created?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          auto_created?: boolean
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
      play_hearts: {
        Row: {
          created_at: string
          id: string
          play_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          play_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          play_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_hearts_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
        ]
      }
      play_of_the_day: {
        Row: {
          created_at: string
          day: string
          notified_at: string | null
          play_id: string | null
          set_by: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          notified_at?: string | null
          play_id?: string | null
          set_by?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          notified_at?: string | null
          play_id?: string | null
          set_by?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_of_the_day_play_id_fkey"
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
          folder_id: string | null
          id: string
          is_visible: boolean
          library_version: number | null
          notes: string | null
          play_id: string
          share_enabled: boolean
          share_token: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          category_override?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          is_visible?: boolean
          library_version?: number | null
          notes?: string | null
          play_id: string
          share_enabled?: boolean
          share_token?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          category_override?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          is_visible?: boolean
          library_version?: number | null
          notes?: string | null
          play_id?: string
          share_enabled?: boolean
          share_token?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_team_assignments_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "team_playbook_folders"
            referencedColumns: ["id"]
          },
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
          copied_at: string | null
          created_at: string
          created_by: string | null
          defense_faced: string | null
          id: string
          indexed_at: string | null
          is_shared: boolean
          library_author_name: string | null
          library_version: number
          name: string
          outcome: string | null
          primary_actions: string[]
          publish_anonymous: boolean
          published_at: string | null
          published_by: string | null
          published_to_library: boolean
          root_play_id: string | null
          share_token: string | null
          situation: string | null
          source_creator_id: string | null
          source_play_id: string | null
          tags: string[]
          team_id: string | null
          time_pressure: string | null
        }
        Insert: {
          attack_basket?: string
          category?: string
          copied_at?: string | null
          created_at?: string
          created_by?: string | null
          defense_faced?: string | null
          id?: string
          indexed_at?: string | null
          is_shared?: boolean
          library_author_name?: string | null
          library_version?: number
          name: string
          outcome?: string | null
          primary_actions?: string[]
          publish_anonymous?: boolean
          published_at?: string | null
          published_by?: string | null
          published_to_library?: boolean
          root_play_id?: string | null
          share_token?: string | null
          situation?: string | null
          source_creator_id?: string | null
          source_play_id?: string | null
          tags?: string[]
          team_id?: string | null
          time_pressure?: string | null
        }
        Update: {
          attack_basket?: string
          category?: string
          copied_at?: string | null
          created_at?: string
          created_by?: string | null
          defense_faced?: string | null
          id?: string
          indexed_at?: string | null
          is_shared?: boolean
          library_author_name?: string | null
          library_version?: number
          name?: string
          outcome?: string | null
          primary_actions?: string[]
          publish_anonymous?: boolean
          published_at?: string | null
          published_by?: string | null
          published_to_library?: boolean
          root_play_id?: string | null
          share_token?: string | null
          situation?: string | null
          source_creator_id?: string | null
          source_play_id?: string | null
          tags?: string[]
          team_id?: string | null
          time_pressure?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plays_root_play_id_fkey"
            columns: ["root_play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plays_source_play_id_fkey"
            columns: ["source_play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plays_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_plan_blocks: {
        Row: {
          block_type: string
          completed: boolean
          created_at: string
          id: string
          idx: number
          minutes: number
          notes: string | null
          plan_id: string
          ref_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          block_type?: string
          completed?: boolean
          created_at?: string
          id?: string
          idx?: number
          minutes?: number
          notes?: string | null
          plan_id: string
          ref_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          completed?: boolean
          created_at?: string
          id?: string
          idx?: number
          minutes?: number
          notes?: string | null
          plan_id?: string
          ref_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_plan_blocks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "practice_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          plan_date: string
          shared_to_locker: boolean
          start_time: string | null
          team_id: string
          title: string
          total_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          plan_date?: string
          shared_to_locker?: boolean
          start_time?: string | null
          team_id: string
          title?: string
          total_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          plan_date?: string
          shared_to_locker?: boolean
          start_time?: string | null
          team_id?: string
          title?: string
          total_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      product_activity_events: {
        Row: {
          created_at: string
          entity_id: string | null
          event_type: string
          id: string
          metadata: Json
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_activity_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_id: string | null
          public_display_name: string | null
          publish_anonymous_default: boolean
          username: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          org_id?: string | null
          public_display_name?: string | null
          publish_anonymous_default?: boolean
          username?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          public_display_name?: string | null
          publish_anonymous_default?: boolean
          username?: string | null
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
      push_subscriptions: {
        Row: {
          active: boolean
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          failure_count: number
          id: string
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      team_billing: {
        Row: {
          billing_owner: string | null
          billing_provider: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          last_webhook_at: string | null
          last_webhook_error: string | null
          last_webhook_event_id: string | null
          modules: string[]
          pending_effective_at: string | null
          pending_modules: string[] | null
          square_customer_id: string | null
          square_plan_variation_id: string | null
          square_subscription_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          billing_owner?: string | null
          billing_provider?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          last_webhook_at?: string | null
          last_webhook_error?: string | null
          last_webhook_event_id?: string | null
          modules?: string[]
          pending_effective_at?: string | null
          pending_modules?: string[] | null
          square_customer_id?: string | null
          square_plan_variation_id?: string | null
          square_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          billing_owner?: string | null
          billing_provider?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          last_webhook_at?: string | null
          last_webhook_error?: string | null
          last_webhook_event_id?: string | null
          modules?: string[]
          pending_effective_at?: string | null
          pending_modules?: string[] | null
          square_customer_id?: string | null
          square_plan_variation_id?: string | null
          square_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_billing_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
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
      team_playbook_folders: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          sort_order: number
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_playbook_folders_team_id_fkey"
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
      team_trials: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          source: string
          started_at: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          source?: string
          started_at?: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          source?: string
          started_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_trials_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
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
      trial_claims: {
        Row: {
          claimed_at: string
          id: string
          org_id: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          org_id?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          org_id?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
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
      copy_drill_for_me: {
        Args: { _drill: string; _name?: string }
        Returns: string
      }
      copy_play_for_me: {
        Args: { _name?: string; _play: string; _team_ids?: string[] }
        Returns: string
      }
      creator_profile: {
        Args: { _username: string }
        Returns: {
          bio: string
          display_name: string
          followers: number
          published_plays: number
          total_hearts: number
          username: string
        }[]
      }
      drill_owned: { Args: { _drill: string }; Returns: boolean }
      drill_published: { Args: { _drill: string }; Returns: boolean }
      drill_visible: { Args: { _drill: string }; Returns: boolean }
      ensure_direct_conversation: {
        Args: { _other: string; _team: string }
        Returns: string
      }
      ensure_team_conversation: {
        Args: { _team: string; _type: string }
        Returns: string
      }
      finalize_film_job: {
        Args: { _job: string; _mode?: string }
        Returns: Json
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
      is_app_admin: { Args: never; Returns: boolean }
      is_game_coach: { Args: { _game: string }; Returns: boolean }
      is_head_coach: { Args: never; Returns: boolean }
      is_team_coach: { Args: { _team: string }; Returns: boolean }
      is_team_head_coach: { Args: { _team: string }; Returns: boolean }
      is_team_member: { Args: { _team: string }; Returns: boolean }
      is_team_staff_or_player: { Args: { _team: string }; Returns: boolean }
      library_feed: {
        Args: { _creator?: string }
        Returns: {
          attack_basket: string
          author_label: string
          category: string
          creator_username: string
          defense_faced: string
          featured: boolean
          hearts: number
          hearts_recent: number
          id: string
          library_version: number
          name: string
          outcome: string
          primary_actions: string[]
          published_at: string
          share_token: string
          situation: string
          tags: string[]
          time_pressure: string
        }[]
      }
      my_access: { Args: never; Returns: Json }
      my_achievement_metrics: { Args: never; Returns: Json }
      my_followed_creators: {
        Args: never
        Returns: {
          display_name: string
          published_plays: number
          username: string
        }[]
      }
      my_hearted_drills: { Args: never; Returns: string[] }
      my_hearted_plays: { Args: never; Returns: string[] }
      my_org_id: { Args: never; Returns: string }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["coach_role"]
      }
      my_team_entitlement: { Args: { _team: string }; Returns: Json }
      my_team_role: { Args: { _team: string }; Returns: string }
      my_verified_email: { Args: never; Returns: string }
      play_author_label: { Args: { _user: string }; Returns: string }
      play_owned: { Args: { _play: string }; Returns: boolean }
      play_published: { Args: { _play: string }; Returns: boolean }
      play_share_link: { Args: { _play: string }; Returns: string }
      play_visible: { Args: { _play: string }; Returns: boolean }
      practice_plan_coach: { Args: { _plan: string }; Returns: boolean }
      practice_plan_visible: { Args: { _plan: string }; Returns: boolean }
      public_play_frames: {
        Args: { _play: string }
        Returns: {
          actions: Json
          id: string
          idx: number
          note: string
          play_id: string
          tokens: Json
        }[]
      }
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
      schedule_play_of_the_day: {
        Args: { _day: string; _play: string }
        Returns: undefined
      }
      set_follow_creator: {
        Args: { _follow: boolean; _username: string }
        Returns: undefined
      }
      set_my_username: {
        Args: { _bio: string; _display_name: string; _username: string }
        Returns: undefined
      }
      set_play_of_the_day: { Args: { _play: string }; Returns: undefined }
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
      team_member_stored_role: {
        Args: { _id: string }
        Returns: Database["public"]["Enums"]["team_role"]
      }
      team_member_stored_team: { Args: { _id: string }; Returns: string }
      team_member_stored_user: { Args: { _id: string }; Returns: string }
      team_modules: { Args: { _team: string }; Returns: string[] }
      team_visible: { Args: { _team: string }; Returns: boolean }
      toggle_drill_heart: { Args: { _drill: string }; Returns: boolean }
      toggle_play_heart: { Args: { _play: string }; Returns: boolean }
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
