// js/supabase-client.js
// Initializes the Supabase client using settings in config.js

(function() {
  if (!window.EDEN_CONFIG_READY) {
    if (window.EDEN_ALLOW_MOCK_AUTH) {
      if (window.EDEN_DEBUG) console.info('Supabase config not supplied; local mock mode is active.');
      return;
    }
    console.error('Supabase configuration is missing. Provide window.ENV.SUPABASE_URL and window.ENV.SUPABASE_ANON_KEY before js/config.js.');
    return;
  }

  if (typeof supabase === 'undefined') {
    console.error('Supabase SDK not loaded! Please make sure to include the Supabase CDN script in your HTML.');
    return;
  }

  // Create client
  try {
    window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    if (window.EDEN_DEBUG) console.info('Supabase client initialized successfully.');
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
  }
})();
