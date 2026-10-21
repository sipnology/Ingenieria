// Indicadores: cantidad de actividades y horas por tipo de actividad, persona y cliente.
import { AREAS } from '../schema.js';
import { rangoPeriodo, activaEnRango, agrupar, estaAbierta, fechaCorta } from '../logic.js';
import { esc, etqArea } from '../ui.js';

const PERIODOS = [['semana', 'Esta semana'], ['mes', 'Este mes'], ['mesAnterior', 'Mes anterior'], ['trimestre', 'Este trimestre'], ['anio', 'Este año'], ['todo', 'Todo']];

function barra(valor, max) {
  const ancho = max ? Math.max(2, (valor / max) * 100) : 0;
  return `<div class="pista" style="height:10px;min-width:80px" aria-hidden="true"><div class="relleno" style="height:10px;width:${ancho.toFixed(1)}%"></div></div>`;
}

function tabla(grupos, columnas, vacio) {
  if (!grupos.length) return `<p class="vacio">${esc(vacio)}</p>`;
  const maxH = Math.max(...grupos.map((g) => g.horas), 0);
  return `<div class="tabla-caja"><table class="tabla">
    <thead><tr>${columnas.map(([t]) => `<th scope="col">${t}</th>`).join('')}<th scope="col">Actividades</th><th scope="col">Abiertas</th><th scope="col">Completadas</th><th scope="col">Horas</th><th scope="col">Pendientes</th><th scope="col" style="width:22%"><span class="oculto-visual">Horas relativas</span></th></tr></thead>
    <tbody>${grupos.map((g) => `<tr>${columnas.map(([, f]) => `<td>${f(g)}</td>`).join('')}
      <td><b>${g.cantidad}</b></td><td>${g.abiertas}</td><td>${g.completadas}</td><td><b>${g.horas} h</b></td><td>${g.horasPendientes} h</td><td>${barra(g.horas, maxH)}</td></tr>`).join('')}</tbody></table></div>`;
}

function csv(filas) {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const enc = ['ID', 'Actividad', 'Área', 'Categoría', 'Cliente', 'Oportunidad/proyecto', 'Responsable', 'Estatus', 'Avance %', 'Horas estimadas', 'Inicio', 'Compromiso', 'Cierre'];
  const cuerpo = filas.map((a) => [a.id, a.titulo, a.area, a.categoria, a.cliente, a.proyecto, a.responsableNombre, a.estatus, Math.round(a.avance), a.horasEstimadas, a.fechaInicio, a.fechaCompromiso, a.fechaCompletada].map(celda).join(','));
  return '﻿' + [enc.map(celda).join(','), ...cuerpo].join('\r\n');
}

