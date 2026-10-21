// Definición de las listas de SharePoint que usa la plataforma.
// La comparten la app web (configuración inicial) y el motor de avisos.
// Los nombres internos de columna no llevan acentos ni espacios a propósito.

export const AREAS = ['Preventa', 'Implementación', 'Soporte'];

// Catálogo inicial de categorías por área. Después se edita desde la pantalla Catálogos.
export const CATEGORIAS_INICIALES = {
  'Preventa': [
    'Análisis de bases de licitación',
    'Preguntas para junta de aclaraciones',
    'Estudio / análisis de requerimientos',
    'Levantamiento / visita técnica',
    'Site survey (RF, cableado, energía)',
    'Dimensionamiento',
    'Diseño / arquitectura de solución',
    'BOM y licenciamiento',
    'Cotización con fabricante / mayorista',
    'Registro de oportunidad con fabricante',
    'Comparativa de soluciones',
    'Propuesta técnica',
    'Anexo técnico / matriz de cumplimiento',
    'Presentación / defensa técnica',
    'Demo / prueba de concepto (POC)',
    'Apoyo a Comercial',
    'Capacitación / certificación',
    'Interno / administrativo',
  ],
  'Implementación': [
    'Kickoff / planeación',
    'Levantamiento previo',
    'Ingeniería de detalle (LLD)',
    'Staging / preconfiguración',
    'Instalación física',
    'Configuración',
    'Migración',
    'Ventana de cambio',
    'Pruebas de aceptación (ATP)',
    'Documentación / memoria técnica (as-built)',
    'Capacitación / transferencia de conocimiento',
    'Seguimiento con fabricante (TAC)',
    'Cierre y entrega',
    'Interno / administrativo',
  ],
  'Soporte': [
    'Incidente',
    'Requerimiento de servicio',
    'Mantenimiento preventivo',
    'Mantenimiento correctivo',
    'Actualización de firmware / software',
    'Escalamiento a fabricante (TAC)',
    'Revisión de salud / monitoreo',
    'Atención en sitio',
    'Reporte de servicio',
    'Interno / administrativo',
  ],
};

export const ESTATUS = ['Sin iniciar', 'En curso', 'En espera', 'Bloqueada', 'Completada', 'Cancelada'];
export const ESTATUS_CERRADOS = ['Completada', 'Cancelada'];
export const PRIORIDADES = ['Baja', 'Media', 'Alta'];
// "Requiere acción de": solo el Director recibe aviso. Las demás son una marca de seguimiento.
export const ACCION_DE = ['Director', 'Comercial', 'PMO', 'Compras', 'Fabricante', 'Cliente', 'Otra área'];
export const ROLES = ['Ingeniero', 'Líder', 'Director'];
export const TIPOS_BITACORA = ['Creación', 'Avance', 'Cambio de fecha', 'Cambio de estatus', 'Acción', 'Respuesta', 'Sistema'];
export const ESTATUS_SOLICITUD = ['Pendiente', 'Autorizada', 'Rechazada'];

// Nombres de las listas (displayName en SharePoint)
export const LISTAS = {
  actividades: 'Actividades',
  bitacora: 'Bitacora',
  equipo: 'Equipo',
  categorias: 'Categorias',
  clientes: 'Clientes',
  proyectos: 'Proyectos',
  solicitudes: 'SolicitudesFecha',
  configuracion: 'Configuracion',
  notificaciones: 'Notificaciones',
};

// Tipos de columna -> definición de Graph (columnDefinition)
const text = (name, displayName, extra = {}) => ({ name, displayName, text: { ...extra } });
const note = (name, displayName) => ({ name, displayName, text: { allowMultipleLines: true, linesForEditing: 6 } });
const choice = (name, displayName, choices) => ({ name, displayName, choice: { choices, displayAs: 'dropDownMenu', allowTextEntry: false } });
const number = (name, displayName, extra = {}) => ({ name, displayName, number: { decimalPlaces: 'automatic', ...extra } });
const date = (name, displayName) => ({ name, displayName, dateTime: { format: 'dateOnly', displayAs: 'standard' } });
const dateTime = (name, displayName) => ({ name, displayName, dateTime: { format: 'dateTime', displayAs: 'standard' } });
const bool = (name, displayName) => ({ name, displayName, boolean: {} });
const indexado = (col) => ({ ...col, indexed: true });

