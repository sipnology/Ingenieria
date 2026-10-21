// Lógica pura (sin red ni DOM): fechas, carga de trabajo, indicadores y reglas de alerta.
// La usan la app web y el motor de alertas; se prueba con `npm test`.

import { ESTATUS_CERRADOS, CONFIG_DEFECTO, reglasPorDefecto } from './schema.js';

/* ───────────────────────── Fechas ───────────────────────── */

const fmtCache = new Map();
function fmt(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }));
  }
  return fmtCache.get(tz);
}

/** Fecha local 'YYYY-MM-DD' de un instante, en la zona horaria dada. */
export function fechaLocal(instante, tz = CONFIG_DEFECTO.zonaHoraria) {
  if (!instante) return null;
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return null;
  return fmt(tz).format(d);
}

/** SharePoint (dateOnly) -> 'YYYY-MM-DD'. Acepta '2026-10-22', '2026-10-22T12:00:00Z' o '2026-10-22T06:00:00Z'. */
export function deSharePoint(valor, tz = CONFIG_DEFECTO.zonaHoraria) {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  return fechaLocal(valor, tz);
}

/** 'YYYY-MM-DD' -> valor para una columna dateOnly. Mediodía UTC: no se recorre de día en ninguna zona de México. */
export function aSharePoint(fecha) {
  return fecha ? `${fecha}T12:00:00Z` : null;
}

function aUTC(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function deUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
export function sumarDias(fecha, n) {
  return deUTC(aUTC(fecha) + n * 86400000);
}
export function diaSemana(fecha) {
  return new Date(aUTC(fecha)).getUTCDay(); // 0 = domingo
}
export function esHabil(fecha, feriados = []) {
  const d = diaSemana(fecha);
  return d !== 0 && d !== 6 && !feriados.includes(fecha);
}
export function diasNaturales(desde, hasta) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86400000);
}

/**
 * Días hábiles de `desde` a `hasta`: cuántos días hábiles hay después de `desde` y hasta `hasta` inclusive.
 * Negativo si `hasta` es anterior (días hábiles de atraso). 0 si es el mismo día.
 */
export function diasHabiles(desde, hasta, feriados = []) {
  if (desde === hasta) return 0;
  let n = 0;
  if (hasta > desde) {
    for (let d = sumarDias(desde, 1); d <= hasta; d = sumarDias(d, 1)) if (esHabil(d, feriados)) n++;
    return n;
  }
  for (let d = sumarDias(hasta, 1); d <= desde; d = sumarDias(d, 1)) if (esHabil(d, feriados)) n++;
  return -n;
}

