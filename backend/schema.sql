-- ============================================================
-- CRM VISITAS — Esquema PostgreSQL
-- ============================================================
-- Este archivo se aplica en cada arranque del backend (seed.js).
-- Es idempotente: usa `create ... if not exists`, `on conflict do nothing`
-- y bloques condicionales para migraciones entre versiones.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── USUARIOS ─────────────────────────────────────────────
-- Usuarios = equipo. Un usuario puede ser admin, supervisor o técnico:
-- cualquiera de los tres puede aparecer como asignado en tasks.technician_ids.
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null default '',
  role          text not null default 'tecnico',
  phone         text not null default '',
  specialty     text not null default '',
  created_at    timestamptz not null default now()
);

-- Migraciones idempotentes para datos/constraints que pueden haber cambiado
-- entre versiones (schema.sql se re-ejecuta en cada arranque del backend).
alter table users add column if not exists phone     text not null default '';
alter table users add column if not exists specialty text not null default '';

-- Preferencias de notificación por email. Se rellenan con defaults seguros
-- (envío activado, 60 min de antelación) para que los usuarios existentes no
-- se queden sin avisos al promocionar la feature, pero pueden desactivarlo
-- desde su panel de preferencias.
alter table users add column if not exists notify_email_enabled boolean      not null default true;
alter table users add column if not exists notify_lead_minutes  integer      not null default 60;

update users set role = 'tecnico'
  where role not in ('admin','supervisor','tecnico');

alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check check (role in ('admin','supervisor','tecnico'));

-- ─── CLIENTES ─────────────────────────────────────────────
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references users(id) on delete set null
);

-- Datos de localización del cliente. Usados por:
--   - El TaskModal para mostrar la dirección al técnico cuando abre
--     la tarea, y un botón "Cómo llegar" que lanza Maps.
--   - La ficha del cliente (ClientDetailModal) para tener la
--     información a mano sin tener que rebuscar en otro sitio.
--   - Eventualmente, una vista "ruta del día" que ordene tareas por
--     proximidad geográfica.
--
-- Todos los campos son opcionales (default '' o null). El cliente
-- existente no necesita migrarse: simplemente queda con dirección
-- vacía hasta que un admin/supervisor la rellene.
alter table clients add column if not exists address     text not null default '';
alter table clients add column if not exists city        text not null default '';
alter table clients add column if not exists postal_code text not null default '';
alter table clients add column if not exists notes       text not null default '';

-- ─── MIGRACIÓN: técnicos → usuarios ───────────────────────
-- Si la tabla `technicians` todavía existe (instalación antigua), copiamos
-- sus filas a `users` reusando el mismo UUID, y después la borramos.
-- Esto mantiene válidas todas las referencias en `tasks.technician_ids`.
-- Para cada técnico se genera un email tipo `tecnico-<slug>@local` y se
-- deja `password_hash` vacío: no puede hacer login hasta que un admin le
-- asigne una contraseña. El rol por defecto es `tecnico`.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'technicians') then

    insert into users (id, email, password_hash, name, role, phone, specialty, created_at)
    select
      t.id,
      -- email determinista: tecnico-<slug-del-nombre>-<id-corto>@local
      -- añadimos el id corto para evitar colisiones si hay nombres repetidos.
      'tecnico-' ||
        coalesce(
          nullif(lower(regexp_replace(t.name, '[^a-zA-Z0-9]+', '-', 'g')), ''),
          'sin-nombre'
        ) || '-' || substr(t.id::text, 1, 8) || '@local',
      '',                -- password_hash vacío => login imposible hasta reset
      t.name,
      'tecnico',
      coalesce(t.phone, ''),
      coalesce(t.specialty, ''),
      t.created_at
    from technicians t
    where not exists (select 1 from users u where u.id = t.id)
    -- `on conflict do nothing` (sin columna) cubre cualquier unique
    -- violation: colisión de id (pk) o de email. PostgreSQL no permite
    -- encadenar dos `on conflict` en un mismo INSERT, así que esta forma
    -- sin target es la que cubre ambos casos a la vez.
    on conflict do nothing;

    drop table technicians;
  end if;
end$$;

-- ─── TAREAS ───────────────────────────────────────────────
create table if not exists tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  date           text,                          -- YYYY-MM-DD
  start_time     text,                          -- HH:MM (24h, hora local del operador) o null
  status         text not null default 'No iniciado',
  priority       text not null default 'Media',
  client_id      uuid references clients(id) on delete set null,
  phone          text not null default '',
  technician_ids uuid[] not null default '{}',
  vehicle        text not null default '',
  type           text,
  notes          text not null default '',
  materials      text not null default '',
  estimated_time text not null default '',
  attachments    jsonb not null default '[]',
  type_fields    jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references users(id) on delete set null,
  updated_by     uuid references users(id) on delete set null
);

-- Migración idempotente para instalaciones previas: añade start_time si
-- no existe. Se almacena como text "HH:MM" para mantener simetría con
-- `date` (también text). Null = sin hora concreta.
alter table tasks add column if not exists start_time text;

