-- ============================================================================
-- Eden Recyclers Business Operations System (BOS) Database Schema
-- Target Database: Supabase PostgreSQL
-- ============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. TABLES DEFINITIONS
-- ============================================================================

-- USERS & AUTH (Profiles linked to auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('admin','manager','collector','collection','production','sales','hr','finance','inventory','procurement','operations')),
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);

-- SCHOOLS
create table if not exists schools (
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
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete set null,
  collector_id uuid references profiles(id) on delete set null,
  collection_date date not null,
  weight_kg numeric(10,2),
  waste_type text check (waste_type in ('plastic_bottles','hdpe','ldpe','mixed_plastic')),
  status text check (status in ('scheduled','in_transit','weighed','received','cancelled')) default 'scheduled',
  weigh_slip_url text,
  notes text,
  created_at timestamptz default now()
);

-- SUPPLIERS
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_phone text,
  email text,
  supplies text,
  material_type text,
  rating numeric(3,2),
  status text default 'active' check (status in ('active','inactive','on_hold')),
  active boolean default true,
  created_at timestamptz default now()
);

-- INVENTORY — RAW MATERIALS
create table if not exists raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  quantity_kg numeric(10,2) default 0,
  unit_cost numeric(10,2),
  reorder_threshold_kg numeric(10,2) default 50,
  reorder_quantity_kg numeric(10,2) default 100,
  supplier_id uuid references suppliers(id) on delete set null,
  preferred_supplier_id uuid references suppliers(id) on delete set null,
  last_updated timestamptz default now()
);

-- INVENTORY — FINISHED PRODUCTS
create table if not exists finished_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique not null,
  quantity integer default 0,
  quantity_kg numeric(12,2) default 0,
  unit_price numeric(10,2) not null,
  low_stock_threshold integer default 20,
  created_at timestamptz default now()
);

-- PRODUCTION BATCHES
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text unique not null,
  product_id uuid references finished_products(id) on delete restrict,
  raw_material_id uuid references raw_materials(id) on delete restrict,
  raw_material_used_kg numeric(10,2),
  units_produced integer,
  status text check (status in ('materials_requested','materials_approved','materials_issued','in_progress','qc_pending','qc_passed','qc_failed','completed','rejected')) default 'materials_requested',
  quality_grade text,
  materials_requested_at timestamptz,
  materials_approved_at timestamptz,
  materials_issued_at timestamptz,
  qc_completed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  supervisor_id uuid references profiles(id) on delete set null,
  qc_passed boolean,
  notes text,
  created_at timestamptz default now()
);

-- MACHINERY MAINTENANCE
create table if not exists maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  machine_name text not null,
  maintenance_type text check (maintenance_type in ('preventive','corrective','emergency')),
  scheduled_date date,
  completed_date date,
  technician_id uuid references profiles(id) on delete set null,
  status text check (status in ('scheduled','in_progress','completed','overdue')) default 'scheduled',
  notes text,
  cost numeric(10,2),
  created_at timestamptz default now()
);

-- CUSTOMERS
create table if not exists customers (
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
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid references customers(id) on delete restrict,
  salesperson_id uuid references profiles(id) on delete set null,
  order_date date not null,
  delivery_date date,
  status text check (status in ('draft','confirmed','dispatched','delivered','invoiced','paid','overdue')) default 'draft',
  total_amount numeric(12,2),
  paid_amount numeric(12,2) default 0,
  idempotency_key text,
  notes text,
  created_at timestamptz default now()
);

-- ORDER LINE ITEMS
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references finished_products(id) on delete restrict,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  line_total numeric(12,2) generated always as (quantity * unit_price) stored
);

-- INVOICES
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  order_id uuid references orders(id) on delete set null,
  customer_id uuid references customers(id) on delete restrict,
  issued_date date not null,
  due_date date not null,
  amount numeric(12,2) not null,
  paid_amount numeric(12,2) default 0,
  status text check (status in ('draft','sent','partial','paid','overdue')) default 'draft',
  pdf_url text,
  created_at timestamptz default now()
);

-- PAYMENTS
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null,
  method text check (method in ('mpesa','bank_transfer','cash','cheque')),
  reference_number text,
  recorded_by uuid references profiles(id) on delete set null,
  idempotency_key text,
  created_at timestamptz default now()
);

-- HR — STAFF
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  employee_number text unique not null,
  department text,
  position text,
  employment_type text check (employment_type in ('full_time','part_time','casual','contractor')),
  start_date date,
  salary numeric(10,2),
  manager_id uuid references staff(id) on delete set null,
  onboarding_stage integer default 1,
  onboarding_complete boolean default false,
  active boolean default true
);

-- ATTENDANCE
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text check (status in ('present','absent','late','half_day','leave')) default 'present',
  shift text check (shift in ('morning','afternoon','night')),
  notes text
);

-- TASKS
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  assigned_by uuid references profiles(id) on delete set null,
  module text check (module in ('collection','inventory','production','sales','hr','finance')),
  priority text check (priority in ('low','medium','high','urgent')) default 'medium',
  status text check (status in ('pending','in_progress','completed','cancelled')) default 'pending',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  body text,
  type text check (type in ('alert','info','success','warning')),
  module text,
  read boolean default false,
  created_at timestamptz default now()
);

-- IMMUTABLE AUDIT LEDGER
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  table_name text not null,
  row_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz default now()
);

