# CRM Visitas — Backend

Express + Postgres + Socket.io. Se despliega como contenedor en Coolify.

## Variables de entorno

### Esenciales

| Variable           | Ejemplo                                | Descripción                                              |
|--------------------|-----------------------------------------|----------------------------------------------------------|
| `DATABASE_URL`     | `postgres://user:pass@host:5432/crm`   | Cadena de conexión Postgres.                             |
| `JWT_SECRET`       | `<32+ chars random>`                    | Secreto para firmar JWT. **Obligatorio en producción.**  |
| `CORS_ORIGIN`      | `https://crm.tu-dominio.es`             | Lista CSV de orígenes permitidos. **No `*` en prod.**    |
| `PORT`             | `3001`                                  | Puerto de escucha.                                       |
| `ADMIN_EMAIL`      | `admin@tu-dominio.es`                   | Sólo para sembrar el admin inicial si la BD está vacía.  |
| `ADMIN_PASSWORD`   | `<contraseña fuerte>`                   | Idem.                                                    |

### Email (SMTP) — recordatorios y avisos de tareas

El backend envía emails para recordatorios personales (PR2) y para avisos de
tareas asignadas (PR4). Si no defines `MAIL_HOST`, los correos no se envían
realmente: se loguean (modo *dry-run*), útil para desarrollo.

| Variable        | Ejemplo                                       | Descripción                                                             |
|-----------------|------------------------------------------------|-------------------------------------------------------------------------|
| `MAIL_HOST`     | `smtp.office365.com`                          | Host SMTP. Sin esto, modo dry-run.                                      |
| `MAIL_PORT`     | `587`                                          | 587 (STARTTLS) o 465 (SMTPS).                                           |
| `MAIL_SECURE`   | `false`                                        | `true` sólo si usas el puerto 465.                                      |
| `MAIL_USER`     | `crm-noreply@tu-dominio.es`                    | Usuario SMTP autenticado.                                               |
| `MAIL_PASS`     | `<contraseña / app password>`                  | Contraseña SMTP.                                                        |
| `MAIL_FROM`     | `CRM Visitas <crm-noreply@tu-dominio.es>`      | Remitente. Por defecto = `MAIL_USER`.                                   |
| `APP_BASE_URL`  | `https://crm.tu-dominio.es`                    | Base para los enlaces "ver tarea" del email.                            |
| `MAIL_VERIFY`   | `true`                                         | Si vale `true`, hace un smoke test de SMTP al arrancar (ver logs).       |

### Microsoft 365 (Exchange Online)

Para usar un buzón corporativo de M365 (`crm-noreply@tu-dominio.es`) como
remitente:

1. **Crea un buzón compartido o usuario dedicado** en el centro de
   administración de M365 (`crm-noreply@…`). Asígnale licencia con buzón
   (Exchange Online).

2. **Habilita SMTP AUTH para ese buzón**. M365 lo deshabilita por defecto
   en tenants nuevos desde 2022. Centro de administración Exchange →
   Buzones → seleccionar buzón → *Manage email apps* → marcar
   **Authenticated SMTP**.

3. **Configura la autenticación del buzón**. Tienes dos opciones:
   - *Sin MFA*: usa la contraseña del usuario. Más simple, menos seguro.
   - *Con MFA + App Password*: registra una contraseña de aplicación para
     ese buzón concreto (Azure AD → Security info) y úsala en `MAIL_PASS`.

4. **Variables**:
   ```
   MAIL_HOST=smtp.office365.com
   MAIL_PORT=587
   MAIL_SECURE=false
   MAIL_USER=crm-noreply@tu-dominio.es
   MAIL_PASS=<contraseña o app password>
   MAIL_FROM=CRM Visitas <crm-noreply@tu-dominio.es>
   ```

5. **Si tu tenant tiene SMTP AUTH bloqueado a nivel global** (admins
   estrictos): la alternativa es Microsoft Graph API
   (`/users/{id}/sendMail`) con OAuth2 client credentials. El adapter
   actual encapsula el envío en `sendMail()` — añadir un transport Graph
   sería un cambio acotado a `mailer.js`.

### Cola de jobs (pg-boss)

`pg-boss` reusa `DATABASE_URL` y crea su propio schema `pgboss`. No requiere
configuración adicional. Si pg-boss no arranca (por ejemplo BD no
disponible), el backend sigue funcionando: los emails simplemente no se
envían diferidos hasta que el operador resuelva el problema.

## Preferencias por usuario

Cada usuario gestiona sus propias notificaciones desde el icono 🔔 del
sidebar:

- **`notify_email_enabled`**: activa/desactiva el envío de emails. Por
  defecto `true`.
- **`notify_lead_minutes`**: minutos de antelación para los avisos de
  tareas con hora de inicio. Por defecto `60`.
