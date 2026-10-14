-- Legacy referrals retain their accepted conditions: new time limits are not backfilled.
create table partner_terms_acceptances (
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references partner_profiles(id),
 terms_version text not null,
 document_text text not null,
 document_sha256 text not null,
 operator_snapshot jsonb not null,
 publication_state text not null check(publication_state in ('draft','published')),
 accepted_at timestamptz not null default now()
);
create index partner_terms_acceptances_idx on partner_terms_acceptances(partner_id,accepted_at desc);
alter table partner_referrals add column claim_started_on date;
alter table partner_referrals add column claim_expires_on date;
alter table partner_referrals add column deal_confirmed_on date;
alter table partner_referrals add constraint partner_claim_dates check ((claim_started_on is null and claim_expires_on is null) or (claim_started_on is not null and claim_expires_on is not null and claim_expires_on>=claim_started_on));
alter table partner_rewards add column deal_on date;
