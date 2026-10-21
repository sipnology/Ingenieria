// Contenido de los avisos: tarjeta adaptable para Teams y correo HTML.
import { fechaLarga, fechaCorta, situacion } from '../src/logic.js';
import { correoAutorizacion, enlaceAutorizar } from '../src/correos.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enlace = (base, a, aviso) => (aviso?.regla === 'solicitudFecha' ? enlaceAutorizar(base, aviso.solicitud.id) : a ? `${base}#/actividad/${a.id}` : base);

function hechos(aviso) {
  const a = aviso.actividad;
  if (aviso.regla === 'sobrecarga') {
    const p = aviso.persona;
    return [['Persona', p.nombre], ['Horas esta semana', `${p.horas} h`], ['Capacidad', `${p.capacidad} h`], ['Actividades abiertas', String(p.abiertas)]];
  }
  if (!a) return [];
  const f = [['Actividad', a.titulo], ['Cliente / proyecto', [a.cliente, a.proyecto].filter(Boolean).join(' · ') || '—'], ['Categoría', a.categoria || '—'],
    ['Responsable', a.responsableNombre || '—'], ['Compromiso', fechaLarga(a.fechaCompromiso)], ['Avance', `${Math.round(a.avance)}%`]];
  if (aviso.solicitud) {
    const s = aviso.solicitud;
    f.push(['Fecha propuesta', fechaLarga(s.fechaPropuesta)], ['Justificación', s.justificacion]);
    if (s.comentario) f.push(['Comentario del director', s.comentario]);
  }
  if (aviso.regla === 'accionDirector') {
    f.push(['Necesita', a.accionDetalle]);
    if (a.accionFecha) f.push(['Para', fechaLarga(a.accionFecha)]);
  }
  if (aviso.regla === 'accionRespondida') f.push(['Respuesta', a.accionRespuesta]);
  return f;
}

function textoAccion(aviso) {
  switch (aviso.regla) {
    case 'accionDirector': return 'Responder';
    case 'accionRespondida': return 'Ver respuesta';
    case 'porVencer': case 'vencida': case 'sinActualizar': return aviso.destinatario?.paraDirector ? 'Ver actividad' : 'Actualizar avance';
    case 'solicitudFecha': return 'Autorizar';
    default: return 'Abrir en la plataforma';
  }
}

export function tarjetaTeams(aviso, appUrl) {
  const color = ['vencida', 'sobrecarga'].includes(aviso.regla) || aviso.solicitud?.estatus === 'Rechazada' ? 'Attention' : 'Accent';
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: 'Seguimiento Ingeniería', size: 'Small', isSubtle: true },
      { type: 'TextBlock', text: aviso.etiqueta, weight: 'Bolder', size: 'Small', color },
      { type: 'TextBlock', text: aviso.asunto, weight: 'Bolder', size: 'Medium', wrap: true },
      { type: 'FactSet', facts: hechos(aviso).map(([title, value]) => ({ title, value: String(value ?? '—') })) },
    ],
    actions: [{ type: 'Action.OpenUrl', title: textoAccion(aviso), url: enlace(appUrl, aviso.actividad, aviso) }],
  };
}

