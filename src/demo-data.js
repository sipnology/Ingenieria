// Datos de ejemplo para el modo demostración. Las fechas se calculan respecto a hoy
// para que el tablero siempre se vea "vivo". Nada de esto se guarda en ningún lado.

import { sumarDias, inicioSemana, fechaCorta } from './logic.js';
import { reglasPorDefecto, CATEGORIAS_INICIALES } from './schema.js';

const DOMINIO = 'sipnology.com.mx';

/** Directorio de Entra ID simulado (para buscar y agregar personas en la demo). */
export function directorioDemo() {
  return [
    ['Fernando Fernández', 'fernando.fernandez'], ['Ana R.', 'ana.r'], ['Diego S.', 'diego.s'], ['Jorge H.', 'jorge.h'],
    ['Luis M.', 'luis.m'], ['Carla T.', 'carla.t'], ['Paola V.', 'paola.v'], ['Ricardo G.', 'ricardo.g'],
    ['Mariana L.', 'mariana.l'], ['Sofía P.', 'sofia.p'], ['Andrés C.', 'andres.c'],
  ].map(([nombre, u], i) => ({ entraId: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`, nombre, email: `${u}@${DOMINIO}`, upn: `${u}@${DOMINIO}` }));
}

export function semillaDemo(hoy, usuario) {
  const d = (n) => sumarDias(hoy, n);
  const hace = (dias, hora = 16) => new Date(`${sumarDias(hoy, -dias)}T${String(hora).padStart(2, '0')}:00:00Z`).toISOString();
  const lunes = inicioSemana(hoy);
  const dir = Object.fromEntries(directorioDemo().map((x) => [x.email.split('.')[0], x]));

  const integrante = (id, clave, area, rol, capacidadHoras = 40) => ({ id, ...dir[clave], area, rol, capacidadHoras, activo: true });
  const equipo = [
    integrante(1, 'fernando', '', 'Director'),
    integrante(2, 'ana', 'Implementación', 'Ingeniero'),
    integrante(3, 'diego', 'Implementación', 'Ingeniero'),
    integrante(4, 'jorge', 'Implementación', 'Líder', 32),
    integrante(5, 'luis', 'Preventa', 'Ingeniero'),
    integrante(6, 'carla', 'Preventa', 'Ingeniero'),
    integrante(7, 'paola', 'Preventa', 'Líder'),
  ];
  const p = Object.fromEntries(equipo.map((x) => [x.nombre.split(' ')[0].toLowerCase(), x]));
  const resp = (x) => ({ responsableEmail: x.email, responsableNombre: x.nombre });

  // Catálogos
  let cid = 100;
  const categorias = [];
  for (const [area, lista] of Object.entries(CATEGORIAS_INICIALES)) lista.forEach((nombre, i) => categorias.push({ id: ++cid, nombre, area, orden: i + 1, activo: true }));
  const cat = (area, nombre) => { const c = categorias.find((x) => x.area === area && x.nombre === nombre); return { area, categoriaId: c.id, categoria: c.nombre }; };
  const clientes = ['BBVA México', '[Cliente] Retail', '[Cliente] Manufactura', '[Dependencia] Gobierno', 'Interno Sipnology'].map((nombre, i) => ({ id: 201 + i, nombre, activo: true }));
  const cli = (n) => clientes.find((x) => x.nombre === n);
  const proyectos = [
    ['ISE Sucursales', 'BBVA México'], ['ISE Áreas Centrales', 'BBVA México'], ['NaaS eventos', 'BBVA México'],
    ['WLAN estacionamientos', '[Cliente] Retail'], ['Renovación de routers', '[Cliente] Retail'], ['Red de sucursales', '[Cliente] Retail'],
    ['Campus planta norte', '[Cliente] Manufactura'], ['Póliza de soporte anual', '[Cliente] Manufactura'],
    ['Licitación hiperconvergencia', '[Dependencia] Gobierno'], ['Laboratorio interno', 'Interno Sipnology'],
  ].map(([nombre, c], i) => ({ id: 301 + i, nombre, clienteId: cli(c).id, cliente: c, activo: true }));
  const pro = (nombre) => { const x = proyectos.find((y) => y.nombre === nombre); return { clienteId: x.clienteId, cliente: x.cliente, proyectoId: x.id, proyecto: x.nombre }; };

  const base = { colaboradores: [], fechaInicio: null, horasEstimadas: 8, estatus: 'En curso', avance: 0, prioridad: 'Media', descripcion: '', requiereAccion: false, accionDe: '', accionDetalle: '', accionFecha: null, accionResuelta: false, accionRespuesta: '', enlaceCarpeta: '', fechaCompletada: null, creadoPor: '' };
  let id = 0;
  const a = (o) => ({ ...base, id: ++id, creado: hace(10), ultimaActualizacion: hace(1), ...o });

  const actividades = [
    a({ titulo: 'Propuesta técnica — WLAN estacionamientos', ...cat('Preventa', 'Propuesta técnica'), ...pro('WLAN estacionamientos'), ...resp(p.luis), colaboradores: [p.carla.email], fechaCompromiso: d(1), horasEstimadas: 24, avance: 55, prioridad: 'Alta',
      requiereAccion: true, accionDe: 'Director', accionDetalle: 'Aprobar descuento especial en servicios', accionFecha: d(0), ultimaActualizacion: hace(0, 16) }),
    a({ titulo: 'Configuración de PSN', ...cat('Implementación', 'Configuración'), ...pro('ISE Sucursales'), ...resp(p.ana), colaboradores: [p.jorge.email], fechaCompromiso: d(2), horasEstimadas: 40, avance: 60, prioridad: 'Alta',
      requiereAccion: true, accionDe: 'Director', accionDetalle: 'Definir prioridad entre ISE Sucursales y NaaS eventos (mismo ingeniero)', accionFecha: d(1) }),
    a({ titulo: 'BOM y licenciamiento C8475-G2', ...cat('Preventa', 'BOM y licenciamiento'), ...pro('Renovación de routers'), ...resp(p.carla), fechaCompromiso: d(3), horasEstimadas: 10, avance: 80 }),
    a({ titulo: 'Memoria técnica as-built — sitio Monterrey', ...cat('Implementación', 'Documentación / memoria técnica (as-built)'), ...pro('Red de sucursales'), ...resp(p.diego), fechaCompromiso: d(-4), horasEstimadas: 12, avance: 40, ultimaActualizacion: hace(7) }),
    a({ titulo: 'Pruebas de aceptación — evento piloto', ...cat('Implementación', 'Pruebas de aceptación (ATP)'), ...pro('NaaS eventos'), ...resp(p.diego), fechaCompromiso: d(3), horasEstimadas: 16, avance: 20, estatus: 'Bloqueada',
      requiereAccion: true, accionDe: 'Compras', accionDetalle: 'Llegada de equipo para el evento piloto', accionFecha: d(1), ultimaActualizacion: hace(6) }),
    a({ titulo: 'Preguntas para junta de aclaraciones', ...cat('Preventa', 'Preguntas para junta de aclaraciones'), ...pro('Licitación hiperconvergencia'), ...resp(p.paola), fechaCompromiso: d(4), horasEstimadas: 14, avance: 30 }),
    a({ titulo: 'Análisis de bases y matriz de cumplimiento', ...cat('Preventa', 'Análisis de bases de licitación'), ...pro('Licitación hiperconvergencia'), ...resp(p.paola), fechaCompromiso: d(9), horasEstimadas: 18, avance: 10 }),
    a({ titulo: 'Cierre y entrega — ISE AACC', ...cat('Implementación', 'Cierre y entrega'), ...pro('ISE Áreas Centrales'), ...resp(p.jorge), fechaCompromiso: d(6), horasEstimadas: 10, estatus: 'Sin iniciar' }),
    a({ titulo: 'Site survey RF — planta norte', ...cat('Preventa', 'Site survey (RF, cableado, energía)'), ...pro('Campus planta norte'), ...resp(p.luis), fechaInicio: d(5), fechaCompromiso: d(9), horasEstimadas: 6, estatus: 'Sin iniciar' }),
    a({ titulo: 'Dimensionamiento de póliza de soporte', ...cat('Preventa', 'Dimensionamiento'), ...pro('Póliza de soporte anual'), ...resp(p.luis), fechaCompromiso: d(7), horasEstimadas: 6, avance: 30, estatus: 'En espera',
      requiereAccion: true, accionDe: 'Comercial', accionDetalle: 'Confirmar alcance y niveles de servicio con el cliente', accionFecha: d(2) }),
    a({ titulo: 'Migración de políticas — ventana nocturna', ...cat('Implementación', 'Ventana de cambio'), ...pro('ISE Sucursales'), ...resp(p.ana), fechaCompromiso: d(8), horasEstimadas: 12, avance: 10, estatus: 'En espera',
      requiereAccion: true, accionDe: 'PMO', accionDetalle: 'Aprobación de ventana de cambio', accionFecha: d(3) }),
    a({ titulo: 'Diseño de arquitectura — campus', ...cat('Preventa', 'Diseño / arquitectura de solución'), ...pro('Campus planta norte'), ...resp(p.carla), fechaCompromiso: d(12), horasEstimadas: 20, avance: 15 }),
    a({ titulo: 'Plan de trabajo — segundo evento', ...cat('Implementación', 'Kickoff / planeación'), ...pro('NaaS eventos'), ...resp(p.ana), fechaCompromiso: d(5), horasEstimadas: 10, estatus: 'Sin iniciar' }),
    a({ titulo: 'Demo de Catalyst Center', ...cat('Preventa', 'Demo / prueba de concepto (POC)'), ...pro('Laboratorio interno'), ...resp(p.carla), fechaCompromiso: d(10), horasEstimadas: 8, estatus: 'Sin iniciar' }),
    a({ titulo: 'Caso TAC — reinicios de AP', ...cat('Implementación', 'Seguimiento con fabricante (TAC)'), ...pro('WLAN estacionamientos'), ...resp(p.jorge), fechaCompromiso: d(2), horasEstimadas: 4, avance: 50, estatus: 'En espera',
      requiereAccion: true, accionDe: 'Fabricante', accionDetalle: 'Respuesta del caso abierto con TAC', accionFecha: d(1) }),
    a({ titulo: 'Comparativa de access points Wi-Fi 7', ...cat('Preventa', 'Comparativa de soluciones'), ...pro('WLAN estacionamientos'), ...resp(p.carla), fechaCompromiso: d(-1), horasEstimadas: 6, avance: 100, estatus: 'Completada', fechaCompletada: lunes > d(-1) ? d(-1) : lunes }),
    a({ titulo: 'Kickoff técnico AACC y Sucursales', ...cat('Implementación', 'Kickoff / planeación'), ...pro('ISE Áreas Centrales'), ...resp(p.jorge), fechaCompromiso: d(-2), horasEstimadas: 6, avance: 100, estatus: 'Completada', fechaCompletada: lunes }),
    a({ titulo: 'Estudio de requerimientos — WLAN', ...cat('Preventa', 'Estudio / análisis de requerimientos'), ...pro('WLAN estacionamientos'), ...resp(p.luis), fechaCompromiso: d(-12), horasEstimadas: 8, avance: 100, estatus: 'Completada', fechaCompletada: d(-12), fechaInicio: d(-16) }),
  ];

  const solicitudes = [
    { id: 501, actividadId: 6, titulo: 'Preguntas para junta de aclaraciones', fechaActual: d(4), fechaPropuesta: d(6), justificacion: 'La convocante movió la junta de aclaraciones dos días; necesitamos incluir las preguntas del anexo técnico nuevo.',
      solicitanteEmail: p.paola.email, solicitanteNombre: p.paola.nombre, estatus: 'Pendiente', resueltoPorEmail: '', resueltoPorNombre: '', fechaResolucion: null, comentario: '', correoEnviado: true, creado: hace(0, 15) },
  ];

  const bitacora = [];
  let bid = 0;
  const b = (actividadId, tipo, texto, autor, dias, hora) => bitacora.push({ id: ++bid, actividadId, tipo, texto, autorEmail: autor.email, autorNombre: autor.nombre, fecha: hace(dias, hora) });
  for (const x of actividades) b(x.id, 'Creación', 'Actividad registrada', { email: x.responsableEmail, nombre: x.responsableNombre }, 10, 15);
  b(1, 'Cambio de fecha', `Fecha compromiso: ${fechaCorta(d(0))} → ${fechaCorta(d(1))} (autorizado por Fernando Fernández). Justificación: el cliente extendió el plazo de entrega.`, p.fernando, 2, 17);
  b(1, 'Avance', 'BOM de APs y switches PoE cargado en la carpeta de la oportunidad.', p.carla, 1, 18);
  b(1, 'Acción', 'Requiere acción de Director: Aprobar descuento especial en servicios', p.luis, 0, 16);
  b(5, 'Cambio de estatus', 'Estatus: En curso → Bloqueada. El equipo no ha llegado al almacén.', p.diego, 6, 15);
  b(6, 'Cambio de fecha', `Solicitó cambiar la fecha compromiso de ${fechaCorta(d(4))} a ${fechaCorta(d(6))}. Pendiente de autorización.`, p.paola, 0, 15);

  const notificaciones = [
    { regla: 'solicitudFecha', destinatario: p.fernando.email, canal: 'correo', enviado: hace(0, 15), actividadId: 6 },
    { regla: 'accionDirector', destinatario: p.fernando.email, canal: 'teams+correo', enviado: hace(0, 16), actividadId: 1 },
    { regla: 'porVencer', destinatario: p.luis.email, canal: 'teams+correo', enviado: hace(0, 18), actividadId: 1 },
    { regla: 'porVencer', destinatario: p.fernando.email, canal: 'teams+correo', enviado: hace(0, 18), actividadId: 1 },
    { regla: 'vencida', destinatario: p.diego.email, canal: 'teams+correo', enviado: hace(0, 15), actividadId: 4 },
    { regla: 'vencida', destinatario: p.fernando.email, canal: 'teams+correo', enviado: hace(0, 15), actividadId: 4 },
  ];

  return { equipo, categorias, clientes, proyectos, actividades, solicitudes, bitacora, notificaciones, config: { reglas: reglasPorDefecto(), capacidadDefecto: 40, diasFeriados: [] } };
}
