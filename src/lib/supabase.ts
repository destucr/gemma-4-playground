import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client with the mandatory x-client-id header.
 * This header is required by our RLS policies to prevent data leakage.
 */
export const getSupabaseClient = (clientId: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        'x-client-id': clientId,
      },
    },
  });
};

export type DbSession = {
  id: string;
  title: string;
  model_pref: string;
  client_id: string;
  created_at: string;
  updated_at: string;
};

export type DbMessage = {
  id: string;
  session_id: string;
  client_id: string;
  role: string;
  content: string;
  experimental_attachments: unknown;
  created_at: string;
};
