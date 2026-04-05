import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DbSession = {
  id: string;
  title: string;
  model_pref: string;
  created_at: string;
  updated_at: string;
};

export type DbMessage = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  experimental_attachments: unknown;
  created_at: string;
};
