// Configuración inicial: crea/actualiza las listas de SharePoint y siembra valores por defecto.
import { CONFIG } from '../config.js';
import { LISTAS } from '../schema.js';
import { esc, mensajeError } from '../ui.js';

export async function vistaConfiguracion(ctx) {
  const { estado, main, repo } = ctx;
  const faltan = estado.errorCarga?.codigo === 'listaNoExiste';
  if (!faltan && !estado.esDirector) {
    main.innerHTML = '<div class="aviso aviso--info">La configuración inicial solo la corre el director. <a href="#/">Ir al tablero</a></div>';
    return;
  }
  let sitio = null;
  let errorSitio = null;
  try { sitio = await repo.sitio(); } catch (e) { errorSitio = e; }

  main.innerHTML = `
    <div class="encabezado"><div class="encabezado__txt">
      <div class="kicker">Configuración inicial</div><h1>Preparar SharePoint</h1>
      <p class="sub">Crea las listas donde vive la información. Se puede correr las veces que sea necesario: solo agrega lo que falte.</p></div></div>
    ${faltan ? '<div class="aviso aviso--info">Todavía no existen las listas en el sitio. Para continuar, alguien con permisos de propietario del sitio debe correr este paso una vez.</div>' : ''}
    <section class="tarjeta" aria-labelledby="t-sitio">
      <h2 id="t-sitio">Sitio</h2>
      ${errorSitio
        ? `<div class="aviso aviso--error"><b>No se pudo abrir el sitio ${esc(CONFIG.sitio.hostname + CONFIG.sitio.ruta)}.</b><br>${esc(mensajeError(errorSitio))}<br>Revisa <code>src/config.js</code> y que tu cuenta tenga acceso al sitio.</div>`
        : `<p style="margin:0"><b>${esc(sitio.displayName)}</b> · <a href="${esc(sitio.webUrl)}" target="_blank" rel="noopener">${esc(sitio.webUrl)}</a></p>`}
      <p class="tarjeta__nota" style="margin:0">Listas: ${Object.values(LISTAS).map(esc).join(' · ')}</p>
      <p class="tarjeta__nota" style="margin:0">Este paso pide un permiso adicional (administrar listas del sitio). Solo se usa aquí.</p>
      <div class="acciones"><button type="button" class="btn btn--primario" data-correr ${errorSitio ? 'disabled' : ''}>Crear o revisar listas</button></div>
      <pre class="registro" data-registro hidden></pre>
    </section>`;

  const registro = main.querySelector('[data-registro]');
  main.querySelector('[data-correr]').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    registro.hidden = false;
    registro.textContent = '';
    const reportar = (t) => { registro.textContent += `${t}\n`; registro.scrollTop = registro.scrollHeight; };
    try {
      await repo.provisionar(estado.usuario, reportar);
      reportar('\nListo. Recargando la aplicación…');
      setTimeout(() => { location.hash = '#/equipo'; location.reload(); }, 1200);
    } catch (err) {
      reportar(`\n✗ ${mensajeError(err)}`);
      if (err.status === 403) reportar('Tu cuenta necesita ser propietaria del sitio y la app debe tener consentimiento de administrador para Sites.Manage.All.');
      b.disabled = false;
    }
  });
}
