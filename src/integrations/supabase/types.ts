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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      auth_rate_limits: {
        Row: {
          attempt_count: number
          blocked_until: string | null
          created_at: string
          email: string | null
          id: string
          ip_address: unknown
          last_attempt: string
        }
        Insert: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address: unknown
          last_attempt?: string
        }
        Update: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: unknown
          last_attempt?: string
        }
        Relationships: []
      }
      business_credentials: {
        Row: {
          company_id: string
          created_at: string
          id: string
          password_hash: string
          updated_at: string
          username: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          password_hash: string
          updated_at?: string
          username: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          password_hash?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_users: {
        Row: {
          access_sections: Json | null
          business_id: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
          user_ref: string
        }
        Insert: {
          access_sections?: Json | null
          business_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          user_ref: string
        }
        Update: {
          access_sections?: Json | null
          business_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          user_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_name: string
          business_ref: string
          created_at: string
          email: string | null
          full_address: string | null
          gstn_number: string | null
          id: string
          industry_type: string | null
          owner_name: string | null
          phone: string | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_status:
            | Database["public"]["Enums"]["business_status"]
            | null
          updated_at: string
        }
        Insert: {
          business_name: string
          business_ref: string
          created_at?: string
          email?: string | null
          full_address?: string | null
          gstn_number?: string | null
          id?: string
          industry_type?: string | null
          owner_name?: string | null
          phone?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_status?:
            | Database["public"]["Enums"]["business_status"]
            | null
          updated_at?: string
        }
        Update: {
          business_name?: string
          business_ref?: string
          created_at?: string
          email?: string | null
          full_address?: string | null
          gstn_number?: string | null
          id?: string
          industry_type?: string | null
          owner_name?: string | null
          phone?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_status?:
            | Database["public"]["Enums"]["business_status"]
            | null
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          address_line1: string | null
          address_line2: string | null
          business_ref_no: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          gstn: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          business_ref_no?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gstn?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          business_ref_no?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gstn?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          company_id: string
          contact_person: string | null
          created_at: string
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_confirmations: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose?: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          token_hash?: string
        }
        Relationships: []
      }
      email_otps: {
        Row: {
          attempt_count: number | null
          consumed_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          otp_hash: string
        }
        Insert: {
          attempt_count?: number | null
          consumed_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          otp_hash: string
        }
        Update: {
          attempt_count?: number | null
          consumed_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
        }
        Relationships: []
      }
      gated_business_users: {
        Row: {
          access_type: string | null
          business_id: string
          created_at: string | null
          email: string
          id: string
          password_hash: string
          status: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          access_type?: string | null
          business_id: string
          created_at?: string | null
          email: string
          id?: string
          password_hash: string
          status?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          access_type?: string | null
          business_id?: string
          created_at?: string | null
          email?: string
          id?: string
          password_hash?: string
          status?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "gated_business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "gated_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      gated_businesses: {
        Row: {
          addr_line1: string
          addr_line2: string | null
          business_ref_no: string
          business_type: string
          country: string
          created_at: string | null
          email: string
          gstin: string | null
          id: string
          industry_type: string
          name: string
          payment_status: string | null
          phone: string
          pin_code: string
          state: string
          updated_at: string | null
        }
        Insert: {
          addr_line1: string
          addr_line2?: string | null
          business_ref_no: string
          business_type: string
          country: string
          created_at?: string | null
          email: string
          gstin?: string | null
          id?: string
          industry_type: string
          name: string
          payment_status?: string | null
          phone: string
          pin_code: string
          state: string
          updated_at?: string | null
        }
        Update: {
          addr_line1?: string
          addr_line2?: string | null
          business_ref_no?: string
          business_type?: string
          country?: string
          created_at?: string | null
          email?: string
          gstin?: string | null
          id?: string
          industry_type?: string
          name?: string
          payment_status?: string | null
          phone?: string
          pin_code?: string
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      password_resets: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_resets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "gated_business_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          purchase_order_id: string | null
          reference_number: string | null
          sales_order_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          purchase_order_id?: string | null
          reference_number?: string | null
          sales_order_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          purchase_order_id?: string | null
          reference_number?: string | null
          sales_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          company_id: string
          cost_price: number
          created_at: string
          description: string | null
          gst_percentage: number | null
          height_cm: number | null
          hsn_code: string | null
          id: string
          is_active: boolean
          length_cm: number | null
          max_stock_level: number | null
          min_stock_level: number
          name: string
          sku: string
          stock_quantity: number
          unit: string | null
          unit_price: number
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          category_id?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          description?: string | null
          gst_percentage?: number | null
          height_cm?: number | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          max_stock_level?: number | null
          min_stock_level?: number
          name: string
          sku: string
          stock_quantity?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          category_id?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          gst_percentage?: number | null
          height_cm?: number | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          max_stock_level?: number | null
          min_stock_level?: number
          name?: string
          sku?: string
          stock_quantity?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          otp_code: string | null
          otp_expires_at: string | null
          phone: string | null
          phone_verified: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          otp_code?: string | null
          otp_expires_at?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          otp_code?: string | null
          otp_expires_at?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          status: string
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: string
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: string
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          product_id: string
          quantity: number
          sales_order_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          product_id: string
          quantity: number
          sales_order_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          product_id?: string
          quantity?: number
          sales_order_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          customer_id: string
          delivery_date: string | null
          discount_amount: number
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: string
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          customer_id: string
          delivery_date?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          delivery_date?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          business_id: string | null
          created_at: string
          currency: string | null
          end_date: string | null
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          plan_type: Database["public"]["Enums"]["subscription_plan"] | null
          start_date: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          business_id?: string | null
          created_at?: string
          currency?: string | null
          end_date?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"] | null
          start_date?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          business_id?: string | null
          created_at?: string
          currency?: string | null
          end_date?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"] | null
          start_date?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_number: string | null
          account_type: string | null
          address: string | null
          address_line1: string | null
          address_line2: string | null
          bank_address: string | null
          bank_name: string | null
          city: string | null
          company_id: string
          contact_person: string | null
          country: string | null
          created_at: string
          credit_time: number | null
          dispatch_address_line1: string | null
          dispatch_address_line2: string | null
          dispatch_city: string | null
          dispatch_country: string | null
          dispatch_pin_code: string | null
          dispatch_state: string | null
          email: string | null
          gst_number: string | null
          id: string
          ifsc_code: string | null
          is_active: boolean
          name: string
          pan_number: string | null
          phone: string | null
          pin_code: string | null
          place_of_supply: string | null
          same_as_registered_address: boolean | null
          state: string | null
          supplier_ref: string | null
          updated_at: string
          vendor_registered_address: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          bank_address?: string | null
          bank_name?: string | null
          city?: string | null
          company_id: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_time?: number | null
          dispatch_address_line1?: string | null
          dispatch_address_line2?: string | null
          dispatch_city?: string | null
          dispatch_country?: string | null
          dispatch_pin_code?: string | null
          dispatch_state?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          name: string
          pan_number?: string | null
          phone?: string | null
          pin_code?: string | null
          place_of_supply?: string | null
          same_as_registered_address?: boolean | null
          state?: string | null
          supplier_ref?: string | null
          updated_at?: string
          vendor_registered_address?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          bank_address?: string | null
          bank_name?: string | null
          city?: string | null
          company_id?: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_time?: number | null
          dispatch_address_line1?: string | null
          dispatch_address_line2?: string | null
          dispatch_city?: string | null
          dispatch_country?: string | null
          dispatch_pin_code?: string | null
          dispatch_state?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          name?: string
          pan_number?: string | null
          phone?: string | null
          pin_code?: string | null
          place_of_supply?: string | null
          same_as_registered_address?: boolean | null
          state?: string | null
          supplier_ref?: string | null
          updated_at?: string
          vendor_registered_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_exists: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      cleanup_expired_otps: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_business_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_business_ref_no: {
        Args: { company_name: string }
        Returns: string
      }
      generate_gated_business_ref_no: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_supplier_ref: {
        Args: { company_name: string }
        Returns: string
      }
      generate_user_ref: {
        Args: { bus_id: string }
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "staff"
      business_status: "active" | "inactive" | "suspended"
      company_status: "active" | "inactive" | "suspended"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      subscription_plan: "monthly" | "yearly"
      user_role: "Admin" | "User" | "ViewOnly"
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
      app_role: ["owner", "admin", "manager", "staff"],
      business_status: ["active", "inactive", "suspended"],
      company_status: ["active", "inactive", "suspended"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      subscription_plan: ["monthly", "yearly"],
      user_role: ["Admin", "User", "ViewOnly"],
    },
  },
} as const
