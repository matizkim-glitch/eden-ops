// js/routes/collection/page.js
// Collection page controller: school pickups, route actions, collection receiving, and inventory handoff.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['waste_collection.html'] = bindCollectionPage;
  window.edenPageControllers['school_collection_flow.html'] = bindCollectionPage;

  async function bindCollectionPage() {
    if (!window.collectionModule) return;
    ensureCollectionHeaderActions();
    bindCollectionButtons();
    await renderCollectionPage();
  }

  function ensureCollectionHeaderActions() {
    const header = document.querySelector('header');
    if (!header || header.querySelector('[data-collection-header-actions]')) return;
    const rightCluster = Array.from(header.children).find(child => child.classList?.contains('flex') && child.classList?.contains('items-center')) ||
      Array.from(header.querySelectorAll('.flex.items-center')).find(el => !el.closest('button, a'));
    if (!rightCluster) return;
    const actions = document.createElement('div');
    actions.dataset.collectionHeaderActions = 'true';
    actions.className = 'hidden lg:flex items-center gap-xs';
    actions.innerHTML = `
      <button type="button" data-collection-action="log" class="flex items-center gap-xs px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90 active:scale-95 transition-all"><span class="material-symbols-outlined text-[18px]">add</span>Log</button>
      <button type="button" data-collection-action="route" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low"><span class="material-symbols-outlined text-[18px]">route</span>Route</button>
      <button type="button" data-collection-action="schools" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low"><span class="material-symbols-outlined text-[18px]">school</span>Schools</button>
      <button type="button" data-collection-action="export" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low"><span class="material-symbols-outlined text-[18px]">download</span>Export</button>
    `;
    rightCluster.insertBefore(actions, rightCluster.firstChild);
  }

  function bindCollectionButtons() {
    document.querySelectorAll('[data-collection-action]').forEach(button => {
      bindOne(button, `header-${button.dataset.collectionAction}`, async () => {
        const action = button.dataset.collectionAction;
        if (action === 'log') return openEntryModal();
        if (action === 'route') return showRoutePlanner();
        if (action === 'schools') return showSchoolsDirectory();
        if (action === 'export') return exportCollectionsCsv();
      });
    });

    Array.from(document.querySelectorAll('button')).forEach(button => {
      const text = button.innerText.trim().toLowerCase();
      if (text.includes('log collection')) bindOne(button, 'open-log-modal', openEntryModal);
      if (text.includes('view full history') || text.includes('view historical')) bindOne(button, 'history', showCollectionHistory);
      if (text.includes('manage schedule')) bindOne(button, 'schedule', showRoutePlanner);
      if (text.includes('onboard new school')) bindOne(button, 'onboard-school', showSchoolModal);
      if (text.includes('view all standings')) bindOne(button, 'standings', showSchoolsDirectory);
      if (text.includes('clear fields')) bindOne(button, 'clear-school-fields', clearSchoolCollectionFields);
      if (text.includes('submit data record')) bindOne(button, 'submit-school-record', submitSchoolCollectionForm);
    });
  }

  async function renderCollectionPage() {
    const [collections, schools] = await Promise.all([
      window.collectionModule.getCollections(),
      window.collectionModule.getSchools()
    ]);
    const locatedSchools = ensureSchoolLocations(schools);

    wireEntryForm(locatedSchools);
    renderKpis(collections);
    renderInteractiveRouteMap(collections, locatedSchools);
    renderPickupTable(collections);
    renderRecentActivity(collections);
    renderRouteBoard(collections, locatedSchools);
    renderSchoolsImpactPanel(collections, locatedSchools);
    bindCollectionButtons();
  }

  function wireEntryForm(schools) {
    const modal = document.getElementById('entry-modal');
    const form = modal?.querySelector('form');
    if (!form || form.dataset.collectionRouteBound) return;
    form.dataset.collectionRouteBound = 'true';
    form.removeAttribute('onsubmit');
    const schoolSelect = form.querySelector('select');
    const wasteTypeSelect = form.querySelectorAll('select')[1];
    if (schoolSelect) {
      schoolSelect.innerHTML = '<option value="">Select School...</option>' + schools.map(school => `<option value="${school.id}">${school.name}</option>`).join('');
    }
    if (wasteTypeSelect) wasteTypeSelect.innerHTML = wasteTypeOptions();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      await submitCollectionForm(form, modal);
    });
  }

  function renderKpis(collections) {
    const today = todayIso();
    const todayRows = collections.filter(item => item.collection_date === today && item.status !== 'cancelled');
    const activeRows = todayRows.length ? todayRows : collections.filter(item => !['received', 'cancelled'].includes(String(item.status).toLowerCase()));
    const totalWeight = activeRows.reduce((sum, item) => sum + Number(item.weight_kg || 0), 0);
    const completed = activeRows.filter(item => ['weighed', 'received'].includes(item.status)).length;
    setText('kpi-pickups', `${activeRows.length} Schools`);
    setText('kpi-weight', `${totalWeight.toLocaleString('en-KE')} kg`);
    setText('kpi-completed', `${completed} / ${activeRows.length}`);
    setText('kpi-target', `${Math.max(500, Math.ceil(totalWeight / 100) * 100).toLocaleString('en-KE')} kg`);
  }

  function renderPickupTable(collections) {
    const tbody = Array.from(document.querySelectorAll('main table tbody')).find(body => {
      const container = body.closest('.bg-surface-container-lowest, .bg-white, section, div');
      return container?.innerText.includes('Upcoming School Pickups') || container?.innerText.includes("Today's Collection Log");
    }) || document.querySelector('main table tbody');
    if (!tbody) return;
    const todayRows = collections.filter(item => item.collection_date === todayIso() && item.status !== 'cancelled');
    const activeRows = collections.filter(item => !['received', 'cancelled'].includes(String(item.status).toLowerCase()));
    const rows = (todayRows.length ? todayRows : activeRows.length ? activeRows : collections).sort((a, b) => statusRank(a.status) - statusRank(b.status)).slice(0, 8);
    tbody.innerHTML = rows.map((item, index) => `
      <tr class="${index % 2 ? 'bg-surface-container-lowest/50' : ''} hover:bg-surface-container-low transition-colors cursor-pointer" data-collection-row="${item.id}">
        <td class="px-md py-md font-body-md text-body-md font-bold">${item.school_name || 'Unknown School'}</td>
        <td class="px-md py-md font-body-md text-body-md">${Number(item.weight_kg || 0).toLocaleString('en-KE')} kg</td>
        <td class="px-md py-md font-body-md text-body-md">${formatCollectionDate(item.collection_date)}</td>
        <td class="px-md py-md">${statusBadge(item.status)}</td>
        <td class="px-md py-md">
          <div class="flex flex-wrap gap-xs">
            <button type="button" class="text-primary font-bold text-label-md hover:underline" data-collection-detail="${item.id}">Details</button>
            ${item.status === 'received' ? '' : `<button type="button" class="text-secondary font-bold text-label-md hover:underline" data-collection-receive="${item.id}">Receive</button>`}
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-collection-row]').forEach(row => {
      bindOne(row, `collection-row-${row.dataset.collectionRow}`, event => {
        if (event.target.closest('button')) return;
        showCollectionDetail(collections.find(item => item.id === row.dataset.collectionRow));
      });
    });
    tbody.querySelectorAll('[data-collection-detail]').forEach(button => {
      bindOne(button, `collection-detail-${button.dataset.collectionDetail}`, event => {
        event.stopPropagation();
        showCollectionDetail(collections.find(item => item.id === button.dataset.collectionDetail));
      });
    });
    tbody.querySelectorAll('[data-collection-receive]').forEach(button => {
      bindOne(button, `collection-receive-${button.dataset.collectionReceive}`, async event => {
        event.stopPropagation();
        await receiveCollection(button.dataset.collectionReceive);
      });
    });
  }

  function renderInteractiveRouteMap(collections, schools) {
    const mapCard = Array.from(document.querySelectorAll('main .relative')).find(el => el.innerText.includes('Active Route'));
    if (!mapCard || mapCard.dataset.collectionMapEnhanced === 'true') return;
    mapCard.dataset.collectionMapEnhanced = 'true';
    const active = collections.filter(item => !['received', 'cancelled'].includes(String(item.status).toLowerCase()));
    const zone = active.map(item => schools.find(school => school.id === item.school_id)?.zone).find(Boolean) || 'North Sector';
    const stops = active.length ? active : collections.slice(0, 4);
    const totalKg = stops.reduce((sum, item) => sum + Number(item.weight_kg || 0), 0);
    const vehicles = getVehicleLocations(stops, schools);
    mapCard.innerHTML = `
      <iframe title="Nairobi collection route map" class="absolute inset-0 w-full h-full border-0 grayscale-[0.15] contrast-[1.05]" loading="lazy"
        src="https://www.openstreetmap.org/export/embed.html?bbox=36.735%2C-1.335%2C36.925%2C-1.205&layer=mapnik&marker=-1.286389%2C36.817223"></iframe>
      <div class="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/5 via-transparent to-black/10"></div>
      <div class="absolute inset-0 z-[5] pointer-events-none" data-map-overlay>
        ${stops.slice(0, 6).map((item, index) => {
          const school = schoolForCollection(item, schools);
          const point = mapPoint(school);
          return `
            <button type="button" data-map-pin="${item.id}" class="absolute pointer-events-auto -translate-x-1/2 -translate-y-full group" style="left:${point.x}%; top:${point.y}%;" title="${school.name || item.school_name}">
              <span class="material-symbols-outlined text-primary text-4xl drop-shadow-lg group-hover:scale-110 transition-transform" style="font-variation-settings:'FILL' 1;">location_on</span>
            </button>
          `;
        }).join('')}
        ${vehicles.map(vehicle => {
          const point = mapPoint(vehicle);
          return `
            <button type="button" data-vehicle-pin="${vehicle.id}" class="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 group" style="left:${point.x}%; top:${point.y}%;" title="${vehicle.driver_name} - ${vehicle.vehicle_id}">
              <span class="relative flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-on-secondary shadow-lg group-hover:scale-110 transition-transform">
                <span class="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-30 animate-ping"></span>
                <span class="material-symbols-outlined text-[18px] relative">local_shipping</span>
              </span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="absolute top-4 left-4 right-4 z-10 flex flex-col md:flex-row md:items-start justify-between gap-sm pointer-events-none">
        <div class="bg-surface/95 backdrop-blur-sm p-sm rounded-lg border border-outline-variant shadow-sm pointer-events-auto">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Active Route</p>
          <h3 class="font-headline-sm text-headline-sm flex items-center gap-xs">
            <span class="material-symbols-outlined text-primary">map</span>
            ${zone}
          </h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${stops.length} stops - ${totalKg.toLocaleString('en-KE')} kg estimated</p>
        </div>
        <div class="flex flex-wrap gap-xs pointer-events-auto">
          <button type="button" data-map-action="planner" class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90 shadow-sm">Plan Route</button>
          <button type="button" data-map-action="live" class="px-sm py-xs bg-surface/95 border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low shadow-sm">Live Map</button>
          <button type="button" data-map-action="driver" class="px-sm py-xs bg-surface/95 border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low shadow-sm">Driver GPS</button>
        </div>
      </div>
      <div class="absolute inset-x-6 bottom-6 z-10 grid grid-cols-1 md:grid-cols-${Math.min(3, Math.max(1, stops.length))} gap-xs pointer-events-auto">
        ${stops.slice(0, 3).map((item, index) => `
          <button type="button" data-map-stop="${item.id}" class="text-left p-sm rounded-lg bg-surface/95 border border-outline-variant shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all">
            <div class="flex items-center justify-between gap-sm">
              <p class="font-label-md text-label-md text-on-surface truncate">${index + 1}. ${item.school_name}</p>
              ${statusBadge(item.status)}
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${Number(item.weight_kg || 0).toLocaleString('en-KE')} kg - ${formatLabel(item.waste_type)}</p>
          </button>
        `).join('')}
      </div>
    `;
    mapCard.querySelector('[data-map-action="planner"]')?.addEventListener('click', () => showRoutePlanner(zone));
    mapCard.querySelector('[data-map-action="live"]')?.addEventListener('click', () => showLiveMapModal(stops, schools));
    mapCard.querySelector('[data-map-action="driver"]')?.addEventListener('click', () => showDriverGpsModal(stops, schools));
    mapCard.querySelectorAll('[data-map-stop]').forEach(button => {
      button.addEventListener('click', () => showCollectionDetail(collections.find(item => item.id === button.dataset.mapStop)));
    });
    mapCard.querySelectorAll('[data-map-pin]').forEach(button => {
      button.addEventListener('click', () => showCollectionDetail(collections.find(item => item.id === button.dataset.mapPin)));
    });
    mapCard.querySelectorAll('[data-vehicle-pin]').forEach(button => {
      button.addEventListener('click', () => showVehicleDetail(vehicles.find(item => item.id === button.dataset.vehiclePin), stops, schools));
    });
  }

  function renderRecentActivity(collections) {
    const section = Array.from(document.querySelectorAll('h3')).find(h => h.innerText.includes('Recent Activity'))?.closest('div.bg-surface-container-low, div.bg-white, section');
    const list = section?.querySelector('.space-y-sm');
    if (!list) return;
    list.dataset.routeList = 'true';
    list.innerHTML = collections.slice().sort((a, b) => new Date(b.updated_at || b.collection_date) - new Date(a.updated_at || a.collection_date)).slice(0, 6).map(item => `
      <button type="button" class="w-full text-left bg-surface-container-lowest p-sm rounded-lg border border-outline-variant flex gap-sm items-start hover:shadow-sm hover:-translate-y-0.5 transition-all" data-activity-collection="${item.id}">
        <div class="${item.status === 'received' ? 'bg-primary/10' : 'bg-secondary-container'} p-xs rounded-full">
          <span class="material-symbols-outlined ${item.status === 'received' ? 'text-primary' : 'text-on-secondary-container'} text-sm">${item.status === 'received' ? 'check_circle' : 'local_shipping'}</span>
        </div>
        <div class="min-w-0">
          <p class="font-body-md text-body-md font-bold truncate">${item.school_name || 'School'}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${formatLabel(item.status)} - ${Number(item.weight_kg || 0).toLocaleString('en-KE')} kg - ${formatCollectionDate(item.collection_date)}</p>
          <span class="text-[10px] bg-tertiary-fixed text-on-tertiary-fixed-variant px-2 rounded-full font-bold">${formatLabel(item.waste_type)}</span>
        </div>
      </button>
    `).join('');
    list.querySelectorAll('[data-activity-collection]').forEach(button => {
      bindOne(button, `activity-${button.dataset.activityCollection}`, () => showCollectionDetail(collections.find(item => item.id === button.dataset.activityCollection)));
    });
  }

  function renderRouteBoard(collections, schools) {
    const main = document.querySelector('main');
    if (!main || document.getElementById('collection-route-board')) return;
    const todayRows = collections.filter(item => item.collection_date === todayIso() && item.status !== 'cancelled');
    const activeRows = collections.filter(item => !['received', 'cancelled'].includes(String(item.status).toLowerCase()));
    const routeRows = todayRows.length ? todayRows : activeRows;
    const zones = groupBy(routeRows, item => schools.find(school => school.id === item.school_id)?.zone || 'Unassigned');
    const panel = document.createElement('section');
    panel.id = 'collection-route-board';
    panel.className = 'bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm';
    panel.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-md">
        <div>
          <h3 class="font-headline-sm text-headline-sm text-on-surface">Route Control Board</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Route planning, collector tasking, and Inventory receiving visibility.</p>
        </div>
        <div class="flex flex-wrap gap-sm">
          <button type="button" data-open-route-planner class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90">Optimize Route</button>
          <button type="button" data-open-school-modal class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">Add School</button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-md" data-route-list>
        ${Object.entries(zones).map(([zone, items]) => routeZoneCard(zone, items)).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No scheduled routes today.</div>'}
      </div>
    `;
    main.appendChild(panel);
    panel.querySelector('[data-open-route-planner]')?.addEventListener('click', showRoutePlanner);
    panel.querySelector('[data-open-school-modal]')?.addEventListener('click', showSchoolModal);
    panel.querySelectorAll('[data-route-zone]').forEach(card => bindOne(card, `zone-${card.dataset.routeZone}`, () => showRoutePlanner(card.dataset.routeZone)));
  }

  function renderSchoolsImpactPanel(collections, schools) {
    const main = document.querySelector('main');
    if (!main || document.getElementById('collection-schools-panel')) return;
    const totals = schools.map(school => ({
      ...school,
      totalKg: collections.filter(item => item.school_id === school.id).reduce((sum, item) => sum + Number(item.weight_kg || 0), 0)
    })).sort((a, b) => b.totalKg - a.totalKg);
    const panel = document.createElement('section');
    panel.id = 'collection-schools-panel';
    panel.className = 'bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm';
    panel.innerHTML = `
      <div class="flex items-center justify-between gap-md mb-md">
        <div>
          <h3 class="font-headline-sm text-headline-sm">Partner Schools</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Participation, contacts, pickup readiness, and education impact.</p>
        </div>
        <button type="button" data-view-schools class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">View Directory</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-md" data-school-card-list>
        ${totals.slice(0, 8).map(school => `
          <button type="button" class="text-left p-md rounded-xl border border-outline-variant bg-surface-container-low hover:shadow-sm hover:-translate-y-0.5 transition-all" data-school-card="${school.id}">
            <div class="flex items-start justify-between gap-sm">
              <div>
                <p class="font-label-md text-label-md text-on-surface">${school.name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${school.zone || 'Unassigned zone'}</p>
              </div>
              <span class="material-symbols-outlined text-primary">school</span>
            </div>
            <p class="mt-md font-headline-sm text-headline-sm text-primary">${Number(school.totalKg || 0).toLocaleString('en-KE')} kg</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Score ${Number(school.participation_score || 0).toLocaleString('en-KE')} - ${school.contact_name || 'No contact'}</p>
          </button>
        `).join('')}
      </div>
    `;
    main.appendChild(panel);
    panel.querySelector('[data-view-schools]')?.addEventListener('click', showSchoolsDirectory);
    panel.querySelectorAll('[data-school-card]').forEach(card => bindOne(card, `school-card-${card.dataset.schoolCard}`, () => showSchoolDetail(totals.find(school => school.id === card.dataset.schoolCard))));
  }

  async function submitCollectionForm(form, modal) {
    const schoolId = form.querySelector('select')?.value;
    const wasteType = form.querySelectorAll('select')[1]?.value || 'plastic_bottles';
    const weightKg = Number(form.querySelector('input[type="number"]')?.value || 0);
    const notes = form.querySelector('textarea')?.value || '';
    if (!schoolId) return toast('Choose a school before submitting.', 'warning');
    if (weightKg <= 0) return toast('Enter a valid collection weight.', 'warning');
    const created = await window.collectionModule.addCollection({
      school_id: schoolId,
      collection_date: todayIso(),
      weight_kg: weightKg,
      waste_type: wasteType,
      status: 'weighed',
      notes
    });
    if (!created) return toast('Could not save collection.', 'error');
    appendCollectionEvent(created.id, 'collection_logged', `${created.school_name} logged ${weightKg.toLocaleString('en-KE')} kg.`);
    createInventoryReceivingTask(created);
    modal?.classList.add('hidden');
    form.reset();
    toast('Collection logged and Inventory receiving task queued.', 'success');
    await renderCollectionPage();
  }

  async function receiveCollection(id) {
    const collections = await window.collectionModule.getCollections();
    const item = collections.find(row => row.id === id);
    if (!item) return;
    const ok = await window.collectionModule.updateCollectionStatus(id, 'received', {
      weight_kg: Number(item.weight_kg || 0),
      waste_type: item.waste_type || 'plastic_bottles',
      received_at: new Date().toISOString()
    });
    if (ok) {
      completeInventoryReceivingTask(id);
      appendCollectionEvent(id, 'inventory_received', `${item.school_name} received into raw materials.`);
      toast('Collection received and raw material stock updated.', 'success');
      await renderCollectionPage();
    } else {
      toast('Could not receive collection.', 'error');
    }
  }

  function showCollectionDetail(item = {}) {
    if (!item?.id) return;
    const events = readJson('eden_collection_events', []).filter(event => event.collection_id === item.id);
    createModal('Collection Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Collection', item.id],
          ['School', item.school_name],
          ['Date', formatCollectionDate(item.collection_date)],
          ['Waste Type', formatLabel(item.waste_type)],
          ['Weight', `${Number(item.weight_kg || 0).toLocaleString('en-KE')} kg`],
          ['Collector', item.collector_name || 'Not assigned'],
          ['Status', formatLabel(item.status)]
        ])}
      </dl>
      <div class="mt-md p-sm rounded-lg bg-surface-container-low">
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Inventory Handoff</p>
        <p class="font-body-sm text-body-sm text-on-surface-variant">${item.status === 'received' ? 'Received into raw material stock.' : 'Awaiting receiving confirmation. Mark received when weighed and accepted at store.'}</p>
      </div>
      <div class="mt-md">
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm">Timeline</p>
        <div class="space-y-xs">${events.map(event => `<div class="p-xs rounded-lg bg-surface-container-low text-body-sm"><strong>${formatLabel(event.type)}</strong> - ${event.message}<br><span class="text-on-surface-variant">${window.edenUtils?.formatDate(event.created_at) || event.created_at}</span></div>`).join('') || '<p class="text-body-sm text-on-surface-variant">No timeline events yet.</p>'}</div>
      </div>
      <div class="flex flex-wrap justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Close</button>
        ${item.status === 'received' ? '' : `<button type="button" data-receive-current="${item.id}" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90">Mark Received</button>`}
      </div>
    `);
    document.querySelector('[data-receive-current]')?.addEventListener('click', async event => {
      event.target.closest('.fixed')?.remove();
      await receiveCollection(event.target.dataset.receiveCurrent);
    });
  }

  async function showCollectionHistory() {
    const collections = await window.collectionModule.getCollections();
    createModal('Collection History', `
      <div class="overflow-x-auto">
        <table class="w-full text-left min-w-[720px]">
          <thead><tr><th class="py-xs">School</th><th class="py-xs">Date</th><th class="py-xs">Type</th><th class="py-xs">Weight</th><th class="py-xs">Status</th></tr></thead>
          <tbody>
            ${collections.slice().sort((a, b) => new Date(b.collection_date) - new Date(a.collection_date)).map(item => `
              <tr class="cursor-pointer hover:bg-surface-container-low" data-history-row="${item.id}">
                <td class="py-xs">${item.school_name}</td><td>${formatCollectionDate(item.collection_date)}</td><td>${formatLabel(item.waste_type)}</td><td>${Number(item.weight_kg || 0).toLocaleString('en-KE')} kg</td><td>${formatLabel(item.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
    document.querySelectorAll('[data-history-row]').forEach(row => row.addEventListener('click', () => showCollectionDetail(collections.find(item => item.id === row.dataset.historyRow))));
  }

  async function showRoutePlanner(zone = null) {
    const [collections, schools] = await Promise.all([window.collectionModule.getCollections(), window.collectionModule.getSchools()]);
    const todayRows = collections.filter(item => item.collection_date === todayIso() && !['received', 'cancelled'].includes(String(item.status).toLowerCase()));
    const activeRows = collections.filter(item => !['received', 'cancelled'].includes(String(item.status).toLowerCase()));
    const rows = todayRows.length ? todayRows : activeRows;
    const tasks = rows.map((item, index) => {
      const school = schools.find(row => row.id === item.school_id);
      return { ...item, zone: school?.zone || 'Unassigned', order: index + 1 };
    }).filter(item => !zone || item.zone === zone);
    createModal('Route Planner', `
      <div class="space-y-sm" data-route-list>
        ${tasks.map(item => `
          <button type="button" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:shadow-sm transition-all" data-route-item="${item.id}">
            <div class="flex items-center justify-between gap-md">
              <div>
                <p class="font-label-md text-label-md">${item.order}. ${item.school_name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${item.zone} - ${Number(item.weight_kg || 0).toLocaleString('en-KE')} kg - ${formatLabel(item.status)}</p>
              </div>
              ${statusBadge(item.status)}
            </div>
          </button>
        `).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No active route stops for this filter.</div>'}
      </div>
      <div class="mt-md p-sm rounded-lg bg-surface-container-low">
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Suggested Dispatch</p>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Prioritize in-transit stops, then scheduled pickups with the highest estimated weight. Inventory receives completed collections as raw material batches.</p>
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
    document.querySelectorAll('[data-route-item]').forEach(button => button.addEventListener('click', () => showCollectionDetail(tasks.find(item => item.id === button.dataset.routeItem))));
  }

  function showLiveMapModal(stops = [], schools = []) {
    const routeStops = stops.length ? stops : readJson('eden_collections', []).filter(item => !['received', 'cancelled'].includes(String(item.status).toLowerCase()));
    const locatedSchools = ensureSchoolLocations(schools.length ? schools : readJson('eden_schools', []));
    const vehicles = getVehicleLocations(routeStops, locatedSchools);
    createModal('Live Route Map', `
      <div class="relative h-[520px] rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low">
        <iframe data-live-map-frame title="Live collection route map" class="absolute inset-0 w-full h-full border-0" loading="lazy"
          src="${mapUrlForPoint({ latitude: -1.286389, longitude: 36.817223 })}"></iframe>
        <div class="absolute inset-0 z-[5] pointer-events-none" data-live-map-overlay>
          ${routeStops.map(item => {
            const school = schoolForCollection(item, locatedSchools);
            const point = mapPoint(school);
            return `
              <button type="button" data-live-school-pin="${item.id}" class="absolute pointer-events-auto -translate-x-1/2 -translate-y-full group" style="left:${point.x}%; top:${point.y}%;" title="${school.name || item.school_name}">
                <span class="material-symbols-outlined text-primary text-4xl drop-shadow-lg group-hover:scale-110 transition-transform" style="font-variation-settings:'FILL' 1;">location_on</span>
              </button>
            `;
          }).join('')}
          ${vehicles.map(vehicle => {
            const point = mapPoint(vehicle);
            return `
              <button type="button" data-live-vehicle-pin="${vehicle.id}" class="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 group" style="left:${point.x}%; top:${point.y}%;" title="${vehicle.driver_name}">
                <span class="relative flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-on-secondary shadow-lg group-hover:scale-110 transition-transform">
                  <span class="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-30 animate-ping"></span>
                  <span class="material-symbols-outlined text-[18px] relative">local_shipping</span>
                </span>
              </button>
            `;
          }).join('')}
        </div>
        <div class="absolute top-4 left-4 z-10 p-sm rounded-lg bg-surface/95 border border-outline-variant shadow-sm max-w-xs">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Dispatch View</p>
          <p class="font-headline-sm text-headline-sm text-on-surface">${routeStops.length} open stops</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">OpenStreetMap layer with Eden route stops. Use the stop list to inspect, receive, or re-plan.</p>
        </div>
        <div class="absolute right-4 top-4 bottom-4 z-10 w-80 max-w-[calc(100%-2rem)] overflow-y-auto space-y-xs">
          ${routeStops.map((item, index) => {
            const school = schoolForCollection(item, locatedSchools);
            return `
              <button type="button" data-live-map-stop="${item.id}" class="w-full text-left p-sm rounded-lg bg-surface/95 border border-outline-variant shadow-sm hover:bg-surface-container-low transition-colors">
                <div class="flex items-center justify-between gap-sm">
                  <p class="font-label-md text-label-md truncate">${index + 1}. ${item.school_name}</p>
                  <span class="material-symbols-outlined text-primary text-[18px]">location_on</span>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${school.zone || 'Unassigned'} - ${Number(item.weight_kg || 0).toLocaleString('en-KE')} kg - ${formatLabel(item.status)}</p>
              </button>
            `;
          }).join('') || '<div class="p-md rounded-lg bg-surface/95 border border-outline-variant text-on-surface-variant">No open route stops.</div>'}
        </div>
      </div>
      <div class="flex justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Close</button>
        <button type="button" data-driver-gps class="px-md py-sm border border-outline text-on-surface-variant rounded-full font-label-md text-label-md hover:bg-surface-container-low">Driver GPS</button>
        <button type="button" data-live-route-planner class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90">Open Planner</button>
      </div>
    `);
    document.querySelector('[data-live-route-planner]')?.addEventListener('click', showRoutePlanner);
    document.querySelector('[data-driver-gps]')?.addEventListener('click', () => showDriverGpsModal(routeStops, locatedSchools));
    document.querySelectorAll('[data-live-map-stop]').forEach(button => {
      button.addEventListener('click', () => focusLiveMapStop(button.dataset.liveMapStop, routeStops, locatedSchools));
    });
    document.querySelectorAll('[data-live-school-pin]').forEach(button => {
      button.addEventListener('click', () => focusLiveMapStop(button.dataset.liveSchoolPin, routeStops, locatedSchools));
    });
    document.querySelectorAll('[data-live-vehicle-pin]').forEach(button => {
      button.addEventListener('click', () => showVehicleDetail(vehicles.find(item => item.id === button.dataset.liveVehiclePin), routeStops, locatedSchools));
    });
  }

  function focusLiveMapStop(collectionId, stops, schools) {
    const item = stops.find(row => row.id === collectionId);
    if (!item) return;
    const school = schoolForCollection(item, schools);
    const frame = document.querySelector('[data-live-map-frame]');
    if (frame) frame.src = mapUrlForPoint(school);
    document.querySelectorAll('[data-live-map-stop], [data-live-school-pin]').forEach(el => {
      const active = el.dataset.liveMapStop === collectionId || el.dataset.liveSchoolPin === collectionId;
      el.classList.toggle('ring-2', active);
      el.classList.toggle('ring-primary', active);
    });
    toast(`${school.name || item.school_name} focused on map.`, 'info');
  }

  function showDriverGpsModal(stops = [], schools = []) {
    const vehicles = getVehicleLocations(stops, schools);
    const overlay = createModal('Driver GPS Tracking', `
      <form data-driver-gps-form class="space-y-md">
        <p class="font-body-sm text-body-sm text-on-surface-variant">In production this should receive GPS pings from the driver's phone app. For now, this control simulates a driver phone check-in and stores it for dispatch tracking.</p>
        ${selectField('vehicle_id', 'Vehicle', vehicles.map(vehicle => [vehicle.id, `${vehicle.vehicle_id} - ${vehicle.driver_name}`]))}
        ${selectField('collection_id', 'Next stop', stops.map(item => [item.id, item.school_name]))}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          ${numberField('latitude', 'Latitude', vehicles[0]?.latitude || -1.286389)}
          ${numberField('longitude', 'Longitude', vehicles[0]?.longitude || 36.817223)}
        </div>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Driver note</span>
          <textarea name="notes" rows="3" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Traffic, delay, arrived at gate, phone battery..."></textarea>
        </label>
        ${modalActions('Save GPS Ping')}
      </form>
    `);
    const form = overlay.querySelector('[data-driver-gps-form]');
    const collectionSelect = form.querySelector('[name="collection_id"]');
    collectionSelect?.addEventListener('change', () => {
      const stop = stops.find(item => item.id === collectionSelect.value);
      const school = schoolForCollection(stop, schools);
      form.latitude.value = Number(school.latitude || -1.286389);
      form.longitude.value = Number(school.longitude || 36.817223);
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const currentVehicles = getVehicleLocations(stops, schools);
      const idx = currentVehicles.findIndex(vehicle => vehicle.id === data.get('vehicle_id'));
      const update = {
        ...(currentVehicles[idx] || {}),
        id: data.get('vehicle_id'),
        latitude: Number(data.get('latitude')),
        longitude: Number(data.get('longitude')),
        next_collection_id: data.get('collection_id'),
        notes: data.get('notes'),
        updated_at: new Date().toISOString()
      };
      if (idx >= 0) currentVehicles[idx] = update;
      else currentVehicles.unshift(update);
      localStorage.setItem('eden_vehicle_locations', JSON.stringify(currentVehicles));
      appendCollectionEvent(data.get('collection_id'), 'driver_gps', `${update.vehicle_id || update.id} GPS ping saved.`);
      overlay.remove();
      toast('Driver GPS ping saved.', 'success');
      renderCollectionPage();
    });
  }

  function showVehicleDetail(vehicle = {}, stops = [], schools = []) {
    if (!vehicle) return;
    const nextStop = stops.find(item => item.id === vehicle.next_collection_id) || stops[0];
    const school = schoolForCollection(nextStop, schools);
    createModal('Vehicle Location', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Vehicle', vehicle.vehicle_id || vehicle.id],
          ['Driver', vehicle.driver_name || 'Driver phone'],
          ['Latitude', Number(vehicle.latitude || 0).toFixed(5)],
          ['Longitude', Number(vehicle.longitude || 0).toFixed(5)],
          ['Next Stop', school.name || nextStop?.school_name || 'Unassigned'],
          ['Last Ping', vehicle.updated_at ? (window.edenUtils?.formatDate(vehicle.updated_at) || vehicle.updated_at) : 'Simulated live']
        ])}
      </dl>
      <div class="mt-md p-sm rounded-lg bg-surface-container-low">
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Driver Phone Integration</p>
        <p class="font-body-sm text-body-sm text-on-surface-variant">This marker represents the latest driver phone GPS ping. A future mobile app can write the same vehicle location record continuously.</p>
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  async function showSchoolsDirectory() {
    const [schools, collections] = await Promise.all([window.collectionModule.getSchools(), window.collectionModule.getCollections()]);
    createModal('Schools Directory', `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-sm" data-school-card-list>
        ${schools.map(school => {
          const totalKg = collections.filter(item => item.school_id === school.id).reduce((sum, item) => sum + Number(item.weight_kg || 0), 0);
          return `
            <button type="button" class="text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:shadow-sm transition-all" data-directory-school="${school.id}">
              <p class="font-label-md text-label-md">${school.name}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${school.zone || 'No zone'} - ${school.contact_name || 'No contact'} - ${Number(totalKg).toLocaleString('en-KE')} kg collected</p>
            </button>
          `;
        }).join('')}
      </div>
      <div class="flex justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Close</button>
        <button type="button" data-add-school-from-directory class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Add School</button>
      </div>
    `);
    document.querySelectorAll('[data-directory-school]').forEach(button => button.addEventListener('click', () => showSchoolDetail(schools.find(school => school.id === button.dataset.directorySchool))));
    document.querySelector('[data-add-school-from-directory]')?.addEventListener('click', showSchoolModal);
  }

  function showSchoolDetail(school = {}) {
    if (!school?.id) return;
    createModal('School Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['School', school.name],
          ['Zone', school.zone || 'Unassigned'],
          ['Contact', school.contact_name || 'Not captured'],
          ['Phone', school.contact_phone || 'Not captured'],
          ['Address', school.address || 'Not captured'],
          ['Participation Score', Number(school.participation_score || 0)]
        ])}
      </dl>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showSchoolModal() {
    const overlay = createModal('Onboard School', `
      <form data-school-form class="space-y-md">
        ${textField('name', 'School name', 'New partner school')}
        ${textField('zone', 'Zone', 'North Sector')}
        ${textField('contact_name', 'Contact person', 'Environmental club lead')}
        ${textField('contact_phone', 'Phone', '+254...')}
        <label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">Address</span><textarea name="address" rows="2" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></textarea></label>
        ${modalActions('Save School')}
      </form>
    `);
    overlay.querySelector('[data-school-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const saved = await window.collectionModule.addSchool(Object.fromEntries(new FormData(event.currentTarget).entries()));
      overlay.remove();
      toast(saved ? 'School onboarded.' : 'Could not save school.', saved ? 'success' : 'error');
      if (saved) await renderCollectionPage();
    });
  }

  function clearSchoolCollectionFields() {
    const form = Array.from(document.querySelectorAll('form')).find(item => item.innerText.includes('Select Participating School'));
    form?.reset();
    toast('Collection fields cleared.', 'info');
  }

  async function submitSchoolCollectionForm() {
    const form = Array.from(document.querySelectorAll('form')).find(item => item.innerText.includes('Select Participating School'));
    if (!form) return;
    const schools = await window.collectionModule.getSchools();
    const schoolName = form.querySelector('select')?.value || schools[0]?.name;
    const school = schools.find(item => item.name === schoolName) || schools[0];
    const weight = Number(form.querySelector('input[type="number"]')?.value || 0);
    if (!school || weight <= 0) return toast('Choose a school and enter a valid weight.', 'warning');
    const saved = await window.collectionModule.addCollection({
      school_id: school.id,
      collection_date: todayIso(),
      weight_kg: weight,
      waste_type: 'mixed_plastic',
      status: 'weighed',
      notes: 'Logged from school collection station.'
    });
    toast(saved ? 'School collection record saved.' : 'Could not save collection.', saved ? 'success' : 'error');
    if (saved) await renderCollectionPage();
  }

  async function exportCollectionsCsv() {
    const rows = await window.collectionModule.getCollections();
    downloadTextFile(`eden-collections-${todayIso()}.csv`, [
      ['ID', 'School', 'Date', 'Waste Type', 'Weight Kg', 'Status', 'Collector'],
      ...rows.map(item => [item.id, item.school_name, item.collection_date, item.waste_type, item.weight_kg, item.status, item.collector_name])
    ].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Collection export downloaded.', 'success');
  }

  function openEntryModal() {
    const modal = document.getElementById('entry-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function routeZoneCard(zone, items) {
    const weight = items.reduce((sum, item) => sum + Number(item.weight_kg || 0), 0);
    return `
      <button type="button" class="text-left p-md rounded-xl border border-outline-variant bg-surface-container-low hover:shadow-sm hover:-translate-y-0.5 transition-all" data-route-zone="${zone}">
        <div class="flex items-center justify-between gap-md">
          <p class="font-label-md text-label-md">${zone}</p>
          <span class="material-symbols-outlined text-primary">route</span>
        </div>
        <p class="mt-md font-headline-sm text-headline-sm text-primary">${items.length} stops</p>
        <p class="font-body-sm text-body-sm text-on-surface-variant">${weight.toLocaleString('en-KE')} kg estimated</p>
      </button>
    `;
  }

  function createInventoryReceivingTask(collection) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-col-${collection.id}`,
      title: `Receive collection: ${collection.school_name}`,
      description: `${Number(collection.weight_kg || 0).toLocaleString('en-KE')} kg ${formatLabel(collection.waste_type)} awaiting Inventory receiving.`,
      department: 'Inventory',
      priority: 'medium',
      status: 'open',
      assigned_to: 'Inventory Lead',
      source_module: 'waste_collection',
      collection_id: collection.id,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function completeInventoryReceivingTask(collectionId) {
    const tasks = readJson('eden_tasks', []).map(task => task.collection_id === collectionId ? { ...task, status: 'completed', completed_at: new Date().toISOString() } : task);
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function appendCollectionEvent(collectionId, type, message) {
    const events = readJson('eden_collection_events', []);
    events.unshift({ id: `ce-${Date.now()}`, collection_id: collectionId, type, message, actor: window.appState?.user?.name || 'Collection User', created_at: new Date().toISOString() });
    localStorage.setItem('eden_collection_events', JSON.stringify(events.slice(0, 250)));
  }

  function groupBy(rows, keyFn) {
    return rows.reduce((acc, row) => {
      const key = keyFn(row);
      acc[key] = acc[key] || [];
      acc[key].push(row);
      return acc;
    }, {});
  }

  function wasteTypeOptions() {
    return `
      <option value="plastic_bottles">Plastic Bottles / PET</option>
      <option value="hdpe">HDPE</option>
      <option value="ldpe">LDPE</option>
      <option value="mixed_plastic">Mixed Plastic</option>
      <option value="waste_paper">Waste Paper</option>
    `;
  }

  function ensureSchoolLocations(schools = []) {
    const defaults = [
      [-1.2186, 36.8862],
      [-1.2594, 36.8122],
      [-1.2924, 36.8721],
      [-1.2647, 36.7604],
      [-1.3052, 36.8219],
      [-1.2318, 36.8071]
    ];
    const located = schools.map((school, index) => ({
      ...school,
      latitude: Number(school.latitude || defaults[index % defaults.length][0]),
      longitude: Number(school.longitude || defaults[index % defaults.length][1])
    }));
    const changed = located.some((school, index) => school.latitude !== schools[index]?.latitude || school.longitude !== schools[index]?.longitude);
    if (changed) localStorage.setItem('eden_schools', JSON.stringify(located));
    return located;
  }

  function schoolForCollection(collection = {}, schools = []) {
    return schools.find(school => school.id === collection.school_id) || {
      name: collection.school_name,
      latitude: -1.286389,
      longitude: 36.817223,
      zone: 'Unassigned'
    };
  }

  function getVehicleLocations(stops = [], schools = []) {
    const stored = readJson('eden_vehicle_locations', []);
    if (stored.length) return stored;
    const first = stops[0];
    const school = schoolForCollection(first, schools);
    const seeded = [{
      id: 'veh-collection-1',
      vehicle_id: 'LOGI-882',
      driver_name: 'Charlie Collector',
      latitude: Number(school.latitude || -1.286389) - 0.012,
      longitude: Number(school.longitude || 36.817223) - 0.018,
      next_collection_id: first?.id || null,
      status: 'in_transit',
      updated_at: new Date().toISOString()
    }];
    localStorage.setItem('eden_vehicle_locations', JSON.stringify(seeded));
    return seeded;
  }

  function mapPoint(location = {}) {
    const minLng = 36.70;
    const maxLng = 36.96;
    const minLat = -1.36;
    const maxLat = -1.18;
    const lng = Number(location.longitude || 36.817223);
    const lat = Number(location.latitude || -1.286389);
    return {
      x: Math.max(6, Math.min(94, ((lng - minLng) / (maxLng - minLng)) * 100)),
      y: Math.max(8, Math.min(92, (1 - ((lat - minLat) / (maxLat - minLat))) * 100))
    };
  }

  function mapUrlForPoint(location = {}) {
    const lat = Number(location.latitude || -1.286389);
    const lng = Number(location.longitude || 36.817223);
    const delta = 0.035;
    const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].map(value => value.toFixed(5)).join('%2C');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
  }

  function selectField(name, label, options, selected = '') {
    return `
      <label class="block">
        <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
        <select name="${name}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
          ${options.map(([value, text]) => `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${text}</option>`).join('')}
        </select>
      </label>
    `;
  }

  function numberField(name, label, value) {
    return `
      <label class="block">
        <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
        <input name="${name}" required type="number" step="0.000001" value="${Number(value || 0)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
      </label>
    `;
  }

  function textField(name, label, placeholder = '') {
    return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><input name="${name}" required placeholder="${placeholder}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></label>`;
  }

  function detailRows(rows) {
    return rows.map(([label, value]) => `<div class="py-sm flex justify-between gap-md"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd class="font-body-md text-body-md text-on-surface text-right">${value || 'Not captured'}</dd></div>`).join('');
  }

  function modalActions(confirmLabel) {
    return `<div class="flex justify-end gap-sm pt-sm"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Cancel</button><button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90">${confirmLabel}</button></div>`;
  }

  function createModal(title, bodyHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm flex items-center justify-center p-md';
    overlay.innerHTML = `
      <div class="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-lg transform transition-all scale-95 opacity-0" data-modal-card>
        <div class="flex items-start justify-between gap-md mb-md">
          <div><p class="font-label-sm text-label-sm text-primary uppercase">Collection Control</p><h3 class="font-headline-md text-headline-md text-on-surface">${title}</h3></div>
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

  function statusRank(status) {
    return { in_transit: 0, scheduled: 1, weighed: 2, received: 3, cancelled: 4 }[String(status || '').toLowerCase()] ?? 5;
  }

  function todayIso() {
    return new Date().toISOString().split('T')[0];
  }

  function readJson(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (err) { return fallback; }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  }

  function statusBadge(status = 'scheduled') {
    const key = String(status).toLowerCase();
    const label = formatLabel(key);
    const positive = ['received', 'weighed', 'completed'].includes(key);
    const warning = ['in_transit', 'scheduled', 'pending'].includes(key);
    const cls = positive ? 'bg-primary/10 text-primary' : warning ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant';
    return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${label}</span>`;
  }

  function formatCollectionDate(dateStr) {
    if (!dateStr) return 'Unscheduled';
    const today = todayIso();
    return dateStr === today ? 'Today' : (window.edenUtils?.formatDate(dateStr) || dateStr);
  }

  function formatLabel(value) {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function toast(message, type = 'info') {
    window.edenUtils?.showToast(message, type);
  }

  function bindOne(element, key, handler) {
    if (!element || element.dataset.collectionBound === key) return;
    element.dataset.collectionBound = key;
    element.addEventListener('click', handler);
  }
})();
