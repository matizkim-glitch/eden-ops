// js/modules/collection.js
// Handles all operations for waste collection: schools and collections list, create, updates

(function() {
  const collectionModule = {
    // Initial mock data to bootstrap local storage database
    MOCK_SCHOOLS: [
      { id: 'sch-1', name: 'Greenwood Academy', zone: 'North Sector', contact_name: 'Mr. Njoroge', contact_phone: '+254711223344', address: 'Thika Road, Nairobi', active: true, participation_score: 95, latitude: -1.2186, longitude: 36.8862 },
      { id: 'sch-2', name: 'Lincoln Secondary', zone: 'North Sector', contact_name: 'Mrs. Patel', contact_phone: '+254722334455', address: 'Parklands, Nairobi', active: true, participation_score: 80, latitude: -1.2594, longitude: 36.8122 },
      { id: 'sch-3', name: 'Oakwood Primary', zone: 'East Sector', contact_name: 'Mr. Kamau', contact_phone: '+254733445566', address: 'Jogoo Road, Nairobi', active: true, participation_score: 72, latitude: -1.2924, longitude: 36.8721 },
      { id: 'sch-4', name: 'Riverside High', zone: 'West Sector', contact_name: 'Ms. Akinyi', contact_phone: '+254744556677', address: 'Waiyaki Way, Nairobi', active: true, participation_score: 88, latitude: -1.2647, longitude: 36.7604 }
    ],

    MOCK_COLLECTIONS: [
      { id: 'col-1', school_id: 'sch-1', school_name: 'Greenwood Academy', collector_id: 'mock-uuid-collector', collector_name: 'Charlie Collector', collection_date: new Date().toISOString().split('T')[0], weight_kg: 45.0, waste_type: 'plastic_bottles', status: 'in_transit', weigh_slip_url: '', notes: 'Bin fully packed' },
      { id: 'col-2', school_id: 'sch-2', school_name: 'Lincoln Secondary', collector_id: 'mock-uuid-collector', collector_name: 'Charlie Collector', collection_date: new Date().toISOString().split('T')[0], weight_kg: 32.0, waste_type: 'hdpe', status: 'scheduled', weigh_slip_url: '', notes: '' },
      { id: 'col-3', school_id: 'sch-3', school_name: 'Oakwood Primary', collector_id: 'mock-uuid-collector', collector_name: 'Charlie Collector', collection_date: new Date().toISOString().split('T')[0], weight_kg: 18.0, waste_type: 'ldpe', status: 'scheduled', weigh_slip_url: '', notes: '' },
      { id: 'col-4', school_id: 'sch-4', school_name: 'Riverside High', collector_id: 'mock-uuid-collector', collector_name: 'Charlie Collector', collection_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], weight_kg: 58.2, waste_type: 'mixed_plastic', status: 'received', weigh_slip_url: 'https://placehold.co/400x300?text=weigh_slip_example', notes: 'Well sorted by the environmental club' }
    ],

    init: function() {
      const isMock = window.authManager.isMockMode();
      if (isMock) {
        if (!localStorage.getItem('eden_schools')) {
          localStorage.setItem('eden_schools', JSON.stringify(this.MOCK_SCHOOLS));
        }
        if (!localStorage.getItem('eden_collections')) {
          localStorage.setItem('eden_collections', JSON.stringify(this.MOCK_COLLECTIONS));
        }
      }
    },

    getSchools: async function() {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_schools'));
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('schools')
          .select('*')
          .order('name');
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error fetching schools:', err);
        return [];
      }
    },

    addSchool: async function(school) {
      if (window.authManager.isMockMode()) {
        const schools = JSON.parse(localStorage.getItem('eden_schools'));
        const newSchool = { id: 'sch-' + Date.now(), participation_score: 100, active: true, ...school };
        schools.push(newSchool);
        localStorage.setItem('eden_schools', JSON.stringify(schools));
        return newSchool;
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('schools')
          .insert([school])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error adding school:', err);
        return null;
      }
    },

    getCollections: async function() {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_collections'));
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('collections')
          .select(`
            *,
            schools (name, address, zone),
            profiles (full_name)
          `)
          .order('collection_date', { ascending: false });
        if (error) throw error;

        // Map database format to matches expected structure
        return data.map(item => ({
          ...item,
          school_name: item.schools ? item.schools.name : 'Unknown School',
          collector_name: item.profiles ? item.profiles.full_name : 'Unknown Collector'
        }));
      } catch (err) {
        console.error('Error fetching collections:', err);
        return [];
      }
    },

    addCollection: async function(collection) {
      if (window.authManager.isMockMode()) {
        const collections = JSON.parse(localStorage.getItem('eden_collections'));
        const schools = JSON.parse(localStorage.getItem('eden_schools'));
        const school = schools.find(s => s.id === collection.school_id);
        const newCollection = {
          id: 'col-' + Date.now(),
          school_name: school ? school.name : 'Unknown School',
          collector_id: window.appState.user.id,
          collector_name: window.appState.user.name,
          weigh_slip_url: '',
          ...collection
        };
        collections.push(newCollection);
        localStorage.setItem('eden_collections', JSON.stringify(collections));
        return newCollection;
      }
      try {
        const insertPayload = {
          school_id: collection.school_id,
          collection_date: collection.collection_date,
          weight_kg: collection.weight_kg,
          waste_type: collection.waste_type,
          status: collection.status,
          notes: collection.notes,
          collector_id: window.appState.user.id
        };
        const { data, error } = await window.supabaseClient
          .from('collections')
          .insert([insertPayload])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error adding collection:', err);
        return null;
      }
    },

    updateCollectionStatus: async function(id, status, extraFields = {}) {
      if (window.authManager.isMockMode()) {
        const collections = JSON.parse(localStorage.getItem('eden_collections'));
        const colIdx = collections.findIndex(c => c.id === id);
        if (colIdx !== -1) {
          const wasReceived = collections[colIdx].status === 'received' || !!collections[colIdx].received_at;
          if (status === 'received' && wasReceived) return true;
          collections[colIdx] = { ...collections[colIdx], status, ...extraFields };
          localStorage.setItem('eden_collections', JSON.stringify(collections));

          // If marking complete (received), add to raw materials stock
          if (status === 'received' && collections[colIdx].weight_kg) {
            this.addRawMaterialStockMock(collections[colIdx].waste_type, collections[colIdx].weight_kg, collections[colIdx].id);
          }
          return true;
        }
        return false;
      }

      try {
        if (status === 'received' && window.supabaseClient?.rpc) {
          const categoryName = this.mapWasteTypeToRawMaterial(extraFields.waste_type);
          const { data: materials } = await window.supabaseClient
            .from('raw_materials')
            .select('id')
            .eq('category', categoryName)
            .limit(1);
          const materialId = extraFields.material_id || materials?.[0]?.id || null;
          if (!materialId) throw new Error(`No raw material found for ${categoryName}`);
          const { error } = await window.supabaseClient.rpc('receive_collection', {
            p_collection_id: id,
            p_material_id: materialId,
            p_weight_kg: extraFields.weight_kg
          });
          if (error) throw error;
          return true;
        }

        const updatePayload = { status, ...extraFields };
        const { error } = await window.supabaseClient
          .from('collections')
          .update(updatePayload)
          .eq('id', id);
        
        if (error) throw error;

        const { data: currentRows } = await window.supabaseClient
          .from('collections')
          .select('status, received_at')
          .eq('id', id)
          .limit(1);
        const alreadyReceived = currentRows?.[0]?.status === 'received' || !!currentRows?.[0]?.received_at;
        if (status === 'received' && alreadyReceived) return true;

        // Real Supabase stock insertion
        if (status === 'received' && extraFields.weight_kg) {
          // Trigger a query to add to raw materials
          const categoryName = this.mapWasteTypeToRawMaterial(extraFields.waste_type);
          const { data: rawMat } = await window.supabaseClient
            .from('raw_materials')
            .select('id, quantity_kg')
            .eq('category', categoryName)
            .limit(1);

          if (rawMat && rawMat.length > 0) {
            const newQty = parseFloat(rawMat[0].quantity_kg || 0) + parseFloat(extraFields.weight_kg);
            await window.supabaseClient
              .from('raw_materials')
              .update({ quantity_kg: newQty, last_updated: new Date().toISOString() })
              .eq('id', rawMat[0].id);
          } else {
            // Insert new material record
            await window.supabaseClient
              .from('raw_materials')
              .insert([{
                name: categoryName + ' flakes',
                category: categoryName,
                quantity_kg: extraFields.weight_kg
              }]);
          }
        }
        return true;
      } catch (err) {
        console.error('Error updating collection:', err);
        return false;
      }
    },

    deleteCollection: async function(id) {
      if (window.authManager.isMockMode()) {
        const collections = JSON.parse(localStorage.getItem('eden_collections'));
        const updated = collections.filter(c => c.id !== id);
        localStorage.setItem('eden_collections', JSON.stringify(updated));
        return true;
      }
      try {
        const { error } = await window.supabaseClient
          .from('collections')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Error deleting collection:', err);
        return false;
      }
    },

    // Helper utilities
    addRawMaterialStockMock: function(wasteType, weightKg, sourceId = null) {
      const movements = JSON.parse(localStorage.getItem('eden_stock_movements')) || [];
      if (sourceId && movements.some(m => m.source_type === 'collection' && m.source_id === sourceId)) return;
      const materials = JSON.parse(localStorage.getItem('eden_raw_materials')) || [
        { id: 'raw-1', name: 'Refined PET', category: 'plastic_bottles', quantity_kg: 120.5, unit_cost: 45, reorder_threshold_kg: 50 },
        { id: 'raw-2', name: 'Refined HDPE', category: 'hdpe', quantity_kg: 32.0, unit_cost: 60, reorder_threshold_kg: 50 },
        { id: 'raw-3', name: 'Refined LDPE', category: 'ldpe', quantity_kg: 78.0, unit_cost: 55, reorder_threshold_kg: 50 }
      ];
      
      const mat = materials.find(m => m.category === wasteType);
      if (mat) {
        mat.quantity_kg = parseFloat(mat.quantity_kg || 0) + parseFloat(weightKg);
      } else {
        materials.push({
          id: 'raw-' + Date.now(),
          name: 'Refined ' + wasteType.toUpperCase(),
          category: wasteType,
          quantity_kg: parseFloat(weightKg),
          unit_cost: 50,
          reorder_threshold_kg: 50
        });
      }
      localStorage.setItem('eden_raw_materials', JSON.stringify(materials));
      if (sourceId) {
        movements.push({ id: 'mov-' + Date.now(), source_type: 'collection', source_id: sourceId, material_category: wasteType, quantity_kg: Number(weightKg), created_at: new Date().toISOString() });
        localStorage.setItem('eden_stock_movements', JSON.stringify(movements));
      }
    },

    mapWasteTypeToRawMaterial: function(wasteType) {
      switch (wasteType) {
        case 'plastic_bottles': return 'PET';
        case 'hdpe': return 'HDPE';
        case 'ldpe': return 'LDPE';
        case 'mixed_plastic': return 'Mixed Plastic';
        default: return 'Mixed Plastic';
      }
    }
  };

  collectionModule.init();
  window.collectionModule = collectionModule;
})();
