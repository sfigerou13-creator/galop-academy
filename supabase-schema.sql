-- ============================================================
--  Galop Academy — Schéma Supabase (à coller dans SQL Editor)
--  Remplace Firestore. Auth = Supabase Auth (email/mot de passe).
-- ============================================================

-- 1) PROFIL (nom d'affichage lié au compte)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  created_at timestamptz default now()
);

-- 2) PROGRESSION (une ligne par utilisateur, étoiles par galop en JSON)
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 3) CLUBS
create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete set null,
  name        text not null,
  city        text,
  address     text,
  phone       text,
  email       text,
  description text,
  disciplines text[] default '{}',
  created_at  timestamptz default now()
);

-- 4) CRÉNEAUX
create table if not exists public.slots (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid references public.clubs(id) on delete cascade,
  date         date not null,
  start_time   text,
  duration     int  default 60,
  type         text,
  level        text,
  price        numeric,
  max_capacity int default 10,
  booked_count int default 0,
  created_at   timestamptz default now()
);

-- 5) RÉSERVATIONS (un cavalier ne réserve qu'une fois par créneau)
create table if not exists public.bookings (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid references public.slots(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  user_name  text,
  user_email text,
  status     text default 'confirmed',
  booked_at  timestamptz default now(),
  unique (slot_id, user_id)
);

-- 6) LEADS ANNONCEURS (formulaire "devenir partenaire")
create table if not exists public.partner_leads (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  company    text,
  email      text,
  message    text,
  budget     text,
  created_at timestamptz default now()
);

-- ============================================================
--  RÉSERVATION ATOMIQUE (remplace la transaction Firestore)
-- ============================================================
create or replace function public.book_slot(p_slot_id uuid, p_user_name text, p_user_email text)
returns text
language plpgsql
security definer
as $$
declare v_cap int; v_booked int;
begin
  select max_capacity, booked_count into v_cap, v_booked
    from public.slots where id = p_slot_id for update;
  if v_cap is null then return 'introuvable'; end if;
  if v_booked >= v_cap then return 'complet'; end if;
  if exists (select 1 from public.bookings where slot_id = p_slot_id and user_id = auth.uid())
    then return 'deja'; end if;
  insert into public.bookings (slot_id, user_id, user_name, user_email)
    values (p_slot_id, auth.uid(), p_user_name, p_user_email);
  update public.slots set booked_count = booked_count + 1 where id = p_slot_id;
  return 'ok';
end $$;

-- ============================================================
--  SÉCURITÉ (Row Level Security)
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.progress      enable row level security;
alter table public.clubs         enable row level security;
alter table public.slots         enable row level security;
alter table public.bookings      enable row level security;
alter table public.partner_leads enable row level security;

-- Profil : chacun gère le sien
create policy "profil_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Progression : chacun gère la sienne
create policy "progress_self" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Clubs : lecture publique, écriture par le propriétaire
create policy "clubs_read"  on public.clubs for select using (true);
create policy "clubs_write" on public.clubs for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Créneaux : lecture publique, écriture par le propriétaire du club
create policy "slots_read"  on public.slots for select using (true);
create policy "slots_write" on public.slots for all
  using (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));

-- Réservations : le cavalier voit/insère les siennes
create policy "bookings_self" on public.bookings for select using (auth.uid() = user_id);
create policy "bookings_insert" on public.bookings for insert with check (auth.uid() = user_id);

-- Leads annonceurs : tout le monde peut envoyer, personne ne lit côté public
create policy "leads_insert" on public.partner_leads for insert with check (true);
