import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diasHabiles, diaSemana, inicioSemana, finSemana, semanaISO, deSharePoint, aSharePoint,
  situacion, enRiesgo, horasEstaSemana, cargaPorPersona, indicadores, evaluarAlertas,
  actividadDeItem, camposDeActividad, configuracionEfectiva, siguienteHabil, rangoPeriodo, agrupar,
  activaEnRango, solicitudDeItem, camposDeSolicitud, esLaPersona, integranteDeItem,
} from '../src/logic.js';

const HOY = '2026-10-21'; // miércoles

const act = (o = {}) => ({
  id: 1, titulo: 'X', area: 'Preventa', categoriaId: 1, categoria: 'Propuesta técnica', clienteId: 1, cliente: 'C', proyectoId: 1, proyecto: 'P',
  responsableEmail: 'luis@sip.mx', responsableNombre: 'Luis M.', colaboradores: [],
  fechaInicio: null, fechaCompromiso: '2026-10-30', horasEstimadas: 10, estatus: 'En curso', avance: 0,
  prioridad: 'Media', descripcion: '', requiereAccion: false, accionDe: '', accionDetalle: '', accionFecha: null,
  accionResuelta: false, accionRespuesta: '', enlaceCarpeta: '', ultimaActualizacion: '2026-10-21T15:00:00Z',
  fechaCompletada: null, ...o,
});
const equipo = [
  { id: 1, nombre: 'Fernando', email: 'fer@sip.mx', area: '', rol: 'Director', capacidadHoras: 40, activo: true },
  { id: 2, nombre: 'Luis M.', email: 'luis@sip.mx', area: 'Preventa', rol: 'Ingeniero', capacidadHoras: 40, activo: true },
  { id: 3, nombre: 'Ana R.', email: 'ana@sip.mx', area: 'Implementación', rol: 'Ingeniero', capacidadHoras: null, activo: true },
];

test('fechas básicas', () => {
  assert.equal(diaSemana(HOY), 3);
  assert.equal(inicioSemana(HOY), '2026-10-19');
  assert.equal(finSemana(HOY), '2026-10-25');
  assert.equal(inicioSemana('2026-10-25'), '2026-10-19'); // domingo
  assert.equal(semanaISO(HOY), '2026-W43');
  assert.equal(semanaISO('2027-01-01'), '2026-W53');
});

test('días hábiles', () => {
  assert.equal(diasHabiles(HOY, '2026-10-23'), 2); // jue, vie
  assert.equal(diasHabiles(HOY, '2026-10-26'), 3); // jue, vie, lun
  assert.equal(diasHabiles('2026-10-23', '2026-10-26'), 1);
  assert.equal(diasHabiles(HOY, '2026-10-16'), -3); // vie 16 -> mié 21: lun, mar, mié
  assert.equal(diasHabiles(HOY, '2026-10-23', ['2026-10-22']), 1);
  assert.equal(diasHabiles(HOY, HOY), 0);
});

test('fechas de SharePoint no se recorren', () => {
  assert.equal(deSharePoint('2026-10-22T12:00:00Z'), '2026-10-22');
  assert.equal(deSharePoint('2026-10-22T06:00:00Z'), '2026-10-22'); // medianoche CDMX guardada en UTC
  assert.equal(aSharePoint('2026-10-22'), '2026-10-22T12:00:00Z');
});

test('situación y riesgo', () => {
  assert.equal(situacion(act({ fechaCompromiso: '2026-10-17' }), HOY).clave, 'vencida');
  assert.equal(situacion(act({ fechaCompromiso: '2026-10-17' }), HOY).dias, 3); // sáb 17 → mié 21: lun, mar, mié
  // Vence viernes, hoy lunes: 1 día hábil de atraso (el fin de semana no cuenta)
  assert.equal(situacion(act({ fechaCompromiso: '2026-10-23' }), '2026-10-26').dias, 1);
  assert.equal(situacion(act({ fechaCompromiso: '2026-10-22' }), '2026-10-26').dias, 2);
  // Vence viernes, hoy sábado: ya está vencida, cuenta como 1
  assert.equal(situacion(act({ fechaCompromiso: '2026-10-23' }), '2026-10-24').dias, 1);
  // Feriado en medio no cuenta
  assert.equal(situacion(act({ fechaCompromiso: '2026-11-13' }), '2026-11-17', ['2026-11-16']).dias, 1);
  assert.equal(situacion(act({ fechaCompromiso: HOY }), HOY).clave, 'hoy');
  assert.equal(situacion(act({ fechaCompromiso: '2026-10-23' }), HOY).clave, 'proxima');
  assert.equal(situacion(act({ estatus: 'Completada' }), HOY).clave, 'cerrada');
  assert.equal(enRiesgo(act({ fechaCompromiso: '2026-10-22', avance: 50 }), HOY), true);
  assert.equal(enRiesgo(act({ fechaCompromiso: '2026-10-22', avance: 90 }), HOY), false);
  assert.equal(enRiesgo(act({ fechaCompromiso: '2026-10-27', estatus: 'Bloqueada' }), HOY), true);
});

