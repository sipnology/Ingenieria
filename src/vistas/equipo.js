// Equipo enlazado con Entra ID: el director busca a la persona en el directorio, la agrega
// (entra al grupo del sitio y con eso tiene acceso) y la da de baja por rotación (sale del grupo,
// sus actividades abiertas se reasignan y su historial se conserva).
import { AREAS, ROLES } from '../schema.js';
import { cargaPorPersona, estaAbierta, esLaPersona } from '../logic.js';
import { esc, dialogo, toast, errorValidacion, etqArea, mensajeError } from '../ui.js';

export async function vistaEquipo(ctx) {
  const { estado, main, repo } = ctx;
  const D = estado.datos;
  const equipo = [...D.equipo].sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));
  const carga = cargaPorPersona(D.actividades, D.equipo, estado.hoy, D.config.capacidadDefecto);

  main.innerHTML = `
    <div class="encabezado"><div class="encabezado__txt">
      <div class="kicker">Configuración · solo director</div><h1>Equipo</h1>
      <p class="sub">Altas y bajas enlazadas con Entra ID. Agregar a alguien le da acceso al sitio de Ingeniería; darlo de baja se lo quita y conserva su historial.</p></div>
      <button type="button" class="btn btn--primario" data-nuevo>+ Agregar integrante</button></div>
    <div data-estado-entra><div class="cargando">Revisando Entra ID…</div></div>
    <section class="tarjeta" style="padding:0;overflow:hidden" aria-label="Integrantes">
      <div class="tabla-caja"><table class="tabla">
        <thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Área</th><th scope="col">Rol</th><th scope="col">Capacidad</th><th scope="col">Carga actual</th><th scope="col">Entra ID</th><th scope="col">Estado</th><th scope="col"><span class="oculto-visual">Acciones</span></th></tr></thead>
        <tbody>${equipo.map((p) => {
          const c = carga.find((x) => x.email === p.email);
          return `<tr><td><b>${esc(p.nombre)}</b></td><td>${esc(p.email)}</td><td>${etqArea(p.area) || '—'}</td><td>${esc(p.rol)}</td>
            <td>${p.capacidadHoras ?? D.config.capacidadDefecto} h${p.capacidadHoras == null ? " (defecto)" : ""}</td>
            <td>${c ? `${c.horas} h · ${c.abiertas} act.` : '—'}</td>
            <td data-entra="${esc(p.entraId)}">…</td>
            <td>${p.activo ? '<span class="pill pill--curso">Activo</span>' : '<span class="pill pill--sin">Baja</span>'}</td>
            <td style="white-space:nowrap"><button type="button" class="btn btn--texto" data-editar="${p.id}">Editar</button>
              ${p.activo ? (esLaPersona(p, estado.usuario.email) ? '' : `<button type="button" class="btn btn--texto btn--peligro" data-baja="${p.id}">Dar de baja</button>`) : `<button type="button" class="btn btn--texto" data-reactivar="${p.id}">Reactivar</button>`}</td></tr>`;
        }).join('') || '<tr><td colspan="9">Sin integrantes todavía.</td></tr>'}</tbody></table></div>
    </section>
    <section class="tarjeta" data-sin-registro hidden aria-labelledby="t-sinreg">
      <h2 id="t-sinreg">En el grupo del sitio, pero no en el equipo</h2>
      <p class="tarjeta__nota" style="margin:-8px 0 0">Tienen acceso al sitio de SharePoint pero no aparecen en el tablero. Agrégalos si son de Ingeniería.</p>
      <div data-lista-sinreg></div>
    </section>`;

  const tras = async (p) => { if (await p) { await ctx.recargar(); ctx.refrescar(); } };
  main.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const p = D.equipo.find((x) => x.id === Number(b.dataset.editar || b.dataset.baja || b.dataset.reactivar));
    if ('nuevo' in b.dataset) tras(agregar(ctx, null));
    else if (b.dataset.agregarDirectorio) tras(agregar(ctx, JSON.parse(b.dataset.agregarDirectorio)));
    else if (b.dataset.editar) tras(editar(ctx, p));
    else if (b.dataset.baja) tras(darDeBaja(ctx, p));
    else if (b.dataset.reactivar) tras(agregar(ctx, { entraId: p.entraId, nombre: p.nombre, email: p.email, upn: p.upn }, p));
  });

  // Estado frente a Entra ID (pide permisos de directorio la primera vez)
  const caja = main.querySelector('[data-estado-entra]');
  try {
    const miembros = await repo.miembrosDelGrupo();
    if (!miembros) {
      caja.innerHTML = '<div class="aviso aviso--error">El sitio no está conectado a un grupo de Microsoft 365, así que no se puede dar acceso desde aquí. Las altas y bajas se registran en la plataforma, pero el acceso al sitio se administra en SharePoint.</div>';
      for (const td of main.querySelectorAll('[data-entra]')) td.textContent = '—';
      return;
    }
    const ids = new Set(miembros.map((m) => m.entraId));
    for (const td of main.querySelectorAll('[data-entra]')) {
      td.innerHTML = !td.dataset.entra ? '<span class="pill pill--sin">Sin enlazar</span>'
        : ids.has(td.dataset.entra) ? '<span class="pill pill--completada">Con acceso</span>' : '<span class="pill pill--riesgo">Sin acceso</span>';
    }
    caja.innerHTML = '';
    const registrados = new Set(D.equipo.map((p) => p.entraId).filter(Boolean));
    const sinRegistro = miembros.filter((m) => !registrados.has(m.entraId) && !D.equipo.some((p) => esLaPersona(p, m.upn) || esLaPersona(p, m.email)));
    if (sinRegistro.length) {
      main.querySelector('[data-sin-registro]').hidden = false;
      main.querySelector('[data-lista-sinreg]').innerHTML = sinRegistro.map((m) => `<div class="espera"><div class="espera__txt"><b>${esc(m.nombre)}</b><span>${esc(m.email || m.upn)}</span></div>
        <button type="button" class="btn" data-agregar-directorio="${esc(JSON.stringify(m))}">Agregar al equipo</button></div>`).join('');
    }
  } catch (e) {
    caja.innerHTML = `<div class="aviso aviso--error"><b>No se pudo consultar Entra ID.</b> ${esc(mensajeError(e))}<br>Se necesita el consentimiento de administrador para los permisos de directorio (User.ReadBasic.All y GroupMember.ReadWrite.All).</div>`;
    for (const td of main.querySelectorAll('[data-entra]')) td.textContent = '—';
  }
}

