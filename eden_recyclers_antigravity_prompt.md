# Eden Recyclers — Full Logic Flow Implementation Prompt for Antigravity + Supabase

---

## SECTION 1: TECH STACK DECISION & RATIONALE

### Recommended Stack (keep all within this framework)

| Layer | Technology | Reason |
|---|---|---|
| **IDE / Agent** | Google Antigravity | Already in use; Gemini 3.1 Pro agents write across multiple files simultaneously |
| **Frontend** | Vanilla HTML + Tailwind CSS (CDN) | Already built in Stitch — do NOT migrate to React. Keep the existing codebase. |
| **Scripting** | Vanilla JavaScript (ES6+) | Matches existing Stitch output; no build step needed |
| **Backend/Database** | Supabase (PostgreSQL) | Structured relational data, inventory joins, real-time subscriptions via WebSockets, Row Level Security, open-source, predictable pricing |
| **Auth** | Supabase Auth | Built-in, supports email/password + role-based access |
| **Real-time** | Supabase Realtime (WebSockets) | Live dashboard updates, collection status changes, production alerts |
| **File Storage** | Supabase Storage | Delivery photos, weigh-slip images, export documents |
| **Automation / Serverless** | Supabase Edge Functions (Deno/TypeScript) | Automated alerts, scheduled reports, low-stock triggers |
| **Hosting** | Vercel (static deploy) or Supabase hosting | Free tier sufficient for launch |
| **Notifications** | Africa's Talking SMS API | Kenyan SMS alerts to field drivers, school coordinators |
| **PDF Export** | jsPDF (CDN) | In-browser invoice and report generation |
| **Charts** | Chart.js (CDN) | Already consistent with existing Tailwind/vanilla stack |

### Why Supabase over Firebase for Eden Recyclers
- Eden's data is deeply **relational**: schools → collections → inventory → batches → sales → payments. SQL joins are essential.
- Inventory transactions require **atomic operations** (decrement raw material AND create batch record simultaneously). Supabase PostgreSQL handles this; Firebase Firestore does not.
- **Cost predictability**: Supabase charges flat per project, not per read/write. An ERP doing thousands of reads per day would spike Firebase costs unpredictably.
- **Row Level Security**: Supabase allows field collectors to only see their own assigned routes, managers to see everything — enforced at the database level.
- Antigravity has a **native Supabase MCP** integration — the agent can write schema, queries, and real-time subscriptions from natural language prompts.

---

## SECTION 2: DATABASE SCHEMA (Supabase/PostgreSQL)

Instruct Antigravity to create the following tables in Supabase. Paste this into Antigravity as the first task:

