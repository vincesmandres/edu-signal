# Execution Plan

## Propósito y guardrails

Este documento es únicamente el plan de ejecución. Tras esta entrega sólo se presenta para revisión y aprobación; **no empieza M6 hasta recibir aprobación explícita**, conforme a la primera acción acordada. No se modifica `docs/milestones/CURRENT-STATE-AUDIT.md`, ni se cambia código en esta entrega.

Orden obligatorio: **M6 PRODUCT INTEGRITY → M6.1 AUTHORIZATION HARDENING → M6.2 REAL TESTING FOUNDATION → M6.3 PRODUCTION RELIABILITY → Foundation Gate → evaluar M7**. M7 permanece bloqueado si el Foundation Gate es FAIL.

Cada milestone se implementa en commits pequeños, reversibles y con la estrategia de ramas `fix/m6-product-integrity`, `security/m6-1-authorization`, `test/m6-2-testing-foundation` e `infra/m6-3-production`, respectivamente. La rama actual es `fix/m6-product-integrity`. Foundation Gate es document-only y no crea una rama adicional. No se despliega a producción durante M6.x. Los nombres de commit propuestos son orientativos y se mantienen acotados al alcance del milestone.

## M6 PRODUCT INTEGRITY

### Objetivo

Hacer utilizable el flujo docente de evidencia sin ampliar su perímetro: inbox de evidencias `submitted` de las aulas propias, detalle, descarga firmada, evaluación mínima UI/API, y completion de actividad después de evidencia enviada. El frontend no puede hacer POST al endpoint legacy 410.

### Orden de trabajo

1. Fijar lectura server-side: el inbox devuelve sólo evidencias `submitted` de aulas del teacher; detalle y descarga no revelan recursos ajenos.
2. Implementar inbox docente, detalle y descarga firmada con expiración y ownership comprobado. La URL firmada sólo autoriza el objeto ya autorizado, nunca sustituye la autorización de aplicación.
3. Implementar evaluación mínima UI/API sobre una evidencia `submitted`, con payload y errores contractuales; no incluir aquí todas las invariantes de autorización de M6.1.
4. Cambiar `ActivityRenderer` para completar la actividad al existir evidencia `submitted` (incluido estado actualizado), manteniendo draft/no evidence como no completado.
5. Retirar el CTA o cliente que intenta el POST legacy 410 y dirigirlo al flujo vigente; añadir prueba que detecte cualquier POST frontend a ese endpoint.

### Archivos previstos

- `app/Dashboard.tsx`, `app/evidence/EvidenceStudio.tsx`, `app/evidence/page.tsx`.
- Nuevas páginas/componentes de inbox, detalle, descarga y evaluación bajo `app/evidence/` y `app/evaluations/`.
- `app/api/evidence/route.ts`, `app/api/evidence/[evidenceId]/route.ts`, `app/api/evaluations/route.ts`.
- `components/activities/ActivityRenderer.tsx`.
- Tests nuevos o modificados del flujo M6 en `tests/m6-*.test.mjs`.

No se añade firma criptográfica, issuer proof ni verify page. La descarga firmada es autorización temporal del archivo, no prueba VC.

### Tests y comandos

`npm run typecheck`; `npm run lint`; `node --test tests/m6-evidence-inbox.test.mjs tests/m6-evaluation.test.mjs`; `npm run build`; `npm run verify`.

Los tests cubren inbox/detail/download/evaluation, `submitted` versus draft, completion post-submit, aislamiento básico Teacher A/B, y ausencia de POST frontend al legacy 410. Las regex estáticas sólo son una comprobación secundaria, nunca el gate de seguridad.

### Riesgos y rollback

Riesgos: evaluar draft, filtrar evidencia de otra aula, URL firmada sin autorización previa, o regresión de completion. Mitigar con estado explícito, queries server-side y tests de actor/estado. Rollback: revertir cada commit UI/API individual; no borrar archivos ni datos históricos. Si una migración resulta imprescindible, documentar down seguro antes de aplicarla.

### Aceptación

Teacher A ve únicamente `submitted` de sus aulas, abre detalle y descarga con URL firmada; evaluación mínima funciona sólo para el flujo permitido; completion cambia tras submit; draft/no evidence no completan; el frontend no hace POST legacy 410; respuestas no filtran otro tenant. M6 PASS es requisito para M6.1.

## M6.1 AUTHORIZATION HARDENING

