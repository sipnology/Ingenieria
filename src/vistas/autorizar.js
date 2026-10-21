// Pantalla a la que lleva el botón "Autorizar" del correo: la actividad, la justificación y la decisión.
import { fechaLarga, fechaCorta } from '../logic.js';
import { esc, etqArea, pillEstado, fechaHora, toast, mensajeError } from '../ui.js';
import { resolverSolicitud } from './comun.js';

export async function vistaAutorizar(ctx) {
  const { estado, main, param } = ctx;
  const s = estado.datos.solicitudes.find((x) => x.id === Number(param));
  const a = s && estado.datos.actividades.find((x) => x.id === s.actividadId);
  if (!s || !a) {
    main.innerHTML = '<div class="aviso aviso--error">No encontré esa solicitud de cambio de fecha (puede que la actividad se haya borrado). <a href="#/">Ir al tablero</a></div>';
    return;
  }
  const pendiente = s.estatus === 'Pendiente';
  const fila = (t, v) => `<div class="dato"><span>${t}</span><b>${v}</b></div>`;
  const resuelta = pendiente ? '' : `<div class="aviso ${s.estatus === 'Autorizada' ? 'aviso--info' : 'aviso--error'}">
      <b>${s.estatus === 'Autorizada' ? 'Autorizada' : 'Rechazada'}</b> por ${esc(s.resueltoPorNombre)} el ${esc(fechaHora(s.fechaResolucion))}.${s.comentario ? ` ${esc(s.comentario)}` : ''}</div>`;

  main.innerHTML = `
    <div class="encabezado"><div class="encabezado__txt">
      <div class="kicker">Autorización de cambio de fecha</div>
      <h1>${esc(a.titulo)}</h1>
      <p class="sub">${esc([a.cliente, a.proyecto].filter(Boolean).join(' · '))} · ${esc(a.categoria)}</p></div></div>
    ${resuelta}
    <section class="tarjeta" style="border-color:var(--durazno);max-width:860px" aria-labelledby="t-sol">
      <div class="tarjeta__cab"><h2 id="t-sol">${esc(s.solicitanteNombre)} solicita mover la fecha compromiso</h2>
        <span class="tarjeta__nota">Solicitado ${esc(fechaHora(s.creado))}</span></div>
      <div class="datos">
        ${fila('Fecha actual', esc(fechaLarga(s.fechaActual)))}
        ${fila('Fecha propuesta', `<span style="color:var(--oxido-osc)">${esc(fechaLarga(s.fechaPropuesta))}</span>`)}
        ${fila('Responsable', esc(a.responsableNombre))}
        ${fila('Avance', `${Math.round(a.avance)}%`)}
        ${fila('Horas estimadas', `${a.horasEstimadas} h`)}
        ${fila('Estado', pillEstado(a, estado.hoy))}
      </div>
      <div class="respuesta" style="background:var(--hundido);color:var(--texto)"><b>Justificación:</b> ${esc(s.justificacion)}</div>
      ${pendiente && estado.esDirector ? `
      <form data-decision style="display:flex;flex-direction:column;gap:14px">
        <div class="campo"><label for="com">Comentario (opcional)</label><textarea id="com" name="comentario" rows="2" placeholder="Visible para ${esc(a.responsableNombre)} en la bitácora"></textarea></div>
        <div class="aviso aviso--error" data-error hidden></div>
        <div class="acciones">
          <button type="submit" class="btn btn--primario" data-autorizar style="min-width:200px">Autorizar</button>
          <button type="button" class="btn" data-rechazar>Rechazar</button>
          <a class="btn btn--texto" href="#/actividad/${a.id}">Ver la actividad completa</a>
        </div>
      </form>` : `<div class="acciones"><a class="btn" href="#/actividad/${a.id}">Ver la actividad</a></div>
        ${pendiente ? '<p class="tarjeta__nota" style="margin:0">Pendiente: solo el director puede autorizarla.</p>' : ''}`}
    </section>
    <p class="tarjeta__nota">${etqArea(a.area)} · Compromiso vigente: ${esc(fechaCorta(a.fechaCompromiso))}</p>`;

  const form = main.querySelector('[data-decision]');
  if (!form) return;
  const decidir = async (autorizar) => {
    const caja = form.querySelector('[data-error]');
    caja.hidden = true;
    const comentario = form.comentario.value.trim();
    if (!autorizar && !comentario) {
      caja.textContent = 'Para rechazar, escribe un comentario para el responsable.';
      caja.hidden = false;
      form.comentario.focus();
      return;
    }
    for (const b of form.querySelectorAll('button')) b.disabled = true;
    try {
      await resolverSolicitud(ctx, s, autorizar, comentario);
      toast(autorizar ? `Autorizado: la fecha compromiso ahora es ${fechaCorta(s.fechaPropuesta)}` : 'Cambio de fecha rechazado');
      await ctx.recargar();
      ctx.refrescar();
    } catch (err) {
      caja.textContent = mensajeError(err);
      caja.hidden = false;
      for (const b of form.querySelectorAll('button')) b.disabled = false;
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); decidir(true); });
  form.querySelector('[data-rechazar]').addEventListener('click', () => decidir(false));
}
