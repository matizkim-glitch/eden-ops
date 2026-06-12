import type { BosState, CollectionRoute, ProductionBatch, RawMaterial, StaffTask, StockProduct } from '../../app/bosData';

export type StatusCount = {
  label: string;
  count: number;
};

export type FacilityZone = {
  id: string;
  name: string;
  owner: string;
  status: 'steady' | 'watch' | 'blocked';
  detail: string;
};

export type DomainKpi = {
  label: string;
  value: string;
  note: string;
};

export function formatKg(value: number) {
  return `${Math.round(value).toLocaleString()} kg`;
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function countByStatus<T extends { status: string }>(items: T[]): StatusCount[] {
  const counts = items.reduce<Record<string, number>>((result, item) => {
    result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, {});

  return Object.entries(counts).map(([label, count]) => ({ label, count }));
}

export function getCollectionInsights(collections: CollectionRoute[]) {
  const totalKg = collections.reduce((sum, route) => sum + route.weight_kg, 0);
  const pending = collections.filter(route => route.status !== 'received');
  const nextRoute = pending[0] || collections[0];

  return {
    totalKg,
    pendingCount: pending.length,
    receivedCount: collections.length - pending.length,
    nextRoute,
    byStatus: countByStatus(collections)
  };
}

export function getFacilityZones(state: Pick<BosState, 'products' | 'rawMaterials' | 'batches' | 'tasks'>): FacilityZone[] {
  const lowProducts = state.products.filter(product => product.quantity_kg <= product.low_stock_threshold);
  const lowMaterials = state.rawMaterials.filter(material => material.quantity_kg <= material.reorder_threshold_kg);
  const activeBatches = state.batches.filter(batch => batch.status !== 'completed');
  const urgentTasks = state.tasks.filter(task => task.priority === 'high' && task.status !== 'completed');

  return [
    {
      id: 'warehouse',
      name: 'Finished Goods Warehouse',
      owner: 'Inventory',
      status: lowProducts.length ? 'watch' : 'steady',
      detail: lowProducts.length ? `${lowProducts.length} product lines under threshold` : `${state.products.length} stock lines available`
    },
    {
      id: 'materials',
      name: 'Raw Material Yard',
      owner: 'Collection + Inventory',
      status: lowMaterials.length ? 'watch' : 'steady',
      detail: lowMaterials.length ? `${lowMaterials.length} materials need replenishment` : `${state.rawMaterials.length} materials above reorder point`
    },
    {
      id: 'line',
      name: 'Production Line',
      owner: 'Production',
      status: activeBatches.some(batch => batch.status === 'qc_pending') ? 'watch' : 'steady',
      detail: `${activeBatches.length} active batches on the floor`
    },
    {
      id: 'safety',
      name: 'Safety Desk',
      owner: 'Maintenance',
      status: urgentTasks.length ? 'blocked' : 'steady',
      detail: urgentTasks.length ? `${urgentTasks.length} high-priority tasks open` : 'No high-priority safety work open'
    }
  ];
}

export function getMaintenanceInsights(tasks: StaffTask[], batches: ProductionBatch[]) {
  const maintenanceTasks = tasks.filter(task => task.department.toLowerCase() === 'maintenance');
  const open = maintenanceTasks.filter(task => task.status !== 'completed');
  const highPriority = open.filter(task => task.priority === 'high');
  const downtimeRisk = batches.some(batch => ['materials_requested', 'qc_pending'].includes(batch.status)) || highPriority.length > 0;

  return {
    open,
    highPriority,
    completedCount: maintenanceTasks.length - open.length,
    downtimeRisk: downtimeRisk ? 'Elevated' : 'Controlled'
  };
}

export function getSustainabilityKpis(collections: CollectionRoute[], batches: ProductionBatch[]): DomainKpi[] {
  const collectedKg = collections.reduce((sum, route) => sum + route.weight_kg, 0);
  const completedOutputKg = batches
    .filter(batch => batch.status === 'completed')
    .reduce((sum, batch) => sum + batch.output_qty_kg, 0);
  const targetKg = batches.reduce((sum, batch) => sum + batch.target_qty_kg, 0);
  const yieldPct = targetKg > 0 ? (completedOutputKg / targetKg) * 100 : 0;
  const co2eSavedKg = collectedKg * 0.42;

  return [
    { label: 'Waste Diverted', value: formatKg(collectedKg), note: 'Based on collection route weights' },
    { label: 'CO2e Avoided', value: formatKg(co2eSavedKg), note: 'Estimated at 0.42 kg CO2e per kg recovered' },
    { label: 'Production Yield', value: formatPercent(yieldPct), note: 'Completed output against planned batch targets' }
  ];
}

export function getInfrastructureKpis(state: Pick<BosState, 'tasks' | 'auditEvents' | 'collections'>): DomainKpi[] {
  const infraTasks = state.tasks.filter(task => ['Infrastructure', 'Operations'].includes(task.department));
  const openInfraTasks = infraTasks.filter(task => task.status !== 'completed');
  const receivedRoutes = state.collections.filter(route => route.status === 'received').length;
  const routeSyncPct = state.collections.length ? (receivedRoutes / state.collections.length) * 100 : 100;

  return [
    { label: 'Open Checks', value: String(openInfraTasks.length), note: 'Infrastructure and operations tasks still active' },
    { label: 'Audit Events', value: String(state.auditEvents.length), note: 'React workspace activity records' },
    { label: 'Route Sync', value: formatPercent(routeSyncPct), note: 'Collection routes posted as received' }
  ];
}

export function getStockPressure(products: StockProduct[], rawMaterials: RawMaterial[]) {
  return {
    finishedLow: products.filter(product => product.quantity_kg <= product.low_stock_threshold),
    materialsLow: rawMaterials.filter(material => material.quantity_kg <= material.reorder_threshold_kg)
  };
}
