export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      collages: {
        Row: {
          id: string
          code: string
          name: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          user_id?: string
          created_at?: string
        }
      }
      photos: {
        Row: {
          id: string
          collage_id: string
          url: string
          created_at: string
        }
        Insert: {
          id?: string
          collage_id: string
          url: string
          created_at?: string
        }
        Update: {
          id?: string
          collage_id?: string
          url?: string
          created_at?: string
        }
      }
      collage_settings: {
        Row: {
          id: string
          collage_id: string
          settings: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          collage_id: string
          settings: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          collage_id?: string
          settings?: Json
          created_at?: string | null
          updated_at?: string | null
        }
      }
      high_scores: {
        Row: {
          id: string
          player_name: string
          score: number
          position: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          player_name: string
          score: number
          position?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          player_name?: string
          score?: number
          position?: number | null
          created_at?: string | null
        }
      }
      users: {
        Row: {
          id: string
          email: string
          created_at: string | null
        }
        Insert: {
          id: string
          email: string
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          created_at?: string | null
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      settings: {
        Row: {
          id: string
          primary_color: string
          secondary_color: string
          logo_url: string | null
          background_url: string | null
          grid_size: number
          gamification_enabled: boolean
          sponsor_logo_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          primary_color?: string
          secondary_color?: string
          logo_url?: string | null
          background_url?: string | null
          grid_size?: number
          gamification_enabled?: boolean
          sponsor_logo_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          primary_color?: string
          secondary_color?: string
          logo_url?: string | null
          background_url?: string | null
          grid_size?: number
          gamification_enabled?: boolean
          sponsor_logo_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      sound_settings: {
        Row: {
          id: string
          user_id: string
          volume: number
          enabled: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          volume?: number
          enabled?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          volume?: number
          enabled?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      images: {
        Row: {
          id: string
          name: string
          url: string
          alt_text: string | null
          section: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          url: string
          alt_text?: string | null
          section: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          url?: string
          alt_text?: string | null
          section?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      events: {
        Row: {
          id: string
          name: string
          code: string
          description: string | null
          created_at: string | null
          active: boolean | null
          owner_id: string
          logo_url: string | null
          start_date: string | null
          end_date: string | null
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          created_at?: string | null
          active?: boolean | null
          owner_id: string
          logo_url?: string | null
          start_date?: string | null
          end_date?: string | null
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string | null
          created_at?: string | null
          active?: boolean | null
          owner_id?: string
          logo_url?: string | null
          start_date?: string | null
          end_date?: string | null
        }
      }
      submissions: {
        Row: {
          id: string
          created_at: string | null
          name: string
          expertise: string
          help: string
          photo_url: string | null
          linkedin: string | null
          user_id: string
          is_featured: boolean | null
          is_active: boolean | null
          event_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string | null
          name: string
          expertise: string
          help: string
          photo_url?: string | null
          linkedin?: string | null
          user_id: string
          is_featured?: boolean | null
          is_active?: boolean | null
          event_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string | null
          name?: string
          expertise?: string
          help?: string
          photo_url?: string | null
          linkedin?: string | null
          user_id?: string
          is_featured?: boolean | null
          is_active?: boolean | null
          event_id?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}