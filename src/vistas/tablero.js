// Tablero: vista del equipo (director / líderes) y "Mi semana" (cada ingeniero).
import { AREAS } from '../schema.js';
import {
  indicadores, cargaPorPersona, situacion, estaAbierta, accionPendiente, sumarDias, fechaCorta,
  fechaLocal, diasHabiles, semanaISO, finSemana, textoDiasHabiles,
} from '../logic.js';
import { esc, pillEstado, textoFecha, etqArea } from '../ui.js';
import { htmlCarga, responderPeticion, cerrarPeticion, avanceRapido } from './comun.js';

export async function vistaTablero(ctx) {
  const { estado, main } = ctx;
  // El director no registra actividades: siempre ve el tablero del equipo
  if (estado.esDirector) estado.modoTablero = 'equipo';
  else if (!estado.modoTablero) estado.modoTablero = estado.rol === 'Líder' ? 'equipo' : 'personal';
  if (estado.rol === 'Líder' && estado.areaTablero === '' && estado.yo?.area && !estado._areaInicial) {
    estado.areaTablero = estado.yo.area;
    estado._areaInicial = true;
  }
  const html = estado.modoTablero === 'equipo' ? tableroEquipo(estado) : tableroPersonal(estado);
  main.innerHTML = html;
  conectar(ctx);
}

function cabecera(estado, kicker, titulo, extra = '') {
  const semana = semanaISO(estado.hoy).slice(-2);
  const alternar = estado.esDirector ? '' : `<div class="segmentado" role="group" aria-label="Vista del tablero">
    <button type="button" data-modo="equipo" aria-pressed="${estado.modoTablero === 'equipo'}">Equipo</button>
    <button type="button" data-modo="personal" aria-pressed="${estado.modoTablero === 'personal'}">Mi semana</button></div>`;
  return `<div class="encabezado">
    <div class="encabezado__txt"><div class="kicker">${kicker}</div><h1>${titulo}</h1>
      <p class="sub">Semana ${semana} · al ${esc(fechaCorta(finSemana(estado.hoy)))} · hoy ${esc(fechaCorta(estado.hoy))}</p></div>
    <div class="acciones">${extra}${alternar}</div></div>`;
}

