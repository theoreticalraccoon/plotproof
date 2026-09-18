-- PlotProof 0004: multiple sales per account, and the chat assistant's usage ledger.
--
-- Apply via the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once.

-- 1. Sales ------------------------------------------------------------------
-- The officer's sales, as one JSON document per account: { currentId, sales[] }.
-- Stored beside the legacy sale_intent / doc_status columns, which the app no
-- longer writes. The existing row-level-security policies on user_state already
-- restrict every row to its owner, so nothing new is needed for access control.
alter table public.user_state
  add column if not exists sales jsonb;


-- 2. Chat usage ledger -------------------------------------------------------
-- One row per assistant request, used to rate-limit per account. It records only
-- that a request happened and when — never the question or the answer.
--
-- The row is inserted BEFORE the model is called, so an answer abandoned
-- half-way still counts. That is also why there are no token columns: filling
-- them in afterwards would need an UPDATE policy, and any update policy would let
-- a client rewrite created_at and so escape its own rate limit.
create table if not exists public.chat_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists chat_usage_user_time
  on public.chat_usage (user_id, created_at desc);

alter table public.chat_usage enable row level security;

-- A user may see and add only their own rows. There is deliberately no update or
-- delete policy: a client that could change or remove its own ledger rows could
-- reset its own rate limit. created_at is set by the database default; the
-- insert policy below does not let the client choose it.
drop policy if exists "chat_usage_select_own" on public.chat_usage;
create policy "chat_usage_select_own"
  on public.chat_usage for select
  using (auth.uid() = user_id);

drop policy if exists "chat_usage_insert_own" on public.chat_usage;
create policy "chat_usage_insert_own"
  on public.chat_usage for insert
  with check (auth.uid() = user_id and created_at >= now() - interval '1 minute');
