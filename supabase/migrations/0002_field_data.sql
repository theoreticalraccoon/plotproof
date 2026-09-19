-- PlotProof: server persistence for field data (farmers, plots, attestations, media metadata) so
-- a cleared browser cache no longer loses a farm.

-- --- farmers ---------------------------------------------------------------
create table if not exists public.farmers (
  id             uuid primary key,
  owner          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cooperative_id text,
  country_code   text not null,
  full_name      text not null,
  national_id    text,
  membership_no  text,
  village        text,
  phone          text,
  captured_via   text not null check (captured_via in ('roster_import','id_scan','manual')),
  created_at     timestamptz not null,
  synced_at      timestamptz not null default now()
);

-- --- plots -----------------------------------------------------------------
create table if not exists public.plots (
  id                    uuid primary key,
  owner                 uuid not null default auth.uid() references auth.users (id) on delete cascade,
  farmer_id             uuid not null references public.farmers (id),
  cooperative_id        text,
  country_code          text not null,
  commodity             text,
  -- Closed WGS84 ring [[lng,lat],...], first == last, exactly as captured.
  ring                  jsonb not null,
  capture_method        text not null check (capture_method in ('imported','traced','corners','walked')),
  claimed_area_ha       numeric(12,4),
  computed_area_ha      numeric(12,4) not null,
  acknowledged_warnings jsonb not null default '[]'::jsonb,
  status                text not null check (status in ('captured','attested')),
  captured_at           timestamptz not null,
  synced_at             timestamptz not null default now()
);
create index if not exists plots_owner_idx on public.plots (owner);
create index if not exists plots_farmer_idx on public.plots (farmer_id);

-- --- attestations ----------------------------------------------------------
create table if not exists public.attestations (
  id                   uuid primary key,
  owner                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plot_id              uuid not null references public.plots (id),
  officer_id           text not null,
  officer_name         text not null,
  captured_at          timestamptz not null,
  location             jsonb,
  farmer_name_snapshot text not null,
  farmer_id_snapshot   text,
  confirmation_method  text not null check (confirmation_method in ('signature','thumbprint')),
  photo_media_id       uuid not null,
  signature_media_id   uuid,
  -- Explicit informed consent moment; an attestation without one is not lawful to hold (GDPR Art.
  -- 9 / Sri Lanka PDPA), so the column is NOT NULL.
  consent_at           timestamptz not null,
  -- Tamper-evidence seal from lib/intake/integrity.ts (hashes + device chain).
  integrity            jsonb,
  created_at           timestamptz not null,
  synced_at            timestamptz not null default now()
);
create index if not exists attestations_plot_idx on public.attestations (plot_id);

-- --- media metadata (blobs live in Storage) --------------------------------
create table if not exists public.media (
  id           uuid primary key,
  owner        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plot_id      uuid not null,
  kind         text not null check (kind in ('photo','signature')),
  mime_type    text not null,
  bytes        integer not null,
  width        integer,
  height       integer,
  sha256       text,
  storage_path text not null,
  created_at   timestamptz not null,
  synced_at    timestamptz not null default now()
);
create index if not exists media_plot_idx on public.media (plot_id);

-- --- RLS: own rows only ----------------------------------------------------
do $$
declare tbl text;
begin
  foreach tbl in array array['farmers','plots','attestations','media'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists "%s_select_own" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_select_own" on public.%I for select using (auth.uid() = owner)', tbl, tbl);
    execute format('drop policy if exists "%s_insert_own" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = owner)', tbl, tbl);
    execute format('drop policy if exists "%s_update_own" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_update_own" on public.%I for update using (auth.uid() = owner) with check (auth.uid() = owner)', tbl, tbl);
  end loop;
end $$;

-- --- Storage bucket for photos/signatures ---------------------------------- Private bucket.
insert into storage.buckets (id, name, public)
values ('field-media', 'field-media', false)
on conflict (id) do nothing;

drop policy if exists "field_media_select_own" on storage.objects;
create policy "field_media_select_own" on storage.objects for select
  using (bucket_id = 'field-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "field_media_insert_own" on storage.objects;
create policy "field_media_insert_own" on storage.objects for insert
  with check (bucket_id = 'field-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "field_media_update_own" on storage.objects;
create policy "field_media_update_own" on storage.objects for update
  using (bucket_id = 'field-media' and (storage.foldername(name))[1] = auth.uid()::text);
