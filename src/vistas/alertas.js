// Configuración de avisos (solo director) y registro de avisos enviados.
// Los avisos solo van al dueño de la actividad y al director.
import { REGLAS } from '../schema.js';
import { esc, fechaHora, toast, mensajeError } from '../ui.js';

const NOMBRE_REGLA = Object.fromEntries(REGLAS.map((r) => [r.id, r.nombre]));

export async function vistaAlertas(ctx) {
  const { estado, main, repo } = ctx;
  const cfg = estado.datos.config;
  const casilla = (name, checked, texto, disabled = false) => `<label class="casilla" style="align-items:center"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${texto}</span></label>`;

  main.innerHTML = `
    <div class="encabezado"><div class="encabezado__txt">
      <div class="kicker">Configuración · solo director</div><h1>Alertas y avisos</h1>
      <p class="sub">Cada aviso llega solo al dueño de la actividad y a ti. Nadie recibe avisos de las actividades de otra persona.</p></div></div>
    <div class="columnas">
      <form class="col-principal" data-reglas novalidate>
        <section class="tarjeta" aria-labelledby="t-reglas">
          <h2 id="t-reglas">Reglas</h2>
          <div>${REGLAS.map((r) => {
            const v = cfg.reglas[r.id];
            const params = Object.keys(r.parametros || {}).map((p) => `<label>días hábiles <input type="number" min="1" max="30" name="${r.id}.${p}" value="${esc(v[p])}"></label>`).join('');
            const canal = r.canalFijo ? '<span class="pill pill--sin">Correo</span>'
              : `<label class="oculto-visual" for="canal-${r.id}">Canal</label><select id="canal-${r.id}" name="${r.id}.canal">
                  <option value="ambos"${v.canal === 'ambos' ? ' selected' : ''}>Teams y correo</option>
                  <option value="teams"${v.canal === 'teams' ? ' selected' : ''}>Solo Teams</option>
                  <option value="correo"${v.canal === 'correo' ? ' selected' : ''}>Solo correo</option></select>`;
            return `<div class="regla">
              <label class="casilla regla__txt"><input type="checkbox" name="${r.id}.activa"${v.activa ? ' checked' : ''}>
                <span style="display:flex;flex-direction:column;gap:4px"><b>${esc(r.nombre)}</b><span>${esc(r.detalle)}</span></span></label>
              <div class="regla__ctl">${params}
                ${casilla(`${r.id}.responsable`, v.responsable, 'Dueño', !r.editable)}
                ${casilla(`${r.id}.director`, v.director, 'Director', !r.editable)}
                ${canal}</div></div>`;
          }).join('')}</div>
        </section>
        <section class="tarjeta" aria-labelledby="t-gen">
          <h2 id="t-gen">Parámetros generales</h2>
          <div class="rejilla">
            <div class="campo"><label for="cap">Capacidad semanal por defecto (h)</label><input id="cap" name="capacidadDefecto" type="number" min="1" max="80" value="${esc(cfg.capacidadDefecto)}">
              <small>Para quien no tenga capacidad propia en Equipo.</small></div>
            <div class="campo doble"><label for="fer">Días feriados</label><input id="fer" name="diasFeriados" value="${esc((cfg.diasFeriados || []).join(', '))}" placeholder="2026-11-16, 2026-12-25">
              <small>AAAA-MM-DD separados por coma. No cuentan como días hábiles (ni para "vence mañana").</small></div>
          </div>
        </section>
        <div class="aviso aviso--error" data-error hidden></div>
        <div class="acciones acciones--fin"><button type="submit" class="btn btn--primario">Guardar configuración</button></div>
      </form>
      <div class="col-lateral">
        <section class="tarjeta" aria-labelledby="t-hor">
          <h2 id="t-hor">Horarios (lun–vie)</h2>
          <div class="tarjeta__nota" style="display:flex;flex-direction:column;gap:8px;font-size:14px">
            <span><b>Cada 30 min</b>, de 8:00 a 19:30: peticiones al director, respuestas y cambios de fecha.</span>
            <span><b>9:00</b>: vencidas, sin actualizar y sobrecarga.</span>
            <span><b>12:00</b>: "vence mañana" (día hábil anterior a la fecha compromiso).</span>
            <span><b>Lunes 8:30</b>: resumen semanal.</span>
            <span>La solicitud de autorización de cambio de fecha sale al momento (en 1 a 5 minutos), desde ingenieria@.</span>
          </div>
        </section>
        <section class="tarjeta" aria-labelledby="t-env">
          <h2 id="t-env">Últimos avisos</h2>
          <div data-enviados><div class="cargando">Cargando…</div></div>
        </section>
      </div>
    </div>`;

  repo.notificaciones(40).then((lista) => {
    main.querySelector('[data-enviados]').innerHTML = lista.length ? `<div class="bitacora">${lista.map((n) => `<div class="entrada">
      <div class="entrada__cab"><span>${esc(fechaHora(n.enviado))}</span><span>·</span><span>${esc((n.canal || '').replace('teams', 'Teams').replace('+', ' y '))}</span><span class="pill ${n.estado === 'Enviado' ? 'pill--completada' : n.estado === 'Error' ? 'pill--vencida' : 'pill--sin'}">${esc(n.estado || 'Pendiente')}</span></div>
      <div class="entrada__txt"><b>${esc(NOMBRE_REGLA[n.regla] || n.regla)}</b> → ${esc(n.destinatario)}${n.actividadId ? ` · <a href="#/actividad/${n.actividadId}">actividad ${n.actividadId}</a>` : ''}</div></div>`).join('')}</div>`
      : '<p class="vacio">Aún no se ha enviado ningún aviso (o el motor de avisos todavía no corre).</p>';
  }).catch((e) => { main.querySelector('[data-enviados]').innerHTML = `<p class="vacio">${esc(mensajeError(e))}</p>`; });

  const form = main.querySelector('[data-reglas]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const caja = form.querySelector('[data-error]');
    caja.hidden = true;
    const reglas = {};
    for (const r of REGLAS) {
      const actual = cfg.reglas[r.id];
      reglas[r.id] = {
        activa: form[`${r.id}.activa`].checked,
        canal: r.canalFijo || form[`${r.id}.canal`].value,
        responsable: r.editable ? form[`${r.id}.responsable`].checked : actual.responsable,
        director: r.editable ? form[`${r.id}.director`].checked : actual.director,
      };
      for (const p of Object.keys(r.parametros || {})) reglas[r.id][p] = Math.max(1, Number(form[`${r.id}.${p}`].value) || r.parametros[p]);
      if (reglas[r.id].activa && !reglas[r.id].responsable && !reglas[r.id].director) {
        caja.textContent = `"${r.nombre}" está activa pero sin destinatario. Marca Dueño, Director o desactívala.`;
        caja.hidden = false;
        return;
      }
    }
    const feriados = form.diasFeriados.value.split(/[\s,;]+/).filter(Boolean);
    const malos = feriados.filter((f) => !/^\d{4}-\d{2}-\d{2}$/.test(f));
    if (malos.length) {
      caja.textContent = `Revisa el formato de estas fechas: ${malos.join(', ')} (debe ser AAAA-MM-DD).`;
      caja.hidden = false;
      return;
    }
    const boton = form.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      await repo.guardarConfig('reglas', reglas);
      await repo.guardarConfig('capacidadDefecto', Math.max(1, Number(form.capacidadDefecto.value) || 40));
      await repo.guardarConfig('diasFeriados', feriados.sort());
      await ctx.recargar();
      toast('Configuración guardada. El motor de avisos la toma en su siguiente corrida.');
    } catch (err) {
      caja.textContent = mensajeError(err);
      caja.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });
}
