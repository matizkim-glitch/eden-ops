// js/state.js
// Handles global state management for the application

(function() {
  const state = {
    user: {
      id: localStorage.getItem('eden_user_id') || null,
      name: localStorage.getItem('eden_user_name') || 'Guest User',
      role: localStorage.getItem('eden_user_role') || null,
      isLoggedIn: !!localStorage.getItem('eden_user_session')
    },
    isOnline: navigator.onLine,
    activeModule: null,

    init: function() {
      // Monitor online/offline status
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.triggerEvent('connection-change', true);
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.triggerEvent('connection-change', false);
      });
      
      this.activeModule = window.location.pathname.split('/').pop().replace('.html', '');
    },

    listeners: {},
    addEventListener: function(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    },

    triggerEvent: function(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(cb => cb(data));
      }
    }
  };

  state.init();
  window.appState = state;
})();
