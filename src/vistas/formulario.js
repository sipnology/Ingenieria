// Alta y edición de actividades. Cliente, proyecto y categoría vienen de los catálogos.
// Cambiar la fecha compromiso requiere justificación y autorización del director.
import { AREAS, ESTATUS, PRIORIDADES, ACCION_DE, ESTATUS_CERRADOS } from '../schema.js';
import { fechaCorta } from '../logic.js';
import { esc, toast, mensajeError, dialogo, errorValidacion } from '../ui.js';
import { solicitarCambioFecha } from './comun.js';

export async function vistaFormulario(ctx) {
  const { estado, main, param, ruta, repo, navegar } = ctx;
  const D = estado.datos;
  const editando = ruta === 'editar';
  const previa = editando ? D.actividades.find((a) => a.id === Number(param)) : null;
  if (editando && !previa) {
    main.innerHTML = '<div class="aviso aviso--error">No encontré esa actividad. <a href="#/actividades">Volver a actividades</a></div>';
    return;
  }
  // Clientes y oportunidades los da de alta quien registra la actividad (todo el equipo);
  // las categorías siguen siendo del director y los líderes (pantalla Catálogos).
  const puedeCatalogo = true;
  const pendiente = editando ? D.solicitudes.find((s) => s.actividadId === previa.id && s.estatus === 'Pendiente') : null;
  const yo = estado.usuario.email;
  // El director no registra ni es responsable de actividades (salvo las que ya tuviera a su nombre)
  const equipo = D.equipo.filter((p) => (p.activo && p.rol !== 'Director') || p.email === previa?.responsableEmail).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const a = previa || {
    titulo: '', area: estado.yo?.area || 'Preventa', categoriaId: null, clienteId: null, proyectoId: null,
    responsableEmail: yo, responsableNombre: estado.usuario.nombre, colaboradores: [],
    fechaInicio: estado.hoy, fechaCompromiso: '', horasEstimadas: '', estatus: 'En curso', avance: 0,
    prioridad: 'Media', descripcion: '', requiereAccion: false, accionDe: 'Director', accionDetalle: '',
    accionFecha: '', enlaceCarpeta: '',
  };
  if (a.responsableEmail && !equipo.some((p) => p.email === a.responsableEmail)) {
    equipo.unshift({ email: a.responsableEmail, nombre: a.responsableNombre || a.responsableEmail, activo: true });
  }
  const opt = (v, sel, t = v) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`;
  const opcionesCategorias = (area, sel) => {
    const l = D.categorias.filter((c) => c.area === area && (c.activo || c.id === sel)).sort((x, y) => x.orden - y.orden || x.nombre.localeCompare(y.nombre));
    return `<option value="">Elige una categoría…</option>${l.map((c) => opt(c.id, sel, c.nombre)).join('')}`;
  };
  const opcionesClientes = (sel) => {
    const l = D.clientes.filter((c) => c.activo || c.id === sel).sort((x, y) => x.nombre.localeCompare(y.nombre));
    return `<option value="">Elige un cliente…</option>${l.map((c) => opt(c.id, sel, c.nombre)).join('')}`;
  };
  const opcionesProyectos = (clienteId, sel) => {
    const l = D.proyectos.filter((p) => p.clienteId === Number(clienteId) && (p.activo || p.id === sel)).sort((x, y) => x.nombre.localeCompare(y.nombre));
    if (!clienteId) return '<option value="">Primero elige el cliente</option>';
    return `<option value="">${l.length ? 'Elige la oportunidad o proyecto…' : 'Este cliente no tiene proyectos en el catálogo'}</option>${l.map((p) => opt(p.id, sel, p.nombre)).join('')}`;
  };
  const necesitaAccion = a.requiereAccion && !a.accionResuelta;
  const sinCatalogo = puedeCatalogo ? '' : '<small>¿No aparece? Pídele al director o a tu líder que lo agregue al catálogo.</small>';

  main.innerHTML = `
    <div class="encabezado"><div class="encabezado__txt">
      <div class="kicker">${editando ? `Editar · actividad ${a.id}` : 'Registrar actividad'}</div>
      <h1>${editando ? esc(a.titulo) : 'Nueva actividad'}</h1>
      <p class="sub">Los campos con * son obligatorios.</p></div></div>
    <form class="tarjeta" novalidate data-form style="gap:22px">
      <div class="campo"><label for="titulo">¿Qué vas a hacer? *</label>
        <input id="titulo" name="titulo" required maxlength="255" value="${esc(a.titulo)}" placeholder="Ej. Dimensionamiento de switches para el campus"></div>

      <div class="rejilla">
        <div class="campo"><label for="area">Área *</label><select id="area" name="area" required>${AREAS.map((x) => opt(x, a.area)).join('')}</select></div>
        <div class="campo doble"><label for="categoria">Categoría *</label><select id="categoria" name="categoria" required>${opcionesCategorias(a.area, a.categoriaId)}</select></div>
      </div>
      <div class="rejilla">
        <div class="campo"><label for="cliente">Cliente *</label>
          <div style="display:flex;gap:8px"><select id="cliente" name="cliente" required style="flex:1">${opcionesClientes(a.clienteId)}</select>
          ${puedeCatalogo ? '<button type="button" class="btn" data-nuevo-cliente aria-label="Agregar cliente al catálogo">+</button>' : ''}</div>${sinCatalogo}</div>
        <div class="campo doble"><label for="proyecto">Oportunidad / proyecto *</label>
          <div style="display:flex;gap:8px"><select id="proyecto" name="proyecto" required style="flex:1">${opcionesProyectos(a.clienteId, a.proyectoId)}</select>
          ${puedeCatalogo ? '<button type="button" class="btn" data-nuevo-proyecto aria-label="Agregar oportunidad o proyecto al catálogo">+</button>' : ''}</div></div>
      </div>

      <div class="rejilla">
        <div class="campo"><label for="responsable">Responsable *</label>
          <select id="responsable" name="responsable" required>${equipo.map((p) => opt(p.email, a.responsableEmail, p.nombre)).join('')}</select></div>
        <div class="campo"><label for="fechaInicio">Fecha de inicio</label><input id="fechaInicio" name="fechaInicio" type="date" value="${esc(a.fechaInicio || '')}"></div>
        <div class="campo"><label for="fechaCompromiso">Fecha compromiso *</label><input id="fechaCompromiso" name="fechaCompromiso" type="date" required value="${esc(a.fechaCompromiso || '')}" ${pendiente ? 'disabled' : ''}>
          ${pendiente ? `<small>Hay un cambio a ${esc(fechaCorta(pendiente.fechaPropuesta))} esperando autorización.</small>` : editando && !estado.esDirector ? '<small>Cambiarla requiere autorización del director.</small>' : ''}</div>
        <div class="campo"><label for="horas">Horas estimadas *</label><input id="horas" name="horas" type="number" min="0.5" step="0.5" inputmode="decimal" required value="${esc(a.horasEstimadas)}">
          <small>Para medir carga por persona y por tipo de actividad.</small></div>
      </div>
      <div class="caja-accion" data-cambio-fecha hidden>
        <div class="campo"><label for="justificacion">${estado.esDirector ? 'Motivo del cambio de fecha *' : 'Justificación del cambio de fecha *'}</label>
          <textarea id="justificacion" name="justificacion" rows="3" placeholder="Ej. el cliente movió la junta de aclaraciones"></textarea>
          <small>${estado.esDirector ? 'Queda en la bitácora.' : 'Se envía al director por correo para que lo autorice. Mientras tanto la fecha compromiso no cambia.'}</small></div>
      </div>

      <fieldset class="opciones">
        <legend>Colaboradores</legend>
        ${equipo.filter((p) => p.rol !== 'Director').map((p) => `<label class="opcion"><input type="checkbox" name="colaboradores" value="${esc(p.email)}"${a.colaboradores.includes(p.email) ? ' checked' : ''}>${esc(p.nombre)}</label>`).join('') || '<span class="vacio">Agrega integrantes en Equipo.</span>'}
        <small class="tarjeta__nota" style="flex-basis:100%">Las horas y los avisos son del responsable; los colaboradores solo la ven en su lista.</small>
      </fieldset>

      <div class="rejilla">
        <div class="campo"><label for="estatus">Estatus</label><select id="estatus" name="estatus">${ESTATUS.map((x) => opt(x, a.estatus)).join('')}</select></div>
        <div class="campo"><label for="avance">Avance: <output id="avance-out">${Math.round(a.avance)}</output>%</label>
          <input id="avance" name="avance" type="range" min="0" max="100" step="5" value="${Math.round(a.avance)}"></div>
        <div class="campo"><label for="prioridad">Prioridad</label><select id="prioridad" name="prioridad">${PRIORIDADES.map((x) => opt(x, a.prioridad)).join('')}</select></div>
        <div class="campo"><label for="enlace">Carpeta o enlace</label><input id="enlace" name="enlace" type="url" maxlength="255" value="${esc(a.enlaceCarpeta)}" placeholder="https://sipnologysacv.sharepoint.com/…"></div>
      </div>
      <div class="campo"><label for="descripcion">Descripción</label><textarea id="descripcion" name="descripcion" rows="3" placeholder="Alcance, entregables, contexto…">${esc(a.descripcion)}</textarea></div>

      <div class="caja-accion">
        <label class="interruptor"><input type="checkbox" name="requiereAccion"${necesitaAccion ? ' checked' : ''}>¿Necesitas algo de alguien para avanzar?</label>
        <div data-accion ${necesitaAccion ? '' : 'hidden'} style="display:flex;flex-direction:column;gap:14px">
          <fieldset class="opciones"><legend>¿De quién? *</legend>
            ${ACCION_DE.map((x) => `<label class="opcion"><input type="radio" name="accionDe" value="${esc(x)}"${(a.accionDe || 'Director') === x ? ' checked' : ''}>${esc(x)}</label>`).join('')}
          </fieldset>
          <div class="rejilla">
            <div class="campo doble"><label for="accionDetalle">¿Qué necesitas? *</label><input id="accionDetalle" name="accionDetalle" maxlength="255" value="${esc(necesitaAccion ? a.accionDetalle : '')}" placeholder="Ej. Aprobación de descuento en servicios"></div>
            <div class="campo"><label for="accionFecha">¿Para cuándo?</label><input id="accionFecha" name="accionFecha" type="date" value="${esc(necesitaAccion ? a.accionFecha || '' : '')}"></div>
          </div>
          <p class="tarjeta__nota" style="margin:0;color:var(--oxido-osc);font-weight:600" data-nota-accion></p>
        </div>
      </div>

      <div class="aviso aviso--error" data-error hidden></div>
      <div class="acciones acciones--fin" style="border-top:1px solid var(--borde);padding-top:18px">
        <a class="btn" href="${editando ? `#/actividad/${a.id}` : '#/'}">Cancelar</a>
        <button type="submit" class="btn btn--primario">${editando ? 'Guardar cambios' : 'Guardar actividad'}</button>
      </div>
    </form>`;

  const form = main.querySelector('[data-form]');
  const cajaFecha = main.querySelector('[data-cambio-fecha]');
  const notaAccion = main.querySelector('[data-nota-accion]');
  const pintarNotaAccion = () => {
    const quien = form.querySelector('input[name="accionDe"]:checked')?.value;
    notaAccion.textContent = quien === 'Director' ? 'Al guardar se le avisa al director por Teams y correo.' : `Queda marcada como "esperando a ${quien}" para seguimiento; esa área no recibe aviso.`;
  };
  pintarNotaAccion();
  form.addEventListener('change', (e) => { if (e.target.name === 'accionDe') pintarNotaAccion(); });
  form.area.addEventListener('change', () => { form.categoria.innerHTML = opcionesCategorias(form.area.value, null); });
  form.cliente.addEventListener('change', () => { form.proyecto.innerHTML = opcionesProyectos(form.cliente.value, null); });
  form.avance.addEventListener('input', () => { form.querySelector('#avance-out').value = form.avance.value; });
  form.requiereAccion.addEventListener('change', () => { main.querySelector('[data-accion]').hidden = !form.requiereAccion.checked; });
  form.fechaCompromiso.addEventListener('input', () => {
    cajaFecha.hidden = !(editando && previa.fechaCompromiso && form.fechaCompromiso.value !== previa.fechaCompromiso);
  });
  form.estatus.addEventListener('change', () => { if (form.estatus.value === 'Completada') { form.avance.value = 100; form.querySelector('#avance-out').value = 100; } });

  // Alta rápida de cliente y oportunidad/proyecto (todo el equipo)
  main.querySelector('[data-nuevo-cliente]')?.addEventListener('click', async () => {
    let nuevo = null;
    await dialogo({
      titulo: 'Agregar cliente al catálogo', enviar: 'Agregar',
      cuerpo: '<div class="campo"><label for="nc">Nombre del cliente *</label><input id="nc" name="nombre" required></div>',
      alEnviar: async (f) => {
        const nombre = f.nombre.value.trim();
        if (!nombre) throw errorValidacion('Escribe el nombre.');
        const existente = D.clientes.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase());
        if (existente) throw errorValidacion(existente.activo ? 'Ese cliente ya está en el catálogo: elígelo en la lista.' : 'Ese cliente existe pero está desactivado. Pídele al director o a tu líder que lo reactive.');
        nuevo = { id: await repo.guardarCatalogo('clientes', { nombre, activo: true }), nombre, activo: true };
      },
    });
    if (nuevo) { D.clientes.push(nuevo); form.cliente.innerHTML = opcionesClientes(nuevo.id); form.proyecto.innerHTML = opcionesProyectos(nuevo.id, null); toast('Cliente agregado'); }
  });
  main.querySelector('[data-nuevo-proyecto]')?.addEventListener('click', async () => {
    const clienteId = Number(form.cliente.value);
    const cliente = D.clientes.find((c) => c.id === clienteId);
    if (!cliente) { toast('Primero elige el cliente', { error: true }); form.cliente.focus(); return; }
    let nuevo = null;
    await dialogo({
      titulo: `Nueva oportunidad o proyecto de ${cliente.nombre}`, enviar: 'Agregar',
      cuerpo: '<div class="campo"><label for="np">Nombre de la oportunidad o proyecto *</label><input id="np" name="nombre" required placeholder="Ej. Renovación de WLAN corporativa"></div>',
      alEnviar: async (f) => {
        const nombre = f.nombre.value.trim();
        if (!nombre) throw errorValidacion('Escribe el nombre.');
        const existente = D.proyectos.find((p) => p.clienteId === clienteId && p.nombre.toLowerCase() === nombre.toLowerCase());
        if (existente) throw errorValidacion(existente.activo ? 'Esa oportunidad ya está en el catálogo de este cliente.' : 'Esa oportunidad existe pero está desactivada. Pídele al director o a tu líder que la reactive.');
        nuevo = { id: await repo.guardarCatalogo('proyectos', { nombre, clienteId, cliente: cliente.nombre, activo: true }), nombre, clienteId, cliente: cliente.nombre, activo: true };
      },
    });
    if (nuevo) { D.proyectos.push(nuevo); form.proyecto.innerHTML = opcionesProyectos(clienteId, nuevo.id); toast('Oportunidad o proyecto agregado'); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const caja = form.querySelector('[data-error]');
    caja.hidden = true;
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');

    const v = (n) => form[n].value.trim();
    const responsable = equipo.find((p) => p.email === form.responsable.value);
    const categoria = D.categorias.find((c) => c.id === Number(form.categoria.value));
    const cliente = D.clientes.find((c) => c.id === Number(form.cliente.value));
    const proyecto = D.proyectos.find((p) => p.id === Number(form.proyecto.value));
    const requiere = form.requiereAccion.checked;
    const accionDe = form.querySelector('input[name="accionDe"]:checked')?.value || '';
    const fechaNueva = form.fechaCompromiso.value || null;
    const datos = {
      titulo: v('titulo'), area: form.area.value,
      categoriaId: categoria?.id ?? null, categoria: categoria?.nombre || '',
      clienteId: cliente?.id ?? null, cliente: cliente?.nombre || '',
      proyectoId: proyecto?.id ?? null, proyecto: proyecto?.nombre || '',
      responsableEmail: responsable?.email || '', responsableNombre: responsable?.nombre || '',
      colaboradores: [...form.querySelectorAll('input[name="colaboradores"]:checked')].map((x) => x.value).filter((x) => x !== responsable?.email),
      fechaInicio: form.fechaInicio.value || null, fechaCompromiso: fechaNueva,
      horasEstimadas: form.horas.value === '' ? NaN : Number(form.horas.value), estatus: form.estatus.value,
      avance: Number(form.avance.value), prioridad: form.prioridad.value, descripcion: form.descripcion.value.trim(),
      enlaceCarpeta: v('enlace'),
    };

    const errores = [];
    const marcar = (campo, msg) => { form[campo]?.setAttribute?.('aria-invalid', 'true'); errores.push(msg); };
    if (!datos.titulo) marcar('titulo', 'Escribe qué vas a hacer.');
    if (!categoria) marcar('categoria', 'Elige la categoría de la actividad.');
    if (!cliente) marcar('cliente', 'Elige el cliente.');
    if (!proyecto) marcar('proyecto', 'Elige la oportunidad o proyecto.');
    if (!datos.responsableEmail) marcar('responsable', 'Elige un responsable.');
    if (!datos.fechaCompromiso) marcar('fechaCompromiso', 'Pon una fecha compromiso.');
    if (datos.fechaInicio && datos.fechaCompromiso && datos.fechaInicio > datos.fechaCompromiso) marcar('fechaInicio', 'La fecha de inicio no puede ser posterior a la fecha compromiso.');
    if (!(datos.horasEstimadas > 0)) marcar('horas', 'Indica las horas estimadas (mayor a cero).');
    if (requiere && !v('accionDetalle')) marcar('accionDetalle', 'Escribe qué necesitas.');
    const cambioFecha = editando && previa.fechaCompromiso && fechaNueva !== previa.fechaCompromiso && !pendiente;
    if (cambioFecha && !v('justificacion')) marcar('justificacion', estado.esDirector ? 'Escribe el motivo del cambio de fecha.' : 'Escribe la justificación del cambio de fecha.');
    if (errores.length) {
      caja.innerHTML = errores.map(esc).join('<br>');
      caja.hidden = false;
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    // Petición de acción
    if (requiere) {
      const nueva = !previa || !previa.requiereAccion || previa.accionResuelta || previa.accionDe !== accionDe || previa.accionDetalle !== v('accionDetalle');
      Object.assign(datos, { requiereAccion: true, accionDe, accionDetalle: v('accionDetalle'), accionFecha: form.accionFecha.value || null });
      if (nueva) Object.assign(datos, { accionResuelta: false, accionRespuesta: '' });
    } else if (previa?.requiereAccion && !previa.accionResuelta) {
      Object.assign(datos, { requiereAccion: false, accionResuelta: true });
    } else if (!previa) {
      Object.assign(datos, { requiereAccion: false, accionDe: '', accionDetalle: '', accionFecha: null, accionResuelta: false, accionRespuesta: '' });
    }
    if (datos.estatus === 'Completada') Object.assign(datos, { avance: 100, fechaCompletada: previa?.fechaCompletada || estado.hoy });
    else if (!ESTATUS_CERRADOS.includes(datos.estatus)) datos.fechaCompletada = null;

    // Sin autorización la fecha compromiso no se toca
    const requiereAutorizacion = cambioFecha && !estado.esDirector;
    if (editando && (requiereAutorizacion || pendiente)) datos.fechaCompromiso = previa.fechaCompromiso;

    const boton = form.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      if (!previa) {
        const creada = await repo.crearActividad(datos, estado.usuario);
        if (datos.requiereAccion) await repo.agregarBitacora(creada.id, 'Acción', `Requiere acción de ${accionDe}: ${datos.accionDetalle}`, estado.usuario);
        toast(datos.requiereAccion && accionDe === 'Director' ? 'Actividad guardada. Se avisará al director.' : 'Actividad guardada');
        await ctx.recargar();
        navegar(`#/actividad/${creada.id}`);
        return;
      }
      const entradas = [];
      if (cambioFecha && estado.esDirector) entradas.push({ tipo: 'Cambio de fecha', texto: `Fecha compromiso: ${fechaCorta(previa.fechaCompromiso)} → ${fechaCorta(fechaNueva)}. Motivo: ${v('justificacion')}` });
      if (datos.estatus !== previa.estatus) entradas.push({ tipo: 'Cambio de estatus', texto: `Estatus: ${previa.estatus} → ${datos.estatus}` });
      if (datos.responsableEmail !== previa.responsableEmail) entradas.push({ tipo: 'Sistema', texto: `Responsable: ${previa.responsableNombre} → ${datos.responsableNombre}` });
      if (requiere && datos.accionResuelta === false && (!previa.requiereAccion || previa.accionResuelta || previa.accionDetalle !== datos.accionDetalle || previa.accionDe !== accionDe)) {
        entradas.push({ tipo: 'Acción', texto: `Requiere acción de ${accionDe}: ${datos.accionDetalle}` });
      }
      if (!requiere && previa.requiereAccion && !previa.accionResuelta) entradas.push({ tipo: 'Acción', texto: `Petición a ${previa.accionDe} retirada` });
      if (datos.avance !== previa.avance && !entradas.some((x) => x.tipo === 'Cambio de estatus')) entradas.push({ tipo: 'Avance', texto: `Avance: ${Math.round(previa.avance)}% → ${datos.avance}%` });
      await repo.actualizarActividad(previa.id, datos, estado.usuario, entradas);

      if (requiereAutorizacion) {
        const r = await solicitarCambioFecha(ctx, { ...previa, ...datos }, fechaNueva, v('justificacion'));
        toast(r.correo ? 'Cambios guardados. Se envió al director la solicitud de cambio de fecha.' : 'Cambios guardados. La solicitud quedó registrada; el aviso al director se reintentará automáticamente.', { error: !r.correo });
      } else {
        toast('Cambios guardados');
      }
      await ctx.recargar();
      navegar(`#/actividad/${previa.id}`);
    } catch (err) {
      caja.textContent = mensajeError(err);
      caja.hidden = false;
      boton.disabled = false;
    }
  });
  if (!editando) form.titulo.focus();
}
