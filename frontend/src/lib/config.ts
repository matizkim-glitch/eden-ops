export type RuntimeConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  redirectUrl: string;
  debug: boolean;
  isConfigured: boolean;
};

const readEnv = (key: string) => import.meta.env[key] || '';

export const config: RuntimeConfig = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  redirectUrl: readEnv('VITE_SUPABASE_REDIRECT_URL') || window.location.origin,
  debug: readEnv('VITE_EDEN_DEBUG') === 'true',
  isConfigured: Boolean(readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY'))
};
