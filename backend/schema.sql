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
