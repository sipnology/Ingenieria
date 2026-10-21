// Acceso a las listas del sitio de SharePoint vía Graph (app web y motor de avisos).

import { ESQUEMA, LISTAS, CONFIG_DEFECTO, CATEGORIAS_INICIALES } from './schema.js';

const PREFER = { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' };

export function crearSharePoint(graph, { hostname, ruta }) {
  let sitio = null;
  let listas = null;

  async function obtenerSitio() {
    if (!sitio) sitio = await graph.get(`/sites/${hostname}:${ruta}?$select=id,displayName,webUrl`);
    return sitio;
  }

  async function mapaListas(refrescar = false) {
    if (!listas || refrescar) {
      const { id } = await obtenerSitio();
      const todas = await graph.todos(`/sites/${id}/lists?$select=id,displayName,name,webUrl&$top=200`);
      listas = new Map();
      for (const l of todas) {
        listas.set(l.displayName, l);
        listas.set(l.name, l);
      }
    }
    return listas;
  }

  async function listaId(nombre) {
    const l = (await mapaListas()).get(nombre);
    if (!l) {
      const e = new Error(`No existe la lista "${nombre}" en el sitio. Corre la configuración inicial.`);
      e.codigo = 'listaNoExiste';
      throw e;
    }
    return l.id;
  }

  async function base(nombre) {
    const { id } = await obtenerSitio();
    return `/sites/${id}/lists/${await listaId(nombre)}`;
  }

  return {
    obtenerSitio,
    mapaListas,

    async items(nombre, { filtro } = {}) {
      const b = await base(nombre);
      const f = filtro ? `&$filter=${encodeURIComponent(filtro)}` : '';
      return graph.todos(`${b}/items?$expand=fields&$top=500${f}`, filtro ? { encabezados: PREFER } : undefined);
    },
    async crear(nombre, fields) {
      return graph.post(`${await base(nombre)}/items`, { fields });
    },
    async actualizar(nombre, id, fields) {
      return graph.patch(`${await base(nombre)}/items/${id}/fields`, fields);
    },
    async borrar(nombre, id) {
      return graph.borrar(`${await base(nombre)}/items/${id}`);
    },

    /**
     * Crea las listas y columnas que falten y agrega opciones nuevas a las columnas de elección.
     * Es idempotente: se puede correr cuantas veces sea necesario.
     */
    async provisionar(reportar = () => {}, opciones = {}) {
      const { id: siteId } = await obtenerSitio();
      const existentes = await mapaListas(true);
      for (const [nombre, def] of Object.entries(ESQUEMA)) {
        const lista = existentes.get(nombre);
        if (!lista) {
          reportar(`Creando lista ${nombre}…`);
          await graph.post(`/sites/${siteId}/lists`, {
            displayName: nombre,
            description: def.descripcion,
            columns: def.columnas,
            list: { template: 'genericList' },
          }, opciones);
          reportar(`✓ Lista ${nombre} creada con ${def.columnas.length} columnas`);
          continue;
        }
        const columnas = await graph.todos(`/sites/${siteId}/lists/${lista.id}/columns?$top=200`, opciones);
        const porNombre = new Map(columnas.map((c) => [c.name, c]));
        let agregadas = 0;
        for (const col of def.columnas) {
          const actual = porNombre.get(col.name);
          if (!actual) {
            await graph.post(`/sites/${siteId}/lists/${lista.id}/columns`, col, opciones);
            agregadas++;
          } else if (col.choice && actual.choice) {
            const faltan = col.choice.choices.filter((c) => !actual.choice.choices.includes(c));
            if (faltan.length) {
              await graph.patch(`/sites/${siteId}/lists/${lista.id}/columns/${actual.id}`, { choice: { ...actual.choice, choices: [...actual.choice.choices, ...faltan] } }, opciones);
              reportar(`✓ ${nombre}.${col.name}: opciones nuevas ${faltan.join(', ')}`);
            }
          }
        }
        reportar(agregadas ? `✓ Lista ${nombre}: ${agregadas} columnas agregadas` : `✓ Lista ${nombre} ya estaba completa`);
      }
      await mapaListas(true);
    },

    /** Siembra configuración, catálogo de categorías y al director, solo si faltan. */
    async sembrar(usuario, reportar = () => {}) {
      await mapaListas(true);
      const config = await this.items(LISTAS.configuracion);
      const claves = new Set(config.map((i) => i.fields.Title));
      for (const [clave, valor] of Object.entries(CONFIG_DEFECTO)) {
        if (!claves.has(clave)) {
          await this.crear(LISTAS.configuracion, { Title: clave, Valor: JSON.stringify(valor) });
          reportar(`✓ Configuración "${clave}" con valores por defecto`);
        }
      }
      const categorias = await this.items(LISTAS.categorias);
      if (!categorias.length) {
        let n = 0;
        for (const [area, lista] of Object.entries(CATEGORIAS_INICIALES)) {
          for (const [orden, nombre] of lista.entries()) {
            await this.crear(LISTAS.categorias, { Title: nombre, Area: area, Orden: orden + 1, Activo: true });
            n++;
          }
        }
        reportar(`✓ Catálogo de categorías inicial (${n} categorías en ${Object.keys(CATEGORIAS_INICIALES).length} áreas)`);
      }
      const equipo = await this.items(LISTAS.equipo);
      if (!equipo.length && usuario?.email) {
        await this.crear(LISTAS.equipo, { Title: usuario.nombre, Email: usuario.email, UPN: usuario.upn || usuario.email, EntraId: usuario.entraId || '', Rol: 'Director', Activo: true });
        reportar(`✓ ${usuario.nombre} registrado como Director`);
      }
    },
  };
}
