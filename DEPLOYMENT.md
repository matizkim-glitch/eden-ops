# Eden Recyclers BOS Deployment Guide

This guide covers the deployment scaffolding for the Eden Recyclers Business Operations System, a static vanilla JavaScript app backed by Supabase.

## Prerequisites

- Node.js 18 or newer. `.nvmrc` pins local and CI environments to Node 18.
- npm 9 or newer.
- A Supabase staging project and a separate Supabase production project.
- A static hosting provider such as Netlify, Vercel, Cloudflare Pages, or equivalent.

## Required Environment Variables

Mirror `.env.example` in every environment:

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL, for example `https://project-ref.supabase.co`. |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon public key. This is safe to expose only when RLS has been deployed and validated. |
| `SUPABASE_REDIRECT_URL` | Yes | Canonical public origin used for password reset redirects, for example `https://ops.edenrecyclers.example`. |
| `EDEN_DEBUG` | No | Keep `false` outside local troubleshooting. |

The browser runtime reads `window.ENV` in `js/config.js`. For static hosts, inject a small environment script before `js/config.js`, using `js/env.example.js` as the template:

```html
<script src="js/env.js"></script>
<script src="js/config.js"></script>
```

Do not commit a populated `js/env.js`. Generate it in the hosting build step or provide an equivalent host-level runtime injection.

## Local Development

```bash
npm ci
npm start
```

The local server listens at `http://127.0.0.1:8000` and serves `login.html` at the root path. Without Supabase values, local development falls back to mock auth only on `localhost` or `127.0.0.1`.

To test against Supabase locally, create `.env` from `.env.example`, then generate an untracked `js/env.js` from those values before opening the app.

## Database Migration

1. Provision a staging Supabase project.
2. Apply `schema.sql` in the Supabase SQL Editor.
3. Apply any files in `supabase/migrations/` in timestamp order.
4. Run the validation scripts in `supabase/validation/` when present.
5. Create one Supabase Auth user for each supported role and confirm RLS access before promoting to production.

Production must use a separate Supabase project. Promote only after staging migration and RLS validation pass.

## CI

GitHub Actions runs on pull requests and pushes to `main`:

```bash
npm ci
npm test
```

The `main` branch workflow also checks that `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_REDIRECT_URL` repository secrets exist. Deployment jobs can be added after a hosting provider is selected.

## Hosting Headers

`netlify.toml` provides the initial security header baseline:

- Content Security Policy for self-hosted assets, Supabase, Tailwind CDN, jsDelivr, and Google Fonts.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying camera, microphone, and geolocation.

The CSP currently allows inline scripts and styles because the existing HTML pages use inline Tailwind config and inline page scripts. Remove `'unsafe-inline'` after migrating Tailwind to a compiled build and moving inline scripts into static files.

## CDN Integrity

The current Tailwind CDN runtime is not compatible with a stable SRI hash because it generates CSS dynamically in the browser. For SEC-06, use this interim rule:

1. Pin every CDN URL to an explicit version where possible.
2. Add SRI to static CDN resources such as the Supabase SDK after pinning an exact version.
3. Replace Tailwind CDN with a compiled Tailwind build before enforcing strict SRI everywhere.

Generate SRI hashes with:

```bash
curl -sL "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<version>" | openssl dgst -sha384 -binary | openssl base64 -A
```

## Release Checklist

- `npm test` passes locally and in CI.
- Staging Supabase migrations and RLS validation pass.
- Required environment variables are configured in the hosting provider.
- Password reset URL is added to Supabase Auth redirect allow-list.
- Security headers are active on the deployed origin.
- Browser smoke test confirms login, reset password, dashboard routing, and service worker registration.
- Error monitoring provider and alert destination are selected before production launch.
