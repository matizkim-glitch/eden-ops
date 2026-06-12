import {
  Activity,
  Badge,
  Banknote,
  Boxes,
  Building2,
  Factory,
  LayoutDashboard,
  Map,
  Recycle,
  Settings2,
  Truck,
  Users,
  Wrench
} from 'lucide-react';

export const departments = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'collection', label: 'Waste Collection', icon: Recycle },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'sales', label: 'Sales & Distribution', icon: Truck },
  { id: 'crm', label: 'Customer & CRM', icon: Users },
  { id: 'hr', label: 'HR', icon: Badge },
  { id: 'finance', label: 'Finance', icon: Banknote },
  { id: 'sustainability', label: 'Sustainability', icon: Activity },
  { id: 'facility', label: 'Facility Map', icon: Map },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'infrastructure', label: 'Infrastructure', icon: Settings2 },
  { id: 'operations', label: 'Operations Control', icon: Building2 }
] as const;

export type DepartmentId = (typeof departments)[number]['id'];

export const defaultDepartment: DepartmentId = 'overview';
