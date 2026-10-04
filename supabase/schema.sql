-- =====================================================================
--  BARBERÍA · Esquema Supabase
--  Ejecutar completo en: Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Administradores (dueños) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Barberos ----------
create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text default 'Barbero',
  bio text,
  photo_url text,
  commission_pct numeric(5,2) not null default 50 check (commission_pct between 0 and 100),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ---------- Servicios ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  duration_min int not null default 30 check (duration_min > 0),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ---------- Reservas ----------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 2 and 80),
  client_phone text not null check (char_length(client_phone) between 7 and 20),
  client_email text,
  barber_id uuid not null references public.barbers(id),
  service_id uuid not null references public.services(id),
  date date not null,
  time time not null,
  price numeric(12,2),
  status text not null default 'pendiente'
    check (status in ('pendiente','confirmada','completada','cancelada')),
  notes text,
  created_at timestamptz default now()
);

-- Evita doble reserva del mismo barbero a la misma hora (excepto canceladas)
create unique index if not exists reservations_no_double
  on public.reservations (barber_id, date, time) where status <> 'cancelada';
create index if not exists reservations_date_idx on public.reservations (date);

-- ---------- Movimientos financieros ----------
-- tipo: ingreso (extra, ej. venta de productos), gasto (fijo: arriendo, servicios),
--       costo (variable: insumos), inversion (equipos, remodelación)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('ingreso','gasto','costo','inversion')),
  category text not null,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  date date not null default current_date,
  barber_id uuid references public.barbers(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists transactions_date_idx on public.transactions (date);

-- ---------- Configuración del negocio (fila única) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  monthly_goal numeric(14,2) default 15000000,
  updated_at timestamptz default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- Reglas de seguridad para reservas públicas ----------
-- Un visitante anónimo solo puede crear reservas "pendiente" y el precio lo
-- fija la base de datos a partir del servicio (no se puede manipular).
create or replace function public.reservation_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status := 'pendiente';
    new.notes := null;
    select price into new.price from public.services where id = new.service_id and active;
    if new.price is null then raise exception 'Servicio no válido'; end if;
    if new.date < current_date then raise exception 'Fecha no válida'; end if;
  elsif new.price is null then
    select price into new.price from public.services where id = new.service_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_reservation_before_insert on public.reservations;
create trigger trg_reservation_before_insert
  before insert on public.reservations
  for each row execute function public.reservation_before_insert();

-- Horas ocupadas (sin exponer datos de clientes)
drop function if exists public.get_busy_slots(uuid, date);
create or replace function public.get_busy_slots(p_barber uuid, p_date date)
returns table (slot time, duration_min int) language sql stable security definer set search_path = public as $$
  select r.time, s.duration_min from public.reservations r
  join public.services s on s.id = r.service_id
  where r.barber_id = p_barber and r.date = p_date and r.status <> 'cancelada';
$$;
grant execute on function public.get_busy_slots(uuid, date) to anon, authenticated;

-- ---------- Row Level Security ----------
alter table public.admins       enable row level security;
alter table public.barbers      enable row level security;
alter table public.services     enable row level security;
alter table public.reservations enable row level security;
alter table public.transactions enable row level security;
alter table public.settings     enable row level security;

-- admins: cada usuario ve solo si él es admin
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = auth.uid());

-- barberos / servicios: público ve activos, admin todo
drop policy if exists barbers_public_read on public.barbers;
create policy barbers_public_read on public.barbers for select using (active or public.is_admin());
drop policy if exists barbers_admin_all on public.barbers;
create policy barbers_admin_all on public.barbers for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select using (active or public.is_admin());
drop policy if exists services_admin_all on public.services;
create policy services_admin_all on public.services for all using (public.is_admin()) with check (public.is_admin());

-- reservas: público solo inserta; admin todo
drop policy if exists reservations_public_insert on public.reservations;
create policy reservations_public_insert on public.reservations for insert to anon, authenticated with check (true);
drop policy if exists reservations_admin_all on public.reservations;
create policy reservations_admin_all on public.reservations for all using (public.is_admin()) with check (public.is_admin());

-- finanzas y ajustes: solo admin
drop policy if exists transactions_admin_all on public.transactions;
create policy transactions_admin_all on public.transactions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists settings_admin_all on public.settings;
create policy settings_admin_all on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
--  DESPUÉS DE EJECUTAR:
--  1) Authentication → Users → "Add user" → crea el usuario del dueño (email + contraseña)
--  2) Authentication → Sign In / Providers → desactiva "Allow new users to sign up"
--  3) Ejecuta (cambiando el email):
--     insert into public.admins (user_id)
--     select id from auth.users where email = 'dueno@barberia.com';
-- =====================================================================

-- ---------- Datos iniciales opcionales ----------
-- insert into public.barbers (name, role, commission_pct) values
--   ('Carlos "El Maestro" Ruiz','Master Barber',50),('Sebastián Gómez','Fade Specialist',45);
-- insert into public.services (name, description, price, duration_min) values
--   ('Corte clásico','Tijera y máquina, lavado y peinado',35000,30),
--   ('Corte + Barba','Corte completo y perfilado de barba con toalla caliente',55000,60);
