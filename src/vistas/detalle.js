// Detalle de una actividad: datos, petición de acción, avance rápido y bitácora.
import { estaAbierta, accionPendiente, fechaLarga, horasRestantes } from '../logic.js';
import { esc, pillEstado, etqArea, fechaHora, toast, dialogo } from '../ui.js';
import { responderPeticion, cerrarPeticion, avanceRapido } from './comun.js';

export async function vistaDetalle(ctx) {
  const { estado, main, param, repo } = ctx;
  const a = estado.datos.actividades.find((x) => x.id === Number(param));
  if (!a) {
    main.innerHTML = '<div class="aviso aviso--error">No encontré esa actividad (puede que la hayan borrado). <a href="#/actividades">Volver a actividades</a></div>';
    return;
  }
  const { hoy } = estado;
  const equipo = estado.datos.equipo;
  const nombreDe = (email) => equipo.find((p) => p.email === email)?.nombre || email;
  const pendiente = accionPendiente(a);
  const puedeResponder = pendiente && (a.accionDe === 'Director' ? estado.esDirector : true);
  const esMia = a.responsableEmail === estado.usuario.email;
  const solicitud = estado.datos.solicitudes.find((x) => x.actividadId === a.id && x.estatus === 'Pendiente');

  const dato = (t, v) => `<div class="dato"><span>${t}</span><b>${v}</b></div>`;
  main.innerHTML = `
    <div class="migas"><a href="#/actividades">← Actividades</a></div>
    <div class="encabezado">
      <div class="encabezado__txt">
        <div class="fila-meta">${etqArea(a.area)}${pillEstado(a, hoy)}${a.prioridad === 'Alta' ? '<span class="etq etq--prio-alta">Prioridad alta</span>' : ''}</div>
        <h1>${esc(a.titulo)}</h1>
        <p class="sub">${esc([a.cliente, a.proyecto].filter(Boolean).join(' · ') || 'Sin cliente')} · ${esc(a.categoria)}</p>
      </div>
      <div class="acciones">
        ${estaAbierta(a) ? '<button type="button" class="btn btn--oscuro" data-avance>Registrar avance</button>' : ''}
        <a class="btn" href="#/editar/${a.id}">Editar</a>
        ${estaAbierta(a) ? '<button type="button" class="btn" data-completar>Marcar completada</button>' : '<button type="button" class="btn" data-reabrir>Reabrir</button>'}
      </div>
    </div>

    <div class="columnas">
      <div class="col-principal">
        ${solicitud ? `<section class="tarjeta" style="border-color:var(--durazno)" aria-labelledby="t-solf">
          <div class="tarjeta__cab"><h2 id="t-solf">Cambio de fecha pendiente de autorización</h2><span class="tarjeta__nota">Solicitado por ${esc(solicitud.solicitanteNombre)}</span></div>
          <p style="margin:0;font-size:16px"><b>${esc(fechaLarga(solicitud.fechaActual))}</b> → <b style="color:var(--oxido-osc)">${esc(fechaLarga(solicitud.fechaPropuesta))}</b></p>
          <div class="descripcion"><b>Justificación:</b> ${esc(solicitud.justificacion)}</div>
          ${estado.esDirector ? `<div class="acciones"><a class="btn btn--primario" href="#/autorizar/${solicitud.id}">Revisar y autorizar</a></div>` : '<p class="tarjeta__nota" style="margin:0">La fecha compromiso no cambia hasta que el director la autorice.</p>'}
        </section>` : ''}
        ${a.requiereAccion ? `<section class="tarjeta" style="border-color:var(--durazno)" aria-labelledby="t-acc">
          <div class="tarjeta__cab"><h2 id="t-acc">${pendiente ? `Esperando a ${esc(a.accionDe)}` : `Petición a ${esc(a.accionDe)} respondida`}</h2>
            ${a.accionFecha ? `<span class="tarjeta__nota">Se necesita para el ${esc(fechaLarga(a.accionFecha))}</span>` : ''}</div>
          <p style="margin:0;font-size:16px;font-weight:700">${esc(a.accionDetalle)}</p>
          ${a.accionRespuesta ? `<div class="respuesta"><b>Respuesta:</b> ${esc(a.accionRespuesta)}</div>` : ''}
          <div class="acciones">
            ${puedeResponder ? `<button type="button" class="btn btn--oscuro" data-responder>${a.accionDe === 'Director' ? 'Responder' : `Registrar respuesta de ${esc(a.accionDe)}`}</button>` : ''}
            ${pendiente && esMia ? '<button type="button" class="btn" data-cerrar>Ya no lo necesito</button>' : ''}
            ${!pendiente && esMia ? '<button type="button" class="btn" data-cerrar>Enterado</button>' : ''}
          </div>
        </section>` : ''}

        <section class="tarjeta" aria-labelledby="t-datos">
          <h2 id="t-datos">Datos</h2>
          <div class="datos">
            ${dato('Cliente', esc(a.cliente || '—'))}
            ${dato('Oportunidad / proyecto', esc(a.proyecto || '—'))}
            ${dato('Categoría', esc(a.categoria || '—'))}
            ${dato('Responsable', esc(a.responsableNombre || '—'))}
            ${dato('Colaboradores', esc(a.colaboradores.map(nombreDe).join(', ') || '—'))}
            ${dato('Fecha compromiso', esc(fechaLarga(a.fechaCompromiso)))}
            ${dato('Inicio', esc(fechaLarga(a.fechaInicio)))}
            ${dato('Avance', `${Math.round(a.avance)}%`)}
            ${dato('Horas estimadas', a.horasEstimadas ? `${a.horasEstimadas} h · faltan ${Math.round(horasRestantes(a) * 10) / 10} h` : '—')}
            ${dato('Estatus', esc(a.estatus))}
            ${dato('Última actualización', esc(fechaHora(a.ultimaActualizacion) || '—'))}
            ${a.fechaCompletada ? dato('Cerrada', esc(fechaLarga(a.fechaCompletada))) : ''}
          </div>
          ${a.descripcion ? `<div class="descripcion">${esc(a.descripcion)}</div>` : ''}
          ${a.enlaceCarpeta && /^https:\/\//i.test(a.enlaceCarpeta) ? `<a href="${esc(a.enlaceCarpeta)}" target="_blank" rel="noopener">Abrir carpeta o enlace ↗</a>` : ''}
        </section>
      </div>
      <div class="col-lateral">
        <section class="tarjeta" aria-labelledby="t-bit">
          <h2 id="t-bit">Bitácora</h2>
          <form data-nota class="campo">
            <label for="nota">Agregar comentario</label>
            <textarea id="nota" name="nota" rows="3" placeholder="Avance, acuerdo, dato importante…"></textarea>
            <div class="acciones acciones--fin"><button type="submit" class="btn btn--oscuro">Agregar</button></div>
          </form>
          <div class="bitacora" data-bitacora><div class="cargando">Cargando bitácora…</div></div>
        </section>
      </div>
    </div>`;

  const cajaBit = main.querySelector('[data-bitacora]');
  const pintarBitacora = async () => {
    try {
      const entradas = await repo.bitacora(a.id);
      cajaBit.innerHTML = entradas.length ? entradas.map((e) => `<div class="entrada">
        <div class="entrada__cab"><span>${esc(e.autorNombre || e.autorEmail)}</span><span>·</span><span>${esc(fechaHora(e.fecha))}</span><span class="pill pill--sin">${esc(e.tipo)}</span></div>
        <div class="entrada__txt">${esc(e.texto)}</div></div>`).join('') : '<p class="vacio">Sin entradas todavía.</p>';
    } catch (err) {
      cajaBit.innerHTML = `<div class="aviso aviso--error">No se pudo leer la bitácora: ${esc(err.message)}</div>`;
    }
  };
  pintarBitacora();

  const tras = async (promesa) => { if (await promesa) { await ctx.recargar(); ctx.refrescar(); } };
  main.querySelector('[data-avance]')?.addEventListener('click', () => tras(avanceRapido(ctx, a)));
  main.querySelector('[data-responder]')?.addEventListener('click', () => tras(responderPeticion(ctx, a)));
  main.querySelector('[data-cerrar]')?.addEventListener('click', () => tras(cerrarPeticion(ctx, a)));
  main.querySelector('[data-completar]')?.addEventListener('click', () => tras(dialogo({
    titulo: 'Marcar como completada', enviar: 'Completar',
    cuerpo: `<p style="margin:0">${esc(a.titulo)}</p><div class="campo"><label for="c-nota">Nota de cierre (opcional)</label><textarea id="c-nota" name="nota" rows="3" placeholder="Entregado al cliente, acta firmada…"></textarea></div>`,
    alEnviar: async (form) => {
      const nota = form.nota.value.trim();
      await repo.actualizarActividad(a.id, { estatus: 'Completada', avance: 100, fechaCompletada: hoy, ...(accionPendiente(a) ? { requiereAccion: false, accionResuelta: true } : {}) }, estado.usuario,
        [{ tipo: 'Cambio de estatus', texto: `Estatus: ${a.estatus} → Completada${nota ? `. ${nota}` : ''}` }]);
      toast('Actividad completada');
    },
  })));
  main.querySelector('[data-reabrir]')?.addEventListener('click', () => tras(dialogo({
    titulo: 'Reabrir actividad', enviar: 'Reabrir',
    cuerpo: '<div class="campo"><label for="r-nota">¿Por qué se reabre? *</label><textarea id="r-nota" name="nota" rows="3" required></textarea></div>',
    alEnviar: async (form) => {
      const nota = form.nota.value.trim();
      if (!nota) { const e = new Error('Explica por qué se reabre.'); e.validacion = true; throw e; }
      await repo.actualizarActividad(a.id, { estatus: 'En curso', fechaCompletada: null }, estado.usuario, [{ tipo: 'Cambio de estatus', texto: `Estatus: ${a.estatus} → En curso. ${nota}` }]);
      toast('Actividad reabierta');
    },
  })));
  main.querySelector('[data-nota]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const texto = form.nota.value.trim();
    if (!texto) { form.nota.focus(); return; }
    const boton = form.querySelector('button');
    boton.disabled = true;
    try {
      await repo.agregarBitacora(a.id, 'Avance', texto, estado.usuario);
      // Comentar también cuenta como actualización
      await repo.actualizarActividad(a.id, {}, estado.usuario, []);
      form.nota.value = '';
      toast('Comentario agregado');
      await pintarBitacora();
    } catch (err) {
      toast(err.message, { error: true });
    } finally {
      boton.disabled = false;
    }
  });
}