-- INVENTORY MOVEMENT LEDGER
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references raw_materials(id) on delete set null,
  finished_product_id uuid references finished_products(id) on delete set null,
  source_type text not null,
  source_id text not null,
  quantity_kg numeric(10,2) not null,
  movement_type text not null check (movement_type in ('raw_receipt','raw_issue','finished_receipt','finished_dispatch','adjustment')),
  resulting_balance numeric(12,2),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique (source_type, source_id, movement_type)
);

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into audit_logs(actor_id, table_name, row_id, operation, before_data, after_data)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table schools enable row level security;
alter table collections enable row level security;
alter table suppliers enable row level security;
alter table raw_materials enable row level security;
alter table finished_products enable row level security;
alter table batches enable row level security;
alter table maintenance_logs enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table staff enable row level security;
alter table attendance enable row level security;
alter table tasks enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table stock_movements enable row level security;

-- PROFILES Policies
create policy "Public profiles are readable by everyone authenticated" on profiles
  for select using (
    id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager', 'hr', 'operations'))
  );

create policy "Users can update their own profiles" on profiles
  for update using (auth.uid() = id);

create policy "Admins and managers can do all on profiles" on profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

-- COLLECTIONS Policies
create policy "Managers see all collections" on collections
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
  );

create policy "Collectors see own collections" on collections
  for select using (collector_id = auth.uid());

create policy "Collectors can update their assigned collections" on collections
  for update using (collector_id = auth.uid());

-- ATTENDANCE Policies
create policy "Managers see all attendance" on attendance
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'hr'))
  );

create policy "Staff see own attendance" on attendance
  for select using (
    staff_id = (select id from staff where profile_id = auth.uid())
  );

create policy "Staff can record check_in/check_out" on attendance
  for insert with check (
    staff_id = (select id from staff where profile_id = auth.uid())
  );

-- Explicit role policies. Avoid broad authenticated-user access on business data.
create policy "Auth users read schools" on schools for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'collection', 'collector', 'operations')));
create policy "Managers write schools" on schools for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));

create policy "Auth users read suppliers" on suppliers for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'inventory', 'procurement', 'production', 'operations')));
create policy "Managers write suppliers" on suppliers for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));

create policy "Auth users read raw_materials" on raw_materials for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'inventory', 'procurement', 'production', 'finance', 'operations')));
create policy "Managers write raw_materials" on raw_materials for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'production')));

create policy "Auth users read finished_products" on finished_products for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'inventory', 'production', 'sales', 'finance', 'operations')));
create policy "Managers write finished_products" on finished_products for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'production', 'sales')));

create policy "Auth users read batches" on batches for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'production', 'inventory', 'sales', 'finance', 'operations')));
create policy "Production supervisors write batches" on batches for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'production')));

create policy "Auth users read maintenance_logs" on maintenance_logs for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'production', 'hr', 'operations')));
create policy "Production supervisors write maintenance_logs" on maintenance_logs for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'production')));

create policy "Auth users read customers" on customers for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'sales', 'finance', 'operations')));
create policy "Sales/Managers write customers" on customers for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'sales')));

create policy "Auth users read orders" on orders for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'sales', 'finance', 'inventory', 'production', 'operations')));
create policy "Sales/Managers write orders" on orders for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'sales')));

create policy "Auth users read order_items" on order_items for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'sales', 'finance', 'inventory', 'production', 'operations')));
create policy "Sales/Managers write order_items" on order_items for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'sales')));

create policy "Auth users read invoices" on invoices for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'finance', 'sales', 'operations')));
create policy "Finance/Managers write invoices" on invoices for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'finance', 'sales')));

create policy "Auth users read payments" on payments for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'finance', 'operations')));
create policy "Finance/Managers write payments" on payments for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'finance', 'sales')));

create policy "Auth users read staff" on staff for select using (
  profile_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'hr', 'finance', 'operations'))
);
create policy "HR/Managers write staff" on staff for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'hr')));

create policy "Users see own tasks" on tasks for select using (assigned_to = auth.uid() or assigned_by = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));
create policy "Users write tasks" on tasks for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')) or assigned_to = auth.uid());

create policy "Users see own notifications" on notifications for select using (user_id = auth.uid());
create policy "System can write notifications" on notifications for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'operations'))
);
create policy "Users can update own notifications" on notifications for update using (user_id = auth.uid());

-- Restrict profile self-service updates to non-privileged columns. Role changes
-- must be made by a trusted server-side function or service-role migration.
revoke update on profiles from authenticated;
grant update (full_name, phone, avatar_url) on profiles to authenticated;

create policy "Managers read audit logs" on audit_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager'))
);
create policy "Auth users read stock movements" on stock_movements for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'inventory', 'production', 'sales', 'finance', 'operations'))
);
create policy "Operations roles write stock movements" on stock_movements for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager', 'production', 'finance'))
);

drop trigger if exists audit_profiles on profiles;
create trigger audit_profiles after insert or update or delete on profiles for each row execute function audit_row_change();
drop trigger if exists audit_invoices on invoices;
create trigger audit_invoices after insert or update or delete on invoices for each row execute function audit_row_change();
drop trigger if exists audit_payments on payments;
create trigger audit_payments after insert or update or delete on payments for each row execute function audit_row_change();
drop trigger if exists audit_raw_materials on raw_materials;
create trigger audit_raw_materials after insert or update or delete on raw_materials for each row execute function audit_row_change();
drop trigger if exists audit_finished_products on finished_products;
create trigger audit_finished_products after insert or update or delete on finished_products for each row execute function audit_row_change();
drop trigger if exists audit_batches on batches;
create trigger audit_batches after insert or update or delete on batches for each row execute function audit_row_change();
drop trigger if exists audit_collections on collections;
create trigger audit_collections after insert or update or delete on collections for each row execute function audit_row_change();