export const ESQUEMA = {
  [LISTAS.actividades]: {
    descripcion: 'Actividades del área de Ingeniería',
    columnas: [
      choice('Area', 'Área', AREAS),
      number('CategoriaId', 'Categoría (ID)'),
      text('Categoria', 'Categoría'),
      number('ClienteId', 'Cliente (ID)'),
      text('Cliente', 'Cliente'),
      number('ProyectoId', 'Oportunidad / proyecto (ID)'),
      text('Proyecto', 'Oportunidad / proyecto'),
      text('ResponsableEmail', 'Responsable (correo)'),
      text('ResponsableNombre', 'Responsable'),
      text('Colaboradores', 'Colaboradores (correos)', { maxLength: 255 }),
      date('FechaInicio', 'Fecha de inicio'),
      date('FechaCompromiso', 'Fecha compromiso'),
      number('HorasEstimadas', 'Horas estimadas', { minimum: 0 }),
      choice('Estatus', 'Estatus', ESTATUS),
      number('Avance', 'Avance (%)', { minimum: 0, maximum: 100 }),
      choice('Prioridad', 'Prioridad', PRIORIDADES),
      note('Descripcion', 'Descripción'),
      bool('RequiereAccion', 'Requiere acción'),
      choice('AccionDe', 'Requiere acción de', ACCION_DE),
      text('AccionDetalle', 'Qué se necesita', { maxLength: 255 }),
      date('AccionFecha', 'Se necesita para'),
      bool('AccionResuelta', 'Acción resuelta'),
      note('AccionRespuesta', 'Respuesta'),
      text('EnlaceCarpeta', 'Carpeta / enlace', { maxLength: 255 }),
      dateTime('UltimaActualizacion', 'Última actualización'),
      date('FechaCompletada', 'Fecha de cierre'),
    ],
  },
  [LISTAS.bitacora]: {
    descripcion: 'Bitácora de avances y cambios por actividad',
    columnas: [
      indexado(number('ActividadId', 'Actividad (ID)')),
      choice('TipoEntrada', 'Tipo', TIPOS_BITACORA),
      note('Texto', 'Texto'),
      text('AutorEmail', 'Autor (correo)'),
      text('AutorNombre', 'Autor'),
    ],
  },
  [LISTAS.equipo]: {
    descripcion: 'Integrantes de Ingeniería (enlazados con Entra ID), rol y capacidad semanal',
    columnas: [
      text('Email', 'Correo'),
      text('UPN', 'Usuario de inicio de sesión'),
      text('EntraId', 'Id. en Entra ID'),
      choice('Area', 'Área', AREAS),
      choice('Rol', 'Rol', ROLES),
      number('CapacidadHoras', 'Capacidad semanal (h)', { minimum: 0 }),
      bool('Activo', 'Activo'),
    ],
  },
  [LISTAS.categorias]: {
    descripcion: 'Catálogo de categorías de actividad por área (Title = categoría)',
    columnas: [
      choice('Area', 'Área', AREAS),
      number('Orden', 'Orden'),
      bool('Activo', 'Activo'),
    ],
  },
  [LISTAS.clientes]: {
    descripcion: 'Catálogo de clientes (Title = nombre)',
    columnas: [
      bool('Activo', 'Activo'),
    ],
  },
  [LISTAS.proyectos]: {
    descripcion: 'Catálogo de oportunidades y proyectos por cliente (Title = nombre)',
    columnas: [
      number('ClienteId', 'Cliente (ID)'),
      text('Cliente', 'Cliente'),
      bool('Activo', 'Activo'),
    ],
  },
  [LISTAS.solicitudes]: {
    descripcion: 'Solicitudes de cambio de fecha compromiso (requieren autorización del director)',
    columnas: [
      indexado(number('ActividadId', 'Actividad (ID)')),
      date('FechaActual', 'Fecha compromiso actual'),
      date('FechaPropuesta', 'Fecha propuesta'),
      note('Justificacion', 'Justificación'),
      text('SolicitanteEmail', 'Solicitante (correo)'),
      text('SolicitanteNombre', 'Solicitante'),
      choice('Estatus', 'Estatus', ESTATUS_SOLICITUD),
      text('ResueltoPorEmail', 'Resuelto por (correo)'),
      text('ResueltoPorNombre', 'Resuelto por'),
      dateTime('FechaResolucion', 'Fecha de resolución'),
      note('Comentario', 'Comentario del director'),
      bool('CorreoEnviado', 'Correo de autorización enviado'),
    ],
  },
  [LISTAS.configuracion]: {
    descripcion: 'Parámetros de la plataforma (Title = clave)',
    columnas: [
      note('Valor', 'Valor (JSON)'),
    ],
  },
  [LISTAS.notificaciones]: {
    descripcion: 'Cola y registro de avisos. Un flujo de Power Automate entrega cada elemento nuevo por Teams y/o correo.',
    columnas: [
      number('ActividadId', 'Actividad (ID)'),
      text('Regla', 'Regla'),
      text('Destinatario', 'Destinatario'),
      text('Canal', 'Canal'),
      text('Asunto', 'Asunto', { maxLength: 255 }),
      note('Html', 'Correo (HTML)'),
      note('Tarjeta', 'Tarjeta de Teams (JSON)'),
      bool('EnviarTeams', 'Enviar por Teams'),
      bool('EnviarCorreo', 'Enviar por correo'),
      choice('Estado', 'Estado', ['Pendiente', 'Enviado', 'Error']),
      indexado(dateTime('Enviado', 'Registrado')),
    ],
  },
};

