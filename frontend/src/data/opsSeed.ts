export type Customer = {
  id: string;
  companyName: string;
  contactName: string;
  category: string;
  creditLimitKsh: number;
  outstandingKsh: number;
  status: 'active' | 'on_hold' | 'inactive';
};

export type FinishedProduct = {
  id: string;
  name: string;
  availableKg: number;
  unitPrice: number;
};

export type OrderLine = {
  productId: string;
  productName: string;
  quantityKg: number;
  unitPrice: number;
};

export type SalesOrder = {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  items: OrderLine[];
  status: 'confirmed' | 'processing' | 'dispatched' | 'delivered' | 'blocked';
  invoiceId: string | null;
  paymentStatus: 'pending' | 'partial' | 'paid';
  orderDate: string;
  deliveryDate: string;
  notes?: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  items: OrderLine[];
  amountKsh: number;
  taxKsh: number;
  totalKsh: number;
  paidAmountKsh: number;
  issuedDate: string;
  dueDate: string;
  status: 'sent' | 'partial' | 'paid' | 'overdue';
  paymentDate: string | null;
};

export type Payment = {
  id: string;
  invoiceId: string;
  customerId: string;
  amountKsh: number;
  paymentDate: string;
  method: 'mpesa' | 'bank' | 'cash';
  referenceNumber: string;
};

export type Opportunity = {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantityKg: number;
  stage: 'qualified' | 'proposal' | 'negotiation';
  expectedClose: string;
};

export type Employee = {
  id: string;
  fullName: string;
  role: string;
  department: string;
  position: string;
  status: 'active' | 'inactive';
  salaryKsh: number;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: 'present' | 'late' | 'absent';
  late: boolean;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'approved' | 'pending' | 'rejected';
};

export type StaffTask = {
  id: string;
  title: string;
  assignedToName: string;
  assignedByName: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  department: string;
};

const today = () => new Date().toISOString().split('T')[0];

export const customers: Customer[] = [
  { id: 'cust-1', companyName: 'PlastiCo Kenya Ltd', contactName: 'Grace Njeri', category: 'manufacturer', creditLimitKsh: 500000, outstandingKsh: 120000, status: 'active' },
  { id: 'cust-2', companyName: 'BuildRight Materials', contactName: 'Hassan Abdi', category: 'distributor', creditLimitKsh: 300000, outstandingKsh: 0, status: 'active' },
  { id: 'cust-3', companyName: 'EcoPackaging Ltd', contactName: 'Irene Wambui', category: 'manufacturer', creditLimitKsh: 750000, outstandingKsh: 320000, status: 'active' },
  { id: 'cust-4', companyName: 'Metro Recyclers', contactName: 'John Kamau', category: 'recycler', creditLimitKsh: 200000, outstandingKsh: 200000, status: 'on_hold' }
];

export const finishedProducts: FinishedProduct[] = [
  { id: 'fin-1', name: 'PET Pellets (Clear)', availableKg: 420, unitPrice: 120 },
  { id: 'fin-2', name: 'HDPE Granules', availableKg: 1550, unitPrice: 140 },
  { id: 'fin-3', name: 'LDPE Film Roll', availableKg: 260, unitPrice: 110 }
];

export const salesOrders: SalesOrder[] = [
  { id: 'ord-1', orderNumber: 'ORD-2026-0041', customerId: 'cust-1', customerName: 'PlastiCo Kenya Ltd', items: [{ productId: 'fin-1', productName: 'PET Pellets (Clear)', quantityKg: 500, unitPrice: 120 }], status: 'delivered', invoiceId: 'inv-1', paymentStatus: 'paid', orderDate: '2026-05-20', deliveryDate: '2026-05-25' },
  { id: 'ord-2', orderNumber: 'ORD-2026-0042', customerId: 'cust-3', customerName: 'EcoPackaging Ltd', items: [{ productId: 'fin-2', productName: 'HDPE Granules', quantityKg: 1000, unitPrice: 140 }], status: 'processing', invoiceId: 'inv-2', paymentStatus: 'pending', orderDate: '2026-05-28', deliveryDate: '2026-06-02', notes: 'Priority customer' },
  { id: 'ord-3', orderNumber: 'ORD-2026-0043', customerId: 'cust-2', customerName: 'BuildRight Materials', items: [{ productId: 'fin-2', productName: 'HDPE Granules', quantityKg: 1200, unitPrice: 138 }, { productId: 'fin-3', productName: 'LDPE Film Roll', quantityKg: 200, unitPrice: 110 }], status: 'confirmed', invoiceId: null, paymentStatus: 'pending', orderDate: '2026-05-29', deliveryDate: '2026-06-05' },
  { id: 'ord-4', orderNumber: 'ORD-2026-0044', customerId: 'cust-1', customerName: 'PlastiCo Kenya Ltd', items: [{ productId: 'fin-3', productName: 'LDPE Film Roll', quantityKg: 200, unitPrice: 110 }], status: 'dispatched', invoiceId: 'inv-3', paymentStatus: 'pending', orderDate: '2026-05-29', deliveryDate: '2026-05-31' }
];

