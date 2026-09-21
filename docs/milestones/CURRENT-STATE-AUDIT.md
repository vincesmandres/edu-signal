# Current State Audit

## Runtime
- **Estado:** PASS parcial. La línea de ejecución real es Next 16.3.3 (aunque el objetivo histórico del milestone habla de Next 15), Supabase Auth/Storage, Drizzle ORM sobre Postgres y OpenNext para Cloudflare/Hyperdrive. La evidencia de runtime es `package.json:27-36`, `open-next.config.ts`, `wrangler.jsonc`, `db/index.ts` y `lib/supabase/*`.
- **P2 | Discrepancia docs/código:** `docs/milestones/M0.5-runtime-stabilization.md:18-20,46,73-82` conserva D1/SQLite/Workers como contexto histórico; `drizzle/` y `examples/d1/` siguen en el repositorio. No son el runtime activo, pero el source of truth operativo debe ser Postgres + Supabase + OpenNext.
- `npm run build` identifica rutas Next y `ƒ Proxy`; no se ejecutó deploy ni se requirieron secretos.

## Authentication
- **Estado:** PASS de diseño local; verificación live pendiente. `lib/auth.ts` y `lib/supabase/server.ts` derivan la identidad de Supabase Auth; `supabase/migrations/0002_m1_identity.sql` crea perfiles/roles.
- **P2:** `db/schema.ts:18-22` conserva `password_hash`; `docs/milestones/M1-identity-and-roles.md:63-74` declara que `educators`/`sessions` y hash son legacy. La aplicación activa no debe leerlos, pero falta una decisión de retención/backfill.
- **P2:** signup devuelve `/login?registered=1` desde `app/api/auth/signup/route.ts:23-27`, pero `app/login/AuthForm.tsx` no muestra feedback de registro confirmado.

## Authorization
- **Estado:** P1. Los guards de servidor existen (`lib/auth.ts`, `lib/student/require-student.ts`, `lib/teacher/get-teacher-module.ts`), pero APIs históricas todavía permiten selectors peligrosos.
- **P1:** `app/api/credentials/route.ts:16-17` acepta `studentId` sin `classroomId` y autoriza sólo por existencia global; tampoco exige `enrollments.status = 'active'`.
- **P1:** `app/api/evaluations/route.ts:26-31` verifica que la evidencia sea del docente, pero no verifica que la rúbrica pertenezca al mismo aula ni que un criterio pertenezca a esa rúbrica.
- **P1:** La matriz adversarial Teacher A/B y Student A/B no está probada contra Supabase real; los tests actuales son mayoritariamente inspección estática/regex.

## Database
- **Estado:** P1. `db/schema.ts:130-207` contiene rubrics, criteria, evidences, evaluations, scores y credentials, pero varios invariantes de dominio sólo están en código.
- **P1:** `app/api/evaluations/route.ts:32-36` inserta evaluación, scores y audit en operaciones separadas: un fallo intermedio deja datos parciales.
- **P1:** La API permite `status: "published"` fijo en `app/api/evaluations/route.ts:33` y no implementa el draft publicado/documentado como flujo de evaluación controlado.
- **P2:** `drizzle-postgres/` y `supabase/migrations/` divergen en FKs de evidence y ownership: por ejemplo snapshots/migraciones históricas aún muestran `educators`, mientras `drizzle-postgres/meta/0003_snapshot.json` usa `profiles`.
- **P2:** El source of truth declarado por M5 es `drizzle-postgres/` para esquema relacional y `supabase/migrations/` para RLS/Storage (`docs/milestones/M5-evidence-system.md:27-30`), pero esa separación no se valida automáticamente.

## RLS
- **Estado:** P1, no probado en un proyecto Supabase real en esta baseline. `supabase/migrations/0005_m2_m4_rls.sql` y `0007_m5_evidence_system.sql` cubren parte de estudiantes/evidence.
- **P1:** No hay políticas completas y verificadas para `evaluations`, `evaluation_scores`, `rubrics` y `credentials`; los snapshots Drizzle indican `isRLSEnabled: false` para tablas relacionales.
- **P1:** Las políticas existentes no sustituyen autorización server-side para las rutas que usan conexión Drizzle privilegiada. Debe probarse explícitamente no-filtración Teacher A/B y Student A/B.
- **P2:** `docs/milestones/M5-evidence-system.md:24-30` describe una cobertura más fuerte que la evidencia ejecutada; es documentación aspiracional hasta pasar el gate Supabase.

