#!/usr/bin/env node
// Motor de avisos. Lo corre GitHub Actions (ver .github/workflows/avisos.yml).
//
//   node avisos/enviar-avisos.mjs --modo=eventos|mediodia|diario|semanal [--simular] [--demo]
//
//   --simular  evalúa y muestra los avisos sin enviarlos ni registrarlos
//   --demo     usa los datos de ejemplo (no se conecta a Microsoft 365); implica --simular
//
// Variables de entorno (en GitHub: Settings → Secrets and variables → Actions):
//   AVISOS_TENANT_ID, AVISOS_CLIENT_ID   app "Seguimiento Ingeniería (avisos)" con credencial federada
//   SP_HOSTNAME, SP_RUTA                 sitio de SharePoint (p. ej. sipnology.sharepoint.com, /sites/Ingenieria)
//   APP_URL                              URL de la app en GitHub Pages
//
// El motor no envía nada directamente: deja cada aviso en la lista Notificaciones (cola) y un flujo de
// Power Automate con conectores estándar lo entrega por Teams y correo. Solo necesita Sites.Selected.

import { crearGraph } from '../src/graph.js';
import { crearSharePoint } from '../src/sharepoint.js';
import { LISTAS } from '../src/schema.js';
import {
  evaluarAlertas, fechaLocal, actividadDeItem, integranteDeItem, configuracionEfectiva, solicitudDeItem, MODOS,
  categoriaDeItem, clienteDeItem, proyectoDeItem, camposDeSolicitud, camposDeAviso,
} from '../src/logic.js';
import { semillaDemo } from '../src/demo-data.js';
import { crearProveedorToken } from './token.mjs';
import { tarjetaTeams, correo } from './mensajes.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const MODO = args.modo || 'diario';
const DEMO = !!args.demo;
const SIMULAR = DEMO || !!args.simular;
const TZ = 'America/Mexico_City';
const MAX_AVISOS = 200;
const env = (k, requerido = true) => {
  const v = process.env[k];
  if (requerido && !v) throw new Error(`Falta la variable de entorno ${k}`);
  return v;
};

if (!MODOS.includes(MODO)) {
  console.error(`Modo inválido "${MODO}". Usa ${MODOS.join(', ')}.`);
  process.exit(2);
}

async function cargarDatos(sp) {
  const desde = new Date(Date.now() - 60 * 86400000).toISOString();
  const [acts, eq, cats, clis, pros, sols, cfg, notif] = await Promise.all([
    sp.items(LISTAS.actividades), sp.items(LISTAS.equipo), sp.items(LISTAS.categorias), sp.items(LISTAS.clientes),
    sp.items(LISTAS.proyectos), sp.items(LISTAS.solicitudes), sp.items(LISTAS.configuracion),
    sp.items(LISTAS.notificaciones, { filtro: `fields/Enviado ge '${desde}'` }),
  ]);
  const guardada = {};
  for (const i of cfg) { try { guardada[i.fields.Title] = JSON.parse(i.fields.Valor || 'null'); } catch { /* se ignora */ } }
  const actividades = acts.map((i) => actividadDeItem(i, TZ));
  // Nombres al día desde los catálogos (por ID)
  const mapa = (l, f) => new Map(l.map(f).map((x) => [x.id, x.nombre]));
  const cat = mapa(cats, categoriaDeItem), cli = mapa(clis, clienteDeItem), pro = mapa(pros, proyectoDeItem);
  for (const a of actividades) {
    if (cat.has(a.categoriaId)) a.categoria = cat.get(a.categoriaId);
    if (cli.has(a.clienteId)) a.cliente = cli.get(a.clienteId);
    if (pro.has(a.proyectoId)) a.proyecto = pro.get(a.proyectoId);
  }
  return {
    actividades,
    equipo: eq.map(integranteDeItem),
    solicitudes: sols.map((i) => solicitudDeItem(i, TZ)),
    config: configuracionEfectiva(guardada),
    enviados: new Set(notif.map((i) => i.fields.Title)),
  };
}

/** Deja el aviso en la cola; el flujo de Power Automate lo entrega y marca el estado. */
async function encolar(sp, aviso, canales, appUrl, hoy) {
  const { asunto, html } = correo(aviso, appUrl, hoy);
  await sp.crear(LISTAS.notificaciones, camposDeAviso({
    llave: aviso.llave, regla: aviso.regla, actividadId: aviso.actividad?.id ?? null, destinatario: aviso.destinatario.email,
    asunto, html, tarjeta: canales.includes('teams') ? tarjetaTeams(aviso, appUrl) : null,
    enviarTeams: canales.includes('teams'), enviarCorreo: canales.includes('correo'),
  }));
}

async function principal() {
  const hoy = fechaLocal(new Date(), TZ);
  let datos, sp, graph;
  if (DEMO) {
    const sd = semillaDemo(hoy);
    datos = { actividades: sd.actividades, equipo: sd.equipo, solicitudes: sd.solicitudes.map((x) => ({ ...x, correoEnviado: false })), config: configuracionEfectiva(sd.config), enviados: new Set() };
  } else {
    graph = crearGraph(crearProveedorToken({ tenantId: env('AVISOS_TENANT_ID'), clientId: env('AVISOS_CLIENT_ID') }));
    sp = crearSharePoint(graph, { hostname: env('SP_HOSTNAME'), ruta: env('SP_RUTA') });
    datos = await cargarDatos(sp);
  }

  const avisos = evaluarAlertas({ hoy, modo: MODO, ...datos });
  console.log(`[${new Date().toISOString()}] modo=${MODO} hoy=${hoy} actividades=${datos.actividades.length} avisos=${avisos.length}${SIMULAR ? ' (simulación)' : ''}`);
  if (avisos.length > MAX_AVISOS) console.warn(`Hay ${avisos.length} avisos; solo se envían ${MAX_AVISOS} en esta corrida.`);

  if (SIMULAR) {
    for (const a of avisos) console.log(`  · ${a.regla.padEnd(24)} ${a.canal.padEnd(7)} → ${a.destinatario.email.padEnd(40)} ${a.asunto}`);
    return 0;
  }

  const appUrl = env('APP_URL');
  let fallidos = 0;
  for (const aviso of avisos.slice(0, MAX_AVISOS)) {
    const canales = aviso.canal === 'ambos' ? ['teams', 'correo'] : [aviso.canal];
    try {
      await encolar(sp, aviso, canales, appUrl, hoy);
      if (aviso.regla === 'solicitudFecha') await sp.actualizar(LISTAS.solicitudes, aviso.solicitud.id, camposDeSolicitud({ correoEnviado: true }));
      console.log(`  ✓ ${aviso.regla} → ${aviso.destinatario.email} (${canales.join('+')})`);
    } catch (e) {
      fallidos++;
      console.error(`  ✗ ${aviso.regla} → ${aviso.destinatario.email}: ${e.message}`);
    }
  }
  console.log(`Listo: ${Math.min(avisos.length, MAX_AVISOS) - fallidos} avisos en la cola, ${fallidos} con error.`);
  return fallidos ? 1 : 0;
}

principal().then((codigo) => process.exit(codigo)).catch((e) => {
  console.error(`Error: ${e.message}`);
  if (e.status === 403) console.error('Revisa que la app de avisos tenga permiso "write" sobre el sitio (Sites.Selected).');
  process.exit(1);
});
