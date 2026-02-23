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
      bookings: {
        Row: {
          amount: number
          check_in: string | null
          check_out: string | null
          created_at: string
          experience_id: string | null
          guests: number | null
          id: string
          payment_reference: string | null
          reel_id: string | null
          status: string | null
          trip_title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          experience_id?: string | null
          guests?: number | null
          id?: string
          payment_reference?: string | null
          reel_id?: string | null
          status?: string | null
          trip_title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          experience_id?: string | null
          guests?: number | null
          id?: string
          payment_reference?: string | null
          reel_id?: string | null
          status?: string | null
          trip_title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attendees: number | null
          category: string
          created_at: string | null
          description: string | null
          end_date: string | null
          event_date: string
          id: string
          image_url: string | null
          location: string
          price: number | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          attendees?: number | null
          category: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          event_date: string
          id?: string
          image_url?: string | null
          location: string
          price?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          attendees?: number | null
          category?: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          event_date?: string
          id?: string
          image_url?: string | null
          location?: string
          price?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      experiences: {
        Row: {
          availability_status: string | null
          base_price: number | null
          category: string
          created_at: string
          current_price: number
          description: string | null
          entity_name: string
          id: string
          image_url: string | null
          location: string
          metadata: Json | null
          price_unit: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_status?: string | null
          base_price?: number | null
          category: string
          created_at?: string
          current_price: number
          description?: string | null
          entity_name: string
          id?: string
          image_url?: string | null
          location: string
          metadata?: Json | null
          price_unit?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_status?: string | null
          base_price?: number | null
          category?: string
          created_at?: string
          current_price?: number
          description?: string | null
          entity_name?: string
          id?: string
          image_url?: string | null
          location?: string
          metadata?: Json | null
          price_unit?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          is_read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          authorization_code: string | null
          brand: string | null
          created_at: string
          id: string
          last4: string | null
          provider: string | null
          reference: string | null
          user_id: string
        }
        Insert: {
          authorization_code?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          last4?: string | null
          provider?: string | null
          reference?: string | null
          user_id: string
        }
        Update: {
          authorization_code?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          last4?: string | null
          provider?: string | null
          reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          email: string | null
          emergency_contact: Json | null
          full_name: string | null
          host_role: string | null
          id: string
          id_number: string | null
          languages: string[] | null
          metadata: Json | null
          notification_settings: Json | null
          phone: string | null
          profile_completeness: number | null
          role: string | null
          security_settings: Json | null
          updated_at: string | null
          verification_badges: Json | null
          verification_id: string | null
          verification_status: string | null
        }
        Insert: {
          business_name?: string | null
          email?: string | null
          emergency_contact?: Json | null
          full_name?: string | null
          host_role?: string | null
          id: string
          id_number?: string | null
          languages?: string[] | null
          metadata?: Json | null
          notification_settings?: Json | null
          phone?: string | null
          profile_completeness?: number | null
          role?: string | null
          security_settings?: Json | null
          updated_at?: string | null
          verification_badges?: Json | null
          verification_id?: string | null
          verification_status?: string | null
        }
        Update: {
          business_name?: string | null
          email?: string | null
          emergency_contact?: Json | null
          full_name?: string | null
          host_role?: string | null
          id?: string
          id_number?: string | null
          languages?: string[] | null
          metadata?: Json | null
          notification_settings?: Json | null
          phone?: string | null
          profile_completeness?: number | null
          role?: string | null
          security_settings?: Json | null
          updated_at?: string | null
          verification_badges?: Json | null
          verification_id?: string | null
          verification_status?: string | null
        }
        Relationships: []
      }
      reel_likes: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_likes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_saves: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_saves_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          category: string
          created_at: string
          duration: number
          experience_id: string
          expires_at: string
          id: string
          is_live: boolean | null
          lat: number | null
          lng: number | null
          status: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          video_url: string
        }
        Insert: {
          category: string
          created_at?: string
          duration: number
          experience_id: string
          expires_at?: string
          id?: string
          is_live?: boolean | null
          lat?: number | null
          lng?: number | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          video_url: string
        }
        Update: {
          category?: string
          created_at?: string
          duration?: number
          experience_id?: string
          expires_at?: string
          id?: string
          is_live?: boolean | null
          lat?: number | null
          lng?: number | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "reels_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reels_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          device_token: string
          id: string
          last_active: string | null
          platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_token: string
          id?: string
          last_active?: string | null
          platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_token?: string
          id?: string
          last_active?: string | null
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      custom_sms_sender: { Args: { event: Json }; Returns: Json }
      register_device: {
        Args: { p_device_token: string; p_platform: string }
        Returns: undefined
      }
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