test('carga semanal reparte horas entre semanas', () => {
  assert.equal(horasEstaSemana(act({ fechaCompromiso: '2026-10-23', horasEstimadas: 10, avance: 50 }), HOY), 5);
  assert.equal(horasEstaSemana(act({ fechaCompromiso: '2026-11-06', horasEstimadas: 30 }), HOY), 10); // 3 semanas
  assert.equal(horasEstaSemana(act({ fechaCompromiso: '2026-10-10', horasEstimadas: 8 }), HOY), 8); // vencida
  assert.equal(horasEstaSemana(act({ fechaInicio: '2026-11-02', fechaCompromiso: '2026-11-06' }), HOY), 0);
  const carga = cargaPorPersona([act({ horasEstimadas: 50, fechaCompromiso: '2026-10-23' })], equipo, HOY);
  const luis = carga.find((c) => c.email === 'luis@sip.mx');
  assert.equal(luis.horas, 50);
  assert.equal(luis.sobrecarga, true);
  assert.ok(carga.find((c) => c.email === 'ana@sip.mx').capacidad === 40); // capacidad por defecto
  assert.ok(!carga.find((c) => c.email === 'fer@sip.mx')); // el director no aparece
});

test('indicadores', () => {
  const k = indicadores([
    act({ id: 1, fechaCompromiso: '2026-10-17' }),
    act({ id: 2, fechaCompromiso: '2026-10-24' }),
    act({ id: 3, requiereAccion: true, accionDe: 'Director', accionDetalle: 'ok', fechaCompromiso: '2026-10-22' }),
    act({ id: 4, requiereAccion: true, accionDe: 'Compras', accionDetalle: 'equipo' }),
    act({ id: 5, estatus: 'Completada', fechaCompletada: '2026-10-20' }),
  ], HOY);
  assert.equal(k.abiertas, 4);
  assert.equal(k.vencidas, 1);
  assert.equal(k.maxDiasVencida, 3);
  assert.equal(k.venceSemana, 2);
  assert.equal(k.requierenDirector, 1);
  assert.equal(k.directorUrgentes, 1);
  assert.equal(k.esperandoAreas, 1);
  assert.equal(k.completadasSemana, 1);
});

const dest = (avisos) => avisos.map((a) => `${a.regla}:${a.actividad?.id ?? a.solicitud?.id ?? ''}:${a.destinatario.email}`).sort();

