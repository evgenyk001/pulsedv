alter table partner_rewards add column payout_details jsonb;
alter table partner_rewards add column payout_stage text check(payout_stage in ('details_needed','details_received','agreed'));
alter table partner_rewards add column payout_agreed_by uuid references team_members(id) on delete set null;
alter table partner_rewards add column payout_agreed_at timestamptz;