function tableroEquipo(estado) {
  const { hoy } = estado;
  const area = estado.areaTablero;
  const todas = estado.datos.actividades.filter((a) => !area || a.area === area);
  const equipo = estado.datos.equipo.filter((p) => !area || p.area === area);
  const k = indicadores(todas, hoy, estado.datos.config?.diasFeriados);
  const carga = cargaPorPersona(todas, equipo, hoy, estado.datos.config?.capacidadDefecto);
  const abiertas = todas.filter(estaAbierta);
  const peticiones = abiertas.filter((a) => accionPendiente(a) && a.accionDe === 'Director')
    .sort((a, b) => (a.accionFecha || a.fechaCompromiso || '9').localeCompare(b.accionFecha || b.fechaCompromiso || '9'));
  const limite = sumarDias(hoy, 7);
  const proximas = abiertas.filter((a) => a.fechaCompromiso && a.fechaCompromiso <= limite)
    .sort((a, b) => a.fechaCompromiso.localeCompare(b.fechaCompromiso));
  const porArea = AREAS.filter((x) => k.porArea[x]).map((x) => `${x} ${k.porArea[x]}`).join(' · ') || 'Sin actividades abiertas';
  const otras = Object.entries(k.otrasAreas).sort((a, b) => b[1].length - a[1].length);

  const chips = `<div class="chips" role="group" aria-label="Filtrar por área">
    <button type="button" class="chip" data-area="" aria-pressed="${!area}">Todas las áreas</button>
    ${AREAS.map((x) => `<button type="button" class="chip" data-area="${esc(x)}" aria-pressed="${area === x}">${esc(x)}</button>`).join('')}</div>`;

  const tituloPeticiones = estado.esDirector ? 'Requiere tu acción' : 'Esperan respuesta del director';
  const idsVisibles = new Set(todas.map((a) => a.id));
  const solicitudes = estado.datos.solicitudes.filter((x) => x.estatus === 'Pendiente' && idsVisibles.has(x.actividadId))
    .map((x) => ({ ...x, actividad: todas.find((a) => a.id === x.actividadId) }));
  const totalDirector = peticiones.length + solicitudes.length;
  return `${cabecera(estado, 'Ingeniería · vista del equipo', 'Tablero de seguimiento')}
    ${chips}
    <section class="kpis" aria-label="Indicadores">
      <a class="kpi" href="#/actividades"><span class="kpi__etq">Actividades abiertas</span><span class="kpi__num">${k.abiertas}</span><span class="kpi__det">${esc(porArea)}</span></a>
      <div class="kpi"><span class="kpi__etq">Vencen esta semana</span><span class="kpi__num">${k.venceSemana}</span><span class="kpi__det">${k.riesgoSemana} en riesgo</span></div>
      <a class="kpi ${k.vencidas ? 'kpi--alerta' : ''}" href="#/actividades" data-situacion="vencidas"><span class="kpi__etq">Vencidas</span><span class="kpi__num">${k.vencidas}</span><span class="kpi__det">${k.vencidas ? `La más antigua: ${textoDiasHabiles(k.maxDiasVencida)}` : 'Todo al corriente'}</span></a>
      <div class="kpi ${totalDirector ? 'kpi--oscuro' : ''}"><span class="kpi__etq">${estado.esDirector ? 'Requieren tu acción' : 'Esperan al director'}</span><span class="kpi__num">${totalDirector}</span><span class="kpi__det">${solicitudes.length ? `${solicitudes.length} cambio${solicitudes.length === 1 ? '' : 's'} de fecha por autorizar` : k.directorUrgentes ? `${k.directorUrgentes} para hoy o mañana` : 'Nada urgente'}</span></div>
      <div class="kpi"><span class="kpi__etq">Esperando a otras áreas</span><span class="kpi__num">${k.esperandoAreas}</span><span class="kpi__det">${esc(otras.map(([x, l]) => `${x} ${l.length}`).join(' · ') || 'Ninguna')}</span></div>
    </section>
    <div class="columnas">
      <div class="col-principal">
        <section class="tarjeta" aria-labelledby="t-pet">
          <div class="tarjeta__cab"><h2 id="t-pet">${tituloPeticiones}</h2><span class="tarjeta__nota">${totalDirector} pendiente${totalDirector === 1 ? '' : 's'}</span></div>
          ${solicitudes.map((x) => solicitudHtml(x, estado)).join('')}
          ${peticiones.map((a) => peticionHtml(a, estado)).join('')}
          ${totalDirector ? '' : '<p class="vacio">No hay nada pendiente para el director.</p>'}
        </section>
        <section class="tarjeta" aria-labelledby="t-fechas">
          <div class="tarjeta__cab"><h2 id="t-fechas">Próximas fechas compromiso</h2><span class="tarjeta__nota">Vencidas y siguientes 7 días</span></div>
          ${tablaActividades(proximas, hoy, 'No hay fechas compromiso en los próximos 7 días.')}
        </section>
      </div>
      <div class="col-lateral">
        <section class="tarjeta" aria-labelledby="t-carga">
          <div class="tarjeta__cab"><h2 id="t-carga">Carga de la semana</h2></div>
          <p class="tarjeta__nota" style="margin:-8px 0 0">Horas estimadas pendientes vs. capacidad</p>
          ${htmlCarga(carga)}
        </section>
        <section class="tarjeta" aria-labelledby="t-otras">
          <h2 id="t-otras">Esperando a otras áreas</h2>
          ${otras.length ? otras.map(([x, l]) => {
            const masVieja = l.reduce((m, a) => Math.max(m, a.ultimaActualizacion ? diasHabiles(fechaLocal(a.ultimaActualizacion), hoy) : 0), 0);
            return `<div class="espera"><div class="espera__txt"><b>${esc(x)}</b>
              ${l.map((a) => `<span><a href="#/actividad/${a.id}">${esc(a.accionDetalle || a.titulo)}</a> · ${esc(a.responsableNombre)}</span>`).join('')}
              ${masVieja >= 2 ? `<span class="txt-vencida">${masVieja} días hábiles esperando</span>` : ''}</div>
              <span class="espera__num">${l.length}</span></div>`;
          }).join('') : '<p class="vacio">Nadie está esperando a otra área.</p>'}
        </section>
      </div>
    </div>`;
}

