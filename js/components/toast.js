// js/components/toast.js
// Handles toast notification renders

(function() {
  const toastComponent = {
    container: null,

    init: function() {
      if (document.getElementById('eden-toast-container')) return;
      const el = document.createElement('div');
      el.id = 'eden-toast-container';
      el.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(el);
      this.container = el;
    },

    show: function(message, type = 'success') {
      if (!this.container) this.init();
      
      const toast = document.createElement('div');
      toast.className = `px-6 py-3 rounded-full shadow-lg font-semibold text-sm flex items-center gap-2 pointer-events-auto transition-all duration-300 transform translate-y-4 opacity-0
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
      
      this.container.appendChild(toast);
      
      // Trigger animation
      setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
      }, 50);

      // Auto dismiss
      setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    toastComponent.init();
    window.toastComponent = toastComponent;
  });
})();