```sql
-- USERS & AUTH
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  role text check (role in ('admin','manager','collector','production','sales','hr','finance')),
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);

-- SCHOOLS
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zone text,
  contact_name text,
  contact_phone text,
  address text,
  active boolean default true,
  participation_score integer default 0,
  created_at timestamptz default now()
);

-- WASTE COLLECTIONS
create table collections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id),
  collector_id uuid references profiles(id),
  collection_date date not null,
  weight_kg numeric(10,2),
  waste_type text check (waste_type in ('plastic_bottles','hdpe','ldpe','mixed_plastic')),
  status text check (status in ('scheduled','in_transit','weighed','received','cancelled')) default 'scheduled',
  weigh_slip_url text,
  notes text,
  created_at timestamptz default now()
);

-- INVENTORY — RAW MATERIALS
create table raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  quantity_kg numeric(10,2) default 0,
  unit_cost numeric(10,2),
  reorder_threshold_kg numeric(10,2) default 50,
  supplier_id uuid,
  last_updated timestamptz default now()
);

-- INVENTORY — FINISHED PRODUCTS
create table finished_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  quantity integer default 0,
  unit_price numeric(10,2),
  low_stock_threshold integer default 20,
  created_at timestamptz default now()
);

-- PRODUCTION BATCHES
create table batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text unique not null,
  product_id uuid references finished_products(id),
  raw_material_id uuid references raw_materials(id),
  raw_material_used_kg numeric(10,2),
  units_produced integer,
  status text check (status in ('planned','in_progress','qc_check','completed','rejected')) default 'planned',
  started_at timestamptz,
  completed_at timestamptz,
  supervisor_id uuid references profiles(id),
  qc_passed boolean,
  notes text,
  created_at timestamptz default now()
);

-- MACHINERY MAINTENANCE
create table maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  machine_name text not null,
  maintenance_type text check (maintenance_type in ('preventive','corrective','emergency')),
  scheduled_date date,
  completed_date date,
  technician_id uuid references profiles(id),
  status text check (status in ('scheduled','in_progress','completed','overdue')) default 'scheduled',
  notes text,
  cost numeric(10,2),
  created_at timestamptz default now()
);

-- CUSTOMERS
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('distributor','retailer','direct')),
  contact_name text,
  contact_phone text,
  email text,
  address text,
  credit_limit numeric(10,2) default 0,
  outstanding_balance numeric(10,2) default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- SALES ORDERS
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid references customers(id),
  salesperson_id uuid references profiles(id),
  order_date date not null,
  delivery_date date,
  status text check (status in ('draft','confirmed','dispatched','delivered','invoiced','paid','overdue')) default 'draft',
  total_amount numeric(12,2),
  paid_amount numeric(12,2) default 0,
  notes text,
  created_at timestamptz default now()
);

-- ORDER LINE ITEMS
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references finished_products(id),
  quantity integer not null,
  unit_price numeric(10,2) not null,
  line_total numeric(12,2) generated always as (quantity * unit_price) stored
);

-- INVOICES
create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  order_id uuid references orders(id),
  customer_id uuid references customers(id),
  issued_date date not null,
  due_date date not null,
  amount numeric(12,2) not null,
  paid_amount numeric(12,2) default 0,
  status text check (status in ('draft','sent','partial','paid','overdue')) default 'draft',
  pdf_url text,
  created_at timestamptz default now()
);

-- PAYMENTS
create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id),
  customer_id uuid references customers(id),
  amount numeric(12,2) not null,
  payment_date date not null,
  method text check (method in ('mpesa','bank_transfer','cash','cheque')),
  reference_number text,
  recorded_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- HR — STAFF
create table staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  employee_number text unique,
  department text,
  position text,
  employment_type text check (employment_type in ('full_time','part_time','casual','contractor')),
  start_date date,
  salary numeric(10,2),
  manager_id uuid references staff(id),
  onboarding_stage integer default 1,
  onboarding_complete boolean default false,
  active boolean default true
);

-- ATTENDANCE
create table attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id),
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text check (status in ('present','absent','late','half_day','leave')) default 'present',
  shift text check (shift in ('morning','afternoon','night')),
  notes text
);

-- TASKS
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id),
  assigned_by uuid references profiles(id),
  module text check (module in ('collection','inventory','production','sales','hr','finance')),
  priority text check (priority in ('low','medium','high','urgent')) default 'medium',
  status text check (status in ('pending','in_progress','completed','cancelled')) default 'pending',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  title text not null,
  body text,
  type text check (type in ('alert','info','success','warning')),
  module text,
  read boolean default false,
  created_at timestamptz default now()
);

-- SUPPLIERS
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_phone text,
  email text,
  supplies text,
  active boolean default true,
  created_at timestamptz default now()
);
```

---

## SECTION 3: SUPABASE ROW LEVEL SECURITY POLICIES

After creating tables, instruct Antigravity to add these RLS policies:

```sql
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table collections enable row level security;
alter table orders enable row level security;
alter table attendance enable row level security;
-- (repeat for all tables)

-- Admins and managers see everything
create policy "Managers see all" on collections
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','manager'))
  );

-- Collectors only see their own assignments
create policy "Collectors see own" on collections
  for select using (collector_id = auth.uid());

-- Staff only see their own attendance
create policy "Staff see own attendance" on attendance
  for select using (
    staff_id = (select id from staff where profile_id = auth.uid())
  );
```

---

## SECTION 4: JAVASCRIPT MODULE ARCHITECTURE

Instruct Antigravity to create the following file structure alongside the existing Stitch HTML files:

