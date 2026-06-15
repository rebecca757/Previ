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
      ai_feedback: {
        Row: {
          comment: string | null
          created_at: string
          document_id: string | null
          id: string
          rating: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          rating: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          rating?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      biometric_history: {
        Row: {
          height_cm: number | null
          id: string
          recorded_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          height_cm?: number | null
          id?: string
          recorded_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          height_cm?: number | null
          id?: string
          recorded_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_full_interpretation: string | null
          ai_summary: string | null
          body_systems: string[]
          created_at: string
          deleted_at: string | null
          doc_type: string
          doctor_name: string | null
          document_date: string | null
          event_type: string | null
          facility_name: string | null
          facility_type: string | null
          file_path: string | null
          file_url: string | null
          id: string
          linked_memory_description: string | null
          linked_memory_notes: string | null
          scheduled_permanent_deletion_at: string | null
          source: string | null
          title: string
          user_id: string
        }
        Insert: {
          ai_full_interpretation?: string | null
          ai_summary?: string | null
          body_systems?: string[]
          created_at?: string
          deleted_at?: string | null
          doc_type: string
          doctor_name?: string | null
          document_date?: string | null
          event_type?: string | null
          facility_name?: string | null
          facility_type?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          linked_memory_description?: string | null
          linked_memory_notes?: string | null
          scheduled_permanent_deletion_at?: string | null
          source?: string | null
          title: string
          user_id: string
        }
        Update: {
          ai_full_interpretation?: string | null
          ai_summary?: string | null
          body_systems?: string[]
          created_at?: string
          deleted_at?: string | null
          doc_type?: string
          doctor_name?: string | null
          document_date?: string | null
          event_type?: string | null
          facility_name?: string | null
          facility_type?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          linked_memory_description?: string | null
          linked_memory_notes?: string | null
          scheduled_permanent_deletion_at?: string | null
          source?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      family_history: {
        Row: {
          condition: string
          condition_category: string | null
          created_at: string
          id: string
          is_deceased: boolean
          notes: string | null
          onset_age: number | null
          relation: string
          relation_degree: string | null
          user_id: string
        }
        Insert: {
          condition: string
          condition_category?: string | null
          created_at?: string
          id?: string
          is_deceased?: boolean
          notes?: string | null
          onset_age?: number | null
          relation: string
          relation_degree?: string | null
          user_id: string
        }
        Update: {
          condition?: string
          condition_category?: string | null
          created_at?: string
          id?: string
          is_deceased?: boolean
          notes?: string | null
          onset_age?: number | null
          relation?: string
          relation_degree?: string | null
          user_id?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invitee_email: string
          inviter_user_id: string
          link_type: string
          relation: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email: string
          inviter_user_id: string
          link_type?: string
          relation: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string
          inviter_user_id?: string
          link_type?: string
          relation?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      family_links: {
        Row: {
          caregiver_user_id: string
          created_at: string
          id: string
          link_type: string
          managed_user_id: string
          management_type: string
          relation: string
          status: string
          updated_at: string
        }
        Insert: {
          caregiver_user_id: string
          created_at?: string
          id?: string
          link_type: string
          managed_user_id: string
          management_type?: string
          relation: string
          status?: string
          updated_at?: string
        }
        Update: {
          caregiver_user_id?: string
          created_at?: string
          id?: string
          link_type?: string
          managed_user_id?: string
          management_type?: string
          relation?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_conditions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_memories: {
        Row: {
          body_part: string | null
          body_systems: string[]
          created_at: string
          deleted_at: string | null
          description: string
          doctor_name: string | null
          edit_history: Json
          event_date: string | null
          event_type: string | null
          facility_name: string | null
          facility_type: string | null
          id: string
          is_documented: boolean
          kept_after_link: boolean
          linked_document_id: string | null
          notes: string | null
          scheduled_deletion_at: string | null
          scheduled_permanent_deletion_at: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_part?: string | null
          body_systems?: string[]
          created_at?: string
          deleted_at?: string | null
          description: string
          doctor_name?: string | null
          edit_history?: Json
          event_date?: string | null
          event_type?: string | null
          facility_name?: string | null
          facility_type?: string | null
          id?: string
          is_documented?: boolean
          kept_after_link?: boolean
          linked_document_id?: string | null
          notes?: string | null
          scheduled_deletion_at?: string | null
          scheduled_permanent_deletion_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_part?: string | null
          body_systems?: string[]
          created_at?: string
          deleted_at?: string | null
          description?: string
          doctor_name?: string | null
          edit_history?: Json
          event_date?: string | null
          event_type?: string | null
          facility_name?: string | null
          facility_type?: string | null
          id?: string
          is_documented?: boolean
          kept_after_link?: boolean
          linked_document_id?: string | null
          notes?: string | null
          scheduled_deletion_at?: string | null
          scheduled_permanent_deletion_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_memories_linked_document_id_fkey"
            columns: ["linked_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          created_at: string
          dosage: string | null
          frequency: string | null
          id: string
          linked_condition_id: string | null
          name: string
          prescription_expiry: string | null
          prescription_type: string | null
          reason: string | null
          requires_prescription: boolean
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          frequency?: string | null
          id?: string
          linked_condition_id?: string | null
          name: string
          prescription_expiry?: string | null
          prescription_type?: string | null
          reason?: string | null
          requires_prescription?: boolean
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          frequency?: string | null
          id?: string
          linked_condition_id?: string | null
          name?: string
          prescription_expiry?: string | null
          prescription_type?: string | null
          reason?: string | null
          requires_prescription?: boolean
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_linked_condition_id_fkey"
            columns: ["linked_condition_id"]
            isOneToOne: false
            referencedRelation: "health_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_summaries: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          month: string
          summary_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          month: string
          summary_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          month?: string
          summary_text?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string[] | null
          biological_sex: string | null
          blood_type: string | null
          chronic_conditions: string[] | null
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          id: string
          medications: string[] | null
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          allergies?: string[] | null
          biological_sex?: string | null
          blood_type?: string | null
          chronic_conditions?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id: string
          medications?: string[] | null
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          allergies?: string[] | null
          biological_sex?: string | null
          blood_type?: string | null
          chronic_conditions?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          medications?: string[] | null
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          enabled: boolean
          guideline_id: string | null
          id: string
          linked_document_id: string | null
          linked_family_history_id: string | null
          linked_health_memory_id: string | null
          priority: string
          priority_reason: string | null
          reason: string | null
          source: string
          status: string
          suggested_specialty: string | null
          suggested_timeframe: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          enabled?: boolean
          guideline_id?: string | null
          id?: string
          linked_document_id?: string | null
          linked_family_history_id?: string | null
          linked_health_memory_id?: string | null
          priority?: string
          priority_reason?: string | null
          reason?: string | null
          source?: string
          status?: string
          suggested_specialty?: string | null
          suggested_timeframe?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          enabled?: boolean
          guideline_id?: string | null
          id?: string
          linked_document_id?: string | null
          linked_family_history_id?: string | null
          linked_health_memory_id?: string | null
          priority?: string
          priority_reason?: string | null
          reason?: string | null
          source?: string
          status?: string
          suggested_specialty?: string | null
          suggested_timeframe?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_caregiver: {
        Args: { _caregiver: string; _managed: string }
        Returns: boolean
      }
      is_family_linked: { Args: { _a: string; _b: string }; Returns: boolean }
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
