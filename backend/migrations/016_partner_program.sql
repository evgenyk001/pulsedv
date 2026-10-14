alter table leads add column submission_fingerprint text;
-- Buyer identity locks serialize submissions; actual insert time preserves arrival order.
alter table leads alter column created_at set default clock_timestamp();
alter table leads add column if not exists normalized_phone text generated always as (
 case when regexp_replace(phone,'[^0-9+]','','g') ~ '^[78][0-9]{10}$'
 then '+7'||substring(regexp_replace(phone,'[^0-9+]','','g') from 2)
 when regexp_replace(phone,'[^0-9+]','','g') ~ '^\+[1-9][0-9]{9,14}$'
 then regexp_replace(phone,'[^0-9+]','','g') else null end
) stored;
create index if not exists leads_normalized_phone_idx on leads(normalized_phone,created_at) where normalized_phone is not null;
create index if not exists leads_partner_identity_idx on leads(user_id,created_at) where user_id is not null;

create table partner_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique references app_users(id) on delete set null,
 name text not null,
 phone text not null,
 code text not null unique,
 status text not null default 'active' check(status in ('active','paused')),
 terms_version text not null,
 terms_accepted_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table partner_invitations (
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references partner_profiles(id),
 code text not null unique,
 label text not null,
 created_at timestamptz not null default now()
);
create index partner_invitations_partner_idx on partner_invitations(partner_id,created_at desc);
create table partner_referrals (
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references partner_profiles(id),
 invitation_id uuid references partner_invitations(id),
 lead_id uuid unique references leads(id) on delete set null,
 buyer_user_id uuid references app_users(id) on delete set null,
 normalized_phone text,
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 rejection_reason text,
 review_note text,
 reviewed_by uuid references team_members(id) on delete set null,
 accepted_at timestamptz,
 reward_bps integer not null default 3000 check(reward_bps between 0 and 10000),
 reserve_bps integer not null default 600 check(reserve_bps between 0 and 10000),
 terms_version text not null,
 attribution_code text not null,
 revision integer not null default 1,
 created_at timestamptz not null default clock_timestamp()
);
create index partner_referrals_partner_idx on partner_referrals(partner_id,created_at desc);
create index partner_referrals_phone_idx on partner_referrals(normalized_phone,created_at);
create index partner_referrals_buyer_idx on partner_referrals(buyer_user_id) where buyer_user_id is not null;
create table partner_client_claims (
 referral_id uuid primary key references partner_referrals(id),
 normalized_phone text unique,
 buyer_user_id uuid unique references app_users(id) on delete set null,
 created_at timestamptz not null default now()
);
create table partner_rewards (
 id uuid primary key default gen_random_uuid(),
 referral_id uuid not null references partner_referrals(id),
 commission_rub bigint not null check(commission_rub>0),
 received_on date not null,
 reserve_minor bigint not null check(reserve_minor>=0),
 base_minor bigint not null check(base_minor>=0),
 gross_minor bigint not null check(gross_minor>=0),
 status text not null default 'accrued' check(status in ('accrued','requested','paid','void')),
 approved_by uuid references team_members(id) on delete set null,
 recipient_type text,
 requested_at timestamptz,
 withheld_minor bigint not null default 0 check(withheld_minor>=0),
 paid_minor bigint not null default 0 check(paid_minor>=0),
 paid_on date,
 payout_reference text,
 document_reference text,
 paid_by uuid references team_members(id) on delete set null,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 check(withheld_minor<=gross_minor),
 check(status<>'paid' or (paid_on is not null and payout_reference is not null and document_reference is not null and paid_minor=gross_minor-withheld_minor))
);
create index partner_rewards_paid_idx on partner_rewards(paid_on) where status='paid';
create unique index partner_rewards_one_active_idx on partner_rewards(referral_id) where status<>'void';
create table partner_referral_events (
 id uuid primary key default gen_random_uuid(),
 sequence bigserial not null,
 referral_id uuid not null references partner_referrals(id),
 kind text not null,
 label text not null,
 created_at timestamptz not null default now()
);
create index partner_referral_events_idx on partner_referral_events(referral_id,sequence);
