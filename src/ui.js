// Utilidades de interfaz: escape de HTML, pastillas, avisos y diálogos.
import { situacion, enRiesgo, fechaCorta } from './logic.js';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function iniciales(nombre = '') {
  const partes = nombre.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '·';
}

export function claveArea(area = '') {
  return area.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function etqArea(area) {
  return area ? `<span class="etq etq--${claveArea(area)}">${esc(area)}</span>` : '';
}

/** Pastilla de estado: combina el estatus capturado con la situación de la fecha. */
export function pillEstado(a, hoy) {
  if (a.estatus === 'Completada') return '<span class="pill pill--completada">Completada</span>';
  if (a.estatus === 'Cancelada') return '<span class="pill pill--cancelada">Cancelada</span>';
  const s = situacion(a, hoy);
  if (s.clave === 'vencida') return `<span class="pill pill--vencida">Vencida · ${s.dias} día${s.dias === 1 ? '' : 's'}</span>`;
  if (a.estatus === 'Bloqueada') return '<span class="pill pill--bloqueada">Bloqueada</span>';
  if (a.estatus === 'En espera') return '<span class="pill pill--espera">En espera</span>';
  if (enRiesgo(a, hoy)) return '<span class="pill pill--riesgo">En riesgo</span>';
  if (a.estatus === 'Sin iniciar') return '<span class="pill pill--sin">Sin iniciar</span>';
  return `<span class="pill pill--curso">En curso · ${Math.round(a.avance)}%</span>`;
}

export function textoFecha(a, hoy) {
  const s = situacion(a, hoy);
  if (s.clave === 'vencida') return `<span class="txt-vencida">${esc(fechaCorta(a.fechaCompromiso))}</span>`;
  if (s.clave === 'hoy') return '<b>Hoy</b>';
  return esc(fechaCorta(a.fechaCompromiso));
}

export function fechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
}

let contenedorToasts = null;
export function toast(mensaje, { error = false, ms = 3800 } = {}) {
  if (!contenedorToasts) {
    contenedorToasts = document.createElement('div');
    contenedorToasts.className = 'toasts';
    contenedorToasts.setAttribute('role', 'status');
    contenedorToasts.setAttribute('aria-live', 'polite');
    document.body.append(contenedorToasts);
  }
  const t = document.createElement('div');
  t.className = `toast${error ? ' toast--error' : ''}`;
  t.textContent = mensaje;
  contenedorToasts.append(t);
  setTimeout(() => t.remove(), error ? ms * 2 : ms);
}

/**
 * Abre un diálogo con un formulario. `alEnviar(form)` puede ser async; si lanza error se muestra
 * y el diálogo sigue abierto. Regresa una promesa que se resuelve al cerrar.
 */
export function dialogo({ titulo, cuerpo, enviar = 'Guardar', alEnviar, alAbrir }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = `<form class="modal__int" method="dialog" novalidate>
      <h2>${esc(titulo)}</h2>
      ${cuerpo}
      <div class="aviso aviso--error" data-error hidden></div>
      <div class="acciones acciones--fin">
        <button type="button" class="btn" data-cancelar>Cancelar</button>
        <button type="submit" class="btn btn--oscuro">${esc(enviar)}</button>
      </div>
    </form>`;
    document.body.append(d);
    const form = d.querySelector('form');
    const cerrar = (valor) => { d.close(); d.remove(); resolve(valor); };
    d.querySelector('[data-cancelar]').addEventListener('click', () => cerrar(false));
    d.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(false); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const boton = form.querySelector('[type="submit"]');
      const caja = form.querySelector('[data-error]');
      boton.disabled = true;
      caja.hidden = true;
      try {
        await alEnviar?.(form);
        cerrar(true);
      } catch (err) {
        caja.textContent = mensajeError(err);
        caja.hidden = false;
        boton.disabled = false;
      }
    });
    d.showModal();
    alAbrir?.(form);
    form.querySelector('textarea, input, select')?.focus();
  });
}

export function mensajeError(err) {
  if (!err) return 'Ocurrió un error.';
  if (err.validacion) return err.message;
  if (err.status === 403) return 'No tienes permiso para esta operación en SharePoint. Pide al dueño del sitio que te agregue como miembro.';
  if (err.status === 404) return 'No se encontró el elemento (puede que alguien lo haya borrado).';
  if (err.status === 412 || err.status === 409) return 'Alguien más modificó este elemento al mismo tiempo. Recarga e intenta de nuevo.';
  if (err.name === 'TypeError') return 'No hay conexión con Microsoft 365. Revisa tu red e intenta de nuevo.';
  return err.message || 'Ocurrió un error.';
}

export function errorValidacion(mensaje) {
  const e = new Error(mensaje);
  e.validacion = true;
  return e;
}