const opt = (v, sel, t = v) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`;
const camposRol = (x, capDef) => `<div class="rejilla">
  <div class="campo"><label for="i-area">Área</label><select id="i-area" name="area">${opt('', x.area || '', '— (director)')}${AREAS.map((a) => opt(a, x.area || 'Preventa')).join('')}</select></div>
  <div class="campo"><label for="i-rol">Rol</label><select id="i-rol" name="rol">${ROLES.map((r) => opt(r, x.rol || 'Ingeniero')).join('')}</select></div>
  <div class="campo"><label for="i-cap">Capacidad semanal (h)</label><input id="i-cap" name="cap" type="number" min="0" max="80" value="${x.capacidadHoras ?? ''}" placeholder="${capDef}"></div></div>`;

/** Alta (o reactivación): buscar en Entra ID → agregar al grupo del sitio → registrar en Equipo. */
function agregar(ctx, preseleccion, existente = null) {
  const { estado, repo } = ctx;
  let elegido = preseleccion;
  return dialogo({
    titulo: existente ? `Reactivar a ${existente.nombre}` : 'Agregar integrante',
    enviar: existente ? 'Reactivar' : 'Agregar',
    cuerpo: `${existente ? '' : `<div class="campo"><label for="i-buscar">Buscar en el directorio de Sipnology *</label>
        <input id="i-buscar" name="buscar" type="search" autocomplete="off" placeholder="Nombre o correo" value="${esc(preseleccion?.nombre || '')}">
        <div data-resultados style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto"></div></div>`}
      <div class="aviso aviso--info" data-elegido ${elegido ? '' : 'hidden'}>${elegido ? `<b>${esc(elegido.nombre)}</b> · ${esc(elegido.email)}` : ''}</div>
      ${camposRol(existente || {}, estado.datos.config.capacidadDefecto)}
      <p class="tarjeta__nota" style="margin:0">Se agrega como miembro del grupo del sitio de Ingeniería en Entra ID: con eso puede entrar a la plataforma.</p>`,
    alAbrir: (form) => {
      const input = form.querySelector('[name="buscar"]');
      if (!input) return;
      const caja = form.querySelector('[data-resultados]');
      const elegidoBox = form.querySelector('[data-elegido]');
      let t = null;
      const buscar = async () => {
        const q = input.value.trim();
        if (q.length < 2) { caja.innerHTML = ''; return; }
        caja.innerHTML = '<span class="tarjeta__nota">Buscando…</span>';
        try {
          const r = await repo.buscarPersonas(q);
          caja.innerHTML = r.length ? r.map((u) => `<button type="button" class="btn" style="justify-content:flex-start;white-space:normal;text-align:left" data-u="${esc(JSON.stringify(u))}"><b>${esc(u.nombre)}</b>&nbsp;· ${esc(u.email)}</button>`).join('')
            : '<span class="tarjeta__nota">Sin resultados.</span>';
        } catch (e) { caja.innerHTML = `<span class="error-campo">${esc(mensajeError(e))}</span>`; }
      };
      input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 300); });
      caja.addEventListener('click', (e) => {
        const b = e.target.closest('[data-u]');
        if (!b) return;
        elegido = JSON.parse(b.dataset.u);
        elegidoBox.innerHTML = `<b>${esc(elegido.nombre)}</b> · ${esc(elegido.email)}`;
        elegidoBox.hidden = false;
        caja.innerHTML = '';
      });
      if (preseleccion) buscar();
    },
    alEnviar: async (form) => {
      if (!elegido) throw errorValidacion('Busca y elige a la persona en el directorio.');
      if (!elegido.email) throw errorValidacion('Esa cuenta no tiene correo en Entra ID; no podría recibir avisos.');
      const yaEsta = existente || estado.datos.equipo.find((p) => (p.entraId && p.entraId === elegido.entraId) || esLaPersona(p, elegido.email) || esLaPersona(p, elegido.upn));
      if (yaEsta && yaEsta.activo && !existente) throw errorValidacion(`${elegido.nombre} ya está en el equipo.`);
      if (elegido.entraId) await repo.agregarAlGrupo(elegido.entraId);
      await repo.guardarIntegrante({
        id: yaEsta?.id, nombre: elegido.nombre, email: elegido.email, upn: elegido.upn, entraId: elegido.entraId,
        area: form.area.value, rol: form.rol.value, capacidadHoras: form.cap.value === '' ? null : Number(form.cap.value), activo: true,
      });
      toast(`${elegido.nombre} ${existente || yaEsta ? 'reactivado' : 'agregado'} con acceso al sitio`);
    },
  });
}

function editar(ctx, p) {
  const { estado, repo } = ctx;
  return dialogo({
    titulo: `Editar a ${p.nombre}`,
    cuerpo: `<p class="tarjeta__nota" style="margin:0">${esc(p.email)}${p.entraId ? '' : ' · sin enlazar a Entra ID (dalo de baja y vuelve a agregarlo desde el directorio)'}</p>${camposRol(p, estado.datos.config.capacidadDefecto)}`,
    alEnviar: async (form) => {
      if (esLaPersona(p, estado.usuario.email) && form.rol.value !== 'Director' && !estado.datos.equipo.some((o) => o.rol === 'Director' && o.activo && o.id !== p.id)) {
        throw errorValidacion('Eres el único director: si cambias tu rol nadie podrá administrar la plataforma.');
      }
      await repo.guardarIntegrante({ ...p, area: form.area.value, rol: form.rol.value, capacidadHoras: form.cap.value === '' ? null : Number(form.cap.value) });
      toast('Cambios guardados');
    },
  });
}

/** Baja por rotación: reasigna lo abierto, quita del grupo del sitio y conserva el historial. */
function darDeBaja(ctx, p) {
  const { estado, repo } = ctx;
  const abiertas = estado.datos.actividades.filter((a) => estaAbierta(a) && a.responsableEmail === p.email);
  const otros = estado.datos.equipo.filter((x) => x.activo && x.id !== p.id).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return dialogo({
    titulo: `Dar de baja a ${p.nombre}`, enviar: 'Dar de baja',
    cuerpo: `${abiertas.length ? `<div class="campo"><label for="b-nuevo">Tiene ${abiertas.length} actividad${abiertas.length === 1 ? '' : 'es'} abierta${abiertas.length === 1 ? '' : 's'}. Reasignar a *</label>
        <select id="b-nuevo" name="nuevo" required><option value="">Elige a quién…</option>${otros.map((o) => opt(o.email, '', o.nombre)).join('')}</select></div>` : '<p style="margin:0">No tiene actividades abiertas.</p>'}
      <label class="casilla"><input type="checkbox" name="quitar" checked><span>Quitarle el acceso al sitio de Ingeniería (sale del grupo en Entra ID)</span></label>
      <p class="tarjeta__nota" style="margin:0">Sus actividades cerradas y su bitácora se conservan con su nombre.</p>`,
    alEnviar: async (form) => {
      const nuevo = abiertas.length ? otros.find((o) => o.email === form.nuevo.value) : null;
      if (abiertas.length && !nuevo) throw errorValidacion('Elige a quién reasignar sus actividades abiertas.');
      for (const a of abiertas) {
        await repo.actualizarActividad(a.id, { responsableEmail: nuevo.email, responsableNombre: nuevo.nombre }, estado.usuario,
          [{ tipo: 'Sistema', texto: `Responsable: ${p.nombre} → ${nuevo.nombre} (baja por rotación)` }]);
      }
      if (form.quitar.checked && p.entraId) await repo.quitarDelGrupo(p.entraId);
      await repo.guardarIntegrante({ ...p, activo: false });
      toast(`${p.nombre} dado de baja${abiertas.length ? ` · ${abiertas.length} actividades reasignadas a ${nuevo.nombre}` : ''}`);
    },
  });
}
