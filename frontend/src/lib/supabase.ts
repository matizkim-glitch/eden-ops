import { createClient } from '@supabase/supabase-js';
import { config } from './config';

export const supabase = config.isConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