### Objetivo

Cerrar el bug de autorización de credenciales y hacer explícitas las invariantes de evaluación, rubric, criterios y enrollment. No convertir este milestone en implementación de VC/proof/revocation.

### Orden de trabajo

1. Exigir `classroomId` en credential issuance; comprobar que el teacher posee esa classroom y que el student tiene enrollment activo en ella. No derivar autorización desde un `studentId` global.
2. Permitir evaluaciones únicamente sobre evidencia `submitted` y cuando el teacher sea propietario de la classroom de esa evidencia.
3. Exigir que rubric y todos sus criterios pertenezcan a la misma classroom y estén bajo ownership autorizado; rechazar cross-classroom/cross-rubric.
4. Crear helpers server-side reutilizables para sesión, teacher classroom, active enrollment, evidence submitted, rubric ownership y recurso contextual. Las rutas deben usar los helpers, no duplicar checks incompletos.
5. Validar que los criterios enviados sean exactamente los de la rubric: sin faltantes, extras ni duplicados; validar score permitido, rangos y tipos.
6. Usar transacción/atomicidad cuando una emisión o evaluación escriba varias filas, scores, auditoría o relaciones: ante cualquier rechazo no quedan filas parciales; conflictos concurrentes devuelven `409`.
7. Ejecutar matriz adversarial completa con Teacher A/B y Student A/B, incluyendo archivos privados y Storage.

### Archivos previstos

- `app/api/credentials/route.ts`, `app/api/evaluations/route.ts`, `app/api/rubrics/route.ts`.
- Helpers nuevos bajo `lib/auth/` o `lib/authorization/`, y schema/migraciones sólo si una invariantes lo exige.
- Policies/migraciones Supabase y Drizzle correspondientes, sin editar migraciones ya aplicadas.
- `tests/m6.1-authorization.test.mjs`, `tests/m6.1-evaluation-invariants.test.mjs` y fixtures de actores.

### Tests y comandos

`npm run typecheck`; `npm run lint`; `node --test tests/m6.1-authorization.test.mjs tests/m6.1-evaluation-invariants.test.mjs`; `npm run build`; `npm run verify`; en entorno DB de prueba, `npm run db:migrate` y `npm run auth:seed`.

Probar HTTP autenticado y DB real cuando el entorno esté disponible: Teacher A/B, Student A/B, enrollment activo/inactivo, aula/rubric/criterion cruzados, archivos privados y rollback transaccional forzado.

### Riesgos y rollback

Riesgos: romper filas históricas, policy que impida al adapter operar, carrera que produzca orphan scores, o confundir signed download con proof. Mitigar con rehearsal sobre snapshot, constraints compatibles y transacciones probadas. Rollback: desactivar rutas nuevas/feature flag y revertir helpers/policies de forma independiente; no revocar credenciales ni borrar evaluaciones existentes sin decisión explícita.

### Aceptación

Issuance exige `classroomId`, teacher ownership y active enrollment; evaluaciones sólo son de evidencia `submitted` y teacher-owned; rubric/criteria son same-classroom y owned; criteria son exactamente los esperados y scores cumplen rango/sin duplicados; operaciones multi-fila son atómicas; matriz adversarial, incluidos archivos privados, pasa sin side-channel.

La autenticación del credential bug queda cerrada aquí. VC, issuer cryptographic proof, revocation y página pública de verify pertenecen a **M9**, no a ningún M6.x. La URL 404 actual queda como deuda priorizada; no se presenta como proof funcional.

## M6.2 REAL TESTING FOUNDATION

### Objetivo

Construir una base de pruebas real y reproducible. Las pruebas regex/static permanecen como secundarias y no pueden declarar seguridad o Foundation PASS.

### Orden de trabajo

1. Añadir unit tests de evidence, roles, status y scores, incluyendo límites, duplicados y transiciones inválidas.
2. Añadir integración HTTP API con sesiones/roles reales o fixtures de autenticación equivalentes, verificando contratos y códigos.
3. Añadir integración PostgreSQL/Supabase DB contra base de prueba real, migraciones, constraints, transactions y fixtures controladas.
4. Hacer obligatorias las pruebas RLS real con JWT de Teacher A/B y Student A/B, incluyendo Storage/private files; no simular RLS con mocks.
5. Añadir golden path Playwright: student crea/submits evidence → teacher ve inbox → abre detalle → descarga → evalúa → student ve completion.
6. Hacer `npm run verify` parte del gate y conservar tests static regex sólo como señal complementaria.