export const invoices: Invoice[] = [
  { id: 'inv-1', invoiceNumber: 'INV-2026-0021', orderId: 'ord-1', customerId: 'cust-1', customerName: 'PlastiCo Kenya Ltd', items: salesOrders[0].items, amountKsh: 60000, taxKsh: 9600, totalKsh: 69600, paidAmountKsh: 69600, issuedDate: '2026-05-20', dueDate: '2026-06-19', status: 'paid', paymentDate: '2026-05-27' },
  { id: 'inv-2', invoiceNumber: 'INV-2026-0022', orderId: 'ord-2', customerId: 'cust-3', customerName: 'EcoPackaging Ltd', items: salesOrders[1].items, amountKsh: 140000, taxKsh: 22400, totalKsh: 162400, paidAmountKsh: 0, issuedDate: '2026-05-28', dueDate: '2026-06-27', status: 'sent', paymentDate: null },
  { id: 'inv-3', invoiceNumber: 'INV-2026-0023', orderId: 'ord-4', customerId: 'cust-1', customerName: 'PlastiCo Kenya Ltd', items: salesOrders[3].items, amountKsh: 22000, taxKsh: 3520, totalKsh: 25520, paidAmountKsh: 0, issuedDate: '2026-05-29', dueDate: '2026-06-28', status: 'sent', paymentDate: null }
];

export const payments: Payment[] = [
  { id: 'pay-1', invoiceId: 'inv-1', customerId: 'cust-1', amountKsh: 69600, paymentDate: '2026-05-27', method: 'mpesa', referenceNumber: 'QER42MPESA' }
];

export const opportunities: Opportunity[] = [
  { id: 'opp-1', customerId: 'cust-2', customerName: 'BuildRight Materials', productId: 'fin-2', productName: 'HDPE Granules', quantityKg: 900, stage: 'qualified', expectedClose: '2026-06-18' },
  { id: 'opp-2', customerId: 'cust-4', customerName: 'Metro Recyclers', productId: 'fin-1', productName: 'PET Pellets (Clear)', quantityKg: 300, stage: 'proposal', expectedClose: '2026-06-21' },
  { id: 'opp-3', customerId: 'cust-3', customerName: 'EcoPackaging Ltd', productId: 'fin-3', productName: 'LDPE Film Roll', quantityKg: 420, stage: 'negotiation', expectedClose: '2026-06-24' }
];

export const employees: Employee[] = [
  { id: 'emp-1', fullName: 'Alice Manager', role: 'admin', department: 'Management', position: 'General Manager', status: 'active', salaryKsh: 180000 },
  { id: 'emp-2', fullName: 'Bob Supervisor', role: 'supervisor', department: 'Operations', position: 'Operations Supervisor', status: 'active', salaryKsh: 120000 },
  { id: 'emp-3', fullName: 'Brian Kiprotich', role: 'operator', department: 'Production', position: 'Machine Operator', status: 'active', salaryKsh: 65000 },
  { id: 'emp-4', fullName: 'Diana Muthoni', role: 'operator', department: 'Production', position: 'Machine Operator', status: 'active', salaryKsh: 65000 },
  { id: 'emp-5', fullName: 'Eve Atieno', role: 'qc_inspector', department: 'Quality', position: 'QC Inspector', status: 'active', salaryKsh: 75000 },
  { id: 'emp-6', fullName: 'Frank Omondi', role: 'technician', department: 'Maintenance', position: 'Maintenance Technician', status: 'active', salaryKsh: 80000 },
  { id: 'emp-7', fullName: 'Grace Collector', role: 'collector', department: 'Collection', position: 'Waste Collector', status: 'active', salaryKsh: 50000 }
];

export const attendance: AttendanceRecord[] = [
  { id: 'att-1', employeeId: 'emp-3', employeeName: 'Brian Kiprotich', date: today(), checkIn: '07:58', checkOut: null, status: 'present', late: false },
  { id: 'att-2', employeeId: 'emp-4', employeeName: 'Diana Muthoni', date: today(), checkIn: '08:15', checkOut: null, status: 'late', late: true },
  { id: 'att-3', employeeId: 'emp-5', employeeName: 'Eve Atieno', date: today(), checkIn: '07:45', checkOut: null, status: 'present', late: false },
  { id: 'att-4', employeeId: 'emp-6', employeeName: 'Frank Omondi', date: today(), checkIn: null, checkOut: null, status: 'absent', late: false }
];

export const leaveRequests: LeaveRequest[] = [
  { id: 'leave-1', employeeId: 'emp-6', employeeName: 'Frank Omondi', startDate: '2026-05-28', endDate: '2026-05-30', days: 3, status: 'approved' },
  { id: 'leave-2', employeeId: 'emp-7', employeeName: 'Grace Collector', startDate: '2026-06-02', endDate: '2026-06-03', days: 2, status: 'pending' }
];

export const staffTasks: StaffTask[] = [
  { id: 'task-1', title: 'Inspect Extruder Line A', assignedToName: 'Frank Omondi', assignedByName: 'Bob Supervisor', priority: 'high', dueDate: '2026-05-31', status: 'in_progress', department: 'Maintenance' },
  { id: 'task-2', title: 'Quality Report for PB-2026-001', assignedToName: 'Eve Atieno', assignedByName: 'Bob Supervisor', priority: 'medium', dueDate: '2026-06-01', status: 'pending', department: 'Quality' },
  { id: 'task-3', title: 'Greenwood Academy Follow-up', assignedToName: 'Grace Collector', assignedByName: 'Alice Manager', priority: 'low', dueDate: '2026-06-03', status: 'pending', department: 'Collection' }
];
