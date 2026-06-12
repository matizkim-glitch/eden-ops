// js/auth.js
// Handles login, logout, password resets, and session storage

(function() {
  const MOCK_USERS = {
    'admin@eden.com': { role: 'admin', fullName: 'Alice Admin', id: 'mock-uuid-admin' },
    'manager@eden.com': { role: 'manager', fullName: 'Bob Manager', id: 'mock-uuid-manager' },
    'collector@eden.com': { role: 'collector', fullName: 'Charlie Collector', id: 'mock-uuid-collector' },
    'production@eden.com': { role: 'production', fullName: 'Dan Production', id: 'mock-uuid-production' },
    'sales@eden.com': { role: 'sales', fullName: 'Emily Sales', id: 'mock-uuid-sales' },
    'hr@eden.com': { role: 'hr', fullName: 'Frank HR', id: 'mock-uuid-hr' },
    'finance@eden.com': { role: 'finance', fullName: 'Grace Finance', id: 'mock-uuid-finance' },
    'inventory@eden.com': { role: 'inventory', fullName: 'Ivy Inventory', id: 'mock-uuid-inventory' },
    'procurement@eden.com': { role: 'procurement', fullName: 'Pete Procurement', id: 'mock-uuid-procurement' },
    'operations@eden.com': { role: 'operations', fullName: 'Oliver Operations', id: 'mock-uuid-operations' }
  };

  const authManager = {
    isMockMode: function() {
      const isLocal = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
      return !!window.EDEN_ALLOW_MOCK_AUTH && isLocal && !window.EDEN_CONFIG_READY;
    },

    login: async function(email, password) {
      if (this.isMockMode()) {
        if (window.EDEN_DEBUG) console.info('Running in Mock Auth Mode');
        const user = MOCK_USERS[email.toLowerCase()];
        if (user && password === 'password') {
          localStorage.setItem('eden_user_session', JSON.stringify({ email, ...user }));
          localStorage.setItem('eden_user_role', user.role);
          localStorage.setItem('eden_user_name', user.fullName);
          localStorage.setItem('eden_user_id', user.id);
          if (window.appState) {
            window.appState.user = { id: user.id, name: user.fullName, role: user.role, isLoggedIn: true };
          }
          return true;
        }
        return false;
      }

      // Real Supabase Auth
      try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Fetch role from profiles table
        const { data: profile, error: profileError } = await window.supabaseClient
          .from('profiles')
          .select('role, full_name')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        localStorage.setItem('eden_user_session', JSON.stringify(data.session));
        localStorage.setItem('eden_user_role', profile.role);
        localStorage.setItem('eden_user_name', profile.full_name);
        localStorage.setItem('eden_user_id', data.user.id);
        if (window.appState) {
          window.appState.user = { id: data.user.id, name: profile.full_name, role: profile.role, isLoggedIn: true };
        }
        return true;
      } catch (err) {
        if (window.EDEN_DEBUG) console.error('Supabase Login Error:', err.message);
        return false;
      }
    },

    refreshSession: async function() {
      if (this.isMockMode()) {
        const user = this.getCurrentUser();
        if (user && window.appState) {
          window.appState.user = {
            id: user.id,
            name: user.fullName || user.name,
            role: user.role,
            isLoggedIn: true
          };
        }
        return !!user;
      }
      if (!window.supabaseClient) return false;
      try {
        const { data, error } = await window.supabaseClient.auth.getSession();
        if (error || !data?.session?.user) throw error || new Error('No active session');
        const { data: profile, error: profileError } = await window.supabaseClient
          .from('profiles')
          .select('role, full_name')
          .eq('id', data.session.user.id)
          .single();
        if (profileError) throw profileError;
        localStorage.setItem('eden_user_session', JSON.stringify(data.session));
        localStorage.setItem('eden_user_role', profile.role);
        localStorage.setItem('eden_user_name', profile.full_name);
        localStorage.setItem('eden_user_id', data.session.user.id);
        if (window.appState) {
          window.appState.user = {
            id: data.session.user.id,
            name: profile.full_name,
            role: profile.role,
            isLoggedIn: true
          };
        }
        return true;
      } catch (err) {
        this.clearLocalSession();
        return false;
      }
    },

    logout: async function() {
      if (!this.isMockMode()) {
        try {
          await window.supabaseClient.auth.signOut();
        } catch (err) {
          if (window.EDEN_DEBUG) console.error('Supabase SignOut Error:', err);
        }
      }
      this.clearLocalSession();
      if ('caches' in window) {
        caches.keys().then(keys => keys.filter(key => key.startsWith('eden-bos-')).forEach(key => caches.delete(key)));
      }
      window.location.href = 'login.html';
    },

    clearLocalSession: function() {
      localStorage.removeItem('eden_user_session');
      localStorage.removeItem('eden_user_role');
      localStorage.removeItem('eden_user_name');
      localStorage.removeItem('eden_user_id');
      if (window.appState) window.appState.user = { id: null, name: 'Guest User', role: null, isLoggedIn: false };
    },

    forgotPassword: async function(email) {
      if (this.isMockMode()) {
        if (window.EDEN_DEBUG) console.info('Mock reset password requested.');
        return true;
      }
      try {
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.SUPABASE_REDIRECT_URL || window.location.origin}/reset-password.html`
        });
        if (error) throw error;
        return true;
      } catch (err) {
        if (window.EDEN_DEBUG) console.error('Reset Password Error:', err);
        return false;
      }
    },

    getRedirectPage: function(role) {
      switch (role) {
        case 'admin':
        case 'manager':
        case 'operations':
          return 'operations_overview.html';
        case 'collector':
          return 'waste_collection.html';
        case 'production':
          return 'production_monitoring.html';
        case 'sales':
          return 'sales_distribution.html';
        case 'hr':
          return 'hr_staffing.html';
        case 'finance':
          return 'finance_overview.html';
        case 'inventory':
        case 'procurement':
          return 'supplier_inventory.html';
        default:
          return 'operations_overview.html';
      }
    },

    getCurrentUser: function() {
      const sessionStr = localStorage.getItem('eden_user_session');
      if (!sessionStr) return null;
      try {
        return JSON.parse(sessionStr);
      } catch (e) {
        return null;
      }
    }
  };

  window.authManager = authManager;
})();
