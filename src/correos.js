// Correo de solicitud de autorización de cambio de fecha.
// Lo usa la app (se envía al momento desde el buzón de quien solicita) y el motor de avisos (reintento).
import { fechaLarga } from './logic.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function enlaceAutorizar(appUrl, solicitudId) {
  return `${appUrl.replace(/#.*$/, '')}#/autorizar/${solicitudId}`;
}

export function correoAutorizacion({ actividad: a, solicitud: s, appUrl }) {
  const asunto = `Autorización de cambio de fecha: ${a.titulo}`;
  const fila = (t, v) => `<tr><td style="padding:6px 14px 6px 0;color:#695B55;white-space:nowrap;vertical-align:top">${esc(t)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#FBF8F4;font-family:Segoe UI,Arial,sans-serif;color:#211A18">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F4"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E8DFD7;border-radius:12px">
    <tr><td style="background:#211A18;color:#FBF8F4;padding:14px 24px;border-radius:12px 12px 0 0;font-weight:700">Sipnology <span style="color:#D9CFC7;font-weight:400">· Seguimiento Ingeniería</span></td></tr>
    <tr><td style="padding:24px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#A9391E">AUTORIZACIÓN REQUERIDA</div>
      <h1 style="margin:6px 0 16px;font-size:20px;line-height:1.3">${esc(s.solicitanteNombre)} solicita cambiar la fecha compromiso</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse">
        ${fila('Actividad', a.titulo)}
        ${fila('Cliente / proyecto', [a.cliente, a.proyecto].filter(Boolean).join(' · ') || '—')}
        ${fila('Fecha actual', fechaLarga(s.fechaActual))}
        ${fila('Fecha propuesta', fechaLarga(s.fechaPropuesta))}
      </table>
      <div style="margin:16px 0 0;padding:12px 14px;background:#F6EFE9;border-radius:8px;font-size:14px;white-space:pre-line"><b>Justificación:</b> ${esc(s.justificacion)}</div>
      <p style="margin:24px 0 0"><a href="${esc(enlaceAutorizar(appUrl, s.id))}" style="display:inline-block;background:#F2682A;color:#211A18;text-decoration:none;font-weight:800;font-size:16px;padding:14px 28px;border-radius:8px">Autorizar</a></p>
    </td></tr>
    <tr><td style="padding:12px 24px;border-top:1px solid #E8DFD7;color:#695B55;font-size:12px">La fecha no cambia hasta que se autorice en la plataforma.</td></tr>
  </table></td></tr></table></body></html>`;
  return { asunto, html };
}