## Teacher flows
- **Estado:** P1. Aulas, módulos, actividades, estudiantes, rúbricas y lectura de evidencias tienen páginas/API (`app/classrooms`, `app/students`, `app/rubrics`, `app/evidence`, `app/api/*`).
- **P1:** `app/evidence/EvidenceStudio.tsx:11` hace `POST /api/evidence`, pero `app/api/evidence/route.ts:21-24` devuelve `410`; el CTA del dashboard (`app/Dashboard.tsx:16`) queda roto para registrar evidencia docente.
- **P1:** La UI de evaluación está ausente: no existe página de evaluación equivalente en `app/`; sí existe API en `app/api/evaluations/route.ts:7-38`.
- **P2:** El dashboard muestra email vacío/incorrecto cuando el perfil no tiene email de dominio (`app/Dashboard.tsx:16`, el email es parte de Auth y no se hidrata como dato de dominio visible).
- **P1:** Carrera de evidencia docente inconsistente: los endpoints student-owned de `app/api/student/evidence/*` modelan draft/upload/submit, pero la experiencia docente histórica ofrece un CTA incompatible.

## Student flows
- **Estado:** PASS parcial. Las rutas `app/student/*` y `lib/student/*` exigen identidad, enrollment activo y módulos/actividades publicados; `tests/m2-m4-activity.test.mjs` cubre presencia textual.
- **P1:** `components/activities/ActivityRenderer.tsx:28` deshabilita completar con `activity.requiresEvidence` aun cuando `evidence?.status === "submitted"`; el estudiante queda bloqueado después de entregar.
- **P2:** Los flujos de estudiante están implementados principalmente en cliente y requieren pruebas HTTP autenticadas para confirmar que el estado UI refleja el estado de servidor.

## Evidence lifecycle
- **Estado:** P1. El modelo previsto es `draft -> submitted`, con evidencia enviada inmutable; source of truth declarativo: `db/schema.ts:149-174`, `supabase/migrations/0007_m5_evidence_system.sql:19-63` y `drizzle-postgres/0003_m5_evidence_system.sql:11-40`.
- **P1:** La discrepancia UI/API descrita en Teacher flows rompe el alta docente; el camino correcto vigente es student-owned, no el POST histórico.
- **P1:** La completion guard mencionada en `components/activities/ActivityRenderer.tsx:28` no consume `submitted` como condición suficiente.
- **P2:** Las migraciones Drizzle y Supabase no coinciden completamente en FKs/ownership de evidence; aplicar sólo una familia no garantiza el mismo esquema.
- **P2:** El upload usa Storage y compensación en `app/api/student/evidence/[evidenceId]/file/route.ts`; la compensación y el trigger se cubren sólo estáticamente, no contra Storage real.
- **P1:** La carrera PATCH/upload/submit del draft identifica primero por ownership, pero las escrituras finales usan `WHERE id` (o `id,status`) sin volver a incluir `studentId`/ownership: `app/api/student/evidence/[evidenceId]/route.ts:24`, `app/api/student/evidence/[evidenceId]/file/route.ts:20,27` y `app/api/student/evidence/[evidenceId]/submit/route.ts:13`. Debe endurecerse dentro de la misma operación/transacción.

## Evaluation
- **Estado:** P1. API existente, UI ausente.
- **P1:** `app/api/evaluations/route.ts:28-31` permite rubric cross-tenant/cross-classroom: sólo comprueba que exista el ID.
- **P1:** `app/api/evaluations/route.ts:34-35` acepta criterion cross-rubric y scores arbitrarios como strings sin rango/tipo/escala contra `rubric_criteria`.
- **P1:** Inserción no transaccional en `app/api/evaluations/route.ts:32-36`; puede persistir evaluación sin scores o scores sin audit coherente.
- **P2:** Se admite estado conceptual draft en `db/schema.ts:183`, pero el POST fuerza `published`; docs/código no definen una máquina de estados pública completa.

