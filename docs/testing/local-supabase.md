# Local Supabase Testing

Requiere Node 22, Docker Desktop activo y Supabase CLI. El flujo usa puertos locales `55421` (API), `55432` (Postgres) y `55424` (SMTP), y nunca acepta una URL remota ni una service role remota.

1. Copiar `.env.test.example` a `.env.test.local` y generar usuarios/credenciales locales.
2. Ejecutar `npm run supabase:bootstrap`. El bootstrap difiere temporalmente `supabase/migrations` para evitar que el CLI ejecute policies antes del schema; después aplica primero `drizzle-postgres/*.sql` y luego `supabase/migrations/*.sql`, registrando cada archivo para hacerlo idempotente.
4. Aplicar fixtures locales con la service role impresa por `supabase status`: `psql "$MIGRATION_DATABASE_URL" -f tests/fixtures/local-fixtures.sql`.
5. Ejecutar `npm run test:api`, `npm run test:db`, `npm run test:rls` y `npm run test:e2e`.
6. Limpiar con `npm run supabase:cleanup`.

Si Docker no está disponible, los comandos DB/RLS/E2E deben quedar como `BLOCKED`/`NOT RUN`; no se convierten en PASS. La service role sólo se usa en scripts server-side locales y nunca en navegador.
