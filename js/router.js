// js/router.js
// Secures pages, wires navigation, and binds lightweight page controllers.

(function () {
  document.addEventListener('DOMContentLoaded', async () => {
    const currentPath = window.location.pathname.split('/').pop();
    const isLoginPage = currentPath === 'login.html' || currentPath === '';
    const hasVerifiedSession = await window.authManager.refreshSession();

    if (!hasVerifiedSession && !isLoginPage) {
      console.log('No active session found. Redirecting to login...');
      window.location.href = 'login.html';
      return;
    }

    if (hasVerifiedSession && isLoginPage) {
      const redirectPage = window.authManager.getRedirectPage(window.appState.user.role);
      window.location.href = redirectPage;
      return;
    }

    if (!hasVerifiedSession) return;

    registerPwaShell();
    applyDigitalShell();
    hideUnauthorizedElements();
    normalizeDepartmentNav(currentPath);
    wireLogoHome();
    cleanHeaderNavigationNoise();
    ensureContextHeader(currentPath);
    wireNavigation(currentPath);
    wireTextNavigation();
    wireProfileLogout();
    wireBackButtons();
    wireOfflineBanner();
    wireGlobalPopupDismissal();
    bindPageControllers(currentPath);
    window.setTimeout(cleanHeaderNavigationNoise, 500);
    window.setTimeout(cleanHeaderNavigationNoise, 1500);
    window.setTimeout(cleanHeaderNavigationNoise, 3000);
    window.setTimeout(cleanHeaderNavigationNoise, 5000);
    window.setTimeout(() => {
      ensureDepartmentAnalysis(currentPath);
      enhanceDataControls();
      enhanceInteractiveMotion();
      observeDataControls();
    }, 250);
    document.addEventListener('eden:content-updated', () => {
      normalizeDepartmentNav(currentPath);
      wireLogoHome();
      cleanHeaderNavigationNoise();
    });
  });

  const NAV_MAPPINGS = {
    dashboard: 'operations_overview.html',
    'operations overview': 'operations_overview.html',
    collect: 'waste_collection.html',
    'waste collection': 'waste_collection.html',
    stock: 'supplier_inventory.html',
    process: 'production_monitoring.html',
    sales: 'sales_distribution.html',
    inventory: 'supplier_inventory.html',
    production: 'production_monitoring.html',
    'sales & distribution': 'sales_distribution.html',
    'customer & crm': 'customer_crm.html',
    customer: 'customer_crm.html',
    customers: 'customer_crm.html',
    crm: 'customer_crm.html',
    'finance & debts': 'finance_overview.html',
    hr: 'hr_staffing.html',
    finance: 'finance_overview.html',
    analytics: 'sustainability_analytics.html',
    sustainability: 'sustainability_analytics.html',
    'sustainability analytics': 'sustainability_analytics.html',
    logistics: 'waste_collection.html',
    'facility map': 'facility_map.html',
    maintenance: 'maintenance_scheduling.html',
    'maintenance scheduling': 'maintenance_scheduling.html',
    infrastructure: 'infrastructure_facility.html',
    recycling: 'waste_collection.html',
    warehouse: 'supplier_inventory.html',
    inventory_2: 'supplier_inventory.html',
    precision_manufacturing: 'production_monitoring.html',
    factory: 'production_monitoring.html',
    payments: 'sales_distribution.html',
    groups: 'customer_crm.html',
    badge: 'hr_staffing.html',
    account_balance: 'finance_overview.html',
    settings_input_component: 'infrastructure_facility.html',
    local_shipping: 'waste_collection.html',
    more_horiz: '#'
  };

  const DEPARTMENT_NAV = [
    { label: 'Dashboard', icon: 'dashboard', href: 'operations_overview.html' },
    { label: 'Waste Collection', icon: 'recycling', href: 'waste_collection.html' },
    { label: 'Inventory', icon: 'warehouse', href: 'supplier_inventory.html' },
    { label: 'Production', icon: 'precision_manufacturing', href: 'production_monitoring.html' },
    { label: 'Sales & Distribution', icon: 'local_shipping', href: 'sales_distribution.html' },
    { label: 'Customer & CRM', icon: 'groups', href: 'customer_crm.html' },
    { label: 'HR', icon: 'badge', href: 'hr_staffing.html' },
    { label: 'Finance', icon: 'account_balance', href: 'finance_overview.html' },
    { label: 'Sustainability', icon: 'analytics', href: 'sustainability_analytics.html' },
    { label: 'Facility Map', icon: 'map', href: 'facility_map.html' },
    { label: 'Maintenance', icon: 'build', href: 'maintenance_scheduling.html' },
    { label: 'Infrastructure', icon: 'settings_input_component', href: 'infrastructure_facility.html' }
  ];

  function registerPwaShell() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = 'manifest.json';
      document.head.appendChild(manifest);
    }

    const themeMeta = document.querySelector('meta[name="theme-color"]') || document.createElement('meta');
    themeMeta.name = 'theme-color';
    themeMeta.content = '#006c03';
    if (!themeMeta.parentNode) document.head.appendChild(themeMeta);

    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }

  function applyDigitalShell() {
    injectDigitalShellStyles();
    document.body.classList.add('eden-digital-shell');
  }

  function injectDigitalShellStyles() {
    if (document.getElementById('eden-digital-shell-style')) return;
    const style = document.createElement('style');
    style.id = 'eden-digital-shell-style';
    style.textContent = `
      body.eden-digital-shell {
        background:
          radial-gradient(circle at 18% 12%, rgba(120,221,102,0.12), transparent 28rem),
          radial-gradient(circle at 86% 8%, rgba(128,85,51,0.08), transparent 24rem),
          linear-gradient(180deg, #f7fafc 0%, #eef3f0 100%);
      }
      body.eden-digital-shell main {
        position: relative;
      }
      body.eden-digital-shell main::before {
        content: '';
        position: fixed;
        inset: 64px 0 0 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(0,108,3,0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,108,3,0.03) 1px, transparent 1px);
        background-size: 36px 36px;
        mask-image: linear-gradient(180deg, rgba(0,0,0,0.7), transparent 70%);
        z-index: -1;
      }
      body.eden-digital-shell main section,
      body.eden-digital-shell .bento-card,
      body.eden-digital-shell .glass-card {
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.055);
      }
      body.eden-digital-shell main section {
        border-color: color-mix(in srgb, #becab6 82%, #006c03 18%);
      }
      body.eden-digital-shell header.fixed {
        backdrop-filter: blur(14px);
        background: color-mix(in srgb, #f7fafc 88%, transparent);
      }
      @media (prefers-reduced-motion: reduce) {
        body.eden-digital-shell main::before {
          background-position: 0 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  window.edenPageControllers = window.edenPageControllers || {};

  const escapeHTML = value => window.edenUtils?.escapeHTML
    ? window.edenUtils.escapeHTML(value)
    : String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

  function hideUnauthorizedElements() {
    const userRole = window.appState.user.role;
    document.querySelectorAll('[data-role-required]').forEach(el => {
      const allowedRoles = el.dataset.roleRequired.split(',').map(role => role.trim());
      if (!allowedRoles.includes(userRole)) el.style.display = 'none';
    });
  }

  function normalizeDepartmentNav(currentPath) {
    injectDepartmentSidebarStyles();
    const shellAsides = Array.from(document.querySelectorAll('aside')).filter(aside => !aside.closest('main'));
    shellAsides.forEach(aside => {
      if (aside.className.includes('lg:flex')) {
        aside.className = aside.className.replace('lg:flex', 'md:flex');
      }
      aside.classList.remove('h-screen', 'sticky');
      aside.classList.add('fixed', 'left-0', 'top-16', 'h-[calc(100vh-64px)]', 'w-80', 'z-40', 'flex-col');
      aside.classList.add('eden-digital-sidebar');
    });

    shellAsides.map(aside => aside.querySelector('nav')).filter(Boolean).forEach(nav => {
      nav.classList.add('eden-dept-nav-scroll', 'flex-1', 'overflow-y-auto');
      nav.style.overflowY = 'auto';
      nav.style.maxHeight = 'calc(100vh - 170px)';
      nav.innerHTML = DEPARTMENT_NAV.map(item => {
        const active = item.href === currentPath;
        const className = active
          ? 'flex items-center gap-md py-3 px-margin mx-2 rounded-full bg-primary-container text-on-primary-container font-bold shadow-sm'
          : 'flex items-center gap-md py-3 px-margin mx-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors';
        return `
          <a class="${className} eden-dept-link" href="${pageHref(item.href)}" style="--dept-index:${DEPARTMENT_NAV.indexOf(item)}">
            <span class="material-symbols-outlined" data-icon="${item.icon}">${item.icon}</span>
            <span class="font-label-md">${item.label}</span>
          </a>
        `;
      }).join('');
    });

    if (!shellAsides.some(aside => aside.querySelector('nav'))) {
      const sidebar = document.createElement('aside');
      sidebar.id = 'eden-department-sidebar';
      sidebar.className = 'hidden md:flex eden-digital-sidebar flex-col py-lg gap-base h-[calc(100vh-64px)] w-80 bg-surface-container-low border-r border-outline-variant fixed left-0 top-16 z-40 shadow-lg';
      sidebar.innerHTML = `
        <div class="px-margin mb-lg flex items-center gap-md">
          <div class="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
          </div>
          <div>
            <p class="font-headline-sm text-headline-sm text-primary">Departments</p>
            <p class="font-label-md text-label-md text-on-surface-variant">Eden Recyclers BOS</p>
          </div>
        </div>
        <nav class="flex-1 overflow-y-auto space-y-1">
          ${DEPARTMENT_NAV.map(item => {
            const active = item.href === currentPath;
            const className = active
              ? 'flex items-center gap-md py-3 px-margin mx-2 rounded-full bg-primary-container text-on-primary-container font-bold shadow-sm'
              : 'flex items-center gap-md py-3 px-margin mx-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors';
            return `
              <a class="${className} eden-dept-link" href="${pageHref(item.href)}" style="--dept-index:${DEPARTMENT_NAV.indexOf(item)}">
                <span class="material-symbols-outlined" data-icon="${item.icon}">${item.icon}</span>
                <span class="font-label-md">${item.label}</span>
              </a>
            `;
          }).join('')}
        </nav>
      `;
      document.body.appendChild(sidebar);
      shellAsides.push(sidebar);
    }

    const main = document.querySelector('main');
    if (main && shellAsides.length && !/\b(md|lg):ml-80\b/.test(main.className)) {
      main.classList.add('md:ml-80');
    }
  }

  function injectDepartmentSidebarStyles() {
    if (document.getElementById('eden-sidebar-style')) return;
    const style = document.createElement('style');
    style.id = 'eden-sidebar-style';
    style.textContent = `
      .eden-digital-sidebar {
        overflow: hidden;
        isolation: isolate;
        max-height: calc(100vh - 64px);
      }
      .eden-digital-sidebar:not(.fixed):not(.sticky) {
        position: relative;
      }
      .eden-digital-sidebar::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(90deg, rgba(0,108,3,0.06) 1px, transparent 1px),
          linear-gradient(0deg, rgba(0,108,3,0.045) 1px, transparent 1px);
        background-size: 28px 28px;
        animation: edenGridDrift 16s linear infinite;
        opacity: 0.65;
        z-index: -2;
      }
      .eden-digital-sidebar::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: -35%;
        height: 35%;
        pointer-events: none;
        background: linear-gradient(180deg, transparent, rgba(120,221,102,0.16), transparent);
        animation: edenScanLine 5.5s ease-in-out infinite;
        z-index: -1;
      }
      .eden-dept-link {
        position: relative;
        overflow: hidden;
        animation: edenNavEnter 420ms ease both;
        animation-delay: calc(var(--dept-index, 0) * 28ms);
      }
      .eden-dept-link::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        transform: translateX(-120%);
        transition: transform 420ms ease;
      }
      .eden-dept-link:hover::after,
      .eden-dept-link:focus-visible::after {
        transform: translateX(120%);
      }
      .eden-dept-link .material-symbols-outlined {
        transition: transform 180ms ease, color 180ms ease;
      }
      .eden-dept-link:hover .material-symbols-outlined {
        transform: translateX(2px) scale(1.06);
      }
      .eden-dept-nav-scroll {
        min-height: 0;
        max-height: calc(100vh - 170px);
        overflow-y: auto !important;
        scrollbar-width: thin;
        scrollbar-color: rgba(0,108,3,0.32) transparent;
        padding-bottom: 1rem;
      }
      .eden-dept-nav-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .eden-dept-nav-scroll::-webkit-scrollbar-thumb {
        background: rgba(0,108,3,0.28);
        border-radius: 999px;
      }
      .eden-brand-lockup {
        display: inline-flex;
        align-items: center;
      }
      header .eden-header-brand-left {
        order: -20;
        margin-right: auto;
        flex-shrink: 0;
      }
      .eden-logo-img {
        display: block;
        width: clamp(8.75rem, 15vw, 12rem);
        max-width: 46vw;
        height: auto;
        object-fit: contain;
      }
      aside .eden-logo-img {
        width: 11.5rem;
      }
      @keyframes edenGridDrift {
        from { background-position: 0 0, 0 0; }
        to { background-position: 56px 56px, 56px 56px; }
      }
      @keyframes edenScanLine {
        0%, 100% { transform: translateY(0); opacity: 0; }
        18%, 78% { opacity: 1; }
        50% { transform: translateY(380%); }
      }
      @keyframes edenNavEnter {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .eden-digital-sidebar::before,
        .eden-digital-sidebar::after,
        .eden-dept-link {
          animation: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureHeaderQuickNav(currentPath) {
    const header = document.querySelector('header');
    if (!header || header.querySelector('[data-eden-quick-nav]')) return;
    if (header.innerText.includes('Dashboard') && header.innerText.includes('Logistics')) return;

    const rightCluster = getHeaderRightCluster(header);
    if (!rightCluster) return;

    const nav = document.createElement('div');
    nav.dataset.edenQuickNav = 'true';
    nav.className = 'hidden md:flex gap-lg items-center text-on-surface-variant font-label-md';
    const quickLinks = [
      { label: 'Dashboard', href: 'operations_overview.html' },
      { label: 'Logistics', href: 'waste_collection.html' },
      { label: 'Analytics', href: 'sustainability_analytics.html' }
    ];
    nav.innerHTML = quickLinks.map(item => {
      const active = item.href === currentPath;
      return `<button type="button" class="${active ? 'text-primary font-bold' : 'hover:bg-surface-container-low'} transition-colors px-2 py-1 rounded" data-nav-target="${item.href}">${item.label}</button>`;
    }).join('');
    nav.querySelectorAll('[data-nav-target]').forEach(button => {
      button.addEventListener('click', () => { navigateTo(button.dataset.navTarget); });
    });
    rightCluster.insertBefore(nav, rightCluster.firstChild);
  }

  function wireLogoHome() {
    standardizeEdenBrand();
    positionHeaderBrandLeft();
    const homeTargets = [
      ...document.querySelectorAll('aside [data-eden-brand], header [data-eden-brand], aside .material-symbols-outlined, aside h1, header img[alt*="Eden"], header .material-symbols-outlined, header h1')
    ].filter(el => {
      const text = el.innerText.trim().toLowerCase();
      const alt = (el.getAttribute('alt') || '').toLowerCase();
      return el.dataset.edenBrand || text === 'eco' || text.includes('eden recyclers') || alt.includes('eden recyclers');
    });

    homeTargets.forEach(el => {
      if (el.dataset.logoHomeBound) return;
      el.dataset.logoHomeBound = 'true';
      el.title = 'Go to Operations Overview';
      el.style.cursor = 'pointer';
      el.addEventListener('click', event => {
        event.preventDefault();
        navigateTo('operations_overview.html');
      });
    });
  }

  function standardizeEdenBrand() {
    document.querySelectorAll('header img[alt*="Eden"], header img[alt*="Logo"], aside img[alt*="Eden"], aside img[alt*="Logo"]').forEach(img => {
      const parent = img.parentElement;
      if (!parent || parent.dataset.edenBrandStandardized) return;
      parent.dataset.edenBrandStandardized = 'true';
      parent.dataset.edenBrand = 'true';
      parent.classList.add('cursor-pointer', 'eden-brand-lockup');
      parent.innerHTML = `
        ${edenLogoMarkup(parent.tagName !== 'A')}
      `;
    });

    const header = document.querySelector('header');
    const existingBrand = header?.querySelector('[data-eden-brand]');
    if (existingBrand && !existingBrand.querySelector('.eden-logo-img')) {
      existingBrand.innerHTML = edenLogoMarkup(existingBrand.tagName !== 'A');
    }
    if (!header || existingBrand) return;
    const firstCluster = header.querySelector('.flex.items-center');
    const title = firstCluster?.querySelector('h1, h2, h3');
    if (!firstCluster || !title) return;
    const pageLabel = title.textContent.trim();
    firstCluster.dataset.edenHeaderCluster = 'true';
    firstCluster.innerHTML = `
      <div class="flex items-center gap-base shrink-0" data-eden-brand="true">
        ${edenLogoMarkup(true)}
      </div>
      <span class="hidden sm:block h-6 w-px bg-outline-variant"></span>
      <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold truncate">${pageLabel}</h2>
    `;
  }

  function positionHeaderBrandLeft() {
    const header = document.querySelector('header');
    const brand = header?.querySelector('[data-eden-brand]');
    if (!header || !brand) return;
    header.querySelectorAll('[data-eden-brand]').forEach(other => {
      if (other !== brand && !other.contains(brand)) other.remove();
    });
    const brandHolder = brand.closest('.eden-brand-lockup') || brand;
    brandHolder.classList.add('eden-header-brand-left');
    const headerShell = Array.from(header.children).find(child =>
      child !== brandHolder && child.classList?.contains('h-full')
    ) || brandHolder.closest('header > div') || header;
    if (brandHolder.parentElement !== headerShell) {
      headerShell.insertBefore(brandHolder, headerShell.firstElementChild);
    } else {
      const firstChild = Array.from(headerShell.children).find(child => !child.matches('script, style'));
      if (firstChild && firstChild !== brandHolder && !brandHolder.contains(firstChild)) {
        headerShell.insertBefore(brandHolder, firstChild);
      }
    }
    brandHolder.dataset.edenHeaderPositioned = 'true';
  }

  function cleanHeaderNavigationNoise() {
    const header = document.querySelector('header');
    if (!header) return;
    if (!header.dataset.edenCleanObserver) {
      header.dataset.edenCleanObserver = 'true';
      const observer = new MutationObserver(() => {
        if (header.dataset.edenCleaning === 'true') return;
        window.clearTimeout(window.__edenHeaderCleanTimer);
        window.__edenHeaderCleanTimer = window.setTimeout(cleanHeaderNavigationNoise, 80);
      });
      observer.observe(header, { childList: true, subtree: true });
    }
    header.dataset.edenCleaning = 'true';
    const duplicateLabels = new Set(DEPARTMENT_NAV.map(item => item.label.toLowerCase()));
    const noisyActions = ['add', 'new ', 'export', 'orders', 'invoices', 'requests', 'diagnostics', 'route', 'schools', 'collections', 'segments', 'analytics', 'qc log', 'facility map', 'waste collection', 'inventory'];
    header.querySelectorAll('button, a').forEach(el => {
      if (el.closest('#notification-bell') || el.dataset.crossAnalysis === 'true') return;
      const text = el.innerText.trim().replace(/\s+/g, ' ').toLowerCase();
      const icon = el.querySelector('.material-symbols-outlined')?.textContent?.trim().toLowerCase() || '';
      const isSearch = text === 'search' || icon === 'search' || el.getAttribute('aria-label')?.toLowerCase().includes('search');
      const isProfile = !!el.querySelector('img') || /profile|account|avatar/.test(el.getAttribute('aria-label') || '');
      if (isSearch || isProfile) return;
      if (duplicateLabels.has(text) || noisyActions.some(label => text.includes(label))) {
        el.remove();
      }
    });
    header.dataset.edenCleaning = 'false';
  }

  function edenLogoMarkup(linked = true) {
    const img = '<img class="eden-logo-img" src="assets/eden-recyclers-logo.png" alt="Eden Recyclers">';
    if (!linked) return img;
    return `<a class="eden-logo-home inline-flex items-center" href="operations_overview.html" aria-label="Go to Operations Overview">${img}</a>`;
  }

  function getHeaderRightCluster(header) {
    const direct = Array.from(header.children).filter(child => child.classList?.contains('flex') && child.classList?.contains('items-center'));
    if (direct.length) return direct[direct.length - 1];
    const nested = Array.from(header.querySelectorAll(':scope > div')).flatMap(child =>
      Array.from(child.children).filter(grandchild => grandchild.classList?.contains('flex') && grandchild.classList?.contains('items-center'))
    );
    if (nested.length) return nested[nested.length - 1];
    return Array.from(header.querySelectorAll('.flex.items-center')).find(el => !el.closest('button, a'));
  }

  function ensureContextHeader(currentPath) {
    if (!['supplier_inventory.html', 'production_monitoring.html', 'production_quality_control.html'].includes(currentPath)) return;
    const header = document.querySelector('header');
    if (!header || header.querySelector('[data-eden-context-actions]')) return;

    const rightCluster = getHeaderRightCluster(header);
    if (!rightCluster) return;

    const legacyNav = Array.from(header.querySelectorAll('.hidden.md\\:flex, .hidden.lg\\:flex')).find(el => {
      const text = el.innerText.trim().toLowerCase();
      return text.includes('production') && text.includes('inventory') && text.includes('analytics');
    });
    if (legacyNav) legacyNav.remove();

    const actions = document.createElement('div');
    actions.dataset.edenContextActions = 'true';
    actions.className = 'hidden lg:flex items-center gap-sm';
    if (currentPath === 'production_monitoring.html' || currentPath === 'production_quality_control.html') {
      actions.innerHTML = `
        <button type="button" data-production-header-action="new-batch" class="flex items-center gap-xs px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90 active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[18px]">add</span>
          New Batch
        </button>
        <button type="button" data-production-header-action="qc-log" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low transition-colors">
          <span class="material-symbols-outlined text-[18px]">fact_check</span>
          QC Log
        </button>
        <button type="button" data-production-header-action="requests" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low transition-colors">
          <span class="material-symbols-outlined text-[18px]">inventory_2</span>
          Requests
        </button>
        <button type="button" data-production-header-action="diagnostics" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low transition-colors">
          <span class="material-symbols-outlined text-[18px]">monitor_heart</span>
          Diagnostics
        </button>
      `;
      rightCluster.insertBefore(actions, rightCluster.firstChild);
      return;
    }

    actions.innerHTML = `
      <label class="flex items-center gap-xs px-sm py-xs rounded-full bg-surface-container-low border border-outline-variant focus-within:border-primary transition-colors">
        <span class="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
        <input data-inventory-search class="w-44 border-0 bg-transparent p-0 text-body-sm focus:ring-0 placeholder:text-on-surface-variant" placeholder="Search inventory" type="search">
      </label>
      <button type="button" data-inventory-action="add-batch" class="flex items-center gap-xs px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90 active:scale-95 transition-all">
        <span class="material-symbols-outlined text-[18px]">add</span>
        Add Stock
      </button>
      <button type="button" data-inventory-action="export" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low transition-colors">
        <span class="material-symbols-outlined text-[18px]">download</span>
        Export
      </button>
    `;
    rightCluster.insertBefore(actions, rightCluster.firstChild);
  }

  function wireNavigation(currentPath) {
    document.querySelectorAll('nav a, aside a, .fixed a').forEach(link => {
      const iconEl = link.querySelector('.material-symbols-outlined');
      const labelEl = Array.from(link.querySelectorAll('span')).find(span => !span.classList.contains('material-symbols-outlined'));
      const iconName = iconEl ? (iconEl.getAttribute('data-icon') || iconEl.innerText.trim()).toLowerCase() : '';
      const labelText = labelEl ? labelEl.innerText.trim().toLowerCase() : '';
      const lookupKey = NAV_MAPPINGS[labelText] ? labelText : (NAV_MAPPINGS[iconName] ? iconName : null);

      if (lookupKey && NAV_MAPPINGS[lookupKey] && NAV_MAPPINGS[lookupKey] !== '#') {
        link.href = pageHref(NAV_MAPPINGS[lookupKey]);
        if (!link.dataset.navClickBound) {
          link.dataset.navClickBound = 'true';
          link.addEventListener('click', event => {
            event.preventDefault();
            navigateTo(NAV_MAPPINGS[lookupKey]);
          });
        }
      }

      if (iconName === 'more_horiz' || labelText === 'more') {
        link.href = 'javascript:void(0);';
        link.addEventListener('click', () => {
          const drawer = document.getElementById('mobile-drawer') || document.querySelector('.mobile-navigation-drawer-overlay');
          if (drawer) drawer.classList.remove('hidden');
          else openDepartmentDrawer(currentPath);
        });
      }

      const hrefPage = link.getAttribute('href');
      if (hrefPage && currentPath === hrefPage) {
        link.classList.add('bg-primary-container', 'text-on-primary-container', 'font-bold');
        link.classList.remove('text-on-surface-variant');
      }
    });

    document.querySelectorAll('button').forEach(button => {
      const labelText = button.innerText.trim().toLowerCase();
      const target = NAV_MAPPINGS[labelText];
      if (!target || target === '#') return;
      if (button.dataset.navBound) return;
      button.dataset.navBound = 'true';
      button.addEventListener('click', () => { navigateTo(target); });
      if (currentPath === target) {
        button.classList.add('text-primary', 'font-bold');
      }
    });
  }

  function wireTextNavigation() {
    document.querySelectorAll('header span, header button').forEach(el => {
      const labelText = el.innerText.trim().toLowerCase();
      const target = NAV_MAPPINGS[labelText];
      if (!target || el.dataset.textNavBound) return;
      el.dataset.textNavBound = 'true';
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => { navigateTo(target); });
      el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') navigateTo(target);
      });
    });
  }

  function openDepartmentDrawer(currentPath) {
    let overlay = document.getElementById('department-nav-drawer');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'department-nav-drawer';
      overlay.className = 'fixed inset-0 z-[260] bg-black/40 flex justify-end';
      overlay.innerHTML = `
        <div class="w-80 max-w-[88vw] h-full bg-surface-container-low border-l border-outline-variant shadow-xl flex flex-col">
          <div class="h-16 px-md flex items-center justify-between border-b border-outline-variant">
            <div>
              <p class="font-headline-sm text-headline-sm text-primary">Departments</p>
              <p class="font-label-sm text-label-sm text-on-surface-variant">Eden Recyclers BOS</p>
            </div>
            <button class="material-symbols-outlined p-2 rounded-full hover:bg-surface-container-high" data-close-department-nav>close</button>
          </div>
          <nav class="flex-1 overflow-y-auto py-md space-y-1">
            ${DEPARTMENT_NAV.map(item => {
              const active = item.href === currentPath;
              const className = active
                ? 'flex items-center gap-md py-3 px-md mx-2 rounded-full bg-primary-container text-on-primary-container font-bold'
                : 'flex items-center gap-md py-3 px-md mx-2 rounded-full text-on-surface-variant hover:bg-surface-container-high';
              return `
                <a class="${className}" href="${pageHref(item.href)}">
                  <span class="material-symbols-outlined" data-icon="${item.icon}">${item.icon}</span>
                  <span class="font-label-md">${item.label}</span>
                </a>
              `;
            }).join('')}
          </nav>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('[data-close-department-nav]')) {
          overlay.classList.add('hidden');
        }
      });
    }

    overlay.classList.remove('hidden');
  }

  function wireProfileLogout() {
    const profileImg = document.querySelector('header img[alt="User Profile"], header img[alt="User"], header .w-8.h-8 img');
    if (!profileImg) return;
    profileImg.style.cursor = 'pointer';
    profileImg.title = `Logged in as ${window.appState.user.name} (${window.appState.user.role}). Click to logout.`;
    profileImg.addEventListener('click', () => {
      if (confirm('Do you want to sign out of Eden Recyclers?')) window.authManager.logout();
    });
  }

  function wireBackButtons() {
    document.querySelectorAll('.material-symbols-outlined').forEach(backBtn => {
      const iconName = backBtn.getAttribute('data-icon') || backBtn.innerText.trim();
      if (iconName !== 'arrow_back') return;
      backBtn.style.cursor = 'pointer';
      backBtn.addEventListener('click', () => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = 'operations_overview.html';
      });
    });
  }

  function wireOfflineBanner() {
    function checkConnectionBanner(online) {
      let banner = document.getElementById('offline-banner');
      if (!online && !banner) {
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.className = 'fixed top-0 left-0 w-full bg-yellow-500 text-black text-center py-2 font-bold z-[100] text-sm flex items-center justify-center gap-2';
        banner.innerHTML = '<span class="material-symbols-outlined text-base">cloud_off</span> You are currently offline. Local updates will sync once connected.';
        document.body.prepend(banner);
      }
      if (online && banner) banner.remove();
    }

    window.appState.addEventListener('connection-change', checkConnectionBanner);
    checkConnectionBanner(window.appState.isOnline);
  }

  function wireGlobalPopupDismissal() {
    if (window.__edenPopupDismissalBound) return;
    window.__edenPopupDismissalBound = true;
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const modal = getTopmostPopup();
      if (!modal) return;
      if (modal.id === 'entry-modal') modal.classList.add('hidden');
      else modal.remove();
      event.preventDefault();
    });
  }

  function getTopmostPopup() {
    const candidates = [
      ...document.querySelectorAll('.fixed.inset-0'),
      ...document.querySelectorAll('#entry-modal:not(.hidden)')
    ].filter(el => {
      if (el.id === 'offline-banner') return false;
      if (el.classList.contains('hidden')) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    return candidates.sort((a, b) => Number(window.getComputedStyle(b).zIndex || 0) - Number(window.getComputedStyle(a).zIndex || 0))[0] || null;
  }

  function ensureDepartmentAnalysis(currentPath) {
    const header = document.querySelector('header');
    if (!header || header.querySelector('[data-cross-analysis]')) return;
    const rightCluster = getHeaderRightCluster(header);
    if (!rightCluster) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.crossAnalysis = 'true';
    button.className = 'flex items-center gap-xs px-xs md:px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low transition-colors';
    button.innerHTML = '<span class="material-symbols-outlined text-[18px]">query_stats</span><span class="hidden sm:inline">Analysis</span>';
    button.addEventListener('click', () => showCrossDepartmentAnalysis(currentPath));
    rightCluster.insertBefore(button, rightCluster.firstChild);
  }

  function enhanceDataControls(root = document) {
    enhanceSortableTables(root);
    enhanceSortableLists(root);
  }

  function enhanceInteractiveMotion(root = document) {
    injectMotionStyles();
    const selectors = [
      'main tbody tr',
      '[data-collection-row]',
      '[data-route-zone]',
      '[data-school-card]',
      '[data-cycle-row]',
      '[data-qc-cycle]',
      '[data-material-request]',
      '[data-production-request-id]',
      '[data-product-card]',
      '[data-production-material]',
      '[data-batch-id]',
      '[data-material-id]',
      '[data-product-id]',
      '[data-workflow-id]',
      '[data-output-product]',
      '[data-supplier-id]',
      '[data-module-card]',
      'button',
      'select',
      'th[data-sort-column]',
      'main button',
      'main select',
      '[data-sort-toolbar] button',
      '[data-sort-toolbar] select',
      'main thead th[data-sort-column]',
      'main section li',
      'main section [class*="space-y"] > div',
      'main section [class*="space-y"] > button',
      'main section [class*="divide-y"] > div',
      'main section [class*="divide-y"] > button',
      'main .bento-card',
      'main .glass-card',
      'main section > .rounded-lg',
      'main section > .rounded-xl',
      'main [class*="rounded-xl"][class*="border"]'
    ].join(',');

    root.querySelectorAll(selectors).forEach(el => {
      if (el.dataset.motionEnhanced === 'true') return;
      if (el.closest('header, aside, nav')) return;
      if (el.closest('[data-modal-card]') && !isControlElement(el)) return;
      if (el.matches('section') && el.querySelector('table, [data-sort-list]')) return;
      if (el.children.length > 8 && !isControlElement(el)) return;

      el.dataset.motionEnhanced = 'true';
      el.classList.add('eden-motion-row');
      if (isActionableMotionTarget(el)) {
        el.classList.add('cursor-pointer');
        if (!el.hasAttribute('tabindex') && !el.matches('button, a, input, select, textarea, summary, tr')) {
          el.setAttribute('tabindex', '0');
        }
      }
      el.style.setProperty('--eden-accent', getMotionAccent(el));
    });
  }

  function injectMotionStyles() {
    if (document.getElementById('eden-motion-style')) return;
    const style = document.createElement('style');
    style.id = 'eden-motion-style';
    style.textContent = `
      .eden-motion-row {
        transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease, opacity 180ms ease;
        will-change: transform;
      }
      .eden-motion-row:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.10), inset 3px 0 0 var(--eden-accent, #006c03);
        border-color: color-mix(in srgb, var(--eden-accent, #006c03) 34%, transparent);
      }
      button.eden-motion-row:hover,
      select.eden-motion-row:hover,
      th.eden-motion-row:hover {
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.10);
      }
      .eden-motion-row:active {
        transform: translateY(0) scale(0.992);
      }
      .eden-motion-row:focus-within,
      .eden-motion-row:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(0, 108, 3, 0.18), inset 3px 0 0 var(--eden-accent, #006c03);
      }
      .eden-motion-row .material-symbols-outlined {
        transition: transform 180ms ease, opacity 180ms ease;
      }
      .eden-motion-row:hover .material-symbols-outlined {
        transform: translateX(1px) scale(1.04);
      }
      tbody .eden-motion-row:hover {
        background: color-mix(in srgb, var(--eden-accent, #006c03) 8%, var(--eden-row-bg, transparent));
      }
      @media (prefers-reduced-motion: reduce) {
        .eden-motion-row,
        .eden-motion-row .material-symbols-outlined {
          transition: none !important;
        }
        .eden-motion-row:hover,
        .eden-motion-row:active,
        .eden-motion-row:hover .material-symbols-outlined {
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isActionableMotionTarget(el) {
    return el.matches('button, a, select, th[data-sort-column], tr, [data-collection-row], [data-route-zone], [data-school-card], [data-cycle-row], [data-qc-cycle], [data-material-request], [data-production-request-id], [data-product-card], [data-batch-id], [data-material-id], [data-product-id], [data-workflow-id], [data-output-product], [data-supplier-id], [data-module-card]')
      || Boolean(el.querySelector('button, a, input, select, textarea, [role="button"]'));
  }

  function isControlElement(el) {
    return el.matches('button, a, input, select, textarea, summary, th[data-sort-column]');
  }

  function getMotionAccent(el) {
    const text = el.innerText.toLowerCase();
    if (/(rejected|overdue|delayed|critical|low stock|failed|blocked)/.test(text)) return '#ba1a1a';
    if (/(pending|scheduled|in progress|requested|qc|maintenance|partial|en route)/.test(text)) return '#805533';
    if (/(completed|delivered|shipped|received|issued|passed|operational|paid|approved)/.test(text)) return '#006c03';
    if (/(production|inventory|material|batch|stock)/.test(text)) return '#386a20';
    return '#006c03';
  }

  function observeDataControls() {
    if (window.__edenDataControlsObserver) return;
    window.__edenDataControlsObserver = new MutationObserver(mutations => {
      if (!mutations.some(mutation => mutation.addedNodes.length)) return;
      window.clearTimeout(window.__edenDataControlsTimer);
      window.__edenDataControlsTimer = window.setTimeout(() => {
        enhanceDataControls();
        enhanceInteractiveMotion();
      }, 120);
    });
    window.__edenDataControlsObserver.observe(document.body, { childList: true, subtree: true });
  }

  function enhanceSortableTables(root) {
    root.querySelectorAll('table').forEach(table => {
      const tbody = table.querySelector('tbody');
      const headers = Array.from(table.querySelectorAll('thead th'));
      if (!tbody || !headers.length || table.dataset.sortEnhanced === 'true') return;
      table.dataset.sortEnhanced = 'true';
      headers.forEach((th, index) => {
        th.dataset.sortColumn = String(index);
        th.title = 'Click to sort';
        th.classList.add('cursor-pointer', 'select-none');
        if (!th.querySelector('[data-sort-icon]')) {
          th.insertAdjacentHTML('beforeend', ' <span data-sort-icon class="material-symbols-outlined align-middle text-[16px] opacity-50">unfold_more</span>');
        }
        th.addEventListener('click', () => {
          const direction = table.dataset.sortIndex === String(index) && table.dataset.sortDirection !== 'desc' ? 'desc' : 'asc';
          sortTable(table, index, direction);
        });
      });
      addTableSortToolbar(table, headers);
    });
  }

  function addTableSortToolbar(table, headers) {
    const wrapper = table.closest('.overflow-x-auto') || table.parentElement;
    if (!wrapper || wrapper.previousElementSibling?.dataset.sortToolbar === 'true') return;
    const toolbar = document.createElement('div');
    toolbar.dataset.sortToolbar = 'true';
    toolbar.className = 'mb-sm flex flex-wrap items-center justify-end gap-xs';
    toolbar.innerHTML = `
      <label class="flex items-center gap-xs text-label-sm font-label-sm text-on-surface-variant">
        <span class="material-symbols-outlined text-[18px]">sort</span>
        <select data-table-sort-field class="rounded-full border-outline-variant bg-surface-container-lowest py-xs text-label-sm">
          ${headers.map((th, index) => `<option value="${index}">${cleanSortText(th.innerText)}</option>`).join('')}
        </select>
      </label>
      <select data-table-sort-direction class="rounded-full border-outline-variant bg-surface-container-lowest py-xs text-label-sm">
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
    `;
    wrapper.insertAdjacentElement('beforebegin', toolbar);
    const field = toolbar.querySelector('[data-table-sort-field]');
    const direction = toolbar.querySelector('[data-table-sort-direction]');
    const apply = () => sortTable(table, Number(field.value), direction.value);
    field.addEventListener('change', apply);
    direction.addEventListener('change', apply);
  }

  function sortTable(table, index, direction = 'asc') {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.children.length > index);
    rows.sort((a, b) => compareSortValues(a.children[index]?.innerText, b.children[index]?.innerText, direction));
    rows.forEach(row => tbody.appendChild(row));
    table.dataset.sortIndex = String(index);
    table.dataset.sortDirection = direction;
    table.querySelectorAll('[data-sort-icon]').forEach(icon => { icon.innerText = 'unfold_more'; });
    const icon = table.querySelector(`th[data-sort-column="${index}"] [data-sort-icon]`);
    if (icon) icon.innerText = direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  function enhanceSortableLists(root) {
    const selectors = [
      '[data-material-request-list]',
      '[data-production-cycle-list]',
      '[data-product-flow-list]',
      '[data-workflow-list]',
      '[data-production-request-list]',
      '[data-supplier-list]',
      '[data-route-list]',
      '[data-task-list]'
    ];
    root.querySelectorAll(selectors.join(',')).forEach(list => {
      if (list.dataset.sortEnhanced === 'true' || list.children.length < 2) return;
      list.dataset.sortEnhanced = 'true';
      const toolbar = document.createElement('div');
      toolbar.dataset.listSortToolbar = 'true';
      toolbar.className = 'mb-sm flex flex-wrap items-center justify-end gap-xs';
      toolbar.innerHTML = `
        <label class="flex items-center gap-xs text-label-sm font-label-sm text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">sort</span>
          <select data-list-sort-field class="rounded-full border-outline-variant bg-surface-container-lowest py-xs text-label-sm">
            <option value="text">Name / Title</option>
            <option value="status">Status</option>
            <option value="number">Largest Number</option>
          </select>
        </label>
        <select data-list-sort-direction class="rounded-full border-outline-variant bg-surface-container-lowest py-xs text-label-sm">
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      `;
      list.insertAdjacentElement('beforebegin', toolbar);
      const apply = () => sortList(list, toolbar.querySelector('[data-list-sort-field]').value, toolbar.querySelector('[data-list-sort-direction]').value);
      toolbar.querySelectorAll('select').forEach(select => select.addEventListener('change', apply));
    });
  }

  function sortList(list, field, direction) {
    const items = Array.from(list.children).filter(child => !child.dataset.listSortToolbar);
    items.sort((a, b) => {
      if (field === 'number') return compareSortValues(extractLargestNumber(a.innerText), extractLargestNumber(b.innerText), direction === 'asc' ? 'desc' : 'asc');
      if (field === 'status') return compareSortValues(extractStatusText(a.innerText), extractStatusText(b.innerText), direction);
      return compareSortValues(a.innerText, b.innerText, direction);
    });
    items.forEach(item => list.appendChild(item));
  }

  function showCrossDepartmentAnalysis(currentPath) {
    const materials = readJson('eden_raw_materials', []);
    const products = readJson('eden_finished_products', []);
    const requests = readJson('eden_material_requests', []);
    const cycles = readJson('eden_production_cycles', []);
    const batches = readJson('eden_production_batches', []);
    const qcLogs = readJson('eden_qc_logs', []);
    const tasks = readJson('eden_tasks', []);
    const collections = readJson('eden_collections', []);
    const schools = readJson('eden_schools', []);
    const lowStock = materials.filter(item => Number(item.quantity_kg || 0) <= Number(item.reorder_threshold_kg || 0));
    const activeCycles = cycles.filter(item => !['completed', 'cancelled', 'rejected'].includes(item.status));
    const openTasks = tasks.filter(item => !['completed', 'closed'].includes(String(item.status || '').toLowerCase()));
    const passedQc = qcLogs.filter(item => item.passed).length;
    const rejectedQc = qcLogs.filter(item => item.status === 'rejected' || item.grade === 'Reject' || item.rejected).length;
    const openCollections = collections.filter(item => !['received', 'cancelled'].includes(String(item.status || '').toLowerCase()));
    const attention = buildAttentionItems(lowStock, requests, activeCycles, openTasks, openCollections);
    const overlay = createAppModal('Cross Department Analysis', `
      <div class="space-y-lg" data-analysis-dashboard>
        <div class="grid grid-cols-2 xl:grid-cols-6 gap-sm">
          ${analysisCard('Low Stock', lowStock.length, 'Inventory', 'warehouse')}
          ${analysisCard('Material Requests', requests.filter(item => item.status !== 'issued').length, 'Inventory', 'inventory_2')}
          ${analysisCard('Active Cycles', activeCycles.length, 'Production', 'precision_manufacturing')}
          ${analysisCard('Open Collections', openCollections.length, 'Collection', 'local_shipping')}
          ${analysisCard('Open Tasks', openTasks.length, 'All', 'assignment')}
          ${analysisCard('QC Pass Rate', qcPassRate(passedQc, rejectedQc), 'Quality', 'fact_check')}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-sm p-sm rounded-xl bg-surface-container-low border border-outline-variant">
          <div>
            <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Focus Area</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Filter the queue without leaving ${formatSortLabel(currentPath.replace('.html', '').replace(/_/g, ' '))}.</p>
          </div>
          <div class="flex flex-wrap gap-xs">
            ${['All', 'Inventory', 'Production', 'Collection', 'Maintenance', 'Sales'].map((dept, index) => `
              <button type="button" data-analysis-filter="${dept.toLowerCase()}" class="px-sm py-xs rounded-full border ${index === 0 ? 'bg-primary text-on-primary border-primary' : 'border-outline text-on-surface-variant hover:bg-surface-container-high'} font-label-sm text-label-sm">${dept}</button>
            `).join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-md">
          <section class="xl:col-span-2 p-md rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-sm mb-sm">
              <div>
                <h4 class="font-headline-sm text-headline-sm">Attention Queue</h4>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Operational risks requiring action across departments.</p>
              </div>
              <span data-analysis-count class="px-sm py-xs rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">${attention.length} Items</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left min-w-[840px]" data-analysis-table>
                <thead>
                  <tr class="text-on-surface-variant">
                    <th class="py-xs pr-sm">Department</th>
                    <th class="py-xs pr-sm">Type</th>
                    <th class="py-xs pr-sm">Item</th>
                    <th class="py-xs pr-sm">Owner</th>
                    <th class="py-xs pr-sm">Status</th>
                    <th class="py-xs pr-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${attention.map(item => analysisQueueRow(item)).join('') || '<tr><td colspan="6" class="py-md text-center text-on-surface-variant">No open operational risks.</td></tr>'}
                </tbody>
              </table>
            </div>
          </section>

          <section class="p-md rounded-xl border border-outline-variant bg-surface-container-lowest">
            <h4 class="font-headline-sm text-headline-sm mb-sm">Department Load</h4>
            <div class="space-y-sm">
              ${departmentLoadRows(openTasks, lowStock, activeCycles, requests, openCollections)}
            </div>
          </section>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-md">
          <section class="p-md rounded-xl border border-outline-variant bg-surface-container-lowest">
            <h4 class="font-headline-sm text-headline-sm mb-sm">Inventory Signals</h4>
            <dl class="divide-y divide-outline-variant">${miniMetricRows([
              ['Raw materials', materials.length],
              ['Finished products', products.length],
              ['Low stock', lowStock.length],
              ['Pending material requests', requests.filter(item => item.status !== 'issued').length]
            ])}</dl>
          </section>
          <section class="p-md rounded-xl border border-outline-variant bg-surface-container-lowest">
            <h4 class="font-headline-sm text-headline-sm mb-sm">Production & QC</h4>
            <dl class="divide-y divide-outline-variant">${miniMetricRows([
              ['Production batches', batches.length],
              ['Active cycles', activeCycles.length],
              ['QC passed', passedQc],
              ['QC rejected', rejectedQc]
            ])}</dl>
          </section>
          <section class="p-md rounded-xl border border-outline-variant bg-surface-container-lowest">
            <h4 class="font-headline-sm text-headline-sm mb-sm">Collection Network</h4>
            <dl class="divide-y divide-outline-variant">${miniMetricRows([
              ['Partner schools', schools.length],
              ['Open collections', openCollections.length],
              ['Collected records', collections.length],
              ['Open tasks', openTasks.length]
            ])}</dl>
          </section>
        </div>

        <div class="flex flex-wrap justify-end gap-sm">
          <button type="button" data-analysis-export class="px-md py-sm border border-outline text-on-surface-variant rounded-full font-label-md text-label-md hover:bg-surface-container-low">Export CSV</button>
          <button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button>
        </div>
      </div>
    `, 'Operations Analysis', 'max-w-6xl');
    bindAnalysisModal(overlay, attention);
    enhanceDataControls(document.body);
    enhanceInteractiveMotion(document.body);
  }

  function analysisCard(label, value, source, icon = 'query_stats') {
    return `
      <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant min-w-0">
        <div class="flex items-center justify-between gap-sm">
          <p class="font-label-sm text-label-sm text-on-surface-variant truncate">${label}</p>
          <span class="material-symbols-outlined text-primary text-[18px]">${icon}</span>
        </div>
        <p class="font-headline-sm text-headline-sm text-primary">${typeof value === 'string' ? value : Number(value || 0).toLocaleString('en-KE')}</p>
        <p class="font-label-sm text-label-sm text-on-surface-variant truncate">${source}</p>
      </div>
    `;
  }

  function buildAttentionItems(lowStock, requests, cycles, tasks, collections) {
    return [
      ...lowStock.slice(0, 8).map(item => ({
        department: 'inventory',
        type: 'Low stock',
        item: item.name,
        owner: 'Inventory Lead',
        status: `${Number(item.quantity_kg || 0).toLocaleString('en-KE')} kg`,
        action: 'Reorder'
      })),
      ...requests.filter(item => item.status !== 'issued').slice(0, 8).map(item => ({
        department: 'inventory',
        type: 'Material request',
        item: item.product_name,
        owner: 'Inventory Lead',
        status: formatSortLabel(item.status),
        action: 'Issue stock'
      })),
      ...cycles.slice(0, 8).map(item => ({
        department: 'production',
        type: 'Production cycle',
        item: item.product_name,
        owner: item.owner || 'Production Lead',
        status: formatSortLabel(item.status),
        action: item.status === 'qc_check' ? 'Record QC' : 'Review'
      })),
      ...collections.slice(0, 8).map(item => ({
        department: 'collection',
        type: 'Collection',
        item: item.school_name,
        owner: item.collector_name || 'Collection Lead',
        status: formatSortLabel(item.status),
        action: item.status === 'received' ? 'View' : 'Receive'
      })),
      ...tasks.slice(0, 10).map(item => ({
        department: String(item.department || 'all').toLowerCase().includes('maintenance') ? 'maintenance' : String(item.department || 'all').toLowerCase().includes('sales') ? 'sales' : String(item.department || 'all').toLowerCase(),
        type: 'Task',
        item: item.title,
        owner: item.assigned_to || item.department || 'Owner needed',
        status: formatSortLabel(item.status),
        action: 'Open task'
      }))
    ];
  }

  function analysisQueueRow(item) {
    return `
      <tr data-analysis-row data-analysis-department="${item.department}" class="border-t border-outline-variant hover:bg-surface-container-low transition-colors">
        <td class="py-sm pr-sm"><span class="px-xs py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">${formatSortLabel(item.department)}</span></td>
        <td class="py-sm pr-sm font-label-md text-label-md">${item.type}</td>
        <td class="py-sm pr-sm font-body-md text-body-md">${window.edenUtils.escapeHTML(item.item || 'Unnamed item')}</td>
        <td class="py-sm pr-sm font-body-sm text-body-sm text-on-surface-variant">${window.edenUtils.escapeHTML(item.owner)}</td>
        <td class="py-sm pr-sm">${statusBadgeForAnalysis(item.status)}</td>
        <td class="py-sm pr-sm"><button type="button" data-analysis-action="${item.department}" class="px-xs py-1 rounded-full border border-outline text-on-surface-variant font-label-sm text-label-sm hover:bg-surface-container-high">${item.action}</button></td>
      </tr>
    `;
  }

  function departmentLoadRows(tasks, lowStock, activeCycles, requests, collections) {
    const rows = [
      ['Inventory', tasks.filter(t => t.department === 'Inventory').length + lowStock.length + requests.filter(r => r.status !== 'issued').length, lowStock.length ? 'Low stock' : 'Normal', 'warehouse'],
      ['Production', tasks.filter(t => t.department === 'Production').length + activeCycles.length, activeCycles.length ? 'Active cycles' : 'Normal', 'precision_manufacturing'],
      ['Collection', tasks.filter(t => String(t.department || '').includes('Collection')).length + collections.length, collections.length ? 'Open routes' : 'Normal', 'local_shipping'],
      ['Maintenance', tasks.filter(t => t.department === 'Maintenance').length, tasks.some(t => t.department === 'Maintenance') ? 'Line review' : 'Normal', 'build'],
      ['Sales', tasks.filter(t => String(t.department || '').includes('Sales')).length, 'Dispatch dependent', 'payments']
    ];
    return rows.map(row => `
      <button type="button" data-analysis-load-filter="${row[0].toLowerCase()}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:shadow-sm transition-all">
        <div class="flex items-center justify-between gap-md">
          <div class="min-w-0">
            <p class="font-label-md text-label-md text-on-surface truncate">${window.edenUtils.escapeHTML(row[0])}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${window.edenUtils.escapeHTML(row[2])}</p>
          </div>
          <div class="flex items-center gap-sm">
            <strong class="font-headline-sm text-headline-sm text-primary">${row[1]}</strong>
            <span class="material-symbols-outlined text-primary">${row[3]}</span>
          </div>
        </div>
      </button>
    `).join('');
  }

  function miniMetricRows(rows) {
    return rows.map(([label, value]) => `
      <div class="py-sm flex items-center justify-between gap-md">
        <dt class="font-body-sm text-body-sm text-on-surface-variant">${window.edenUtils.escapeHTML(label)}</dt>
        <dd class="font-label-md text-label-md text-on-surface">${typeof value === 'string' ? window.edenUtils.escapeHTML(value) : Number(value || 0).toLocaleString('en-KE')}</dd>
      </div>
    `).join('');
  }

  function bindAnalysisModal(overlay, attention) {
    const rows = Array.from(overlay.querySelectorAll('[data-analysis-row]'));
    const count = overlay.querySelector('[data-analysis-count]');
    overlay.querySelectorAll('[data-analysis-filter], [data-analysis-load-filter]').forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.dataset.analysisFilter || button.dataset.analysisLoadFilter;
        overlay.querySelectorAll('[data-analysis-filter]').forEach(item => {
          item.classList.remove('bg-primary', 'text-on-primary', 'border-primary');
          item.classList.add('border-outline', 'text-on-surface-variant');
        });
        button.classList.add('bg-primary', 'text-on-primary', 'border-primary');
        button.classList.remove('text-on-surface-variant');
        let visible = 0;
        rows.forEach(row => {
          const show = filter === 'all' || row.dataset.analysisDepartment === filter;
          row.classList.toggle('hidden', !show);
          if (show) visible += 1;
        });
        if (count) count.innerText = `${visible} Item${visible === 1 ? '' : 's'}`;
      });
    });
    overlay.querySelectorAll('[data-analysis-action]').forEach(button => {
      button.addEventListener('click', () => {
        const dept = button.dataset.analysisAction;
        const target = {
          inventory: 'supplier_inventory.html',
          production: 'production_monitoring.html',
          collection: 'waste_collection.html',
          maintenance: 'maintenance_scheduling.html',
          sales: 'sales_distribution.html'
        }[dept] || 'operations_overview.html';
        window.location.href = pageHref(target);
      });
    });
    overlay.querySelector('[data-analysis-export]')?.addEventListener('click', () => {
      const rowsForCsv = [
        ['Department', 'Type', 'Item', 'Owner', 'Status', 'Action'],
        ...attention.map(item => [item.department, item.type, item.item, item.owner, item.status, item.action])
      ];
      downloadTextFile(`eden-analysis-${new Date().toISOString().slice(0, 10)}.csv`, rowsForCsv.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
      window.edenUtils?.showToast('Analysis export downloaded.', 'success');
    });
  }

  function qcPassRate(passed, rejected) {
    const total = Number(passed || 0) + Number(rejected || 0);
    return total ? `${Math.round((Number(passed || 0) / total) * 100)}%` : '100%';
  }

  function statusBadgeForAnalysis(status = 'open') {
    const key = String(status).toLowerCase();
    const danger = key.includes('reject') || key.includes('low');
    const positive = key.includes('complete') || key.includes('received') || key.includes('normal');
    const cls = danger ? 'bg-error-container/30 text-error' : positive ? 'bg-primary/10 text-primary' : 'bg-secondary-container text-on-secondary-container';
    return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${status}</span>`;
  }

  function departmentRows(tasks, lowStock, activeCycles, requests) {
    const rows = [
      ['Inventory', tasks.filter(t => t.department === 'Inventory').length + lowStock.length + requests.filter(r => r.status !== 'issued').length, lowStock.length ? 'Low stock' : 'Normal'],
      ['Production', tasks.filter(t => t.department === 'Production').length + activeCycles.length, activeCycles.length ? 'Active cycles' : 'Normal'],
      ['Maintenance', tasks.filter(t => t.department === 'Maintenance').length, tasks.some(t => t.department === 'Maintenance') ? 'Line review' : 'Normal'],
      ['Sales / Distribution', tasks.filter(t => String(t.department || '').includes('Sales')).length, 'Dispatch dependent']
    ];
    return rows.map(row => `<tr><td class="py-xs">${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`).join('');
  }

  function attentionRows(lowStock, requests, cycles, tasks) {
    const rows = [
      ...lowStock.slice(0, 4).map(item => ['Low stock', item.name, 'Inventory Lead', `${Number(item.quantity_kg || 0).toLocaleString('en-KE')} kg`]),
      ...requests.filter(item => item.status !== 'issued').slice(0, 4).map(item => ['Material request', item.product_name, 'Inventory Lead', formatSortLabel(item.status)]),
      ...cycles.slice(0, 4).map(item => ['Production cycle', item.product_name, item.owner || 'Production Lead', formatSortLabel(item.status)]),
      ...tasks.slice(0, 4).map(item => ['Task', item.title, item.assigned_to || item.department || 'Owner needed', formatSortLabel(item.status)])
    ];
    return (rows.length ? rows : [['None', 'No open risks recorded', 'Operations', 'Healthy']])
      .map(row => `<tr><td class="py-xs">${window.edenUtils.escapeHTML(row[0])}</td><td>${window.edenUtils.escapeHTML(row[1])}</td><td>${window.edenUtils.escapeHTML(row[2])}</td><td>${window.edenUtils.escapeHTML(row[3])}</td></tr>`).join('');
  }

  function compareSortValues(a, b, direction = 'asc') {
    const av = normalizeSortValue(a);
    const bv = normalizeSortValue(b);
    const result = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    return direction === 'desc' ? -result : result;
  }

  function normalizeSortValue(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const number = Number(text.replace(/[^0-9.-]/g, ''));
    if (text && Number.isFinite(number) && /[0-9]/.test(text)) return number;
    const date = Date.parse(text);
    if (Number.isFinite(date)) return date;
    return text.toLowerCase();
  }

  function cleanSortText(value) {
    return String(value || '').replace(/unfold_more|arrow_upward|arrow_downward/g, '').replace(/\s+/g, ' ').trim() || 'Column';
  }

  function extractLargestNumber(value) {
    const matches = String(value || '').match(/-?\d[\d,]*(\.\d+)?/g) || ['0'];
    return Math.max(...matches.map(item => Number(item.replace(/,/g, '')) || 0));
  }

  function extractStatusText(value) {
    const statuses = ['rejected', 'low stock', 'requested', 'issued', 'in progress', 'qc check', 'completed', 'stored', 'operational', 'maintenance'];
    const text = String(value || '').toLowerCase();
    return statuses.find(status => text.includes(status)) || text;
  }

  function formatSortLabel(value) {
    return String(value || 'open').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function bindPageControllers(currentPath) {
    bindModuleCards();
    if (window.edenPageControllers?.[currentPath]) {
      window.edenPageControllers[currentPath]();
      return;
    }
    if (currentPath === 'waste_collection.html') bindWasteCollectionPage();
    if (currentPath === 'operations_overview.html') bindDashboardPage();
    if (currentPath === 'supplier_inventory.html') bindInventoryPage();
    if (currentPath === 'production_monitoring.html' || currentPath === 'production_quality_control.html') bindProductionPage();
    if (currentPath === 'sustainability_analytics.html') bindSustainabilityPage();
  }

  function bindModuleCards() {
    const pageByTitle = {
      'Waste Collection': 'waste_collection.html',
      Inventory: 'supplier_inventory.html',
      Production: 'production_monitoring.html',
      Sales: 'sales_distribution.html',
      HR: 'hr_staffing.html',
      Finance: 'finance_overview.html',
      Analytics: 'sustainability_analytics.html',
      Infrastructure: 'infrastructure_facility.html'
    };

    document.querySelectorAll('.group.cursor-pointer').forEach(card => {
      const title = card.querySelector('h4')?.innerText.trim();
      if (!title || !pageByTitle[title]) return;
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.addEventListener('click', () => { window.location.href = pageByTitle[title]; });
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') window.location.href = pageByTitle[title];
      });
    });
  }

  async function bindWasteCollectionPage() {
    if (!window.collectionModule) return;

    const modal = document.getElementById('entry-modal');
    const form = modal?.querySelector('form');
    const schoolSelect = form?.querySelector('select');
    const wasteTypeSelect = form?.querySelectorAll('select')[1];
    const weightInput = form?.querySelector('input[type="number"]');
    const notesInput = form?.querySelector('textarea');

    const schools = await window.collectionModule.getSchools();
    if (schoolSelect && schools.length) {
      schoolSelect.innerHTML = '<option value="">Select School...</option>' + schools
        .map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`)
        .join('');
    }
    if (wasteTypeSelect) {
      wasteTypeSelect.innerHTML = `
        <option value="plastic_bottles">Plastic Bottles</option>
        <option value="hdpe">HDPE</option>
        <option value="ldpe">LDPE</option>
        <option value="mixed_plastic">Mixed Plastic</option>
      `;
    }

    if (form) {
      form.removeAttribute('onsubmit');
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const schoolId = schoolSelect?.value;
        if (!schoolId) {
          window.edenUtils?.showToast('Choose a school before submitting.', 'warning');
          return;
        }
        const weightKg = Number(weightInput?.value || 0);
        const created = await window.collectionModule.addCollection({
          school_id: schoolId,
          collection_date: new Date().toISOString().split('T')[0],
          weight_kg: weightKg,
          waste_type: wasteTypeSelect?.value || 'plastic_bottles',
          status: weightKg > 0 ? 'weighed' : 'scheduled',
          notes: notesInput?.value || ''
        });
        if (created) {
          modal.classList.add('hidden');
          form.reset();
          window.edenUtils?.showToast('Collection logged.', 'success');
          renderCollectionPage();
        } else {
          window.edenUtils?.showToast('Could not save the collection.', 'error');
        }
      });
    }

    await renderCollectionPage();
  }

  async function renderCollectionPage() {
    const collections = await window.collectionModule.getCollections();
    const today = new Date().toISOString().split('T')[0];
    const todayRows = collections.filter(c => c.collection_date === today && c.status !== 'cancelled');
    const totalWeight = todayRows.reduce((sum, c) => sum + Number(c.weight_kg || 0), 0);
    const completed = todayRows.filter(c => ['weighed', 'received'].includes(c.status)).length;

    setText('kpi-pickups', `${todayRows.length} Schools`);
    setText('kpi-weight', `${totalWeight.toLocaleString('en-KE')} kg`);
    setText('kpi-completed', `${completed} / ${todayRows.length}`);

    const tbody = document.querySelector('main table tbody');
    if (!tbody) return;

    const rows = todayRows.length ? todayRows : collections.slice(0, 5);
    tbody.innerHTML = rows.map(c => `
      <tr class="hover:bg-surface-container-low transition-colors">
        <td class="px-md py-md font-body-md text-body-md font-bold">${window.edenUtils.escapeHTML(c.school_name || 'Unknown School')}</td>
        <td class="px-md py-md font-body-md text-body-md">${Number(c.weight_kg || 0).toLocaleString('en-KE')} kg</td>
        <td class="px-md py-md font-body-md text-body-md">${formatCollectionDate(c.collection_date)}</td>
        <td class="px-md py-md">${statusBadge(c.status)}</td>
        <td class="px-md py-md">
          ${c.status === 'received'
            ? '<span class="text-on-surface-variant font-label-md text-label-md">Received</span>'
            : `<button class="text-primary font-bold text-label-md hover:underline" data-collection-id="${c.id}">Mark Received</button>`}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-collection-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-collection-id');
        const item = collections.find(c => c.id === id);
        const ok = await window.collectionModule.updateCollectionStatus(id, 'received', {
          weight_kg: item?.weight_kg || 0,
          waste_type: item?.waste_type || 'plastic_bottles'
        });
        window.edenUtils?.showToast(ok ? 'Collection received and stock updated.' : 'Could not update collection.', ok ? 'success' : 'error');
        if (ok) renderCollectionPage();
      });
    });
  }

  async function bindDashboardPage() {
    if (!window.dashboardModule) return;
    const stats = await window.dashboardModule.getStats();
    const counters = document.querySelectorAll('.font-headline-md');
    replaceCounter(counters, '124.5', (stats.wasteCollectedKg / 1000).toFixed(1));
    replaceCounter(counters, '82.1', Number(stats.productionOutputKg || 0).toLocaleString('en-KE'));
    replaceCounter(counters, '48', Number(stats.headcount || 0).toLocaleString('en-KE'));

    const activityTbody = document.querySelector('section table tbody');
    if (activityTbody) {
      activityTbody.innerHTML = window.dashboardModule.getActivity().map(item => `
        <tr class="hover:bg-surface-container-low/50 transition-colors">
          <td class="px-lg py-md font-body-sm">${item.timestamp}</td>
          <td class="px-lg py-md"><span class="px-2 py-0.5 bg-surface-variant text-on-surface-variant rounded text-label-sm">${item.module}</span></td>
          <td class="px-lg py-md font-body-md">${item.action}</td>
          <td class="px-lg py-md">${statusBadge(item.status)}</td>
        </tr>
      `).join('');
    }
  }

  async function bindProductionPage() {
    if (!window.productionModule) return;

    const newBatchButton = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('New Production Batch'));
    if (newBatchButton && !newBatchButton.dataset.boundProduction) {
      newBatchButton.dataset.boundProduction = 'true';
      newBatchButton.addEventListener('click', async () => {
        const started = await window.productionModule.startBatch({
          product_name: 'HDPE Granules',
          raw_material_id: 'raw-2',
          raw_material_name: 'HDPE Pellets',
          input_kg: 250,
          machine_id: 'mach-2',
          machine_name: 'Granulator B',
          notes: 'Created from Production Console'
        });
        window.edenUtils?.showToast(started ? `Batch ${started.batch_number || started.batch_code} started.` : 'Could not start batch.', started ? 'success' : 'error');
        if (started) renderProductionPage();
      });
    }

    const syncButton = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('Sync ERP'));
    if (syncButton && !syncButton.dataset.boundProduction) {
      syncButton.dataset.boundProduction = 'true';
      syncButton.addEventListener('click', () => {
        renderProductionPage();
        window.edenUtils?.showToast('Production data refreshed.', 'info');
      });
    }

    await renderProductionPage();
  }

  async function renderProductionPage() {
    const [batches, machines, maintenance, stats] = await Promise.all([
      window.productionModule.getBatches(),
      window.productionModule.getMachines(),
      window.productionModule.getMaintenance(),
      window.productionModule.getProductionStats()
    ]);

    renderMachineStatus(machines, maintenance);
    renderProductionMetrics(stats, batches);
    renderProductionChart(batches);
    renderQualityChecklist(batches);
    renderMaterialInventory();
    renderEkoProductionPanel();
  }

  function renderMachineStatus(machines, maintenance) {
    const statusSection = Array.from(document.querySelectorAll('section')).find(section => section.innerText.includes('Real-time Machine Status'));
    const list = statusSection?.querySelector('.flex.flex-col.gap-sm');
    if (!list) return;

    const activeMaintenanceByMachine = new Set((maintenance || [])
      .filter(item => ['in_progress', 'overdue', 'emergency'].includes(String(item.status).toLowerCase()))
      .map(item => item.machine_name));

    const rows = (machines || []).length ? machines : [
      { name: 'Extruder Line A', type: 'extruder', status: 'operational' },
      { name: 'Granulator B', type: 'granulator', status: 'operational' },
      { name: 'Film Press C', type: 'press', status: 'maintenance' },
      { name: 'Washing Station D', type: 'washer', status: 'operational' }
    ];

    list.innerHTML = rows.map(machine => {
      const hasMaintenance = activeMaintenanceByMachine.has(machine.name) || machine.status === 'maintenance';
      const active = machine.status === 'operational' && !hasMaintenance;
      const status = hasMaintenance ? 'ALERT' : active ? 'ACTIVE' : 'IDLE';
      const dotClass = hasMaintenance ? 'bg-error' : active ? 'bg-primary animate-pulse' : 'bg-outline';
      const cardClass = hasMaintenance ? 'border border-error-container bg-error-container/20' : active ? 'bg-surface-container-low' : 'bg-surface-container-low opacity-70';
      const textClass = hasMaintenance ? 'text-error' : active ? 'text-primary' : 'text-on-surface-variant';
      return `
        <div class="flex items-center justify-between p-sm ${cardClass} rounded-lg">
          <div class="flex items-center gap-md">
            <div class="w-2 h-2 rounded-full ${dotClass}"></div>
            <div>
              <p class="font-label-md text-label-md">${window.edenUtils.escapeHTML(machine.name)}</p>
              <p class="font-body-sm text-body-sm ${hasMaintenance ? 'text-error' : 'text-on-surface-variant'}">${hasMaintenance ? 'Maintenance required' : machine.type || 'Production line'}</p>
            </div>
          </div>
          <span class="font-label-sm text-label-sm ${textClass} font-bold">${status}</span>
        </div>
      `;
    }).join('');
  }

  function renderProductionMetrics(stats, batches) {
    const completed = batches.filter(batch => batch.status === 'completed');
    const rejected = batches.filter(batch => batch.status === 'rejected');
    const totalInput = completed.reduce((sum, batch) => sum + Number(batch.input_kg || batch.raw_material_used_kg || 0), 0);
    const outputKg = Number(stats.totalOutputKg || 0);
    const efficiency = completed.length ? Math.round(Number(stats.avgEfficiency || 0)) : 0;
    const qualityPass = completed.length + rejected.length ? Math.round((completed.length / (completed.length + rejected.length)) * 100) : 100;
    const downtime = Math.max(0, batches.filter(batch => batch.status === 'in_progress').length * 12);

    setMetricAfterLabel('TOTAL OUTPUT', `${outputKg.toLocaleString('en-KE')} kg`);
    setMetricAfterLabel('EFFICIENCY', `${efficiency || (totalInput ? Math.round((outputKg / totalInput) * 100) : 0)}%`);
    setMetricAfterLabel('QUALITY PASS', `${qualityPass}%`);
    setMetricAfterLabel('DOWNTIME', `${downtime}m`);
  }

  function renderProductionChart(batches) {
    const chart = Array.from(document.querySelectorAll('.h-64.flex.items-end')).find(el => el.innerText.includes('Pavers') || el.querySelector('.rounded-t-lg'));
    if (!chart) return;

    const totals = batches.reduce((acc, batch) => {
      const name = batch.product_name || 'Unassigned';
      acc[name] = (acc[name] || 0) + Number(batch.output_kg || batch.units_produced || 0);
      return acc;
    }, {});
    const entries = Object.entries(totals).filter(([, total]) => total > 0).slice(0, 5);
    const data = entries.length ? entries : [
      ['PET Pellets', 410],
      ['HDPE Granules', 260],
      ['LDPE Film', 180],
      ['Mixed PP', 120]
    ];
    const max = Math.max(...data.map(([, total]) => total), 1);
    const colors = ['bg-primary-container', 'bg-secondary-container', 'bg-tertiary-container', 'bg-primary-container', 'bg-secondary-container'];

    chart.innerHTML = '<div class="absolute inset-x-0 bottom-0 h-px bg-outline-variant"></div>' + data.map(([label, total], index) => `
      <div class="flex-1 flex flex-col items-center gap-sm group min-w-0">
        <div class="w-full ${colors[index % colors.length]} rounded-t-lg transition-all duration-500 group-hover:brightness-110" style="height: ${Math.max(12, Math.round((total / max) * 90))}%"></div>
        <span class="font-label-sm text-label-sm text-on-surface-variant text-center truncate w-full" title="${window.edenUtils.escapeHTML(label)}">${window.edenUtils.escapeHTML(label)}</span>
      </div>
    `).join('');
  }

  function renderQualityChecklist(batches) {
    const qcSection = Array.from(document.querySelectorAll('section')).find(section => section.innerText.includes('Shift Quality Control'));
    const list = qcSection?.querySelector('.space-y-sm');
    if (!list) return;

    const rows = batches.slice(0, 4);
    const items = rows.length ? rows : [
      { batch_number: 'PB-2026-001', product_name: 'PET Pellets', status: 'completed', quality_grade: 'A' },
      { batch_number: 'PB-2026-002', product_name: 'HDPE Granules', status: 'in_progress', quality_grade: null }
    ];

    list.innerHTML = items.map(batch => {
      const checked = batch.status === 'completed' ? 'checked' : '';
      const title = batch.status === 'completed' ? `QC passed for ${window.edenUtils.escapeHTML(batch.batch_number || batch.batch_code)}` : `QC pending for ${window.edenUtils.escapeHTML(batch.batch_number || batch.batch_code)}`;
      const detail = `${window.edenUtils.escapeHTML(batch.product_name || 'Production batch')} - ${String(batch.status || 'planned').replace(/_/g, ' ')}`;
      return `
        <label class="flex items-start gap-md p-sm hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer group">
          <input ${checked} class="mt-1 rounded border-outline text-primary focus:ring-primary" type="checkbox" disabled>
          <div>
            <p class="font-label-md text-label-md group-hover:text-primary">${title}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${detail}</p>
          </div>
        </label>
      `;
    }).join('');
  }

  function renderMaterialInventory() {
    const tbody = Array.from(document.querySelectorAll('table tbody')).find(body => body.closest('section')?.innerText.includes('Material Inventory Status'));
    if (!tbody) return;

    let materials = [];
    try {
      materials = JSON.parse(localStorage.getItem('eden_raw_materials')) || [];
    } catch (err) {
      materials = [];
    }
    if (!materials.length) {
      materials = [
        { name: 'Refined PET Flakes', category: 'plastic_bottles', quantity_kg: 2400, reorder_threshold_kg: 5000 },
        { name: 'HDPE Pellets', category: 'hdpe', quantity_kg: 42850, reorder_threshold_kg: 8000 },
        { name: 'LDPE Film', category: 'ldpe', quantity_kg: 8500, reorder_threshold_kg: 3000 }
      ];
    }

    tbody.innerHTML = materials.slice(0, 5).map(material => {
      const quantity = Number(material.quantity_kg || 0);
      const threshold = Number(material.reorder_threshold_kg || 1);
      const percent = Math.max(4, Math.min(100, Math.round((quantity / (threshold * 3)) * 100)));
      const low = quantity <= threshold;
      const icon = material.category === 'hdpe' ? 'package' : material.category === 'ldpe' ? 'opacity' : 'eco';
      return `
        <tr>
          <td class="px-md py-md">
            <div class="flex items-center gap-sm">
              <div class="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center ${low ? 'text-secondary' : 'text-primary'}">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">${icon}</span>
              </div>
              <p class="font-label-md text-label-md">${window.edenUtils.escapeHTML(material.name)}</p>
            </div>
          </td>
          <td class="px-md py-md font-body-md text-body-md">${quantity.toLocaleString('en-KE')}</td>
          <td class="px-md py-md">
            <div class="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div class="${low ? 'bg-secondary' : 'bg-primary'} h-full" style="width: ${percent}%"></div>
            </div>
          </td>
          <td class="px-md py-md">
            <span class="${low ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-primary-fixed-dim text-on-primary-fixed'} px-xs py-0.5 rounded text-label-sm font-label-sm uppercase">${low ? 'Low Stock' : 'Optimal'}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderEkoProductionPanel() {
    const grid = document.querySelector('.bento-grid');
    if (!grid || document.getElementById('eko-production-panel')) return;

    const materials = readJson('eden_raw_materials', []);
    const products = readJson('eden_finished_products', []);
    const ekoProduct = products.find(product => String(product.name || '').toLowerCase().includes('eko shoe polish')) || {
      name: 'EKO Shoe Polish',
      sku: 'FIN-EKO-01',
      quantity_kg: 0,
      unit_price: 320
    };
    const recipe = getEkoRecipe(ekoProduct);
    const ekoMaterialNames = new Set(recipe.map(item => item.material_name));
    const ekoMaterials = materials.filter(material => ekoMaterialNames.has(material.name));
    const limiting = recipe.map(item => {
      const material = materials.find(row => row.name === item.material_name);
      const availableKg = Number(material?.quantity_kg || 0);
      const kgPerKg = Number(item.kg_per_kg || 0);
      return {
        ...item,
        availableKg,
        possibleOutputKg: kgPerKg > 0 ? Math.floor(availableKg / kgPerKg) : 0,
        low: material ? availableKg <= Number(material.reorder_threshold_kg || 0) : true
      };
    }).sort((a, b) => a.possibleOutputKg - b.possibleOutputKg)[0];
    const possibleOutput = limiting ? limiting.possibleOutputKg : 0;

    const panel = document.createElement('section');
    panel.id = 'eko-production-panel';
    panel.className = 'col-span-12';
    panel.innerHTML = `
      <div class="bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
        <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-lg mb-lg">
          <div>
            <p class="font-label-sm text-label-sm text-primary uppercase tracking-wider">EKO Shoe Polish Production</p>
            <h3 class="font-headline-md text-headline-md text-on-surface">Input Readiness & Formula</h3>
            <p class="font-body-md text-body-md text-on-surface-variant max-w-3xl">Raw materials and packaging required to produce ${window.edenUtils.escapeHTML(ekoProduct.sku || 'FIN-EKO-01')}. Inventory owns stock levels; Production owns conversion planning and batch readiness.</p>
          </div>
          <div class="flex flex-wrap gap-sm">
            <span class="px-sm py-xs rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm">${Number(ekoProduct.quantity_kg || 0).toLocaleString('en-KE')} kg finished stock</span>
            <span class="px-sm py-xs rounded-full ${possibleOutput > 100 ? 'bg-primary-fixed-dim text-on-primary-fixed' : 'bg-error-container text-on-error-container'} font-label-sm text-label-sm">${possibleOutput.toLocaleString('en-KE')} kg possible next run</span>
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-md">
          <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-sm">
            ${recipe.map(item => {
              const material = ekoMaterials.find(row => row.name === item.material_name);
              const quantity = Number(material?.quantity_kg || 0);
              const threshold = Number(material?.reorder_threshold_kg || 0);
              const low = material ? quantity <= threshold : true;
              return `
                <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">
                  <div class="flex items-start justify-between gap-sm">
                    <div>
                      <p class="font-label-md text-label-md text-on-surface">${window.edenUtils.escapeHTML(item.material_name)}</p>
                      <p class="font-body-sm text-body-sm text-on-surface-variant">${Number(item.kg_per_kg || 0).toLocaleString('en-KE')} kg per kg output</p>
                    </div>
                    <span class="material-symbols-outlined ${low ? 'text-error' : 'text-primary'}">${low ? 'warning' : 'check_circle'}</span>
                  </div>
                  <p class="mt-sm font-headline-sm text-headline-sm ${low ? 'text-error' : 'text-on-surface'}">${quantity.toLocaleString('en-KE')} kg</p>
                  <div class="mt-xs h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div class="${low ? 'bg-error' : 'bg-primary'} h-full" style="width:${Math.min(100, Math.round((quantity / Math.max(1, threshold * 2)) * 100))}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="p-md rounded-xl bg-primary-container/10 border border-primary-container/20">
            <h4 class="font-headline-sm text-headline-sm text-on-surface">Batch Planning</h4>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-xs">Constraint: ${window.edenUtils.escapeHTML(limiting?.material_name || 'Not enough recipe data')} limits the next run.</p>
            <dl class="mt-md space-y-sm">
              <div class="flex justify-between gap-md"><dt class="font-label-sm text-label-sm text-on-surface-variant">SKU</dt><dd class="font-label-md text-label-md">${window.edenUtils.escapeHTML(ekoProduct.sku || 'FIN-EKO-01')}</dd></div>
              <div class="flex justify-between gap-md"><dt class="font-label-sm text-label-sm text-on-surface-variant">Unit Price</dt><dd class="font-label-md text-label-md">KES ${Number(ekoProduct.unit_price || 0).toLocaleString('en-KE')}</dd></div>
              <div class="flex justify-between gap-md"><dt class="font-label-sm text-label-sm text-on-surface-variant">Inputs Tracked</dt><dd class="font-label-md text-label-md">${recipe.length}</dd></div>
            </dl>
            <button type="button" data-start-eko-batch class="mt-md w-full px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all">Start EKO Batch</button>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(panel);

    panel.querySelector('[data-start-eko-batch]')?.addEventListener('click', async () => {
      if (!window.productionModule?.startBatch) {
        window.edenUtils?.showToast('Production batch engine is not available.', 'error');
        return;
      }
      const wax = materials.find(material => material.name === 'Paraffin Wax') || materials.find(material => String(material.category).includes('eko_shoe_polish'));
      const started = await window.productionModule.startBatch({
        product_name: 'EKO Shoe Polish',
        raw_material_id: wax?.id || 'raw-6',
        raw_material_name: wax?.name || 'Paraffin Wax',
        input_kg: 25,
        machine_id: 'eko-line-1',
        machine_name: 'EKO Polish Mixer',
        notes: 'EKO shoe polish trial batch from Production Console'
      });
      window.edenUtils?.showToast(started ? 'EKO production batch started.' : 'Could not start EKO batch.', started ? 'success' : 'error');
      if (started) renderProductionPage();
    });
  }

  function getEkoRecipe(product) {
    if (Array.isArray(product.recipe) && product.recipe.length) return product.recipe;
    return [
      { material_name: 'Paraffin Wax', kg_per_kg: 0.28 },
      { material_name: 'Carnauba Wax', kg_per_kg: 0.12 },
      { material_name: 'Beeswax', kg_per_kg: 0.10 },
      { material_name: 'Carbon Black Pigment', kg_per_kg: 0.08 },
      { material_name: 'Mineral Oil', kg_per_kg: 0.22 },
      { material_name: 'Turpentine Solvent', kg_per_kg: 0.18 },
      { material_name: 'Polish Tins & Labels', kg_per_kg: 0.02 }
    ];
  }

  function setMetricAfterLabel(label, value) {
    const labelEl = Array.from(document.querySelectorAll('p')).find(el => el.innerText.trim().toUpperCase() === label);
    const valueEl = labelEl?.parentElement?.querySelector('.font-headline-md');
    if (valueEl) valueEl.innerText = value;
  }

  async function bindInventoryPage() {
    if (!window.inventoryModule) return;

    bindInventoryButtons();
    await renderInventoryPage();
  }

  function bindInventoryButtons() {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const addButtons = [
      ...allButtons.filter(button => button.innerText.trim().includes('Add Batch')),
      ...document.querySelectorAll('[data-inventory-action="add-batch"]'),
      ...Array.from(document.querySelectorAll('button')).filter(button => button.querySelector('.material-symbols-outlined')?.innerText.trim() === 'add')
    ];

    addButtons.forEach(button => {
      if (button.dataset.inventoryBound) return;
      button.dataset.inventoryBound = 'add-batch';
      button.addEventListener('click', () => showInventoryBatchModal());
    });

    const exportButtons = [
      ...allButtons.filter(button => button.innerText.includes('Export PDF')),
      ...document.querySelectorAll('[data-inventory-action="export"]')
    ];
    exportButtons.forEach(button => {
      if (button.dataset.inventoryBound) return;
      button.dataset.inventoryBound = 'export';
      button.innerHTML = button.innerText.includes('PDF') ? 'Export CSV' : button.innerHTML;
      button.addEventListener('click', exportInventoryCsv);
    });

    const reorderButton = allButtons.find(button => button.innerText.includes('Trigger Reorder'));
    if (reorderButton && !reorderButton.dataset.inventoryBound) {
      reorderButton.dataset.inventoryBound = 'reorder';
      reorderButton.addEventListener('click', async () => {
        const lowStock = await window.inventoryModule.getLowStockMaterials();
        const material = lowStock[0];
        if (!material) {
          window.edenUtils?.showToast('No low stock items need reordering.', 'success');
          return;
        }
        createInventoryTask(material, 'single');
        window.edenUtils?.showToast(`Reorder task opened for ${material.name}.`, 'success');
        await renderInventoryPage();
      });
    }

    const automateButton = allButtons.find(button => button.innerText.includes('Automate Restock Flow'));
    if (automateButton && !automateButton.dataset.inventoryBound) {
      automateButton.dataset.inventoryBound = 'restock';
      automateButton.addEventListener('click', async () => {
        const lowStock = await window.inventoryModule.getLowStockMaterials();
        if (!lowStock.length) {
          window.edenUtils?.showToast('All material levels are healthy.', 'success');
          return;
        }
        lowStock.forEach(material => createInventoryTask(material, 'flow'));
        window.edenUtils?.showToast(`${lowStock.length} restock workflow${lowStock.length === 1 ? '' : 's'} queued for procurement.`, 'success');
        await renderInventoryPage();
      });
    }

    const linkSupplier = allButtons.find(button => button.innerText.includes('Link New Supplier'));
    if (linkSupplier && !linkSupplier.dataset.inventoryBound) {
      linkSupplier.dataset.inventoryBound = 'supplier';
      linkSupplier.addEventListener('click', showSupplierModal);
    }

    const searchButtons = allButtons.filter(button => button.querySelector('.material-symbols-outlined')?.innerText.trim() === 'search');
    searchButtons.forEach(button => {
      if (button.dataset.inventoryBound) return;
      button.dataset.inventoryBound = 'search';
      button.addEventListener('click', () => {
        const input = document.querySelector('[data-inventory-search]');
        if (input && input.getBoundingClientRect().width > 0) input.focus();
        else showInventorySearchOverlay();
      });
    });

    document.querySelectorAll('[data-inventory-search]').forEach(input => {
      if (input.dataset.inventoryBound) return;
      input.dataset.inventoryBound = 'search';
      input.addEventListener('input', () => {
        renderInventoryPage(input.value.trim().toLowerCase());
      });
    });
  }

  async function renderInventoryPage(filter = '') {
    const [materials, suppliers, batches, stats] = await Promise.all([
      window.inventoryModule.getRawMaterials(),
      window.inventoryModule.getSuppliers(),
      window.inventoryModule.getBatches(),
      window.inventoryModule.getSummaryStats()
    ]);

    renderInventoryKpis(materials, batches, stats);
    renderInventoryBatches(batches, filter);
    renderSupplierDirectory(suppliers, filter);
    renderInventoryForecast(materials, suppliers);
    bindInventoryButtons();
  }

  function renderInventoryKpis(materials, batches, stats) {
    const rawCard = findCardByLabel('Raw Plastics');
    const rawValue = rawCard?.querySelector('h3');
    const rawBar = rawCard?.querySelector('.h-full');
    const rawCaption = rawCard?.querySelector('.font-label-sm.text-outline');
    const totalRaw = Number(stats.totalRawKg || 0);
    const capacity = 65000;
    if (rawValue) rawValue.innerText = `${totalRaw.toLocaleString('en-KE')} kg`;
    if (rawBar) rawBar.style.width = `${Math.min(100, Math.round((totalRaw / capacity) * 100))}%`;
    if (rawCaption) rawCaption.innerText = `${Math.min(100, Math.round((totalRaw / capacity) * 100))}% of warehouse capacity`;

    const batchCard = findCardByLabel('Processing Batches');
    const batchValue = batchCard?.querySelector('h3');
    const batchCaption = batchCard?.querySelector('.font-label-sm.text-outline');
    const activeBatches = batches.filter(batch => ['processing', 'in_transit', 'stored'].includes(String(batch.status).toLowerCase()));
    if (batchValue) batchValue.innerText = `${activeBatches.length} Active`;
    if (batchCaption) batchCaption.innerText = `${batches.filter(batch => batch.status === 'in_transit').length} inbound batch${batches.filter(batch => batch.status === 'in_transit').length === 1 ? '' : 'es'}`;

    const alertCard = findCardByLabel('Low Stock Alerts');
    const lowItems = stats.lowStockItems || [];
    const alertTitle = alertCard?.querySelector('h3');
    const alertDetail = alertCard?.querySelector('.font-body-sm');
    const alertChip = document.querySelector('header .bg-error-container .font-label-sm');
    if (alertTitle) alertTitle.innerText = lowItems[0]?.name || 'None';
    if (alertDetail) {
      alertDetail.innerText = lowItems[0]
        ? `Current: ${Number(lowItems[0].quantity_kg || 0).toLocaleString('en-KE')}kg | Threshold: ${Number(lowItems[0].reorder_threshold_kg || 0).toLocaleString('en-KE')}kg`
        : 'Every tracked raw material is above its reorder threshold.';
    }
    if (alertChip) alertChip.innerText = `${lowItems.length} LOW STOCK ALERT${lowItems.length === 1 ? '' : 'S'}`;
  }

  function renderInventoryBatches(batches, filter) {
    const tbody = Array.from(document.querySelectorAll('table tbody')).find(body => body.closest('section')?.innerText.includes('Material Batch Tracking'));
    if (!tbody) return;

    const rows = batches.filter(batch => {
      const haystack = `${batch.id} ${batch.batch_code || ''} ${batch.material_name || ''} ${batch.supplier_name || ''} ${batch.status || ''}`.toLowerCase();
      return !filter || haystack.includes(filter);
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-lg py-xl text-center text-on-surface-variant font-body-md">No matching batches found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((batch, index) => {
      const status = String(batch.status || 'stored').toLowerCase();
      const dot = status === 'processing' ? 'bg-secondary' : status === 'in_transit' ? 'bg-tertiary' : 'bg-primary';
      return `
        <tr class="${index % 2 ? 'bg-surface-container-low' : ''} hover:bg-surface-container-high transition-colors cursor-pointer" data-batch-id="${batch.id}">
          <td class="px-lg py-md font-body-md text-body-md font-bold">#${window.edenUtils.escapeHTML(String(batch.id || batch.batch_code || 'BATCH').toUpperCase())}</td>
          <td class="px-lg py-md">
            <div class="flex items-center gap-xs">
              <span class="w-2 h-2 rounded-full ${dot}"></span>
              <span class="font-body-md text-body-md">${window.edenUtils.escapeHTML(batch.material_name || batch.product_name || 'Unassigned material')}</span>
            </div>
          </td>
          <td class="px-lg py-md font-body-md text-body-md">${Number(batch.weight_kg || batch.raw_material_used_kg || 0).toLocaleString('en-KE')} kg</td>
          <td class="px-lg py-md font-body-md text-body-md">${window.edenUtils.escapeHTML(batch.supplier_name || 'Internal transfer')}</td>
          <td class="px-lg py-md">${statusBadge(status)}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-batch-id]').forEach(row => {
      row.addEventListener('click', () => {
        const batch = batches.find(item => item.id === row.dataset.batchId);
        if (batch) showInventoryDetail('Batch Detail', [
          ['Batch ID', `#${String(batch.id).toUpperCase()}`],
          ['Material', batch.material_name || 'Unassigned'],
          ['Weight', `${Number(batch.weight_kg || 0).toLocaleString('en-KE')} kg`],
          ['Supplier', batch.supplier_name || 'Internal transfer'],
          ['Status', String(batch.status || 'stored').replace(/_/g, ' ')],
          ['Received', batch.received_date || 'Pending']
        ]);
      });
    });
  }

  function renderSupplierDirectory(suppliers, filter) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Supplier Directory'));
    const list = section?.querySelector('.space-y-md');
    if (!list) return;

    const rows = suppliers.filter(supplier => {
      const haystack = `${supplier.name} ${supplier.material_type} ${supplier.contact_name} ${supplier.status}`.toLowerCase();
      return !filter || haystack.includes(filter);
    });

    if (!rows.length) {
      list.innerHTML = '<div class="p-lg text-center border border-dashed border-outline rounded-xl text-on-surface-variant">No matching suppliers.</div>';
      return;
    }

    list.innerHTML = rows.map((supplier, index) => {
      const status = String(supplier.status || 'active').toLowerCase();
      const label = status === 'delayed' ? 'Delayed' : Number(supplier.rating || 0) >= 4.5 ? 'Reliable' : 'In Process';
      const textClass = status === 'delayed' ? 'text-error' : Number(supplier.rating || 0) >= 4.5 ? 'text-primary' : 'text-secondary';
      const icon = status === 'delayed' ? 'report_problem' : Number(supplier.rating || 0) >= 4.5 ? 'verified' : 'schedule';
      const image = [
        'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=96&q=70',
        'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=96&q=70',
        'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=96&q=70'
      ][index % 3];
      return `
        <button type="button" class="glass-card p-md rounded-xl flex items-center gap-md hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer text-left w-full" data-supplier-id="${supplier.id}">
          <div class="w-12 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0">
            <img alt="${supplier.name}" class="w-full h-full object-cover" src="${image}">
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-label-md text-label-md text-on-surface truncate">${window.edenUtils.escapeHTML(supplier.name)}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant truncate">Primary: ${window.edenUtils.escapeHTML(supplier.material_type || 'Mixed supply')}</p>
          </div>
          <div class="flex flex-col items-end">
            <span class="font-label-sm text-label-sm ${textClass}">${label}</span>
            <span class="material-symbols-outlined text-sm ${textClass}">${icon}</span>
          </div>
        </button>
      `;
    }).join('');

    list.querySelectorAll('[data-supplier-id]').forEach(button => {
      button.addEventListener('click', () => {
        const supplier = suppliers.find(item => item.id === button.dataset.supplierId);
        if (supplier) showInventoryDetail('Supplier Detail', [
          ['Supplier', supplier.name],
          ['Contact', supplier.contact_name || 'Not assigned'],
          ['Phone', supplier.contact_phone || 'Not captured'],
          ['Email', supplier.email || 'Not captured'],
          ['Material', supplier.material_type || 'Mixed supply'],
          ['Rating', `${Number(supplier.rating || 0).toFixed(1)} / 5`],
          ['Status', String(supplier.status || 'active').replace(/_/g, ' ')]
        ]);
      });
    });
  }

  function renderInventoryForecast(materials, suppliers) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Stock Forecast Analysis'));
    const copy = section?.querySelector('p.font-body-md');
    if (!copy) return;

    const ranked = materials
      .map(material => ({
        ...material,
        daysRemaining: Math.max(1, Math.round(Number(material.quantity_kg || 0) / Math.max(120, Number(material.reorder_threshold_kg || 1) / 12)))
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
    const material = ranked[0];
    if (!material) return;
    const supplier = suppliers.find(item => item.id === material.supplier_id);
    copy.innerHTML = `Based on current production speed, <span class="font-bold">${escapeHTML(material.name)}</span> inventory will reach critical levels in <span class="font-bold">${material.daysRemaining} days</span>. Schedule a batch from ${escapeHTML(supplier?.name || material.supplier_name || 'the preferred supplier')} before the next production run.`;
  }

  function showInventoryBatchModal() {
    Promise.all([
      window.inventoryModule.getRawMaterials(),
      window.inventoryModule.getSuppliers()
    ]).then(([materials, suppliers]) => {
      const overlay = createAppModal('Add Stock Batch', `
        <form data-inventory-batch-form class="space-y-md">
          <label class="block">
            <span class="font-label-sm text-label-sm text-on-surface-variant">Material</span>
            <select name="material_id" required class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
              ${materials.map(material => `<option value="${escapeHTML(material.id)}">${escapeHTML(material.name)}</option>`).join('')}
            </select>
          </label>
          <label class="block">
            <span class="font-label-sm text-label-sm text-on-surface-variant">Weight (kg)</span>
            <input name="weight_kg" required min="1" type="number" value="500" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
          </label>
          <label class="block">
            <span class="font-label-sm text-label-sm text-on-surface-variant">Supplier</span>
            <select name="supplier_id" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
              ${suppliers.map(supplier => `<option value="${escapeHTML(supplier.id)}">${escapeHTML(supplier.name)}</option>`).join('')}
            </select>
          </label>
          <label class="block">
            <span class="font-label-sm text-label-sm text-on-surface-variant">Status</span>
            <select name="status" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
              <option value="stored">Stored</option>
              <option value="processing">Processing</option>
              <option value="in_transit">In Transit</option>
            </select>
          </label>
          <div class="flex justify-end gap-sm pt-sm">
            <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Cancel</button>
            <button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all">Save Batch</button>
          </div>
        </form>
      `);

      overlay.querySelector('[data-inventory-batch-form]').addEventListener('submit', async event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const material = materials.find(item => item.id === data.get('material_id'));
        const supplier = suppliers.find(item => item.id === data.get('supplier_id'));
        const saved = await window.inventoryModule.addBatch({
          material_id: material?.id,
          material_name: material?.name,
          supplier_id: supplier?.id,
          supplier_name: supplier?.name,
          weight_kg: Number(data.get('weight_kg')),
          status: data.get('status')
        });
        overlay.remove();
        window.edenUtils?.showToast(saved ? `Stock batch ${String(saved.id).toUpperCase()} added.` : 'Could not save stock batch.', saved ? 'success' : 'error');
        if (saved) await renderInventoryPage();
      });
    });
  }

  function showSupplierModal() {
    const overlay = createAppModal('Link New Supplier', `
      <form data-supplier-form class="space-y-md">
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Supplier name</span>
          <input name="name" required class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Supplier Ltd">
        </label>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Primary material</span>
          <input name="material_type" required class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="PET Flakes">
        </label>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Contact person</span>
          <input name="contact_name" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Operations contact">
        </label>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Phone</span>
          <input name="contact_phone" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="+254...">
        </label>
        <div class="flex justify-end gap-sm pt-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Cancel</button>
          <button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all">Link Supplier</button>
        </div>
      </form>
    `);
    overlay.querySelector('[data-supplier-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const supplier = await window.inventoryModule.addSupplier({ ...data, status: 'active', rating: 4.0 });
      overlay.remove();
      window.edenUtils?.showToast(supplier ? `${supplier.name} linked to Inventory.` : 'Could not link supplier.', supplier ? 'success' : 'error');
      if (supplier) await renderInventoryPage();
    });
  }

  function showInventorySearchOverlay() {
    const overlay = createAppModal('Search Inventory', `
      <input data-floating-inventory-search class="w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Search batches or suppliers" type="search" autofocus>
      <p class="mt-sm text-body-sm text-on-surface-variant">Results update on the Inventory page as you type.</p>
    `);
    const input = overlay.querySelector('[data-floating-inventory-search]');
    input.addEventListener('input', () => renderInventoryPage(input.value.trim().toLowerCase()));
    setTimeout(() => input.focus(), 50);
  }

  function showInventoryDetail(title, rows) {
    createAppModal(title, `
      <dl class="divide-y divide-outline-variant">
        ${rows.map(([label, value]) => `
          <div class="py-sm flex justify-between gap-md">
            <dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${escapeHTML(label)}</dt>
            <dd class="font-body-md text-body-md text-on-surface text-right">${escapeHTML(value)}</dd>
          </div>
        `).join('')}
      </dl>
      <div class="flex justify-end pt-md">
        <button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button>
      </div>
    `);
  }

  function createAppModal(title, bodyHtml, eyebrow = 'Inventory Control', maxWidthClass = 'max-w-lg') {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm flex items-center justify-center p-md';
    overlay.innerHTML = `
      <div class="w-full ${maxWidthClass} max-h-[88vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-lg transform transition-all scale-95 opacity-0" data-modal-card>
        <div class="flex items-start justify-between gap-md mb-md">
          <div>
            <p class="font-label-sm text-label-sm text-primary uppercase">${escapeHTML(eyebrow)}</p>
            <h3 class="font-headline-md text-headline-md text-on-surface">${escapeHTML(title)}</h3>
          </div>
          <button type="button" data-modal-close class="material-symbols-outlined p-xs rounded-full hover:bg-surface-container-high">close</button>
        </div>
        ${bodyHtml}
      </div>
    `;
    document.body.appendChild(overlay);
    const card = overlay.querySelector('[data-modal-card]');
    requestAnimationFrame(() => {
      card.classList.remove('scale-95', 'opacity-0');
      card.classList.add('scale-100', 'opacity-100');
    });
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-modal-close]')) overlay.remove();
    });
    return overlay;
  }

  async function exportInventoryCsv() {
    const [materials, batches, suppliers] = await Promise.all([
      window.inventoryModule.getRawMaterials(),
      window.inventoryModule.getBatches(),
      window.inventoryModule.getSuppliers()
    ]);
    const rows = [
      ['Type', 'Name/ID', 'Material', 'Quantity/Weight Kg', 'Supplier', 'Status'],
      ...materials.map(material => ['Material', material.id, material.name, material.quantity_kg, material.supplier_name || '', material.quantity_kg <= material.reorder_threshold_kg ? 'low_stock' : 'healthy']),
      ...batches.map(batch => ['Batch', batch.id, batch.material_name || '', batch.weight_kg || '', batch.supplier_name || '', batch.status || 'stored']),
      ...suppliers.map(supplier => ['Supplier', supplier.id, supplier.material_type || '', '', supplier.name, supplier.status || 'active'])
    ];
    const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadTextFile(`eden-inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    window.edenUtils?.showToast('Inventory export downloaded.', 'success');
  }

  function createInventoryTask(material, mode) {
    const tasks = readJson('eden_tasks', []);
    const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 999)}`;
    const neededKg = Math.max(0, Number(material.reorder_threshold_kg || 0) * 2 - Number(material.quantity_kg || 0));
    tasks.unshift({
      id: taskId,
      title: `${mode === 'flow' ? 'Automated restock' : 'Reorder'}: ${material.name}`,
      description: `Raise procurement for ${neededKg.toLocaleString('en-KE')} kg of ${material.name}. Current stock is ${Number(material.quantity_kg || 0).toLocaleString('en-KE')} kg against a ${Number(material.reorder_threshold_kg || 0).toLocaleString('en-KE')} kg threshold.`,
      department: 'Inventory',
      priority: 'high',
      status: 'open',
      assigned_to: 'Procurement Lead',
      source_module: 'supplier_inventory',
      related_material_id: material.id,
      due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));

    const notificationKey = `eden_notifications_${window.appState.user.id || 'local'}`;
    const notifications = readJson(notificationKey, []);
    notifications.unshift({
      id: `notif-${Date.now()}`,
      type: 'inventory_reorder',
      title: 'Inventory reorder queued',
      message: `${material.name} restock task is ready for Procurement and HR tasking.`,
      read: false,
      created_at: new Date().toISOString(),
      task_id: taskId
    });
    localStorage.setItem(notificationKey, JSON.stringify(notifications));
  }

  function findCardByLabel(label) {
    return Array.from(document.querySelectorAll('section .rounded-xl')).find(card => card.innerText.toLowerCase().includes(label.toLowerCase()));
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (err) {
      return fallback;
    }
  }

  function bindSustainabilityPage() {
    const dateButton = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('Last 30 Days'));
    if (dateButton && !dateButton.dataset.boundSustainability) {
      dateButton.dataset.boundSustainability = 'true';
      const ranges = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days'];
      dateButton.addEventListener('click', () => {
        const current = ranges.findIndex(range => dateButton.innerText.includes(range));
        const next = ranges[(current + 1) % ranges.length];
        const icon = dateButton.querySelector('.material-symbols-outlined')?.outerHTML || '<span class="material-symbols-outlined text-[18px]">calendar_today</span>';
        dateButton.innerHTML = `${icon} ${next}`;
        updateSustainabilityRange(next);
        window.edenUtils?.showToast(`Analytics range set to ${next}.`, 'info');
      });
    }

    const downloadButton = Array.from(document.querySelectorAll('button')).find(button => button.innerText.trim() === 'Download Report');
    if (downloadButton && !downloadButton.dataset.boundSustainability) {
      downloadButton.dataset.boundSustainability = 'true';
      downloadButton.addEventListener('click', () => {
        const rows = collectSustainabilityRows();
        const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        downloadTextFile(`eden-sustainability-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
        window.edenUtils?.showToast('Sustainability report downloaded.', 'success');
      });
    }
  }

  function updateSustainabilityRange(rangeLabel) {
    const multiplier = rangeLabel.includes('7') ? 0.32 : rangeLabel.includes('90') ? 2.8 : 1;
    const cards = Array.from(document.querySelectorAll('.bento-card'));
    const values = [
      `${(1248.5 * multiplier).toLocaleString('en-KE', { maximumFractionDigits: 1 })} <span class="text-body-md font-normal text-on-surface-variant">tons</span>`,
      `${Math.round(3490 * multiplier).toLocaleString('en-KE')} <span class="text-body-md font-normal text-on-surface-variant">kg</span>`,
      `${(22.8 * (rangeLabel.includes('90') ? 0.7 : rangeLabel.includes('7') ? 1.2 : 1)).toFixed(1)}<span class="text-body-md font-normal text-on-surface-variant">%</span>`
    ];

    cards.slice(0, 3).forEach((card, index) => {
      const value = card.querySelector('h3');
      if (value && values[index]) value.innerHTML = values[index];
    });
  }

  function collectSustainabilityRows() {
    const rows = [['Metric', 'Value']];
    Array.from(document.querySelectorAll('.bento-card')).slice(0, 3).forEach(card => {
      const label = card.querySelector('p')?.innerText.trim();
      const value = card.querySelector('h3')?.innerText.trim().replace(/\s+/g, ' ');
      if (label && value) rows.push([label, value]);
    });
    return rows;
  }

  function downloadTextFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function isLocalDev() {
    return ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  }

  function pageHref(page) {
    return isLocalDev() ? `${page}?fresh=${Date.now()}` : page;
  }

  function navigateTo(page) {
    if (window.location.pathname.split('/').pop() === page) {
      window.edenUtils?.showToast('You are already on this page.', 'info');
      return;
    }
    window.location.href = pageHref(page);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  }

  function replaceCounter(counters, currentValue, nextValue) {
    counters.forEach(counter => {
      if (counter.innerText.trim() === currentValue) counter.innerText = nextValue;
    });
  }

  function formatCollectionDate(dateStr) {
    if (!dateStr) return 'Unscheduled';
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today ? 'Today' : (window.edenUtils?.formatDate(dateStr) || dateStr);
  }

  function statusBadge(status = 'scheduled') {
    const label = String(status).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const key = String(status).toLowerCase();
    const positive = ['received', 'paid', 'success', 'completed', 'weighed'].includes(key);
    const warning = ['in_transit', 'sent', 'pending', 'scheduled', 'partial'].includes(key);
    const cls = positive ? 'bg-primary/10 text-primary' : warning ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant';
    return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${label}</span>`;
  }
})();
