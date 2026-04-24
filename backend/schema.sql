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
    on conflict (id)    do nothing
    on conflict (email) do nothing;

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

-- Técnicos de ejemplo (ahora como usuarios con rol `tecnico` y password vacío).
-- Reusan los mismos UUID que antes para no romper tasks.technician_ids.
insert into users (id, email, password_hash, name, role, phone, specialty) values
  ('00000000-0000-0001-0000-000000000001', 'tecnico-carlos@local',   '', 'Carlos',   'tecnico', '', 'Telefonía'),
  ('00000000-0000-0001-0000-000000000002', 'tecnico-marta@local',    '', 'Marta',    'tecnico', '', 'Redes'),
  ('00000000-0000-0001-0000-000000000003', 'tecnico-fernando@local', '', 'Fernando', 'tecnico', '', 'Instalaciones'),
  ('00000000-0000-0001-0000-000000000004', 'tecnico-laura@local',    '', 'Laura',    'tecnico', '', 'Soporte'),
  ('00000000-0000-0001-0000-000000000005', 'tecnico-andres@local',   '', 'Andrés',   'tecnico', '', 'Mantenimiento'),
  ('00000000-0000-0001-0000-000000000006', 'tecnico-luis@local',     '', 'Luis',     'tecnico', '', 'Infraestructura')
on conflict (id)    do nothing;
