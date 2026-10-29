create table conversation_starts (
 user_id uuid not null references app_users(id) on delete cascade,
 idempotency_key uuid not null,
 fingerprint text not null,
 lead_id uuid not null references leads(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,idempotency_key)
);
alter table team_members add column public_name text default (array['Александр','Алексей','Максим','Артём','Михаил','Анна','Мария','Елена','София','Виктория'])[1+floor(random()*10)::int];
