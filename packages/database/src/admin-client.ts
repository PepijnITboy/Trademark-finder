import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export interface SupabaseAdminClientOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

/**
 * Creates a Supabase client authenticated with the service-role key.
 *
 * SERVER-ONLY: this client bypasses Row Level Security. Never import or
 * instantiate this in the `@merkwacht/web` app or any other browser code.
 * Only the API and worker processes should hold a service-role key.
 */
export function createSupabaseAdminClient(options: SupabaseAdminClientOptions): SupabaseClient<Database> {
  return createClient<Database>(options.supabaseUrl, options.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
