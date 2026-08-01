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

## Ruta de migración a Vercel

La aplicación usa App Router, rutas de servidor y Drizzle, todos portables a Vercel. En una migración posterior:

1. Conservar `app/`, el esquema de Drizzle y las rutas HTTP.
2. Reemplazar el adaptador D1 de `db/index.ts` por un adaptador PostgreSQL/Neon compatible con Vercel; las entidades y relaciones no cambian.
3. Sustituir los encabezados de identidad de la plataforma actual por un proveedor de autenticación elegido para producción (por ejemplo, Clerk o Auth.js), conservando el identificador estable de usuario.
4. Guardar archivos y evidencias en almacenamiento de objetos (Vercel Blob, S3 o R2) y mantener solo sus metadatos en la base de datos.
5. Definir variables de entorno por entorno y ejecutar las migraciones desde CI antes de desplegar.

No se deben exponer claves de LMS o de modelos de IA al cliente. Todas las solicitudes a proveedores externos deben pasar por rutas de servidor con controles de rol, auditoría y límites de uso.