## Credentials
- **Estado:** P1. `app/api/credentials/route.ts:12-23` emite credenciales con `studentId`, issuer y hash SHA-256.
- **P1:** La rama sin `classroomId` en `app/api/credentials/route.ts:16` permite emitir para cualquier estudiante global y no filtra enrollment active.
- **P1:** `app/api/credentials/verify/[code]/route.ts:7-10` devuelve el JSON si conoce el código, pero `credential.proof` es sólo SHA-256 del JSON (`app/api/credentials/route.ts:19-20`): no autentica criptográficamente al issuer ni prueba una firma verificable.
- **P1:** El API devuelve `/verify/${verificationCode}` (`app/api/credentials/route.ts:23`), no existe `app/verify/[code]/page.tsx`; la ruta de UI `/verify/code` no tiene página.

## Testing
- **Estado baseline:** PASS con limitaciones. `npm ci`: terminó correctamente; warning engine Node declarado `22.x` frente a Node `v24.15.0`, 12 vulnerabilidades npm (1 low, 5 moderate, 6 high), y 8 paquetes con install scripts bloqueados. `npm run typecheck`: PASS. `npm run lint`: PASS, 4 warnings `@next/next/no-location-assign-relative-destination` en `app/Dashboard.tsx:15`, `app/classrooms/ClassroomStudio.tsx:19`, `app/classrooms/[classroomId]/modules/[moduleId]/activities/ActivityForm.tsx:10` y `app/student/StudentNav.tsx:8`. `npm test`: PASS, build + 17 tests passed, 0 failed. `npm run build`: PASS; warning de `metadataBase` ausente. `npm run verify`: PASS, mismos 17 tests y build.
- **P1:** `package.json:15,25` sólo ejecuta tests `rendered-html`, M1, M2-M4 y M5; predominan regex/static checks (`tests/*.mjs`). No hay CI declarada en el repositorio.
- **P2:** No se ejecutaron `verify:live`, `db:migrate`, `db:seed` ni `auth:seed`: requieren infraestructura/credenciales y no se deben convertir en requisito de baseline local.

## Deployment
- **Estado:** P2, no verificado live. `package.json:11-13`, `open-next.config.ts`, `wrangler.jsonc` apuntan a OpenNext/Cloudflare/Hyperdrive; `docs/cloudflare-deployment.md` describe el despliegue.
- **P1:** `/api/health` sólo ejecuta `select 1` (`app/api/health/route.ts:4-10`); no valida migraciones, RLS, Storage, Auth ni una consulta representativa.
- **P2:** El build local produce Next estándar y no prueba `cf:build`/worker. No se ejecutó deploy por la instrucción de no desplegar ni requerir secretos.

## Technical debt
- **P2:** Legacy `educators`, `sessions` y `password_hash` permanecen en esquema/migraciones (`db/schema.ts:18-22`, `docs/milestones/M1-identity-and-roles.md:65-74`).
- **P2:** D1/SQLite histórico (`drizzle/`, `examples/d1/`, `docs/milestones/M0.5-runtime-stabilization.md:73-82`) puede inducir una autoridad equivocada.
- **P2:** No existe una única validación/generación que compare Drizzle Postgres con Supabase RLS/Storage y FKs.
- **P2:** Warnings de navegación interna y `metadataBase` pendiente; no bloquean baseline pero degradan calidad.

## Security findings
- **P0:** Ninguno confirmado por revisión estática y baseline local. Esto no equivale a certificación de producción.
- **P1:** Evidence teacher CTA roto por POST 410 (`app/evidence/EvidenceStudio.tsx:11`, `app/api/evidence/route.ts:21-24`).
- **P1:** Completion denial permanente cuando `requiresEvidence` sigue verdadero tras submit (`components/activities/ActivityRenderer.tsx:28`).
- **P1:** Evaluaciones con draft/tenant/rubric/criterion/scores sin invariantes y escrituras no transaccionales (`app/api/evaluations/route.ts:23-36`).
- **P1:** Credential issuance global y sin enrollment activo; SHA-256 no autentica issuer; verify UI ausente (`app/api/credentials/route.ts:16-23`, `app/api/credentials/verify/[code]/route.ts:5-10`).
- **P1:** RLS de evaluaciones/rúbricas/credenciales incompleto y no probado en Supabase real.
- **P2:** Signup registered feedback ausente y email del dashboard vacío; no son escaladas de autorización pero afectan confianza y soporte (`app/api/auth/signup/route.ts:23-27`, `app/login/AuthForm.tsx`, `app/Dashboard.tsx:16`).
