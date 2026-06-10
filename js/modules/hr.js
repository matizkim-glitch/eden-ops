// js/modules/hr.js
// Handles staff records, attendance, leave requests, and task assignments

(function () {
  const hrModule = {

    MOCK_EMPLOYEES: [
      { id: 'emp-1', full_name: 'Alice Manager',    email: 'alice@eden.co.ke',   phone: '+254700000001', role: 'admin',       department: 'Management',   position: 'General Manager',         status: 'active', hire_date: '2022-01-10', salary_ksh: 180000, emergency_contact: 'Bob +254700000002' },
      { id: 'emp-2', full_name: 'Bob Supervisor',   email: 'bob@eden.co.ke',     phone: '+254700000002', role: 'supervisor',  department: 'Operations',   position: 'Operations Supervisor',   status: 'active', hire_date: '2022-03-15', salary_ksh: 120000, emergency_contact: 'Alice +254700000001' },
      { id: 'emp-3', full_name: 'Brian Kiprotich',  email: 'brian@eden.co.ke',   phone: '+254711000001', role: 'operator',    department: 'Production',   position: 'Machine Operator',        status: 'active', hire_date: '2023-06-01', salary_ksh: 65000,  emergency_contact: 'Mary +254711000010' },
      { id: 'emp-4', full_name: 'Diana Muthoni',    email: 'diana@eden.co.ke',   phone: '+254722000002', role: 'operator',    department: 'Production',   position: 'Machine Operator',        status: 'active', hire_date: '2023-09-15', salary_ksh: 65000,  emergency_contact: 'Paul +254722000020' },
      { id: 'emp-5', full_name: 'Eve Atieno',       email: 'eve@eden.co.ke',     phone: '+254733000003', role: 'qc_inspector','department': 'Quality',    position: 'QC Inspector',            status: 'active', hire_date: '2024-01-20', salary_ksh: 75000,  emergency_contact: 'John +254733000030' },
      { id: 'emp-6', full_name: 'Frank Omondi',     email: 'frank@eden.co.ke',   phone: '+254744000004', role: 'technician',  department: 'Maintenance',  position: 'Maintenance Technician',  status: 'active', hire_date: '2023-02-28', salary_ksh: 80000,  emergency_contact: 'Rose +254744000040' },
      { id: 'emp-7', full_name: 'Grace Collector',  email: 'grace@eden.co.ke',   phone: '+254755000005', role: 'collector',   department: 'Collection',   position: 'Waste Collector',         status: 'active', hire_date: '2024-03-01', salary_ksh: 50000,  emergency_contact: 'Ken +254755000050' }
    ],

    MOCK_ATTENDANCE: [
      { id: 'att-1', employee_id: 'emp-3', employee_name: 'Brian Kiprotich', date: new Date().toISOString().split('T')[0], check_in: '07:58', check_out: null, status: 'present', late: false, notes: '' },
      { id: 'att-2', employee_id: 'emp-4', employee_name: 'Diana Muthoni',   date: new Date().toISOString().split('T')[0], check_in: '08:15', check_out: null, status: 'late',    late: true,  notes: 'Traffic' },
      { id: 'att-3', employee_id: 'emp-5', employee_name: 'Eve Atieno',      date: new Date().toISOString().split('T')[0], check_in: '07:45', check_out: null, status: 'present', late: false, notes: '' },
      { id: 'att-4', employee_id: 'emp-6', employee_name: 'Frank Omondi',    date: new Date().toISOString().split('T')[0], check_in: null,    check_out: null, status: 'absent',  late: false, notes: 'On leave' }
    ],

    MOCK_LEAVE_REQUESTS: [
      { id: 'leave-1', employee_id: 'emp-6', employee_name: 'Frank Omondi', leave_type: 'annual', start_date: '2026-05-28', end_date: '2026-05-30', days: 3, reason: 'Family event', status: 'approved', approved_by: 'Alice Manager', applied_date: '2026-05-20' },
      { id: 'leave-2', employee_id: 'emp-7', employee_name: 'Grace Collector', leave_type: 'sick', start_date: '2026-06-02', end_date: '2026-06-03', days: 2, reason: 'Medical appointment', status: 'pending', approved_by: null, applied_date: '2026-05-29' }
    ],

    MOCK_TASKS: [
      { id: 'task-1', title: 'Inspect Extruder Line A',      description: 'Check all seals and lubrication points', assigned_to_id: 'emp-6', assigned_to_name: 'Frank Omondi',   assigned_by_name: 'Bob Supervisor', priority: 'high',   due_date: '2026-05-31', status: 'in_progress', department: 'Maintenance' },
      { id: 'task-2', title: 'Quality Report for PB-2026-001', description: 'Compile full QC report and submit', assigned_to_id: 'emp-5', assigned_to_name: 'Eve Atieno',     assigned_by_name: 'Bob Supervisor', priority: 'medium', due_date: '2026-06-01', status: 'pending',     department: 'Quality' },
      { id: 'task-3', title: 'Greenwood Academy Follow-up',   description: 'Call school contact re: next collection', assigned_to_id: 'emp-7', assigned_to_name: 'Grace Collector', assigned_by_name: 'Alice Manager', priority: 'low',    due_date: '2026-06-03', status: 'pending',     department: 'Collection' }
    ],

    init: function () {
      if (window.authManager.isMockMode()) {
        if (!localStorage.getItem('eden_employees'))      localStorage.setItem('eden_employees',      JSON.stringify(this.MOCK_EMPLOYEES));
        if (!localStorage.getItem('eden_attendance'))     localStorage.setItem('eden_attendance',     JSON.stringify(this.MOCK_ATTENDANCE));
        if (!localStorage.getItem('eden_leave_requests')) localStorage.setItem('eden_leave_requests', JSON.stringify(this.MOCK_LEAVE_REQUESTS));
        if (!localStorage.getItem('eden_tasks'))          localStorage.setItem('eden_tasks',          JSON.stringify(this.MOCK_TASKS));
      }
    },

    // ---- EMPLOYEES ----
    getEmployees: async function () {
      if (window.authManager.isMockMode()) return JSON.parse(localStorage.getItem('eden_employees')) || [];
      try {
        const { data, error } = await window.supabaseClient.from('profiles').select('*').order('full_name');
        if (error) throw error;
        return data.map(p => ({ ...p, status: 'active', hire_date: p.created_at, salary_ksh: 0 }));
      } catch (err) { console.error(err); return []; }
    },

    getEmployee: async function (id) {
      const list = await this.getEmployees();
      return list.find(e => e.id === id) || null;
    },

    addEmployee: async function (employee) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_employees')) || [];
        const item = { id: 'emp-' + Date.now(), status: 'active', hire_date: new Date().toISOString().split('T')[0], ...employee };
        list.push(item);
        localStorage.setItem('eden_employees', JSON.stringify(list));
        return item;
      }
      try {
        const payload = {
          id: employee.id,
          full_name: employee.full_name,
          role: employee.role || 'hr',
          phone: employee.phone || null,
          avatar_url: employee.avatar_url || null
        };
        const { data, error } = await window.supabaseClient.from('profiles').insert([payload]).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    updateEmployee: async function (id, updates) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_employees')) || [];
        const idx = list.findIndex(e => e.id === id);
        if (idx !== -1) { list[idx] = { ...list[idx], ...updates }; localStorage.setItem('eden_employees', JSON.stringify(list)); return list[idx]; }
        return null;
      }
      try {
        const { data, error } = await window.supabaseClient.from('profiles').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    deactivateEmployee: async function (id) {
      return this.updateEmployee(id, { status: 'inactive' });
    },

    // ---- ATTENDANCE ----
    getTodayAttendance: async function () {
      const today = new Date().toISOString().split('T')[0];
      if (window.authManager.isMockMode()) {
        return (JSON.parse(localStorage.getItem('eden_attendance')) || []).filter(a => a.date === today);
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('attendance')
          .select('*, staff(id, profiles(full_name))')
          .eq('date', today);
        if (error) throw error;
        return data.map(a => ({ ...a, employee_id: a.staff_id, employee_name: a.staff?.profiles?.full_name || '' }));
      } catch (err) { console.error(err); return []; }
    },

    recordCheckIn: async function (employeeId) {
      const today = new Date().toISOString().split('T')[0];
      const now   = new Date().toTimeString().slice(0, 5);
      const late  = now > '08:15';

      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_attendance')) || [];
        const emp  = (JSON.parse(localStorage.getItem('eden_employees')) || []).find(e => e.id === employeeId);
        const existing = list.find(a => a.employee_id === employeeId && a.date === today);
        if (existing) { existing.check_in = now; existing.late = late; existing.status = late ? 'late' : 'present'; }
        else list.push({ id: 'att-' + Date.now(), employee_id: employeeId, employee_name: emp?.full_name || '', date: today, check_in: now, check_out: null, status: late ? 'late' : 'present', late, notes: '' });
        localStorage.setItem('eden_attendance', JSON.stringify(list));
        return true;
      }
      try {
        const { data: existing } = await window.supabaseClient
          .from('attendance')
          .select('id')
          .eq('staff_id', employeeId)
          .eq('date', today)
          .maybeSingle();
        const query = existing
          ? window.supabaseClient.from('attendance').update({ check_in: new Date().toISOString(), status: late ? 'late' : 'present' }).eq('id', existing.id)
          : window.supabaseClient.from('attendance').insert([{ staff_id: employeeId, date: today, check_in: new Date().toISOString(), status: late ? 'late' : 'present' }]);
        const { error } = await query;
        if (error) throw error;
        return true;
      } catch (err) { console.error(err); return false; }
    },

    recordCheckOut: async function (employeeId) {
      const today = new Date().toISOString().split('T')[0];
      const now   = new Date().toTimeString().slice(0, 5);

      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_attendance')) || [];
        const idx  = list.findIndex(a => a.employee_id === employeeId && a.date === today);
        if (idx !== -1) { list[idx].check_out = now; localStorage.setItem('eden_attendance', JSON.stringify(list)); }
        return true;
      }
      try {
        const { error } = await window.supabaseClient.from('attendance')
          .update({ check_out: new Date().toISOString() }).eq('staff_id', employeeId).eq('date', today);
        if (error) throw error;
        return true;
      } catch (err) { console.error(err); return false; }
    },

    // ---- LEAVE REQUESTS ----
    getLeaveRequests: async function () {
      if (window.authManager.isMockMode()) return JSON.parse(localStorage.getItem('eden_leave_requests')) || [];
      try {
        return [];
      } catch (err) { console.error(err); return []; }
    },

    applyLeave: async function (request) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_leave_requests')) || [];
        const emp  = (JSON.parse(localStorage.getItem('eden_employees')) || []).find(e => e.id === request.employee_id);
        const item = { id: 'leave-' + Date.now(), employee_name: emp?.full_name || '', status: 'pending', approved_by: null, applied_date: new Date().toISOString().split('T')[0], ...request };
        list.unshift(item);
        localStorage.setItem('eden_leave_requests', JSON.stringify(list));
        return item;
      }
      try {
        console.warn('Leave requests are not part of the current schema.');
        return null;
      } catch (err) { console.error(err); return null; }
    },

    approveLeave: async function (id, approved) {
      const status = approved ? 'approved' : 'rejected';
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_leave_requests')) || [];
        const idx  = list.findIndex(l => l.id === id);
        if (idx !== -1) { list[idx].status = status; list[idx].approved_by = window.appState.user.name; localStorage.setItem('eden_leave_requests', JSON.stringify(list)); return list[idx]; }
        return null;
      }
      try {
        console.warn('Leave requests are not part of the current schema.');
        return null;
      } catch (err) { console.error(err); return null; }
    },

    // ---- TASKS ----
    getTasks: async function () {
      if (window.authManager.isMockMode()) return JSON.parse(localStorage.getItem('eden_tasks')) || [];
      try {
        const { data, error } = await window.supabaseClient
          .from('tasks')
          .select('*, profiles!tasks_assigned_to_fkey(full_name)')
          .order('due_date');
        if (error) throw error;
        return data.map(t => ({ ...t, assigned_to_id: t.assigned_to, assigned_to_name: t.profiles?.full_name || '' }));
      } catch (err) { console.error(err); return []; }
    },

    assignTask: async function (task) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_tasks')) || [];
        const emp  = (JSON.parse(localStorage.getItem('eden_employees')) || []).find(e => e.id === task.assigned_to_id);
        const item = { id: 'task-' + Date.now(), status: 'pending', assigned_to_name: emp?.full_name || '', assigned_by_name: window.appState.user.name, ...task };
        list.unshift(item);
        localStorage.setItem('eden_tasks', JSON.stringify(list));
        return item;
      }
      try {
        const payload = {
          title: task.title,
          description: task.description || '',
          assigned_to: task.assigned_to_id || task.assigned_to,
          assigned_by: window.appState.user.id,
          module: task.module || 'hr',
          priority: task.priority || 'medium',
          status: 'pending',
          due_date: task.due_date || null
        };
        const { data, error } = await window.supabaseClient.from('tasks').insert([payload]).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    updateTaskStatus: async function (id, status) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_tasks')) || [];
        const idx  = list.findIndex(t => t.id === id);
        if (idx !== -1) { list[idx].status = status; if (status === 'completed') list[idx].completed_date = new Date().toISOString().split('T')[0]; localStorage.setItem('eden_tasks', JSON.stringify(list)); return list[idx]; }
        return null;
      }
      try {
        const updates = { status };
        if (status === 'completed') updates.completed_at = new Date().toISOString();
        const { data, error } = await window.supabaseClient.from('tasks').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- PAYROLL ----
    getPayrollSummary: async function () {
      const employees = await this.getEmployees();
      const active = employees.filter(e => e.status === 'active');
      const totalPayroll = active.reduce((s, e) => s + (e.salary_ksh || 0), 0);
      const byDept = active.reduce((acc, e) => {
        acc[e.department] = (acc[e.department] || 0) + (e.salary_ksh || 0);
        return acc;
      }, {});
      return { headcount: active.length, totalPayroll, byDepartment: byDept };
    },

    // ---- STATS ----
    getHRStats: async function () {
      const [employees, attendance, leaves, tasks] = await Promise.all([
        this.getEmployees(), this.getTodayAttendance(), this.getLeaveRequests(), this.getTasks()
      ]);
      const active     = employees.filter(e => e.status === 'active').length;
      const present    = attendance.filter(a => ['present', 'late'].includes(a.status)).length;
      const onLeave    = leaves.filter(l => l.status === 'approved' && l.start_date <= new Date().toISOString().split('T')[0] && l.end_date >= new Date().toISOString().split('T')[0]).length;
      const openTasks  = tasks.filter(t => t.status !== 'completed').length;
      const pendingLeave = leaves.filter(l => l.status === 'pending').length;
      return { headcount: active, presentToday: present, onLeave, openTasks, pendingLeave };
    }
  };

  hrModule.init();
  window.hrModule = hrModule;
})();