```
/js/
  supabase-client.js       ← Supabase init + env variables
  auth.js                  ← Login, logout, session management, role-based redirects
  router.js                ← Client-side page routing between HTML files
  state.js                 ← Global app state (current user, current module)
  utils.js                 ← Shared helpers: formatDate, formatKES, showToast, showModal
  notifications.js         ← Real-time notification subscription + bell badge
  
/modules/
  collection.js            ← All waste collection logic
  inventory.js             ← Raw materials + finished goods logic
  production.js            ← Batch management logic
  sales.js                 ← Orders, invoices, customer logic
  hr.js                    ← Staff, attendance, onboarding logic
  finance.js               ← Payments, debt, reporting logic
  dashboard.js             ← KPI aggregation for main dashboard

/components/
  toast.js                 ← Toast notification component
  modal.js                 ← Reusable confirm/form modal
  table.js                 ← Reusable sortable/filterable table renderer
  charts.js                ← Chart.js wrapper functions
```

---

## SECTION 5: AUTHENTICATION FLOW

### Login Page (`login.html`)
**On page load:** Check `supabase.auth.getSession()`. If session exists → redirect to `dashboard.html`.

**Login form submit button "Sign In":**
1. Validate email + password fields (show inline error if empty)
2. Call `supabase.auth.signInWithPassword({ email, password })`
3. On success: fetch user profile from `profiles` table to get `role`
4. Store role in `localStorage` as `eden_user_role`
5. Redirect based on role:
   - `admin` / `manager` → `dashboard.html`
   - `collector` → `collection.html`
   - `production` → `production.html`
   - `sales` → `sales.html`
   - `hr` → `hr.html`
   - `finance` → `finance.html`
6. On error: show red toast "Invalid email or password"

**"Forgot Password" link:** Navigate to `reset-password.html`, call `supabase.auth.resetPasswordForEmail(email)`

### Session Guard (add to TOP of every page's `<script>`)
```javascript
const { data: { session } } = await supabase.auth.getSession();
if (!session) window.location.href = 'login.html';
const userRole = localStorage.getItem('eden_user_role');
// Hide nav items the user's role cannot access
document.querySelectorAll('[data-role-required]').forEach(el => {
  if (!el.dataset.roleRequired.includes(userRole)) el.style.display = 'none';
});
```

### Logout (top-right profile menu → "Sign Out")
1. Call `supabase.auth.signOut()`
2. Clear localStorage
3. Redirect to `login.html`

---

## SECTION 6: NAVIGATION & ROUTING

### Bottom Navigation Bar (all 5 icons)
Each nav item must navigate to its corresponding page AND set itself as active:

| Icon | Label | Navigates To | Active State |
|---|---|---|---|
| `local_shipping` | Collect | `collection.html` | Primary color fill + label |
| `inventory_2` | Stock | `inventory.html` | Primary color fill + label |
| `factory` | Process | `production.html` | Primary color fill + label |
| `payments` | Sales | `sales.html` | Primary color fill + label |
| `more_horiz` | More | Opens nav drawer (existing JS) | Secondary container bg |

**Active state logic:** On page load, read `window.location.pathname`, find the matching nav item, apply `text-primary` and wrap label in `bg-primary-container rounded-full px-3 py-1`.

### Navigation Drawer (slide-out from "More")
Each drawer item must navigate:
- `recycling` Waste Collection → `collection.html`
- `warehouse` Inventory → `inventory.html`
- `groups` HR & Personnel → `hr.html`
- `account_balance` Finance → `finance.html`
- Add: `dashboard` Dashboard → `dashboard.html`
- Add: `factory` Production → `production.html`
- Add: `bar_chart` Reports → `reports.html`
- Add: `settings` Settings → `settings.html`

### Page Header Back Button (where present)
All `arrow_back` icons → `history.back()` or navigate to parent page.

---

## SECTION 7: WASTE COLLECTION MODULE — COMPLETE BUTTON & LOGIC MAP

### Collection Dashboard (top of `collection.html`)

**"+ New Collection" FAB (green circle bottom-right):**
→ Open `new-collection-modal` overlay with fields:
- School (searchable dropdown, loads from `schools` table)
- Collection Date (date picker, defaults to today)
- Waste Type (dropdown: Plastic Bottles / HDPE / LDPE / Mixed)
- Collector (auto-filled from logged-in user, editable by managers)
- Notes (textarea)
- "Schedule" button → INSERT into `collections` with status `scheduled`, show success toast "Collection scheduled"
- "Start Now" button → INSERT with status `in_transit`, redirect to active collection view