function peticionHtml(a, estado) {
  const limite = a.accionFecha || a.fechaCompromiso;
  let urgencia = '<span class="pill pill--sin">Sin fecha</span>';
  if (limite) {
    const d = diasHabiles(estado.hoy, limite);
    if (limite < estado.hoy) urgencia = '<span class="pill pill--vencida">Atrasada</span>';
    else if (limite === estado.hoy) urgencia = '<span class="pill pill--riesgo">Para hoy</span>';
    else if (d <= 1) urgencia = '<span class="pill pill--riesgo">Para mañana</span>';
    else urgencia = `<span class="pill pill--sin">Para el ${esc(fechaCorta(limite))}</span>`;
  }
  const boton = estado.esDirector
    ? `<button type="button" class="btn btn--oscuro" data-responder="${a.id}">Responder</button>`
    : '';
  return `<div class="peticion">
    <div class="peticion__txt">
      <div class="fila-meta">${urgencia}${etqArea(a.area)}</div>
      <div class="peticion__titulo">${esc(a.accionDetalle || 'Sin detalle')}</div>
      <div class="peticion__meta">Lo pide ${esc(a.responsableNombre)} · <a href="#/actividad/${a.id}">${esc(a.titulo)}</a></div>
    </div>
    <div class="acciones">${boton}<a class="btn" href="#/actividad/${a.id}">Ver detalle</a></div>
  </div>`;
}

function solicitudHtml(x, estado) {
  const a = x.actividad;
  return `<div class="peticion">
    <div class="peticion__txt">
      <div class="fila-meta"><span class="pill pill--riesgo">Cambio de fecha</span>${etqArea(a.area)}</div>
      <div class="peticion__titulo">${esc(fechaCorta(x.fechaActual))} → ${esc(fechaCorta(x.fechaPropuesta))} · ${esc(a.titulo)}</div>
      <div class="peticion__meta">Lo pide ${esc(x.solicitanteNombre)} · ${esc(x.justificacion)}</div>
    </div>
    <div class="acciones">${estado.esDirector ? `<a class="btn btn--oscuro" href="#/autorizar/${x.id}">Autorizar</a>` : ''}<a class="btn" href="#/actividad/${a.id}">Ver detalle</a></div>
  </div>`;
}

export function tablaActividades(lista, hoy, vacio, { responsable = true } = {}) {
  if (!lista.length) return `<p class="vacio">${esc(vacio)}</p>`;
  return `<div class="tabla-caja"><table class="tabla">
    <thead><tr><th scope="col">Actividad</th><th scope="col">Cliente / proyecto</th>${responsable ? '<th scope="col">Responsable</th>' : '<th scope="col">Área</th>'}<th scope="col">Compromiso</th><th scope="col">Estado</th></tr></thead>
    <tbody>${lista.map((a) => `<tr>
      <td><a href="#/actividad/${a.id}">${esc(a.titulo)}</a></td>
      <td>${esc(a.cliente || '—')}${a.proyecto ? `<br><span class="tarjeta__nota">${esc(a.proyecto)}</span>` : ''}</td>
      <td>${responsable ? esc(a.responsableNombre || '—') : esc(a.area)}</td>
      <td>${textoFecha(a, hoy)}</td>
      <td>${pillEstado(a, hoy)}</td></tr>`).join('')}</tbody></table></div>`;
}

