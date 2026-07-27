import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export interface SupabaseAnonClientOptions {
  supabaseUrl: string;
  anonKey: string;
}

/**
 * Creates a Supabase client authenticated with the public anon key. This is
 * the only Supabase client type that is safe to use from the browser
 * (`@merkwacht/web`); it is subject to Row Level Security policies.
 */
export function createSupabaseAnonClient(options: SupabaseAnonClientOptions): SupabaseClient<Database> {
  return createClient<Database>(options.supabaseUrl, options.anonKey);
}