**KPI Cards (4 across top):**
- "Today's Pickups": `SELECT count(*) FROM collections WHERE collection_date = TODAY AND status != 'cancelled'`
- "Total Weight This Week": `SELECT SUM(weight_kg) FROM collections WHERE collection_date >= date_trunc('week', NOW())`
- "Active Schools": `SELECT count(*) FROM schools WHERE active = true`
- "Pending Weigh-ins": `SELECT count(*) FROM collections WHERE status = 'in_transit'`
All refresh every 60 seconds via `setInterval`.

**Collection Schedule Table:**
- Each row is clickable → opens Collection Detail drawer on the right (slide-in panel)
- "View Route" button on each row → opens Google Maps link: `https://www.google.com/maps/dir/?api=1&destination=${school.address}`
- Status badge (Scheduled/In Transit/Weighed/Received/Cancelled): clicking opens status-update dropdown inline
- "Mark Received" button → UPDATE `collections` SET status = 'received', also INSERT weight_kg into `raw_materials` table (add to stock)

**Collection Detail Drawer (right panel):**
- "Edit" button → makes all fields editable inline, shows "Save Changes" and "Cancel" buttons
- "Save Changes" → UPDATE record, close edit mode, show toast "Saved"
- "Upload Weigh Slip" → triggers file picker, uploads to Supabase Storage bucket `weigh-slips`, saves URL to `collections.weigh_slip_url`
- "Mark Complete" → UPDATE status to `received`, show confirmation modal "This will add [X] kg to raw materials inventory. Confirm?"
  - On confirm: UPDATE `raw_materials` quantity, INSERT notification for inventory manager
- "Cancel Collection" → UPDATE status to `cancelled`, ask reason via inline dropdown
- "Delete" (admin only) → show confirm modal, DELETE record

**School Participation Panel:**
- "Add School" button → open modal with school name, zone, contact fields → INSERT into `schools`
- Each school row: click → navigate to `school-profile.html?id={school_id}`
- Participation score auto-calculated as: (collections completed in last 30 days / scheduled) × 100

**Weigh-In Log:**
- "Record Weight" button → open modal with collection picker, weight field, photo upload
- On submit: UPDATE `collections.weight_kg`, UPDATE status to `weighed`

---

## SECTION 8: INVENTORY MODULE

### Raw Materials Tab

**"Add Stock" button (top right):**
→ Modal: select material, enter quantity (kg), unit cost, supplier, date
→ INSERT into `raw_materials`, UPDATE quantity

**Each material row:**
- Progress bar shows: `current_qty / (reorder_threshold * 3)` as percentage
- Red badge if `quantity_kg < reorder_threshold_kg`
- "Reorder" button → opens supplier contact or creates a task assigned to procurement manager
- Click row → side panel with full stock history (all INSERTs and consumption from batches)

**Low Stock Alerts (auto-trigger via Edge Function):**
Set up Supabase Edge Function `check-low-stock` on a cron schedule (daily at 7am EAT):
```typescript
// runs daily, sends notification to inventory managers
const lowStock = await supabase
  .from('raw_materials')
  .select('*')
  .lt('quantity_kg', 'reorder_threshold_kg');
// for each: INSERT into notifications table + send SMS via Africa's Talking
```

### Finished Products Tab

**"Add Product" button:**
→ Modal: product name, SKU, unit price, low stock threshold → INSERT into `finished_products`

**Stock In / Stock Out buttons per product:**
- Stock In: manual entry (from production batch) → UPDATE quantity, log in `batch_id` link
- Stock Out: linked to order dispatch → triggered automatically when order status → `dispatched`

**Batch Tracker Tab:**
- Each batch row: click → `batch-detail.html?id={batch_id}`
- Status chips are clickable: `planned → in_progress → qc_check → completed`
- Each status change → UPDATE `batches.status`, INSERT notification to supervisor

---

## SECTION 9: PRODUCTION MODULE

### Production Dashboard

**"New Batch" FAB:**
→ Modal fields:
- Product to produce (dropdown from `finished_products`)
- Raw material to use (dropdown from `raw_materials`, shows available qty)
- Planned quantity (units)
- Raw material required (auto-calculated: units × product formula)
- Supervisor (dropdown from staff with production role)
- Planned start date
→ On "Create Batch": INSERT into `batches`, DEDUCT raw material qty (if status goes to `in_progress`), generate batch code `BATCH-YYYYMMDD-XXXX`

