create index if not exists leads_score_created_idx
  on leads(score desc,created_at desc);

create index if not exists leads_created_idx
  on leads(created_at desc);

create index if not exists leads_manager_created_idx
  on leads(manager_id,created_at desc)
  where manager_id is not null;

create index if not exists leads_manager_score_created_idx
  on leads(manager_id,score desc,created_at desc)
  where manager_id is not null;

create index if not exists leads_manager_session_idx
  on leads(manager_id,session_id)
  where manager_id is not null and session_id is not null;

create index if not exists leads_user_idx
  on leads(user_id,created_at desc)
  where user_id is not null;

create index if not exists user_events_occurred_idx
  on user_events(occurred_at desc);

create index if not exists crm_tasks_due_idx
  on crm_tasks(due_at);

create index if not exists crm_tasks_assigned_due_idx
  on crm_tasks(assigned_to,due_at)
  where assigned_to is not null;
