-- PlotProof 0004: multiple sales per account, and the chat assistant's usage ledger.

-- Sales ------------------------------------------------------------------ The officer's sales,
-- as one JSON document per account: { currentId, sales[] }.
alter table public.user_state
  add column if not exists sales jsonb;


-- Chat usage ledger ------------------------------------------------------- One row per assistant
-- request, used to rate-limit per account.
create table if not exists public.chat_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists chat_usage_user_time
  on public.chat_usage (user_id, created_at desc);

alter table public.chat_usage enable row level security;

-- A user may see and add only their own rows.
drop policy if exists "chat_usage_select_own" on public.chat_usage;
create policy "chat_usage_select_own"
  on public.chat_usage for select
  using (auth.uid() = user_id);

drop policy if exists "chat_usage_insert_own" on public.chat_usage;
create policy "chat_usage_insert_own"
  on public.chat_usage for insert
  with check (auth.uid() = user_id and created_at >= now() - interval '1 minute');
