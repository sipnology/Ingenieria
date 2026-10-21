// ─────────────────────────────────────────────────────────────
//  Configuración del tenant. Es lo único que hay que editar.
//  Ninguno de estos valores es secreto: identifican la app, no la autorizan.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  // Directorio de Sipnology (el mismo que usa el NOC)
  tenantId: '7e4245e5-225d-4ad0-9cf3-276fcc694c15',
  // Entra ID → Registros de aplicaciones → "Seguimiento Ingeniería (web)" → Id. de aplicación (cliente)
  clientId: '5eaca380-e206-45ef-9516-fa32af37f5ea',

  // Sitio de SharePoint donde viven las listas: https://sipnologysacv.sharepoint.com/sites/Ingenieria
  sitio: {
    hostname: 'sipnologysacv.sharepoint.com',
    ruta: '/sites/Ingenieria',
  },

  zonaHoraria: 'America/Mexico_City',
};

/** La app corre en modo demostración si falta la configuración o si la URL trae ?demo */
export function esDemo() {
  const p = new URLSearchParams(location.search);
  if (p.has('demo')) return true;
  return CONFIG.clientId.startsWith('PENDIENTE') || CONFIG.tenantId.startsWith('PENDIENTE');
}