### Archivos previstos

`tests/unit/` o tests unitarios existentes para evidence/roles/status/scores; `tests/integration/http/`; `tests/integration/db/`; fixtures Auth/RLS; `playwright.config.*`; `tests/e2e/golden-path.spec.*`; scripts de seed y configuración de test. No cambiar `CURRENT-STATE-AUDIT.md`.

### Tests y comandos

`npm ci`; `npm run typecheck`; `npm run lint`; `npm test`; `npm run verify`; `npx playwright test`; `npm run db:migrate`; `npm run auth:seed`.

En CI/entorno Supabase, ejecutar integración PostgreSQL, RLS y Storage contra un proyecto/base de prueba real. Documentar variables y cleanup; nunca usar producción.

### Riesgos y rollback

Riesgos: tests verdes por mocks, RLS divergente, flaky Playwright o fixtures no representativas. Mitigar separando unit/HTTP/DB/RLS/E2E y repitiendo golden path. Rollback: revertir tests/configuración sin retirar protección de producción; aislar temporalmente un test flaky con causa documentada, sin convertirlo en skip silencioso.

### Aceptación

Existe cobertura unitaria evidence/roles/status/scores, integración HTTP, integración PostgreSQL/Supabase, RLS real obligatoria con los cuatro actores y archivos privados, golden path Playwright reproducible y `npm run verify` PASS. Static regex no sustituye ninguna de ellas.

## M6.3 PRODUCTION RELIABILITY

### Objetivo

Hacer reproducible la validación de producción y observable el sistema sin desplegarlo. No se ejecuta deploy real.

### Orden de trabajo

1. Crear `.github/workflows/ci.yml` con Node 22, cache, `typecheck`, `lint`, unit, integration, build y Cloudflare dry-run; fijar orden y artefactos suficientes para diagnosticar fallos.
2. Crear `docs/production/branch-protection.md` con checks obligatorios, revisión requerida y regla de no merge si falla seguridad/integración.
3. Crear `scripts/smoke-production.ts` para smoke seguro, read-only o explícitamente no destructivo, sin secretos en salida ni mutaciones de producción por defecto.
4. Añadir structured safe logging/observability: correlation/request id, evento, actor clasificado, status y duración; redactar tokens, URLs firmadas, PII y SQL sensible.
5. Separar `npm run build` y Cloudflare dry-run; el workflow no hace deploy real ni convierte una variable ausente en PASS.

### Archivos previstos

`.github/workflows/ci.yml`; `docs/production/branch-protection.md`; `scripts/smoke-production.ts`; helpers de logging/observability; configuración necesaria de Cloudflare y tests de health/log schema.

### Tests y comandos

`npm ci`; `npm run typecheck`; `npm run lint`; `npm test`; `npm run verify`; `npm run build`; comando exacto de dry-run configurado por el proyecto (por ejemplo `npm run cf:build -- --dry-run` si existe); `npx tsx scripts/smoke-production.ts --dry-run`.

El workflow debe ejecutar Node 22 y todos los checks indicados; el smoke sólo se ejecuta con entorno explícito y seguro. No se ejecuta deploy real en M6.3.

### Riesgos y rollback

Riesgos: Node/cache divergente, logs con secretos, smoke destructivo, Cloudflare toolchain ausente o CI que da falso PASS. Mitigar con redaction tests, `--dry-run`, permisos mínimos y checks explícitos. Rollback: revertir workflow, documentación, smoke y logging en commits separados; no revertir migraciones aplicadas.

### Aceptación

`ci.yml` existe y ejecuta Node 22/cache/typecheck/lint/unit/integration/build/Cloudflare dry-run; branch protection está documentada; smoke production es seguro; logs son estructurados y redacted; no ocurrió deploy real.

## Foundation Gate

No es un milestone funcional. Se ejecuta sólo después de M6.3 y produce `docs/milestones/FOUNDATION-GATE.md`.

### Criterio PASS obligatorio

PASS sólo puede escribirse cuando el golden path Playwright completo y la seguridad estén cubiertos: M6 funcional, M6.1 de autorización/atomicidad, M6.2 HTTP/DB/RLS/Storage y `npm run verify` deben estar verdes en el commit evaluado. El gate debe adjuntar commit, comandos, entorno de prueba y evidencia de la matriz adversarial. Si falta golden path o seguridad cubierta, el resultado es FAIL.