-- Migración: si la tarea fue generada automáticamente por una plantilla
-- recurrente, la enlazamos para evitar duplicados al regenerar y poder
-- mostrar un badge "Recurrente" en la UI. Las tareas creadas a mano
-- tienen template_id = NULL.
alter table tasks add column if not exists template_id uuid;
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'tasks_template_id_fkey'
      and table_name = 'tasks'
  ) then
    alter table tasks
      add constraint tasks_template_id_fkey
      foreign key (template_id) references task_templates(id) on delete set null;
  end if;
end $$;
create index if not exists idx_tasks_template_date on tasks (template_id, date);

-- Trigger: actualizar updated_at automáticamente al modificar una tarea
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- ─── DATOS INICIALES ──────────────────────────────────────
insert into clients (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Clínica Norte'),
  ('00000000-0000-0000-0000-000000000002', 'Coworking 4 Caminos'),
  ('00000000-0000-0000-0000-000000000003', 'Hotel Centro'),
  ('00000000-0000-0000-0000-000000000004', 'Asesoría Delta'),
  ('00000000-0000-0000-0000-000000000005', 'Oficinas Smartgroup')
on conflict (id) do nothing;

-- ─── LIMPIEZA DE PLACEHOLDERS ─────────────────────────────
-- Históricamente poblábamos el equipo con 6 "técnicos demo" (password vacío)
-- más los migrados desde la antigua tabla `technicians` (también password
-- vacío porque no tenían credenciales). Ninguno puede hacer login y saturan
-- la vista de Equipo con usuarios falsos que parecen duplicados.
--
-- Ahora el flujo es: el admin crea un usuario desde la UI con email y
-- contraseña → automáticamente queda como persona asignable en tareas.
-- No necesitamos semillas de personas.
--
-- Borramos todos los users sin password_hash (placeholders), y limpiamos
-- los uuid huérfanos que puedan quedar en tasks.technician_ids. Los users
-- con password_hash real (creados por el admin) se respetan siempre.
do $$
begin
  if exists (select 1 from users where coalesce(password_hash, '') = '') then

    -- 1) Quitar las referencias huérfanas de los arrays de tareas.
    --    El `&&` (intersección de arrays) selecciona solo tareas que tengan
    --    al menos un placeholder; el array_agg reconstruye el array dejando
    --    únicamente los ids que siguen correspondiendo a un usuario real.
    update tasks
       set technician_ids = coalesce(
             (select array_agg(tid)
                from unnest(technician_ids) as tid
               where exists (
                 select 1 from users u
                  where u.id = tid
                    and coalesce(u.password_hash, '') <> ''
               )),
             '{}'::uuid[]
           )
     where technician_ids && (
       select coalesce(array_agg(id), '{}'::uuid[])
         from users
        where coalesce(password_hash, '') = ''
     );

    -- 2) Borrar los placeholders. Si una tarea tenía created_by/updated_by
    --    apuntando aquí, el FK es `on delete set null` — no rompe nada.
    delete from users where coalesce(password_hash, '') = '';
  end if;
end$$;

-- ─── JOBS DE RECORDATORIO DE TAREAS ───────────────────────
-- Por cada (tarea, técnico) guardamos el id del job programado en pg-boss
-- para poder cancelarlo si la tarea cambia de fecha/hora o si se desasigna
-- al técnico. ON DELETE CASCADE limpia automáticamente al borrar tarea/usuario.
create table if not exists task_reminder_jobs (
  task_id  uuid  not null references tasks(id) on delete cascade,
  user_id  uuid  not null references users(id) on delete cascade,
  job_id   text  not null,
  primary key (task_id, user_id)
);

