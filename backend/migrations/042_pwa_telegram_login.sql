alter table sessions drop constraint sessions_auth_provider_check;
alter table sessions add constraint sessions_auth_provider_check check(auth_provider in ('legacy','sms','call','telegram','telegram-web','passkey'));
create table pwa_telegram_login (
 session_id uuid primary key references sessions(id) on delete cascade,
 state_hash text not null,
 verifier text not null,
 redirect_uri text not null,
 expires_at timestamptz not null
);
