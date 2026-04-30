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
      ai_audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["ai_audit_action"]
          after_data: Json | null
          before_data: Json | null
          created_at: string
          doc_kind: Database["public"]["Enums"]["pending_action_kind"] | null
          id: string
          message: string | null
          pending_action_id: string | null
          status: Database["public"]["Enums"]["ai_audit_status"]
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["ai_audit_action"]
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["pending_action_kind"] | null
          id?: string
          message?: string | null
          pending_action_id?: string | null
          status?: Database["public"]["Enums"]["ai_audit_status"]
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["ai_audit_action"]
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["pending_action_kind"] | null
          id?: string
          message?: string | null
          pending_action_id?: string | null
          status?: Database["public"]["Enums"]["ai_audit_status"]
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          related_id: string | null
          related_table: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          related_id?: string | null
          related_table?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          related_id?: string | null
          related_table?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          balance: number
          bank: string
          bank_color: string | null
          bank_logo: string | null
          branch: string | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number
          bank: string
          bank_color?: string | null
          bank_logo?: string | null
          branch?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number
          bank?: string
          bank_color?: string | null
          bank_logo?: string | null
          branch?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_id: string | null
          created_at: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["tx_kind"]
          notes: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          notes?: string | null
          occurred_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          notes?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["tx_kind"]
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          brand: Database["public"]["Enums"]["card_brand"]
          closing_day: number
          created_at: string
          credit_limit: number
          due_day: number
          id: string
          is_active: boolean
          last_digits: string | null
          name: string
          updated_at: string
          user_id: string
          variant: string | null
        }
        Insert: {
          brand?: Database["public"]["Enums"]["card_brand"]
          closing_day?: number
          created_at?: string
          credit_limit?: number
          due_day?: number
          id?: string
          is_active?: boolean
          last_digits?: string | null
          name: string
          updated_at?: string
          user_id: string
          variant?: string | null
        }
        Update: {
          brand?: Database["public"]["Enums"]["card_brand"]
          closing_day?: number
          created_at?: string
          credit_limit?: number
          due_day?: number
          id?: string
          is_active?: boolean
          last_digits?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          variant?: string | null
        }
        Relationships: []
      }
      fgts_accounts: {
        Row: {
          balance: number
          cnpj: string | null
          created_at: string
          employer: string
          id: string
          jam_month: number
          last_movement: string | null
          monthly_deposit: number
          statement_path: string | null
          status: Database["public"]["Enums"]["fgts_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          cnpj?: string | null
          created_at?: string
          employer: string
          id?: string
          jam_month?: number
          last_movement?: string | null
          monthly_deposit?: number
          statement_path?: string | null
          status?: Database["public"]["Enums"]["fgts_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          cnpj?: string | null
          created_at?: string
          employer?: string
          id?: string
          jam_month?: number
          last_movement?: string | null
          monthly_deposit?: number
          statement_path?: string | null
          status?: Database["public"]["Enums"]["fgts_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fgts_entries: {
        Row: {
          amount: number
          created_at: string
          entry_type: Database["public"]["Enums"]["fgts_entry_type"]
          fgts_account_id: string
          id: string
          notes: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          entry_type?: Database["public"]["Enums"]["fgts_entry_type"]
          fgts_account_id: string
          id?: string
          notes?: string | null
          occurred_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_type?: Database["public"]["Enums"]["fgts_entry_type"]
          fgts_account_id?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fgts_entries_fgts_account_id_fkey"
            columns: ["fgts_account_id"]
            isOneToOne: false
            referencedRelation: "fgts_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          current_amount: number
          deadline: string | null
          icon: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          deadline?: string | null
          icon?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          deadline?: string | null
          icon?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_sessions: {
        Row: {
          account_hint: string | null
          bank_account_id: string | null
          bank_hint: string | null
          closing_balance: number | null
          confirmed_count: number
          conversation_id: string | null
          created_at: string
          doc_kind: Database["public"]["Enums"]["import_doc_kind"]
          duplicate_count: number
          error_count: number
          errors: Json | null
          id: string
          message_id: string | null
          method: Database["public"]["Enums"]["import_method"] | null
          net_amount: number
          opening_balance: number | null
          pending_action_id: string | null
          period_end: string | null
          period_start: string | null
          raw_extraction: Json | null
          source_file_id: string | null
          status: Database["public"]["Enums"]["import_session_status"]
          total_count: number
          total_credits: number
          total_debits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_hint?: string | null
          bank_account_id?: string | null
          bank_hint?: string | null
          closing_balance?: number | null
          confirmed_count?: number
          conversation_id?: string | null
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["import_doc_kind"]
          duplicate_count?: number
          error_count?: number
          errors?: Json | null
          id?: string
          message_id?: string | null
          method?: Database["public"]["Enums"]["import_method"] | null
          net_amount?: number
          opening_balance?: number | null
          pending_action_id?: string | null
          period_end?: string | null
          period_start?: string | null
          raw_extraction?: Json | null
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["import_session_status"]
          total_count?: number
          total_credits?: number
          total_debits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_hint?: string | null
          bank_account_id?: string | null
          bank_hint?: string | null
          closing_balance?: number | null
          confirmed_count?: number
          conversation_id?: string | null
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["import_doc_kind"]
          duplicate_count?: number
          error_count?: number
          errors?: Json | null
          id?: string
          message_id?: string | null
          method?: Database["public"]["Enums"]["import_method"] | null
          net_amount?: number
          opening_balance?: number | null
          pending_action_id?: string | null
          period_end?: string | null
          period_start?: string | null
          raw_extraction?: Json | null
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["import_session_status"]
          total_count?: number
          total_credits?: number
          total_debits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_sessions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_sessions_pending_action_id_fkey"
            columns: ["pending_action_id"]
            isOneToOne: false
            referencedRelation: "pending_ai_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_sessions_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      import_staging_transactions: {
        Row: {
          account_hint: string | null
          amount: number
          bank_hint: string | null
          bank_transaction_id: string | null
          category_hint: string | null
          category_id: string | null
          confidence: number | null
          created_at: string
          description: string
          duplicate_of: string | null
          edited: boolean
          id: string
          is_duplicate: boolean
          kind: Database["public"]["Enums"]["tx_kind"]
          occurred_at: string | null
          position: number
          raw_data: Json | null
          raw_text: string | null
          session_id: string
          status: Database["public"]["Enums"]["import_staging_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_hint?: string | null
          amount?: number
          bank_hint?: string | null
          bank_transaction_id?: string | null
          category_hint?: string | null
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          duplicate_of?: string | null
          edited?: boolean
          id?: string
          is_duplicate?: boolean
          kind?: Database["public"]["Enums"]["tx_kind"]
          occurred_at?: string | null
          position?: number
          raw_data?: Json | null
          raw_text?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["import_staging_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_hint?: string | null
          amount?: number
          bank_hint?: string | null
          bank_transaction_id?: string | null
          category_hint?: string | null
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          duplicate_of?: string | null
          edited?: boolean
          id?: string
          is_duplicate?: boolean
          kind?: Database["public"]["Enums"]["tx_kind"]
          occurred_at?: string | null
          position?: number
          raw_data?: Json | null
          raw_text?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["import_staging_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_staging_transactions_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_staging_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_staging_transactions_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_staging_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          allocation_percent: number
          amount: number
          asset_class: Database["public"]["Enums"]["investment_class"]
          created_at: string
          id: string
          name: string
          notes: string | null
          return_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allocation_percent?: number
          amount?: number
          asset_class?: Database["public"]["Enums"]["investment_class"]
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          return_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allocation_percent?: number
          amount?: number
          asset_class?: Database["public"]["Enums"]["investment_class"]
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          return_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string
          id: string
          installment_number: number | null
          installment_total: number | null
          invoice_id: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          invoice_id: string
          occurred_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          invoice_id?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          credit_card_id: string
          due_date: string
          id: string
          pdf_path: string | null
          reference_month: string
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_card_id: string
          due_date: string
          id?: string
          pdf_path?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_card_id?: string
          due_date?: string
          id?: string
          pdf_path?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_accounts: {
        Row: {
          cet: number | null
          collateral: string | null
          contract_path: string | null
          created_at: string
          current_balance: number
          debt_type: Database["public"]["Enums"]["debt_type"]
          due_day: number
          id: string
          installments_paid: number
          installments_total: number
          institution: string
          interest_rate: number
          monthly_payment: number
          original_amount: number
          status: Database["public"]["Enums"]["debt_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cet?: number | null
          collateral?: string | null
          contract_path?: string | null
          created_at?: string
          current_balance?: number
          debt_type?: Database["public"]["Enums"]["debt_type"]
          due_day?: number
          id?: string
          installments_paid?: number
          installments_total?: number
          institution: string
          interest_rate?: number
          monthly_payment?: number
          original_amount?: number
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cet?: number | null
          collateral?: string | null
          contract_path?: string | null
          created_at?: string
          current_balance?: number
          debt_type?: Database["public"]["Enums"]["debt_type"]
          due_day?: number
          id?: string
          installments_paid?: number
          installments_total?: number
          institution?: string
          interest_rate?: number
          monthly_payment?: number
          original_amount?: number
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loan_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          interest: number | null
          loan_account_id: string
          notes: string | null
          paid_at: string
          principal: number | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          interest?: number | null
          loan_account_id: string
          notes?: string | null
          paid_at?: string
          principal?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          interest?: number | null
          loan_account_id?: string
          notes?: string | null
          paid_at?: string
          principal?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_account_id_fkey"
            columns: ["loan_account_id"]
            isOneToOne: false
            referencedRelation: "loan_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          benefits: number | null
          created_at: string
          employer: string
          fgts_amount: number | null
          gross_amount: number
          id: string
          inss: number | null
          irrf: number | null
          net_amount: number
          notes: string | null
          pdf_path: string | null
          reference_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          benefits?: number | null
          created_at?: string
          employer: string
          fgts_amount?: number | null
          gross_amount?: number
          id?: string
          inss?: number | null
          irrf?: number | null
          net_amount?: number
          notes?: string | null
          pdf_path?: string | null
          reference_month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          benefits?: number | null
          created_at?: string
          employer?: string
          fgts_amount?: number | null
          gross_amount?: number
          id?: string
          inss?: number | null
          irrf?: number | null
          net_amount?: number
          notes?: string | null
          pdf_path?: string | null
          reference_month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_ai_actions: {
        Row: {
          confirmed_at: string | null
          conversation_id: string | null
          created_at: string
          discarded_at: string | null
          id: string
          kind: Database["public"]["Enums"]["pending_action_kind"]
          message_id: string | null
          payload: Json
          source_file_id: string | null
          status: Database["public"]["Enums"]["pending_action_status"]
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          discarded_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["pending_action_kind"]
          message_id?: string | null
          payload?: Json
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["pending_action_status"]
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          discarded_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["pending_action_kind"]
          message_id?: string | null
          payload?: Json
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["pending_action_status"]
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          plan: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          plan?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          due_day: number
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["recurring_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          due_day?: number
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["recurring_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          due_day?: number
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["recurring_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          filters: Json | null
          id: string
          kind: Database["public"]["Enums"]["report_kind"]
          module: string
          pdf_path: string | null
          period: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["report_kind"]
          module: string
          pdf_path?: string | null
          period: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["report_kind"]
          module?: string
          pdf_path?: string | null
          period?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          currency: string
          hide_balances: boolean
          locale: string
          notifications_email: boolean
          notifications_push: boolean
          preferences: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          hide_balances?: boolean
          locale?: string
          notifications_email?: boolean
          notifications_push?: boolean
          preferences?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          hide_balances?: boolean
          locale?: string
          notifications_email?: boolean
          notifications_push?: boolean
          preferences?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uploaded_files: {
        Row: {
          ai_processed: boolean
          ai_summary: string | null
          bucket: string
          created_at: string
          filename: string
          id: string
          kind: Database["public"]["Enums"]["file_kind"]
          mime_type: string | null
          path: string
          related_id: string | null
          related_table: string | null
          size_bytes: number | null
          user_id: string
        }
        Insert: {
          ai_processed?: boolean
          ai_summary?: string | null
          bucket: string
          created_at?: string
          filename: string
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          mime_type?: string | null
          path: string
          related_id?: string | null
          related_table?: string | null
          size_bytes?: number | null
          user_id: string
        }
        Update: {
          ai_processed?: boolean
          ai_summary?: string | null
          bucket?: string
          created_at?: string
          filename?: string
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          mime_type?: string | null
          path?: string
          related_id?: string | null
          related_table?: string | null
          size_bytes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "checking" | "savings" | "investment" | "salary" | "other"
      ai_audit_action:
        | "extract"
        | "confirm"
        | "discard"
        | "duplicate_detected"
        | "partial_confirm"
        | "edit_before_confirm"
      ai_audit_status: "success" | "error" | "warning"
      alert_severity: "info" | "warning" | "critical"
      app_role: "admin" | "user"
      card_brand: "visa" | "mastercard" | "amex" | "elo" | "hipercard" | "other"
      debt_status: "em_dia" | "atrasado" | "renegociado" | "quitado"
      debt_type:
        | "financiamento_imovel"
        | "financiamento_veiculo"
        | "emprestimo_pessoal"
        | "consignado"
        | "cartao_rotativo"
        | "cheque_especial"
        | "renegociacao"
        | "outros"
      fgts_entry_type: "deposito" | "saque" | "jam" | "ajuste"
      fgts_status: "ativa" | "inativa" | "sacada"
      file_kind:
        | "invoice_pdf"
        | "bank_statement"
        | "payslip"
        | "fgts_statement"
        | "loan_contract"
        | "image"
        | "other"
      goal_status: "active" | "achieved" | "cancelled"
      import_doc_kind:
        | "extrato"
        | "fatura"
        | "fgts"
        | "emprestimo"
        | "contracheque"
        | "outro"
      import_method:
        | "pdf_text"
        | "pdf_ocr"
        | "image_ai"
        | "csv_parser"
        | "ofx_parser"
        | "ai_fallback"
      import_session_status:
        | "extracting"
        | "review"
        | "confirmed"
        | "discarded"
        | "failed"
      import_staging_status: "pending" | "confirmed" | "discarded" | "duplicate"
      investment_class:
        | "renda_fixa"
        | "acoes"
        | "fii"
        | "etf"
        | "cripto"
        | "fundo"
        | "previdencia"
        | "outros"
      invoice_status: "open" | "closed" | "paid" | "overdue"
      pending_action_kind:
        | "fatura"
        | "extrato"
        | "fgts"
        | "emprestimo"
        | "contracheque"
      pending_action_status: "pending" | "confirmed" | "discarded"
      recurring_status: "active" | "paused" | "cancelled"
      report_kind: "simples" | "private"
      tx_kind: "income" | "expense" | "transfer" | "investment"
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
      account_type: ["checking", "savings", "investment", "salary", "other"],
      ai_audit_action: [
        "extract",
        "confirm",
        "discard",
        "duplicate_detected",
        "partial_confirm",
        "edit_before_confirm",
      ],
      ai_audit_status: ["success", "error", "warning"],
      alert_severity: ["info", "warning", "critical"],
      app_role: ["admin", "user"],
      card_brand: ["visa", "mastercard", "amex", "elo", "hipercard", "other"],
      debt_status: ["em_dia", "atrasado", "renegociado", "quitado"],
      debt_type: [
        "financiamento_imovel",
        "financiamento_veiculo",
        "emprestimo_pessoal",
        "consignado",
        "cartao_rotativo",
        "cheque_especial",
        "renegociacao",
        "outros",
      ],
      fgts_entry_type: ["deposito", "saque", "jam", "ajuste"],
      fgts_status: ["ativa", "inativa", "sacada"],
      file_kind: [
        "invoice_pdf",
        "bank_statement",
        "payslip",
        "fgts_statement",
        "loan_contract",
        "image",
        "other",
      ],
      goal_status: ["active", "achieved", "cancelled"],
      import_doc_kind: [
        "extrato",
        "fatura",
        "fgts",
        "emprestimo",
        "contracheque",
        "outro",
      ],
      import_method: [
        "pdf_text",
        "pdf_ocr",
        "image_ai",
        "csv_parser",
        "ofx_parser",
        "ai_fallback",
      ],
      import_session_status: [
        "extracting",
        "review",
        "confirmed",
        "discarded",
        "failed",
      ],
      import_staging_status: ["pending", "confirmed", "discarded", "duplicate"],
      investment_class: [
        "renda_fixa",
        "acoes",
        "fii",
        "etf",
        "cripto",
        "fundo",
        "previdencia",
        "outros",
      ],
      invoice_status: ["open", "closed", "paid", "overdue"],
      pending_action_kind: [
        "fatura",
        "extrato",
        "fgts",
        "emprestimo",
        "contracheque",
      ],
      pending_action_status: ["pending", "confirmed", "discarded"],
      recurring_status: ["active", "paused", "cancelled"],
      report_kind: ["simples", "private"],
      tx_kind: ["income", "expense", "transfer", "investment"],
    },
  },
} as const
