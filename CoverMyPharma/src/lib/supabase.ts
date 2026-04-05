import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types for TypeScript
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth0_id: string;
          email: string;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth0_id: string;
          email: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth0_id?: string;
          email?: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      medical_documents: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          file_size: number;
          uploaded_at: string;
          drug_name: string | null;
          conditions: string | null;
          prior_auth_required: string | null;
          clinical_criteria: string | null;
          diagnosis_codes: string | null;
          effective_date: string | null;
          raw_extracted_data: any;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          file_size: number;
          uploaded_at?: string;
          drug_name?: string | null;
          conditions?: string | null;
          prior_auth_required?: string | null;
          clinical_criteria?: string | null;
          diagnosis_codes?: string | null;
          effective_date?: string | null;
          raw_extracted_data?: any;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          file_size?: number;
          uploaded_at?: string;
          drug_name?: string | null;
          conditions?: string | null;
          prior_auth_required?: string | null;
          clinical_criteria?: string | null;
          diagnosis_codes?: string | null;
          effective_date?: string | null;
          raw_extracted_data?: any;
        };
      };
    };
  };
}