-- ─── ACTIVITY LOG DE TAREAS ───────────────────────────────
-- Registramos cada cambio relevante (create / update con diff / delete)
-- para tener un timeline visible en el modal de la tarea: quién, qué y
-- cuándo. El payload va en jsonb por flexibilidad — en `updated`
-- contiene un array `changes` con el diff legible (label, from, to);
-- en `created` y `deleted` basta con saber actor y timestamp.
--
-- ON DELETE CASCADE: si la tarea se borra, su historial también. La
-- alternativa (mantener historial de tareas borradas) implicaría
-- desnormalizar el title a la activity row. Para v1 elegimos la
-- simplicidad — si en el futuro hace falta auditoría permanente, se
-- añade snapshot al payload de `deleted` y se quita el cascade.
create table if not exists task_activity (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  actor_id    uuid references users(id) on delete set null,
  type        text not null,                   -- "created" | "updated" | "deleted"
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_task_activity_task_time
  on task_activity (task_id, created_at desc);

-- ─── COMENTARIOS DE TAREAS ────────────────────────────────
-- Hilo de mensajes interno por tarea — sustituye a la conversación
-- típica que iría por WhatsApp/email. Cada usuario autenticado puede
-- comentar; sólo el autor puede editar/borrar el suyo.
--
-- ON DELETE CASCADE: si se borra la tarea, los comentarios se van con
-- ella (no tienen vida propia fuera de la tarea). El author va con
-- ON DELETE SET NULL — si se borra al usuario, los comentarios se
-- conservan pero pierden el autor (mejor que perder el contexto).
create table if not exists task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  author_id   uuid references users(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create index if not exists idx_task_comments_task_time
  on task_comments (task_id, created_at asc);

-- ─── PLANTILLAS DE TAREAS ─────────────────────────────────
-- Permite guardar combinaciones de campos típicas (p.ej. "Mantenimiento
-- mensual VOIP" con tipo, prioridad, técnico habitual y notas con
-- checklist) y aplicarlas al crear una nueva tarea con un click. Para
-- empresas con tareas repetitivas (mantenimientos, incidencias-tipo,
-- instalaciones estándar) ahorra mucho tiempo y reduce errores.
--
-- NO incluye `date` ni `start_time` ni `attachments` — esos siempre
-- son per-instancia. La plantilla captura el "tipo de trabajo", no la
-- ocurrencia concreta.
--
-- `technician_ids` se almacena como uuid[] sin FK (igual que en tasks):
-- si un usuario se da de baja, su id queda en el array pero al
-- aplicar la plantilla filtramos los que ya no existen.
create table if not exists task_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                -- nombre de la plantilla (ej: "Mantenimiento mensual VOIP")
  title           text not null default '',     -- título por defecto de la tarea generada
  type            text,
  priority        text not null default 'Media',
  status          text not null default 'No iniciado',
  estimated_time  text not null default '',
  notes           text not null default '',
  materials       text not null default '',
  vehicle         text not null default '',
  phone           text not null default '',
  client_id       uuid references clients(id) on delete set null,
  technician_ids  uuid[] not null default '{}',
  type_fields     jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references users(id) on delete set null
);

create index if not exists idx_task_templates_name
  on task_templates (name asc);

-- ─── RECURRENCIA: columnas embedded en la plantilla ──────
-- Decisión de diseño: NO una tabla separada. Una plantilla tiene como
-- mucho UN patrón de recurrencia, y casi siempre la lógica "guardar
-- tipo de trabajo" y "agendar repetición" van de la mano. Acoplar los
-- datos en la misma fila simplifica el form (una sección extra en el
-- modal de plantillas), evita un join, y hace trivial el toggle de
-- activación.
--
-- Patrones soportados (kind):
--   "daily"     → cada día
--   "weekly"    → en los días de la semana indicados (recurrence_weekdays:
--                 0=domingo, 1=lunes, …, 6=sábado, ISO-like de Date.getDay())
--   "monthly"   → un día concreto del mes (recurrence_day_of_month: 1-31).
--                 Si el día no existe en el mes (p.ej. 31 en febrero),
--                 generamos en el último día disponible.
--
-- recurrence_lookahead_days es el horizonte de generación: el worker
-- mantiene generadas las tareas hasta `today + lookahead`. Default 30:
-- generas un mes por delante, lo cual permite ver el calendario futuro
-- y reaccionar a cambios sin tener huecos.
--
-- recurrence_last_fired_at se actualiza tras cada generación correcta
-- y sirve para evitar re-procesos en runs intermedios.
alter table task_templates add column if not exists recurrence_kind            text;
alter table task_templates add column if not exists recurrence_weekdays        int[] not null default '{}';
alter table task_templates add column if not exists recurrence_day_of_month    int;
alter table task_templates add column if not exists recurrence_start_time      text;
alter table task_templates add column if not exists recurrence_lookahead_days  int not null default 30;
alter table task_templates add column if not exists recurrence_active          boolean not null default false;
alter table task_templates add column if not exists recurrence_last_fired_at   timestamptz;

-- Trigger: actualiza updated_at automáticamente. Reutilizamos la
-- función update_updated_at() definida más arriba para tasks.
drop trigger if exists task_templates_updated_at on task_templates;
create trigger task_templates_updated_at
  before update on task_templates
  for each row execute function update_updated_at();

-- ─── RECORDATORIOS PERSONALES ─────────────────────────────
-- Cada usuario crea sus propios recordatorios (privados). El backend
-- programa un job en pg-boss para `remind_at`; al disparar, el worker
-- envía un email al usuario y marca status='sent'.
-- Estados:
--   pending  → programado, no enviado todavía
--   sent     → enviado correctamente al menos una vez
--   dismissed→ el usuario lo descartó manualmente; no se envía
create table if not exists reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  remind_at   timestamptz not null,
  status      text not null default 'pending',
  job_id      text,                                    -- id del job en pg-boss (para cancelar)
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table reminders drop constraint if exists reminders_status_check;
alter table reminders
  add constraint reminders_status_check check (status in ('pending','sent','dismissed'));

create index if not exists reminders_user_id_idx   on reminders(user_id);
create index if not exists reminders_remind_at_idx on reminders(remind_at);

drop trigger if exists reminders_updated_at on reminders;
create trigger reminders_updated_at
  before update on reminders
  for each row execute function update_updated_at();
