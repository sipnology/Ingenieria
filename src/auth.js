// Inicio de sesión con Entra ID (MSAL 4, flujo de código con PKCE para SPA).
/* global msal */
import { CONFIG } from './config.js';

export const SCOPES = ['User.Read', 'Sites.ReadWrite.All', 'Mail.Send'];
// Se piden solo donde se usan (como en el NOC): si aún no tienen consentimiento, el resto de la app sigue funcionando.
export const SCOPES_CONFIGURACION = ['Sites.Manage.All'];
export const SCOPES_DIRECTORIO = ['User.ReadBasic.All', 'GroupMember.ReadWrite.All'];

let pca = null;
let cuenta = null;

function redirectUri() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

/** Inicia MSAL, procesa la respuesta de Entra ID y, si no hay sesión, manda a iniciar sesión. */
export async function iniciar() {
  pca = new msal.PublicClientApplication({
    auth: {
      clientId: CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${CONFIG.tenantId}`,
      redirectUri: redirectUri(),
      postLogoutRedirectUri: redirectUri(),
      navigateToLoginRequestUrl: true,
    },
    cache: { cacheLocation: 'localStorage' },
  });
  await pca.initialize();
  const respuesta = await pca.handleRedirectPromise();
  if (respuesta?.account) pca.setActiveAccount(respuesta.account);
  cuenta = pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
  if (!cuenta) {
    await pca.loginRedirect({ scopes: SCOPES, redirectStartPage: location.href, prompt: 'select_account' });
    return null; // el navegador sale hacia Entra ID
  }
  pca.setActiveAccount(cuenta);
  const upn = (cuenta.username || '').toLowerCase();
  return { nombre: cuenta.name || cuenta.username, email: upn, upn, entraId: cuenta.localAccountId || cuenta.idTokenClaims?.oid || '' };
}

export async function obtenerToken(scopes = SCOPES) {
  try {
    const r = await pca.acquireTokenSilent({ scopes, account: cuenta });
    return r.accessToken;
  } catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError || e?.errorCode === 'consent_required' || e?.errorCode === 'interaction_required') {
      // Primero una ventana emergente (no se pierde lo que estabas haciendo); si el navegador la bloquea, redirección
      try {
        return (await pca.acquireTokenPopup({ scopes, account: cuenta })).accessToken;
      } catch (e2) {
        if (e2?.errorCode !== 'popup_window_error' && e2?.errorCode !== 'empty_window_error') throw e2;
        await pca.acquireTokenRedirect({ scopes, account: cuenta, redirectStartPage: location.href });
        return new Promise(() => {}); // el navegador sale hacia Entra ID
      }
    }
    throw e;
  }
}

export function cerrarSesion() {
  pca?.logoutRedirect({ account: cuenta });
}
