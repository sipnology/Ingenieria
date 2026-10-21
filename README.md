# Seguimiento de Ingeniería · Sipnology

Plataforma para que el equipo de Ingeniería (Preventa, Implementación y, próximamente, Soporte) registre sus actividades y el director tenga visibilidad de qué se está haciendo, la carga de cada persona, las fechas compromiso y lo que requiere acción suya o de otra área.

**Visibilidad, no control:** todos ven todo, cada quien actualiza lo suyo y las peticiones ("necesito algo de alguien") son el centro de la herramienta.

## Qué incluye

| Pantalla | Para qué |
|---|---|
| **Tablero · Equipo** | Indicadores, peticiones al director (con respuesta en un clic), próximas fechas compromiso, carga semanal por persona y lo que espera a otras áreas. Filtro por área. |
| **Tablero · Mi semana** | Lo que requiere atención de cada ingeniero, sus actividades, su carga y lo que espera de otros. |
| **Actividades** | Todo el equipo en tablero por estatus o en lista, con búsqueda y filtros. |
| **Nueva / editar actividad** | Área → categoría, cliente → oportunidad/proyecto (de catálogos) y horas. Mover la fecha compromiso pide justificación y autorización del director. |
| **Autorizar** | A donde lleva el botón "Autorizar" del correo: la actividad, la justificación y la decisión. |
| **Detalle** | Datos, petición y respuesta, cambio de fecha pendiente, registrar avance, completar o reabrir, bitácora. |
| **Indicadores** | Cantidad de actividades y horas por tipo de actividad, persona y cliente/proyecto, por periodo; descarga CSV. |
| **Catálogos** (director y líderes) | Categorías por área, clientes y oportunidades/proyectos: alta, edición, baja y carga masiva. |
| **Equipo** (director) | Altas desde el directorio de Entra ID (entran al grupo del sitio) y bajas por rotación con reasignación de actividades. |
| **Alertas** (director) | Reglas, destinatarios (dueño/director), canal (Teams/correo), feriados y registro de avisos. |

## Arquitectura

- **App web estática** en GitHub Pages, sin servidor ni paso de compilación (`index.html`, `src/`, `assets/`).
- **Inicio de sesión** con Entra ID (MSAL 4, incluido en `assets/vendor`).
- **Datos** en 9 listas de SharePoint (`sipnologysacv.sharepoint.com/sites/Ingenieria`), vía Microsoft Graph con los permisos de cada usuario.
- **Avisos** con GitHub Actions + credencial federada de Entra ID (sin secretos), entregados por un flujo de Power Automate: tarjeta de Teams y correo desde ingenieria@sipnology.com.mx. Solo al dueño de la actividad y al director.

```
src/
  config.js        ← lo único que se edita: inquilino, app y sitio
  schema.js        listas, columnas, catálogos y reglas de aviso
  logic.js         fechas hábiles, carga semanal, indicadores y reglas (probado con npm test)
  graph.js · sharepoint.js · auth.js · data.js
  vistas/          pantallas
avisos/            motor de avisos (Node 22, sin dependencias)
docs/INSTALACION.md
```

## Empezar

- **Ver la demo sin configurar nada:** `python3 -m http.server 8765` y abre `http://localhost:8765/?demo` (o `?demo=ingeniero`). Mientras `src/config.js` tenga valores `PENDIENTE` la app arranca en demostración.
- **Instalar en Sipnology:** sigue [docs/INSTALACION.md](docs/INSTALACION.md).
- **Pruebas:** `npm test` · `node avisos/enviar-avisos.mjs --modo=diario --demo`

## Cómo se calcula la carga

Horas pendientes = horas estimadas × (1 − avance). Se reparten en partes iguales entre las semanas que faltan para la fecha compromiso; lo vencido o sin fecha cuenta completo en la semana actual. Se compara contra la capacidad semanal de cada persona (40 h por defecto). Las horas se asignan al responsable, no a los colaboradores. Es una estimación para conversar, no un registro de horas trabajadas.
