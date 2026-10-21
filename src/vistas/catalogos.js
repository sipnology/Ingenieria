// Catálogos editables: categorías por área, clientes y oportunidades/proyectos.
// Alta, edición, baja y carga masiva (pegar una lista, p. ej. exportada de Odoo).
import { AREAS } from '../schema.js';
import { esc, dialogo, toast, errorValidacion, mensajeError } from '../ui.js';

const PESTANAS = [['categorias', 'Categorías de actividad'], ['clientes', 'Clientes'], ['proyectos', 'Oportunidades y proyectos']];
const CAMPO_ID = { categorias: 'categoriaId', clientes: 'clienteId', proyectos: 'proyectoId' };
const CAMPO_TXT = { categorias: 'categoria', clientes: 'cliente', proyectos: 'proyecto' };

export async function vistaCatalogos(ctx) {
  const { estado, main } = ctx;
  estado.pestanaCatalogo ||= 'categorias';
  const t = estado.pestanaCatalogo;
  const D = estado.datos;
  const uso = (tipo, id) => D.actividades.filter((a) => a[CAMPO_ID[tipo]] === id).length;

  let tabla = '';
  if (t === 'categorias') {
    const area = estado.areaCatalogo || 'Preventa';
    const filas = D.categorias.filter((c) => c.area === area).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
    tabla = `<div class="chips" role="group" aria-label="Área">${AREAS.map((x) => `<button type="button" class="chip" data-area-cat="${esc(x)}" aria-pressed="${x === area}">${esc(x)} · ${D.categorias.filter((c) => c.area === x && c.activo).length}</button>`).join('')}</div>
      ${tablaCatalogo(filas, [['Orden', (c) => c.orden], ['Categoría', (c) => `<b>${esc(c.nombre)}</b>`]], (c) => uso('categorias', c.id))}`;
  } else if (t === 'clientes') {
    const filas = [...D.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
    tabla = tablaCatalogo(filas, [['Cliente', (c) => `<b>${esc(c.nombre)}</b>`], ['Proyectos', (c) => D.proyectos.filter((p) => p.clienteId === c.id && p.activo).length]], (c) => uso('clientes', c.id));
  } else {
    const filas = [...D.proyectos].sort((a, b) => a.cliente.localeCompare(b.cliente) || a.nombre.localeCompare(b.nombre));
    tabla = tablaCatalogo(filas, [['Cliente', (p) => esc(D.clientes.find((c) => c.id === p.clienteId)?.nombre || p.cliente)], ['Oportunidad / proyecto', (p) => `<b>${esc(p.nombre)}</b>`]], (p) => uso('proyectos', p.id));
  }

  main.innerHTML = `
    <div class="encabezado"><div class="encabezado__txt">
      <div class="kicker">Configuración · director y líderes</div><h1>Catálogos</h1>
      <p class="sub">Lo que el equipo elige al registrar una actividad. Un elemento en uso no se borra: se desactiva y su historial se conserva.</p></div>
      <div class="acciones"><button type="button" class="btn" data-masiva>Carga masiva</button><button type="button" class="btn btn--primario" data-nuevo>+ Agregar</button></div></div>
    <div class="segmentado" role="tablist" aria-label="Catálogo">${PESTANAS.map(([id, txt]) => `<button type="button" role="tab" data-pestana="${id}" aria-selected="${id === t}" aria-pressed="${id === t}">${txt}</button>`).join('')}</div>
    <section class="tarjeta" style="gap:14px">${tabla}</section>`;

  const tras = async (p) => { if (await p) { await ctx.recargar(); ctx.refrescar(); } };
  main.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.pestana) { estado.pestanaCatalogo = b.dataset.pestana; ctx.refrescar(); return; }
    if (b.dataset.areaCat) { estado.areaCatalogo = b.dataset.areaCat; ctx.refrescar(); return; }
    if ('nuevo' in b.dataset) return tras(editar(ctx, t, null));
    if ('masiva' in b.dataset) return tras(cargaMasiva(ctx, t));
    const lista = D[t];
    const x = lista.find((y) => y.id === Number(b.dataset.id));
    if (!x) return;
    if ('editar' in b.dataset) return tras(editar(ctx, t, x));
    if ('activar' in b.dataset) {
      b.disabled = true;
      try { await ctx.repo.guardarCatalogo(t, { ...x, activo: !x.activo }); toast(x.activo ? 'Desactivado: ya no aparece al registrar actividades' : 'Activado'); await ctx.recargar(); ctx.refrescar(); }
      catch (err) { toast(mensajeError(err), { error: true }); b.disabled = false; }
    }
    if ('borrar' in b.dataset) return tras(borrar(ctx, t, x, uso(t, x.id)));
  });
}

