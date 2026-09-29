alter table team_members add column if not exists mfa_enabled boolean not null default false;

create table if not exists control_login_challenges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references team_members(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists control_login_challenges_member_idx
  on control_login_challenges(member_id,created_at desc);

create index if not exists control_login_challenges_expiry_idx
  on control_login_challenges(expires_at)
  where consumed_at is null;
