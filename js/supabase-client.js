// js/supabase-client.js
// Initializes the Supabase client using settings in config.js

(function() {
  if (typeof supabase === 'undefined') {
    console.error('Supabase SDK not loaded! Please make sure to include the Supabase CDN script in your HTML.');
    return;
  }

  // Create client
  try {
    window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully.');
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
  }
})();
