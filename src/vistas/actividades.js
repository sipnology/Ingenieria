// Actividades de todo el equipo: filtros + vista de tablero (columnas por estatus) o lista.
import { AREAS } from '../schema.js';
import { estaAbierta, situacion, enRiesgo, accionPendiente, sumarDias } from '../logic.js';
import { esc, pillEstado, etqArea, textoFecha } from '../ui.js';

const SITUACIONES = [
  ['abiertas', 'Abiertas'],
  ['vencidas', 'Vencidas'],
  ['riesgo', 'En riesgo'],
  ['accion', 'Requieren acción'],
  ['semana', 'Vencen en 7 días'],
  ['cerradas', 'Cerradas (30 días)'],
  ['todas', 'Todas'],
];

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function filtrar(estado) {
  const f = estado.filtros;
  const { hoy } = estado;
  const q = norm(f.texto);
  const hace30 = sumarDias(hoy, -30);
  return estado.datos.actividades.filter((a) => {
    if (f.area && a.area !== f.area) return false;
    if (f.responsable && a.responsableEmail !== f.responsable && !a.colaboradores.includes(f.responsable)) return false;
    if (f.cliente && a.cliente !== f.cliente) return false;
    if (f.categoria && a.categoria !== f.categoria) return false;
    if (q && !norm(`${a.titulo} ${a.cliente} ${a.proyecto} ${a.categoria} ${a.responsableNombre} ${a.accionDetalle}`).includes(q)) return false;
    switch (f.situacion) {
      case 'abiertas': return estaAbierta(a);
      case 'vencidas': return situacion(a, hoy).clave === 'vencida';
      case 'riesgo': return enRiesgo(a, hoy);
      case 'accion': return accionPendiente(a);
      case 'semana': return estaAbierta(a) && a.fechaCompromiso && a.fechaCompromiso <= sumarDias(hoy, 7);
      case 'cerradas': return !estaAbierta(a) && (a.fechaCompletada || a.fechaCompromiso || '') >= hace30;
      default: return true;
    }
  }).sort((a, b) => (a.fechaCompromiso || '9999').localeCompare(b.fechaCompromiso || '9999'));
}

function tarjeta(a, hoy) {
  const s = situacion(a, hoy);
  const alerta = s.clave === 'vencida' || enRiesgo(a, hoy) || accionPendiente(a);
  const accion = accionPendiente(a) ? `<div class="tact__accion">Espera a: ${esc(a.accionDe)} · ${esc(a.accionDetalle)}</div>` : '';
  const respondida = a.requiereAccion && a.accionResuelta ? `<div class="tact__meta">Respuesta de ${esc(a.accionDe)} recibida</div>` : '';
  return `<a class="tact ${alerta ? 'tact--alerta' : ''}" href="#/actividad/${a.id}">
    <div class="fila-meta">${etqArea(a.area)}${pillEstado(a, hoy)}${a.prioridad === 'Alta' ? '<span class="etq etq--prio-alta">Alta</span>' : ''}</div>
    <h3>${esc(a.titulo)}</h3>
    <div class="tact__meta">${esc(a.categoria)}</div>
    <div class="tact__meta">${esc([a.cliente, a.proyecto].filter(Boolean).join(' · ') || 'Sin cliente')}${a.horasEstimadas ? ` · ${a.horasEstimadas} h` : ''}${estaAbierta(a) ? ` · ${Math.round(a.avance)}%` : ''}</div>
    ${estaAbierta(a) && a.avance > 0 ? `<div class="progreso" aria-hidden="true"><div style="width:${Math.min(100, a.avance)}%"></div></div>` : ''}
    ${accion}${respondida}
    <div class="tact__pie"><span>${esc(a.responsableNombre || '—')}${a.colaboradores.length ? ` +${a.colaboradores.length}` : ''}</span><span>${textoFecha(a, hoy)}</span></div>
  </a>`;
}

function kanban(lista, hoy) {
  const columnas = [
    ['Sin iniciar', (a) => a.estatus === 'Sin iniciar'],
    ['En curso', (a) => a.estatus === 'En curso'],
    ['En espera / bloqueada', (a) => a.estatus === 'En espera' || a.estatus === 'Bloqueada'],
    ['Cerradas', (a) => !estaAbierta(a)],
  ];
  return `<div class="kanban">${columnas.map(([titulo, pred]) => {
    const items = lista.filter(pred);
    if (titulo === 'Cerradas' && !items.length) return '';
    return `<section class="columna" aria-label="${esc(titulo)}">
      <div class="columna__cab"><h2>${esc(titulo)}</h2><span>${items.length}</span></div>
      ${items.length ? items.map((a) => tarjeta(a, hoy)).join('') : '<p class="vacio">Nada aquí.</p>'}
    </section>`;
  }).join('')}</div>`;
}

