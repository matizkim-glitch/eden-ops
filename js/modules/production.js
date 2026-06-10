// js/modules/production.js
// Handles production batches, quality control checks, and maintenance scheduling

(function () {
  const productionModule = {

    MOCK_PRODUCTION_BATCHES: [
      { id: 'prod-1', batch_number: 'PB-2026-001', product_name: 'PET Pellets (Clear)', raw_material_id: 'raw-1', raw_material_name: 'Refined PET Flakes', input_kg: 500, output_kg: 410, efficiency_pct: 82, machine_id: 'mach-1', machine_name: 'Extruder Line A', operator_id: 'emp-3', operator_name: 'Brian Kiprotich', status: 'completed', start_time: new Date(Date.now() - 7200000).toISOString(), end_time: new Date(Date.now() - 3600000).toISOString(), quality_grade: 'A', notes: '' },
      { id: 'prod-2', batch_number: 'PB-2026-002', product_name: 'HDPE Granules',       raw_material_id: 'raw-2', raw_material_name: 'HDPE Pellets',       input_kg: 800, output_kg: null, efficiency_pct: null, machine_id: 'mach-2', machine_name: 'Granulator B',   operator_id: 'emp-4', operator_name: 'Diana Muthoni',  status: 'in_progress', start_time: new Date(Date.now() - 1800000).toISOString(), end_time: null, quality_grade: null, notes: '' },
      { id: 'prod-3', batch_number: 'PB-2026-003', product_name: 'LDPE Film Roll',       raw_material_id: 'raw-3', raw_material_name: 'LDPE Film',           input_kg: 300, output_kg: null, efficiency_pct: null, machine_id: 'mach-3', machine_name: 'Film Press C',   operator_id: 'emp-3', operator_name: 'Brian Kiprotich', status: 'scheduled',   start_time: new Date(Date.now() + 3600000).toISOString(), end_time: null, quality_grade: null, notes: 'Awaiting raw material prep' }
    ],

    MOCK_QC_LOGS: [
      { id: 'qc-1', batch_id: 'prod-1', batch_number: 'PB-2026-001', inspector_id: 'emp-5', inspector_name: 'Eve Atieno', inspection_date: new Date().toISOString().split('T')[0], melt_flow_index: 8.2, density: 1.37, moisture_pct: 0.3, contamination_pct: 0.1, grade: 'A', passed: true, notes: 'Excellent batch quality' },
      { id: 'qc-2', batch_id: 'prod-1', batch_number: 'PB-2026-001', inspector_id: 'emp-5', inspector_name: 'Eve Atieno', inspection_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], melt_flow_index: 7.9, density: 1.36, moisture_pct: 0.4, contamination_pct: 0.2, grade: 'A', passed: true, notes: '' }
    ],

    MOCK_MACHINES: [
      { id: 'mach-1', name: 'Extruder Line A',   type: 'extruder',   location: 'Hall A', status: 'operational', last_maintenance: '2026-05-10', next_maintenance: '2026-06-10', capacity_kg_hr: 150 },
      { id: 'mach-2', name: 'Granulator B',       type: 'granulator', location: 'Hall A', status: 'operational', last_maintenance: '2026-05-15', next_maintenance: '2026-06-15', capacity_kg_hr: 200 },
      { id: 'mach-3', name: 'Film Press C',        type: 'press',      location: 'Hall B', status: 'maintenance', last_maintenance: '2026-05-28', next_maintenance: '2026-05-30', capacity_kg_hr: 80 },
      { id: 'mach-4', name: 'Washing Station D',  type: 'washer',     location: 'Hall B', status: 'operational', last_maintenance: '2026-04-20', next_maintenance: '2026-06-20', capacity_kg_hr: 300 }
    ],

    MOCK_MAINTENANCE: [
      { id: 'maint-1', machine_id: 'mach-3', machine_name: 'Film Press C',       type: 'corrective', scheduled_date: '2026-05-30', technician_id: 'emp-6', technician_name: 'Frank Omondi', status: 'scheduled', priority: 'high',   cost_ksh: 15000, notes: 'Belt replacement required' },
      { id: 'maint-2', machine_id: 'mach-1', machine_name: 'Extruder Line A',    type: 'preventive', scheduled_date: '2026-06-10', technician_id: 'emp-6', technician_name: 'Frank Omondi', status: 'scheduled', priority: 'medium', cost_ksh: 8000,  notes: 'Monthly lubrication check' },
      { id: 'maint-3', machine_id: 'mach-4', machine_name: 'Washing Station D',  type: 'preventive', scheduled_date: '2026-06-20', technician_id: 'emp-6', technician_name: 'Frank Omondi', status: 'scheduled', priority: 'low',    cost_ksh: 5000,  notes: 'Filter cleaning' }
    ],

    init: function () {
      if (window.authManager.isMockMode()) {
        if (!localStorage.getItem('eden_production_batches'))
          localStorage.setItem('eden_production_batches', JSON.stringify(this.MOCK_PRODUCTION_BATCHES));
        if (!localStorage.getItem('eden_qc_logs'))
          localStorage.setItem('eden_qc_logs', JSON.stringify(this.MOCK_QC_LOGS));
        if (!localStorage.getItem('eden_machines'))
          localStorage.setItem('eden_machines', JSON.stringify(this.MOCK_MACHINES));
        if (!localStorage.getItem('eden_maintenance'))
          localStorage.setItem('eden_maintenance', JSON.stringify(this.MOCK_MAINTENANCE));
      }
    },

    // ---- PRODUCTION BATCHES ----
    getBatches: async function () {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_production_batches')) || [];
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('batches')
          .select('*, raw_materials(name), finished_products(name), profiles(full_name)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(b => ({
          ...b,
          batch_number:    b.batch_code,
          product_name:    b.finished_products?.name || '',
          raw_material_name: b.raw_materials?.name || '',
          machine_name:      '',
          operator_name:     b.profiles?.full_name || '',
          input_kg:          b.raw_material_used_kg,
          output_kg:         b.units_produced,
          start_time:        b.started_at,
          end_time:          b.completed_at
        }));
      } catch (err) { console.error(err); return []; }
    },

    startBatch: async function (batch) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_production_batches')) || [];
        const batchNum = 'PB-2026-' + String(list.length + 1).padStart(3, '0');
        const item = {
          id: 'prod-' + Date.now(),
          batch_number: batchNum,
          status: 'in_progress',
          start_time: new Date().toISOString(),
          end_time: null,
          output_kg: null,
          efficiency_pct: null,
          quality_grade: null,
          operator_id: window.appState.user.id,
          operator_name: window.appState.user.name,
          ...batch
        };
        list.unshift(item);
        localStorage.setItem('eden_production_batches', JSON.stringify(list));
        return item;
      }
      try {
        const { data, error } = await window.supabaseClient.rpc('start_production_batch', {
          p_product_id: batch.product_id || null,
          p_raw_material_id: batch.raw_material_id || null,
          p_input_kg: batch.input_kg || batch.raw_material_used_kg || 0,
          p_batch_code: batch.batch_code || null,
          p_notes: batch.notes || '',
          p_idempotency_key: batch.idempotency_key || `start:${batch.product_id || 'product'}:${Date.now()}`
        });
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    completeBatch: async function (id, output_kg, quality_grade, notes) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_production_batches')) || [];
        const idx = list.findIndex(b => b.id === id);
        if (idx !== -1) {
          if (list[idx].status === 'completed' && list[idx].finished_stock_credited_at) return list[idx];
          const end = new Date();
          const eff = list[idx].input_kg ? Math.round((output_kg / list[idx].input_kg) * 100) : 0;

          // Update finished product stock
          let creditedAt = list[idx].finished_stock_credited_at || null;
          if (window.inventoryModule) {
            const finProds = JSON.parse(localStorage.getItem('eden_finished_products')) || [];
            const fp = finProds.find(p => p.name === list[idx].product_name);
            if (fp && !creditedAt) {
              await window.inventoryModule.updateFinishedProductStock(fp.id, output_kg);
              creditedAt = end.toISOString();
            }
          }
          list[idx] = { ...list[idx], status: 'completed', output_kg, quality_grade, notes: notes || '', end_time: end.toISOString(), efficiency_pct: eff, finished_stock_credited_at: creditedAt };
          localStorage.setItem('eden_production_batches', JSON.stringify(list));
          return list[idx];
        }
        return null;
      }
      try {
        const { data, error } = await window.supabaseClient.rpc('transition_production_batch', {
          p_batch_id: id,
          p_to_status: 'completed',
          p_idempotency_key: `complete:${id}`,
          p_notes: notes || '',
          p_output_kg: output_kg
        });
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- QC LOGS ----
    getQCLogs: async function (batchId = null) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_qc_logs')) || [];
        return batchId ? list.filter(q => q.batch_id === batchId) : list;
      }
      try {
        let query = window.supabaseClient
          .from('batches')
          .select('id, batch_code, qc_passed, notes, completed_at, created_at')
          .in('status', ['qc_pending', 'qc_passed', 'qc_failed', 'completed', 'rejected'])
          .order('created_at', { ascending: false });
        if (batchId) query = query.eq('id', batchId);
        const { data, error } = await query;
        if (error) throw error;
        return data.map(q => ({ ...q, batch_id: q.id, batch_number: q.batch_code, passed: q.qc_passed }));
      } catch (err) { console.error(err); return []; }
    },

    addQCLog: async function (log) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_qc_logs')) || [];
        const item = {
          id: 'qc-' + Date.now(),
          inspector_id: window.appState.user.id,
          inspector_name: window.appState.user.name,
          inspection_date: new Date().toISOString().split('T')[0],
          ...log
        };
        list.unshift(item);
        localStorage.setItem('eden_qc_logs', JSON.stringify(list));
        const batches = JSON.parse(localStorage.getItem('eden_production_batches')) || [];
        const idx = batches.findIndex(batch => batch.id === log.batch_id);
        if (idx !== -1) {
          batches[idx].status = log.passed ? 'qc_passed' : 'rejected';
          batches[idx].quality_grade = log.grade || batches[idx].quality_grade || null;
          batches[idx].qc_checked_at = new Date().toISOString();
          localStorage.setItem('eden_production_batches', JSON.stringify(batches));
        }
        return item;
      }
      try {
        await window.supabaseClient.rpc('send_batch_to_qc', {
          p_batch_id: log.batch_id,
          p_idempotency_key: `qc-pending:${log.batch_id}:${log.inspection_date || new Date().toISOString().slice(0, 10)}`,
          p_notes: 'QC inspection opened'
        });
        const { data, error } = await window.supabaseClient.rpc('record_batch_qc', {
          p_batch_id: log.batch_id,
          p_passed: Boolean(log.passed),
          p_output_kg: log.output_kg || null,
          p_grade: log.grade || null,
          p_notes: log.notes || '',
          p_idempotency_key: `qc:${log.batch_id}:${log.inspection_date || new Date().toISOString().slice(0, 10)}`
        });
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- MACHINES ----
    getMachines: async function () {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_machines')) || [];
      }
      try {
        return [];
      } catch (err) { console.error(err); return []; }
    },

    updateMachineStatus: async function (id, status) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_machines')) || [];
        const idx = list.findIndex(m => m.id === id);
        if (idx !== -1) { list[idx].status = status; localStorage.setItem('eden_machines', JSON.stringify(list)); return list[idx]; }
        return null;
      }
      try {
        return null;
      } catch (err) { console.error(err); return null; }
    },

    // ---- MAINTENANCE ----
    getMaintenance: async function () {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_maintenance')) || [];
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('maintenance_logs')
          .select('*, profiles(full_name)')
          .order('scheduled_date');
        if (error) throw error;
        return data.map(m => ({
          ...m,
          type:            m.maintenance_type,
          cost_ksh:        m.cost,
          technician_name: m.profiles?.full_name || ''
        }));
      } catch (err) { console.error(err); return []; }
    },

    addMaintenanceTask: async function (task) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_maintenance')) || [];
        const item = { id: 'maint-' + Date.now(), status: 'scheduled', ...task };
        list.push(item);
        localStorage.setItem('eden_maintenance', JSON.stringify(list));
        return item;
      }
      try {
        const payload = {
          machine_name: task.machine_name,
          maintenance_type: task.type || task.maintenance_type || 'preventive',
          scheduled_date: task.scheduled_date,
          technician_id: task.technician_id || null,
          status: task.status || 'scheduled',
          notes: task.notes || '',
          cost: task.cost_ksh || task.cost || null
        };
        const { data, error } = await window.supabaseClient.from('maintenance_logs').insert([payload]).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    completeMaintenanceTask: async function (id, cost_ksh, notes) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_maintenance')) || [];
        const idx = list.findIndex(m => m.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], status: 'completed', cost_ksh, notes, completed_date: new Date().toISOString().split('T')[0] };
          localStorage.setItem('eden_maintenance', JSON.stringify(list));
          return list[idx];
        }
        return null;
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('maintenance_logs')
          .update({ status: 'completed', cost: cost_ksh, notes, completed_date: new Date().toISOString().split('T')[0] })
          .eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- STATS ----
    getProductionStats: async function () {
      const batches = await this.getBatches();
      const today = new Date().toISOString().split('T')[0];
      const todayBatches  = batches.filter(b => b.start_time && b.start_time.startsWith(today));
      const completed     = batches.filter(b => b.status === 'completed');
      const inProgress    = batches.filter(b => b.status === 'in_progress');
      const totalOutputKg = completed.reduce((s, b) => s + (b.output_kg || 0), 0);
      const avgEfficiency = completed.length
        ? Math.round(completed.reduce((s, b) => s + (b.efficiency_pct || 0), 0) / completed.length)
        : 0;
      return { totalBatches: batches.length, todayBatches: todayBatches.length, completed: completed.length, inProgress: inProgress.length, totalOutputKg, avgEfficiency };
    }
  };

  productionModule.init();
  window.productionModule = productionModule;
})();
