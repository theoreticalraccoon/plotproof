-- Public per-lot verification: the page a farmer or cooperative sends an
-- exporter. Exposes a DE-IDENTIFIED read-only view of an attested plot,
-- reachable only by knowing the plot's UUID (unguessable, client-generated).
--
-- Deliberately excluded: farmer name/ID, phone, village, media, officer id.
-- Included: what a due-diligence reviewer needs — geometry, area, commodity,
-- attestation facts (that consent + confirmation exist, not their content),
-- and the tamper-evidence seal.
--
-- Apply after 0002 via Supabase Dashboard > SQL Editor, or `supabase db push`.

create or replace view public.lot_verification
with (security_invoker = off) as
select
  p.id,
  p.country_code,
  p.commodity,
  p.ring,
  p.computed_area_ha,
  p.capture_method,
  p.status,
  p.captured_at,
  a.captured_at            as attested_at,
  a.officer_name,
  a.confirmation_method,
  (a.consent_at is not null) as consent_recorded,
  a.integrity ->> 'contentHash' as integrity_hash,
  a.integrity ->> 'algo'        as integrity_algo,
  (a.integrity ->> 'chainSeq')::int as integrity_chain_seq
from public.plots p
join public.attestations a on a.plot_id = p.id
where p.status = 'attested';

grant select on public.lot_verification to anon, authenticated;
