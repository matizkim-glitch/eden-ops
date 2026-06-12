# Eden Recyclers BOS Frontend Migration Plan

The current HTML app remains intact while the production frontend moves to a component-based React shell under `frontend/`.

## What Changes

- React + Vite replaces ad hoc page scripting for the new frontend shell.
- Tailwind runs through npm/PostCSS instead of the CDN.
- Supabase configuration moves to Vite environment variables.
- Department navigation, cards, workflows, and handoffs are componentized.
- Existing Supabase/PostgreSQL/RLS/audit/ledger work remains the backend foundation.

## Migration Rules

- Do not import `js/router.js` into React. It mutates the DOM and will fight React.
- Reuse existing `js/modules/*` only through a typed bridge while each module is ported.
- Keep existing `.html` pages available until each workflow is verified in React.
- Cut over deployment only after live Supabase, RLS, XSS, workflow, and performance checks pass.

## Department Order

1. Overview shell and shared layout.
2. Inventory and production, because stock ledger and batch lifecycle are core blockers.
3. Sales and CRM, because customer demand depends on stock and finance.
4. Finance, HR, collection, maintenance, facility, sustainability, and infrastructure.

## Local Commands

```bash
npm run dev:react
npm run build:react
npm run preview:react
```

## Go-Live Cutover

Only move hosting from the root static app to `dist/react` after:

- React build passes.
- Existing regression tests pass.
- Department workflows are ported and tested.
- Supabase live deployment and RLS are verified.
- CSP is tightened without Tailwind CDN or unsafe route rendering.