Checklist: `npm ci` con Node 22; typecheck/lint/unit/integration/build; `npm run verify`; migraciones DB de prueba; RLS real y private files con Teacher A/B/Student A/B; golden path Playwright; CI y logs revisados; smoke/dry-run sin deploy.

Resultado: PASS permite únicamente evaluar M7. FAIL mantiene M7 bloqueado y exige registrar causa y rollback/acción correctiva; nunca se sustituye por deploy productivo.

## Contratos HTTP

Aplican a M6 y M6.1, salvo el endpoint legacy explícitamente retirado/documentado.

| Código | Contrato |
|---|---|
| 400 | JSON inválido o campo sintácticamente ausente/mal formado. |
| 401 | Sesión ausente, expirada o no autenticada. |
| 403 | Identidad válida sin ownership, classroom o enrollment autorizado; sin datos del recurso ajeno. |
| 404 | Recurso inexistente en el contexto autorizado; recurso ajeno puede responder igual para evitar side-channel. |
| 409 | Estado concurrente, duplicado o idempotencia conflictiva; no deja escrituras parciales. |
| 422 | Payload válido pero dominio inválido: draft, enrollment inactivo, rubric/criterion cruzado, criteria incompletos/extras/duplicados o score fuera de rango. |
| 500 | Error inesperado con JSON genérico y correlation id sólo en logs seguros. |

Endpoints mínimos: `GET /api/evidence?status=submitted&classroomId=...` (teacher-owned), `GET /api/evidence/:evidenceId`, descarga firmada derivada del recurso autorizado, y evaluación `POST /api/evaluations`. Credential issuance exige `classroomId`. El POST legacy 410 no es contrato del frontend.

## Matriz adversarial

| Actor | Acción | Resultado esperado |
|---|---|---|
| Teacher A | Lee inbox/detalle/descarga/evalúa evidence submitted de classroom A | 200/201; sólo datos de A. |
| Teacher A | Accede a evidence de classroom B | 403/404 contextual; cero metadata, URL o archivo. |
| Teacher A | Emite credential sin `classroomId`, para aula ajena o student sin active enrollment | 400/403/422; cero filas. |
| Teacher A | Usa rubric/criteria de B o criteria incompletos/extras/duplicados | 403/422; cero filas parciales. |
| Teacher B | Repite acciones sobre classroom A | 403/404; sin side-channel. |
| Student A | Lee/edita/submits su evidence con active enrollment | 200/201; draft editable, submitted con regla de inmutabilidad. |
| Student A | Lee o descarga evidence/private file de Student B o classroom B | 403/404; Storage también deniega. |
| Student B | Completa actividad, obtiene URL o carga objeto de classroom A | 403/404; sin metadata ni archivo. |
| Student A | Opera con enrollment inactive | 403/422; aunque conozca IDs. |
| Cualquier actor | Fuerza error a mitad de evaluación/emisión | 409/422/500 según caso; rollback completo, sin orphan rows. |

## Dependencias, infraestructura y rollback global

Sin infraestructura externa se pueden revisar contratos, validadores, UI, unit/static tests, typecheck, lint, build y documentación. PostgreSQL/Supabase test env es obligatorio para integración DB, Auth/JWT, RLS, Storage y matriz adversarial. Cloudflare sólo para dry-run configurado. Ningún secreto ni producción es requisito para fingir PASS.

Rollback global: cada rama se revierte por commits pequeños; migraciones aplicadas no se borran ni se editan, y cualquier desactivación usa migration/feature flag reversible. M7 no se inicia tras FAIL.

## Estrategia de commits

- `m6: add submitted teacher evidence inbox and detail`
- `m6: add signed download and minimal evaluation flow`
- `m6: allow completion after submitted evidence`
- `m6.1: require classroom ownership and active enrollment`
- `m6.1: enforce rubric criteria and score invariants atomically`
- `m6.1: add adversarial teacher student private-file coverage`
- `m6.2: add unit http db and real rls foundation`
- `m6.2: add playwright golden path and verify gate`
- `m6.3: add node22 ci and cloudflare dry-run`
- `m6.3: add production smoke branch protection and safe logging`
- `m6: record foundation gate result`

Cada commit debe pasar los checks aplicables, referir su rama correspondiente y excluir M7, VC/proof/revocation/verify page.
