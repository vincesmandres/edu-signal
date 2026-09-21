# M6 Product Integrity

## Objetivo

Hacer utilizable el flujo docente de evidencias enviadas: inbox aislado por aula, detalle protegido, descarga firmada, evaluación mínima y completion después de `submitted`.

## Problemas resueltos

- `/evidence` ya no crea evidencias ni hace POST al endpoint legacy 410.
- El inbox consulta únicamente evidencias `submitted` de aulas del docente y ordena por `submittedAt` descendente.
- El detalle y la descarga exigen ownership docente; el detalle no expone `storageKey`.
- Evaluación valida estado, ownership, rúbrica/criterios, rangos, duplicados y escribe filas en transacción.
- La creación de evaluación y `evaluation.created` se escriben en la misma transacción; un fallo de auditoría revierte toda la operación.
- Una rúbrica seleccionada sin criterios se rechaza con `422`; la evaluación global es el único fallback sin rúbrica.
- `ActivityRenderer` desbloquea completion tras submit y conserva bloqueados drafts/no evidence.
- Upload, submit y completion quedan deshabilitados durante operaciones concurrentes relevantes.

## Archivos y decisiones

Se modificaron `app/evidence/EvidenceStudio.tsx`, `app/evidence/[evidenceId]/*`, `app/api/evidence/*`, `app/api/evaluations/route.ts`, `components/activities/ActivityRenderer.tsx`, `app/Dashboard.tsx`, `lib/evaluation-validation.ts`, `package.json` y las pruebas M6. Se añadió `drizzle-postgres/0004_m6_evaluation_integrity.sql` y el snapshot `drizzle-postgres/meta/0004_snapshot.json` generado por `drizzle-kit`, con entrada de journal y preflight que aborta si ya existen duplicados por `evidence_id`; el rollback seguro antes de cualquier dato nuevo es eliminar el índice único. La evaluación global se exige sin rúbrica y acepta sólo decimal canónico 0-100; los scores con rúbrica exigen todos sus criterios.

## Tests y comandos

- `npm run typecheck`: PASS.
- `npm run test:m6`: PASS (8 tests, incluyendo validadores reales, auditoría transaccional, accesibilidad UI y preflight de migración).
- `npx drizzle-kit generate` aislado: generó snapshot válido desde `db/schema.ts`; el snapshot incluye `uq_evaluations_evidence` como índice único.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS con 4 warnings preexistentes de navegación interna.
- `npm test`: PASS (build + 17 tests baseline + 7 tests M6).
- `npm run verify`: PASS (typecheck, lint, 17 tests baseline, 7 tests M6 y build).
- `npm run build`: PASS (warning preexistente de `metadataBase`).
- `git diff --check`: PASS (sólo warnings de conversión de finales de línea de Git).

## Bugs pendientes y riesgos

No se ejecutó preflight contra una base real y no se afirma cobertura Teacher A/B real. La validación HTTP/DB/RLS/Storage real, la matriz adversarial completa y E2E pertenecen a M6.2. La migración debe ejecutarse primero en staging: si el preflight detecta duplicados, resolverlos con una decisión explícita antes de crear el índice; no elimina filas automáticamente. La página de detalle usa fetch server-side con cookie reenviada y requiere `NEXT_PUBLIC_APP_URL` correcto en despliegues no locales. No se implementan M6.1 completo, M7 ni credentials crypto.

## Resultado

**PASS local condicionado:** los tests de validadores/wiring y gates locales deben quedar verdes en la ejecución final. No es PASS de integración, RLS, Storage, Teacher A/B ni E2E; M6.2 añadirá esas pruebas reales.
