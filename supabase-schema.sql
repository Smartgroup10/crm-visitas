-- ============================================================
-- CRM VISITAS — Supabase Schema
-- ============================================================
-- INSTRUCCIONES:
--   1. Ve a https://supabase.com y crea un proyecto gratuito.
--   2. En el menú lateral abre "SQL Editor" y pega TODO este archivo.
--   3. Haz clic en "Run" (▶). Solo necesitas ejecutarlo una vez.
--   4. Ve a Project Settings → API y copia:
--        - Project URL  → VITE_SUPABASE_URL en .env.local
--        - anon / public key → VITE_SUPABASE_ANON_KEY en .env.local
--   5. Crea los usuarios en Authentication → Users → Invite user.
--      En el campo "User metadata" pon: {"full_name": "Nombre Apellido"}
-- ============================================================


-- ─── EXTENSIONES ──────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ─── PERFILES (vinculados a auth.users) ───────────────────
create table if not exists profiles (
  id         uuid references auth.users on delete cascade primary key,
  name       text not null default '',
  role       text not null default 'user',
  created_at timestamptz not null default now()
);

-- Trigger: crear perfil automáticamente al registrar un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── CLIENTES ─────────────────────────────────────────────
create table if not exists clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);


-- ─── TÉCNICOS ─────────────────────────────────────────────
create table if not exists technicians (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null default '',
  specialty  text not null default '',
  created_at timestamptz not null default now()
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
  technician_ids uuid[] not null default '{}',  -- array de IDs de técnicos
  vehicle        text not null default '',
  type           text,
  notes          text not null default '',
  materials      text not null default '',
  estimated_time text not null default '',
  attachments    jsonb not null default '[]',   -- [{id, name, size, type}]
  type_fields    jsonb not null default '{}',   -- campos específicos según tipo
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references profiles(id) on delete set null,
  updated_by     uuid references profiles(id) on delete set null
);

-- Trigger: actualizar updated_at automáticamente
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


-- ─── ROW LEVEL SECURITY ───────────────────────────────────
alter table profiles    enable row level security;
alter table clients     enable row level security;
alter table technicians enable row level security;
alter table tasks       enable row level security;

-- Perfiles: cualquier usuario autenticado puede leer; solo cada uno edita el suyo
create policy "Authenticated can read profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Clientes: acceso total para usuarios autenticados
create policy "Authenticated full access on clients"
  on clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Técnicos: acceso total para usuarios autenticados
create policy "Authenticated full access on technicians"
  on technicians for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Tareas: acceso total para usuarios autenticados
create policy "Authenticated full access on tasks"
  on tasks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ─── REALTIME ─────────────────────────────────────────────
-- Necesario para que los cambios se propaguen en tiempo real a todos los usuarios
alter table tasks       replica identity full;
alter table clients     replica identity full;
alter table technicians replica identity full;

do $$ begin
  alter publication supabase_realtime add table tasks;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table clients;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table technicians;
exception when others then null; end $$;


-- ─── DATOS INICIALES ──────────────────────────────────────
-- Clientes de ejemplo (puedes añadir/borrar los que quieras)
insert into clients (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Clínica Norte'),
  ('00000000-0000-0000-0000-000000000002', 'Coworking 4 Caminos'),
  ('00000000-0000-0000-0000-000000000003', 'Hotel Centro'),
  ('00000000-0000-0000-0000-000000000004', 'Asesoría Delta'),
  ('00000000-0000-0000-0000-000000000005', 'Oficinas Smartgroup')
on conflict (id) do nothing;

-- Técnicos de ejemplo
insert into technicians (id, name, phone, specialty) values
  ('00000000-0000-0001-0000-000000000001', 'Carlos',   '', 'Telefonía'),
  ('00000000-0000-0001-0000-000000000002', 'Marta',    '', 'Redes'),
  ('00000000-0000-0001-0000-000000000003', 'Fernando', '', 'Instalaciones'),
  ('00000000-0000-0001-0000-000000000004', 'Laura',    '', 'Soporte'),
  ('00000000-0000-0001-0000-000000000005', 'Andrés',   '', 'Mantenimiento'),
  ('00000000-0000-0001-0000-000000000006', 'Luis',     '', 'Infraestructura')
on conflict (id) do nothing;