export async function vistaIndicadores(ctx) {
  const { estado, main } = ctx;
  estado.filtroInd ||= { periodo: 'mes', area: '', persona: '' };
  const f = estado.filtroInd;
  const { hoy, tz } = estado;
  const rango = rangoPeriodo(f.periodo, hoy);
  const personas = [...new Map(estado.datos.equipo.filter((p) => p.rol !== 'Director').map((p) => [p.email, p.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const opt = (v, t, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`;

  const lista = estado.datos.actividades
    .filter((a) => a.estatus !== 'Cancelada')
    .filter((a) => (!f.area || a.area === f.area) && (!f.persona || a.responsableEmail === f.persona))
    .filter((a) => activaEnRango(a, rango, hoy, tz))
    .map((a) => ({ ...a, _vencida: estaAbierta(a) && a.fechaCompromiso && a.fechaCompromiso < hoy }));

  const porCategoria = agrupar(lista, (a) => [`${a.area}|${a.categoriaId || a.categoria}`, a.categoria || 'Sin categoría', a.area]);
  const porArea = agrupar(lista, (a) => [a.area, a.area]);
  const porPersona = agrupar(lista, (a) => [a.responsableEmail, a.responsableNombre || a.responsableEmail]);
  const porProyecto = agrupar(lista, (a) => [`${a.clienteId}|${a.proyectoId}`, a.proyecto || '—', a.cliente || '—']);
  const principal = (email) => agrupar(lista.filter((a) => a.responsableEmail === email), (a) => [a.categoria, a.categoria])[0]?.etiqueta || '—';
  const tot = agrupar(lista, () => ['t', 'Total'])[0] || { cantidad: 0, horas: 0, completadas: 0, horasCompletadas: 0, abiertas: 0, vencidas: 0, horasPendientes: 0 };

  main.innerHTML = `
    <div class="encabezado"><div class="encabezado__txt">
      <div class="kicker">Ingeniería · indicadores</div><h1>Indicadores</h1>
      <p class="sub">Cantidad de actividades y horas por tipo de actividad, persona y cliente · ${f.periodo === 'todo' ? 'todo el historial' : `${esc(fechaCorta(rango.desde))} al ${esc(fechaCorta(rango.hasta))}`}</p></div>
      <button type="button" class="btn" data-csv>Descargar CSV (Excel)</button></div>
    <form class="filtros" data-filtros>
      <div class="campo"><label for="i-per">Periodo</label><select id="i-per" name="periodo">${PERIODOS.map(([v, t]) => opt(v, t, f.periodo)).join('')}</select></div>
      <div class="campo"><label for="i-area">Área</label><select id="i-area" name="area">${opt('', 'Todas', f.area)}${AREAS.map((x) => opt(x, x, f.area)).join('')}</select></div>
      <div class="campo"><label for="i-per2">Persona</label><select id="i-per2" name="persona">${opt('', 'Todo el equipo', f.persona)}${personas.map(([e, n]) => opt(e, n, f.persona)).join('')}</select></div>
    </form>
    <section class="kpis" aria-label="Totales del periodo">
      <div class="kpi"><span class="kpi__etq">Actividades</span><span class="kpi__num">${tot.cantidad}</span><span class="kpi__det">${tot.abiertas} abiertas · ${tot.vencidas} vencidas</span></div>
      <div class="kpi"><span class="kpi__etq">Horas estimadas</span><span class="kpi__num">${tot.horas}</span><span class="kpi__det">${tot.horasPendientes} h pendientes</span></div>
      <div class="kpi"><span class="kpi__etq">Completadas</span><span class="kpi__num">${tot.completadas}</span><span class="kpi__det">${tot.horasCompletadas} h</span></div>
      ${porArea.map((g) => `<div class="kpi"><span class="kpi__etq">${esc(g.etiqueta)}</span><span class="kpi__num">${g.cantidad}</span><span class="kpi__det">${g.horas} h · ${g.completadas} completadas</span></div>`).join('')}
    </section>
    <section class="tarjeta" aria-labelledby="t-cat"><h2 id="t-cat">Por tipo de actividad</h2>
      ${tabla(porCategoria, [['Área', (g) => etqArea(g.extra)], ['Categoría', (g) => `<b>${esc(g.etiqueta)}</b>`]], 'Sin actividades en el periodo.')}</section>
    <section class="tarjeta" aria-labelledby="t-per"><h2 id="t-per">Por persona</h2>
      ${tabla(porPersona, [['Persona', (g) => `<b>${esc(g.etiqueta)}</b>`], ['Categoría principal', (g) => esc(principal(g.id))]], 'Sin actividades en el periodo.')}</section>
    <section class="tarjeta" aria-labelledby="t-pro"><h2 id="t-pro">Por cliente y proyecto</h2>
      ${tabla(porProyecto, [['Cliente', (g) => esc(g.extra)], ['Oportunidad / proyecto', (g) => `<b>${esc(g.etiqueta)}</b>`]], 'Sin actividades en el periodo.')}</section>`;

  const form = main.querySelector('[data-filtros]');
  form.addEventListener('change', () => { Object.assign(f, { periodo: form.periodo.value, area: form.area.value, persona: form.persona.value }); ctx.refrescar(); });
  main.querySelector('[data-csv]').addEventListener('click', () => {
    const blob = new Blob([csv(lista)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = Object.assign(document.createElement('a'), { href: url, download: `actividades-ingenieria-${f.periodo}-${hoy}.csv` });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