// Reglas de aviso. Todas van al dueño de la actividad y/o al director; nunca a otras personas.
// modo = en qué corrida programada se evalúan (ver .github/workflows/avisos.yml).
export const REGLAS = [
  { id: 'porVencer', nombre: 'Vence mañana', detalle: 'A las 12:00 del día hábil anterior a la fecha compromiso', modo: 'mediodia', destinatarios: { responsable: true, director: true }, editable: true },
  { id: 'vencida', nombre: 'Actividad vencida', detalle: 'Desde el primer día de atraso, cada día hábil a las 9:00', modo: 'diario', destinatarios: { responsable: true, director: true }, editable: true },
  { id: 'sinActualizar', nombre: 'Sin actualización', detalle: 'Si la actividad no se actualiza en N días hábiles', modo: 'diario', destinatarios: { responsable: true, director: true }, editable: true, parametros: { diasHabiles: 5 } },
  { id: 'sobrecarga', nombre: 'Carga por encima de capacidad', detalle: 'Cuando alguien supera su capacidad semanal (una vez por semana)', modo: 'diario', destinatarios: { responsable: true, director: true }, editable: true },
  { id: 'accionDirector', nombre: 'Petición al director', detalle: 'En cuanto alguien marca que necesita algo del director', modo: 'eventos', destinatarios: { responsable: false, director: true }, editable: false },
  { id: 'accionRespondida', nombre: 'Petición respondida', detalle: 'Al dueño cuando el director responde su petición', modo: 'eventos', destinatarios: { responsable: true, director: false }, editable: false },
  { id: 'solicitudFecha', nombre: 'Solicitud de cambio de fecha', detalle: 'Correo con botón Autorizar. La plataforma lo encola al momento; esta regla solo lo reintenta si no se encoló', modo: 'eventos', destinatarios: { responsable: false, director: true }, editable: false, canalFijo: 'correo' },
  { id: 'fechaResuelta', nombre: 'Cambio de fecha autorizado o rechazado', detalle: 'Al dueño cuando el director resuelve su solicitud', modo: 'eventos', destinatarios: { responsable: true, director: false }, editable: false },
  { id: 'resumenSemanal', nombre: 'Resumen semanal', detalle: 'Lunes por la mañana: al director el panorama y a cada ingeniero solo lo suyo', modo: 'semanal', destinatarios: { responsable: true, director: true }, editable: true },
];

export function reglasPorDefecto() {
  const out = {};
  for (const r of REGLAS) out[r.id] = { activa: true, canal: r.canalFijo || 'ambos', ...r.destinatarios, ...(r.parametros || {}) };
  return out;
}

export const CONFIG_DEFECTO = {
  reglas: reglasPorDefecto(),
  capacidadDefecto: 40,
  zonaHoraria: 'America/Mexico_City',
  diasFeriados: [], // ['2026-11-16', ...] — no cuentan como días hábiles
};