test('avisos diarios: solo al dueño y al director, desde el día 1', () => {
  const actividades = [
    act({ id: 2, fechaCompromiso: '2026-10-20' }),                                   // vencida 1 día
    act({ id: 3, requiereAccion: true, accionDe: 'Director', accionDetalle: 'Aprobar' }),
    act({ id: 4, requiereAccion: true, accionDe: 'Compras', accionDetalle: 'Equipo', colaboradores: ['ana@sip.mx'] }),
    act({ id: 5, ultimaActualizacion: '2026-10-12T15:00:00Z' }),                       // sin actualizar
  ];
  const avisos = evaluarAlertas({ hoy: HOY, actividades, equipo, config: {}, modo: 'diario' });
  const d = dest(avisos);
  assert.ok(d.includes('vencida:2:luis@sip.mx'));
  assert.ok(d.includes('vencida:2:fer@sip.mx'));
  assert.ok(d.includes('accionDirector:3:fer@sip.mx'));
  assert.ok(!d.some((x) => x.startsWith('accionDirector:3:luis')));
  assert.ok(d.includes('sinActualizar:5:luis@sip.mx') && d.includes('sinActualizar:5:fer@sip.mx'));
  assert.ok(!d.some((x) => x.includes(':4:')), 'esperar a otra área no avisa a nadie');
  assert.ok(!d.some((x) => x.endsWith('ana@sip.mx')), 'los colaboradores no reciben avisos');
  assert.ok(avisos.every((a) => a.canal === 'ambos'));
  const paraDirector = avisos.find((a) => a.regla === 'vencida' && a.destinatario.email === 'fer@sip.mx');
  assert.match(paraDirector.asunto, /^Luis M\.: Vencida hace 1 día/);

  const enviados = new Set(avisos.map((a) => a.llave));
  assert.equal(evaluarAlertas({ hoy: HOY, actividades, equipo, config: {}, enviados, modo: 'diario' }).length, 0);
  const manana = evaluarAlertas({ hoy: '2026-10-22', actividades, equipo, config: {}, enviados, modo: 'diario' });
  assert.deepEqual(dest(manana), ['vencida:2:fer@sip.mx', 'vencida:2:luis@sip.mx']);
});

test('aviso de mediodía: vence el siguiente día hábil', () => {
  const actividades = [act({ id: 1, fechaCompromiso: '2026-10-22' }), act({ id: 2, fechaCompromiso: '2026-10-26' }), act({ id: 3, fechaCompromiso: '2026-10-23' })];
  assert.deepEqual(dest(evaluarAlertas({ hoy: HOY, actividades, equipo, config: {}, modo: 'mediodia' })), ['porVencer:1:fer@sip.mx', 'porVencer:1:luis@sip.mx']);
  // Viernes: avisa lo que vence el lunes
  assert.deepEqual(dest(evaluarAlertas({ hoy: '2026-10-23', actividades, equipo, config: {}, modo: 'mediodia' })), ['porVencer:2:fer@sip.mx', 'porVencer:2:luis@sip.mx']);
  // El aviso de mediodía no corre en la corrida diaria
  assert.ok(!evaluarAlertas({ hoy: HOY, actividades, equipo, config: {}, modo: 'diario' }).some((a) => a.regla === 'porVencer'));
});

test('destinatarios y reglas configurables', () => {
  const actividades = [act({ id: 2, fechaCompromiso: '2026-10-20' })];
  const soloDueno = evaluarAlertas({ hoy: HOY, actividades, equipo, config: { reglas: { vencida: { director: false } } }, modo: 'diario' });
  assert.deepEqual(dest(soloDueno), ['vencida:2:luis@sip.mx']);
  const off = evaluarAlertas({ hoy: HOY, actividades, equipo, config: { reglas: { vencida: { activa: false } } }, modo: 'diario' });
  assert.equal(off.length, 0);
  // Si el dueño es el director, recibe un solo aviso
  const propia = evaluarAlertas({ hoy: HOY, actividades: [act({ id: 9, fechaCompromiso: '2026-10-20', responsableEmail: 'fer@sip.mx', responsableNombre: 'Fernando' })], equipo, config: {}, modo: 'diario' });
  assert.deepEqual(dest(propia), ['vencida:9:fer@sip.mx']);
});

test('solicitudes de cambio de fecha', () => {
  const actividades = [act({ id: 1 })];
  const solicitudes = [
    { id: 50, actividadId: 1, estatus: 'Pendiente', correoEnviado: false, solicitanteEmail: 'luis@sip.mx', solicitanteNombre: 'Luis M.', fechaPropuesta: '2026-11-05' },
    { id: 51, actividadId: 1, estatus: 'Pendiente', correoEnviado: true, solicitanteEmail: 'luis@sip.mx', solicitanteNombre: 'Luis M.', fechaPropuesta: '2026-11-05' },
    { id: 52, actividadId: 1, estatus: 'Autorizada', fechaResolucion: new Date().toISOString(), solicitanteEmail: 'luis@sip.mx', solicitanteNombre: 'Luis M.', fechaPropuesta: '2026-11-05' },
  ];
  const d = dest(evaluarAlertas({ hoy: HOY, actividades, equipo, solicitudes, config: {}, modo: 'eventos' }));
  assert.deepEqual(d, ['fechaResuelta:1:luis@sip.mx', 'solicitudFecha:1:fer@sip.mx']);
  const s = solicitudDeItem({ id: '50', fields: { ActividadId: 1, FechaPropuesta: '2026-11-05T12:00:00Z', Estatus: 'Pendiente' } });
  assert.equal(s.fechaPropuesta, '2026-11-05');
  assert.deepEqual(camposDeSolicitud({ fechaPropuesta: '2026-11-05', estatus: 'Autorizada' }), { FechaPropuesta: '2026-11-05T12:00:00Z', Estatus: 'Autorizada' });
});

