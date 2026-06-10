// js/config.js
// Global configuration variables for Eden Recyclers BOS.
// Production config must be supplied by deployment/build tooling. Browser storage
// overrides are allowed only for explicit local development.

const isLocalDevHost = ['127.0.0.1', 'localhost', ''].includes(window.location.hostname);
const allowLocalConfigOverride = isLocalDevHost && localStorage.getItem('eden_allow_config_override') === 'true';

window.SUPABASE_URL = allowLocalConfigOverride
  ? (localStorage.getItem('supabase_url') || 'https://your-project.supabase.co')
  : 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = allowLocalConfigOverride
  ? (localStorage.getItem('supabase_anon_key') || 'your-anon-key')
  : 'your-anon-key';
window.EDEN_IS_LOCAL_DEV = isLocalDevHost;
window.EDEN_ALLOW_MOCK_AUTH = isLocalDevHost && window.SUPABASE_ANON_KEY === 'your-anon-key';

console.log('Eden Recyclers Config Loaded.', {
  supabaseUrl: window.SUPABASE_URL,
  localDev: window.EDEN_IS_LOCAL_DEV,
  mockAuth: window.EDEN_ALLOW_MOCK_AUTH
});