/** Lunes de la semana de `fecha`. */
export function inicioSemana(fecha) {
  const d = diaSemana(fecha);
  return sumarDias(fecha, d === 0 ? -6 : 1 - d);
}
/** Domingo de la semana de `fecha`. */
export function finSemana(fecha) {
  return sumarDias(inicioSemana(fecha), 6);
}
/** Semana ISO 'YYYY-Www'. */
export function semanaISO(fecha) {
  const jueves = sumarDias(inicioSemana(fecha), 3);
  const anio = Number(jueves.slice(0, 4));
  const primerJueves = sumarDias(inicioSemana(`${anio}-01-04`), 3);
  const semana = 1 + Math.round(diasNaturales(primerJueves, jueves) / 7);
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaCorta(fecha) {
  if (!fecha) return '—';
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}
export function fechaLarga(fecha) {
  if (!fecha) return '—';
  const [y, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

/* ───────────────────── Mapeo SharePoint ↔ app ───────────────────── */

const num = (v, def = 0) => (v === null || v === undefined || v === '' ? def : Number(v));
const listaCorreos = (s) => (s || '').split(/[;,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

export function actividadDeItem(item, tz) {
  const f = item.fields || {};
  return {
    id: Number(item.id ?? f.id),
    titulo: f.Title || '',
    area: f.Area || '',
    categoriaId: f.CategoriaId ? Number(f.CategoriaId) : null,
    categoria: f.Categoria || '',
    clienteId: f.ClienteId ? Number(f.ClienteId) : null,
    cliente: f.Cliente || '',
    proyectoId: f.ProyectoId ? Number(f.ProyectoId) : null,
    proyecto: f.Proyecto || '',
    responsableEmail: (f.ResponsableEmail || '').toLowerCase(),
    responsableNombre: f.ResponsableNombre || '',
    colaboradores: listaCorreos(f.Colaboradores),
    fechaInicio: deSharePoint(f.FechaInicio, tz),
    fechaCompromiso: deSharePoint(f.FechaCompromiso, tz),
    horasEstimadas: num(f.HorasEstimadas),
    estatus: f.Estatus || 'Sin iniciar',
    avance: num(f.Avance),
    prioridad: f.Prioridad || 'Media',
    descripcion: f.Descripcion || '',
    requiereAccion: !!f.RequiereAccion,
    accionDe: f.AccionDe || '',
    accionDetalle: f.AccionDetalle || '',
    accionFecha: deSharePoint(f.AccionFecha, tz),
    accionResuelta: !!f.AccionResuelta,
    accionRespuesta: f.AccionRespuesta || '',
    enlaceCarpeta: f.EnlaceCarpeta || '',
    ultimaActualizacion: f.UltimaActualizacion || item.lastModifiedDateTime || f.Modified || null,
    fechaCompletada: deSharePoint(f.FechaCompletada, tz),
    creado: item.createdDateTime || f.Created || null,
    creadoPor: item.createdBy?.user?.displayName || '',
  };
}

const MAPA_ACTIVIDAD = {
  titulo: 'Title', area: 'Area', categoriaId: 'CategoriaId', categoria: 'Categoria',
  clienteId: 'ClienteId', cliente: 'Cliente', proyectoId: 'ProyectoId', proyecto: 'Proyecto',
  responsableEmail: 'ResponsableEmail', responsableNombre: 'ResponsableNombre',
  horasEstimadas: 'HorasEstimadas', estatus: 'Estatus', avance: 'Avance', prioridad: 'Prioridad',
  descripcion: 'Descripcion', requiereAccion: 'RequiereAccion', accionDe: 'AccionDe',
  accionDetalle: 'AccionDetalle', accionResuelta: 'AccionResuelta', accionRespuesta: 'AccionRespuesta',
  enlaceCarpeta: 'EnlaceCarpeta', ultimaActualizacion: 'UltimaActualizacion',
};
const FECHAS_ACTIVIDAD = { fechaInicio: 'FechaInicio', fechaCompromiso: 'FechaCompromiso', accionFecha: 'AccionFecha', fechaCompletada: 'FechaCompletada' };

/** Convierte un objeto parcial de la app a `fields` de SharePoint (solo las llaves presentes). */
export function camposDeActividad(parcial) {
  const out = {};
  for (const [k, v] of Object.entries(parcial)) {
    if (k in MAPA_ACTIVIDAD) out[MAPA_ACTIVIDAD[k]] = v === undefined ? null : v;
    else if (k in FECHAS_ACTIVIDAD) out[FECHAS_ACTIVIDAD[k]] = aSharePoint(v);
    else if (k === 'colaboradores') out.Colaboradores = (v || []).join('; ');
  }
  // Un choice vacío debe ir como null
  if (out.AccionDe === '') out.AccionDe = null;
  return out;
}

export function integranteDeItem(item) {
  const f = item.fields || {};
  return {
    id: Number(item.id ?? f.id),
    nombre: f.Title || '',
    email: (f.Email || '').toLowerCase(),
    upn: (f.UPN || '').toLowerCase(),
    entraId: f.EntraId || '',
    area: f.Area || '',
    rol: f.Rol || 'Ingeniero',
    capacidadHoras: f.CapacidadHoras === undefined || f.CapacidadHoras === null ? null : Number(f.CapacidadHoras),
    activo: f.Activo !== false,
  };
}
export function camposDeIntegrante(p) {
  return {
    Title: p.nombre, Email: (p.email || '').toLowerCase(), UPN: (p.upn || '').toLowerCase(), EntraId: p.entraId || '',
    Area: p.area || null, Rol: p.rol || 'Ingeniero', CapacidadHoras: p.capacidadHoras ?? null, Activo: p.activo !== false,
  };
}
/** ¿Esta cuenta (correo o UPN con el que inició sesión) corresponde a este integrante? */
export const esLaPersona = (p, cuenta) => !!cuenta && (p.email === cuenta.toLowerCase() || p.upn === cuenta.toLowerCase());

export function categoriaDeItem(item) {
  const f = item.fields || {};
  return { id: Number(item.id ?? f.id), nombre: f.Title || '', area: f.Area || '', orden: num(f.Orden, 999), activo: f.Activo !== false };
}
export function clienteDeItem(item) {
  const f = item.fields || {};
  return { id: Number(item.id ?? f.id), nombre: f.Title || '', activo: f.Activo !== false };
}
export function proyectoDeItem(item) {
  const f = item.fields || {};
  return { id: Number(item.id ?? f.id), nombre: f.Title || '', clienteId: f.ClienteId ? Number(f.ClienteId) : null, cliente: f.Cliente || '', activo: f.Activo !== false };
}

export function solicitudDeItem(item, tz) {
  const f = item.fields || {};
  return {
    id: Number(item.id ?? f.id),
    actividadId: Number(f.ActividadId),
    titulo: f.Title || '',
    fechaActual: deSharePoint(f.FechaActual, tz),
    fechaPropuesta: deSharePoint(f.FechaPropuesta, tz),
    justificacion: f.Justificacion || '',
    solicitanteEmail: (f.SolicitanteEmail || '').toLowerCase(),
    solicitanteNombre: f.SolicitanteNombre || '',
    estatus: f.Estatus || 'Pendiente',
    resueltoPorEmail: (f.ResueltoPorEmail || '').toLowerCase(),
    resueltoPorNombre: f.ResueltoPorNombre || '',
    fechaResolucion: f.FechaResolucion || null,
    comentario: f.Comentario || '',
    correoEnviado: !!f.CorreoEnviado,
    creado: item.createdDateTime || f.Created || null,
  };
}
export function camposDeSolicitud(s) {
  const out = {};
  const mapa = { titulo: 'Title', actividadId: 'ActividadId', justificacion: 'Justificacion', solicitanteEmail: 'SolicitanteEmail', solicitanteNombre: 'SolicitanteNombre',
    estatus: 'Estatus', resueltoPorEmail: 'ResueltoPorEmail', resueltoPorNombre: 'ResueltoPorNombre', fechaResolucion: 'FechaResolucion', comentario: 'Comentario', correoEnviado: 'CorreoEnviado' };
  for (const [k, v] of Object.entries(s)) {
    if (k in mapa) out[mapa[k]] = v;
    else if (k === 'fechaActual') out.FechaActual = aSharePoint(v);
    else if (k === 'fechaPropuesta') out.FechaPropuesta = aSharePoint(v);
  }
  if (out.Title) out.Title = String(out.Title).slice(0, 255);
  return out;
}

export function bitacoraDeItem(item) {
  const f = item.fields || {};
  return {
    id: Number(item.id ?? f.id),
    actividadId: Number(f.ActividadId),
    tipo: f.TipoEntrada || 'Avance',
    texto: f.Texto || '',
    autorEmail: (f.AutorEmail || '').toLowerCase(),
    autorNombre: f.AutorNombre || '',
    fecha: item.createdDateTime || f.Created || null,
  };
}

/** Mezcla la configuración guardada con los valores por defecto (nuevas reglas quedan activas). */
export function configuracionEfectiva(guardada = {}) {
  const base = reglasPorDefecto();
  const reglas = {};
  for (const [id, def] of Object.entries(base)) reglas[id] = { ...def, ...(guardada.reglas?.[id] || {}) };
  return { ...CONFIG_DEFECTO, ...guardada, reglas };
}

/* ───────────────────── Estado de una actividad ───────────────────── */

export const estaAbierta = (a) => !ESTATUS_CERRADOS.includes(a.estatus);

/**
 * Situación de la fecha compromiso:
 *  cerrada | sinFecha | vencida | hoy | proxima (≤ 2 días hábiles) | aTiempo
 */
export function situacion(a, hoy, feriados = []) {
  if (!estaAbierta(a)) return { clave: 'cerrada', dias: 0 };
  if (!a.fechaCompromiso) return { clave: 'sinFecha', dias: 0 };
  const dh = diasHabiles(hoy, a.fechaCompromiso, feriados);
  if (a.fechaCompromiso < hoy) return { clave: 'vencida', dias: diasNaturales(a.fechaCompromiso, hoy), diasHabiles: -dh };
  if (a.fechaCompromiso === hoy) return { clave: 'hoy', dias: 0 };
  if (dh <= 2) return { clave: 'proxima', dias: dh };
  return { clave: 'aTiempo', dias: dh };
}

/** En riesgo: abierta, no vencida, con poco avance cerca de la fecha, o detenida cerca de la fecha. */
export function enRiesgo(a, hoy, feriados = []) {
  const s = situacion(a, hoy, feriados);
  if (!['hoy', 'proxima', 'aTiempo'].includes(s.clave)) return false;
  const dh = s.clave === 'hoy' ? 0 : s.dias;
  if (dh <= 2 && a.avance < 70) return true;
  if ((a.estatus === 'Bloqueada' || a.estatus === 'En espera') && dh <= 5) return true;
  return false;
}

export const accionPendiente = (a) => estaAbierta(a) && a.requiereAccion && !!a.accionDe && !a.accionResuelta;

/* ───────────────────────── Carga de trabajo ───────────────────────── */

export function horasRestantes(a) {
  return Math.max(0, a.horasEstimadas * (1 - Math.min(100, Math.max(0, a.avance)) / 100));
}

/**
 * Horas de esta semana para una actividad: las horas pendientes se reparten
 * en partes iguales entre las semanas que faltan para la fecha compromiso.
 * Vencidas o sin fecha cuentan completas esta semana. Si inicia después de esta semana, 0.
 */
export function horasEstaSemana(a, hoy) {
  if (!estaAbierta(a)) return 0;
  const restantes = horasRestantes(a);
  if (!a.fechaCompromiso || a.fechaCompromiso < hoy) return restantes;
  const lunes = inicioSemana(hoy);
  const inicio = a.fechaInicio && a.fechaInicio > hoy ? a.fechaInicio : hoy;
  if (inicio > finSemana(hoy)) return 0;
  const semanas = Math.max(1, Math.floor(diasNaturales(lunes, inicioSemana(a.fechaCompromiso)) / 7) + 1);
  return restantes / semanas;
}

export function cargaPorPersona(actividades, equipo, hoy, capacidadDefecto = 40) {
  const filas = new Map();
  for (const p of equipo.filter((x) => x.activo && x.rol !== 'Director')) {
    filas.set(p.email, { email: p.email, nombre: p.nombre, area: p.area, capacidad: p.capacidadHoras ?? capacidadDefecto, horas: 0, abiertas: 0, vencenSemana: 0, bloqueadas: 0, enRiesgo: 0 });
  }
  const fin = finSemana(hoy);
  for (const a of actividades.filter(estaAbierta)) {
    if (!a.responsableEmail) continue;
    if (!filas.has(a.responsableEmail)) {
      filas.set(a.responsableEmail, { email: a.responsableEmail, nombre: a.responsableNombre || a.responsableEmail, area: a.area, capacidad: capacidadDefecto, horas: 0, abiertas: 0, vencenSemana: 0, bloqueadas: 0, enRiesgo: 0 });
    }
    const f = filas.get(a.responsableEmail);
    f.horas += horasEstaSemana(a, hoy);
    f.abiertas += 1;
    if (a.fechaCompromiso && a.fechaCompromiso <= fin) f.vencenSemana += 1;
    if (a.estatus === 'Bloqueada') f.bloqueadas += 1;
    if (enRiesgo(a, hoy)) f.enRiesgo += 1;
  }
  return [...filas.values()]
    .map((f) => ({ ...f, horas: Math.round(f.horas * 10) / 10, porcentaje: f.capacidad ? f.horas / f.capacidad : 0, sobrecarga: f.capacidad > 0 && f.horas > f.capacidad }))
    .sort((a, b) => b.porcentaje - a.porcentaje);
}

/* ───────────────────────── Indicadores ───────────────────────── */

export function indicadores(actividades, hoy, feriados = []) {
  const abiertas = actividades.filter(estaAbierta);
  const fin = finSemana(hoy);
  const porArea = {};
  for (const a of abiertas) porArea[a.area] = (porArea[a.area] || 0) + 1;
  const vencidas = abiertas.filter((a) => a.fechaCompromiso && a.fechaCompromiso < hoy);
  const venceSemana = abiertas.filter((a) => a.fechaCompromiso && a.fechaCompromiso >= hoy && a.fechaCompromiso <= fin);
  const director = abiertas.filter((a) => accionPendiente(a) && a.accionDe === 'Director');
  const manana = sumarDias(hoy, 1);
  const otrasAreas = {};
  for (const a of abiertas.filter((x) => accionPendiente(x) && x.accionDe !== 'Director')) {
    (otrasAreas[a.accionDe] ||= []).push(a);
  }
  const lunes = inicioSemana(hoy);
  return {
    abiertas: abiertas.length,
    porArea,
    venceSemana: venceSemana.length,
    riesgoSemana: venceSemana.filter((a) => enRiesgo(a, hoy, feriados)).length,
    enRiesgo: abiertas.filter((a) => enRiesgo(a, hoy, feriados)).length,
    vencidas: vencidas.length,
    maxDiasVencida: vencidas.reduce((m, a) => Math.max(m, diasNaturales(a.fechaCompromiso, hoy)), 0),
    requierenDirector: director.length,
    directorUrgentes: director.filter((a) => (a.accionFecha && a.accionFecha <= manana) || (a.fechaCompromiso && a.fechaCompromiso <= manana)).length,
    esperandoAreas: Object.values(otrasAreas).reduce((n, l) => n + l.length, 0),
    otrasAreas,
    completadasSemana: actividades.filter((a) => a.estatus === 'Completada' && a.fechaCompletada && a.fechaCompletada >= lunes).length,
  };
}

/** Elemento de la cola de avisos (lista Notificaciones). */
export function camposDeAviso({ llave, regla, actividadId = null, destinatario, asunto, html = '', tarjeta = null, enviarTeams = false, enviarCorreo = false }) {
  return {
    Title: String(llave).slice(0, 255), Regla: regla, ActividadId: actividadId, Destinatario: destinatario,
    Canal: [enviarTeams && 'teams', enviarCorreo && 'correo'].filter(Boolean).join('+'),
    Asunto: String(asunto || '').slice(0, 255), Html: html, Tarjeta: tarjeta ? JSON.stringify(tarjeta) : '',
    EnviarTeams: !!enviarTeams, EnviarCorreo: !!enviarCorreo, Estado: 'Pendiente', Enviado: new Date().toISOString(),
  };
}

/* ─────────────────────── Estadísticas por periodo ─────────────────────── */

/** Siguiente día hábil después de `fecha`. */
export function siguienteHabil(fecha, feriados = []) {
  let f = sumarDias(fecha, 1);
  while (!esHabil(f, feriados)) f = sumarDias(f, 1);
  return f;
}

/** Rango [desde, hasta] de un periodo con nombre: semana, mes, trimestre, anio, todo. */
export function rangoPeriodo(periodo, hoy) {
  const [y, m] = hoy.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const finMes = (yy, mm) => deUTC(Date.UTC(yy, mm, 0));
  switch (periodo) {
    case 'semana': return { desde: inicioSemana(hoy), hasta: finSemana(hoy) };
    case 'mes': return { desde: `${y}-${pad(m)}-01`, hasta: finMes(y, m) };
    case 'mesAnterior': { const yy = m === 1 ? y - 1 : y; const mm = m === 1 ? 12 : m - 1; return { desde: `${yy}-${pad(mm)}-01`, hasta: finMes(yy, mm) }; }
    case 'trimestre': { const q = Math.floor((m - 1) / 3) * 3 + 1; return { desde: `${y}-${pad(q)}-01`, hasta: finMes(y, q + 2) }; }
    case 'anio': return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
    default: return { desde: '0000-01-01', hasta: '9999-12-31' };
  }
}

/** ¿La actividad estuvo activa dentro del rango? (de su inicio a su cierre, o a hoy si sigue abierta) */
export function activaEnRango(a, { desde, hasta }, hoy, tz) {
  const inicio = a.fechaInicio || fechaLocal(a.creado, tz) || a.fechaCompromiso || hoy;
  const fin = a.fechaCompletada || (estaAbierta(a) ? (a.fechaCompromiso && a.fechaCompromiso > hoy ? a.fechaCompromiso : hoy) : a.fechaCompromiso || inicio);
  return inicio <= hasta && fin >= desde;
}

/**
 * Agrupa actividades y suma cantidad y horas.
 * `clave(a)` devuelve [id, etiqueta, extra?].
 */
export function agrupar(actividades, clave) {
  const mapa = new Map();
  for (const a of actividades) {
    const [id, etiqueta, extra] = clave(a);
    if (!mapa.has(id)) mapa.set(id, { id, etiqueta, extra, cantidad: 0, abiertas: 0, completadas: 0, vencidas: 0, horas: 0, horasCompletadas: 0, horasPendientes: 0 });
    const g = mapa.get(id);
    g.cantidad += 1;
    g.horas += a.horasEstimadas || 0;
    g.horasPendientes += estaAbierta(a) ? horasRestantes(a) : 0;
    if (a.estatus === 'Completada') { g.completadas += 1; g.horasCompletadas += a.horasEstimadas || 0; }
    else if (estaAbierta(a)) g.abiertas += 1;
    if (a._vencida) g.vencidas += 1;
  }
  const r1 = (n) => Math.round(n * 10) / 10;
  return [...mapa.values()].map((g) => ({ ...g, horas: r1(g.horas), horasCompletadas: r1(g.horasCompletadas), horasPendientes: r1(g.horasPendientes) }))
    .sort((a, b) => b.horas - a.horas || b.cantidad - a.cantidad);
}

/* ───────────────────────── Reglas de aviso ───────────────────────── */

export function hashTexto(s = '') {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const persona = (email, nombre) => ({ email: (email || '').toLowerCase(), nombre: nombre || email });

// Qué reglas se evalúan en cada corrida programada
const REGLAS_POR_MODO = {
  eventos: ['accionDirector', 'accionRespondida', 'solicitudFecha', 'fechaResuelta'],
  mediodia: ['accionDirector', 'accionRespondida', 'solicitudFecha', 'fechaResuelta', 'porVencer'],
  diario: ['accionDirector', 'accionRespondida', 'solicitudFecha', 'fechaResuelta', 'vencida', 'sinActualizar', 'sobrecarga'],
  semanal: ['resumenSemanal'],
};
export const MODOS = Object.keys(REGLAS_POR_MODO);

/**
 * Evalúa las reglas y devuelve los avisos pendientes de enviar: uno por destinatario.
 * Los avisos solo van al dueño de la actividad y/o al director, nunca a otras personas.
 * enviados: Set de llaves ya enviadas (lista Notificaciones).
 */
export function evaluarAlertas({ hoy, actividades, equipo, solicitudes = [], config, enviados = new Set(), modo = 'diario' }) {
  const cfg = configuracionEfectiva(config);
  const R = cfg.reglas;
  const feriados = cfg.diasFeriados || [];
  const corre = new Set(REGLAS_POR_MODO[modo] || []);
  const activa = (id) => corre.has(id) && R[id]?.activa;
  const directores = equipo.filter((p) => p.rol === 'Director' && p.activo && p.email).map((p) => persona(p.email, p.nombre));
  const porId = new Map(actividades.map((a) => [a.id, a]));
  const avisos = [];

  /**
   * Agrega el aviso para el dueño y/o el director según la configuración de la regla.
   * `textos(paraDirector)` regresa { asunto, etiqueta } para cada tipo de destinatario.
   */
  function agregar(regla, base, dueno, textos) {
    const r = R[regla];
    const lista = [];
    if (r.responsable && dueno?.email) lista.push({ ...dueno, paraDirector: false });
    if (r.director) for (const d of directores) if (!lista.some((x) => x.email === d.email)) lista.push({ ...d, paraDirector: true });
    for (const d of lista) {
      const llave = `${base.llave}|${d.email}`;
      if (enviados.has(llave)) continue;
      const esDueno = dueno && d.email === dueno.email;
      avisos.push({ ...base, regla, canal: r.canal, llave, destinatario: d, ...textos(!esDueno) });
    }
  }
  const dueno = (a) => persona(a.responsableEmail, a.responsableNombre);
  const quien = (a, paraDirector) => (paraDirector ? `${a.responsableNombre}: ` : '');
  const abiertas = actividades.filter(estaAbierta);

  if (activa('accionDirector')) {
    for (const a of abiertas.filter((x) => accionPendiente(x) && x.accionDe === 'Director')) {
      agregar('accionDirector', { actividad: a, llave: `accionDirector:${a.id}:${hashTexto(a.accionDetalle)}` }, dueno(a),
        () => ({ asunto: `${a.responsableNombre || 'Alguien'} necesita algo de ti: ${a.accionDetalle || a.titulo}`, etiqueta: 'TE NECESITAN' }));
    }
  }
  if (activa('accionRespondida')) {
    for (const a of actividades.filter((x) => x.requiereAccion && x.accionDe === 'Director' && x.accionResuelta && x.accionRespuesta)) {
      agregar('accionRespondida', { actividad: a, llave: `accionRespondida:${a.id}:${hashTexto(a.accionRespuesta)}` }, dueno(a),
        () => ({ asunto: `El director respondió tu petición: ${a.accionDetalle || a.titulo}`, etiqueta: 'PETICIÓN RESPONDIDA' }));
    }
  }
  if (activa('solicitudFecha')) {
    for (const s of solicitudes.filter((x) => x.estatus === 'Pendiente' && !x.correoEnviado)) {
      const a = porId.get(s.actividadId);
      if (!a) continue;
      agregar('solicitudFecha', { actividad: a, solicitud: s, llave: `solicitudFecha:${s.id}` }, persona(s.solicitanteEmail, s.solicitanteNombre),
        () => ({ asunto: `Autorización de cambio de fecha: ${a.titulo}`, etiqueta: 'AUTORIZACIÓN REQUERIDA' }));
    }
  }
  if (activa('fechaResuelta')) {
    const hace7 = new Date(Date.now() - 7 * 86400000).toISOString();
    for (const s of solicitudes.filter((x) => x.estatus !== 'Pendiente' && (x.fechaResolucion || '') >= hace7)) {
      const a = porId.get(s.actividadId);
      if (!a) continue;
      const ok = s.estatus === 'Autorizada';
      agregar('fechaResuelta', { actividad: a, solicitud: s, llave: `fechaResuelta:${s.id}` }, persona(s.solicitanteEmail, s.solicitanteNombre),
        () => ({ asunto: `${ok ? 'Autorizado' : 'Rechazado'} el cambio de fecha a ${fechaCorta(s.fechaPropuesta)}: ${a.titulo}`, etiqueta: ok ? 'CAMBIO DE FECHA AUTORIZADO' : 'CAMBIO DE FECHA RECHAZADO' }));
    }
  }
  if (activa('porVencer')) {
    const manana = siguienteHabil(hoy, feriados);
    for (const a of abiertas.filter((x) => x.fechaCompromiso && x.fechaCompromiso > hoy && x.fechaCompromiso <= manana)) {
      agregar('porVencer', { actividad: a, llave: `porVencer:${a.id}:${a.fechaCompromiso}` }, dueno(a),
        (dir) => ({ asunto: `${quien(a, dir)}Vence ${a.fechaCompromiso === sumarDias(hoy, 1) ? 'mañana' : `el ${fechaCorta(a.fechaCompromiso)}`}: ${a.titulo}`, etiqueta: 'VENCE MAÑANA' }));
    }
  }
  if (activa('vencida')) {
    for (const a of abiertas.filter((x) => x.fechaCompromiso && x.fechaCompromiso < hoy)) {
      const dias = diasNaturales(a.fechaCompromiso, hoy);
      agregar('vencida', { actividad: a, llave: `vencida:${a.id}:${hoy}` }, dueno(a),
        (dir) => ({ asunto: `${quien(a, dir)}Vencida hace ${dias} día${dias === 1 ? '' : 's'}: ${a.titulo}`, etiqueta: `VENCIDA · ${dias} DÍA${dias === 1 ? '' : 'S'}` }));
    }
  }
  if (activa('sinActualizar')) {
    for (const a of abiertas.filter((x) => x.ultimaActualizacion && !(x.fechaCompromiso && x.fechaCompromiso < hoy))) {
      const desde = fechaLocal(a.ultimaActualizacion, cfg.zonaHoraria);
      const dh = desde ? diasHabiles(desde, hoy, feriados) : 0;
      if (dh < R.sinActualizar.diasHabiles) continue;
      agregar('sinActualizar', { actividad: a, llave: `sinActualizar:${a.id}:${semanaISO(hoy)}` }, dueno(a),
        (dir) => ({ asunto: `${quien(a, dir)}${dh} días hábiles sin actualizar: ${a.titulo}`, etiqueta: 'SIN ACTUALIZAR' }));
    }
  }
  if (activa('sobrecarga')) {
    for (const f of cargaPorPersona(actividades, equipo, hoy, cfg.capacidadDefecto).filter((x) => x.sobrecarga)) {
      agregar('sobrecarga', { actividad: null, persona: f, llave: `sobrecarga:${f.email}:${semanaISO(hoy)}` }, persona(f.email, f.nombre),
        (dir) => ({ asunto: dir ? `${f.nombre} tiene ${f.horas} h comprometidas esta semana (capacidad ${f.capacidad} h)` : `Tienes ${f.horas} h comprometidas esta semana (capacidad ${f.capacidad} h)`, etiqueta: 'SOBRECARGA' }));
    }
  }
  if (activa('resumenSemanal')) {
    const kpi = indicadores(actividades, hoy, feriados);
    const carga = cargaPorPersona(actividades, equipo, hoy, cfg.capacidadDefecto);
    const semana = semanaISO(hoy);
    const lunes = inicioSemana(hoy);
    if (R.resumenSemanal.director) {
      for (const d of directores) {
        const llave = `resumen:${semana}|${d.email}`;
        if (enviados.has(llave)) continue;
        avisos.push({ regla: 'resumenSemanal', canal: R.resumenSemanal.canal, actividad: null, llave, destinatario: { ...d, paraDirector: true }, tipoResumen: 'director',
          resumen: {
            kpi, carga,
            completadasSemanaPasada: actividades.filter((a) => a.estatus === 'Completada' && a.fechaCompletada && a.fechaCompletada >= sumarDias(lunes, -7) && a.fechaCompletada < lunes).length,
            vencidas: abiertas.filter((a) => a.fechaCompromiso && a.fechaCompromiso < hoy),
            director: abiertas.filter((a) => accionPendiente(a) && a.accionDe === 'Director'),
            solicitudes: solicitudes.filter((x) => x.estatus === 'Pendiente').map((x) => ({ ...x, actividad: porId.get(x.actividadId) })).filter((x) => x.actividad),
          },
          asunto: `Ingeniería · semana ${semana.slice(-2)} · ${kpi.vencidas} vencidas, ${kpi.requierenDirector} te esperan`, etiqueta: 'RESUMEN SEMANAL' });
      }
    }
    if (R.resumenSemanal.responsable) {
      for (const p of equipo.filter((x) => x.activo && x.rol !== 'Director' && x.email)) {
        const mias = abiertas.filter((a) => a.responsableEmail === p.email).sort((a, b) => (a.fechaCompromiso || '9999').localeCompare(b.fechaCompromiso || '9999'));
        const llave = `resumen:${semana}|${p.email}`;
        if (!mias.length || enviados.has(llave)) continue;
        avisos.push({ regla: 'resumenSemanal', canal: R.resumenSemanal.canal, actividad: null, llave, destinatario: { ...persona(p.email, p.nombre), paraDirector: false }, tipoResumen: 'personal',
          resumen: { mias, carga: carga.find((x) => x.email === p.email) }, asunto: `Tu semana en Ingeniería · ${mias.length} actividades abiertas`, etiqueta: 'TU SEMANA' });
      }
    }
  }
  return avisos;
}
