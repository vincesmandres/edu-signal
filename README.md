# Edu Signal

Edu Signal es una plataforma open source orientada a estandarizar procesos, evidencias y calificaciones educativas con enfoque STEAM, incorporando privacidad y verificacion basada en pruebas de conocimiento cero (zk) para facilitar la validacion confiable de trayectorias educativas.

El proyecto esta en una etapa inicial. Este README define la vision, el alcance funcional esperado y una hoja de ruta base para avanzar con el desarrollo.

## Proposito

Los sistemas educativos suelen registrar aprendizajes, evaluaciones y certificaciones en formatos aislados, dificiles de comparar y validar. Edu Signal busca ofrecer una capa comun para documentar evidencias educativas, convertirlas en senales verificables y permitir que estudiantes, docentes e instituciones compartan logros sin exponer informacion sensible innecesaria.

## Objetivos

- Estandarizar procesos de evaluacion y calificacion educativa.
- Registrar evidencias de aprendizaje vinculadas a competencias STEAM.
- Facilitar la validacion de logros academicos y formativos.
- Proteger la privacidad de estudiantes mediante mecanismos de verificacion zk.
- Construir una base abierta para integraciones con instituciones, plataformas educativas y futuros sistemas de credenciales.

## Alcance Inicial

Edu Signal puede evolucionar como una plataforma modular con los siguientes componentes:

- **Gestion de estudiantes:** perfiles, cohortes, instituciones y contexto academico.
- **Rubricas y competencias:** definicion de criterios de evaluacion, niveles de desempeno y competencias STEAM.
- **Evidencias educativas:** registro de proyectos, actividades, entregables, resultados y retroalimentacion.
- **Calificaciones estandarizadas:** normalizacion de escalas, historiales y reportes comparables.
- **Credenciales verificables:** emision y validacion de logros educativos.
- **Privacidad zk:** pruebas verificables que permitan confirmar atributos o resultados sin revelar todos los datos originales.

## Casos de Uso

- Un docente registra una rubrica STEAM y evalua proyectos de estudiantes.
- Una institucion consolida calificaciones y evidencias bajo un formato comun.
- Un estudiante comparte una prueba verificable de una competencia alcanzada.
- Un tercero valida una credencial educativa sin acceder al expediente completo.

## Principios del Proyecto

- **Open source:** el codigo y la evolucion del proyecto deben ser auditables y reutilizables.
- **Privacidad por diseno:** la informacion educativa debe compartirse solo cuando sea necesario.
- **Interoperabilidad:** los datos deben poder integrarse con otras plataformas educativas.
- **Estandarizacion:** los procesos deben ser claros, repetibles y comparables.
- **Enfoque STEAM:** ciencia, tecnologia, ingenieria, artes y matematicas como marco formativo central.

## Hoja de Ruta

### Fase 1: Fundacion

- Definir modelo de datos inicial.
- Documentar roles principales: estudiante, docente, institucion y validador.
- Crear estructura base del proyecto.
- Seleccionar stack tecnologico.
- Definir convenciones de desarrollo y contribucion.

### Fase 2: Producto Minimo Viable

- Implementar autenticacion y gestion basica de usuarios.
- Crear modulo de rubricas.
- Registrar evidencias de aprendizaje.
- Generar reportes simples de evaluacion.
- Preparar API inicial para consulta y validacion.

### Fase 3: Verificacion y Privacidad

- Definir el modelo de credenciales verificables.
- Integrar pruebas zk para validacion selectiva de atributos.
- Crear flujos de emision, presentacion y verificacion.
- Documentar amenazas, limites y supuestos de seguridad.

### Fase 4: Integraciones

- Explorar integracion con LMS, sistemas institucionales y wallets de credenciales.
- Exportar datos en formatos interoperables.
- Agregar tableros para instituciones y validadores.

## Estructura Sugerida del Repositorio

```text
edu-signal/
|-- docs/              # Documentacion tecnica y funcional
|-- apps/              # Aplicaciones frontend/backend si se usa monorepo
|-- packages/          # Librerias compartidas
|-- contracts/         # Circuitos, contratos o componentes zk
|-- tests/             # Pruebas automatizadas
|-- README.md
`-- LICENSE
```

Esta estructura es una propuesta inicial y puede ajustarse cuando se defina el stack tecnologico.

## Estado Actual

El proyecto se encuentra en fase de definicion. Aun no hay una implementacion funcional publicada en este repositorio.

## Como Contribuir

1. Revisa la vision y la hoja de ruta.
2. Abre un issue con una propuesta concreta o una pregunta tecnica.
3. Trabaja en cambios pequenos y bien documentados.
4. Incluye pruebas o ejemplos cuando el cambio afecte comportamiento del sistema.
5. Manten la discusion enfocada en privacidad, estandarizacion e interoperabilidad educativa.

## Licencia

Este proyecto esta publicado bajo la licencia GNU General Public License v3.0. Consulta el archivo [LICENSE](LICENSE) para mas detalles.
