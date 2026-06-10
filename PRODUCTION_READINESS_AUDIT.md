# Eden Recyclers BOS Production Readiness Audit

Date: 2026-05-31

## Executive Summary

The platform has a strong interactive frontend shell and realistic department workflows, but it is not yet production-ready as a secure multi-user business system. The current implementation still relies heavily on browser-side mock/localStorage workflows and direct Supabase table writes. This pass fixed several immediate shell, security, caching, and mock workflow defects, then added regression tests for those fixes.

## Fixed In This Pass

- Replaced the inline approximation with the real local logo asset at `assets/eden-recyclers-logo.jpg`.
- Limited local Supabase config overrides to explicit local development.
- Added real Supabase session verification before protected page rendering when mock mode is not active.
- Cleared app caches on logout and stopped the service worker from caching authenticated HTML pages.
- Added shared HTML escaping and removed unsafe toast message interpolation.
- Escaped notification title/body rendering and normalized fallback `message` to `body`.
- Made collection receiving idempotent in mock mode with a `stock_movements` ledger.
- Made sales mock payment handling support partial payments and create payment records.
- Made production finished-stock credit idempotent to prevent repeated completion from double-counting stock.
- Added `audit_logs` and `stock_movements` tables to the schema.
- Restricted profile self-update grants to non-privileged columns.
- Added regression tests for the above fixes.

## Critical Remaining Blockers

### CRITICAL: Server-Side Workflow Enforcement Missing

Description: Sensitive business operations still happen directly from browser code.
Root cause: The frontend writes to Supabase tables directly and mock mode writes to localStorage.
Impact: Users can bypass UI rules and mutate payments, inventory, production, HR, and dispatch data.
Reproduction: Use browser DevTools or Supabase client calls with a valid session to call mutation methods outside the intended UI flow.
Recommended fix: Move payment posting, stock movements, production completion, dispatch, role assignment, and invoice generation into Supabase RPC/Edge Functions with transaction and permission checks.

### CRITICAL: Production Lifecycle Needs Database State Machine

Description: Production still needs a canonical state machine from material request through QC and finished stock.
Root cause: Batch, QC, material request, and stock credit logic is split across route code, module code, and localStorage.
Impact: Real data can drift between raw material stock, production status, QC status, and finished product inventory.
Reproduction: Start a batch, submit QC, and repeat completion from multiple UI paths.
Recommended fix: Add an idempotent server-side lifecycle: `materials_requested -> materials_issued -> in_progress -> qc_check -> completed/rejected`, with stock movement rows and one-time finished stock credit.

### CRITICAL: RLS Needs Full Role Matrix

Description: Many tables remain broadly readable to all authenticated users.
Root cause: Development policies use `auth.role() = 'authenticated'` for sensitive tables.
Impact: Customer, invoice, payment, HR, supplier, and operational data can be exposed across roles.
Reproduction: Sign in as any authenticated role and query sensitive tables directly.
Recommended fix: Replace broad read policies with per-role policies for finance, HR, sales, production, inventory, collection, manager, and admin.

## High Remaining Blockers

### HIGH: Stored XSS Risk Remains In Many Route Templates

Description: Many pages still render business data through template strings and `innerHTML`.
Root cause: Dynamic route controllers build large HTML strings from customer/task/material/order data.
Impact: A malicious saved customer name, supplier name, note, or task title could execute script.
Reproduction: Insert HTML/script-like text into customer/task data and render affected cards/modals.
Recommended fix: Continue replacing dynamic interpolations with escaped output or DOM construction. Add CSP and remove unsafe inline script requirements over time.

### HIGH: Schema/Client Drift

Description: Client modules and SQL schema use different field names and status values.
Root cause: Mock data evolved faster than the schema.
Impact: Real Supabase mode will drop, misread, or reject fields such as finished product quantities, supplier metadata, task statuses, and customer categories.
Reproduction: Switch to real Supabase mode and run order, inventory, and task flows.
Recommended fix: Generate typed client models from schema and add migration/contract tests.

## Medium Remaining Issues

- Payment, CRM, and finance residual balance calculations need one shared service.
- Notifications need a shared creation helper that routes to user/role/department and respects the SQL enum.
- Maintenance and Facility need persisted asset/machine tables in real mode.
- HR should use `staff` joined to `profiles` instead of writing employee metadata to `profiles`.
- Offline queue needs idempotent replay or should be disabled for mutations.

## Test Coverage Summary

Current automated tests:

- `tests/regression.test.js`
  - Collection receiving idempotency.
  - Partial payment behavior.
  - Production finished stock one-time credit.
  - Real logo asset presence.
  - Service worker HTML caching restriction.
  - Schema audit/stock movement hardening presence.
- `smoke-test.js`
  - Script loading smoke check.

Run with:

```bash
npm test
```

## Security Summary

Improved:

- Dev-only mock/config override guard.
- Real session verification path for non-mock mode.
- Restricted profile column update grants in schema.
- Audit and stock movement schema foundations.
- No authenticated HTML precaching.
- Safer notification/toast rendering.

Still required before production:

- Server-side RPC/Edge Functions for privileged workflows.
- Full RLS role matrix.
- CSP/SRI and broader XSS remediation.
- Secrets/build-time config management.
- Audit triggers deployed and verified in Supabase.

## Production Readiness Assessment

Status: Not production-ready yet.

The application is improving quickly, but production readiness requires backend enforcement, schema/client alignment, stronger RLS, and broader workflow tests. The current frontend can be used as an interactive prototype and local operations simulation, not as the final secure production system.
