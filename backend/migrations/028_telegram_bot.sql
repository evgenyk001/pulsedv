create table telegram_bot_cursor (
 singleton boolean primary key default true check(singleton),
 next_update_id bigint not null default 0
);
insert into telegram_bot_cursor(singleton) values(true);

create table telegram_contact_consent (
 user_id uuid primary key references app_users(id) on delete cascade,
 requested_at timestamptz not null default now(),
 consent_version text not null,
 accepted_at timestamptz
);
