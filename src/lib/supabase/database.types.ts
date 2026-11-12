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
      areas: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          organization_id: string
          sensitive_data_accessed: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id: string
          sensitive_data_accessed?: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string
          sensitive_data_accessed?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          executed_at: string
          id: string
          organization_id: string
          rule_id: string | null
          rule_name: string | null
          status: string
        }
        Insert: {
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          executed_at?: string
          id?: string
          organization_id: string
          rule_id?: string | null
          rule_name?: string | null
          status?: string
        }
        Update: {
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          executed_at?: string
          id?: string
          organization_id?: string
          rule_id?: string | null
          rule_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          organization_id: string
          run_count: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          organization_id: string
          run_count?: number
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          organization_id?: string
          run_count?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_sequence_enrollments: {
        Row: {
          created_at: string
          current_step: number
          deal_id: string
          enrolled_stage: string
          id: string
          next_run_at: string
          organization_id: string
          sequence_id: string
          status: string
          stopped_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          deal_id: string
          enrolled_stage: string
          id?: string
          next_run_at?: string
          organization_id: string
          sequence_id: string
          status?: string
          stopped_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: number
          deal_id?: string
          enrolled_stage?: string
          id?: string
          next_run_at?: string
          organization_id?: string
          sequence_id?: string
          status?: string
          stopped_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_sequence_enrollments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_sequence_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "automation_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_sequence_steps: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          delay_hours: number
          id: string
          sequence_id: string
          step_order: number
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          delay_hours?: number
          id?: string
          sequence_id: string
          step_order: number
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          delay_hours?: number
          id?: string
          sequence_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "automation_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_sequences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_sequences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_requests: {
        Row: {
          amount: number
          created_at: string
          currency: string
          deal_id: string | null
          id: string
          installment: number
          installments: number
          label: string | null
          organization_id: string
          processed_at: string | null
          quote_id: string | null
          sent_to: string[] | null
          status: string
          task_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          deal_id?: string | null
          id?: string
          installment?: number
          installments?: number
          label?: string | null
          organization_id: string
          processed_at?: string | null
          quote_id?: string | null
          sent_to?: string[] | null
          status?: string
          task_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          deal_id?: string | null
          id?: string
          installment?: number
          installments?: number
          label?: string | null
          organization_id?: string
          processed_at?: string | null
          quote_id?: string | null
          sent_to?: string[] | null
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_settings: {
        Row: {
          auto_reminders: boolean
          days_after: number[]
          days_before: number
          on_due_date: boolean
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_reminders?: boolean
          days_after?: number[]
          days_before?: number
          on_due_date?: boolean
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_reminders?: boolean
          days_after?: number[]
          days_before?: number
          on_due_date?: boolean
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          business_activity: string | null
          country: string | null
          created_at: string
          custom_fields: Json
          employee_count: number | null
          id: string
          industry: string | null
          is_existing_client: boolean
          legal_name: string | null
          name: string
          organization_id: string
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          business_activity?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_existing_client?: boolean
          legal_name?: string | null
          name: string
          organization_id: string
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          business_activity?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_existing_client?: boolean
          legal_name?: string | null
          name?: string
          organization_id?: string
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          full_name: string
          id: string
          job_title: string | null
          linkedin_url: string | null
          organization_id: string
          phone: string | null
          phone_digits: string | null
          treatment: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          full_name: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          organization_id: string
          phone?: string | null
          phone_digits?: string | null
          treatment?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          organization_id?: string
          phone?: string | null
          phone_digits?: string | null
          treatment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_ai_insights: {
        Row: {
          created_at: string | null
          created_by: string | null
          deal_id: string
          id: string
          insights: Json
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deal_id: string
          id?: string
          insights: Json
          organization_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deal_id?: string
          id?: string
          insights?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_ai_insights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ai_insights_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_members: {
        Row: {
          added_by: string | null
          created_at: string | null
          deal_id: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          deal_id: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          deal_id?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_members_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          calification_reason: string | null
          closed_at: string | null
          company_id: string | null
          competitors: string | null
          created_at: string
          custom_fields: Json
          deal_type: Database["public"]["Enums"]["deal_type"]
          deleted_at: string | null
          estimated_value: number | null
          expected_close_date: string | null
          extension_reason: string | null
          id: string
          last_contacted_at: string | null
          lost_comment: string | null
          lost_reason: string | null
          next_action: string | null
          organization_id: string
          owner_id: string | null
          pipeline_id: string
          primary_contact_id: string | null
          probability: number | null
          product_line: string | null
          proposal_filename: string | null
          proposal_size: number | null
          proposal_uploaded_at: string | null
          proposal_url: string | null
          score: number
          source: string | null
          stage: string
          status: Database["public"]["Enums"]["deal_status"]
          updated_at: string
        }
        Insert: {
          calification_reason?: string | null
          closed_at?: string | null
          company_id?: string | null
          competitors?: string | null
          created_at?: string
          custom_fields?: Json
          deal_type?: Database["public"]["Enums"]["deal_type"]
          deleted_at?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          extension_reason?: string | null
          id?: string
          last_contacted_at?: string | null
          lost_comment?: string | null
          lost_reason?: string | null
          next_action?: string | null
          organization_id: string
          owner_id?: string | null
          pipeline_id: string
          primary_contact_id?: string | null
          probability?: number | null
          product_line?: string | null
          proposal_filename?: string | null
          proposal_size?: number | null
          proposal_uploaded_at?: string | null
          proposal_url?: string | null
          score?: number
          source?: string | null
          stage: string
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
        }
        Update: {
          calification_reason?: string | null
          closed_at?: string | null
          company_id?: string | null
          competitors?: string | null
          created_at?: string
          custom_fields?: Json
          deal_type?: Database["public"]["Enums"]["deal_type"]
          deleted_at?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          extension_reason?: string | null
          id?: string
          last_contacted_at?: string | null
          lost_comment?: string | null
          lost_reason?: string | null
          next_action?: string | null
          organization_id?: string
          owner_id?: string | null
          pipeline_id?: string
          primary_contact_id?: string | null
          probability?: number | null
          product_line?: string | null
          proposal_filename?: string | null
          proposal_size?: number | null
          proposal_uploaded_at?: string | null
          proposal_url?: string | null
          score?: number
          source?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_fk"
            columns: ["organization_id", "stage"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "key"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string | null
          connected_at: string
          created_at: string
          email_address: string
          id: string
          is_active: boolean
          organization_id: string
          provider: string
          refresh_token: string | null
          subscription_expires_at: string | null
          subscription_id: string | null
          sync_cursor: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string
          created_at?: string
          email_address: string
          id?: string
          is_active?: boolean
          organization_id: string
          provider: string
          refresh_token?: string | null
          subscription_expires_at?: string | null
          subscription_id?: string | null
          sync_cursor?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string
          created_at?: string
          email_address?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          provider?: string
          refresh_token?: string | null
          subscription_expires_at?: string | null
          subscription_id?: string | null
          sync_cursor?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          direction: string
          email_account_id: string | null
          from_address: string
          id: string
          organization_id: string
          provider_message_id: string | null
          sent_at: string
          subject: string | null
          thread_id: string | null
          to_addresses: string[]
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction: string
          email_account_id?: string | null
          from_address: string
          id?: string
          organization_id: string
          provider_message_id?: string | null
          sent_at: string
          subject?: string | null
          thread_id?: string | null
          to_addresses?: string[]
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          email_account_id?: string | null
          from_address?: string
          id?: string
          organization_id?: string
          provider_message_id?: string | null
          sent_at?: string
          subject?: string | null
          thread_id?: string | null
          to_addresses?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      field_definitions: {
        Row: {
          created_at: string
          entity: string
          field_type: string
          help_text: string | null
          id: string
          is_active: boolean
          is_filterable: boolean
          is_required: boolean
          is_searchable: boolean
          key: string
          label: string
          options: Json
          organization_id: string
          placeholder: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          entity: string
          field_type: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_filterable?: boolean
          is_required?: boolean
          is_searchable?: boolean
          key: string
          label: string
          options?: Json
          organization_id: string
          placeholder?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          entity?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_filterable?: boolean
          is_required?: boolean
          is_searchable?: boolean
          key?: string
          label?: string
          options?: Json
          organization_id?: string
          placeholder?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          contact_id: string | null
          content: string | null
          cost: number | null
          created_at: string
          deal_id: string | null
          direction: Database["public"]["Enums"]["interaction_direction"] | null
          id: string
          metadata: Json | null
          organization_id: string
          type: Database["public"]["Enums"]["interaction_type"]
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          content?: string | null
          cost?: number | null
          created_at?: string
          deal_id?: string | null
          direction?:
            | Database["public"]["Enums"]["interaction_direction"]
            | null
          id?: string
          metadata?: Json | null
          organization_id: string
          type: Database["public"]["Enums"]["interaction_type"]
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string | null
          cost?: number | null
          created_at?: string
          deal_id?: string | null
          direction?:
            | Database["public"]["Enums"]["interaction_direction"]
            | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          type?: Database["public"]["Enums"]["interaction_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_activities: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          kind: string
          notes: string
          organization_id: string
          promise_amount: number | null
          promise_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          kind: string
          notes: string
          organization_id: string
          promise_amount?: number | null
          promise_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          kind?: string
          notes?: string
          organization_id?: string
          promise_amount?: number | null
          promise_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_activities_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          method: string
          notes: string | null
          organization_id: string
          paid_on: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          organization_id: string
          paid_on?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          organization_id?: string
          paid_on?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_reminders: {
        Row: {
          id: string
          invoice_id: string
          milestone: string
          organization_id: string
          sent_at: string
          sent_to: string
        }
        Insert: {
          id?: string
          invoice_id: string
          milestone: string
          organization_id: string
          sent_at?: string
          sent_to: string
        }
        Update: {
          id?: string
          invoice_id?: string
          milestone?: string
          organization_id?: string
          sent_at?: string
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          cancelled_at: string | null
          cancelled_reason: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          description: string
          document_folio: string | null
          document_type: string
          due_date: string
          id: string
          invoice_number: number
          issue_date: string
          last_activity_at: string | null
          next_promise_date: string | null
          notes: string | null
          organization_id: string
          paid_amount: number
          project_id: string | null
          quote_id: string | null
          responsible_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          cancelled_reason?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          description: string
          document_folio?: string | null
          document_type?: string
          due_date: string
          id?: string
          invoice_number: number
          issue_date?: string
          last_activity_at?: string | null
          next_promise_date?: string | null
          notes?: string | null
          organization_id: string
          paid_amount?: number
          project_id?: string | null
          quote_id?: string | null
          responsible_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          cancelled_reason?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          description?: string
          document_folio?: string | null
          document_type?: string
          due_date?: string
          id?: string
          invoice_number?: number
          issue_date?: string
          last_activity_at?: string | null
          next_promise_date?: string | null
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          project_id?: string | null
          quote_id?: string | null
          responsible_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: number
          ip: string
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
          ip: string
          success: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
          ip?: string
          success?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          organization_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          organization_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          organization_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          expires_at: string | null
          id: string
          module_key: string
          organization_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          module_key: string
          organization_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          module_key?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accounting_email: string | null
          address: string | null
          country: string
          created_at: string
          currency: string
          default_country_code: string
          display_name: string | null
          email: string | null
          email_templates: Json | null
          id: string
          is_active: boolean
          logo_url: string | null
          max_users: number | null
          name: string
          notification_email: string | null
          payment_conditions: string
          payment_instructions: string | null
          payment_terms: Json
          phone: string | null
          plan: string
          require_mfa: boolean
          taxes: Json
          timezone: string
        }
        Insert: {
          accounting_email?: string | null
          address?: string | null
          country?: string
          created_at?: string
          currency?: string
          default_country_code?: string
          display_name?: string | null
          email?: string | null
          email_templates?: Json | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_users?: number | null
          name: string
          notification_email?: string | null
          payment_conditions?: string
          payment_instructions?: string | null
          payment_terms?: Json
          phone?: string | null
          plan?: string
          require_mfa?: boolean
          taxes?: Json
          timezone?: string
        }
        Update: {
          accounting_email?: string | null
          address?: string | null
          country?: string
          created_at?: string
          currency?: string
          default_country_code?: string
          display_name?: string | null
          email?: string | null
          email_templates?: Json | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_users?: number | null
          name?: string
          notification_email?: string | null
          payment_conditions?: string
          payment_instructions?: string | null
          payment_terms?: Json
          phone?: string | null
          plan?: string
          require_mfa?: boolean
          taxes?: Json
          timezone?: string
        }
        Relationships: []
      }
      pipeline_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          from_stage: string | null
          id: string
          organization_id: string
          reason: string | null
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          from_stage?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          from_stage?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          confirm_label: string | null
          created_at: string
          creates_project: boolean
          default_probability: number
          id: string
          in_funnel: boolean
          is_active: boolean
          is_default: boolean
          is_lost: boolean
          is_terminal: boolean
          is_won: boolean
          key: string
          label: string
          modal_subtitle: string | null
          modal_title: string | null
          organization_id: string
          pipeline_id: string
          reasons: Json
          requires_attachment: boolean
          requires_reason: boolean
          sort_order: number
        }
        Insert: {
          color?: string
          confirm_label?: string | null
          created_at?: string
          creates_project?: boolean
          default_probability?: number
          id?: string
          in_funnel?: boolean
          is_active?: boolean
          is_default?: boolean
          is_lost?: boolean
          is_terminal?: boolean
          is_won?: boolean
          key: string
          label: string
          modal_subtitle?: string | null
          modal_title?: string | null
          organization_id: string
          pipeline_id: string
          reasons?: Json
          requires_attachment?: boolean
          requires_reason?: boolean
          sort_order?: number
        }
        Update: {
          color?: string
          confirm_label?: string | null
          created_at?: string
          creates_project?: boolean
          default_probability?: number
          id?: string
          in_funnel?: boolean
          is_active?: boolean
          is_default?: boolean
          is_lost?: boolean
          is_terminal?: boolean
          is_won?: boolean
          key?: string
          label?: string
          modal_subtitle?: string | null
          modal_title?: string | null
          organization_id?: string
          pipeline_id?: string
          reasons?: Json
          requires_attachment?: boolean
          requires_reason?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_integrations: {
        Row: {
          access_token: string | null
          config: Json
          created_at: string
          external_id: string
          id: string
          is_active: boolean
          label: string | null
          organization_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          config?: Json
          created_at?: string
          external_id: string
          id?: string
          is_active?: boolean
          label?: string | null
          organization_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          config?: Json
          created_at?: string
          external_id?: string
          id?: string
          is_active?: boolean
          label?: string | null
          organization_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_owners: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          area_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          email_templates: Json | null
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          manager_id: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          section_access: Json | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          email_templates?: Json | null
          full_name: string
          id: string
          is_active?: boolean
          job_title?: string | null
          manager_id?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          section_access?: Json | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          email_templates?: Json | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          manager_id?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          section_access?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_billing_milestones: {
        Row: {
          created_at: string
          installment: number
          project_id: string
          quote_id: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string
          installment: number
          project_id: string
          quote_id?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string
          installment?: number
          project_id?: string
          quote_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_billing_milestones_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_billing_milestones_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deliverables: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          organization_id: string
          project_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          organization_id: string
          project_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          organization_id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_deliverables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_by: string | null
          created_at: string | null
          id: string
          organization_id: string
          project_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          project_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_internal: boolean
          organization_id: string
          project_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id: string
          project_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id?: string
          project_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_hours: number | null
          budget: number | null
          company_id: string | null
          created_at: string
          customer_satisfaction_score: number | null
          deal_id: string | null
          delivered_at: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          owner_id: string | null
          phase: Database["public"]["Enums"]["project_phase"]
          proposal_id: string | null
          spec_notes: string | null
          spec_requested_at: string | null
          spec_requested_by: string | null
          spec_resolved_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          actual_hours?: number | null
          budget?: number | null
          company_id?: string | null
          created_at?: string
          customer_satisfaction_score?: number | null
          deal_id?: string | null
          delivered_at?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          phase?: Database["public"]["Enums"]["project_phase"]
          proposal_id?: string | null
          spec_notes?: string | null
          spec_requested_at?: string | null
          spec_requested_by?: string | null
          spec_resolved_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          actual_hours?: number | null
          budget?: number | null
          company_id?: string | null
          created_at?: string
          customer_satisfaction_score?: number | null
          deal_id?: string | null
          delivered_at?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          phase?: Database["public"]["Enums"]["project_phase"]
          proposal_id?: string | null
          spec_notes?: string | null
          spec_requested_at?: string | null
          spec_requested_by?: string | null
          spec_resolved_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_spec_requested_by_fkey"
            columns: ["spec_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_acceptance_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          quote_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          quote_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_acceptance_codes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_by_name: string | null
          accepted_email: string | null
          accepted_hash: string | null
          accepted_ip: string | null
          accepted_role: string | null
          accepted_rut: string | null
          accepted_snapshot: Json | null
          accepted_user_agent: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string
          id: string
          items: Json
          notes: string | null
          organization_id: string
          payment_conditions: string | null
          payment_terms: Json | null
          public_token: string | null
          quote_number: number
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          sent_to_email: string | null
          status: string
          tax_rate: number
          taxes: Json
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          accepted_email?: string | null
          accepted_hash?: string | null
          accepted_ip?: string | null
          accepted_role?: string | null
          accepted_rut?: string | null
          accepted_snapshot?: Json | null
          accepted_user_agent?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id: string
          id?: string
          items?: Json
          notes?: string | null
          organization_id: string
          payment_conditions?: string | null
          payment_terms?: Json | null
          public_token?: string | null
          quote_number: number
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          tax_rate?: number
          taxes?: Json
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          accepted_email?: string | null
          accepted_hash?: string | null
          accepted_ip?: string | null
          accepted_role?: string | null
          accepted_rut?: string | null
          accepted_snapshot?: Json | null
          accepted_user_agent?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string
          id?: string
          items?: Json
          notes?: string | null
          organization_id?: string
          payment_conditions?: string | null
          payment_terms?: Json | null
          public_token?: string | null
          quote_number?: number
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          tax_rate?: number
          taxes?: Json
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          created_at: string
          id: number
          rl_key: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
          rl_key: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
          rl_key?: string
        }
        Relationships: []
      }
      service_reminders: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          expires_on: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          changed_by: string | null
          comment: string
          created_at: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          organization_id: string
          task_id: string
        }
        Insert: {
          changed_by?: string | null
          comment: string
          created_at?: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id: string
          task_id: string
        }
        Update: {
          changed_by?: string | null
          comment?: string
          created_at?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          organization_id: string
          reminder_sent_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          organization_id: string
          reminder_sent_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          organization_id?: string
          reminder_sent_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          content: string
          created_at: string | null
          deal_id: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_log: {
        Row: {
          action_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          device_info: string | null
          id: string
          ip_address: string | null
          last_seen_at: string
          organization_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          device_info?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          organization_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          device_info?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          organization_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          created_at: string | null
          deal_id: string
          direction: string
          id: string
          organization_id: string
          sent_by: string | null
          status: string | null
          wa_message_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          deal_id: string
          direction: string
          id?: string
          organization_id: string
          sent_by?: string | null
          status?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          deal_id?: string
          direction?: string
          id?: string
          organization_id?: string
          sent_by?: string | null
          status?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_organization_id_fkey"
            columns: ["organization_id"]
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
      can_see_deal: { Args: { p_deal_id: string }; Returns: boolean }
      check_project_billing: { Args: { p_project_id: string }; Returns: number }
      claim_task_reminders: {
        Args: { p_minutes?: number }
        Returns: {
          company_name: string
          deal_id: string
          description: string
          due_date: string
          email: string
          full_name: string
          organization_id: string
          task_id: string
          title: string
          user_id: string
        }[]
      }
      create_pipeline: {
        Args: { p_name: string; p_org_id: string }
        Returns: string
      }
      cron_call: { Args: { p_path: string }; Returns: undefined }
      current_org_id: { Args: never; Returns: string }
      current_user_is_active: { Args: never; Returns: boolean }
      current_user_role: { Args: never; Returns: string }
      delete_company_if_empty: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      fmt_money: { Args: { cur: string; m: number }; Returns: string }
      get_all_profiles_for_cron: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          is_active: boolean
        }[]
      }
      get_overdue_tasks_for_cron: {
        Args: { p_before: string; p_user_id: string }
        Returns: {
          due_date: string
          id: string
          is_completed: boolean
          title: string
        }[]
      }
      get_tasks_for_cron: {
        Args: { p_from: string; p_to: string; p_user_id: string }
        Returns: {
          due_date: string
          id: string
          is_completed: boolean
          title: string
        }[]
      }
      is_collections_manager: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_platform_owner: { Args: never; Returns: boolean }
      next_business_due: { Args: { ts?: string }; Returns: string }
      platform_service_health: { Args: never; Returns: Json }
      release_task_reminder: { Args: { p_task_id: string }; Returns: undefined }
      seed_default_modules: { Args: { p_org_id: string }; Returns: undefined }
      seed_default_stages: { Args: { p_org_id: string }; Returns: undefined }
      set_default_stage: {
        Args: { p_org_id: string; p_stage_id: string }
        Returns: undefined
      }
      set_won_stage: {
        Args: { p_org_id: string; p_stage_id: string }
        Returns: undefined
      }
      soft_delete_deal: { Args: { p_deal_id: string }; Returns: undefined }
      valid_payment_terms: { Args: { t: Json }; Returns: boolean }
      valid_taxes: { Args: { t: Json }; Returns: boolean }
    }
    Enums: {
      deal_status: "open" | "won" | "lost"
      deal_type: "new_business" | "upsell" | "renewal"
      interaction_direction: "inbound" | "outbound"
      interaction_type: "email" | "call" | "meeting" | "note"
      project_phase:
        | "discovery"
        | "diseno"
        | "desarrollo"
        | "pruebas"
        | "entrega"
        | "soporte"
      project_status:
        | "activo"
        | "pausado"
        | "entregado"
        | "cancelado"
        | "pendiente_especificaciones"
      user_role:
        | "admin"
        | "comercial"
        | "operaciones"
        | "finanzas"
        | "super_admin"
        | "gerente"
        | "produccion"
        | "soporte"
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
      deal_status: ["open", "won", "lost"],
      deal_type: ["new_business", "upsell", "renewal"],
      interaction_direction: ["inbound", "outbound"],
      interaction_type: ["email", "call", "meeting", "note"],
      project_phase: [
        "discovery",
        "diseno",
        "desarrollo",
        "pruebas",
        "entrega",
        "soporte",
      ],
      project_status: [
        "activo",
        "pausado",
        "entregado",
        "cancelado",
        "pendiente_especificaciones",
      ],
      user_role: [
        "admin",
        "comercial",
        "operaciones",
        "finanzas",
        "super_admin",
        "gerente",
        "produccion",
        "soporte",
      ],
    },
  },
} as const
