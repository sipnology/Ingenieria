// Piezas compartidas entre vistas: carga de trabajo, diálogos de respuesta y de avance rápido.
import { esc, dialogo, toast, errorValidacion } from '../ui.js';
import { ESTATUS, ESTATUS_CERRADOS } from '../schema.js';
import { fechaCorta } from '../logic.js';
import { correoAutorizacion } from '../correos.js';

export const urlApp = () => location.origin + location.pathname.replace(/index\.html$/, '');
export const directores = (estado) => estado.datos.equipo.filter((p) => p.rol === 'Director' && p.activo && p.email);

/**
 * Registra la solicitud de cambio de fecha y envía al director el correo con el botón Autorizar
 * (desde el buzón de quien solicita). Si el correo falla, el motor de avisos lo reintenta.
 */
export async function solicitarCambioFecha(ctx, actividad, fechaNueva, justificacion) {
  const { repo, estado } = ctx;
  const solicitud = await repo.crearSolicitud({
    titulo: actividad.titulo, actividadId: actividad.id, fechaActual: actividad.fechaCompromiso, fechaPropuesta: fechaNueva,
    justificacion, solicitanteEmail: estado.usuario.email, solicitanteNombre: estado.usuario.nombre, estatus: 'Pendiente', correoEnviado: false,
  });
  await repo.agregarBitacora(actividad.id, 'Cambio de fecha',
    `Solicitó cambiar la fecha compromiso de ${fechaCorta(actividad.fechaCompromiso)} a ${fechaCorta(fechaNueva)}. Pendiente de autorización.\nJustificación: ${justificacion}`, estado.usuario);
  let correo = false;
  try {
    const para = directores(estado).map((d) => d.email);
    if (para.length) {
      const { asunto, html } = correoAutorizacion({ actividad, solicitud, appUrl: urlApp() });
      await repo.enviarCorreo({ para, asunto, html });
      await repo.actualizarSolicitud(solicitud.id, { correoEnviado: true });
      correo = true;
    }
  } catch (e) {
    console.warn('No se pudo enviar el correo de autorización; el motor de avisos lo reintentará.', e);
  }
  return { solicitud, correo };
}

/** El director autoriza o rechaza. Al autorizar, la fecha compromiso cambia. */
export async function resolverSolicitud(ctx, solicitud, autorizar, comentario = '') {
  const { repo, estado } = ctx;
  await repo.actualizarSolicitud(solicitud.id, {
    estatus: autorizar ? 'Autorizada' : 'Rechazada', resueltoPorEmail: estado.usuario.email, resueltoPorNombre: estado.usuario.nombre,
    fechaResolucion: new Date().toISOString(), comentario,
  });
  const texto = autorizar
    ? `Fecha compromiso: ${fechaCorta(solicitud.fechaActual)} → ${fechaCorta(solicitud.fechaPropuesta)} (autorizado por ${estado.usuario.nombre}).${comentario ? ` ${comentario}` : ''}`
    : `Cambio de fecha a ${fechaCorta(solicitud.fechaPropuesta)} rechazado por ${estado.usuario.nombre}.${comentario ? ` ${comentario}` : ''}`;
  if (autorizar) await repo.actualizarActividad(solicitud.actividadId, { fechaCompromiso: solicitud.fechaPropuesta }, estado.usuario, [{ tipo: 'Cambio de fecha', texto }]);
  else await repo.agregarBitacora(solicitud.actividadId, 'Cambio de fecha', texto, estado.usuario);
}

export function htmlCarga(filas, { vacio = 'Aún no hay actividades abiertas con horas estimadas.' } = {}) {
  if (!filas.length) return `<p class="vacio">${esc(vacio)}</p>`;
  return filas.map((f) => {
    const escala = Math.max(f.capacidad * 1.25, f.horas * 1.05, 1);
    const ancho = Math.min(100, (f.horas / escala) * 100);
    const linea = (f.capacidad / escala) * 100;
    const clase = f.sobrecarga ? 'relleno--sobre' : f.porcentaje >= 0.85 ? 'relleno--alto' : '';
    const pie = [`${f.abiertas} actividad${f.abiertas === 1 ? '' : 'es'}`];
    if (f.vencenSemana) pie.push(`${f.vencenSemana} vence${f.vencenSemana === 1 ? '' : 'n'} esta semana`);
    if (f.bloqueadas) pie.push(`${f.bloqueadas} bloqueada${f.bloqueadas === 1 ? '' : 's'}`);
    if (!f.sobrecarga && f.porcentaje < 0.6) pie.push('con espacio para apoyar');
    return `<div class="carga">
      <div class="carga__cab"><span><b>${esc(f.nombre)}</b>${f.area ? ` <span class="area">· ${esc(f.area)}</span>` : ''}</span>
        <span class="${f.sobrecarga ? 'carga__horas--sobre' : ''}">${f.horas} h${f.sobrecarga ? ' · Sobrecarga' : ''}</span></div>
      <div class="pista" role="img" aria-label="${esc(f.nombre)}: ${f.horas} de ${f.capacidad} horas de capacidad">
        <div class="relleno ${clase}" style="width:${ancho.toFixed(1)}%"></div>
        <div class="linea-cap" style="left:${linea.toFixed(1)}%" aria-hidden="true"></div>
      </div>
      <div class="carga__pie">${esc(pie.join(' · '))}</div>
    </div>`;
  }).join('') + '<div class="leyenda"><i aria-hidden="true"></i>Línea = capacidad semanal de cada persona. Las horas pendientes se reparten entre las semanas que faltan para la fecha compromiso.</div>';
}

