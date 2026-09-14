# Cloudflare Production Deployment

This repository uses OpenNext for the Next.js 16 deployment. Cloudflare
Hyperdrive connects the Worker to the existing Supabase PostgreSQL database;
Supabase remains authoritative for Auth, Storage, RLS, and M5 policies.

## Required setup

1. Create a Hyperdrive configuration targeting the Supabase Postgres host. Use
   the Supabase pooler connection string, not a direct database connection.
2. Replace `REPLACE_WITH_CLOUDFLARE_HYPERDRIVE_ID` in `wrangler.jsonc` with the
   Hyperdrive ID. Do not commit the connection string or any secret.
3. Authenticate Wrangler with the Cloudflare account that owns the Worker:
   `npx wrangler login`.
4. Add these Worker secrets with `npx wrangler secret put`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY`. The service role key is server-only and is
   required by the existing M5 Storage upload bridge.
5. Apply the committed `drizzle-postgres/` migrations and then the ordered
   `supabase/migrations/` files before the first production request.

The local `DATABASE_URL` and `MIGRATION_DATABASE_URL` variables remain for Node
development and migration tooling. They are not Cloudflare bindings and must
not be prefixed with `NEXT_PUBLIC_`.

## Build and deploy

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run cf:build
npm run cf:deploy:dry
npm run cf:deploy
```

`cf:deploy:dry` validates the generated Worker without publishing it. The
script explicitly selects `wrangler.jsonc` so an old ignored `dist/` artifact
cannot redirect deployment to a different Worker configuration. A real
deployment requires a real Hyperdrive ID and authenticated Wrangler session;
the checked-in placeholder intentionally prevents accidental deployment from
a fresh checkout.

Do not add D1 or R2 bindings for this application. Replacing Supabase Auth,
Storage, RLS, or the M5 evidence policies is outside this migration and would
change product/security behavior.
