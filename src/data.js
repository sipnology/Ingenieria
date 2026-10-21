// Repositorio de datos: la UI solo habla con esta interfaz.
// repoSharePoint = datos reales vía Graph; repoDemo = memoria del navegador con datos de ejemplo.

import { LISTAS } from './schema.js';
import {
  actividadDeItem, camposDeActividad, integranteDeItem, camposDeIntegrante, bitacoraDeItem, configuracionEfectiva,
  categoriaDeItem, clienteDeItem, proyectoDeItem, solicitudDeItem, camposDeSolicitud, camposDeAviso,
} from './logic.js';
import { semillaDemo, directorioDemo } from './demo-data.js';

const ahoraISO = () => new Date().toISOString();

/**
 * @param sp            listas con los permisos normales del usuario
 * @param tz            zona horaria
 * @param spConfiguracion listas con permiso para crearlas (solo configuración inicial)
 * @param graphDirectorio Graph con permisos de directorio (solo pantalla Equipo; se piden al usarla)
 */
export function repoSharePoint({ sp, tz, spConfiguracion = sp, graphDirectorio }) {
  let idsConfig = new Map();
  let grupoId = null;

  async function bitacora(actividadId, tipo, texto, usuario) {
    await sp.crear(LISTAS.bitacora, {
      Title: `${tipo} · ${actividadId}`.slice(0, 255), ActividadId: actividadId, TipoEntrada: tipo, Texto: texto,
      AutorEmail: usuario.email, AutorNombre: usuario.nombre,
    });
  }

  return {
    demo: false,
    async cargar() {
      const [acts, eq, cats, clis, pros, sols, cfg] = await Promise.all([
        sp.items(LISTAS.actividades), sp.items(LISTAS.equipo), sp.items(LISTAS.categorias), sp.items(LISTAS.clientes),
        sp.items(LISTAS.proyectos), sp.items(LISTAS.solicitudes), sp.items(LISTAS.configuracion),
      ]);
      const guardada = {};
      idsConfig = new Map();
      for (const i of cfg) {
        idsConfig.set(i.fields.Title, i.id);
        try { guardada[i.fields.Title] = JSON.parse(i.fields.Valor || 'null'); } catch { /* valor inválido: se ignora */ }
      }
      return {
        actividades: acts.map((i) => actividadDeItem(i, tz)),
        equipo: eq.map(integranteDeItem),
        categorias: cats.map(categoriaDeItem),
        clientes: clis.map(clienteDeItem),
        proyectos: pros.map(proyectoDeItem),
        solicitudes: sols.map((i) => solicitudDeItem(i, tz)),
        config: configuracionEfectiva(guardada),
      };
    },

    /* ── Actividades ── */
    async bitacora(actividadId) {
      const items = await sp.items(LISTAS.bitacora, { filtro: `fields/ActividadId eq ${Number(actividadId)}` });
      return items.map(bitacoraDeItem).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    },
    async crearActividad(datos, usuario) {
      const r = await sp.crear(LISTAS.actividades, camposDeActividad({ ...datos, ultimaActualizacion: ahoraISO() }));
      const a = actividadDeItem(r, tz);
      await bitacora(a.id, 'Creación', 'Actividad registrada', usuario);
      return a;
    },
    /** `silencioso`: no cuenta como actualización (p. ej. al renombrar un catálogo). */
    async actualizarActividad(id, cambios, usuario, entradas = [], { silencioso = false } = {}) {
      const r = await sp.actualizar(LISTAS.actividades, id, camposDeActividad(silencioso ? cambios : { ...cambios, ultimaActualizacion: ahoraISO() }));
      for (const e of entradas) await bitacora(id, e.tipo, e.texto, usuario);
      return actividadDeItem({ id, fields: r, lastModifiedDateTime: r?.Modified }, tz);
    },
    agregarBitacora: (actividadId, tipo, texto, usuario) => bitacora(actividadId, tipo, texto, usuario),

    /* ── Solicitudes de cambio de fecha ── */
    async crearSolicitud(s) {
      return solicitudDeItem(await sp.crear(LISTAS.solicitudes, camposDeSolicitud(s)), tz);
    },
    async actualizarSolicitud(id, cambios) {
      await sp.actualizar(LISTAS.solicitudes, id, camposDeSolicitud(cambios));
    },
    /** Deja un aviso en la cola (lista Notificaciones); el flujo de Power Automate lo entrega. */
    async encolarAviso(a) {
      await sp.crear(LISTAS.notificaciones, camposDeAviso(a));
    },

    /* ── Catálogos ── */
    async guardarCatalogo(tipo, x) {
      const lista = { categorias: LISTAS.categorias, clientes: LISTAS.clientes, proyectos: LISTAS.proyectos }[tipo];
      const f = { Title: x.nombre, Activo: x.activo !== false };
      if (tipo === 'categorias') Object.assign(f, { Area: x.area, Orden: x.orden ?? 999 });
      if (tipo === 'proyectos') Object.assign(f, { ClienteId: x.clienteId, Cliente: x.cliente });
      if (x.id) { await sp.actualizar(lista, x.id, f); return x.id; }
      return Number((await sp.crear(lista, f)).id);
    },
    async borrarCatalogo(tipo, id) {
      const lista = { categorias: LISTAS.categorias, clientes: LISTAS.clientes, proyectos: LISTAS.proyectos }[tipo];
      await sp.borrar(lista, id);
    },

    /* ── Equipo ── */
    async guardarIntegrante(p) {
      if (p.id) await sp.actualizar(LISTAS.equipo, p.id, camposDeIntegrante(p));
      else await sp.crear(LISTAS.equipo, camposDeIntegrante(p));
    },

    /* ── Directorio de Entra ID (permisos que se piden al abrir Equipo) ── */
    async grupoDelSitio() {
      if (grupoId) return grupoId;
      const { id } = await sp.obtenerSitio();
      const drive = await graphDirectorio.get(`/sites/${id}/drive?$select=owner`);
      grupoId = drive?.owner?.group?.id || null;
      return grupoId;
    },
    async buscarPersonas(texto) {
      const q = texto.replace(/"/g, '');
      const r = await graphDirectorio.get(`/users?$search=${encodeURIComponent(`"displayName:${q}" OR "mail:${q}" OR "userPrincipalName:${q}"`)}&$select=id,displayName,mail,userPrincipalName&$top=15&$orderby=displayName`,
        { encabezados: { ConsistencyLevel: 'eventual' } });
      return (r.value || []).map((u) => ({ entraId: u.id, nombre: u.displayName, email: (u.mail || u.userPrincipalName || '').toLowerCase(), upn: (u.userPrincipalName || '').toLowerCase() }));
    },
    async miembrosDelGrupo() {
      const g = await this.grupoDelSitio();
      if (!g) return null;
      const lista = await graphDirectorio.todos(`/groups/${g}/members/microsoft.graph.user?$select=id,displayName,mail,userPrincipalName&$top=999`);
      return lista.map((u) => ({ entraId: u.id, nombre: u.displayName, email: (u.mail || '').toLowerCase(), upn: (u.userPrincipalName || '').toLowerCase() }));
    },
    async agregarAlGrupo(entraId) {
      const g = await this.grupoDelSitio();
      if (!g) throw new Error('El sitio no está conectado a un grupo de Microsoft 365; agrega a la persona como miembro del sitio desde SharePoint.');
      try {
        await graphDirectorio.post(`/groups/${g}/members/$ref`, { '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${entraId}` });
      } catch (e) {
        if (!(e.status === 400 && /already exist/i.test(e.message || ''))) throw e; // ya era miembro
      }
    },
    async quitarDelGrupo(entraId) {
      const g = await this.grupoDelSitio();
      if (!g) return;
      try { await graphDirectorio.borrar(`/groups/${g}/members/${entraId}/$ref`); } catch (e) { if (e.status !== 404) throw e; }
    },

    /* ── Configuración ── */
    async guardarConfig(clave, valor) {
      const f = { Title: clave, Valor: JSON.stringify(valor) };
      if (idsConfig.has(clave)) await sp.actualizar(LISTAS.configuracion, idsConfig.get(clave), f);
      else idsConfig.set(clave, (await sp.crear(LISTAS.configuracion, f)).id);
    },
    async notificaciones(limite = 40) {
      const desde = new Date(Date.now() - 14 * 86400000).toISOString();
      const items = await sp.items(LISTAS.notificaciones, { filtro: `fields/Enviado ge '${desde}'` });
      return items.map((i) => ({ regla: i.fields.Regla, destinatario: i.fields.Destinatario, canal: i.fields.Canal, enviado: i.fields.Enviado, actividadId: i.fields.ActividadId, estado: i.fields.Estado || 'Pendiente' }))
        .sort((a, b) => (b.enviado || '').localeCompare(a.enviado || '')).slice(0, limite);
    },
    sitio: () => sp.obtenerSitio(),
    async provisionar(usuario, reportar) {
      // Crear listas y columnas requiere Sites.Manage.All; sembrar datos solo Sites.ReadWrite.All
      await spConfiguracion.provisionar(reportar);
      await sp.sembrar(usuario, reportar);
    },
  };
}

export function repoDemo(hoy, usuario) {
  const s = semillaDemo(hoy, usuario);
  const directorio = directorioDemo();
  const grupo = new Set(s.equipo.filter((p) => p.activo).map((p) => p.entraId));
  let siguienteId = 1000;
  const clon = (x) => JSON.parse(JSON.stringify(x));
  const lento = (v) => new Promise((r) => setTimeout(() => r(v === undefined ? v : clon(v)), 120));
  const entrada = (actividadId, tipo, texto, u) => s.bitacora.push({ id: ++siguienteId, actividadId, tipo, texto, autorEmail: u.email, autorNombre: u.nombre, fecha: ahoraISO() });
  const listaDe = (tipo) => s[tipo];

  return {
    demo: true,
    cargar: () => lento({
      actividades: s.actividades, equipo: s.equipo, categorias: s.categorias, clientes: s.clientes, proyectos: s.proyectos,
      solicitudes: s.solicitudes, config: configuracionEfectiva(s.config),
    }),
    bitacora: (id) => lento(s.bitacora.filter((b) => b.actividadId === Number(id)).sort((a, b) => b.fecha.localeCompare(a.fecha))),
    async crearActividad(datos, u) {
      const a = { ...datos, id: ++siguienteId, ultimaActualizacion: ahoraISO(), creado: ahoraISO(), creadoPor: u.nombre };
      s.actividades.push(a);
      entrada(a.id, 'Creación', 'Actividad registrada', u);
      return lento(a);
    },
    async actualizarActividad(id, cambios, u, entradas = [], { silencioso = false } = {}) {
      const a = s.actividades.find((x) => x.id === Number(id));
      Object.assign(a, cambios, silencioso ? {} : { ultimaActualizacion: ahoraISO() });
      for (const e of entradas) entrada(a.id, e.tipo, e.texto, u);
      return lento(a);
    },
    async agregarBitacora(id, tipo, texto, u) { entrada(Number(id), tipo, texto, u); return lento(null); },
    async crearSolicitud(x) {
      const sol = { ...x, id: ++siguienteId, creado: ahoraISO() };
      s.solicitudes.push(sol);
      return lento(sol);
    },
    async actualizarSolicitud(id, cambios) { Object.assign(s.solicitudes.find((x) => x.id === Number(id)), cambios); return lento(null); },
    async encolarAviso(a) {
      s.notificaciones.unshift({ regla: a.regla, destinatario: a.destinatario, canal: [a.enviarTeams && 'teams', a.enviarCorreo && 'correo'].filter(Boolean).join('+'), enviado: ahoraISO(), actividadId: a.actividadId, estado: 'Pendiente' });
      return lento(null);
    },
    async guardarCatalogo(tipo, x) {
      const l = listaDe(tipo);
      if (x.id) { Object.assign(l.find((y) => y.id === x.id), x); return x.id; }
      const id = ++siguienteId;
      l.push({ activo: true, ...x, id });
      return id;
    },
    async borrarCatalogo(tipo, id) { s[tipo] = s[tipo].filter((x) => x.id !== id); return lento(null); },
    async guardarIntegrante(p) {
      if (p.id) Object.assign(s.equipo.find((x) => x.id === p.id), p);
      else s.equipo.push({ ...p, id: ++siguienteId });
      return lento(null);
    },
    grupoDelSitio: () => lento('grupo-demo'),
    async buscarPersonas(texto) {
      const q = texto.toLowerCase();
      return lento(directorio.filter((d) => d.nombre.toLowerCase().includes(q) || d.email.includes(q)).slice(0, 15));
    },
    miembrosDelGrupo: () => lento(directorio.filter((d) => grupo.has(d.entraId))),
    async agregarAlGrupo(id) { grupo.add(id); return lento(null); },
    async quitarDelGrupo(id) { grupo.delete(id); return lento(null); },
    async guardarConfig(clave, valor) { s.config[clave] = valor; return lento(null); },
    notificaciones: () => lento(s.notificaciones),
    sitio: () => lento({ displayName: 'Ingeniería (demostración)', webUrl: '#' }),
    async provisionar(u, reportar) {
      for (const l of Object.values(LISTAS)) { reportar(`✓ Lista ${l} (simulada)`); await new Promise((r) => setTimeout(r, 120)); }
    },
  };
}
