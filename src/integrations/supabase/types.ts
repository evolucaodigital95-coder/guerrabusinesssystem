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
      accounts: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          kind: string | null
          name: string
          notes: string | null
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          kind?: string | null
          name: string
          notes?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          kind?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          agent_id: string | null
          amount: number | null
          amount_amortized: number
          archived_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          granted_on: string | null
          granted_time: string | null
          id: string
          lecture_id: string | null
          notes: string | null
          organization_id: string
          paid_by_label: string | null
          paid_by_user_id: string | null
          receipt_url: string | null
          source: string | null
          status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_id?: string | null
          amount?: number | null
          amount_amortized?: number
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          granted_on?: string | null
          granted_time?: string | null
          id?: string
          lecture_id?: string | null
          notes?: string | null
          organization_id: string
          paid_by_label?: string | null
          paid_by_user_id?: string | null
          receipt_url?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_id?: string | null
          amount?: number | null
          amount_amortized?: number
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          granted_on?: string | null
          granted_time?: string | null
          id?: string
          lecture_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_by_label?: string | null
          paid_by_user_id?: string | null
          receipt_url?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advances_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          address: string | null
          archived_at: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
          pix_key: string | null
          pix_kind: string | null
          status: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          pix_key?: string | null
          pix_kind?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          pix_key?: string | null
          pix_kind?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          file_name: string | null
          id: string
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_fkey"
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
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          archived_at: string | null
          channel: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string | null
          id: string
          name: string
          organization_id: string
          season_id: string | null
          starts_on: string | null
          status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          name: string
          organization_id: string
          season_id?: string | null
          starts_on?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          organization_id?: string
          season_id?: string | null
          starts_on?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      card_brands: {
        Row: {
          active: boolean
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      card_fee_tiers: {
        Row: {
          archived_at: string | null
          card_brand_id: string
          created_at: string
          created_by: string | null
          days_to_receive: number
          effective_from: string | null
          effective_to: string | null
          fee_percent: number
          id: string
          installments: number
          notes: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          card_brand_id: string
          created_at?: string
          created_by?: string | null
          days_to_receive?: number
          effective_from?: string | null
          effective_to?: string | null
          fee_percent?: number
          id?: string
          installments?: number
          notes?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          card_brand_id?: string
          created_at?: string
          created_by?: string | null
          days_to_receive?: number
          effective_from?: string | null
          effective_to?: string | null
          fee_percent?: number
          id?: string
          installments?: number
          notes?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_fee_tiers_card_brand_id_fkey"
            columns: ["card_brand_id"]
            isOneToOne: false
            referencedRelation: "card_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_fee_tiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          archived_at: string | null
          city: string | null
          created_at: string
          created_by: string | null
          document: string | null
          employees_count: number | null
          id: string
          instagram: string | null
          is_favorite: boolean
          legal_name: string
          lifecycle_stage: string | null
          notes: string | null
          organization_id: string
          owner_id: string | null
          segment: string | null
          state: string | null
          status: string | null
          trade_name: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          employees_count?: number | null
          id?: string
          instagram?: string | null
          is_favorite?: boolean
          legal_name: string
          lifecycle_stage?: string | null
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          segment?: string | null
          state?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          employees_count?: number | null
          id?: string
          instagram?: string | null
          is_favorite?: boolean
          legal_name?: string
          lifecycle_stage?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          segment?: string | null
          state?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived_at: string | null
          birthday: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
          role: string | null
          updated_at: string
          updated_by: string | null
          whatsapp: string | null
        }
        Insert: {
          archived_at?: string | null
          birthday?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          archived_at?: string | null
          birthday?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
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
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          archived_at: string | null
          consequences: string | null
          context: string | null
          created_at: string
          created_by: string | null
          decided_on: string | null
          decision: string | null
          id: string
          organization_id: string
          status: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          consequences?: string | null
          context?: string | null
          created_at?: string
          created_by?: string | null
          decided_on?: string | null
          decision?: string | null
          id?: string
          organization_id: string
          status?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          consequences?: string | null
          context?: string | null
          created_at?: string
          created_by?: string | null
          decided_on?: string | null
          decision?: string | null
          id?: string
          organization_id?: string
          status?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          account_id: string | null
          agent_id: string | null
          amount: number | null
          archived_at: string | null
          card_brand_id: string | null
          card_fee_amount: number | null
          card_fee_percent: number | null
          card_installments: number | null
          category: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          direction: string | null
          expected_amount: number | null
          expected_date: string | null
          id: string
          lecture_id: string | null
          net_amount: number | null
          notes: string | null
          occurs_on: string | null
          occurs_time: string | null
          organization_id: string
          payment_method: string | null
          project_id: string | null
          season_id: string | null
          settled_at: string | null
          status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          agent_id?: string | null
          amount?: number | null
          archived_at?: string | null
          card_brand_id?: string | null
          card_fee_amount?: number | null
          card_fee_percent?: number | null
          card_installments?: number | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          direction?: string | null
          expected_amount?: number | null
          expected_date?: string | null
          id?: string
          lecture_id?: string | null
          net_amount?: number | null
          notes?: string | null
          occurs_on?: string | null
          occurs_time?: string | null
          organization_id: string
          payment_method?: string | null
          project_id?: string | null
          season_id?: string | null
          settled_at?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          agent_id?: string | null
          amount?: number | null
          archived_at?: string | null
          card_brand_id?: string | null
          card_fee_amount?: number | null
          card_fee_percent?: number | null
          card_installments?: number | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          direction?: string | null
          expected_amount?: number | null
          expected_date?: string | null
          id?: string
          lecture_id?: string | null
          net_amount?: number | null
          notes?: string | null
          occurs_on?: string | null
          occurs_time?: string | null
          organization_id?: string
          payment_method?: string | null
          project_id?: string | null
          season_id?: string | null
          settled_at?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_card_brand_id_fkey"
            columns: ["card_brand_id"]
            isOneToOne: false
            referencedRelation: "card_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_rules: {
        Row: {
          agent_id: string | null
          agent_share: number
          archived_at: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          fee_fixed: number
          fee_percent: number
          gustavo_share: number
          id: string
          is_default: boolean
          name: string
          notes: string | null
          organization_id: string
          scope: string
          season_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_share?: number
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          fee_fixed?: number
          fee_percent?: number
          gustavo_share?: number
          id?: string
          is_default?: boolean
          name: string
          notes?: string | null
          organization_id: string
          scope?: string
          season_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_share?: number
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          fee_fixed?: number
          fee_percent?: number
          gustavo_share?: number
          id?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          scope?: string
          season_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_rules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_rules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      history_events: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          happened_on: string | null
          id: string
          organization_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          happened_on?: string | null
          id?: string
          organization_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          happened_on?: string | null
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "history_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          archived_at: string | null
          code: string | null
          created_at: string
          created_by: string | null
          expires_on: string | null
          id: string
          initial_quantity: number | null
          notes: string | null
          organization_id: string
          proof_url: string | null
          quantity: number | null
          received_on: string | null
          stock_item_id: string | null
          supplier: string | null
          unit_cost: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          initial_quantity?: number | null
          notes?: string | null
          organization_id: string
          proof_url?: string | null
          quantity?: number | null
          received_on?: string | null
          stock_item_id?: string | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          initial_quantity?: number | null
          notes?: string | null
          organization_id?: string
          proof_url?: string | null
          quantity?: number | null
          received_on?: string | null
          stock_item_id?: string | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_item_metrics"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "inventory_batches_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived_at: string | null
          campaign_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          interest: string | null
          notes: string | null
          organization_id: string
          owner_id: string | null
          season_id: string | null
          source: string | null
          status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interest?: string | null
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          season_id?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interest?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          season_id?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_financial_snapshots: {
        Row: {
          agent_amount: number
          agent_id: string | null
          archived_at: string | null
          breakdown: Json
          closed_at: string
          closed_by: string | null
          created_at: string
          gross_revenue: number
          gustavo_amount: number
          id: string
          inputs: Json
          lecture_id: string
          net_profit: number
          notes: string | null
          organization_id: string
          rule_id: string | null
          rule_snapshot: Json
          speaker_id: string | null
          total_advances: number
          total_card_fees: number
          total_expenses: number
          total_stock_cost: number
          updated_at: string
        }
        Insert: {
          agent_amount?: number
          agent_id?: string | null
          archived_at?: string | null
          breakdown: Json
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          gross_revenue?: number
          gustavo_amount?: number
          id?: string
          inputs: Json
          lecture_id: string
          net_profit?: number
          notes?: string | null
          organization_id: string
          rule_id?: string | null
          rule_snapshot: Json
          speaker_id?: string | null
          total_advances?: number
          total_card_fees?: number
          total_expenses?: number
          total_stock_cost?: number
          updated_at?: string
        }
        Update: {
          agent_amount?: number
          agent_id?: string | null
          archived_at?: string | null
          breakdown?: Json
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          gross_revenue?: number
          gustavo_amount?: number
          id?: string
          inputs?: Json
          lecture_id?: string
          net_profit?: number
          notes?: string | null
          organization_id?: string
          rule_id?: string | null
          rule_snapshot?: Json
          speaker_id?: string | null
          total_advances?: number
          total_card_fees?: number
          total_expenses?: number
          total_stock_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecture_financial_snapshots_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_financial_snapshots_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_financial_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_financial_snapshots_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "financial_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_topics: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lecture_id: string | null
          name: string
          organization_id: string
          position: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lecture_id?: string | null
          name: string
          organization_id: string
          position?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lecture_id?: string | null
          name?: string
          organization_id?: string
          position?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lecture_topics_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_topics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          actual_audience: number | null
          address: string | null
          agent_id: string | null
          archived_at: string | null
          audience_size: number | null
          campaign_id: string | null
          city: string | null
          closed_at: string | null
          closed_by: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          expected_audience: number | null
          financial_status: string | null
          gross_revenue: number | null
          id: string
          location: string | null
          notes: string | null
          organization_id: string
          project_id: string | null
          scheduled_at: string | null
          scheduled_time: string | null
          season_id: string | null
          speaker_id: string | null
          state: string | null
          status: string | null
          theme: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_audience?: number | null
          address?: string | null
          agent_id?: string | null
          archived_at?: string | null
          audience_size?: number | null
          campaign_id?: string | null
          city?: string | null
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_audience?: number | null
          financial_status?: string | null
          gross_revenue?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          organization_id: string
          project_id?: string | null
          scheduled_at?: string | null
          scheduled_time?: string | null
          season_id?: string | null
          speaker_id?: string | null
          state?: string | null
          status?: string | null
          theme?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_audience?: number | null
          address?: string | null
          agent_id?: string | null
          archived_at?: string | null
          audience_size?: number | null
          campaign_id?: string | null
          city?: string | null
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_audience?: number | null
          financial_status?: string | null
          gross_revenue?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          scheduled_at?: string | null
          scheduled_time?: string | null
          season_id?: string | null
          speaker_id?: string | null
          state?: string | null
          status?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lectures_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived_at: string | null
          body: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          amount: number | null
          archived_at: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          expected_close: string | null
          id: string
          lead_id: string | null
          next_step: string | null
          notes: string | null
          organization_id: string
          probability: number | null
          stage: string | null
          status: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number | null
          archived_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_close?: string | null
          id?: string
          lead_id?: string | null
          next_step?: string | null
          notes?: string | null
          organization_id: string
          probability?: number | null
          stage?: string | null
          status?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number | null
          archived_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_close?: string | null
          id?: string
          lead_id?: string | null
          next_step?: string | null
          notes?: string | null
          organization_id?: string
          probability?: number | null
          stage?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_onboarding: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          completed_steps: Json
          created_at: string
          created_by: string | null
          current_step: number
          id: string
          organization_id: string
          progress_percent: number
          started_at: string | null
          status: string
          total_steps: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          completed_steps?: Json
          created_at?: string
          created_by?: string | null
          current_step?: number
          id?: string
          organization_id: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          total_steps?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          completed_steps?: Json
          created_at?: string
          created_by?: string | null
          current_step?: number
          id?: string
          organization_id?: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          total_steps?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          agent_share: number
          brand_image_url: string | null
          city: string | null
          created_at: string
          created_by: string | null
          default_card_fee_percent: number
          description: string | null
          display_name: string | null
          email: string | null
          enabled_modules: Json
          finance_notes: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          max_installments: number
          operation_type: string | null
          organization_id: string
          owner_name: string | null
          payment_methods: Json
          phone: string | null
          preferences: Json
          primary_color: string | null
          secondary_color: string | null
          speaker_share: number
          state: string | null
          tithe_percent: number
          trade_name: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          agent_share?: number
          brand_image_url?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          default_card_fee_percent?: number
          description?: string | null
          display_name?: string | null
          email?: string | null
          enabled_modules?: Json
          finance_notes?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          max_installments?: number
          operation_type?: string | null
          organization_id: string
          owner_name?: string | null
          payment_methods?: Json
          phone?: string | null
          preferences?: Json
          primary_color?: string | null
          secondary_color?: string | null
          speaker_share?: number
          state?: string | null
          tithe_percent?: number
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          agent_share?: number
          brand_image_url?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          default_card_fee_percent?: number
          description?: string | null
          display_name?: string | null
          email?: string | null
          enabled_modules?: Json
          finance_notes?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          max_installments?: number
          operation_type?: string | null
          organization_id?: string
          owner_name?: string | null
          payment_methods?: Json
          phone?: string | null
          preferences?: Json
          primary_color?: string | null
          secondary_color?: string | null
          speaker_share?: number
          state?: string | null
          tithe_percent?: number
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          display_order: number
          features: Json
          highlight: boolean
          id: string
          is_trial_default: boolean
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
          status: string
          trial_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          display_order?: number
          features?: Json
          highlight?: boolean
          id?: string
          is_trial_default?: boolean
          limits?: Json
          name: string
          price_monthly?: number
          price_yearly?: number
          status?: string
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          display_order?: number
          features?: Json
          highlight?: boolean
          id?: string
          is_trial_default?: boolean
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
          status?: string
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          default_trial_days: number
          gateway: string | null
          id: string
          settings: Json
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          default_trial_days?: number
          gateway?: string | null
          id?: string
          settings?: Json
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          default_trial_days?: number
          gateway?: string | null
          id?: string
          settings?: Json
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived_at: string | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string | null
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          season_id: string | null
          starts_on: string | null
          status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          season_id?: string | null
          starts_on?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          season_id?: string | null
          starts_on?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
            foreignKeyName: "projects_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_projects: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          priority: number | null
          status: string | null
          summary: string | null
          target_quarter: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          priority?: number | null
          status?: string | null
          summary?: string | null
          target_quarter?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          priority?: number | null
          status?: string | null
          summary?: string | null
          target_quarter?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      season_snapshots: {
        Row: {
          agents_count: number
          archived_at: string | null
          companies_count: number
          created_at: string
          created_by: string | null
          expenses: number
          id: string
          lectures_count: number
          notes: string | null
          organization_id: string
          payload: Json | null
          people_impacted: number
          profit: number
          revenue: number
          season_id: string
          stock_movements_count: number
          taken_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agents_count?: number
          archived_at?: string | null
          companies_count?: number
          created_at?: string
          created_by?: string | null
          expenses?: number
          id?: string
          lectures_count?: number
          notes?: string | null
          organization_id: string
          payload?: Json | null
          people_impacted?: number
          profit?: number
          revenue?: number
          season_id: string
          stock_movements_count?: number
          taken_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agents_count?: number
          archived_at?: string | null
          companies_count?: number
          created_at?: string
          created_by?: string | null
          expenses?: number
          id?: string
          lectures_count?: number
          notes?: string | null
          organization_id?: string
          payload?: Json | null
          people_impacted?: number
          profit?: number
          revenue?: number
          season_id?: string
          stock_movements_count?: number
          taken_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "season_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string | null
          id: string
          name: string
          organization_id: string
          starts_on: string | null
          status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          name: string
          organization_id: string
          starts_on?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          organization_id?: string
          starts_on?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          archived_at: string | null
          average_cost: number | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          min_quantity: number | null
          name: string
          notes: string | null
          organization_id: string
          photo_url: string | null
          purchase_price: number | null
          sku: string | null
          status: string | null
          supplier: string | null
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          average_cost?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          min_quantity?: number | null
          name: string
          notes?: string | null
          organization_id: string
          photo_url?: string | null
          purchase_price?: number | null
          sku?: string | null
          status?: string | null
          supplier?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          average_cost?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          min_quantity?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          photo_url?: string | null
          purchase_price?: number | null
          sku?: string | null
          status?: string | null
          supplier?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          archived_at: string | null
          batch_id: string | null
          created_at: string
          created_by: string | null
          direction: string | null
          id: string
          kind: string | null
          lecture_id: string | null
          notes: string | null
          occurs_at: string | null
          occurs_on: string | null
          organization_id: string
          project_id: string | null
          quantity: number | null
          reason: string | null
          season_id: string | null
          status: string | null
          stock_item_id: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string | null
          id?: string
          kind?: string | null
          lecture_id?: string | null
          notes?: string | null
          occurs_at?: string | null
          occurs_on?: string | null
          organization_id: string
          project_id?: string | null
          quantity?: number | null
          reason?: string | null
          season_id?: string | null
          status?: string | null
          stock_item_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string | null
          id?: string
          kind?: string | null
          lecture_id?: string | null
          notes?: string | null
          occurs_at?: string | null
          occurs_on?: string | null
          organization_id?: string
          project_id?: string | null
          quantity?: number | null
          reason?: string | null
          season_id?: string | null
          status?: string | null
          stock_item_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_item_metrics"
            referencedColumns: ["stock_item_id"]
          },
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          from_plan_id: string | null
          from_status: string | null
          id: string
          organization_id: string
          payload: Json
          source: string
          subscription_id: string | null
          to_plan_id: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          from_plan_id?: string | null
          from_status?: string | null
          id?: string
          organization_id: string
          payload?: Json
          source?: string
          subscription_id?: string | null
          to_plan_id?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          from_plan_id?: string | null
          from_status?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          source?: string
          subscription_id?: string | null
          to_plan_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          contracted_price: number | null
          created_at: string
          created_by: string | null
          currency: string
          ends_at: string | null
          external_reference: string | null
          gateway: string | null
          gateway_checkout_url: string | null
          gateway_customer_id: string | null
          gateway_invoice_id: string | null
          gateway_metadata: Json
          gateway_payment_id: string | null
          gateway_payment_status: string | null
          gateway_subscription_id: string | null
          id: string
          next_renewal_at: string | null
          notes: string | null
          organization_id: string
          period: string
          plan_id: string | null
          started_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          contracted_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_at?: string | null
          external_reference?: string | null
          gateway?: string | null
          gateway_checkout_url?: string | null
          gateway_customer_id?: string | null
          gateway_invoice_id?: string | null
          gateway_metadata?: Json
          gateway_payment_id?: string | null
          gateway_payment_status?: string | null
          gateway_subscription_id?: string | null
          id?: string
          next_renewal_at?: string | null
          notes?: string | null
          organization_id: string
          period?: string
          plan_id?: string | null
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          contracted_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_at?: string | null
          external_reference?: string | null
          gateway?: string | null
          gateway_checkout_url?: string | null
          gateway_customer_id?: string | null
          gateway_invoice_id?: string | null
          gateway_metadata?: Json
          gateway_payment_id?: string | null
          gateway_payment_status?: string | null
          gateway_subscription_id?: string | null
          id?: string
          next_renewal_at?: string | null
          notes?: string | null
          organization_id?: string
          period?: string
          plan_id?: string | null
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_settlements: {
        Row: {
          amount_paid: number
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          paid_on: string
          payment_method: string | null
          receipt_number: string | null
          season_id: string | null
          supplier: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_paid: number
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          paid_on?: string
          payment_method?: string | null
          receipt_number?: string | null
          season_id?: string | null
          supplier: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_paid?: number
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          paid_on?: string
          payment_method?: string | null
          receipt_number?: string | null
          season_id?: string | null
          supplier?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_settlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_settlements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      taggings: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          tag_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          tag_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          tag_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taggings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taggings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          archived_at: string | null
          body: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string | null
          occurs_at: string
          organization_id: string
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string | null
          occurs_at?: string
          organization_id: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string | null
          occurs_at?: string
          organization_id?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string | null
          organization_id: string | null
          route: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          organization_id?: string | null
          route?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          organization_id?: string | null
          route?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      stock_item_metrics: {
        Row: {
          last_movement_at: string | null
          organization_id: string | null
          stock_item_id: string | null
          total_purchased: number | null
          total_used: number | null
          total_used_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      compute_stock_avg_cost: { Args: { p_item: string }; Returns: number }
    }
    Enums: {
      org_role: "owner" | "admin" | "member" | "viewer"
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
      org_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
