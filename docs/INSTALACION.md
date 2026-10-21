# Instalación · Seguimiento de Ingeniería

Mismo patrón que el NOC: app estática en GitHub Pages, app propia registrada en Entra ID, datos en un sitio de SharePoint, correo con el permiso de cada usuario y personas administradas desde el grupo del sitio. A eso se suma un motor de avisos programado en GitHub Actions.

| Dato | Valor |
|---|---|
| Inquilino (Entra ID) | `7e4245e5-225d-4ad0-9cf3-276fcc694c15` |
| SharePoint | `sipnologysacv.sharepoint.com` |
| Sitio | `/sites/Ingenieria` |
| Repositorio | `sipnology/Ingenieria` |
| App web | `https://sipnology.github.io/Ingenieria/` |
| Buzón de avisos | `ingenieria@sipnology.com.mx` (compartido) |

## Cómo encaja todo

```
 Ingeniero / director ──inicia sesión──► Entra ID (app "Seguimiento Ingeniería (web)")
   │  página estática de GitHub Pages
   ├─ Graph con SUS permisos ──► listas del sitio Ingenieria
   ├─ Graph /me/sendMail ─────► correo "Autorizar" al director (cambio de fecha, al momento)
   └─ (solo director, pantalla Equipo) Graph ──► alta/baja en el grupo del sitio

 GitHub Actions (cada 30 min · 9:07 · 12:03 · lunes 8:23)
   ├─ credencial federada ──► app "Seguimiento Ingeniería (avisos)" ──► solo el sitio Ingenieria (Sites.Selected)
   └─ HTTP ──► flujo de Power Automate ──► tarjeta de Teams (Flow bot) + correo desde ingenieria@
```

- Los datos no salen de Microsoft 365; GitHub solo sirve archivos estáticos y corre el motor de avisos.
- No hay secretos en el repositorio. La URL del flujo se guarda como *secreto* de GitHub.
- Cada aviso va solo al dueño de la actividad y al director.

---

## A. Lo que hace un administrador del inquilino (Fernando)

Son ajustes de seguridad del inquilino; se hacen una sola vez.

### A1. Sitio de SharePoint

Si no existe `https://sipnologysacv.sharepoint.com/sites/Ingenieria`, créalo como **sitio de grupo** (Microsoft 365 group) llamado *Ingenieria*. Tú quedas como propietario. A los integrantes ya no hay que agregarlos aquí: se agregan desde la pantalla **Equipo** de la plataforma, que los mete al grupo del sitio.

### A2. App web: "Seguimiento Ingeniería (web)"