**Production Schedule (calendar / list view toggle):**
- "List View" / "Calendar View" toggle buttons → switch between table and 7-day calendar display
- Each batch card: drag-and-drop to reschedule date → UPDATE `batches.started_at`
- "Start" button → UPDATE status to `in_progress`, record `started_at = NOW()`
- "Pause" button → UPDATE status to `planned`, log pause event
- "Send to QC" button → UPDATE status to `qc_check`, INSERT notification to QC officer

**QC Checks Panel:**
- "Pass QC" button → UPDATE `batches.status = 'completed'`, `qc_passed = true`, UPDATE `finished_products.quantity += units_produced`
- "Fail QC" button → modal asking reason → UPDATE status to `rejected`, INSERT incident report task

**Machinery Maintenance:**
- "Log Maintenance" button → modal: machine name, type, date, technician, cost → INSERT into `maintenance_logs`
- Overdue items (scheduled_date < today AND status != 'completed') highlighted in red
- "Mark Complete" button on each item → UPDATE `maintenance_logs.status = 'completed'`, record completed_date

**Productivity Metrics Panel:**
Auto-calculated on page load:
- Units produced per day: `SUM(units_produced) GROUP BY DATE`
- Raw material yield: `(units_produced × weight_per_unit) / raw_material_used_kg × 100`%
- Batch rejection rate: `rejected_batches / total_batches × 100`%
Display as Chart.js bar/line charts.

---

## SECTION 10: SALES & DISTRIBUTION MODULE

### Customer Database

**"Add Customer" button:**
→ Modal: name, type (Distributor/Retailer/Direct), contact, phone, email, address, credit limit
→ INSERT into `customers`

**Each customer row click:**
→ Navigate to `customer-profile.html?id={customer_id}` showing: order history, invoices, payments, outstanding balance, communication log

**Outstanding Balance badge** (shown per customer):
Auto-calculated: `SUM(invoices.amount) - SUM(payments.amount) WHERE customer_id = X`

### Order Management

**"New Order" button:**
→ Multi-step modal:
1. Select customer (searchable dropdown)
2. Add line items: product picker + quantity + auto-populated unit price (editable)
   - Running total auto-updates
   - "Add Another Item" link adds new row
3. Delivery date picker
4. Notes
→ On "Confirm Order": INSERT into `orders` (auto-generate `order_number = ORD-YYYYMMDD-XXX`), INSERT `order_items`, UPDATE status to `confirmed`

**Order Status Flow (clickable chips per order row):**
`Draft → Confirmed → Dispatched → Delivered → Invoiced → Paid / Overdue`

- `Confirmed → Dispatched`: Modal asks "Confirm dispatch? This will deduct stock." → UPDATE `orders.status`, DEDUCT from `finished_products.quantity` for each order item
- `Dispatched → Delivered`: UPDATE status, record delivery timestamp
- `Delivered → Invoiced`: Auto-generate invoice → INSERT into `invoices` with `due_date = delivery_date + 30 days`, generate PDF via jsPDF, store in Supabase Storage
- If payment not received by due_date: Edge Function auto-flips status to `overdue`, sends SMS to customer and sales manager

**"Generate Invoice" button (per order):**
1. Pull order + customer + line items from Supabase
2. Generate PDF using jsPDF with Eden Recyclers letterhead, logo, line items table, total, bank details
3. Upload to Supabase Storage `invoices/` bucket
4. UPDATE `invoices.pdf_url`
5. Open PDF in new tab + show "Download" button

**"Record Payment" button (per invoice):**
→ Modal: amount, date, method (M-Pesa / Bank / Cash / Cheque), reference number
→ INSERT into `payments`
→ UPDATE `invoices.paid_amount`, recalculate status (`partial` if paid < total, `paid` if paid >= total)
→ UPDATE `customers.outstanding_balance`
→ If fully paid: UPDATE `orders.status = 'paid'`

