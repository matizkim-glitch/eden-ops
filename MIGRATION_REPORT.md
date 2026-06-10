# Eden Recyclers Production Backend Enforcement Report

Date: 2026-05-31

## Executive Summary

This pass moves critical business rules out of browser-only code and into Supabase/PostgreSQL enforcement. The new backend migration adds role helpers, explicit RLS policies, transactional RPC workflows, immutable payment records, inventory stock movements, production state transitions, and audit logging.

Current readiness: stronger foundation, but still requires applying the migration to a real Supabase project and running live database integration tests before production launch.

## Server-Enforced Workflows

| Workflow | Frontend risk removed | Tables | Server enforcement |
| --- | --- | --- | --- |
| Collection receipt | Duplicate receiving could inflate raw stock | `collections`, `raw_materials`, `stock_movements`, `audit_logs` | `receive_collection` locks the collection, posts one idempotent `raw_receipt`, then marks received |
| Inventory adjustment | Direct quantity edits bypassed audit trail | `raw_materials`, `finished_products`, `stock_movements` | `post_stock_movement` is the only stock mutation path for RPC workflows |
| Production lifecycle | Invalid states and duplicate finished-stock credit | `batches`, `production_state_transitions`, `stock_movements` | `request_production_batch`, `approve_production_materials`, `issue_production_materials`, `start_production_work`, `send_batch_to_qc`, `record_batch_qc`, `transition_production_batch` |
| Sales order creation | Orders could be accepted without stock | `orders`, `order_items`, `finished_products` | `create_sales_order` locks finished products and rejects insufficient stock before inserting |
| Invoice generation | Duplicate invoices | `orders`, `invoices` | `generate_invoice_for_order` returns existing invoice for the order when present |
| Payment recording | Direct payment insert/update and invoice mutation | `payments`, `invoices`, `orders`, `audit_logs` | `record_invoice_payment` inserts immutable payments, supports partials, updates balances in transaction |
| Dispatch | Direct stock decrement and delivery creation | `orders`, `order_items`, `deliveries`, `finished_products`, `stock_movements` | `dispatch_order` posts finished-stock dispatch movements and creates delivery atomically |

## Production State Machine

Canonical states:

`materials_requested -> materials_approved -> materials_issued -> in_progress -> qc_pending -> qc_passed -> completed`

Failure paths:

`materials_requested/materials_approved/materials_issued/in_progress -> rejected`

`qc_pending -> qc_failed -> rejected`

`qc_failed -> in_progress` is allowed for rework.

Invalid transitions raise `invalid_production_transition`. Each transition writes to `production_state_transitions` with an idempotency key.

## Inventory Ledger

Every stock mutation created by enforced workflows writes `stock_movements` with:

- movement type
- quantity
- source module
- source type
- reference id
- user
- timestamp
- resulting balance

`stock_movements_idempotency_idx` prevents duplicate posting for the same source and movement type.

## Financial Integrity

Payments are append-only. `prevent_payment_mutation` blocks updates and deletes, so corrections must be reversal transactions. `record_invoice_payment` supports partial payments and uses an idempotency key.

## Role Security Matrix

The migration removes broad authenticated policies and uses explicit role checks through `has_role(...)`.

| Area | Readers | Writers / Approvers |
| --- | --- | --- |
| Profiles | self, admin, manager, HR, operations | admin, manager, HR |
| Collections | collection, collector, inventory, operations, manager, admin | collection, collector, operations, manager, admin |
| Inventory | inventory, production, procurement, finance, operations, manager, admin | inventory, operations, manager, admin |
| Production | production, inventory, sales, finance, operations, manager, admin | production, operations, manager, admin |
| Sales | sales, finance, inventory, production, operations, manager, admin | sales, operations, manager, admin |
| Finance | finance, sales, operations, manager, admin | finance, operations, manager, admin |
| HR | self for own staff profile, HR, finance, operations, manager, admin | HR, operations, manager, admin |
| Audit | operations, manager, admin | audit trigger only |

## XSS Remediation

Shared rendering sinks hardened:

- `js/components/toast.js` uses DOM nodes and `textContent`.
- `js/components/modal.js` uses DOM nodes and `textContent`.
- `js/components/table.js` treats custom renderer output as text by default.

CSP recommendation for deployment:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

## Tests Added

Regression checks now cover:

- collection receive idempotency
- partial payment status handling
- finished-stock credit idempotency
- real logo asset presence
- service worker authenticated HTML caching removal
- schema hardening and no broad authenticated RLS
- backend enforcement migration RPC/state/RLS presence
- shared component XSS sink hardening

## Remaining Critical Issues

None left in the local code pass for the targeted architecture blockers.

## Remaining High Issues

- The migration has not been executed against a live Supabase database in this environment.
- Live RLS permission tests require seeded users for each role.
- Route-level pages still contain many template-rendered HTML blocks; shared component sinks are fixed, but a full route-rendering XSS rewrite remains a hardening task.

## Production Readiness Score

Architecture score after this pass: 78/100.

The platform is materially closer to production deployment, but should not be declared production-ready until the migration is applied to Supabase and live integration/RLS tests pass with real role accounts.