[Entra admin center](https://entra.microsoft.com) → **Aplicaciones → Registros de aplicaciones → Nuevo registro**

1. Nombre: `Seguimiento Ingeniería (web)` · *Solo este directorio organizativo*.
2. URI de redirección: plataforma **Aplicación de página única (SPA)** → `https://sipnology.github.io/Ingenieria/` (con la diagonal final). **Registrar.**
3. Copia el **Id. de aplicación (cliente)** y pásamelo (va en `src/config.js`).
4. **Permisos de API → Agregar un permiso → Microsoft Graph → Permisos delegados**:

   | Permiso | Para qué |
   |---|---|
   | `User.Read` | Iniciar sesión |
   | `Sites.ReadWrite.All` | Leer y escribir las listas, limitado a lo que cada usuario ya puede hacer en el sitio |
   | `Mail.Send` | Enviar, desde el buzón de quien solicita, el correo "Autorizar" de cambio de fecha (igual que el NOC) |
   | `Sites.Manage.All` | Solo la pantalla de configuración inicial, para crear las listas |
   | `User.ReadBasic.All` | Pantalla Equipo: buscar personas en el directorio |
   | `GroupMember.ReadWrite.All` | Pantalla Equipo: agregar o quitar personas del grupo del sitio |

5. **Conceder consentimiento de administrador para Sipnology.**
6. (Recomendado) **Aplicaciones empresariales → Seguimiento Ingeniería (web) → Propiedades → Asignación requerida = Sí → Usuarios y grupos → agregar el grupo *Ingenieria***. Así, quien no esté en el equipo no puede entrar.

### A3. App de avisos: "Seguimiento Ingeniería (avisos)"

1. **Nuevo registro** → `Seguimiento Ingeniería (avisos)` · inquilino único · **sin** URI de redirección. Copia su Id. de aplicación.
2. **Certificados y secretos → Credenciales federadas → Agregar credencial**:

   | Campo | Valor |
   |---|---|
   | Escenario | Acciones de GitHub que implementan recursos de Azure |
   | Organización / Repositorio | `sipnology` / `Ingenieria` |
   | Tipo de entidad / Rama | Rama / `main` |
   | Nombre | `github-avisos` |

   No se crea ningún secreto: Entra ID confía en los tokens que GitHub emite para ese repositorio y rama.
3. **Permisos de API → Microsoft Graph → Permisos de aplicación → `Sites.Selected`** → conceder consentimiento. Por sí solo no da acceso a nada.
4. Dar acceso **solo** al sitio Ingenieria. En [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer), con tu cuenta (te pedirá consentir `Sites.FullControl.All` para Graph Explorer):

   ```http
   GET https://graph.microsoft.com/v1.0/sites/sipnologysacv.sharepoint.com:/sites/Ingenieria?$select=id
   ```
   ```http
   POST https://graph.microsoft.com/v1.0/sites/{id-del-sitio}/permissions
   {
     "roles": ["write"],
     "grantedToIdentities": [{ "application": { "id": "<Id. de la app de avisos>", "displayName": "Seguimiento Ingeniería (avisos)" } }]
   }
   ```

### A4. Buzón compartido

Confirma que tu cuenta tiene **Enviar como** sobre `ingenieria@sipnology.com.mx` (Exchange admin center → Destinatarios → Buzones → ingenieria → Delegación). Lo usa el flujo del paso B3.

---

## B. Lo que hago yo (Claude), con tu Chrome

### B1. Código y GitHub Pages

- Subir el código a `sipnology/Ingenieria`, rama `main`.
- **Settings → Pages → Source: GitHub Actions**. El flujo *Publicar en GitHub Pages* corre las pruebas y publica.

### B2. Variables del repositorio

**Settings → Secrets and variables → Actions**

| Tipo | Nombre | Valor |
|---|---|---|
| Variable | `AVISOS_TENANT_ID` | `7e4245e5-225d-4ad0-9cf3-276fcc694c15` |
| Variable | `AVISOS_CLIENT_ID` | Id. de la app de avisos (A3) |
| Variable | `SP_HOSTNAME` | `sipnologysacv.sharepoint.com` |
| Variable | `SP_RUTA` | `/sites/Ingenieria` |
| Variable | `APP_URL` | `https://sipnology.github.io/Ingenieria/` |
| Secreto | `AVISOS_FLUJO_URL` | URL del flujo (B3) |

Mientras `AVISOS_CLIENT_ID` esté vacío, el motor de avisos no corre.

### B3. Flujo de entrega de avisos (Power Automate, con tu cuenta)

1. **Desencadenador:** *Cuando se recibe una solicitud de webhook de Teams* (When a Teams webhook request is received). Quién puede desencadenarlo: **Cualquiera**. La URL lleva firma y se trata como contraseña.
2. **Condición** `triggerBody()?['enviarTeams']` es igual a `true` → **Publicar tarjeta en un chat o canal**:
   - Publicar como: Flow bot · Publicar en: Chat con el bot de flujo
   - Destinatario: `triggerBody()?['destinatario']`
   - Tarjeta adaptable: `triggerBody()?['attachments']?[0]?['content']`
3. **Condición** `triggerBody()?['enviarCorreo']` es igual a `true` → **Enviar correo electrónico desde un buzón compartido (V2)**:
   - Dirección del buzón: `ingenieria@sipnology.com.mx`
   - Para: `triggerBody()?['destinatario']` · Asunto: `triggerBody()?['asunto']` · Cuerpo: `triggerBody()?['html']` (HTML)
4. Guardar y copiar la URL del desencadenador al secreto `AVISOS_FLUJO_URL`.

> Alternativa si el flujo no estuviera disponible: definir la variable `BUZON_REMITENTE` y dar a la app de avisos `Mail.Send` limitado a ese buzón (RBAC para aplicaciones de Exchange, por PowerShell). En ese modo todo llega por correo, sin Teams.

### B4. Primer arranque y verificación

1. Abrir la app con tu cuenta → **Configuración inicial → Crear o revisar listas**. Crea 9 listas, el catálogo de categorías (42 en 3 áreas) y te registra como Director.
2. **Equipo → + Agregar integrante**: buscar en el directorio y agregar a cada persona con su área, rol y capacidad.
3. **Catálogos → Clientes / Oportunidades y proyectos → Carga masiva**: pegar la lista exportada de Odoo (`Cliente; Proyecto` por renglón).
4. **Permisos por lista** (SharePoint → lista → Configuración → Permisos → Dejar de heredar):

   | Lista | Miembros | Propietarios |
   |---|---|---|
   | Actividades, Bitacora, SolicitudesFecha | Editar | Control total |
   | Equipo, Categorias, Clientes, Proyectos, Configuracion, Notificaciones | Leer | Control total |

   Así solo tú (y quien sea propietario del sitio) cambia equipo, catálogos y reglas. Si los líderes también deben editar catálogos, dales *Editar* en Categorias, Clientes y Proyectos.
5. GitHub → **Actions → Avisos de Ingeniería → Run workflow** con *simular*. Revisar qué se enviaría y luego activarlo de verdad.

---

## Reglas de aviso (configurables en la pantalla Alertas)

| Aviso | Cuándo | A quién | Canal |
|---|---|---|---|
| Vence mañana | 12:00 del día hábil anterior a la fecha compromiso | Dueño + director | Teams y correo |
| Vencida | Desde el día 1, cada día hábil a las 9:00 | Dueño + director | Teams y correo |
| Sin actualización | 5 días hábiles sin cambios | Dueño + director | Teams y correo |
| Sobrecarga | Carga semanal por encima de la capacidad | La persona + director | Teams y correo |
| Petición al director | Al marcar "necesito algo del director" (cada 30 min) | Director | Teams y correo |
| Petición respondida | Cuando el director responde | Dueño | Teams y correo |
| Autorización de cambio de fecha | Al momento, desde el buzón de quien solicita (reintento cada 30 min si falla) | Director | Correo con botón **Autorizar** |
| Cambio de fecha resuelto | Al autorizar o rechazar | Dueño | Teams y correo |
| Resumen semanal | Lunes 8:23 | Director (todo) y cada ingeniero (solo lo suyo) | Teams y correo |

## Pruebas locales

```bash
npm test
node avisos/enviar-avisos.mjs --modo=diario --demo      # también: eventos, mediodia, semanal
python3 -m http.server 8765                              # http://localhost:8765/?demo  ·  ?demo=ingeniero
```

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| `AADSTS50011` al iniciar sesión | La URI de redirección no coincide exactamente (diagonal final, plataforma SPA). |
| `AADSTS50105` | Asignación requerida activa y la persona no está en el grupo: agrégala en Equipo. |
| La pantalla Equipo no consulta Entra ID | Falta el consentimiento de `User.ReadBasic.All` y `GroupMember.ReadWrite.All` (A2.5). |
| "La solicitud quedó registrada; el aviso se reintentará" | Falló el envío con `Mail.Send` delegado; el motor de avisos lo reenvía desde ingenieria@. |
| Avisos: `AADSTS70021` | Repo o rama no coinciden con la credencial federada (A3.2). |
| Avisos: 403 | Falta el permiso `write` de la app de avisos sobre el sitio (A3.4). |
| No llegan tarjetas o correos | Revisar el historial de ejecuciones del flujo (B3) y que tu cuenta tenga *Enviar como* sobre el buzón. |
