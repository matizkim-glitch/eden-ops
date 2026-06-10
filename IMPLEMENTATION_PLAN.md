# Eden Recyclers BOS Implementation Plan

## Current Foundation
- Keep the existing Stitch output: vanilla HTML, Tailwind CDN, Material Symbols, Inter, and vanilla ES6 modules.
- Use Supabase PostgreSQL/Auth/Realtime as the real backend and localStorage-backed mock mode when Supabase credentials are placeholders.
- Preserve the existing module pages: operations overview, waste collection, supplier inventory, production, sales, HR, finance, analytics, and infrastructure.

## Completed In This Pass
- Restored the missing `dashboard.js` and `finance.js` modules referenced by the HTML pages.
- Fixed the global router crash caused by an invalid `:contains()` selector.
- Wired navigation mappings and module cards to real page targets.
- Added dynamic Waste Collection KPIs, school dropdown population, modal submission, collection persistence, and "Mark Received" stock update behavior.
- Aligned major real Supabase module calls with `schema.sql` table/column names.
- Added a local Node static server and a browser-like smoke test.
- Added PWA basics: `manifest.json`, `sw.js`, service worker registration, and offline app-shell caching.

## Next Work Blocks
1. Supabase setup
   - Create the Supabase project.
   - Run `schema.sql`.
   - Add real URL and anon key through `localStorage` or `js/config.js`.
   - Create initial admin/manager users and matching `profiles` rows.

2. Module UI completion
   - Inventory: bind stock/product/supplier forms to `inventoryModule`.
   - Production: bind batch, QC, and maintenance actions to `productionModule`.
   - Sales/Finance: bind customer/order/invoice/payment workflows and PDF exports.
   - HR: bind staff onboarding, attendance grid, and task assignment.

3. Automation
   - Create Supabase Edge Functions for low-stock, overdue invoice, weekly report, collection reminder, and QC reminder jobs.
   - Add Africa's Talking secrets and SMS templates.

4. Hardening
   - Add unique indexes needed for attendance upserts if desired.
   - Add storage buckets for weigh slips and invoice PDFs.
   - Expand RLS policies from development-friendly policies to production-grade role permissions.
   - Replace placeholder remote images with local assets or stable hosted brand images.

## Local Verification
- Start server: `node dev-server.js`
- Open app: `http://127.0.0.1:8000/login.html`
- Mock login: `admin@eden.com` / `password`
- Smoke test: `node smoke-test.js`
