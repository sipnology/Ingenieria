// Punto de entrada: sesión, carga de datos, barra de navegación y enrutador por hash.
import { CONFIG, esDemo } from './config.js';
import { fechaLocal, esLaPersona } from './logic.js';
import { crearGraph } from './graph.js';
import { crearSharePoint } from './sharepoint.js';
import { repoSharePoint, repoDemo } from './data.js';
import { esc, iniciales, toast, mensajeError } from './ui.js';
import { vistaTablero } from './vistas/tablero.js';
import { vistaActividades } from './vistas/actividades.js';
import { vistaFormulario } from './vistas/formulario.js';
import { vistaDetalle } from './vistas/detalle.js';
import { vistaAlertas } from './vistas/alertas.js';
import { vistaEquipo } from './vistas/equipo.js';
import { vistaConfiguracion } from './vistas/configuracion.js';
import { vistaCatalogos } from './vistas/catalogos.js';
import { vistaIndicadores } from './vistas/indicadores.js';
import { vistaAutorizar } from './vistas/autorizar.js';

const raiz = document.getElementById('app');
const estado = {
  usuario: null, yo: null, rol: 'Invitado', esDirector: false, demo: false,
  datos: null, hoy: fechaLocal(new Date(), CONFIG.zonaHoraria), tz: CONFIG.zonaHoraria,
  filtros: { texto: '', area: '', responsable: '', cliente: '', categoria: '', situacion: 'abiertas', vista: 'tablero' },
  areaTablero: '', modoTablero: null, errorCarga: null,
};
let repo = null;
let main = null;

const RUTAS = {
  '': vistaTablero,
  actividades: vistaActividades,
  nueva: vistaFormulario,
  editar: vistaFormulario,
  actividad: vistaDetalle,
  alertas: vistaAlertas,
  equipo: vistaEquipo,
  configuracion: vistaConfiguracion,
  catalogos: vistaCatalogos,
  indicadores: vistaIndicadores,
  autorizar: vistaAutorizar,
};
const SOLO_DIRECTOR = new Set(['alertas', 'equipo']);
// Catálogos: todo el equipo (clientes y oportunidades); categorías y bajas, director y líderes
const DEL_EQUIPO = new Set(['catalogos']);

function navegar(hash) {
  if (location.hash === hash) enrutar();
  else location.hash = hash;
}

/** Los nombres vienen del catálogo (por ID): si se renombra una categoría o cliente, se ve al instante. */
function normalizarNombres(d) {
  const mapa = (l) => new Map(l.map((x) => [x.id, x.nombre]));
  const cat = mapa(d.categorias), cli = mapa(d.clientes), pro = mapa(d.proyectos);
  for (const a of d.actividades) {
    if (a.categoriaId && cat.has(a.categoriaId)) a.categoria = cat.get(a.categoriaId);
    if (a.clienteId && cli.has(a.clienteId)) a.cliente = cli.get(a.clienteId);
    if (a.proyectoId && pro.has(a.proyectoId)) a.proyecto = pro.get(a.proyectoId);
  }
}

async function recargar() {
  estado.hoy = fechaLocal(new Date(), estado.tz);
  try {
    estado.datos = await repo.cargar();
    estado.errorCarga = null;
    normalizarNombres(estado.datos);
  } catch (e) {
    estado.datos = { actividades: [], equipo: [], categorias: [], clientes: [], proyectos: [], solicitudes: [], config: null };
    estado.errorCarga = e;
  }
  const cuenta = estado.usuario.upn || estado.usuario.email;
  estado.yo = estado.datos.equipo.find((p) => esLaPersona(p, cuenta)) || null;
  // El correo de la lista Equipo es el que identifica al dueño de las actividades
  if (estado.yo?.email) estado.usuario.email = estado.yo.email;
  estado.rol = estado.yo?.rol || 'Invitado';
  estado.esDirector = estado.rol === 'Director';
}

function dibujarMarco() {
  const u = estado.usuario;
  const enlaces = [
    ['', 'Tablero'],
    ['actividades', 'Actividades'],
    ...(estado.esDirector ? [] : [['nueva', 'Nueva actividad']]),
    ['indicadores', 'Indicadores'],
    ...(estado.yo ? [['catalogos', 'Catálogos']] : []),
    ...(estado.esDirector ? [['equipo', 'Equipo'], ['alertas', 'Alertas']] : []),
  ];
  raiz.innerHTML = `
    <a class="oculto-visual" href="#contenido">Saltar al contenido</a>
    <header class="barra">
      <div class="barra__int">
        <a class="marca" href="#/"><span class="marca__icono" aria-hidden="true"></span>Sipnology <span>· Ingeniería</span></a>
        <nav class="nav" aria-label="Principal">
          ${enlaces.map(([r, t]) => `<a href="#/${r}" data-ruta="${r}">${t}</a>`).join('')}
        </nav>
        <div class="usuario">
          <span class="avatar" aria-hidden="true">${esc(iniciales(u.nombre))}</span>
          <span class="usuario__datos"><b>${esc(u.nombre)}</b><small>${esc(estado.yo ? `${estado.rol}${estado.yo.area ? ` · ${estado.yo.area}` : ''}` : 'Fuera de la lista Equipo')}</small></span>
          ${estado.demo ? '' : '<button type="button" data-salir>Salir</button>'}
        </div>
      </div>
    </header>
    ${estado.demo ? `<div class="banner-demo"><div><span>Modo demostración: datos de ejemplo que viven solo en esta pestaña.</span>
      <span>Ver como: <a href="?demo=director">Director</a> · <a href="?demo=ingeniero">Ingeniero</a></span></div></div>` : ''}
    <main class="contenido" id="contenido" tabindex="-1"></main>`;
  main = raiz.querySelector('main');
  raiz.querySelector('[data-salir]')?.addEventListener('click', async () => (await import('./auth.js')).cerrarSesion());
}

