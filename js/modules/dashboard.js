// js/modules/dashboard.js
// Cross-module KPI aggregation for the operations overview page.

(function () {
  const dashboardModule = {
    getStats: async function () {
      const [collections, schools, productionStats, salesStats, hrStats, financeStats] = await Promise.all([
        window.collectionModule?.getCollections ? window.collectionModule.getCollections() : this.getLocal('eden_collections'),
        window.collectionModule?.getSchools ? window.collectionModule.getSchools() : this.getLocal('eden_schools'),
        window.productionModule?.getProductionStats ? window.productionModule.getProductionStats() : Promise.resolve({ totalOutputKg: 0, inProgress: 0 }),
        window.salesModule?.getSalesStats ? window.salesModule.getSalesStats() : Promise.resolve({ monthRevenue: 0, outstanding: 0, totalOrders: 0 }),
        window.hrModule?.getHRStats ? window.hrModule.getHRStats() : Promise.resolve({ headcount: 0, presentToday: 0, openTasks: 0 }),
        window.financeModule?.getFinanceStats ? window.financeModule.getFinanceStats() : Promise.resolve(null)
      ]);

      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthCollections = (collections || []).filter(c => (c.collection_date || '').startsWith(thisMonth));
      const monthWeightKg = monthCollections.reduce((sum, c) => sum + Number(c.weight_kg || 0), 0);

      return {
        wasteCollectedKg: monthWeightKg,
        activeSchools: (schools || []).filter(s => s.active !== false).length,
        productionOutputKg: productionStats.totalOutputKg || 0,
        activeBatches: productionStats.inProgress || 0,
        revenue: financeStats?.monthRevenue ?? salesStats.monthRevenue ?? 0,
        receivables: financeStats?.receivables ?? salesStats.outstanding ?? 0,
        headcount: hrStats.headcount || 0,
        presentToday: hrStats.presentToday || 0,
        openTasks: hrStats.openTasks || 0,
        totalOrders: salesStats.totalOrders || 0
      };
    },

    getActivity: function () {
      const collections = this.getLocal('eden_collections').slice(-5).map(c => ({
        timestamp: c.collection_date || 'Today',
        module: 'Collection',
        action: `${c.school_name || 'School'} collection ${c.status || 'scheduled'}`,
        status: c.status === 'received' ? 'Success' : 'Pending'
      }));
      const invoices = this.getLocal('eden_invoices').slice(0, 5).map(i => ({
        timestamp: i.issued_date || 'Today',
        module: 'Finance',
        action: `${i.invoice_number || 'Invoice'} for ${i.customer_name || 'customer'}`,
        status: i.status || 'sent'
      }));
      return [...collections, ...invoices].slice(0, 8);
    },

    getLocal: function (key) {
      try {
        const rows = JSON.parse(localStorage.getItem(key)) || [];
        if (rows.length) return rows;
      } catch (err) {
        // Fall through to dashboard-level defaults.
      }
      const today = new Date().toISOString().split('T')[0];
      const defaults = {
        eden_collections: [
          { id: 'dash-col-1', school_name: 'Greenwood Academy', collection_date: today, weight_kg: 45, status: 'received' },
          { id: 'dash-col-2', school_name: 'Lincoln Secondary', collection_date: today, weight_kg: 32, status: 'scheduled' }
        ],
        eden_schools: [
          { id: 'dash-sch-1', name: 'Greenwood Academy', active: true },
          { id: 'dash-sch-2', name: 'Lincoln Secondary', active: true },
          { id: 'dash-sch-3', name: 'Oakwood Primary', active: true }
        ],
        eden_invoices: [
          { invoice_number: 'INV-2026-0022', customer_name: 'EcoPackaging Ltd', issued_date: today, amount: 162400, paid_amount: 0, status: 'sent' }
        ]
      };
      return defaults[key] || [];
    }
  };

  window.dashboardModule = dashboardModule;
})();
