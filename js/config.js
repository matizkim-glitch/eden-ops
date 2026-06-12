// js/config.js
// Global configuration variables for Eden Recyclers BOS.
// Production config must be supplied by deployment/build tooling. Browser storage
// overrides are allowed only for explicit local development.

const isLocalDevHost = ['127.0.0.1', 'localhost', ''].includes(window.location.hostname);
const allowLocalConfigOverride = isLocalDevHost && localStorage.getItem('eden_allow_config_override') === 'true';
const envConfig = window.ENV || {};

window.SUPABASE_URL = envConfig.SUPABASE_URL || (allowLocalConfigOverride ? localStorage.getItem('supabase_url') : '') || '';
window.SUPABASE_ANON_KEY = envConfig.SUPABASE_ANON_KEY || (allowLocalConfigOverride ? localStorage.getItem('supabase_anon_key') : '') || '';
window.SUPABASE_REDIRECT_URL = envConfig.SUPABASE_REDIRECT_URL || window.location.origin;
window.EDEN_IS_LOCAL_DEV = isLocalDevHost;
window.EDEN_CONFIG_READY = Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);
window.EDEN_ALLOW_MOCK_AUTH = isLocalDevHost && !window.EDEN_CONFIG_READY;

if (window.EDEN_DEBUG) {
  console.log('Eden Recyclers Config Loaded.', {
    localDev: window.EDEN_IS_LOCAL_DEV,
    configReady: window.EDEN_CONFIG_READY,
    mockAuth: window.EDEN_ALLOW_MOCK_AUTH
  });
}