function lista(items, hoy) {
  if (!items.length) return '<p class="vacio">No hay actividades con estos filtros.</p>';
  return `<div class="tarjeta" style="padding:0;overflow:hidden"><div class="tabla-caja"><table class="tabla">
    <thead><tr><th scope="col">Actividad</th><th scope="col">Área</th><th scope="col">Cliente / proyecto</th><th scope="col">Responsable</th><th scope="col">Compromiso</th><th scope="col">Avance</th><th scope="col">Estado</th><th scope="col">Espera a</th></tr></thead>
    <tbody>${items.map((a) => `<tr>
      <td><a href="#/actividad/${a.id}">${esc(a.titulo)}</a><br><span class="tarjeta__nota">${esc(a.categoria)}</span></td>
      <td>${etqArea(a.area)}</td><td>${esc(a.cliente || '—')}<br><span class="tarjeta__nota">${esc(a.proyecto)}</span></td><td>${esc(a.responsableNombre || '—')}</td>
      <td>${textoFecha(a, hoy)}</td><td>${Math.round(a.avance)}%</td><td>${pillEstado(a, hoy)}</td>
      <td>${accionPendiente(a) ? `<b>${esc(a.accionDe)}</b>` : '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
}

export async function vistaActividades(ctx) {
  const { estado, main } = ctx;
  const f = estado.filtros;
  const personas = [...new Map(estado.datos.equipo.filter((p) => p.activo).map((p) => [p.email, p.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const clientes = [...new Set(estado.datos.actividades.map((a) => a.cliente).filter(Boolean))].sort();
  const categorias = [...new Set(estado.datos.actividades.filter((a) => !f.area || a.area === f.area).map((a) => a.categoria).filter(Boolean))].sort();
  const opt = (v, t, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`;

  main.innerHTML = `
    <div class="encabezado">
      <div class="encabezado__txt"><div class="kicker">Ingeniería · todo el equipo</div><h1>Actividades</h1>
        <p class="sub">Todos ven todo; cada quien actualiza lo suyo.</p></div>
      ${estado.esDirector ? '' : '<a class="btn btn--primario" href="#/nueva">+ Nueva actividad</a>'}
    </div>
    <form class="filtros" role="search" data-filtros>
      <div class="campo campo--ancho"><label for="f-q">Buscar</label><input id="f-q" name="texto" type="search" value="${esc(f.texto)}" placeholder="Actividad, cliente, proyecto, categoría…"></div>
      <div class="campo"><label for="f-sit">Mostrar</label><select id="f-sit" name="situacion">${SITUACIONES.map(([v, t]) => opt(v, t, f.situacion)).join('')}</select></div>
      <div class="campo"><label for="f-area">Área</label><select id="f-area" name="area">${opt('', 'Todas', f.area)}${AREAS.map((x) => opt(x, x, f.area)).join('')}</select></div>
      <div class="campo"><label for="f-resp">Persona</label><select id="f-resp" name="responsable">${opt('', 'Todas', f.responsable)}${personas.map(([e, n]) => opt(e, n, f.responsable)).join('')}</select></div>
      <div class="campo"><label for="f-cat">Categoría</label><select id="f-cat" name="categoria">${opt('', 'Todas', f.categoria)}${categorias.map((c) => opt(c, c, f.categoria)).join('')}</select></div>
      <div class="campo"><label for="f-cli">Cliente</label><select id="f-cli" name="cliente">${opt('', 'Todos', f.cliente)}${clientes.map((c) => opt(c, c, f.cliente)).join('')}</select></div>
      <div class="segmentado" role="group" aria-label="Vista">
        <button type="button" data-vista="tablero" aria-pressed="${f.vista === 'tablero'}">Tablero</button>
        <button type="button" data-vista="lista" aria-pressed="${f.vista === 'lista'}">Lista</button>
      </div>
    </form>
    <p class="tarjeta__nota" data-conteo aria-live="polite"></p>
    <div data-resultados></div>`;

  const res = main.querySelector('[data-resultados]');
  const conteo = main.querySelector('[data-conteo]');
  const pintar = () => {
    const items = filtrar(estado);
    conteo.textContent = `${items.length} actividad${items.length === 1 ? '' : 'es'}`;
    res.innerHTML = f.vista === 'lista' ? lista(items, estado.hoy) : (items.length ? kanban(items, estado.hoy) : '<p class="vacio">No hay actividades con estos filtros.</p>');
  };
  const form = main.querySelector('[data-filtros]');
  form.addEventListener('input', () => {
    Object.assign(f, { texto: form.texto.value, situacion: form.situacion.value, area: form.area.value, responsable: form.responsable.value, cliente: form.cliente.value, categoria: form.categoria.value });
    pintar();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vista]');
    if (!b) return;
    f.vista = b.dataset.vista;
    for (const x of form.querySelectorAll('[data-vista]')) x.setAttribute('aria-pressed', String(x === b));
    pintar();
  });
  pintar();
}

