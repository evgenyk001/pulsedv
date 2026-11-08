alter table phone_login_challenges add column channel text not null default 'sms' check(channel in ('sms','call'));
alter table phone_login_challenges add column delivery_state text not null default 'ready' check(delivery_state in ('pending','ready','failed'));
alter table sessions drop constraint sessions_auth_provider_check;
alter table sessions add constraint sessions_auth_provider_check check(auth_provider in ('legacy','sms','call','telegram','passkey'));