**Debt Management Panel:**
- Filters: All / Overdue / 0-30 days / 31-60 days / 60+ days
- "Send Reminder" button per customer → triggers SMS via Africa's Talking + logs in notifications
- "Mark as Disputed" button → creates task for finance manager

---

## SECTION 11: HR MODULE

### Staff Directory

**"Add Staff" button:**
→ Multi-step onboarding modal:
1. Personal info: name, phone, ID number, position, department, employment type
2. Contract details: start date, salary, manager
3. Creates Supabase Auth account for staff: `supabase.auth.admin.createUser({ email, password: tempPassword })`
4. INSERT into `profiles` + `staff`
5. Set `onboarding_stage = 1`, `onboarding_complete = false`
6. SMS temp password to staff member via Africa's Talking

**Onboarding Tracker (per staff card):**
- Stage progress bar: 4 stages (Documents → Orientation → Safety → Final Sign-off)
- "Advance Stage" button (manager only) → UPDATE `staff.onboarding_stage += 1`
- At stage 4: show "Mark Complete" button → UPDATE `onboarding_complete = true`

**"View Profile" per staff:**
→ Navigate to `staff-profile.html?id={staff_id}` showing attendance history, tasks assigned, performance notes, salary, onboarding status

### Attendance System

**"Mark Attendance" button (daily, top of page):**
→ Opens attendance entry grid: list all active staff for today, each with Present / Absent / Late / Half-Day / Leave radio buttons
→ "Submit All" → bulk INSERT into `attendance` table for today's date

**Individual check-in/out:**
- Staff member logs in → button "Check In" → INSERT attendance record with `check_in = NOW()`
- "Check Out" button → UPDATE `check_out = NOW()`, calculate hours worked

**Attendance Report button:**
→ Generates monthly summary table: staff name, days present, late days, absent days, leave days
→ Export to CSV via: `const csv = rows.map(r => Object.values(r).join(',')).join('\n'); downloadCSV(csv)`

### Shift Scheduler

**"Schedule Shift" button:**
→ Modal: shift (Morning/Afternoon/Night), date, staff selection (multi-select), notes
→ INSERT shift records

**"View Calendar" button:**
→ Navigate to `shift-calendar.html` showing weekly grid of all shifts

---

## SECTION 12: FINANCE MODULE

### Finance Dashboard KPIs (auto-calculated on load)

```javascript
// Total Revenue (current month)
const { data: revenue } = await supabase
  .from('payments')
  .select('amount')
  .gte('payment_date', startOfMonth);
  
// Outstanding Receivables
const { data: receivables } = await supabase
  .from('invoices')
  .select('amount, paid_amount')
  .in('status', ['sent','partial','overdue']);
  
// Overdue invoices count
const { data: overdue } = await supabase
  .from('invoices')
  .select('id')
  .eq('status','overdue');
```

### Invoice Management

**"Create Invoice" button:**
→ Same flow as triggered from order (see Sales section)
→ Also allows standalone invoice creation (not tied to an order)

**Invoice list filters:** All / Draft / Sent / Partial / Paid / Overdue (filter chips update query)

**"Export to PDF" per invoice:**
→ jsPDF generation with full Eden Recyclers branding

**"Send Invoice" button:**
→ Marks invoice status as `sent`, records sent timestamp
→ (Future: email integration via Resend API)

### Payment Recording
(Same as Sales module "Record Payment" — same function, different navigation path)

### Reports Panel

**"Generate Monthly Report" button:**
→ Pulls data from multiple tables, compiles into structured PDF:
- Collections summary (kg collected per week, per school)
- Production summary (batches, units, yield %)
- Sales summary (revenue, top customers, product breakdown)
- Outstanding receivables list
- HR summary (headcount, attendance %)
→ Download as PDF

**"Export Data" buttons (per section):**
→ CSV export using native JS (no library needed)

---

## SECTION 13: DASHBOARD (`dashboard.html`)

### KPI Cards (real-time, refresh every 60 seconds)
1. **Waste Collected This Month** (kg) — query `collections`
2. **Production Units This Month** — query `batches`
3. **Revenue This Month** (KES) — query `payments`
4. **Outstanding Receivables** (KES) — query `invoices`
5. **Active Schools** — query `schools`
6. **Staff Present Today** — query `attendance`

