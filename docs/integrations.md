# Integraciones educativas

Edu Signal expone una exportación de interoperabilidad de solo lectura en:

`GET /api/integrations/oneroster`

La respuesta requiere una sesión de docente y contiene `users`, `classes` y
`enrollments`, usando los IDs internos estables como `sourcedId`. Esto permite
conectar un LMS mediante un conector propio sin exponer datos de otro docente.

La ruta no pretende sustituir todavía un proveedor OneRoster OAuth. Para una
integración administrada con Google Classroom, Moodle o Canvas faltan las
credenciales OAuth del centro, el mapeo de campos y la política de sincronización
(unidireccional o bidireccional). La exportación es el contrato inicial para
implementar ese conector de forma segura.
