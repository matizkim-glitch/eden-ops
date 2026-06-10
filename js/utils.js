// js/utils.js
// Shared utility functions, formatters, and global UI helpers

(function() {
  const utils = {
    // 1. Toast Notification System
    showToast: function(message, type = 'success') {
      // Check if showToast component is registered, otherwise use DOM fallback
      if (window.toastComponent) {
        window.toastComponent.show(message, type);
        return;
      }

      // DOM fallback toast
      const toastContainer = document.getElementById('toast-container') || (() => {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
        return container;
      })();

      const toast = document.createElement('div');
      toast.className = `px-6 py-3 rounded-full shadow-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-auto
        ${type === 'success' ? 'bg-primary text-white' : ''}
        ${type === 'error' ? 'bg-red-600 text-white' : ''}
        ${type === 'warning' ? 'bg-yellow-500 text-black' : ''}
        ${type === 'info' ? 'bg-blue-600 text-white' : ''}`;
      
      const icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'info'));
      const iconEl = document.createElement('span');
      iconEl.className = 'material-symbols-outlined text-base';
      iconEl.textContent = icon;
      const messageEl = document.createElement('span');
      messageEl.textContent = String(message ?? '');
      toast.append(iconEl, messageEl);
      
      toastContainer.appendChild(toast);
      
      // Trigger animations
      setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
      }, 50);

      // Remove after timeout
      setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },

    // 2. Modal Confirmation System
    showConfirmModal: function(title, message, onConfirm) {
      if (window.modalComponent) {
        window.modalComponent.showConfirm(title, message, onConfirm);
        return;
      }
      
      // Fallback native confirm if custom modal is not present
      if (confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    },

    // 3. Formatters
    formatKES: function(amount) {
      const val = parseFloat(amount || 0);
      return 'KES ' + val.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    formatDate: function(dateStr) {
      if (!dateStr) return 'N/A';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    formatDateTime: function(dateTimeStr) {
      if (!dateTimeStr) return 'N/A';
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return dateTimeStr;
      return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    },

    // 4. LocalDB helpers for offline mode
    getOfflineQueue: function() {
      const q = localStorage.getItem('eden_offline_queue');
      return q ? JSON.parse(q) : [];
    },

    addToOfflineQueue: function(operation, table, payload) {
      const queue = this.getOfflineQueue();
      queue.push({ operation, table, payload, timestamp: new Date().getTime() });
      localStorage.setItem('eden_offline_queue', JSON.stringify(queue));
      this.showToast('Data saved locally (offline mode)', 'warning');
    },

    clearOfflineQueue: function() {
      localStorage.removeItem('eden_offline_queue');
    },

    escapeHTML: function(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]);
    }
  };

  window.edenUtils = utils;
})();
