// Pruebas de la capa SharePoint/Graph con un Graph simulado (sin red).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearGraph } from '../src/graph.js';
import { crearSharePoint } from '../src/sharepoint.js';
import { repoSharePoint } from '../src/data.js';
import { ESQUEMA, LISTAS } from '../src/schema.js';

function graphSimulado() {
  const llamadas = [];
  const listas = new Map([['Actividades', { id: 'L-act', displayName: 'Actividades', name: 'Actividades' }]]);
  const columnas = { 'L-act': [{ id: 'c1', name: 'Area', choice: { choices: ['Preventa'] } }] };
  const items = { 'L-act': [] };
  let sig = 10;
  const respuesta = (status, cuerpo, h = {}) => new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers: h });

  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const ruta = decodeURIComponent(u.pathname.replace('/v1.0', ''));
    const metodo = opts.method || 'GET';
    const cuerpo = opts.body ? JSON.parse(opts.body) : undefined;
    llamadas.push({ metodo, ruta, query: u.search, cuerpo, headers: opts.headers });
    if (ruta === '/sites/sip.sharepoint.com:/sites/Ing') return respuesta(200, { id: 'S1', displayName: 'Ingeniería', webUrl: 'https://x' });
    if (ruta === '/sites/S1/lists' && metodo === 'GET') return respuesta(200, { value: [...listas.values()] });
    if (ruta === '/sites/S1/lists' && metodo === 'POST') {
      const id = `L-${cuerpo.displayName.toLowerCase()}`;
      listas.set(cuerpo.displayName, { id, displayName: cuerpo.displayName, name: cuerpo.displayName });
      items[id] ||= [];
      columnas[id] = (cuerpo.columns || []).map((c) => ({ id: `c${++sig}`, ...c }));
      return respuesta(201, { id });
    }
    let m = ruta.match(/^\/sites\/S1\/lists\/([^/]+)\/columns(?:\/([^/]+))?$/);
    if (m) {
      if (metodo === 'GET') return respuesta(200, { value: columnas[m[1]] || [] });
      if (metodo === 'POST') { (columnas[m[1]] ||= []).push({ id: `c${++sig}`, ...cuerpo }); return respuesta(201, {}); }
      if (metodo === 'PATCH') { const c = columnas[m[1]].find((x) => x.id === m[2]); Object.assign(c, cuerpo); return respuesta(200, c); }
    }
    m = ruta.match(/^\/sites\/S1\/lists\/([^/]+)\/items$/);
    if (m && metodo === 'GET') {
      // Paginación: primera página con nextLink
      if (!u.searchParams.get('pagina') && items[m[1]].length > 1) {
        return respuesta(200, { value: items[m[1]].slice(0, 1), '@odata.nextLink': `${u.origin}${u.pathname}?pagina=2` });
      }
      return respuesta(200, { value: u.searchParams.get('pagina') ? items[m[1]].slice(1) : items[m[1]] });
    }
    if (m && metodo === 'POST') {
      const it = { id: String(++sig), createdDateTime: '2026-10-21T17:00:00Z', fields: { ...cuerpo.fields } };
      items[m[1]].push(it);
      return respuesta(201, it);
    }
    m = ruta.match(/^\/sites\/S1\/lists\/([^/]+)\/items\/(\d+)\/fields$/);
    if (m && metodo === 'PATCH') {
      const it = items[m[1]].find((x) => x.id === m[2]);
      Object.assign(it.fields, cuerpo);
      return respuesta(200, it.fields);
    }
    return respuesta(404, { error: { code: 'itemNotFound', message: `No simulado: ${metodo} ${ruta}` } });
  };
  return { llamadas, listas, columnas, items };
}

const nuevaSP = () => crearSharePoint(crearGraph(async () => 'token'), { hostname: 'sip.sharepoint.com', ruta: '/sites/Ing' });

test('provisionar crea listas faltantes, columnas faltantes y opciones nuevas', async () => {
  const g = graphSimulado();
  const log = [];
  await nuevaSP().provisionar((t) => log.push(t));
  for (const nombre of Object.keys(ESQUEMA)) assert.ok(g.listas.has(nombre), `falta ${nombre}`);
  const creadas = g.llamadas.filter((c) => c.metodo === 'POST' && c.ruta === '/sites/S1/lists');
  assert.equal(creadas.length, Object.keys(ESQUEMA).length - 1);
  assert.equal(creadas[0].cuerpo.list.template, 'genericList');
  // Actividades ya existía con Area incompleta: se agregan columnas y opciones
  const cols = g.columnas['L-act'].map((c) => c.name);
  for (const c of ESQUEMA.Actividades.columnas) assert.ok(cols.includes(c.name), `falta columna ${c.name}`);
  assert.deepEqual(g.columnas['L-act'].find((c) => c.name === 'Area').choice.choices, ['Preventa', 'Implementación', 'Soporte']);
  // Idempotente: segunda corrida no crea nada
  const antes = g.llamadas.length;
  await nuevaSP().provisionar(() => {});
  const escrituras = g.llamadas.slice(antes).filter((c) => c.metodo !== 'GET');
  assert.deepEqual(escrituras.map((c) => `${c.metodo} ${c.ruta} ${JSON.stringify(c.cuerpo).slice(0, 80)}`), []);
});

