const fs = require('fs');

const source = fs.readFileSync('!-- Waste Collection --.txt', 'utf8');
const filesBySection = {
  'Waste Collection': 'waste_collection.html',
  'Operations Overview': 'operations_overview.html',
  'Production Monitoring': 'production_monitoring.html',
  'HR & Staffing': 'hr_staffing.html',
  'Sales & Distribution': 'sales_distribution.html',
  'Facility Map': 'facility_map.html',
  'Maintenance Scheduling': 'maintenance_scheduling.html',
  'Sustainability Analytics': 'sustainability_analytics.html',
  'Infrastructure & Facility': 'infrastructure_facility.html',
  'Finance Overview': 'finance_overview.html',
  'Supplier & Inventory': 'supplier_inventory.html',
  'School Collection Flow': 'school_collection_flow.html',
  'Customer & CRM': 'customer_crm.html',
  'Production & Quality Control': 'production_quality_control.html',
  'HR, Staffing & Tasking': 'hr_staffing_tasking.html'
};

const moduleByPage = {
  waste_collection: 'collection',
  school_collection_flow: 'collection',
  supplier_inventory: 'inventory',
  production_monitoring: 'production',
  production_quality_control: 'production',
  facility_map: 'production',
  maintenance_scheduling: 'production',
  sales_distribution: 'sales',
  customer_crm: 'sales',
  hr_staffing: 'hr',
  hr_staffing_tasking: 'hr',
  finance_overview: 'finance',
  infrastructure_facility: 'finance',
  sustainability_analytics: 'finance',
  operations_overview: 'dashboard'
};

const coreScripts = moduleName => [
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
  '<script src="js/config.js"></script>',
  '<script src="js/supabase-client.js"></script>',
  '<script src="js/state.js"></script>',
  '<script src="js/auth.js"></script>',
  '<script src="js/router.js?v=20260529"></script>',
  '<script src="js/utils.js"></script>',
  '<script src="js/components/toast.js"></script>',
  '<script src="js/components/modal.js"></script>',
  '<script src="js/components/table.js"></script>',
  '<script src="js/components/charts.js"></script>',
  '<script src="js/notifications.js"></script>',
  moduleName ? `<script src="js/modules/${moduleName}.js"></script>` : ''
].filter(Boolean).join('\n');

const sectionPattern = /<!-- ([^>]+) -->\r?\n<!DOCTYPE html>/g;
const sections = [];
let match;
while ((match = sectionPattern.exec(source))) {
  sections.push({ name: match[1], start: match.index });
}

for (let index = 0; index < sections.length; index += 1) {
  const section = sections[index];
  const file = filesBySection[section.name];
  if (!file) continue;

  const end = index + 1 < sections.length ? sections[index + 1].start : source.length;
  const pageName = file.replace('.html', '');
  const injected = source
    .slice(section.start, end)
    .trim()
    .replace('</head>', `\n<!-- Core Application Scripts -->\n${coreScripts(moduleByPage[pageName])}\n</head>`);

  fs.writeFileSync(file, injected);
  console.log(`restored ${file} (${injected.length} bytes)`);
}
