import type { DepartmentId } from './navigation';

export type Metric = {
  label: string;
  value: string;
  note: string;
};

export type Workflow = {
  title: string;
  owner: string;
  status: 'Ready' | 'In Progress' | 'Review' | 'Blocked';
};

export type DepartmentModule = {
  id: DepartmentId;
  title: string;
  subtitle: string;
  priority: string;
  metrics: Metric[];
  workflows: Workflow[];
  handoffs: string[];
};

export const modules: Record<DepartmentId, DepartmentModule> = {
  overview: {
    id: 'overview',
    title: 'Operations Dashboard',
    subtitle: 'Company-wide view of collection, inventory, production, sales, finance, and people operations.',
    priority: 'Review cross-department exceptions before routine work.',
    metrics: [
      { label: 'Open Department Actions', value: '18', note: 'Across production, sales, HR, and inventory' },
      { label: 'Stock Risk', value: '4', note: 'Materials below reorder threshold' },
      { label: 'Revenue Pipeline', value: 'KES 1.9M', note: 'Orders, invoices, and expected payments' }
    ],
    workflows: [
      { title: 'Blocked PET demand', owner: 'Inventory + Production', status: 'Review' },
      { title: 'QC batch release', owner: 'Production Lead', status: 'In Progress' },
      { title: 'Payment reconciliation', owner: 'Finance', status: 'Ready' }
    ],
    handoffs: ['Sales demand creates inventory review', 'Production completion credits finished stock', 'Finance closes invoice balances']
  },
  collection: {
    id: 'collection',
    title: 'Waste Collection',
    subtitle: 'Routes, school pickups, vehicle tracking, weigh-in, and raw material receipts.',
    priority: 'Confirm today routes and post received collections to the inventory ledger.',
    metrics: [
      { label: 'Active Routes', value: '6', note: 'Two live vehicle updates expected' },
      { label: 'Schools Scheduled', value: '24', note: 'Mapped pickup locations' },
      { label: 'Raw Receipts Pending', value: '3', note: 'Need weighbridge confirmation' }
    ],
    workflows: [
      { title: 'North Sector route', owner: 'Collection Lead', status: 'In Progress' },
      { title: 'School map validation', owner: 'Operations', status: 'Ready' },
      { title: 'HDPE receipt posting', owner: 'Inventory', status: 'Review' }
    ],
    handoffs: ['Received collection creates raw stock movement', 'Vehicle delays notify Sales and Operations', 'School activity updates sustainability reporting']
  },
  inventory: {
    id: 'inventory',
    title: 'Inventory',
    subtitle: 'Raw materials, finished goods, suppliers, reorder rules, reservations, and stock movements.',
    priority: 'Resolve blocked customer demand before allowing confirmed orders.',
    metrics: [
      { label: 'Finished Stock Value', value: 'KES 1.6M', note: 'Available sellable stock' },
      { label: 'Low Materials', value: '5', note: 'Below configured threshold' },
      { label: 'Ledger Integrity', value: '100%', note: 'Balances reconstruct from stock movements' }
    ],
    workflows: [
      { title: 'Reserve PET pellets demand', owner: 'Inventory Controller', status: 'Review' },
      { title: 'Queue EKO inputs reorder', owner: 'Procurement', status: 'Ready' },
      { title: 'Issue wax to production', owner: 'Inventory + Production', status: 'In Progress' }
    ],
    handoffs: ['Sales orders reserve finished goods', 'Production requests raw inputs', 'Procurement receives supplier restocks']
  },
  production: {
    id: 'production',
    title: 'Production',
    subtitle: 'Batch lifecycle from material request, issue, line work, QC, completion, and finished stock credit.',
    priority: 'Move every notification into a concrete batch action.',
    metrics: [
      { label: 'Active Batches', value: '3', note: 'Material issue, production, and QC stages' },
      { label: 'QC Actions', value: '2', note: 'Pass/reject decisions needed' },
      { label: 'Output Today', value: '1,210 kg', note: 'Across HDPE, PET, and EKO polish' }
    ],
    workflows: [
      { title: 'EKO Shoe Polish batch', owner: 'Production Lead', status: 'In Progress' },
      { title: 'PB-2026-004 QC record', owner: 'QC Inspector', status: 'Review' },
      { title: 'HDPE Granules output credit', owner: 'Inventory', status: 'Ready' }
    ],
    handoffs: ['Material requests go to Inventory', 'QC passed batches credit finished stock', 'Failed QC creates production rework task']
  },
  sales: {
    id: 'sales',
    title: 'Sales & Distribution',
    subtitle: 'Quotations, orders, invoices, dispatches, sellable stock, and revenue analysis.',
    priority: 'Do not confirm orders without available or approved production stock.',
    metrics: [
      { label: 'Revenue Collected', value: 'KES 232K', note: 'Current period payments' },
      { label: 'Orders Needing Action', value: '3', note: 'Stock or dispatch confirmation' },
      { label: 'Shipped Volume', value: '700 kg', note: 'Delivered and in-transit dispatches' }
    ],
    workflows: [
      { title: 'Multi-product invoice', owner: 'Finance + Sales', status: 'Ready' },
      { title: 'Blocked stock order', owner: 'Inventory + Production', status: 'Review' },
      { title: 'Delivery confirmation', owner: 'Distribution', status: 'In Progress' }
    ],
    handoffs: ['Unavailable stock notifies Inventory and Production', 'Invoices flow to Finance', 'Dispatch deducts stock ledger']
  },
  crm: {
    id: 'crm',
    title: 'Customer & CRM',
    subtitle: 'Accounts, opportunities, customer risk, communication history, and order readiness.',
    priority: 'Convert opportunities only after stock, pricing, and credit checks pass.',
    metrics: [
      { label: 'Open Opportunities', value: '12', note: 'Qualified customer demand' },
      { label: 'Credit Holds', value: '2', note: 'Finance review required' },
      { label: 'At-Risk Accounts', value: '4', note: 'Need follow-up this week' }
    ],
    workflows: [
      { title: 'Opportunity stock check', owner: 'Sales + Inventory', status: 'Review' },
      { title: 'Customer credit review', owner: 'Finance', status: 'Ready' },
      { title: 'Follow-up campaign', owner: 'CRM Lead', status: 'In Progress' }
    ],
    handoffs: ['Qualified demand creates sales draft', 'No-stock opportunities notify Production', 'Credit checks block risky orders']
  },
  hr: {
    id: 'hr',
    title: 'HR',
    subtitle: 'Staffing, attendance, tasks, onboarding, leave, payroll inputs, and department assignments.',
    priority: 'Assign staff capacity to urgent production, collection, and maintenance needs.',
    metrics: [
      { label: 'Present Today', value: '42', note: 'Across all shifts' },
      { label: 'Open Staff Tasks', value: '9', note: 'Department-linked work' },
      { label: 'Leave Requests', value: '3', note: 'Manager approval required' }
    ],
    workflows: [
      { title: 'Maintenance technician assignment', owner: 'HR + Maintenance', status: 'Ready' },
      { title: 'Production shift coverage', owner: 'HR + Production', status: 'Review' },
      { title: 'Payroll input close', owner: 'HR + Finance', status: 'In Progress' }
    ],
    handoffs: ['Task assignments support every department', 'Attendance feeds payroll', 'Shift gaps notify Operations']
  },
  finance: {
    id: 'finance',
    title: 'Finance',
    subtitle: 'Invoices, payments, balances, reversals, reconciliation, payroll costs, and cash reporting.',
    priority: 'Maintain immutable payment history and close reconciliations daily.',
    metrics: [
      { label: 'Outstanding', value: 'KES 25.5K', note: 'Customer balances' },
      { label: 'Reconciled', value: '94%', note: 'Payments matched to invoices' },
      { label: 'Payroll Accrual', value: 'KES 418K', note: 'Current month estimate' }
    ],
    workflows: [
      { title: 'Partial payment posting', owner: 'Finance Officer', status: 'Ready' },
      { title: 'Payment reversal review', owner: 'Finance Manager', status: 'Review' },
      { title: 'Sales invoice reconciliation', owner: 'Finance + Sales', status: 'In Progress' }
    ],
    handoffs: ['Sales invoices create receivables', 'Payments update balances through immutable records', 'Payroll inputs come from HR']
  },
  sustainability: {
    id: 'sustainability',
    title: 'Sustainability',
    subtitle: 'Impact analytics, school participation, waste diverted, emissions savings, and ESG reporting.',
    priority: 'Validate source data from collection and production before publishing reports.',
    metrics: [
      { label: 'Waste Diverted', value: '18.4T', note: 'Current reporting period' },
      { label: 'CO2e Saved', value: '7.8T', note: 'Calculated from material recovery' },
      { label: 'School Participation', value: '86%', note: 'Active school partners' }
    ],
    workflows: [
      { title: 'Monthly ESG pack', owner: 'Sustainability Lead', status: 'In Progress' },
      { title: 'School impact certificate', owner: 'Collection + Sustainability', status: 'Ready' },
      { title: 'Production yield analysis', owner: 'Production + Sustainability', status: 'Review' }
    ],
    handoffs: ['Collection validates source volumes', 'Production reports conversion yield', 'Sales receives customer impact proof']
  },
  facility: {
    id: 'facility',
    title: 'Facility Map',
    subtitle: 'Site layout, live zones, machine status, inventory locations, and operational incidents.',
    priority: 'Expose urgent facility events as actions, not just notifications.',
    metrics: [
      { label: 'Operational Zones', value: '8', note: 'Monitored production and storage areas' },
      { label: 'Alerts', value: '2', note: 'Maintenance and safety checks' },
      { label: 'Asset Coverage', value: '96%', note: 'Mapped equipment and storage bins' }
    ],
    workflows: [
      { title: 'Film Press C maintenance', owner: 'Maintenance', status: 'Review' },
      { title: 'Warehouse lane clearance', owner: 'Operations', status: 'Ready' },
      { title: 'Washing station inspection', owner: 'Production', status: 'In Progress' }
    ],
    handoffs: ['Facility issues become maintenance tasks', 'Storage map supports inventory counts', 'Safety alerts notify HR and Operations']
  },
  maintenance: {
    id: 'maintenance',
    title: 'Maintenance',
    subtitle: 'Preventive schedules, corrective work, safety overrides, assets, technicians, and downtime risk.',
    priority: 'Convert every maintenance control item into an assigned task or asset update.',
    metrics: [
      { label: 'Open Work Orders', value: '7', note: 'Three due today' },
      { label: 'Downtime Risk', value: 'Medium', note: 'Film Press C requires action' },
      { label: 'Preventive Compliance', value: '91%', note: 'Rolling 30-day completion' }
    ],
    workflows: [
      { title: 'Safety override check', owner: 'Maintenance Desk', status: 'Ready' },
      { title: 'IoT network check', owner: 'Infrastructure', status: 'In Progress' },
      { title: 'Asset update approval', owner: 'Operations', status: 'Review' }
    ],
    handoffs: ['HR assigns technicians', 'Facility map shows affected zones', 'Production receives downtime alerts']
  },
  infrastructure: {
    id: 'infrastructure',
    title: 'Infrastructure',
    subtitle: 'IoT devices, integrations, connectivity, backups, monitoring, and deployment operations.',
    priority: 'Keep deployment, monitoring, and recovery checks visible before go-live.',
    metrics: [
      { label: 'IoT Health', value: '97%', note: 'Connected sensors and devices' },
      { label: 'Backup Status', value: 'Ready', note: 'Restore procedure required for go-live' },
      { label: 'Deploy Checks', value: '8/10', note: 'Live Supabase validation still pending' }
    ],
    workflows: [
      { title: 'Supabase live validation', owner: 'DevOps', status: 'Review' },
      { title: 'CSP enforcement', owner: 'Security', status: 'In Progress' },
      { title: 'Monitoring alerts', owner: 'Operations', status: 'Ready' }
    ],
    handoffs: ['Deployment status informs Operations', 'IoT issues notify Maintenance', 'Backup health supports Finance and audit readiness']
  },
  operations: {
    id: 'operations',
    title: 'Operations Control',
    subtitle: 'Executive control layer for exceptions, escalations, approvals, and cross-department accountability.',
    priority: 'Prioritize blockers that stop revenue, production, safety, or stock integrity.',
    metrics: [
      { label: 'Critical Exceptions', value: '4', note: 'Require manager action' },
      { label: 'Cross-Dept Handoffs', value: '11', note: 'Tracked through owner and state' },
      { label: 'Readiness Score', value: '72%', note: 'Improved by React migration foundation' }
    ],
    workflows: [
      { title: 'Go-live blocker review', owner: 'Operations Manager', status: 'Review' },
      { title: 'Department SLA check', owner: 'Managers', status: 'Ready' },
      { title: 'Audit evidence pack', owner: 'Admin', status: 'In Progress' }
    ],
    handoffs: ['All department blockers roll up here', 'Approvals are role-based', 'Reports combine finance, stock, production, and HR evidence']
  }
};
