// Token de aplicación para Microsoft Graph.
//
// En GitHub Actions usa la CREDENCIAL FEDERADA (relación de confianza GitHub ↔ Entra ID):
// GitHub emite un token OIDC firmado para este repositorio y Entra ID lo acepta en lugar de un secreto.
// No hay contraseñas ni certificados guardados en ningún lado.
//
// Para pruebas locales se acepta AZURE_CLIENT_SECRET (no se recomienda en producción).

const AUDIENCIA_FEDERADA = 'api://AzureADTokenExchange';

async function tokenDeGitHub() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const portador = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !portador) return null;
  const r = await fetch(`${url}&audience=${encodeURIComponent(AUDIENCIA_FEDERADA)}`, { headers: { Authorization: `Bearer ${portador}` } });
  if (!r.ok) throw new Error(`GitHub no emitió el token OIDC (${r.status}). ¿El flujo tiene "permissions: id-token: write"?`);
  return (await r.json()).value;
}

export function crearProveedorToken({ tenantId, clientId }) {
  let cache = null;
  return async function obtenerToken() {
    if (cache && cache.expira - Date.now() > 120000) return cache.token;
    const cuerpo = new URLSearchParams({ client_id: clientId, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
    const federado = await tokenDeGitHub();
    if (federado) {
      cuerpo.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      cuerpo.set('client_assertion', federado);
    } else if (process.env.AZURE_CLIENT_SECRET) {
      cuerpo.set('client_secret', process.env.AZURE_CLIENT_SECRET);
    } else {
      throw new Error('Sin credencial: corre dentro de GitHub Actions (credencial federada) o define AZURE_CLIENT_SECRET para pruebas locales.');
    }
    const r = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, { method: 'POST', body: cuerpo });
    const json = await r.json();
    if (!r.ok) throw new Error(`Entra ID rechazó la credencial: ${json.error_description || json.error}`);
    cache = { token: json.access_token, expira: Date.now() + json.expires_in * 1000 };
    return cache.token;
  };
}
