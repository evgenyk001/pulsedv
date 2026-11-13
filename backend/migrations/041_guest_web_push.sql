alter table push_subscriptions alter column user_id drop not null;
alter table push_subscriptions add column session_id uuid references sessions(id) on delete cascade;
alter table push_subscriptions add constraint push_subscription_owner check (num_nonnulls(user_id,session_id)=1);
create index push_subscriptions_session on push_subscriptions(session_id);