test('repositorio: crear, actualizar, bitácora y paginación', async () => {
  const g = graphSimulado();
  const sp = nuevaSP();
  await sp.provisionar(() => {});
  const repo = repoSharePoint({ sp, tz: 'America/Mexico_City' });
  const u = { nombre: 'Luis M.', email: 'luis@sip.mx' };
  const a = await repo.crearActividad({ titulo: 'Propuesta', area: 'Preventa', categoriaId: 7, categoria: 'Propuesta técnica', clienteId: 3, cliente: 'C', proyectoId: 4, proyecto: 'P', responsableEmail: 'luis@sip.mx', responsableNombre: 'Luis M.', colaboradores: ['ana@sip.mx'], fechaCompromiso: '2026-10-30', horasEstimadas: 8, estatus: 'En curso', avance: 0, requiereAccion: true, accionDe: 'Director', accionDetalle: 'Aprobar' }, u);
  assert.equal(a.fechaCompromiso, '2026-10-30');
  assert.equal(g.items['L-act'][0].fields.FechaCompromiso, '2026-10-30T12:00:00Z');
  assert.equal(g.items['L-act'][0].fields.Colaboradores, 'ana@sip.mx');
  assert.equal(g.items['L-act'][0].fields.CategoriaId, 7);
  assert.equal(g.items['L-act'][0].fields.Proyecto, 'P');
  assert.ok(g.items['L-act'][0].fields.UltimaActualizacion);

  const b = await repo.actualizarActividad(a.id, { avance: 50 }, u, [{ tipo: 'Avance', texto: 'mitad' }]);
  assert.equal(b.avance, 50);
  assert.equal(b.titulo, 'Propuesta');

  const datos = await repo.cargar();
  assert.equal(datos.actividades.length, 1);
  assert.equal(datos.config.reglas.porVencer.activa, true);

  // Actualización silenciosa (renombrar catálogo) no toca la última actualización
  const antesUA = g.items['L-act'][0].fields.UltimaActualizacion;
  await repo.actualizarActividad(a.id, { categoria: 'Propuesta técnica v2' }, u, [], { silencioso: true });
  assert.equal(g.items['L-act'][0].fields.UltimaActualizacion, antesUA);

  const sol = await repo.crearSolicitud({ titulo: 'Propuesta', actividadId: a.id, fechaActual: '2026-10-30', fechaPropuesta: '2026-11-04', justificacion: 'Cliente movió junta', solicitanteEmail: 'luis@sip.mx', solicitanteNombre: 'Luis M.', estatus: 'Pendiente', correoEnviado: false });
  assert.equal(sol.fechaPropuesta, '2026-11-04');
  assert.equal(sol.estatus, 'Pendiente');

  await repo.agregarBitacora(a.id, 'Avance', 'otra', u);
  const bit = await repo.bitacora(a.id);
  assert.equal(bit.length, 3); // creación + avance + otra (con paginación)
  const filtro = g.llamadas.find((c) => c.query.includes('filter'));
  assert.ok(decodeURIComponent(filtro.query).includes(`fields/ActividadId eq ${a.id}`));
  assert.equal(filtro.headers.Prefer, 'HonorNonIndexedQueriesWarningMayFailRandomly');
});

test('sembrar registra al director y la configuración por defecto una sola vez', async () => {
  const g = graphSimulado();
  const sp = nuevaSP();
  await sp.provisionar(() => {});
  const u = { nombre: 'Fernando', email: 'fer@sip.mx' };
  await sp.sembrar(u);
  await sp.sembrar(u);
  const eq = g.items[g.listas.get(LISTAS.equipo).id];
  assert.equal(eq.length, 1);
  assert.equal(eq[0].fields.Rol, 'Director');
  const cats = g.items[g.listas.get(LISTAS.categorias).id];
  assert.ok(cats.length > 30 && cats.every((c) => c.fields.Area && c.fields.Activo));
  assert.equal(eq[0].fields.UPN, 'fer@sip.mx');
  const cfg = g.items[g.listas.get(LISTAS.configuracion).id].map((i) => i.fields.Title).sort();
  assert.deepEqual(cfg, ['capacidadDefecto', 'diasFeriados', 'reglas', 'zonaHoraria']);
});

test('reintenta ante 429 y reporta errores de Graph', async () => {
  let n = 0;
  globalThis.fetch = async () => (++n === 1
    ? new Response('', { status: 429, headers: { 'Retry-After': '0' } })
    : new Response(JSON.stringify({ error: { code: 'accessDenied', message: 'Acceso denegado' } }), { status: 403 }));
  const g = crearGraph(async () => 't');
  await assert.rejects(g.get('/me'), (e) => e.status === 403 && e.codigo === 'accessDenied');
  assert.equal(n, 2);
});