function tableroPersonal(estado) {
  const { hoy } = estado;
  const yo = estado.usuario.email;
  const mias = estado.datos.actividades.filter((a) => a.responsableEmail === yo || a.colaboradores.includes(yo));
  const responsable = mias.filter((a) => a.responsableEmail === yo);
  const abiertas = mias.filter(estaAbierta).sort((a, b) => (a.fechaCompromiso || '9').localeCompare(b.fechaCompromiso || '9'));
  const k = indicadores(responsable, hoy);
  const miCarga = cargaPorPersona(responsable, estado.datos.equipo.filter((p) => p.email === yo), hoy, estado.datos.config?.capacidadDefecto).find((f) => f.email === yo);
  const feriados = estado.datos.config?.diasFeriados || [];

  const atencion = [];
  for (const a of responsable.filter(estaAbierta)) {
    const s = situacion(a, hoy, feriados);
    if (a.requiereAccion && a.accionResuelta && a.accionRespuesta) atencion.push({ a, motivo: `Te respondieron (${a.accionDe}): ${a.accionRespuesta}`, tipo: 'respuesta' });
    else if (s.clave === 'vencida') atencion.push({ a, motivo: `Vencida hace ${textoDiasHabiles(s.dias)}: pide cambio de fecha o márcala como completada`, tipo: 'avance' });
    else if (s.clave === 'hoy' || s.clave === 'proxima') atencion.push({ a, motivo: s.clave === 'hoy' ? 'Vence hoy' : `Vence en ${s.dias} día${s.dias === 1 ? '' : 's'} hábil${s.dias === 1 ? '' : 'es'}`, tipo: 'avance' });
    else if (a.ultimaActualizacion && diasHabiles(fechaLocal(a.ultimaActualizacion), hoy, feriados) >= 5) atencion.push({ a, motivo: 'Lleva más de 5 días hábiles sin actualizar', tipo: 'avance' });
  }
  const espero = responsable.filter(accionPendiente);
  const misSolicitudes = estado.datos.solicitudes.filter((x) => x.solicitanteEmail === yo && (x.estatus === 'Pendiente' || (x.fechaResolucion && Date.now() - new Date(x.fechaResolucion) < 3 * 86400000)));
  const nombre = estado.usuario.nombre.split(' ')[0];

  return `${cabecera(estado, 'Mi semana', `Hola, ${esc(nombre)}`, '<a class="btn btn--primario" href="#/nueva">+ Nueva actividad</a>')}
    ${!estado.yo ? '<div class="aviso aviso--info">Aún no estás en la lista del equipo. Puedes registrar actividades, pero pide al director que te agregue para que tu carga aparezca en el tablero.</div>' : ''}
    <section class="kpis" aria-label="Mis indicadores">
      <div class="kpi"><span class="kpi__etq">Mis actividades abiertas</span><span class="kpi__num">${k.abiertas}</span><span class="kpi__det">${abiertas.length - k.abiertas} más como colaborador</span></div>
      <div class="kpi"><span class="kpi__etq">Vencen esta semana</span><span class="kpi__num">${k.venceSemana}</span><span class="kpi__det">${k.riesgoSemana} en riesgo</span></div>
      <div class="kpi ${k.vencidas ? 'kpi--alerta' : ''}"><span class="kpi__etq">Vencidas</span><span class="kpi__num">${k.vencidas}</span><span class="kpi__det">${k.vencidas ? 'Actualízalas hoy' : 'Todo al corriente'}</span></div>
      <div class="kpi ${miCarga?.sobrecarga ? 'kpi--alerta' : ''}"><span class="kpi__etq">Mi carga esta semana</span><span class="kpi__num">${miCarga ? miCarga.horas : 0} h</span><span class="kpi__det">de ${miCarga ? miCarga.capacidad : estado.datos.config?.capacidadDefecto || 40} h de capacidad</span></div>
    </section>
    <div class="columnas">
      <div class="col-principal">
        <section class="tarjeta" aria-labelledby="t-aten">
          <div class="tarjeta__cab"><h2 id="t-aten">Requiere tu atención</h2></div>
          ${atencion.length ? atencion.map(({ a, motivo, tipo }) => `<div class="peticion">
            <div class="peticion__txt"><div class="fila-meta">${pillEstado(a, hoy)}${etqArea(a.area)}</div>
              <div class="peticion__titulo"><a href="#/actividad/${a.id}" style="color:inherit;text-decoration:none">${esc(a.titulo)}</a></div>
              <div class="peticion__meta">${esc(motivo)}</div></div>
            <div class="acciones">${tipo === 'respuesta'
              ? `<button type="button" class="btn btn--oscuro" data-enterado="${a.id}">Enterado</button>`
              : `<button type="button" class="btn btn--oscuro" data-avance="${a.id}">Registrar avance</button>`}
              <a class="btn" href="#/editar/${a.id}">Editar</a></div></div>`).join('') : '<p class="vacio">Nada pendiente. Bien.</p>'}
        </section>
        <section class="tarjeta" aria-labelledby="t-mias">
          <div class="tarjeta__cab"><h2 id="t-mias">Mis actividades abiertas</h2><a href="#/actividades" data-mias>Ver en tablero</a></div>
          ${tablaActividades(abiertas, hoy, 'No tienes actividades abiertas. Registra lo que estás haciendo para que el equipo lo vea.', { responsable: false })}
        </section>
      </div>
      <div class="col-lateral">
        <section class="tarjeta" aria-labelledby="t-micarga">
          <h2 id="t-micarga">Mi carga</h2>
          ${miCarga ? htmlCarga([miCarga]) : '<p class="vacio">Sin horas estimadas abiertas.</p>'}
        </section>
        <section class="tarjeta" aria-labelledby="t-espero">
          <h2 id="t-espero">Lo que espero de otros</h2>
          ${misSolicitudes.map((x) => `<div class="espera"><div class="espera__txt"><b>Cambio de fecha · ${esc(x.estatus)}</b>
            <span><a href="#/actividad/${x.actividadId}">${esc(x.titulo)}</a> · ${esc(fechaCorta(x.fechaActual))} → ${esc(fechaCorta(x.fechaPropuesta))}</span>
            ${x.comentario ? `<span>${esc(x.comentario)}</span>` : ''}</div></div>`).join('')}
          ${espero.length || misSolicitudes.length ? espero.map((a) => `<div class="espera"><div class="espera__txt"><b>${esc(a.accionDe)}</b>
            <span><a href="#/actividad/${a.id}">${esc(a.accionDetalle || a.titulo)}</a>${a.accionFecha ? ` · para el ${esc(fechaCorta(a.accionFecha))}` : ''}</span></div>
            <button type="button" class="btn btn--texto" data-cerrar="${a.id}">Ya no lo necesito</button></div>`).join('') : '<p class="vacio">No estás esperando nada de nadie.</p>'}
        </section>
      </div>
    </div>`;
}

function conectar(ctx) {
  const { estado, main } = ctx;
  const buscar = (id) => estado.datos.actividades.find((a) => a.id === Number(id));
  const tras = async (promesa) => { if (await promesa) { await ctx.recargar(); ctx.refrescar(); } };
  main.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.modo) { estado.modoTablero = t.dataset.modo; ctx.refrescar(); }
    else if ('area' in t.dataset) { estado.areaTablero = t.dataset.area; ctx.refrescar(); }
    else if (t.dataset.responder) tras(responderPeticion(ctx, buscar(t.dataset.responder)));
    else if (t.dataset.avance) tras(avanceRapido(ctx, buscar(t.dataset.avance)));
    else if (t.dataset.enterado || t.dataset.cerrar) tras(cerrarPeticion(ctx, buscar(t.dataset.enterado || t.dataset.cerrar)));
    else if (t.dataset.situacion) { estado.filtros = { ...estado.filtros, situacion: t.dataset.situacion, area: estado.areaTablero }; }
    else if ('mias' in t.dataset) { estado.filtros = { ...estado.filtros, responsable: estado.usuario.email }; }
  });
}
