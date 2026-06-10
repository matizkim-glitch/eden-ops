// js/modules/inventory.js
// Handles raw materials stock, finished products, and supplier management

(function () {
  const inventoryModule = {

    MOCK_RAW_MATERIALS: [
      { id: 'raw-1', name: 'Refined PET Flakes', category: 'plastic_bottles', quantity_kg: 2400, unit_cost: 45, reorder_threshold_kg: 5000, supplier_id: 'sup-1', supplier_name: 'Riverside Recovery', last_updated: new Date().toISOString() },
      { id: 'raw-2', name: 'HDPE Pellets',       category: 'hdpe',           quantity_kg: 42850, unit_cost: 60, reorder_threshold_kg: 8000, supplier_id: 'sup-2', supplier_name: 'EcoFlow Logistics', last_updated: new Date().toISOString() },
      { id: 'raw-3', name: 'LDPE Film',           category: 'ldpe',           quantity_kg: 8500,  unit_cost: 55, reorder_threshold_kg: 3000, supplier_id: 'sup-3', supplier_name: 'Global Urban Waste', last_updated: new Date().toISOString() },
      { id: 'raw-4', name: 'Mixed PP Regrind',    category: 'mixed_plastic',  quantity_kg: 1100,  unit_cost: 38, reorder_threshold_kg: 2000, supplier_id: 'sup-2', supplier_name: 'EcoFlow Logistics', last_updated: new Date().toISOString() },
      { id: 'raw-5', name: 'Waste Paper', category: 'waste_paper', quantity_kg: 3200, unit_cost: 18, reorder_threshold_kg: 1200, supplier_id: 'sup-4', supplier_name: 'Community Paper Network', last_updated: new Date().toISOString() },
      { id: 'raw-6', name: 'Paraffin Wax', category: 'eko_shoe_polish', quantity_kg: 44.5, unit_cost: 180, reorder_threshold_kg: 50, supplier_id: 'sup-5', supplier_name: 'EKO Formulation Supplies', last_updated: new Date().toISOString() },
      { id: 'raw-7', name: 'Carnauba Wax', category: 'eko_shoe_polish', quantity_kg: 36, unit_cost: 260, reorder_threshold_kg: 30, supplier_id: 'sup-5', supplier_name: 'EKO Formulation Supplies', last_updated: new Date().toISOString() },
      { id: 'raw-8', name: 'Beeswax', category: 'eko_shoe_polish', quantity_kg: 28, unit_cost: 240, reorder_threshold_kg: 25, supplier_id: 'sup-5', supplier_name: 'EKO Formulation Supplies', last_updated: new Date().toISOString() },
      { id: 'raw-9', name: 'Carbon Black Pigment', category: 'eko_shoe_polish', quantity_kg: 18, unit_cost: 220, reorder_threshold_kg: 20, supplier_id: 'sup-5', supplier_name: 'EKO Formulation Supplies', last_updated: new Date().toISOString() },
      { id: 'raw-10', name: 'Mineral Oil', category: 'eko_shoe_polish', quantity_kg: 75, unit_cost: 145, reorder_threshold_kg: 40, supplier_id: 'sup-5', supplier_name: 'EKO Formulation Supplies', last_updated: new Date().toISOString() },
      { id: 'raw-11', name: 'Turpentine Solvent', category: 'eko_shoe_polish', quantity_kg: 64, unit_cost: 155, reorder_threshold_kg: 45, supplier_id: 'sup-5', supplier_name: 'EKO Formulation Supplies', last_updated: new Date().toISOString() },
      { id: 'raw-12', name: 'Polish Tins & Labels', category: 'packaging', quantity_kg: 900, unit_cost: 35, reorder_threshold_kg: 300, supplier_id: 'sup-6', supplier_name: 'Nairobi Packworks', last_updated: new Date().toISOString() }
    ],

    MOCK_FINISHED_PRODUCTS: [
      { id: 'fin-1', name: 'PET Pellets (Clear)',  sku: 'FIN-PET-01', quantity_kg: 1800, unit_price: 120, category: 'pet',  status: 'in_stock' },
      { id: 'fin-2', name: 'HDPE Granules',        sku: 'FIN-HDPE-02', quantity_kg: 9200, unit_price: 140, category: 'hdpe', status: 'in_stock' },
      { id: 'fin-3', name: 'LDPE Film Roll',       sku: 'FIN-LDPE-03', quantity_kg: 420,  unit_price: 110, category: 'ldpe', status: 'low_stock' },
      { id: 'fin-4', name: 'PP Mixed Granules',    sku: 'FIN-PP-04',   quantity_kg: 0,    unit_price: 95,  category: 'pp',   status: 'out_of_stock' },
      { id: 'fin-5', name: 'EKO Shoe Polish', sku: 'FIN-EKO-01', quantity_kg: 240, unit_price: 320, category: 'shoe_polish', status: 'in_stock',
        recipe: [
          { material_id: 'raw-6', material_name: 'Paraffin Wax', kg_per_kg: 0.28 },
          { material_id: 'raw-7', material_name: 'Carnauba Wax', kg_per_kg: 0.12 },
          { material_id: 'raw-8', material_name: 'Beeswax', kg_per_kg: 0.10 },
          { material_id: 'raw-9', material_name: 'Carbon Black Pigment', kg_per_kg: 0.08 },
          { material_id: 'raw-10', material_name: 'Mineral Oil', kg_per_kg: 0.22 },
          { material_id: 'raw-11', material_name: 'Turpentine Solvent', kg_per_kg: 0.18 },
          { material_id: 'raw-12', material_name: 'Polish Tins & Labels', kg_per_kg: 0.02 }
        ] }
    ],

    MOCK_SUPPLIERS: [
      { id: 'sup-1', name: 'Riverside Recovery',  contact_name: 'James Odhiambo', contact_phone: '+254711001122', email: 'james@riverside.co.ke', material_type: 'PET Flakes',   rating: 4.2, status: 'active' },
      { id: 'sup-2', name: 'EcoFlow Logistics',   contact_name: 'Amina Wanjiku',  contact_phone: '+254722334455', email: 'amina@ecoflow.co.ke',   material_type: 'HDPE Pellets', rating: 4.8, status: 'active' },
      { id: 'sup-3', name: 'Global Urban Waste',  contact_name: 'Peter Mwangi',   contact_phone: '+254733556677', email: 'peter@globalurban.ke',  material_type: 'LDPE Film',    rating: 3.5, status: 'delayed' },
      { id: 'sup-4', name: 'Community Paper Network', contact_name: 'Grace Atieno', contact_phone: '+254700445566', email: 'grace@paper-network.ke', material_type: 'Waste Paper', rating: 4.4, status: 'active' },
      { id: 'sup-5', name: 'EKO Formulation Supplies', contact_name: 'Daniel Kimani', contact_phone: '+254744112233', email: 'orders@ekoformulations.ke', material_type: 'Shoe Polish Inputs', rating: 4.6, status: 'active' },
      { id: 'sup-6', name: 'Nairobi Packworks', contact_name: 'Linda Moraa', contact_phone: '+254755334411', email: 'sales@nairobipackworks.ke', material_type: 'Packaging', rating: 4.1, status: 'active' }
    ],

    MOCK_BATCHES: [
      { id: 'bp-8821', material_id: 'raw-2', material_name: 'HDPE Pellets', weight_kg: 1200, supplier_id: 'sup-2', supplier_name: 'EcoFlow Logistics', status: 'stored',     received_date: '2026-05-28', notes: '' },
      { id: 'bp-8822', material_id: 'raw-1', material_name: 'PET Flakes',   weight_kg: 450,  supplier_id: 'sup-1', supplier_name: 'Riverside Recovery', status: 'processing', received_date: '2026-05-29', notes: '' },
      { id: 'bp-8823', material_id: 'raw-3', material_name: 'LDPE Film',    weight_kg: 8500, supplier_id: 'sup-3', supplier_name: 'Global Urban Waste',  status: 'in_transit', received_date: null,         notes: 'Delayed 2 days' },
      { id: 'bp-8824', material_id: 'raw-2', material_name: 'HDPE Pellets', weight_kg: 2100, supplier_id: 'sup-2', supplier_name: 'EcoFlow Logistics',   status: 'stored',     received_date: '2026-05-27', notes: '' }
    ],

    init: function () {
      if (window.authManager.isMockMode()) {
        if (!localStorage.getItem('eden_raw_materials')) {
          localStorage.setItem('eden_raw_materials', JSON.stringify(this.MOCK_RAW_MATERIALS));
        }
        if (!localStorage.getItem('eden_finished_products')) {
          localStorage.setItem('eden_finished_products', JSON.stringify(this.MOCK_FINISHED_PRODUCTS));
        }
        if (!localStorage.getItem('eden_suppliers')) {
          localStorage.setItem('eden_suppliers', JSON.stringify(this.MOCK_SUPPLIERS));
        }
        if (!localStorage.getItem('eden_batches')) {
          localStorage.setItem('eden_batches', JSON.stringify(this.MOCK_BATCHES));
        }
        this.mergeMockDefaults('eden_raw_materials', this.MOCK_RAW_MATERIALS);
        this.mergeMockDefaults('eden_finished_products', this.MOCK_FINISHED_PRODUCTS);
        this.mergeMockDefaults('eden_suppliers', this.MOCK_SUPPLIERS);
      }
    },

    mergeMockDefaults: function (key, defaults) {
      const current = JSON.parse(localStorage.getItem(key)) || [];
      const byId = new Map(current.map(item => [item.id, item]));
      defaults.forEach(item => {
        if (!byId.has(item.id)) {
          byId.set(item.id, item);
          return;
        }
        const existing = byId.get(item.id);
        const merged = { ...item, ...existing };
        Object.keys(item).forEach(field => {
          if (Array.isArray(item[field]) && (!Array.isArray(existing[field]) || existing[field].length === 0)) {
            merged[field] = item[field];
          }
        });
        byId.set(item.id, merged);
      });
      localStorage.setItem(key, JSON.stringify(Array.from(byId.values())));
    },

    // ---- RAW MATERIALS ----
    getRawMaterials: async function () {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_raw_materials')) || [];
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('raw_materials').select('*, suppliers(name)').order('name');
        if (error) throw error;
        return data.map(r => ({ ...r, supplier_name: r.suppliers ? r.suppliers.name : '' }));
      } catch (err) { console.error(err); return []; }
    },

    addRawMaterial: async function (material) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_raw_materials')) || [];
        const item = { id: 'raw-' + Date.now(), last_updated: new Date().toISOString(), ...material };
        list.push(item);
        localStorage.setItem('eden_raw_materials', JSON.stringify(list));
        return item;
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('raw_materials').insert([material]).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    updateRawMaterial: async function (id, updates) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_raw_materials')) || [];
        const idx = list.findIndex(r => r.id === id);
        if (idx !== -1) { list[idx] = { ...list[idx], ...updates, last_updated: new Date().toISOString() }; }
        localStorage.setItem('eden_raw_materials', JSON.stringify(list));
        return list[idx] || null;
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('raw_materials').update({ ...updates, last_updated: new Date().toISOString() }).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    deleteRawMaterial: async function (id) {
      if (window.authManager.isMockMode()) {
        const list = (JSON.parse(localStorage.getItem('eden_raw_materials')) || []).filter(r => r.id !== id);
        localStorage.setItem('eden_raw_materials', JSON.stringify(list));
        return true;
      }
      try {
        const { error } = await window.supabaseClient.from('raw_materials').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) { console.error(err); return false; }
    },

    getLowStockMaterials: async function () {
      const materials = await this.getRawMaterials();
      return materials.filter(m => m.quantity_kg <= m.reorder_threshold_kg);
    },

    updateReorderSettings: async function (id, updates) {
      return this.updateRawMaterial(id, {
        reorder_threshold_kg: Number(updates.reorder_threshold_kg || 0),
        reorder_quantity_kg: Number(updates.reorder_quantity_kg || 0),
        preferred_supplier_id: updates.preferred_supplier_id || updates.supplier_id || null,
        supplier_id: updates.supplier_id || updates.preferred_supplier_id || null,
        supplier_name: updates.supplier_name || ''
      });
    },

    // ---- FINISHED PRODUCTS ----
    getFinishedProducts: async function () {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_finished_products')) || [];
      }
      try {
        const { data, error } = await window.supabaseClient.from('finished_products').select('*').order('name');
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return []; }
    },

    addFinishedProduct: async function (product) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_finished_products')) || [];
        const item = { id: 'fin-' + Date.now(), status: 'in_stock', ...product };
        list.push(item);
        localStorage.setItem('eden_finished_products', JSON.stringify(list));
        return item;
      }
      try {
        const { data, error } = await window.supabaseClient.from('finished_products').insert([product]).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    updateFinishedProductStock: async function (id, quantityDelta, source = {}) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_finished_products')) || [];
        const idx = list.findIndex(p => p.id === id);
        if (idx !== -1) {
          const movements = JSON.parse(localStorage.getItem('eden_stock_movements') || '[]');
          const sourceType = source.source_type || 'manual_adjustment';
          const sourceId = source.source_id || `finished:${id}:${Date.now()}`;
          const movementType = Number(quantityDelta || 0) < 0 ? 'finished_dispatch' : 'finished_receipt';
          const existingMovement = movements.find(item =>
            item.source_type === sourceType &&
            item.source_id === sourceId &&
            item.movement_type === movementType
          );
          if (existingMovement) return list[idx];
          list[idx].quantity_kg = Math.max(0, (list[idx].quantity_kg || 0) + quantityDelta);
          list[idx].status = list[idx].quantity_kg === 0 ? 'out_of_stock' :
                             list[idx].quantity_kg < 500 ? 'low_stock' : 'in_stock';
          localStorage.setItem('eden_finished_products', JSON.stringify(list));
          movements.unshift({
            id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            finished_product_id: id,
            material_id: null,
            source_type: sourceType,
            source_id: sourceId,
            source_module: source.source_module || 'inventory',
            quantity_kg: Number(quantityDelta || 0),
            movement_type: movementType,
            resulting_balance: list[idx].quantity_kg,
            notes: source.notes || 'Finished product stock movement',
            created_by: window.appState?.user?.id || 'local',
            created_at: new Date().toISOString()
          });
          localStorage.setItem('eden_stock_movements', JSON.stringify(movements));
          return list[idx];
        }
        return null;
      }
      try {
        const { data, error } = await window.supabaseClient.rpc('post_stock_movement', {
          p_movement_type: Number(quantityDelta || 0) < 0 ? 'finished_dispatch' : 'finished_receipt',
          p_quantity_kg: Number(quantityDelta || 0),
          p_source_module: source.source_module || 'inventory',
          p_source_type: source.source_type || 'manual_adjustment',
          p_source_id: source.source_id || `finished:${id}:${Date.now()}`,
          p_material_id: null,
          p_finished_product_id: id,
          p_notes: source.notes || 'Finished product stock movement'
        });
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- SUPPLIERS ----
    getSuppliers: async function () {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_suppliers')) || [];
      }
      try {
        const { data, error } = await window.supabaseClient.from('suppliers').select('*').order('name');
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return []; }
    },

    addSupplier: async function (supplier) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_suppliers')) || [];
        const item = { id: 'sup-' + Date.now(), rating: 4.0, status: 'active', ...supplier };
        list.push(item);
        localStorage.setItem('eden_suppliers', JSON.stringify(list));
        return item;
      }
      try {
        const { data, error } = await window.supabaseClient.from('suppliers').insert([supplier]).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- BATCHES ----
    getBatches: async function () {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_batches')) || [];
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('batches')
          .select('*, raw_materials(name), finished_products(name)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(b => ({
          ...b,
          material_name: b.raw_materials ? b.raw_materials.name : '',
          product_name: b.finished_products ? b.finished_products.name : '',
          weight_kg: b.raw_material_used_kg
        }));
      } catch (err) { console.error(err); return []; }
    },

    addBatch: async function (batch) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_batches')) || [];
        const item = {
          id: 'bp-' + Math.floor(8800 + Math.random() * 200),
          received_date: new Date().toISOString().split('T')[0],
          ...batch
        };
        list.unshift(item);
        localStorage.setItem('eden_batches', JSON.stringify(list));
        // Also update raw material stock
        if (batch.material_id && batch.weight_kg) {
          await this.updateRawMaterial(batch.material_id, {
            quantity_kg: ((JSON.parse(localStorage.getItem('eden_raw_materials')) || [])
              .find(r => r.id === batch.material_id) || { quantity_kg: 0 }).quantity_kg + parseFloat(batch.weight_kg)
          });
        }
        return item;
      }
      try {
        const payload = {
          batch_code: batch.id || `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`,
          raw_material_id: batch.material_id,
          raw_material_used_kg: batch.weight_kg,
          status: 'planned',
          notes: batch.notes || ''
        };
        const { data, error } = await window.supabaseClient.from('batches').insert([payload]).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    updateBatchStatus: async function (id, status) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_batches')) || [];
        const idx = list.findIndex(b => b.id === id);
        if (idx === -1) return null;
        list[idx] = {
          ...list[idx],
          status,
          received_date: status === 'stored' ? (list[idx].received_date || new Date().toISOString().split('T')[0]) : list[idx].received_date
        };
        localStorage.setItem('eden_batches', JSON.stringify(list));
        return list[idx];
      }
      try {
        const { data, error } = await window.supabaseClient.from('batches').update({ status }).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- SUMMARY STATS ----
    getSummaryStats: async function () {
      const [rawMats, finishedProds, lowStock] = await Promise.all([
        this.getRawMaterials(),
        this.getFinishedProducts(),
        this.getLowStockMaterials()
      ]);

      const totalRawKg = rawMats.reduce((sum, r) => sum + (r.quantity_kg || 0), 0);
      const totalFinishedKg = finishedProds.reduce((sum, p) => sum + Number(p.quantity_kg ?? p.quantity ?? 0), 0);
      const finishedValue = finishedProds.reduce((sum, p) => sum + (Number(p.quantity_kg ?? p.quantity ?? 0) * Number(p.unit_price || 0)), 0);

      return { totalRawKg, totalFinishedKg, finishedValue, lowStockCount: lowStock.length, lowStockItems: lowStock };
    }
  };

  inventoryModule.init();
  window.inventoryModule = inventoryModule;
})();
