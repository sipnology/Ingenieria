// Cliente mínimo de Microsoft Graph. Funciona en el navegador y en Node 20+ (usa fetch).
// `obtenerToken(scopes)` lo provee quien lo use: MSAL en la app, credencial federada en el motor de avisos.

export class ErrorGraph extends Error {
  constructor(status, codigo, mensaje, url) {
    super(mensaje || `Graph respondió ${status}`);
    this.status = status;
    this.codigo = codigo;
    this.url = url;
  }
}

const BASE = 'https://graph.microsoft.com/v1.0';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export function crearGraph(obtenerToken) {
  async function solicitar(metodo, ruta, cuerpo, opciones = {}) {
    const url = ruta.startsWith('https://') ? ruta : `${BASE}${ruta}`;
    for (let intento = 0; ; intento++) {
      const token = await obtenerToken(opciones.scopes);
      const r = await fetch(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(opciones.encabezados || {}),
        },
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      });
      if ((r.status === 429 || r.status === 503 || r.status === 504) && intento < 4) {
        const ra = Number(r.headers.get('Retry-After'));
        await espera((Number.isFinite(ra) && ra > 0 ? ra : 2 ** intento) * 1000);
        continue;
      }
      if (r.status === 204 || r.status === 202) return null;
      const texto = await r.text();
      const json = texto ? JSON.parse(texto) : null;
      if (!r.ok) throw new ErrorGraph(r.status, json?.error?.code, json?.error?.message, url);
      return json;
    }
  }

  return {
    get: (ruta, o) => solicitar('GET', ruta, undefined, o),
    post: (ruta, cuerpo, o) => solicitar('POST', ruta, cuerpo, o),
    patch: (ruta, cuerpo, o) => solicitar('PATCH', ruta, cuerpo, o),
    borrar: (ruta, o) => solicitar('DELETE', ruta, undefined, o),
    /** GET paginado: sigue @odata.nextLink y regresa todos los `value`. */
    async todos(ruta, o) {
      const out = [];
      let siguiente = ruta;
      while (siguiente) {
        const pagina = await solicitar('GET', siguiente, undefined, o);
        out.push(...(pagina?.value || []));
        siguiente = pagina?.['@odata.nextLink'];
      }
      return out;
    },
  };
}
