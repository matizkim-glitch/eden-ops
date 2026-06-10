// js/routes/hr/page.js
// HR controller: workforce records, attendance, leave, safety, and task handoffs.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['hr_staffing.html'] = bindHrPage;
  window.edenPageControllers['hr_staffing_tasking.html'] = bindHrPage;

  async function bindHrPage() {
    if (!window.hrModule) return;
    bindStaticHrControls();
    await renderHrPage();
  }

  async function renderHrPage() {
    const [employees, attendance, leave, tasks, stats, payroll] = await Promise.all([
      window.hrModule.getEmployees(),
      window.hrModule.getTodayAttendance(),
      window.hrModule.getLeaveRequests(),
      window.hrModule.getTasks(),
      window.hrModule.getHRStats(),
      window.hrModule.getPayrollSummary()
    ]);

    renderHrKpis(stats, employees, attendance);
    renderStaffTable(employees, attendance);
    renderHrCommandPanel(employees, attendance, leave, tasks, payroll);
    bindStaticHrControls();
  }

  function bindStaticHrControls() {
    const buttons = Array.from(document.querySelectorAll('button'));
    buttons.forEach(button => {
      if (button.dataset.hrBound) return;
      const text = button.innerText.trim().toLowerCase();
      if (text.includes('add staff') || button.querySelector('.material-symbols-outlined')?.innerText.trim() === 'add') {
        button.dataset.hrBound = 'add';
        button.addEventListener('click', showAddStaffModal);
      } else if (text.includes('filter')) {
        button.dataset.hrBound = 'filter';
        button.addEventListener('click', showStaffFilterModal);
      } else if (text.includes('issue warning')) {
        button.dataset.hrBound = 'warning';
        button.addEventListener('click', createSafetyWarning);
      } else if (text.includes('view calendar')) {
        button.dataset.hrBound = 'calendar';
        button.addEventListener('click', showShiftCalendar);
      } else if (text.includes('manage all hires')) {
        button.dataset.hrBound = 'hires';
        button.addEventListener('click', showOnboardingModal);
      } else if (text.includes('weekly report')) {
        button.dataset.hrBound = 'report';
        button.addEventListener('click', showHrReport);
      }
    });
    bindLegacyHrCards();
  }

  function renderHrKpis(stats, employees, attendance) {
    const cards = Array.from(document.querySelectorAll('main .grid.grid-cols-1.md\\:grid-cols-4 > div'));
    const active = employees.filter(item => item.status === 'active').length;
    const present = attendance.filter(item => ['present', 'late'].includes(item.status)).length;
    const rate = Math.round((present / Math.max(active, 1)) * 100);
    const values = [
      ['TOTAL STAFF', active, `${stats.pendingLeave} leave review`, 'groups'],
      ['ATTENDANCE RATE', `${rate}%`, `${present} clocked in`, 'event_available'],
      ['OPEN TASKS', stats.openTasks, 'Across departments', 'assignment']
    ];

    values.forEach(([label, value, hint, icon], index) => {
      const card = cards[index];
      if (!card) return;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.dataset.hrKpi = label;
      card.innerHTML = `
        <div class="flex justify-between items-start mb-md">
          <span class="font-label-md text-label-md text-on-surface-variant">${label}</span>
          <span class="material-symbols-outlined text-primary">${icon}</span>
        </div>
        <div>
          <span class="font-headline-xl text-headline-xl">${value}</span>
          <p class="mt-xs font-body-sm text-body-sm text-on-surface-variant">${hint}</p>
        </div>
      `;
      if (!card.dataset.hrKpiBound) {
        card.dataset.hrKpiBound = 'true';
        card.addEventListener('click', () => showHrReport());
      }
    });
    const shiftCard = cards[2];
    if (shiftCard && !shiftCard.dataset.hrShiftCardBound) {
      shiftCard.dataset.hrShiftCardBound = 'true';
      shiftCard.addEventListener('click', showShiftCalendar);
    }
  }

  function renderStaffTable(employees, attendance) {
    const tbody = document.querySelector('section table tbody');
    if (!tbody) return;
    tbody.innerHTML = employees.map(employee => {
      const att = attendance.find(item => item.employee_id === employee.id);
      const status = att?.status || (employee.status === 'active' ? 'not_checked_in' : employee.status);
      return `
        <tr data-employee-id="${employee.id}" class="border-b border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer">
          <td class="p-md flex items-center gap-md">
            <div class="w-10 h-10 rounded-full bg-primary-container/15 flex items-center justify-center font-bold text-primary">${initials(employee.full_name)}</div>
            <div>
              <div class="font-semibold">${employee.full_name}</div>
              <div class="text-on-surface-variant text-xs">${employee.id}</div>
            </div>
          </td>
          <td class="p-md">
            <div class="flex flex-col">
              <span>${employee.position || formatLabel(employee.role)}</span>
              <span class="text-on-surface-variant text-xs">${employee.department || 'General'}</span>
            </div>
          </td>
          <td class="p-md">${statusBadge(status)}</td>
          <td class="p-md text-right">
            <button type="button" data-employee-action="${employee.id}" class="text-on-surface-variant hover:text-primary material-symbols-outlined">more_vert</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-employee-id]').forEach(row => {
      row.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        const employee = employees.find(item => item.id === row.dataset.employeeId);
        if (employee) showEmployeeDetail(employee, attendance.find(item => item.employee_id === employee.id));
      });
    });
    tbody.querySelectorAll('[data-employee-action]').forEach(button => {
      button.addEventListener('click', () => {
        const employee = employees.find(item => item.id === button.dataset.employeeAction);
        if (employee) showEmployeeDetail(employee, attendance.find(item => item.employee_id === employee.id));
      });
    });
  }

  function renderHrCommandPanel(employees, attendance, leave, tasks, payroll) {
    let panel = document.querySelector('[data-hr-command-panel]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.hrCommandPanel = 'true';
      panel.className = 'mt-xl grid grid-cols-1 lg:grid-cols-12 gap-lg';
      document.querySelector('main')?.appendChild(panel);
    }
    const openTasks = tasks.filter(task => !['completed', 'cancelled'].includes(String(task.status).toLowerCase()));
    const pendingLeave = leave.filter(item => item.status === 'pending');
    const exceptions = attendance.filter(item => ['late', 'absent'].includes(item.status));
    const departments = Object.entries(payroll.byDepartment || {}).sort((a, b) => b[1] - a[1]);
    panel.innerHTML = `
      <section class="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex items-center justify-between gap-md mb-md">
          <h3 class="font-headline-sm text-headline-sm">Tasking</h3>
          <button type="button" data-hr-create-task class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm">Assign</button>
        </div>
        <div class="space-y-xs">
          ${openTasks.slice(0, 5).map(task => taskButton(task)).join('') || emptyBlock('No open tasks.')}
        </div>
      </section>
      <section class="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex items-center justify-between gap-md mb-md">
          <h3 class="font-headline-sm text-headline-sm">Leave</h3>
          <button type="button" data-hr-leave-new class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">New</button>
        </div>
        <div class="space-y-xs">
          ${pendingLeave.map(item => leaveButton(item)).join('') || emptyBlock('No pending leave.')}
        </div>
      </section>
      <section class="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex items-center justify-between gap-md mb-md">
          <h3 class="font-headline-sm text-headline-sm">Attendance</h3>
          <button type="button" data-hr-attendance class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Log</button>
        </div>
        <div class="space-y-xs">
          ${exceptions.map(item => attendanceButton(item)).join('') || emptyBlock('No exceptions.')}
        </div>
      </section>
      <section class="lg:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-md">
          <div>
            <h3 class="font-headline-sm text-headline-sm">Workforce Analysis</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Payroll, department load, attendance, and task pressure.</p>
          </div>
          <button type="button" data-hr-report-open class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Open</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-sm">
          ${departments.slice(0, 4).map(([dept, value]) => `
            <button type="button" data-hr-dept="${dept}" class="text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant">
              <p class="font-label-md text-label-md text-on-surface">${dept}</p>
              <p class="font-headline-sm text-headline-sm text-primary">KES ${Number(value || 0).toLocaleString('en-KE')}</p>
            </button>
          `).join('')}
        </div>
      </section>
    `;
    panel.querySelector('[data-hr-create-task]')?.addEventListener('click', () => showAssignTaskModal(employees));
    panel.querySelector('[data-hr-leave-new]')?.addEventListener('click', () => showLeaveModal(employees));
    panel.querySelector('[data-hr-attendance]')?.addEventListener('click', () => showAttendanceModal(employees, attendance));
    panel.querySelector('[data-hr-report-open]')?.addEventListener('click', showHrReport);
    panel.querySelectorAll('[data-hr-task]').forEach(button => {
      const task = tasks.find(item => item.id === button.dataset.hrTask);
      button.addEventListener('click', () => showTaskDetail(task));
    });
    panel.querySelectorAll('[data-hr-leave]').forEach(button => {
      const item = leave.find(row => row.id === button.dataset.hrLeave);
      button.addEventListener('click', () => showLeaveDetail(item));
    });
    panel.querySelectorAll('[data-hr-attendance-row]').forEach(button => {
      const item = attendance.find(row => row.id === button.dataset.hrAttendanceRow);
      button.addEventListener('click', () => showAttendanceDetail(item));
    });
    panel.querySelectorAll('[data-hr-dept]').forEach(button => {
      button.addEventListener('click', () => showDepartmentDetail(button.dataset.hrDept, employees, tasks, payroll));
    });
  }

  function bindLegacyHrCards() {
    Array.from(document.querySelectorAll('section')).forEach(section => {
      const title = section.querySelector('h3')?.innerText.trim().toLowerCase();
      if (title?.includes('ppe') && !section.dataset.hrSafetyBound) {
        section.dataset.hrSafetyBound = 'true';
        section.querySelectorAll('.grid > div').forEach(card => {
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          card.classList.add('cursor-pointer');
          card.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            showSafetyDetail(card.innerText);
          });
        });
      }
      if (title?.includes('upcoming shifts') && !section.dataset.hrShiftBound) {
        section.dataset.hrShiftBound = 'true';
        section.querySelectorAll('.space-y-md > div').forEach(row => {
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => showShiftDetail(row.innerText));
        });
      }
      if (title?.includes('onboarding') && !section.dataset.hrOnboardingBound) {
        section.dataset.hrOnboardingBound = 'true';
        section.querySelectorAll('.space-y-md > div').forEach(card => {
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          card.classList.add('cursor-pointer', 'hover:border-primary', 'transition-all');
          card.addEventListener('click', () => showOnboardingDetail(card.innerText));
        });
      }
    });

    const bottomNavMap = [
      ['Collect', 'waste_collection.html'],
      ['Stock', 'supplier_inventory.html'],
      ['Process', 'production_monitoring.html'],
      ['Sales', 'sales_distribution.html'],
      ['More', 'hr_staffing_tasking.html']
    ];
    document.querySelectorAll('nav.fixed.bottom-0 div').forEach(item => {
      if (item.dataset.hrNavBound) return;
      const text = item.innerText.trim();
      const match = bottomNavMap.find(([label]) => text.includes(label));
      if (!match) return;
      item.dataset.hrNavBound = 'true';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', event => {
        if (match[0] === 'More') return;
        event.preventDefault();
        window.location.href = pageHref(match[1]);
      });
    });

    document.querySelectorAll('#nav-drawer .px-2 > div').forEach(item => {
      if (item.dataset.hrDrawerBound) return;
      item.dataset.hrDrawerBound = 'true';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', () => {
        const text = item.innerText.toLowerCase();
        const target = text.includes('waste') ? 'waste_collection.html'
          : text.includes('inventory') ? 'supplier_inventory.html'
          : text.includes('finance') ? 'finance_overview.html'
          : text.includes('analytics') ? 'sustainability_analytics.html'
          : text.includes('infrastructure') ? 'infrastructure_facility.html'
          : 'hr_staffing.html';
        window.location.href = pageHref(target);
      });
    });
  }

  function taskButton(task) {
    return `
      <button type="button" data-hr-task="${task.id}" class="w-full text-left p-xs rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all">
        <div class="flex items-center justify-between gap-sm">
          <p class="font-label-md text-label-md text-on-surface truncate">${task.title}</p>
          ${statusBadge(task.status)}
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${task.assigned_to_name || task.assigned_to || task.department || 'Unassigned'}</p>
      </button>
    `;
  }

  function leaveButton(item) {
    return `<button type="button" data-hr-leave="${item.id}" class="w-full text-left p-xs rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all"><p class="font-label-md text-label-md">${item.employee_name}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${formatLabel(item.leave_type)} • ${item.days} days</p></button>`;
  }

  function attendanceButton(item) {
    return `<button type="button" data-hr-attendance-row="${item.id}" class="w-full text-left p-xs rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all"><p class="font-label-md text-label-md">${item.employee_name}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${formatLabel(item.status)} • ${item.check_in || 'No check-in'}</p></button>`;
  }

  function showEmployeeDetail(employee, attendance) {
    const overlay = createModal(employee.full_name, `
      <div class="space-y-md">
        ${detailGrid([
          ['Role', employee.position || formatLabel(employee.role)],
          ['Department', employee.department],
          ['Phone', employee.phone],
          ['Email', employee.email],
          ['Today', attendance ? formatLabel(attendance.status) : 'Not checked in'],
          ['Salary', money(employee.salary_ksh)]
        ])}
        <div class="flex flex-wrap justify-end gap-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Close</button>
          <button type="button" data-hr-check-in class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Check In</button>
          <button type="button" data-hr-check-out class="px-md py-sm border border-primary text-primary rounded-full font-label-md text-label-md">Check Out</button>
          <button type="button" data-hr-assign-person class="px-md py-sm border border-outline text-on-surface-variant rounded-full font-label-md text-label-md">Assign Task</button>
        </div>
      </div>
    `);
    overlay.querySelector('[data-hr-check-in]')?.addEventListener('click', async () => {
      await window.hrModule.recordCheckIn(employee.id);
      overlay.remove();
      toast('Check-in recorded.', 'success');
      await renderHrPage();
    });
    overlay.querySelector('[data-hr-check-out]')?.addEventListener('click', async () => {
      await window.hrModule.recordCheckOut(employee.id);
      overlay.remove();
      toast('Check-out recorded.', 'success');
      await renderHrPage();
    });
    overlay.querySelector('[data-hr-assign-person]')?.addEventListener('click', () => {
      overlay.remove();
      showAssignTaskModal([employee]);
    });
  }

  async function showAddStaffModal() {
    const overlay = createModal('Add Staff', `
      <form data-hr-add-staff class="space-y-md">
        ${textField('full_name', 'Name', 'Jane Doe')}
        ${textField('email', 'Email', 'jane@eden.co.ke', 'email')}
        ${textField('phone', 'Phone', '+254...')}
        ${selectField('department', 'Department', ['Production', 'Collection', 'Inventory', 'Quality', 'Maintenance', 'Sales', 'Finance', 'HR'].map(v => [v, v]))}
        ${textField('position', 'Position', 'Machine Operator')}
        ${numberField('salary_ksh', 'Salary KES', 60000)}
        ${modalActions('Save Staff')}
      </form>
    `);
    overlay.querySelector('[data-hr-add-staff]').addEventListener('submit', async event => {
      event.preventDefault();
      const saved = await window.hrModule.addEmployee(Object.fromEntries(new FormData(event.currentTarget).entries()));
      overlay.remove();
      toast(saved ? 'Staff record added.' : 'Could not add staff.', saved ? 'success' : 'error');
      if (saved) await renderHrPage();
    });
  }

  async function showAssignTaskModal(employees = []) {
    if (!employees.length) employees = await window.hrModule.getEmployees();
    const overlay = createModal('Assign Task', `
      <form data-hr-task-form class="space-y-md">
        ${textField('title', 'Task', 'Inspect safety compliance')}
        <label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">Notes</span><textarea name="description" rows="3" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></textarea></label>
        ${selectField('assigned_to_id', 'Owner', employees.map(item => [item.id, `${item.full_name} - ${item.department}`]))}
        ${selectField('priority', 'Priority', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']])}
        <label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">Due date</span><input name="due_date" type="date" value="${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></label>
        ${modalActions('Assign')}
      </form>
    `);
    overlay.querySelector('[data-hr-task-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const saved = await window.hrModule.assignTask(Object.fromEntries(new FormData(event.currentTarget).entries()));
      overlay.remove();
      toast(saved ? 'Task assigned.' : 'Could not assign task.', saved ? 'success' : 'error');
      if (saved) await renderHrPage();
    });
  }

  async function showLeaveModal(employees) {
    const overlay = createModal('Leave Request', `
      <form data-hr-leave-form class="space-y-md">
        ${selectField('employee_id', 'Staff', employees.map(item => [item.id, item.full_name]))}
        ${selectField('leave_type', 'Type', [['annual', 'Annual'], ['sick', 'Sick'], ['emergency', 'Emergency']])}
        <label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">Start</span><input name="start_date" type="date" required class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></label>
        <label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">End</span><input name="end_date" type="date" required class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></label>
        ${numberField('days', 'Days', 1)}
        ${textField('reason', 'Reason', 'Reason')}
        ${modalActions('Submit')}
      </form>
    `);
    overlay.querySelector('[data-hr-leave-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const saved = await window.hrModule.applyLeave(Object.fromEntries(new FormData(event.currentTarget).entries()));
      overlay.remove();
      toast(saved ? 'Leave request saved.' : 'Could not save leave.', saved ? 'success' : 'error');
      if (saved) await renderHrPage();
    });
  }

  function showTaskDetail(task = {}) {
    const overlay = createModal(task.title || 'Task', `
      <div class="space-y-md">
        ${detailGrid([
          ['Owner', task.assigned_to_name || task.assigned_to || 'Unassigned'],
          ['Department', task.department || 'General'],
          ['Priority', formatLabel(task.priority)],
          ['Due', formatDate(task.due_date)],
          ['Status', formatLabel(task.status)]
        ])}
        <p class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-body-sm text-body-sm">${task.description || 'No notes.'}</p>
        <div class="flex justify-end gap-sm"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-task-progress class="px-md py-sm border border-primary text-primary rounded-full">Start</button><button type="button" data-task-done class="px-md py-sm bg-primary text-on-primary rounded-full">Complete</button></div>
      </div>
    `);
    overlay.querySelector('[data-task-progress]')?.addEventListener('click', async () => {
      await window.hrModule.updateTaskStatus(task.id, 'in_progress');
      overlay.remove();
      toast('Task started.', 'success');
      await renderHrPage();
    });
    overlay.querySelector('[data-task-done]')?.addEventListener('click', async () => {
      await window.hrModule.updateTaskStatus(task.id, 'completed');
      overlay.remove();
      toast('Task completed.', 'success');
      await renderHrPage();
    });
  }

  function showLeaveDetail(item = {}) {
    const overlay = createModal('Leave Decision', `
      <div class="space-y-md">
        ${detailGrid([
          ['Staff', item.employee_name],
          ['Type', formatLabel(item.leave_type)],
          ['Dates', `${formatDate(item.start_date)} - ${formatDate(item.end_date)}`],
          ['Days', item.days],
          ['Reason', item.reason],
          ['Status', formatLabel(item.status)]
        ])}
        <div class="flex justify-end gap-sm"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-leave-reject class="px-md py-sm border border-error text-error rounded-full">Reject</button><button type="button" data-leave-approve class="px-md py-sm bg-primary text-on-primary rounded-full">Approve</button></div>
      </div>
    `);
    overlay.querySelector('[data-leave-approve]')?.addEventListener('click', async () => decideLeave(item.id, true, overlay));
    overlay.querySelector('[data-leave-reject]')?.addEventListener('click', async () => decideLeave(item.id, false, overlay));
  }

  async function decideLeave(id, approved, overlay) {
    await window.hrModule.approveLeave(id, approved);
    overlay.remove();
    toast(approved ? 'Leave approved.' : 'Leave rejected.', 'success');
    await renderHrPage();
  }

  function showAttendanceDetail(item = {}) {
    createModal('Attendance Exception', `
      ${detailGrid([
        ['Staff', item.employee_name],
        ['Status', formatLabel(item.status)],
        ['Check In', item.check_in || 'Missing'],
        ['Check Out', item.check_out || 'Open'],
        ['Notes', item.notes || 'None']
      ])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function showSafetyDetail(text = '') {
    const isAlert = text.toLowerCase().includes('alert') || text.toLowerCase().includes('missing');
    const overlay = createModal(isAlert ? 'Safety Alert' : 'Safety Check', `
      <div class="space-y-md">
        <div class="p-sm rounded-lg ${isAlert ? 'bg-error-container/30 border-error/20' : 'bg-primary/10 border-primary/20'} border">
          <p class="font-label-md text-label-md text-on-surface">${cleanText(text)}</p>
        </div>
        <div class="flex justify-end gap-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button>
          ${isAlert ? '<button type="button" data-create-safety-task class="px-md py-sm bg-primary text-on-primary rounded-full">Create Task</button>' : '<button type="button" data-safety-log class="px-md py-sm bg-primary text-on-primary rounded-full">Log Check</button>'}
        </div>
      </div>
    `);
    overlay.querySelector('[data-create-safety-task]')?.addEventListener('click', async event => {
      event.target.closest('.fixed')?.remove();
      await createSafetyWarning();
    });
    overlay.querySelector('[data-safety-log]')?.addEventListener('click', event => {
      event.target.closest('.fixed')?.remove();
      toast('Safety check logged.', 'success');
    });
  }

  function showShiftDetail(text = '') {
    createModal('Shift Detail', `
      <div class="space-y-md">
        <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">${cleanText(text)}</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-sm">
          ${detailCard('Coverage', text.includes('Night') ? 'Drivers' : text.includes('Maintenance') ? 'Engineers' : 'Production')}
          ${detailCard('Status', 'Planned')}
          ${detailCard('Action', 'Assign staff')}
        </div>
        <div class="flex justify-end gap-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button>
          <button type="button" data-shift-task class="px-md py-sm bg-primary text-on-primary rounded-full">Assign Task</button>
        </div>
      </div>
    `).querySelector('[data-shift-task]')?.addEventListener('click', async event => {
      event.target.closest('.fixed')?.remove();
      showAssignTaskModal(await window.hrModule.getEmployees());
    });
  }

  function showOnboardingDetail(text = '') {
    createModal('Onboarding Detail', `
      <div class="space-y-md">
        <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">${cleanText(text)}</div>
        <div class="flex justify-end gap-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button>
          <button type="button" data-onboarding-task class="px-md py-sm bg-primary text-on-primary rounded-full">Create Follow-Up</button>
        </div>
      </div>
    `).querySelector('[data-onboarding-task]')?.addEventListener('click', async event => {
      const employees = await window.hrModule.getEmployees();
      const owner = employees.find(item => item.department === 'HR') || employees[0];
      await window.hrModule.assignTask({
        title: `Onboarding follow-up: ${cleanText(text).split(/\s+/).slice(0, 3).join(' ')}`,
        description: cleanText(text),
        assigned_to_id: owner?.id,
        priority: 'medium',
        due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        department: 'HR'
      });
      event.target.closest('.fixed')?.remove();
      toast('Onboarding follow-up created.', 'success');
      await renderHrPage();
    });
  }

  function showDepartmentDetail(department, employees, tasks, payroll) {
    const team = employees.filter(item => item.department === department);
    const deptTasks = tasks.filter(item => item.department === department || item.assigned_to_name && team.some(member => member.full_name === item.assigned_to_name));
    createModal(`${department} Workforce`, `
      <div class="space-y-md">
        ${detailGrid([
          ['Staff', team.length],
          ['Payroll', money(payroll.byDepartment?.[department] || 0)],
          ['Open Tasks', deptTasks.filter(item => item.status !== 'completed').length],
          ['Lead Action', 'Balance workload']
        ])}
        <div class="space-y-xs">
          ${team.map(member => `<button type="button" data-dept-staff="${member.id}" class="w-full text-left p-xs rounded-lg border border-outline-variant bg-surface-container-low">${member.full_name} - ${member.position || formatLabel(member.role)}</button>`).join('') || emptyBlock('No staff in this department.')}
        </div>
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `, 'Department Analysis');
  }

  async function showAttendanceModal(employees, attendance) {
    const rows = employees.map(employee => {
      const att = attendance.find(item => item.employee_id === employee.id);
      return `<button type="button" data-attendance-employee="${employee.id}" class="w-full text-left p-xs rounded-lg border border-outline-variant bg-surface-container-low flex items-center justify-between gap-sm"><span>${employee.full_name}</span>${statusBadge(att?.status || 'not_checked_in')}</button>`;
    }).join('');
    const overlay = createModal('Attendance Log', `<div class="space-y-xs">${rows}</div>`);
    overlay.querySelectorAll('[data-attendance-employee]').forEach(button => {
      button.addEventListener('click', async () => {
        await window.hrModule.recordCheckIn(button.dataset.attendanceEmployee);
        overlay.remove();
        toast('Attendance updated.', 'success');
        await renderHrPage();
      });
    });
  }

  async function createSafetyWarning() {
    const employees = await window.hrModule.getEmployees();
    const target = employees.find(item => item.department === 'Operations') || employees[0];
    const task = await window.hrModule.assignTask({
      title: 'Resolve PPE alert: Unit B-4',
      description: 'Eye protection gap detected. Confirm PPE issue, coach team, and close safety log.',
      assigned_to_id: target?.id,
      priority: 'high',
      due_date: new Date().toISOString().slice(0, 10),
      department: 'HR / Safety'
    });
    toast(task ? 'Safety task created.' : 'Could not create safety task.', task ? 'success' : 'error');
    if (task) await renderHrPage();
  }

  function showShiftCalendar() {
    createModal('Shift Calendar', `
      <div class="space-y-xs">
        ${['Morning Production - 06:00 - 14:00 - 82 staff', 'Night Logistics - 22:00 - 06:00 - 14 drivers', 'Maintenance - 08:00 - 16:00 - 5 engineers'].map(row => `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">${row}</div>`).join('')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function showOnboardingModal() {
    createModal('Onboarding', `
      <div class="space-y-xs">
        ${['Arlo Bennett - Safety briefing', 'Elena Rodriguez - ID issued', 'New operator kit - pending HR review'].map(row => `<button type="button" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant">${row}</button>`).join('')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  async function showHrReport() {
    const [stats, payroll, tasks] = await Promise.all([window.hrModule.getHRStats(), window.hrModule.getPayrollSummary(), window.hrModule.getTasks()]);
    createModal('HR Analysis', `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-sm">
        ${detailCard('Headcount', stats.headcount)}
        ${detailCard('Payroll', money(payroll.totalPayroll))}
        ${detailCard('Open Tasks', stats.openTasks)}
      </div>
      <div class="mt-md space-y-xs">
        ${Object.entries(payroll.byDepartment || {}).map(([dept, value]) => `<div class="p-xs rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md"><span>${dept}</span><strong>${money(value)}</strong></div>`).join('')}
      </div>
      <div class="mt-md p-sm rounded-lg bg-surface-container-low border border-outline-variant">High priority tasks: ${tasks.filter(task => task.priority === 'high' && task.status !== 'completed').length}</div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `, 'Workforce Analytics', 'max-w-4xl');
  }

  function showStaffFilterModal() {
    createModal('Filter Staff', `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        ${['Production', 'Collection', 'Inventory', 'Quality', 'Maintenance', 'Sales'].map(dept => `<button type="button" data-filter-dept="${dept}" class="p-sm rounded-lg border border-outline-variant bg-surface-container-low text-left">${dept}</button>`).join('')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function createModal(title, bodyHtml, eyebrow = 'HR Control', maxWidthClass = 'max-w-2xl') {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm flex items-center justify-center p-md';
    overlay.innerHTML = `
      <div class="w-full ${maxWidthClass} max-h-[88vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-lg transform transition-all scale-95 opacity-0" data-modal-card>
        <div class="flex items-start justify-between gap-md mb-md">
          <div><p class="font-label-sm text-label-sm text-primary uppercase">${eyebrow}</p><h3 class="font-headline-md text-headline-md text-on-surface">${title}</h3></div>
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
    setTimeout(() => document.dispatchEvent(new CustomEvent('eden:content-updated')), 50);
    return overlay;
  }

  function modalActions(label) {
    return `<div class="flex justify-end gap-sm pt-sm"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Cancel</button><button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">${label}</button></div>`;
  }

  function detailGrid(rows) {
    return `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">${rows.map(([label, value]) => detailCard(label, value)).join('')}</dl>`;
  }

  function detailCard(label, value) {
    return `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd class="font-body-md text-body-md text-on-surface">${value || 'Not captured'}</dd></div>`;
  }

  function textField(name, label, placeholder, type = 'text') {
    return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><input name="${name}" required type="${type}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="${placeholder}"></label>`;
  }

  function numberField(name, label, value) {
    return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><input name="${name}" required min="0" step="1" type="number" value="${Number(value || 0)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></label>`;
  }

  function selectField(name, label, options) {
    return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><select name="${name}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`;
  }

  function statusBadge(status = 'open') {
    const key = String(status || 'open').toLowerCase();
    const positive = ['present', 'active', 'approved', 'completed'].includes(key);
    const warning = ['late', 'pending', 'in_progress', 'not_checked_in'].includes(key);
    const cls = positive ? 'bg-primary/10 text-primary' : warning ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container';
    return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${formatLabel(status)}</span>`;
  }

  function emptyBlock(text) {
    return `<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">${text}</div>`;
  }

  function initials(value) {
    return String(value || 'ER').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function formatLabel(value) {
    return String(value || 'open').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
  }

  function money(value) {
    return `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function pageHref(page) {
    return ['127.0.0.1', 'localhost'].includes(window.location.hostname) ? `${page}?fresh=${Date.now()}` : page;
  }

  function toast(message, type = 'info') {
    window.edenUtils?.showToast(message, type);
  }
})();
