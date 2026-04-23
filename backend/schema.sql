-- ============================================================
-- CRM VISITAS — Esquema PostgreSQL
-- ============================================================
-- Este archivo se carga automáticamente al crear la base de datos
-- la primera vez (docker-entrypoint-initdb.d). No se ejecuta de nuevo
-- en reinicios posteriores.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── USUARIOS ─────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null default '',
  role          text not null default 'tecnico',
  created_at    timestamptz not null default now()
);

-- Migraciones idempotentes para datos/constraints que pueden haber cambiado
-- entre versiones (schema.sql se re-ejecuta en cada arranque del backend).
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

-- ─── TÉCNICOS ─────────────────────────────────────────────
create table if not exists technicians (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null default '',
  specialty   text not null default '',
  created_at  timestamptz not null default now()
);

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

insert into technicians (id, name, phone, specialty) values
  ('00000000-0000-0001-0000-000000000001', 'Carlos',   '', 'Telefonía'),
  ('00000000-0000-0001-0000-000000000002', 'Marta',    '', 'Redes'),
  ('00000000-0000-0001-0000-000000000003', 'Fernando', '', 'Instalaciones'),
  ('00000000-0000-0001-0000-000000000004', 'Laura',    '', 'Soporte'),
  ('00000000-0000-0001-0000-000000000005', 'Andrés',   '', 'Mantenimiento'),
  ('00000000-0000-0001-0000-000000000006', 'Luis',     '', 'Infraestructura')
on conflict (id) do nothing;