function tablaCatalogo(filas, columnas, usoDe) {
  if (!filas.length) return '<p class="vacio">Aún no hay elementos. Usa "+ Agregar" o "Carga masiva".</p>';
  return `<div class="tabla-caja"><table class="tabla">
    <thead><tr>${columnas.map(([t]) => `<th scope="col">${t}</th>`).join('')}<th scope="col">Actividades</th><th scope="col">Estado</th><th scope="col"><span class="oculto-visual">Acciones</span></th></tr></thead>
    <tbody>${filas.map((x) => `<tr>${columnas.map(([, f]) => `<td>${f(x)}</td>`).join('')}<td>${usoDe(x)}</td>
      <td>${x.activo ? '<span class="pill pill--curso">Activo</span>' : '<span class="pill pill--sin">Inactivo</span>'}</td>
      <td style="white-space:nowrap"><button type="button" class="btn btn--texto" data-editar data-id="${x.id}">Editar</button>
        <button type="button" class="btn btn--texto" data-activar data-id="${x.id}">${x.activo ? 'Desactivar' : 'Activar'}</button>
        <button type="button" class="btn btn--texto btn--peligro" data-borrar data-id="${x.id}">Eliminar</button></td></tr>`).join('')}</tbody></table></div>`;
}

function editar(ctx, tipo, x) {
  const { estado, repo } = ctx;
  const D = estado.datos;
  const opt = (v, sel, t = v) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`;
  const titulos = { categorias: 'categoría', clientes: 'cliente', proyectos: 'oportunidad o proyecto' };
  let extra = '';
  if (tipo === 'categorias') {
    extra = `<div class="rejilla"><div class="campo"><label for="c-area">Área *</label><select id="c-area" name="area">${AREAS.map((a) => opt(a, x?.area || estado.areaCatalogo || 'Preventa')).join('')}</select></div>
      <div class="campo"><label for="c-orden">Orden en la lista</label><input id="c-orden" name="orden" type="number" min="1" value="${esc(x?.orden ?? D.categorias.filter((c) => c.area === (estado.areaCatalogo || 'Preventa')).length + 1)}"></div></div>`;
  }
  if (tipo === 'proyectos') {
    extra = `<div class="campo"><label for="c-cli">Cliente *</label><select id="c-cli" name="cliente">${D.clientes.filter((c) => c.activo || c.id === x?.clienteId).sort((a, b) => a.nombre.localeCompare(b.nombre)).map((c) => opt(c.id, x?.clienteId, c.nombre)).join('')}</select></div>`;
  }
  return dialogo({
    titulo: x ? `Editar ${titulos[tipo]}` : `Agregar ${titulos[tipo]}`,
    cuerpo: `${extra}<div class="campo"><label for="c-nom">Nombre *</label><input id="c-nom" name="nombre" required maxlength="255" value="${esc(x?.nombre || '')}"></div>
      ${x ? '<p class="tarjeta__nota" style="margin:0">Si cambias el nombre, se actualiza también en las actividades que ya lo usan.</p>' : ''}`,
    alEnviar: async (form) => {
      const nombre = form.nombre.value.trim();
      if (!nombre) throw errorValidacion('Escribe el nombre.');
      const datos = { ...(x || { activo: true }), nombre };
      if (tipo === 'categorias') Object.assign(datos, { area: form.area.value, orden: Number(form.orden.value) || 999 });
      if (tipo === 'proyectos') {
        const c = D.clientes.find((y) => y.id === Number(form.cliente.value));
        if (!c) throw errorValidacion('Elige el cliente.');
        Object.assign(datos, { clienteId: c.id, cliente: c.nombre });
      }
      const duplicado = D[tipo].some((y) => y.id !== x?.id && y.nombre.toLowerCase() === nombre.toLowerCase()
        && (tipo !== 'categorias' || y.area === datos.area) && (tipo !== 'proyectos' || y.clienteId === datos.clienteId));
      if (duplicado) throw errorValidacion('Ya existe con ese nombre.');
      await repo.guardarCatalogo(tipo, datos);
      if (x && x.nombre !== nombre) await propagarNombre(ctx, tipo, x.id, nombre);
      toast('Guardado');
    },
  });
}

/** Mantiene al día el texto guardado en las actividades (para quien abra las listas en SharePoint o Excel). */
async function propagarNombre(ctx, tipo, id, nombre) {
  const { estado, repo } = ctx;
  const afectadas = estado.datos.actividades.filter((a) => a[CAMPO_ID[tipo]] === id);
  for (const a of afectadas) await repo.actualizarActividad(a.id, { [CAMPO_TXT[tipo]]: nombre }, estado.usuario, [], { silencioso: true });
  if (tipo === 'clientes') {
    for (const p of estado.datos.proyectos.filter((y) => y.clienteId === id)) await repo.guardarCatalogo('proyectos', { ...p, cliente: nombre });
  }
}

function borrar(ctx, tipo, x, enUso) {
  const { repo, estado } = ctx;
  const hijos = tipo === 'clientes' ? estado.datos.proyectos.filter((p) => p.clienteId === x.id).length : 0;
  if (enUso || hijos) {
    return dialogo({
      titulo: 'No se puede eliminar', enviar: 'Desactivar',
      cuerpo: `<p style="margin:0"><b>${esc(x.nombre)}</b> está en uso (${enUso} actividad${enUso === 1 ? '' : 'es'}${hijos ? `, ${hijos} proyecto${hijos === 1 ? '' : 's'}` : ''}). Para conservar el historial se desactiva: deja de aparecer al registrar actividades.</p>`,
      alEnviar: async () => { await repo.guardarCatalogo(tipo, { ...x, activo: false }); toast('Desactivado'); },
    });
  }
  return dialogo({
    titulo: 'Eliminar', enviar: 'Eliminar',
    cuerpo: `<p style="margin:0">¿Eliminar <b>${esc(x.nombre)}</b> del catálogo? No lo usa ninguna actividad.</p>`,
    alEnviar: async () => { await repo.borrarCatalogo(tipo, x.id); toast('Eliminado'); },
  });
}

function cargaMasiva(ctx, tipo) {
  const { estado, repo } = ctx;
  const D = estado.datos;
  const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
  const ayuda = {
    categorias: 'Una categoría por renglón. Se agregan al área elegida.',
    clientes: 'Un cliente por renglón (por ejemplo, la columna de nombres exportada de Odoo).',
    proyectos: 'Un renglón por oportunidad o proyecto: <code>Cliente; Nombre del proyecto</code>. Si el cliente no existe, se crea.',
  }[tipo];
  return dialogo({
    titulo: 'Carga masiva', enviar: 'Cargar',
    cuerpo: `${tipo === 'categorias' ? `<div class="campo"><label for="m-area">Área</label><select id="m-area" name="area">${AREAS.map((a) => opt(a, a)).join('')}</select></div>` : ''}
      <div class="campo"><label for="m-txt">Pega la lista</label><textarea id="m-txt" name="texto" rows="10" required></textarea><small>${ayuda} Los repetidos se ignoran.</small></div>`,
    alEnviar: async (form) => {
      const renglones = form.texto.value.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
      if (!renglones.length) throw errorValidacion('Pega al menos un renglón.');
      let nuevos = 0;
      if (tipo === 'categorias') {
        const area = form.area.value;
        let orden = D.categorias.filter((c) => c.area === area).length;
        for (const nombre of renglones) {
          if (D.categorias.some((c) => c.area === area && c.nombre.toLowerCase() === nombre.toLowerCase())) continue;
          const id = await repo.guardarCatalogo('categorias', { nombre, area, orden: ++orden, activo: true });
          D.categorias.push({ id, nombre, area, orden, activo: true }); nuevos++;
        }
      } else if (tipo === 'clientes') {
        for (const nombre of renglones) {
          if (D.clientes.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) continue;
          const id = await repo.guardarCatalogo('clientes', { nombre, activo: true });
          D.clientes.push({ id, nombre, activo: true }); nuevos++;
        }
      } else {
        for (const r of renglones) {
          const [cli, ...resto] = r.split(/[;\t]/);
          const nombre = resto.join(' ').trim();
          if (!cli?.trim() || !nombre) throw errorValidacion(`Renglón sin formato "Cliente; Proyecto": ${r}`);
          let c = D.clientes.find((x) => x.nombre.toLowerCase() === cli.trim().toLowerCase());
          if (!c) { c = { id: await repo.guardarCatalogo('clientes', { nombre: cli.trim(), activo: true }), nombre: cli.trim(), activo: true }; D.clientes.push(c); }
          if (D.proyectos.some((p) => p.clienteId === c.id && p.nombre.toLowerCase() === nombre.toLowerCase())) continue;
          const id = await repo.guardarCatalogo('proyectos', { nombre, clienteId: c.id, cliente: c.nombre, activo: true });
          D.proyectos.push({ id, nombre, clienteId: c.id, cliente: c.nombre, activo: true }); nuevos++;
        }
      }
      toast(`${nuevos} agregado${nuevos === 1 ? '' : 's'}${renglones.length - nuevos ? ` · ${renglones.length - nuevos} ya existían` : ''}`);
    },
  });
}
