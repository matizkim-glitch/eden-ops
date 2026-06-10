// js/notifications.js
// Handles real-time notifications loading, badge updates, and popovers

(function() {
  const notificationsSystem = {
    bellEl: null,
    badgeEl: null,
    popoverEl: null,
    unreadCount: 0,
    notifications: [],

    init: function() {
      document.addEventListener('DOMContentLoaded', () => {
        if (!window.appState.user.isLoggedIn) return;
        this.injectBellIcon();
        this.loadNotifications();
        this.subscribeToRealtime();
      });
    },

    injectBellIcon: function() {
      // Find the user profile image parent container in the header
      const headerRight = Array.from(document.querySelectorAll('header .flex.items-center.gap-md, header .flex.items-center.gap-sm'))
          .filter(el => !el.matches('[data-eden-brand]') && !el.querySelector('[data-eden-brand]')).pop()
        || Array.from(document.querySelectorAll('header .flex.items-center')).filter(el => !el.matches('[data-eden-brand]') && !el.querySelector('[data-eden-brand]')).pop()
        || document.querySelector('header > div')
        || document.querySelector('header');
      if (!headerRight) return;

      // Remove static/duplicate notification buttons in legacy page headers before inserting one managed bell.
      headerRight.querySelectorAll('#notification-bell').forEach((bell, index) => {
        if (index > 0) bell.remove();
      });
      const existingManagedBell = headerRight.querySelector('#notification-bell');
      if (existingManagedBell) {
        this.bellEl = existingManagedBell;
        this.badgeEl = existingManagedBell.querySelector('#notification-badge');
        return;
      }
      headerRight.querySelectorAll('button, div').forEach(el => {
        if (el.closest('#notification-bell')) return;
        const icon = el.querySelector?.('.material-symbols-outlined');
        const text = icon?.textContent?.trim();
        const title = (el.getAttribute('title') || el.getAttribute('aria-label') || '').toLowerCase();
        if (text === 'notifications' || text === 'notifications_active' || title.includes('notification')) el.remove();
      });
      document.querySelectorAll('header .material-symbols-outlined').forEach(icon => {
        if (icon.closest('#notification-bell')) return;
        const text = icon.textContent.trim();
        if (text === 'notifications' || text === 'notifications_active') icon.remove();
      });

      const bellWrapper = document.createElement('div');
      bellWrapper.id = 'notification-bell';
      bellWrapper.className = 'relative cursor-pointer hover:bg-surface-container rounded-full p-2 flex items-center justify-center transition-all';
      bellWrapper.title = 'Notifications';
      bellWrapper.innerHTML = `
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">notifications</span>
        <span id="notification-badge" class="hidden absolute top-0.5 right-0.5 w-4.5 h-4.5 bg-error text-on-error text-[9px] font-bold rounded-full flex items-center justify-center border border-white">0</span>
      `;

      // Insert bell before the user profile picture
      const profileContainer = headerRight.querySelector('img, .w-8.h-8, .w-10.h-10');
      if (profileContainer) {
        headerRight.insertBefore(bellWrapper, profileContainer);
      } else {
        headerRight.appendChild(bellWrapper);
      }

      this.bellEl = bellWrapper;
      this.badgeEl = bellWrapper.querySelector('#notification-badge');

      // Click to toggle popover
      bellWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePopover();
      });

      // Close popover when clicking anywhere else
      document.addEventListener('click', () => {
        this.hidePopover();
      });
    },

    loadNotifications: async function() {
      const isMock = window.authManager.isMockMode();
      const userId = window.appState.user.id;

      if (isMock) {
        // Load mock notifications from local storage
        const mockNotifs = localStorage.getItem(`eden_notifications_${userId}`);
        this.notifications = (mockNotifs ? JSON.parse(mockNotifs) : this.getInitialMockNotifications()).map(n => this.normalizeNotification(n));
        this.renderBadge();
        return;
      }

      // Fetch from Supabase
      try {
        const { data, error } = await window.supabaseClient
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        this.notifications = (data || []).map(n => this.normalizeNotification(n));
        this.renderBadge();
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    },

    getInitialMockNotifications: function() {
      const defaultMock = [
        { id: '1', title: 'Low Stock Alert', body: 'Refined HDPE quantities are below safety thresholds (50kg).', type: 'warning', read: false, created_at: new Date().toISOString() },
        { id: '2', title: 'Route Scheduled', body: 'Waste collection route Greenwood Academy is assigned to you today.', type: 'info', read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: '3', title: 'Payment Confirmed', body: 'Invoice INV-2026-003 of KES 45,000 paid by Greenwood.', type: 'success', read: true, created_at: new Date(Date.now() - 86400000).toISOString() }
      ];
      localStorage.setItem(`eden_notifications_${window.appState.user.id}`, JSON.stringify(defaultMock));
      return defaultMock;
    },

    renderBadge: function() {
      this.notifications = this.notifications.map(n => this.normalizeNotification(n));
      this.unreadCount = this.notifications.filter(n => !n.read).length;
      if (this.unreadCount > 0) {
        this.badgeEl.innerText = this.unreadCount;
        this.badgeEl.classList.remove('hidden');
      } else {
        this.badgeEl.classList.add('hidden');
      }
    },

    togglePopover: function() {
      if (this.popoverEl && !this.popoverEl.classList.contains('hidden')) {
        this.hidePopover();
        return;
      }
      this.showPopover();
    },

    showPopover: function() {
      if (!this.popoverEl) {
        const popover = document.createElement('div');
        popover.id = 'notification-popover';
        popover.className = 'absolute top-16 right-4 w-80 bg-white border border-outline-variant rounded-2xl shadow-xl z-[250] flex flex-col overflow-hidden max-h-96 animate-fade-in';
        document.body.appendChild(popover);
        this.popoverEl = popover;
        
        // Prevent click inside popover from closing it
        popover.addEventListener('click', (e) => e.stopPropagation());
      }

      this.popoverEl.classList.remove('hidden');
      this.renderList();
    },

    hidePopover: function() {
      if (this.popoverEl) {
        this.popoverEl.classList.add('hidden');
      }
    },

    renderList: function() {
      let itemsHtml = '';
      if (this.notifications.length === 0) {
        itemsHtml = `
          <div class="p-6 text-center text-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-4xl block opacity-40 mb-1">notifications_off</span>
            No notifications yet
          </div>
        `;
      } else {
        this.notifications.forEach(n => {
          const safe = window.edenUtils?.escapeHTML || ((value) => String(value ?? ''));
          const icon = n.type === 'warning' ? 'warning' : (n.type === 'success' ? 'check_circle' : (n.type === 'alert' ? 'error' : 'info'));
          const colorClass = n.type === 'warning' ? 'text-yellow-500' : (n.type === 'success' ? 'text-primary' : (n.type === 'alert' ? 'text-error' : 'text-blue-500'));
          const bgUnread = n.read ? '' : 'bg-surface-container-lowest';
          const body = n.body || n.message || '';
          
          itemsHtml += `
            <div class="p-3 border-b border-outline-variant/30 flex gap-3 hover:bg-surface-container-low cursor-pointer transition-all ${bgUnread}" data-id="${n.id}">
              <span class="material-symbols-outlined ${colorClass} shrink-0 mt-0.5">${icon}</span>
              <div class="flex-1 space-y-0.5">
                <div class="flex justify-between items-start gap-1">
                  <h4 class="font-bold text-xs text-on-surface">${safe(n.title)}</h4>
                  <span class="text-[9px] text-on-surface-variant shrink-0">${safe(this.formatRelativeTime(n.created_at))}</span>
                </div>
                <p class="text-xs text-on-surface-variant leading-normal">${safe(body)}</p>
              </div>
            </div>
          `;
        });
      }

      this.popoverEl.innerHTML = `
        <div class="p-3 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
          <h3 class="font-bold text-sm">Notifications</h3>
          ${this.unreadCount > 0 ? '<button id="mark-all-read" class="text-xs text-primary font-semibold hover:underline">Mark all read</button>' : ''}
        </div>
        <div class="overflow-y-auto flex-1 max-h-80 hide-scrollbar">${itemsHtml}</div>
      `;

      // Bind mark all read
      const markAllBtn = this.popoverEl.querySelector('#mark-all-read');
      if (markAllBtn) {
        markAllBtn.addEventListener('click', () => this.markAllAsRead());
      }

      // Bind row clicks
      this.popoverEl.querySelectorAll('[data-id]').forEach(row => {
        row.addEventListener('click', () => {
          const id = row.getAttribute('data-id');
          this.markAsRead(id);
        });
      });
    },

    markAsRead: async function(id) {
      const isMock = window.authManager.isMockMode();
      
      // Update locally
      const notif = this.notifications.find(n => n.id === id);
      if (notif) notif.read = true;
      this.renderBadge();
      this.renderList();

      if (isMock) {
        localStorage.setItem(`eden_notifications_${window.appState.user.id}`, JSON.stringify(this.notifications));
        return;
      }

      try {
        await window.supabaseClient
          .from('notifications')
          .update({ read: true })
          .eq('id', id);
      } catch (err) {
        console.error('Error updating notification read state:', err);
      }
    },

    markAllAsRead: async function() {
      const isMock = window.authManager.isMockMode();
      
      this.notifications.forEach(n => n.read = true);
      this.renderBadge();
      this.renderList();

      if (isMock) {
        localStorage.setItem(`eden_notifications_${window.appState.user.id}`, JSON.stringify(this.notifications));
        return;
      }

      try {
        await window.supabaseClient
          .from('notifications')
          .update({ read: true })
          .eq('user_id', window.appState.user.id);
      } catch (err) {
        console.error('Error marking all as read:', err);
      }
    },

    subscribeToRealtime: function() {
      if (window.authManager.isMockMode()) {
        // In mock mode, we simulate background events periodically
        setInterval(() => {
          if (Math.random() > 0.8) {
            this.addMockNotification();
          }
        }, 15000);
        return;
      }

      // Supabase Postgres Realtime subscription
      try {
        const userId = window.appState.user.id;
        window.supabaseClient
          .channel(`public:notifications:user_id=eq.${userId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
            console.log('New notification received:', payload.new);
            this.notifications.unshift(payload.new);
            this.renderBadge();
            if (this.popoverEl && !this.popoverEl.classList.contains('hidden')) {
              this.renderList();
            }
            if (window.edenUtils) {
              window.edenUtils.showToast(`Notification: ${payload.new.title}`, 'info');
            }
          })
          .subscribe();
      } catch (err) {
        console.error('Realtime subscription error:', err);
      }
    },

    addMockNotification: function() {
      const titles = ['QC Alert', 'Low Inventory', 'New Maintenance scheduled', 'Invoice Overdue'];
      const bodies = [
        'Batch BATCH-20260529-001 has been sent to QC check.',
        'HDPE raw material level dropped below 50kg.',
        'Preventive maintenance scheduled for Extruder Line 1.',
        'Invoice INV-2026-004 to retail distributor is overdue by 5 days.'
      ];
      const types = ['info', 'warning', 'info', 'alert'];
      
      const idx = Math.floor(Math.random() * titles.length);
      const newNotif = {
        id: Date.now().toString(),
        title: titles[idx],
        body: bodies[idx],
        type: types[idx],
        read: false,
        created_at: new Date().toISOString()
      };

      this.notifications.unshift(newNotif);
      this.renderBadge();
      if (this.popoverEl && !this.popoverEl.classList.contains('hidden')) {
        this.renderList();
      }
      
      localStorage.setItem(`eden_notifications_${window.appState.user.id}`, JSON.stringify(this.notifications));
      if (window.edenUtils) {
        window.edenUtils.showToast(`New Notification: ${newNotif.title}`, 'info');
      }
    },

    createNotification: function({ userId, type = 'info', title, body, message, module, read = false }) {
      const targetUserId = userId || window.appState?.user?.id || 'local';
      const key = `eden_notifications_${targetUserId}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const notification = this.normalizeNotification({
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        type,
        title,
        body: body || message || '',
        module,
        read,
        created_at: new Date().toISOString()
      });
      list.unshift(notification);
      localStorage.setItem(key, JSON.stringify(list));
      if (targetUserId === (window.appState?.user?.id || 'local')) {
        this.notifications.unshift(notification);
        this.renderBadge();
        if (this.popoverEl && !this.popoverEl.classList.contains('hidden')) this.renderList();
      }
      return notification;
    },

    normalizeNotification: function(notification) {
      const allowedTypes = new Set(['alert', 'info', 'success', 'warning']);
      const rawType = String(notification?.type || 'info').toLowerCase();
      const mappedType = rawType.includes('warning') || rawType.includes('reorder') || rawType.includes('low') ? 'warning'
        : rawType.includes('success') || rawType.includes('paid') ? 'success'
        : rawType.includes('alert') || rawType.includes('urgent') || rawType.includes('error') ? 'alert'
        : rawType;
      return {
        ...notification,
        type: allowedTypes.has(mappedType) ? mappedType : 'info',
        body: notification?.body || notification?.message || '',
        title: notification?.title || 'Notification',
        read: !!notification?.read,
        created_at: notification?.created_at || new Date().toISOString()
      };
    },

    formatRelativeTime: function(isoString) {
      const date = new Date(isoString);
      const seconds = Math.floor((new Date() - date) / 1000);
      
      let interval = Math.floor(seconds / 31536000);
      if (interval >= 1) return interval + 'y ago';
      
      interval = Math.floor(seconds / 2592000);
      if (interval >= 1) return interval + 'mo ago';
      
      interval = Math.floor(seconds / 86400);
      if (interval >= 1) return interval + 'd ago';
      
      interval = Math.floor(seconds / 3600);
      if (interval >= 1) return interval + 'h ago';
      
      interval = Math.floor(seconds / 60);
      if (interval >= 1) return interval + 'm ago';
      
      return 'just now';
    }
  };

  notificationsSystem.init();
  window.notificationsSystem = notificationsSystem;
})();
