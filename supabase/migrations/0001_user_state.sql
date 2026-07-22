-- PlotProof: per-user saved state (the sale intent + document progress the app
-- otherwise keeps only in the browser). One row per user, protected by RLS so a
-- user can only ever read or write their own row.
--
-- Apply this via the Supabase dashboard SQL editor (no CLI or DB password
-- needed): Dashboard > SQL Editor > New query > paste > Run.
-- Or with the CLI once linked: supabase db push

create table if not exists public.user_state (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  sale_intent jsonb,
  doc_status  jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own"
  on public.user_state for select
  using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own"
  on public.user_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