### Charts (Chart.js)
- **Line chart** "Monthly Waste Collection (12 months)" → `GROUP BY month` on `collections`
- **Bar chart** "Production by Product" → `GROUP BY product_id` on `batches`
- **Doughnut** "Revenue by Customer Type" → join `payments → invoices → orders → customers`

### Recent Activity Feed (real-time via Supabase Realtime)
```javascript
const channel = supabase
  .channel('activity-feed')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collections' }, handleNewCollection)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'batches' }, handleBatchUpdate)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, handleNewPayment)
  .subscribe();
```
Each new event → prepend a row to the activity feed table (most recent at top, max 20 rows shown).

### Notification Bell
- On page load: query `notifications WHERE user_id = auth.uid() AND read = false`
- Show count badge on bell icon
- Click bell → dropdown list of unread notifications
- Click notification → navigate to relevant page, mark as `read = true`
- Real-time subscription: any new INSERT into `notifications` for this user → increment badge count without page reload

---

## SECTION 14: AUTOMATED EDGE FUNCTIONS (Supabase Edge Functions)

Instruct Antigravity to create these 5 Edge Functions in Supabase:

### 1. `daily-low-stock-alert` (Cron: every day at 7:00 AM EAT)
- Query raw_materials where qty < reorder_threshold
- Query finished_products where qty < low_stock_threshold
- For each: INSERT notification for all managers + admins
- Send SMS via Africa's Talking to inventory manager's phone

### 2. `overdue-invoice-checker` (Cron: every day at 8:00 AM EAT)
- Query invoices where `due_date < today AND status IN ('sent','partial')`
- UPDATE status to `overdue`
- INSERT notification for sales manager + finance manager
- Send SMS to customer (template: "Dear {name}, Invoice {number} of KES {amount} is overdue. Please contact Eden Recyclers.")

### 3. `weekly-report-trigger` (Cron: every Monday at 6:00 AM EAT)
- Aggregate prior week's collections, production, sales, attendance
- INSERT a summary record into a `weekly_reports` table
- INSERT notification for all managers: "Weekly report for [week] is ready"

### 4. `collection-reminder` (Cron: every day at 6:00 AM EAT)
- Query collections scheduled for today
- For each: send SMS to assigned collector: "Reminder: Collection at {school_name} scheduled today. Route: {address}"

### 5. `batch-qc-reminder` (Cron: every day at 9:00 AM EAT)
- Query batches where status = 'qc_check' AND updated_at < NOW() - interval '24 hours'
- INSERT notification for production manager: "Batch {code} has been awaiting QC for over 24 hours"

---

## SECTION 15: REUSABLE UI COMPONENTS TO BUILD

### Toast Notification (`utils.js`)
```javascript
function showToast(message, type = 'success') {
  // type: 'success' | 'error' | 'warning' | 'info'
  const toast = document.createElement('div');
  toast.className = `fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] 
    px-lg py-sm rounded-full shadow-lg font-label-md text-label-md
    flex items-center gap-xs transition-all
    ${type === 'success' ? 'bg-primary text-on-primary' : ''}
    ${type === 'error' ? 'bg-error text-on-error' : ''}
    ${type === 'warning' ? 'bg-secondary-container text-on-secondary-container' : ''}`;
  toast.innerHTML = `<span class="material-symbols-outlined text-sm">
    ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'warning'}
  </span> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
