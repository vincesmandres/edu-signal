# Arquitectura inicial de Edu Signal

Edu Signal separa el producto en dominios para que la interfaz, la base de datos y las integraciones puedan evolucionar sin cambiar el lenguaje pedagógico ni los identificadores de las entidades.

## Dominios actuales

- **Identidad y roles:** el usuario autenticado crea su perfil docente. Los roles previstos son docente, coordinador, estudiante y administrador.
- **Aulas:** cada aula pertenece a una asignatura, un período académico y un docente responsable.
- **Diseño pedagógico:** un aula puede contener módulos. Cada módulo almacena una pregunta guía, sus metodologías (ABP, ABR y/o PhET) y su estado de diseño.
- **Evaluación:** las evaluaciones pertenecen a un módulo y registran formato y criterio observable. Rúbricas, evidencias y calificaciones crecerán sobre esta relación.
- **IA e integraciones:** se consumirán desde rutas de servidor, nunca desde el navegador. Los proveedores de LMS, simuladores, modelos de IA y credenciales se implementarán como adaptadores por integración.

## Contratos pedagógicos

Un módulo mantiene una pregunta guía y una lista explícita de metodologías. Esto permite que un asistente de IA genere propuestas verificables contra una estructura estable:

- **ABP:** reto, producto público, hitos, reflexión y evidencia.
- **ABR:** reto contextual, investigación, decisiones y acción.
- **PhET:** predicción, exploración guiada, explicación y transferencia desde simulaciones.

La IA debe sugerir contenidos, criterios y secuencias; la publicación y la calificación final seguirán siendo decisiones del docente.

## Ruta de migración a Supabase y Vercel

La aplicación usa App Router, rutas de servidor y Drizzle. M0 deja PostgreSQL
como fuente de verdad y mantiene el runtime Cloudflare solo como compatibilidad
temporal. Para desplegar una base nueva:

1. Configurar `DATABASE_URL` y ejecutar `npm run db:migrate` para la estructura
   generada por Drizzle.
2. Aplicar `supabase/migrations/` con la CLI de Supabase para RLS y Storage.
3. Ejecutar `npm run db:seed` únicamente en entornos de desarrollo.
4. Conservar `app/`, el esquema de Drizzle y las rutas HTTP; las entidades y
   relaciones no cambian.
5. Migrar los encabezados de identidad y sesiones actuales a Supabase Auth,
   conservando el identificador estable de usuario (M1).
6. Mantener archivos y evidencias en el bucket privado de Supabase Storage y
   solo sus metadatos en PostgreSQL.

No se deben exponer claves de LMS o de modelos de IA al cliente. Todas las solicitudes a proveedores externos deben pasar por rutas de servidor con controles de rol, auditoría y límites de uso.
