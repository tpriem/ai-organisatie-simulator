-- Versiehistorie van analyseresultaten.
--
-- Waarom: writeResults overschreef de resultaten van een klant zonder terugweg. Eén
-- verkeerde druk op "Analyseer" — door onszelf vanuit een ontwikkelomgeving, of door een
-- gebruiker in productie — en een goed rapport was definitief weg.
--
-- Eenmalig te draaien in de SQL-editor van Supabase. De applicatie werkt ook zonder deze
-- tabel; archiveren is dan simpelweg een no-op, zodat er geen moment is waarop de tool
-- stukgaat tussen deploy en migratie.

create table if not exists public.client_results_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  results jsonb not null,
  reden text,
  created_at timestamptz not null default now()
);

-- De enige query die we doen: versies van één klant, nieuwste eerst.
create index if not exists client_results_history_client_idx
  on public.client_results_history (client_id, created_at desc);

-- De applicatie benadert Supabase met de service role key en omzeilt daarmee RLS. We
-- zetten RLS toch aan zodat de tabel niet per ongeluk publiek leesbaar is via de anon key.
alter table public.client_results_history enable row level security;
