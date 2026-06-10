-- Eden Recyclers BOS backend enforcement migration
-- Purpose: move critical business rules from frontend code into transactional
-- Supabase/PostgreSQL functions, role-specific RLS, immutable ledgers, and
-- idempotent workflow transitions.

begin;

-- ---------------------------------------------------------------------------
-- Roles and helper functions
-- ---------------------------------------------------------------------------

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (
  role in (
    'admin',
    'manager',
    'finance',
    'sales',
    'production',
    'inventory',
    'collector',
    'collection',
    'hr',
    'procurement',
    'operations'
  )
);

create or replace function current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and role = any(allowed_roles)
  )
$$;

create or replace function require_role(allowed_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_role(allowed_roles) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ledger and schema hardening
-- ---------------------------------------------------------------------------

alter table finished_products add column if not exists quantity_kg numeric(12,2);
update finished_products set quantity_kg = quantity where quantity_kg is null;
alter table finished_products alter column quantity_kg set default 0;

alter table stock_movements add column if not exists resulting_balance numeric(12,2);
alter table stock_movements add column if not exists source_module text;
alter table stock_movements add column if not exists notes text;
alter table stock_movements drop constraint if exists stock_movements_source_type_source_id_movement_type_key;
create unique index if not exists stock_movements_idempotency_idx
  on stock_movements(source_type, source_id, movement_type);

alter table payments add column if not exists reversed_payment_id uuid references payments(id) on delete restrict;
alter table payments add column if not exists reversal_reason text;
alter table payments add column if not exists created_by uuid references profiles(id) on delete set null;
alter table payments add column if not exists idempotency_key text;
create unique index if not exists payments_idempotency_key_idx
  on payments(idempotency_key)
  where idempotency_key is not null;

alter table batches drop constraint if exists batches_status_check;
alter table batches add constraint batches_status_check check (
  status in (
    'materials_requested',
    'materials_approved',
    'materials_issued',
    'in_progress',
    'qc_pending',
    'qc_passed',
    'qc_failed',
    'completed',
    'rejected'
  )
);
alter table batches alter column status set default 'materials_requested';
alter table batches add column if not exists materials_requested_at timestamptz;
alter table batches add column if not exists materials_approved_at timestamptz;
alter table batches add column if not exists materials_issued_at timestamptz;
alter table batches add column if not exists qc_checked_at timestamptz;
alter table batches add column if not exists finished_stock_credited_at timestamptz;
alter table batches add column if not exists rejected_at timestamptz;
alter table batches add column if not exists quality_grade text;

alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key_idx
  on orders(idempotency_key)
  where idempotency_key is not null;

create table if not exists production_state_transitions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references profiles(id) on delete set null,
  idempotency_key text not null,
  notes text,
  created_at timestamptz default now(),
  unique(batch_id, idempotency_key)
);

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete restrict,
  driver_name text,
  truck_plate text,
  dispatch_time timestamptz,
  delivery_time timestamptz,
  status text check (status in ('planned','in_transit','delivered','cancelled')) default 'planned',
  idempotency_key text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create unique index if not exists deliveries_idempotency_key_idx
  on deliveries(idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists audit_stock_movements on stock_movements;
create trigger audit_stock_movements after insert or update or delete on stock_movements
  for each row execute function audit_row_change();
drop trigger if exists audit_deliveries on deliveries;
create trigger audit_deliveries after insert or update or delete on deliveries
  for each row execute function audit_row_change();
drop trigger if exists audit_production_state_transitions on production_state_transitions;
create trigger audit_production_state_transitions after insert or update or delete on production_state_transitions
  for each row execute function audit_row_change();

-- Payments are immutable. Corrections must be reversal payments.
create or replace function prevent_payment_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'payments_are_immutable_use_reversal';
end;
$$;

drop trigger if exists prevent_payment_update on payments;
create trigger prevent_payment_update before update on payments
  for each row execute function prevent_payment_mutation();
drop trigger if exists prevent_payment_delete on payments;
create trigger prevent_payment_delete before delete on payments
  for each row execute function prevent_payment_mutation();

-- ---------------------------------------------------------------------------
-- Inventory ledger RPC
-- ---------------------------------------------------------------------------

create or replace function post_stock_movement(
  p_movement_type text,
  p_quantity_kg numeric,
  p_source_module text,
  p_source_type text,
  p_source_id text,
  p_material_id uuid default null,
  p_finished_product_id uuid default null,
  p_notes text default null
)
returns stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  existing stock_movements;
  movement stock_movements;
  new_balance numeric(12,2);
begin
  perform require_role(array['admin','manager','inventory','production','collection','collector','sales','finance','operations']);

  if p_quantity_kg = 0 then
    raise exception 'quantity_must_not_be_zero';
  end if;

  select * into existing
  from stock_movements
  where source_type = p_source_type
    and source_id = p_source_id
    and movement_type = p_movement_type;
  if found then
    return existing;
  end if;

  if p_material_id is not null then
    update raw_materials
    set quantity_kg = quantity_kg + p_quantity_kg,
        last_updated = now()
    where id = p_material_id
    returning quantity_kg into new_balance;
  elsif p_finished_product_id is not null then
    update finished_products
    set quantity_kg = quantity_kg + p_quantity_kg,
        quantity = greatest(0, round(quantity_kg + p_quantity_kg)::integer)
    where id = p_finished_product_id
    returning quantity_kg into new_balance;
  else
    raise exception 'material_or_finished_product_required';
  end if;

  if new_balance is null then
    raise exception 'stock_item_not_found';
  end if;

  if new_balance < 0 then
    raise exception 'insufficient_stock';
  end if;

  insert into stock_movements(
    material_id,
    finished_product_id,
    source_type,
    source_id,
    source_module,
    quantity_kg,
    movement_type,
    resulting_balance,
    created_by,
    notes
  )
  values (
    p_material_id,
    p_finished_product_id,
    p_source_type,
    p_source_id,
    p_source_module,
    p_quantity_kg,
    p_movement_type,
    new_balance,
    auth.uid(),
    p_notes
  )
  returning * into movement;

  return movement;
end;
$$;

-- ---------------------------------------------------------------------------
-- Collection receiving RPC
-- ---------------------------------------------------------------------------

create or replace function receive_collection(
  p_collection_id uuid,
  p_material_id uuid,
  p_weight_kg numeric
)
returns collections
language plpgsql
security definer
set search_path = public
as $$
declare
  collection_row collections;
begin
  perform require_role(array['admin','manager','collection','collector','inventory','operations']);

  select * into collection_row from collections where id = p_collection_id for update;
  if not found then
    raise exception 'collection_not_found';
  end if;

  if collection_row.status = 'received' then
    return collection_row;
  end if;

  perform post_stock_movement(
    'raw_receipt',
    coalesce(p_weight_kg, collection_row.weight_kg),
    'collection',
    'collection',
    p_collection_id::text,
    p_material_id,
    null,
    'Collection received'
  );

  update collections
  set status = 'received',
      weight_kg = coalesce(p_weight_kg, weight_kg)
  where id = p_collection_id
  returning * into collection_row;

  return collection_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Production lifecycle RPC
-- ---------------------------------------------------------------------------

create or replace function valid_production_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select
    (p_from is null and p_to = 'materials_requested')
    or (p_from = 'materials_requested' and p_to in ('materials_approved','rejected'))
    or (p_from = 'materials_approved' and p_to in ('materials_issued','rejected'))
    or (p_from = 'materials_issued' and p_to in ('in_progress','rejected'))
    or (p_from = 'in_progress' and p_to in ('qc_pending','rejected'))
    or (p_from = 'qc_pending' and p_to in ('qc_passed','qc_failed'))
    or (p_from = 'qc_passed' and p_to = 'completed')
    or (p_from = 'qc_failed' and p_to in ('rejected','in_progress'))
$$;

create or replace function transition_production_batch(
  p_batch_id uuid,
  p_to_status text,
  p_idempotency_key text,
  p_notes text default null,
  p_output_kg numeric default null
)
returns batches
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_row batches;
  existing production_state_transitions;
  old_status text;
begin
  perform require_role(array['admin','manager','production','inventory','operations']);

  select * into batch_row from batches where id = p_batch_id for update;
  if not found then
    raise exception 'batch_not_found';
  end if;

  select * into existing
  from production_state_transitions
  where batch_id = p_batch_id and idempotency_key = p_idempotency_key;
  if found then
    return batch_row;
  end if;

  old_status := batch_row.status;

  if not valid_production_transition(old_status, p_to_status) then
    raise exception 'invalid_production_transition: % -> %', batch_row.status, p_to_status;
  end if;

  if p_to_status = 'materials_issued' then
    perform post_stock_movement(
      'raw_issue',
      -coalesce(batch_row.raw_material_used_kg, 0),
      'production',
      'batch',
      p_batch_id::text,
      batch_row.raw_material_id,
      null,
      'Production materials issued'
    );
  end if;

  if p_to_status = 'completed' then
    perform post_stock_movement(
      'finished_receipt',
      coalesce(p_output_kg, batch_row.units_produced, 0),
      'production',
      'batch',
      p_batch_id::text,
      null,
      batch_row.product_id,
      'Production completed after QC pass'
    );
  end if;

  update batches
  set status = p_to_status,
      units_produced = coalesce(p_output_kg::integer, units_produced),
      materials_approved_at = case when p_to_status = 'materials_approved' then now() else materials_approved_at end,
      materials_issued_at = case when p_to_status = 'materials_issued' then now() else materials_issued_at end,
      started_at = case when p_to_status = 'in_progress' then now() else started_at end,
      qc_checked_at = case when p_to_status in ('qc_passed','qc_failed') then now() else qc_checked_at end,
      finished_stock_credited_at = case when p_to_status = 'completed' then now() else finished_stock_credited_at end,
      rejected_at = case when p_to_status in ('rejected') then now() else rejected_at end,
      completed_at = case when p_to_status = 'completed' then now() else completed_at end,
      qc_passed = case when p_to_status = 'qc_passed' then true when p_to_status = 'qc_failed' then false else qc_passed end,
      notes = coalesce(p_notes, notes)
  where id = p_batch_id
  returning * into batch_row;

  insert into production_state_transitions(batch_id, from_status, to_status, actor_id, idempotency_key, notes)
  values (p_batch_id, old_status, p_to_status, auth.uid(), p_idempotency_key, p_notes);

  return batch_row;
end;
$$;

create or replace function start_production_batch(
  p_product_id uuid,
  p_raw_material_id uuid,
  p_input_kg numeric,
  p_batch_code text default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns batches
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_row batches;
  existing_transition production_state_transitions;
begin
  perform require_role(array['admin','manager','production','operations']);

  if p_input_kg <= 0 then
    raise exception 'input_kg_must_be_positive';
  end if;

  if p_idempotency_key is not null then
    select pst.* into existing_transition
    from production_state_transitions pst
    where pst.idempotency_key = p_idempotency_key
    limit 1;
    if found then
      select * into batch_row from batches where id = existing_transition.batch_id;
      return batch_row;
    end if;
  end if;

  insert into batches(
    batch_code,
    product_id,
    raw_material_id,
    raw_material_used_kg,
    status,
    started_at,
    supervisor_id,
    notes,
    materials_requested_at,
    materials_approved_at,
    materials_issued_at
  )
  values (
    coalesce(p_batch_code, 'PB-' || to_char(now(), 'YYYYMMDD') || '-' || right(replace(gen_random_uuid()::text, '-', ''), 6)),
    p_product_id,
    p_raw_material_id,
    p_input_kg,
    'materials_requested',
    null,
    auth.uid(),
    p_notes,
    now(),
    null,
    null
  )
  returning * into batch_row;

  insert into production_state_transitions(batch_id, from_status, to_status, actor_id, idempotency_key, notes)
  values (batch_row.id, null, 'materials_requested', auth.uid(), coalesce(p_idempotency_key, batch_row.id::text || ':start') || ':requested', p_notes);

  batch_row := transition_production_batch(batch_row.id, 'materials_approved', coalesce(p_idempotency_key, batch_row.id::text || ':start') || ':approved', p_notes, null);
  batch_row := transition_production_batch(batch_row.id, 'materials_issued', coalesce(p_idempotency_key, batch_row.id::text || ':start') || ':issued', p_notes, null);
  batch_row := transition_production_batch(batch_row.id, 'in_progress', coalesce(p_idempotency_key, batch_row.id::text || ':start') || ':in_progress', p_notes, null);

  return batch_row;
end;
$$;

create or replace function request_production_batch(
  p_product_id uuid,
  p_raw_material_id uuid,
  p_input_kg numeric,
  p_batch_code text default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns batches
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_row batches;
  existing_transition production_state_transitions;
begin
  perform require_role(array['admin','manager','production','operations']);

  if p_input_kg <= 0 then
    raise exception 'input_kg_must_be_positive';
  end if;

  if p_idempotency_key is not null then
    select pst.* into existing_transition
    from production_state_transitions pst
    where pst.idempotency_key = p_idempotency_key || ':requested'
    limit 1;
    if found then
      select * into batch_row from batches where id = existing_transition.batch_id;
      return batch_row;
    end if;
  end if;

  insert into batches(
    batch_code,
    product_id,
    raw_material_id,
    raw_material_used_kg,
    status,
    supervisor_id,
    notes,
    materials_requested_at
  )
  values (
    coalesce(p_batch_code, 'PB-' || to_char(now(), 'YYYYMMDD') || '-' || right(replace(gen_random_uuid()::text, '-', ''), 6)),
    p_product_id,
    p_raw_material_id,
    p_input_kg,
    'materials_requested',
    auth.uid(),
    p_notes,
    now()
  )
  returning * into batch_row;

  insert into production_state_transitions(batch_id, from_status, to_status, actor_id, idempotency_key, notes)
  values (batch_row.id, null, 'materials_requested', auth.uid(), coalesce(p_idempotency_key, batch_row.id::text) || ':requested', p_notes);

  return batch_row;
end;
$$;

create or replace function approve_production_materials(
  p_batch_id uuid,
  p_idempotency_key text,
  p_notes text default null
)
returns batches
language sql
security definer
set search_path = public
as $$
  select * from transition_production_batch(p_batch_id, 'materials_approved', p_idempotency_key, p_notes, null)
$$;

create or replace function issue_production_materials(
  p_batch_id uuid,
  p_idempotency_key text,
  p_notes text default null
)
returns batches
language sql
security definer
set search_path = public
as $$
  select * from transition_production_batch(p_batch_id, 'materials_issued', p_idempotency_key, p_notes, null)
$$;

create or replace function start_production_work(
  p_batch_id uuid,
  p_idempotency_key text,
  p_notes text default null
)
returns batches
language sql
security definer
set search_path = public
as $$
  select * from transition_production_batch(p_batch_id, 'in_progress', p_idempotency_key, p_notes, null)
$$;

create or replace function send_batch_to_qc(
  p_batch_id uuid,
  p_idempotency_key text,
  p_notes text default null
)
returns batches
language sql
security definer
set search_path = public
as $$
  select * from transition_production_batch(p_batch_id, 'qc_pending', p_idempotency_key, p_notes, null)
$$;

create or replace function record_batch_qc(
  p_batch_id uuid,
  p_passed boolean,
  p_output_kg numeric,
  p_grade text default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns batches
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_row batches;
  qc_status text;
  key_base text;
begin
  perform require_role(array['admin','manager','production','operations']);
  qc_status := case when p_passed then 'qc_passed' else 'qc_failed' end;
  key_base := coalesce(p_idempotency_key, p_batch_id::text || ':qc:' || current_date::text);

  batch_row := transition_production_batch(p_batch_id, qc_status, key_base || ':' || qc_status, p_notes, p_output_kg);

  update batches
  set quality_grade = coalesce(p_grade, quality_grade),
      units_produced = coalesce(p_output_kg::integer, units_produced)
  where id = p_batch_id
  returning * into batch_row;

  if p_passed then
    batch_row := transition_production_batch(p_batch_id, 'completed', key_base || ':completed', p_notes, p_output_kg);
  end if;

  return batch_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sales, dispatch, invoice, and payment RPCs
-- ---------------------------------------------------------------------------

create or replace function create_sales_order(
  p_customer_id uuid,
  p_items jsonb,
  p_delivery_date date default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row orders;
  existing_order orders;
  item jsonb;
  product_row finished_products;
  line_qty numeric(12,2);
  line_price numeric(12,2);
  order_total numeric(12,2) := 0;
begin
  perform require_role(array['admin','manager','sales','operations']);

  if p_idempotency_key is not null then
    select * into existing_order
    from orders
    where idempotency_key = p_idempotency_key
    limit 1;
    if found then
      return existing_order;
    end if;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order_items_required';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    line_qty := nullif(item->>'quantity_kg', '')::numeric;
    line_price := coalesce(nullif(item->>'unit_price', '')::numeric, 0);
    if line_qty is null or line_qty <= 0 then
      raise exception 'order_item_quantity_must_be_positive';
    end if;

    select * into product_row
    from finished_products
    where id = (item->>'product_id')::uuid
    for update;
    if not found then
      raise exception 'finished_product_not_found';
    end if;
    if coalesce(product_row.quantity_kg, product_row.quantity, 0) < line_qty then
      raise exception 'insufficient_finished_stock: %', product_row.name;
    end if;
    order_total := order_total + (line_qty * line_price);
  end loop;

  insert into orders(order_number, customer_id, salesperson_id, order_date, delivery_date, status, total_amount, notes, idempotency_key)
  values (
    'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || right(replace(gen_random_uuid()::text, '-', ''), 6),
    p_customer_id,
    auth.uid(),
    current_date,
    p_delivery_date,
    'confirmed',
    order_total,
    p_notes,
    p_idempotency_key
  )
  returning * into order_row;

  for item in select * from jsonb_array_elements(p_items) loop
    line_qty := nullif(item->>'quantity_kg', '')::numeric;
    line_price := coalesce(nullif(item->>'unit_price', '')::numeric, 0);
    insert into order_items(order_id, product_id, quantity, unit_price)
    values (order_row.id, (item->>'product_id')::uuid, line_qty, line_price);
  end loop;

  return order_row;
end;
$$;

create or replace function generate_invoice_for_order(
  p_order_id uuid,
  p_idempotency_key text
)
returns invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row orders;
  existing invoices;
  invoice_row invoices;
begin
  perform require_role(array['admin','manager','sales','finance','operations']);

  select * into existing from invoices where order_id = p_order_id limit 1;
  if found then
    return existing;
  end if;

  select * into order_row from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  insert into invoices(invoice_number, order_id, customer_id, issued_date, due_date, amount, paid_amount, status)
  values (
    'INV-' || to_char(now(), 'YYYYMMDD') || '-' || right(replace(gen_random_uuid()::text, '-', ''), 6),
    p_order_id,
    order_row.customer_id,
    current_date,
    current_date + interval '30 days',
    order_row.total_amount,
    0,
    'sent'
  )
  returning * into invoice_row;

  update orders set status = 'invoiced' where id = p_order_id;
  return invoice_row;
end;
$$;

create or replace function record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference_number text,
  p_idempotency_key text
)
returns invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row invoices;
  existing_payment payments;
  next_paid numeric(12,2);
begin
  perform require_role(array['admin','manager','finance','operations']);

  select * into existing_payment from payments where idempotency_key = p_idempotency_key;
  select * into invoice_row from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'invoice_not_found';
  end if;
  if existing_payment.id is not null then
    return invoice_row;
  end if;

  if p_amount <= 0 then
    raise exception 'payment_amount_must_be_positive';
  end if;

  insert into payments(invoice_id, customer_id, amount, payment_date, method, reference_number, recorded_by, created_by, idempotency_key)
  values (p_invoice_id, invoice_row.customer_id, p_amount, current_date, p_method, p_reference_number, auth.uid(), auth.uid(), p_idempotency_key);

  next_paid := least(invoice_row.amount, coalesce(invoice_row.paid_amount, 0) + p_amount);

  update invoices
  set paid_amount = next_paid,
      status = case when next_paid >= amount then 'paid' else 'partial' end
  where id = p_invoice_id
  returning * into invoice_row;

  update orders
  set paid_amount = next_paid,
      status = case when next_paid >= total_amount then 'paid' else status end
  where id = invoice_row.order_id;

  return invoice_row;
end;
$$;

create or replace function dispatch_order(
  p_order_id uuid,
  p_driver_name text,
  p_truck_plate text,
  p_idempotency_key text
)
returns deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row orders;
  delivery_row deliveries;
  item record;
begin
  perform require_role(array['admin','manager','sales','operations']);

  select * into delivery_row from deliveries where idempotency_key = p_idempotency_key;
  if found then
    return delivery_row;
  end if;

  select * into order_row from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  for item in select * from order_items where order_id = p_order_id loop
    perform post_stock_movement(
      'finished_dispatch',
      -item.quantity,
      'sales',
      'order',
      p_order_id::text || ':' || item.product_id::text,
      null,
      item.product_id,
      'Sales dispatch'
    );
  end loop;

  insert into deliveries(order_id, driver_name, truck_plate, dispatch_time, status, idempotency_key, created_by)
  values (p_order_id, p_driver_name, p_truck_plate, now(), 'in_transit', p_idempotency_key, auth.uid())
  returning * into delivery_row;

  update orders set status = 'dispatched' where id = p_order_id;
  return delivery_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS replacement policies
-- ---------------------------------------------------------------------------

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles','schools','collections','suppliers','raw_materials','finished_products',
        'batches','maintenance_logs','customers','orders','order_items','invoices','payments',
        'staff','attendance','tasks','notifications','audit_logs','stock_movements','deliveries',
        'production_state_transitions'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

alter table deliveries enable row level security;
alter table production_state_transitions enable row level security;

create policy profiles_read on profiles for select using (
  id = auth.uid() or has_role(array['admin','manager','hr','operations'])
);
create policy profiles_admin_write on profiles for all using (has_role(array['admin','manager','hr']));

create policy schools_read on schools for select using (has_role(array['admin','manager','collection','collector','operations']));
create policy schools_write on schools for all using (has_role(array['admin','manager','collection','operations']));

create policy collections_read on collections for select using (
  has_role(array['admin','manager','collection','collector','inventory','operations'])
  and (collector_id = auth.uid() or has_role(array['admin','manager','collection','inventory','operations']))
);
create policy collections_write on collections for all using (has_role(array['admin','manager','collection','collector','operations']));

create policy suppliers_read on suppliers for select using (has_role(array['admin','manager','inventory','procurement','production','operations']));
create policy suppliers_write on suppliers for all using (has_role(array['admin','manager','inventory','procurement','operations']));

create policy raw_materials_read on raw_materials for select using (has_role(array['admin','manager','inventory','production','procurement','finance','operations']));
create policy raw_materials_write on raw_materials for all using (has_role(array['admin','manager','inventory','operations']));

create policy finished_products_read on finished_products for select using (has_role(array['admin','manager','inventory','production','sales','finance','operations']));
create policy finished_products_write on finished_products for all using (has_role(array['admin','manager','inventory','operations']));

create policy batches_read on batches for select using (has_role(array['admin','manager','production','inventory','sales','finance','operations']));
create policy batches_write on batches for all using (has_role(array['admin','manager','production','operations']));

create policy maintenance_logs_read on maintenance_logs for select using (has_role(array['admin','manager','production','hr','operations']));
create policy maintenance_logs_write on maintenance_logs for all using (has_role(array['admin','manager','production','operations']));

create policy customers_read on customers for select using (has_role(array['admin','manager','sales','finance','operations']));
create policy customers_write on customers for all using (has_role(array['admin','manager','sales','operations']));

create policy orders_read on orders for select using (has_role(array['admin','manager','sales','finance','inventory','production','operations']));
create policy orders_write on orders for all using (has_role(array['admin','manager','sales','operations']));

create policy order_items_read on order_items for select using (has_role(array['admin','manager','sales','finance','inventory','production','operations']));
create policy order_items_write on order_items for all using (has_role(array['admin','manager','sales','operations']));

create policy invoices_read on invoices for select using (has_role(array['admin','manager','finance','sales','operations']));
create policy invoices_write on invoices for all using (has_role(array['admin','manager','finance','operations']));

create policy payments_read on payments for select using (has_role(array['admin','manager','finance','operations']));
create policy payments_insert on payments for insert with check (has_role(array['admin','manager','finance','operations']));

create policy staff_read on staff for select using (has_role(array['admin','manager','hr','finance','operations']) or profile_id = auth.uid());
create policy staff_write on staff for all using (has_role(array['admin','manager','hr','operations']));

create policy attendance_read on attendance for select using (
  has_role(array['admin','manager','hr','operations'])
  or staff_id = (select id from staff where profile_id = auth.uid())
);
create policy attendance_write on attendance for all using (has_role(array['admin','manager','hr','operations']));

create policy tasks_read on tasks for select using (
  assigned_to = auth.uid()
  or assigned_by = auth.uid()
  or has_role(array['admin','manager','operations'])
);
create policy tasks_write on tasks for all using (
  assigned_to = auth.uid()
  or assigned_by = auth.uid()
  or has_role(array['admin','manager','operations'])
);

create policy notifications_read on notifications for select using (user_id = auth.uid() or has_role(array['admin','manager','operations']));
create policy notifications_insert on notifications for insert with check (has_role(array['admin','manager','operations']));
create policy notifications_update on notifications for update using (user_id = auth.uid() or has_role(array['admin','manager','operations']));

create policy audit_logs_read on audit_logs for select using (has_role(array['admin','manager','operations']));

create policy stock_movements_read on stock_movements for select using (has_role(array['admin','manager','inventory','production','sales','finance','operations']));
create policy stock_movements_write on stock_movements for all using (has_role(array['admin','manager','inventory','production','sales','operations']));

create policy deliveries_read on deliveries for select using (has_role(array['admin','manager','sales','inventory','finance','operations']));
create policy deliveries_write on deliveries for all using (has_role(array['admin','manager','sales','operations']));

create policy production_state_transitions_read on production_state_transitions for select using (has_role(array['admin','manager','production','inventory','operations']));
create policy production_state_transitions_write on production_state_transitions for all using (has_role(array['admin','manager','production','inventory','operations']));

commit;