```

### Confirm Modal (`utils.js`)
```javascript
function showConfirmModal(title, message, onConfirm) {
  // Creates overlay modal with title, message, Cancel + Confirm buttons
  // Cancel → closes modal; Confirm → calls onConfirm() then closes
}
```

### Loading Skeleton
All data-loading sections: initially show skeleton `div` elements with `animate-pulse bg-surface-container-high rounded`, then replace with real data on load completion.

### Empty State
When a query returns 0 results: show centered illustration + message + primary action button.
Example: "No collections today. Tap + to schedule one."

---

## SECTION 16: GLOBAL SEARCH

**Search bar in header (existing UI):**
On input (debounced 300ms) → query multiple tables in parallel:
```javascript
const [schools, customers, batches, staff] = await Promise.all([
  supabase.from('schools').select('id,name').ilike('name', `%${query}%`).limit(3),
  supabase.from('customers').select('id,name').ilike('name', `%${query}%`).limit(3),
  supabase.from('batches').select('id,batch_code').ilike('batch_code', `%${query}%`).limit(3),
  supabase.from('staff').select('id,profile_id').limit(3)
]);
```
Show dropdown results grouped by type. Click result → navigate to respective profile/detail page.

---

## SECTION 17: OFFLINE & MOBILE CONSIDERATIONS

Since field collectors may be in areas with poor connectivity:

1. **Service Worker** (`sw.js`): Cache all HTML, CSS, JS files for offline loading
2. **IndexedDB queue**: When offline, store form submissions in browser IndexedDB. On reconnect, replay queued inserts to Supabase.
3. **"Offline Mode" banner**: Yellow bar at top of page when `navigator.onLine === false`
4. **PWA Manifest** (`manifest.json`): Allow "Add to Home Screen" on Android/iOS:
```json
{
  "name": "Eden Recyclers BOS",
  "short_name": "Eden BOS",
  "start_url": "/dashboard.html",
  "display": "standalone",
  "background_color": "#f7fafc",
  "theme_color": "#006c03",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
```

---

## SECTION 18: HOW TO PASTE THIS INTO ANTIGRAVITY

Use the following sequence of prompts in Antigravity — one phase at a time:

**Phase 1 — Database:**
> "Create a new Supabase project for Eden Recyclers. Use the MCP server to create all tables from the schema in the attached file. Enable RLS on all tables and add the security policies specified."

**Phase 2 — Auth:**
> "Create a login.html page matching Eden Recyclers' existing design system (Tailwind + Material Symbols + Inter font, color tokens: primary #006c03, surface #f7fafc). Add full Supabase Auth integration with role-based redirects as documented. Add a session guard script to all existing HTML pages."

**Phase 3 — Navigation:**
> "Wire all bottom navigation bar icons and drawer items to their correct pages. Add active state detection on page load. Create the router.js and state.js utility files."

**Phase 4 — Module by module (one at a time):**
> "Implement full logic for the Waste Collection module: wire every button in collection.html to Supabase queries as documented. Create collection.js in the /js/modules/ folder. Add the real-time subscription for live status updates."

> "Implement full logic for the Inventory module..." (repeat per module)

**Phase 5 — Automation:**
> "Create the 5 Supabase Edge Functions for automated alerts, overdue invoice checking, and daily reminders. Set up cron schedules for each."

**Phase 6 — Dashboard:**
> "Build dashboard.html with real-time KPI cards, Chart.js charts, and the live activity feed using Supabase Realtime WebSockets."

**Phase 7 — PWA:**
> "Add a service worker, web app manifest, and IndexedDB offline queue to the project. Show an offline banner when connectivity is lost."

---

## SECTION 19: AFRICA'S TALKING SMS INTEGRATION

```javascript
// In Supabase Edge Function (Deno):
const response = await fetch('https://api.africastalking.com/version1/messaging', {
  method: 'POST',
  headers: {
    'apiKey': Deno.env.get('AT_API_KEY'),
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    username: 'eden_recyclers',
    to: phoneNumber,     // format: +254XXXXXXXXX
    message: messageText,
    from: 'EDEN'         // registered sender ID
  })
});
```

SMS triggers:
- Collection reminder: daily at 6am to collector
- Overdue invoice: immediately on status flip + daily reminder until paid
- Low stock alert: daily at 7am to inventory manager
- New task assigned: immediately to assignee
- Onboarding stage advanced: to new staff member

---

## SECTION 20: ENVIRONMENT VARIABLES

Store in Supabase Edge Function secrets AND as `window.ENV` in a `config.js` loaded before all other scripts:

```javascript
// config.js (loaded first on every page)
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key';
// Never store service_role key in client-side JS
```

For Edge Functions:
```
SUPABASE_SERVICE_ROLE_KEY=...
AT_API_KEY=...          // Africa's Talking
AT_USERNAME=eden_recyclers
```

---

*End of Eden Recyclers Antigravity Implementation Prompt — Version 1.0*
*Stack: Vanilla HTML + Tailwind CSS + Vanilla JS + Supabase (PostgreSQL) + Africa's Talking SMS*
*Total tables: 18 | Modules: 8 | Edge Functions: 5 | Estimated build time in Antigravity: 3–5 days*
