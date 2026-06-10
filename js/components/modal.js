// js/components/modal.js
// Handles modal overlays, confirmation dialogs, and skeleton states

(function() {
  const modalComponent = {
    showConfirm: function(title, message, onConfirm) {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in';
      
      // Create dialog card
      const card = document.createElement('div');
      card.className = 'bg-white rounded-2xl max-w-sm w-full border border-outline-variant shadow-xl overflow-hidden flex flex-col p-6 space-y-4';
      
      const content = document.createElement('div');
      content.className = 'flex items-start gap-3';

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined text-yellow-500 text-3xl';
      icon.textContent = 'warning';

      const copy = document.createElement('div');
      copy.className = 'space-y-1';

      const heading = document.createElement('h3');
      heading.className = 'font-bold text-lg text-on-surface';
      heading.textContent = String(title ?? '');

      const body = document.createElement('p');
      body.className = 'text-sm text-on-surface-variant';
      body.textContent = String(message ?? '');

      copy.append(heading, body);
      content.append(icon, copy);

      const actions = document.createElement('div');
      actions.className = 'flex justify-end gap-2 pt-2';

      const cancelButton = document.createElement('button');
      cancelButton.id = 'modal-cancel-btn';
      cancelButton.className = 'px-4 py-2 border border-outline-variant rounded-xl text-sm font-semibold hover:bg-surface-variant/30 active:scale-95 transition-all';
      cancelButton.textContent = 'Cancel';

      const confirmButton = document.createElement('button');
      confirmButton.id = 'modal-confirm-btn';
      confirmButton.className = 'px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all';
      confirmButton.textContent = 'Confirm';

      actions.append(cancelButton, confirmButton);
      card.append(content, actions);
      
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      
      // Close functions
      const close = () => {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 200);
      };
      
      cancelButton.addEventListener('click', close);
      confirmButton.addEventListener('click', () => {
        onConfirm();
        close();
      });
      
      // Dismiss on escape
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          close();
          window.removeEventListener('keydown', escHandler);
        }
      };
      window.addEventListener('keydown', escHandler);
    },

    showSkeleton: function(containerElement, rowsCount = 3) {
      if (!containerElement) return;
      containerElement.textContent = '';
      const skeleton = document.createElement('div');
      skeleton.className = 'space-y-3 animate-pulse';
      for (let i = 0; i < rowsCount; i++) {
        const row = document.createElement('div');
        row.className = 'h-10 bg-surface-container-high rounded-xl w-full';
        skeleton.appendChild(row);
      }
      containerElement.appendChild(skeleton);
    },

    showEmptyState: function(containerElement, message, actionText = null, actionCallback = null) {
      if (!containerElement) return;
      containerElement.textContent = '';

      const emptyState = document.createElement('div');
      emptyState.className = 'flex flex-col items-center justify-center p-8 text-center space-y-2';

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined text-on-surface-variant/50 text-5xl';
      icon.textContent = 'folder_open';

      const copy = document.createElement('p');
      copy.className = 'text-on-surface-variant text-sm font-medium';
      copy.textContent = String(message ?? '');

      emptyState.append(icon, copy);

      if (actionText && actionCallback) {
        const btn = document.createElement('button');
        btn.id = 'empty-state-action';
        btn.className = 'mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all';
        btn.textContent = String(actionText);
        btn.addEventListener('click', actionCallback);
        emptyState.appendChild(btn);
      }

      containerElement.appendChild(emptyState);
    }
  };

  window.modalComponent = modalComponent;
})();