test('resumen semanal: cada ingeniero solo lo suyo', () => {
  const avisos = evaluarAlertas({ hoy: '2026-10-26', actividades: [act({ id: 1, colaboradores: ['ana@sip.mx'] })], equipo, config: {}, modo: 'semanal' });
  assert.deepEqual(avisos.map((a) => a.destinatario.email).sort(), ['fer@sip.mx', 'luis@sip.mx']);
});

test('periodos y agrupación por categoría', () => {
  assert.equal(siguienteHabil('2026-10-23'), '2026-10-26');
  assert.deepEqual(rangoPeriodo('mes', HOY), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(rangoPeriodo('trimestre', HOY), { desde: '2026-10-01', hasta: '2026-12-31' });
  assert.deepEqual(rangoPeriodo('mesAnterior', '2026-01-15'), { desde: '2025-12-01', hasta: '2025-12-31' });
  const rango = rangoPeriodo('mes', HOY);
  assert.equal(activaEnRango(act({ fechaInicio: '2026-09-01', estatus: 'Completada', fechaCompletada: '2026-09-20' }), rango, HOY), false);
  assert.equal(activaEnRango(act({ fechaInicio: '2026-09-01', fechaCompromiso: '2026-11-20' }), rango, HOY), true);
  const g = agrupar([
    act({ categoriaId: 1, categoria: 'Dimensionamiento', horasEstimadas: 10, avance: 50 }),
    act({ categoriaId: 1, categoria: 'Dimensionamiento', horasEstimadas: 6, estatus: 'Completada' }),
    act({ categoriaId: 2, categoria: 'Estudio', horasEstimadas: 4 }),
  ], (a) => [a.categoriaId, a.categoria]);
  assert.deepEqual(g.map((x) => [x.etiqueta, x.cantidad, x.horas, x.completadas, x.horasPendientes]), [['Dimensionamiento', 2, 16, 1, 5], ['Estudio', 1, 4, 0, 4]]);
});

test('identificación por correo o UPN', () => {
  const p = integranteDeItem({ id: 1, fields: { Title: 'Luis', Email: 'Luis.M@sipnology.com.mx', UPN: 'lmartinez@sipnology.com.mx' } });
  assert.ok(esLaPersona(p, 'LMARTINEZ@sipnology.com.mx'));
  assert.ok(esLaPersona(p, 'luis.m@sipnology.com.mx'));
  assert.ok(!esLaPersona(p, 'otro@sipnology.com.mx'));
});

test('mapeo SharePoint ida y vuelta', () => {
  const item = { id: '7', createdDateTime: '2026-10-20T15:00:00Z', fields: { Title: 'T', Area: 'Preventa', FechaCompromiso: '2026-10-22T06:00:00Z', Colaboradores: 'a@x.mx; B@x.mx', Avance: 30, RequiereAccion: true, AccionDe: 'PMO' } };
  const a = actividadDeItem(item);
  assert.equal(a.id, 7);
  assert.equal(a.fechaCompromiso, '2026-10-22');
  assert.deepEqual(a.colaboradores, ['a@x.mx', 'b@x.mx']);
  const f = camposDeActividad({ fechaCompromiso: '2026-10-22', colaboradores: ['a@x.mx'], accionDe: '', categoriaId: 3, proyecto: 'NaaS' });
  assert.deepEqual(f, { FechaCompromiso: '2026-10-22T12:00:00Z', Colaboradores: 'a@x.mx', AccionDe: null, CategoriaId: 3, Proyecto: 'NaaS' });
});
