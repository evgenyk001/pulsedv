alter table announcement_subscriptions alter column enabled set default true;
-- Missing rows mean no saved preference. An explicit opt-out remains off.
insert into announcement_subscriptions(user_id,enabled)
 select id,true from app_users where telegram_user_id is not null
 on conflict(user_id) do nothing;