function marco(titulo, contenido, appUrl, etiqueta) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#FBF8F4;font-family:Segoe UI,Arial,sans-serif;color:#211A18">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F4"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E8DFD7;border-radius:12px">
    <tr><td style="background:#211A18;color:#FBF8F4;padding:14px 24px;border-radius:12px 12px 0 0;font-weight:700">Sipnology <span style="color:#D9CFC7;font-weight:400">· Seguimiento Ingeniería</span></td></tr>
    <tr><td style="padding:24px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#A9391E">${esc(etiqueta)}</div>
      <h1 style="margin:6px 0 16px;font-size:20px;line-height:1.3">${esc(titulo)}</h1>
      ${contenido}
      <p style="margin:24px 0 0"><a href="${esc(appUrl)}" style="display:inline-block;background:#F2682A;color:#211A18;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">Abrir la plataforma</a></p>
    </td></tr>
    <tr><td style="padding:12px 24px;border-top:1px solid #E8DFD7;color:#695B55;font-size:12px">Aviso automático. Las reglas de aviso las configura el director en la plataforma.</td></tr>
  </table></td></tr></table></body></html>`;
}

function tablaHechos(filas) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse">${filas.map(([t, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#695B55;white-space:nowrap;vertical-align:top">${esc(t)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`).join('')}</table>`;
}

function tablaActividades(lista, hoy, appUrl, conResponsable) {
  if (!lista.length) return '<p style="color:#695B55;font-size:14px">Nada por aquí.</p>';
  return `<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;border-collapse:collapse">
    <tr style="background:#1B3A5C;color:#fff;text-align:left"><th style="padding:8px">Actividad</th>${conResponsable ? '<th style="padding:8px">Responsable</th>' : ''}<th style="padding:8px">Compromiso</th></tr>
    ${lista.map((a, i) => {
      const venc = situacion(a, hoy).clave === 'vencida';
      return `<tr style="background:${i % 2 ? '#F2F5F7' : '#fff'}"><td style="padding:8px"><a href="${esc(enlace(appUrl, a))}" style="color:#211A18;font-weight:600">${esc(a.titulo)}</a></td>
        ${conResponsable ? `<td style="padding:8px">${esc(a.responsableNombre)}</td>` : ''}
        <td style="padding:8px;${venc ? 'color:#7C281A;font-weight:700' : ''}">${esc(fechaCorta(a.fechaCompromiso))}${venc ? ' (vencida)' : ''}</td></tr>`;
    }).join('')}</table>`;
}

export function correo(aviso, appUrl, hoy) {
  if (aviso.regla === 'solicitudFecha') return correoAutorizacion({ actividad: aviso.actividad, solicitud: aviso.solicitud, appUrl });
  let contenido;
  if (aviso.tipoResumen === 'director') {
    const { kpi, carga, vencidas, director, completadasSemanaPasada, solicitudes = [] } = aviso.resumen;
    contenido = `${tablaHechos([
      ['Completadas la semana pasada', String(completadasSemanaPasada)],
      ['Actividades abiertas', String(kpi.abiertas)],
      ['Vencen esta semana', String(kpi.venceSemana)],
      ['Vencidas', String(kpi.vencidas)],
      ['Esperan tu respuesta', String(kpi.requierenDirector)],
      ['Cambios de fecha por autorizar', String(solicitudes.length)],
      ['Esperando a otras áreas', String(kpi.esperandoAreas)],
      ['Con sobrecarga', carga.filter((c) => c.sobrecarga).map((c) => `${c.nombre} (${c.horas} h)`).join(', ') || 'Nadie'],
    ])}
    <h2 style="font-size:16px;margin:20px 0 8px">Esperan tu respuesta</h2>${tablaActividades(director, hoy, appUrl, true)}
    ${solicitudes.length ? `<h2 style="font-size:16px;margin:20px 0 8px">Cambios de fecha por autorizar</h2>
      <ul style="font-size:14px;padding-left:18px">${solicitudes.map((x) => `<li><a href="${esc(enlaceAutorizar(appUrl, x.id))}" style="color:#211A18;font-weight:600">${esc(x.actividad.titulo)}</a> · ${esc(x.solicitanteNombre)}: ${esc(fechaCorta(x.fechaActual))} → ${esc(fechaCorta(x.fechaPropuesta))}</li>`).join('')}</ul>` : ''}
    <h2 style="font-size:16px;margin:20px 0 8px">Vencidas</h2>${tablaActividades(vencidas, hoy, appUrl, true)}`;
  } else if (aviso.tipoResumen === 'personal') {
    const { mias, carga } = aviso.resumen;
    contenido = `<p style="font-size:14px">Tienes ${mias.length} actividades abiertas${carga ? ` y ${carga.horas} h estimadas para esta semana (capacidad ${carga.capacidad} h)` : ''}. Si algo cambió, actualízalo para que el equipo lo vea.</p>
      ${tablaActividades(mias, hoy, appUrl, false)}`;
  } else {
    contenido = tablaHechos(hechos(aviso))
      + (aviso.actividad ? `<p style="margin:16px 0 0"><a href="${esc(enlace(appUrl, aviso.actividad, aviso))}" style="color:#A9391E;font-weight:700">${esc(textoAccion(aviso))} →</a></p>` : '');
  }
  return { asunto: aviso.asunto, html: marco(aviso.asunto, contenido, appUrl, aviso.etiqueta) };
}
