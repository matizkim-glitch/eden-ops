export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type RawMaterial = {
  id: string;
  name: string;
  category: string;
  quantity_kg: number;
  unit_cost: number;
  reorder_threshold_kg: number;
  reorder_quantity_kg?: number;
  preferred_supplier_id?: string | null;
  supplier_id: string | null;
  supplier_name: string;
  last_updated: string;
};

export type FinishedProduct = {
  id: string;
  name: string;
  sku: string;
  quantity_kg: number;
  unit_price: number;
  category: string;
  status: StockStatus;
  recipe?: Array<{
    material_id: string;
    material_name: string;
    kg_per_kg: number;
  }>;
};

export type Supplier = {
  id: string;
  name: string;
  contact_name: string;
  contact_phone: string;
  email: string;
  material_type: string;
  rating: number;
  status: 'active' | 'delayed' | 'inactive';
};

export type InventoryBatch = {
  id: string;
  material_id: string;
  material_name: string;
  weight_kg: number;
  supplier_id: string;
  supplier_name: string;
  status: 'stored' | 'processing' | 'in_transit';
  received_date: string | null;
  notes: string;
};

export type StockMovement = {
  id: string;
  finished_product_id: string | null;
  material_id: string | null;
  source_type: string;
  source_id: string;
  source_module: string;
  quantity_kg: number;
  movement_type: 'finished_dispatch' | 'finished_receipt';
  resulting_balance: number;
  notes: string;
  created_by: string;
  created_at: string;
};

export type ProductionBatch = {
  id: string;
  batch_number: string;
  product_name: string;
  raw_material_id: string;
  raw_material_name: string;
  input_kg: number;
  output_kg: number | null;
  efficiency_pct: number | null;
  machine_id: string;
  machine_name: string;
  operator_id: string;
  operator_name: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'qc_passed' | 'rejected';
  start_time: string;
  end_time: string | null;
  quality_grade: string | null;
  notes: string;
  finished_stock_credited_at?: string | null;
  qc_checked_at?: string | null;
};

export type QCLog = {
  id: string;
  batch_id: string;
  batch_number: string;
  inspector_id: string;
  inspector_name: string;
  inspection_date: string;
  melt_flow_index: number;
  density: number;
  moisture_pct: number;
  contamination_pct: number;
  grade: string;
  passed: boolean;
  notes: string;
};

export type Machine = {
  id: string;
  name: string;
  type: string;
  location: string;
  status: 'operational' | 'maintenance' | 'offline';
  last_maintenance: string;
  next_maintenance: string;
  capacity_kg_hr: number;
};

export type MaintenanceTask = {
  id: string;
  machine_id: string;
  machine_name: string;
  type: 'preventive' | 'corrective' | 'inspection';
  scheduled_date: string;
  technician_id: string;
  technician_name: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  cost_ksh: number;
  notes: string;
  completed_date?: string;
};
