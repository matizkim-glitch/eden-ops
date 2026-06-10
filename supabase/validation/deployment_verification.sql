-- Eden Recyclers deployment verification queries
-- Run in the Supabase SQL editor after applying schema.sql and all migrations.

with expected_tables(name) as (
  values
    ('profiles'),
    ('schools'),
    ('collections'),
    ('suppliers'),
    ('raw_materials'),
    ('finished_products'),
    ('batches'),
    ('maintenance_logs'),
    ('customers'),
    ('orders'),
    ('order_items'),
    ('invoices'),
    ('payments'),
    ('staff'),
    ('attendance'),
    ('tasks'),
    ('notifications'),
    ('audit_logs'),
    ('stock_movements'),
    ('production_state_transitions'),
    ('deliveries')
)
select
  'table' as check_type,
  name,
  case when t.table_name is not null then 'PASS' else 'FAIL' end as status
from expected_tables e
left join information_schema.tables t
  on t.table_schema = 'public'
 and t.table_name = e.name
order by name;

with expected_functions(name) as (
  values
    ('current_user_role'),
    ('has_role'),
    ('require_role'),
    ('audit_row_change'),
    ('post_stock_movement'),
    ('receive_collection'),
    ('valid_production_transition'),
    ('transition_production_batch'),
    ('request_production_batch'),
    ('approve_production_materials'),
    ('issue_production_materials'),
    ('start_production_work'),
    ('send_batch_to_qc'),
    ('record_batch_qc'),
    ('create_sales_order'),
    ('generate_invoice_for_order'),
    ('record_invoice_payment'),
    ('dispatch_order')
)
select
  'rpc_function' as check_type,
  name,
  case when p.proname is not null then 'PASS' else 'FAIL' end as status
from expected_functions e
left join pg_proc p
  on p.proname = e.name
left join pg_namespace n
  on n.oid = p.pronamespace
 and n.nspname = 'public'
order by name;

with expected_indexes(name) as (
  values
    ('stock_movements_idempotency_idx'),
    ('payments_idempotency_key_idx'),
    ('orders_idempotency_key_idx'),
    ('deliveries_idempotency_key_idx')
)
select
  'index' as check_type,
  name,
  case when i.indexname is not null then 'PASS' else 'FAIL' end as status
from expected_indexes e
left join pg_indexes i
  on i.schemaname = 'public'
 and i.indexname = e.name
order by name;

with expected_triggers(name) as (
  values
    ('audit_profiles'),
    ('audit_invoices'),
    ('audit_payments'),
    ('audit_raw_materials'),
    ('audit_finished_products'),
    ('audit_batches'),
    ('audit_collections'),
    ('audit_stock_movements'),
    ('audit_deliveries'),
    ('audit_production_state_transitions'),
    ('prevent_payment_update'),
    ('prevent_payment_delete')
)
select
  'trigger' as check_type,
  name,
  case when tr.tgname is not null then 'PASS' else 'FAIL' end as status
from expected_triggers e
left join pg_trigger tr
  on tr.tgname = e.name
 and not tr.tgisinternal
order by name;

select
  'rls_enabled' as check_type,
  c.relname as table_name,
  case when c.relrowsecurity then 'PASS' else 'FAIL' end as status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles',
    'schools',
    'collections',
    'suppliers',
    'raw_materials',
    'finished_products',
    'batches',
    'maintenance_logs',
    'customers',
    'orders',
    'order_items',
    'invoices',
    'payments',
    'staff',
    'attendance',
    'tasks',
    'notifications',
    'audit_logs',
    'stock_movements',
    'production_state_transitions',
    'deliveries'
  )
order by c.relname;

select
  'rls_policy' as check_type,
  tablename || '.' || policyname as name,
  'PASS' as status
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select
  'broad_authenticated_policy' as check_type,
  coalesce(tablename || '.' || policyname, 'none') as name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from pg_policies
where schemaname = 'public'
  and (
    qual ilike '%auth.role()%authenticated%'
    or with_check ilike '%auth.role()%authenticated%'
  )
group by tablename, policyname;