function marcarNav(ruta) {
  for (const a of raiz.querySelectorAll('.nav a')) {
    if (a.dataset.ruta === ruta || (['actividad', 'editar', 'autorizar'].includes(ruta) && a.dataset.ruta === 'actividades')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

async function enrutar() {
  const partes = (location.hash.replace(/^#\/?/, '') || '').split('/');
  let ruta = partes[0] || '';
  const param = partes[1];

  if (estado.errorCarga?.codigo === 'listaNoExiste' && ruta !== 'configuracion') ruta = 'configuracion';
  if (SOLO_DIRECTOR.has(ruta) && !estado.esDirector) ruta = '';
  if (ruta === 'nueva' && estado.esDirector) ruta = 'actividades'; // el director no registra actividades
  if (DEL_EQUIPO.has(ruta) && !estado.yo) ruta = '';
  const vista = RUTAS[ruta] || vistaTablero;

  marcarNav(ruta);
  // Contenedor nuevo en cada vista: así no se acumulan los manejadores de eventos de la vista anterior
  const nuevo = main.cloneNode(false);
  main.replaceWith(nuevo);
  main = nuevo;
  main.innerHTML = '<div class="cargando">Cargando…</div>';
  window.scrollTo(0, 0);
  try {
    if (estado.errorCarga && estado.errorCarga.codigo !== 'listaNoExiste' && ruta !== 'configuracion') {
      main.innerHTML = `<div class="aviso aviso--error"><b>No se pudieron leer los datos de SharePoint.</b><br>${esc(mensajeError(estado.errorCarga))}</div>
        <div class="acciones"><button class="btn btn--oscuro" type="button" data-reintentar>Reintentar</button></div>`;
      main.querySelector('[data-reintentar]').addEventListener('click', async () => { await recargar(); dibujarMarco(); enrutar(); });
      return;
    }
    await vista({ estado, repo, main, param, ruta, navegar, recargar: async () => { await recargar(); }, refrescar: () => enrutar() });
    const h1 = main.querySelector('h1');
    if (h1) document.title = `${h1.textContent} · Ingeniería Sipnology`;
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="aviso aviso--error">${esc(mensajeError(e))}</div>`;
  }
}

async function arrancar() {
  estado.demo = esDemo();
  if (estado.demo) {
    const modo = new URLSearchParams(location.search).get('demo');
    estado.usuario = modo === 'ingeniero'
      ? { nombre: 'Luis M.', email: 'luis.m@sipnology.com.mx', upn: 'luis.m@sipnology.com.mx' }
      : { nombre: 'Fernando Fernández', email: 'fernando.fernandez@sipnology.com.mx', upn: 'fernando.fernandez@sipnology.com.mx' };
    repo = repoDemo(estado.hoy, estado.usuario);
  } else {
    const auth = await import('./auth.js');
    estado.usuario = await auth.iniciar();
    if (!estado.usuario) return; // redirigiendo a Entra ID
    const sp = crearSharePoint(crearGraph((scopes) => auth.obtenerToken(scopes)), CONFIG.sitio);
    const spConfiguracion = crearSharePoint(crearGraph(() => auth.obtenerToken(auth.SCOPES_CONFIGURACION)), CONFIG.sitio);
    const graphDirectorio = crearGraph(() => auth.obtenerToken(auth.SCOPES_DIRECTORIO));
    repo = repoSharePoint({ sp, tz: CONFIG.zonaHoraria, spConfiguracion, graphDirectorio });
  }
  await recargar();
  dibujarMarco();
  window.addEventListener('hashchange', enrutar);
  await enrutar();
}

arrancar().catch((e) => {
  console.error(e);
  raiz.innerHTML = `<main class="contenido"><div class="aviso aviso--error"><b>No se pudo iniciar la aplicación.</b><br>${esc(mensajeError(e))}</div></main>`;
  toast('No se pudo iniciar la aplicación', { error: true });
});
