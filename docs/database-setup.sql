-- Volledige database-opzet voor een nieuwe omgeving (nieuw Supabase-project).
--
-- Gebruik: plak dit hele script in de SQL-editor van het nieuwe Supabase-project en voer het uit.
-- Het script is herhaalbaar: het kan twee keer draaien zonder iets stuk te maken.
--
-- Wat de applicatie van Supabase verwacht (afgeleid uit web/lib/clientStore.js en web/lib/userStore.js):
--   * tabel clients                 de klanten en hun analyseresultaten
--   * tabel agency_users            de adviseurs die kunnen inloggen
--   * tabel password_resets         eenmalige links om een wachtwoord in te stellen
--   * tabel client_results_history  eerdere versies van de resultaten (zie ook docs/versiehistorie.sql)
--   * opslag-bucket client-files    geüploade bestanden en JSON (links, metingen, antwoorden van invullers)
--
-- De applicatie gebruikt de service role key en omzeilt daarmee RLS. RLS staat toch overal aan, zonder
-- policies, zodat niets per ongeluk publiek leesbaar is via de anon key.

-- ---------------------------------------------------------------------------------------------
-- Klanten
-- ---------------------------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  naam        text not null,
  -- Oude vragenlijst-velden. De code leest en schrijft ze nog (sector, impact, readiness), dus laten staan.
  sector      text,
  impact      jsonb,
  readiness   jsonb,
  scope       text not null default 'bedrijf',
  scope_label text,
  -- Het volledige analyseresultaat van de klant.
  results     jsonb,
  created_at  timestamptz not null default now()
);

alter table public.clients enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Adviseurs en wachtwoord-links
-- ---------------------------------------------------------------------------------------------
create table if not exists public.agency_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,   -- de code zoekt op kleine letters
  name          text,
  password_hash text,                   -- bcrypt; leeg zolang de adviseur nog geen wachtwoord heeft ingesteld
  created_at    timestamptz not null default now()
);

alter table public.agency_users enable row level security;

create table if not exists public.password_resets (
  token      text primary key,
  user_id    uuid not null references public.agency_users (id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.password_resets enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Versiehistorie van analyseresultaten
-- ---------------------------------------------------------------------------------------------
create table if not exists public.client_results_history (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  results    jsonb not null,
  reden      text,
  created_at timestamptz not null default now()
);

create index if not exists client_results_history_client_idx
  on public.client_results_history (client_id, created_at desc);

alter table public.client_results_history enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Opslag-bucket voor bestanden
-- ---------------------------------------------------------------------------------------------
-- Privé: bestanden worden alleen via de server (service role) en kortlevende ondertekende links gelezen.
insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- De eerste adviseur
-- ---------------------------------------------------------------------------------------------
-- In een lege omgeving kan niemand inloggen, en nieuwe adviseurs aanmaken kan alleen vanuit de tool zelf.
-- Dit blok maakt de eerste adviseur aan, zonder wachtwoord, plus een link om het wachtwoord in te stellen.
--
-- Vul hieronder je eigen e-mailadres en naam in en voer dan alleen dit blok uit. Het resultaat is een
-- token: open <jouw-site>/reset-password?token=<token> en kies een wachtwoord. De link is 24 uur geldig.
--
-- Haal de streepjes voor '--' weg om het uit te voeren.

-- with nieuw as (
--   insert into public.agency_users (email, name)
--   values (lower('jij@voorbeeld.nl'), 'Jouw naam')
--   on conflict (email) do update set name = excluded.name
--   returning id
-- ), tok as (
--   select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as token
-- ), ins as (
--   insert into public.password_resets (token, user_id, expires_at)
--   select tok.token, nieuw.id, now() + interval '24 hours' from nieuw, tok
--   returning token
-- )
-- select token from ins;