/** El director (o quien atiende) responde una petición de acción. */
export function responderPeticion(ctx, a) {
  const { repo, estado } = ctx;
  return dialogo({
    titulo: 'Responder petición',
    enviar: 'Enviar respuesta',
    cuerpo: `<p style="margin:0">${esc(a.responsableNombre)} necesita: <b>${esc(a.accionDetalle || a.titulo)}</b></p>
      <p class="tarjeta__nota" style="margin:0">${esc(a.titulo)}${a.cliente ? ` · ${esc(a.cliente)}` : ''}</p>
      <div class="campo"><label for="resp-txt">Respuesta *</label>
        <textarea id="resp-txt" name="respuesta" rows="4" required placeholder="Aprobado / decisión / siguiente paso…"></textarea>
        <small>Se le avisa a ${esc(a.responsableNombre)} y queda en la bitácora.</small></div>`,
    alEnviar: async (form) => {
      const respuesta = form.respuesta.value.trim();
      if (!respuesta) throw errorValidacion('Escribe la respuesta.');
      await repo.actualizarActividad(a.id, { accionResuelta: true, accionRespuesta: respuesta }, estado.usuario,
        [{ tipo: 'Respuesta', texto: `${estado.usuario.nombre} respondió (${a.accionDe}): ${respuesta}` }]);
      toast('Respuesta enviada');
    },
  });
}

/** El responsable registra que ya no necesita la acción (o que ya se la resolvieron). */
export function cerrarPeticion(ctx, a) {
  const { repo, estado } = ctx;
  return dialogo({
    titulo: a.accionResuelta ? 'Marcar como enterado' : 'Ya no necesito esto',
    enviar: 'Confirmar',
    cuerpo: `<p style="margin:0"><b>${esc(a.accionDetalle)}</b> · ${esc(a.accionDe)}</p>
      <div class="campo"><label for="cerrar-nota">Nota (opcional)</label>
        <textarea id="cerrar-nota" name="nota" rows="3" placeholder="${a.accionResuelta ? 'Enterado, sigo con…' : 'Compras confirmó la fecha de entrega…'}"></textarea></div>`,
    alEnviar: async (form) => {
      const nota = form.nota.value.trim();
      await repo.actualizarActividad(a.id, { requiereAccion: false, accionResuelta: true }, estado.usuario,
        [{ tipo: 'Acción', texto: `Petición a ${a.accionDe} cerrada${nota ? `: ${nota}` : ''}` }]);
      toast('Petición cerrada');
    },
  });
}

/** Actualización rápida: avance, estatus y una nota para la bitácora. */
export function avanceRapido(ctx, a) {
  const { repo, estado } = ctx;
  const opciones = ESTATUS.map((s) => `<option${s === a.estatus ? ' selected' : ''}>${esc(s)}</option>`).join('');
  return dialogo({
    titulo: 'Registrar avance',
    enviar: 'Guardar avance',
    cuerpo: `<p class="tarjeta__nota" style="margin:0">${esc(a.titulo)}</p>
      <div class="rejilla">
        <div class="campo"><label for="ar-av">Avance: <output id="ar-out">${Math.round(a.avance)}</output>%</label>
          <input id="ar-av" name="avance" type="range" min="0" max="100" step="5" value="${Math.round(a.avance)}"
            oninput="this.form.querySelector('#ar-out').value=this.value"></div>
        <div class="campo"><label for="ar-est">Estatus</label><select id="ar-est" name="estatus">${opciones}</select></div>
      </div>
      <div class="campo"><label for="ar-nota">¿Qué avanzaste? *</label>
        <textarea id="ar-nota" name="nota" rows="3" required></textarea></div>`,
    alEnviar: async (form) => {
      const nota = form.nota.value.trim();
      if (!nota) throw errorValidacion('Escribe una nota corta de lo que avanzaste.');
      const estatus = form.estatus.value;
      let avance = Number(form.avance.value);
      const cambios = { avance, estatus };
      const entradas = [{ tipo: 'Avance', texto: `${nota} (avance ${avance}%)` }];
      if (estatus !== a.estatus) entradas.push({ tipo: 'Cambio de estatus', texto: `Estatus: ${a.estatus} → ${estatus}` });
      if (estatus === 'Completada') { avance = 100; Object.assign(cambios, { avance, fechaCompletada: estado.hoy }); }
      else if (ESTATUS_CERRADOS.includes(a.estatus)) cambios.fechaCompletada = null;
      await repo.actualizarActividad(a.id, cambios, estado.usuario, entradas);
      toast('Avance registrado');
    },
  });
}
