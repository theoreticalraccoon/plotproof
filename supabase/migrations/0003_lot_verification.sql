-- Public per-lot verification: the page a farmer or cooperative sends an exporter.

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
