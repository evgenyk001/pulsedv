// Scope sessions before grouping so a manager's existing visibility is preserved.
const profileRows=(scoped:boolean)=>`from visitor_profiles p join sessions s on s.id=p.session_id
 ${scoped?'where exists(select 1 from leads l where l.session_id=p.session_id and l.manager_id=$1)':''}`;
const account='coalesce(s.user_id,p.user_id)';
const identity=`case when ${account} is null then 'session:'||p.session_id else 'user:'||${account} end`;

export const controlProfileCount=(scoped:boolean)=>`select count(distinct ${identity})::int as total ${profileRows(scoped)}`;

export function controlProfileSelect(scoped:boolean){
 return `with scoped_profiles as (
  select p.*, ${account} as account_id, ${identity} as identity ${profileRows(scoped)}
 ), profile_groups as (
  select identity,array_agg(session_id order by session_id) as session_ids,
   sum(event_count)::int as event_count,min(first_seen_at) as first_seen_at,
   max(last_seen_at) as last_seen_at,max(updated_at) as updated_at
  from scoped_profiles group by identity
 ), representative as (
  select distinct on(identity) * from scoped_profiles
  order by identity,score desc,last_seen_at desc,session_id
 )
 select coalesce(p.account_id,p.id) as id,p.session_id,g.session_ids,p.account_id as user_id,
  p.score,p.priority,p.score_reasons,p.top_property_id,p.city,p.mortgage_program,p.next_action,
  g.event_count,g.first_seen_at,g.last_seen_at,g.updated_at,
  case when u.id is null then null else jsonb_build_object(
   'firstName',u.first_name,'lastName',u.last_name,'phone',u.phone,
   'telegramId',u.telegram_user_id::text,'username',u.telegram_username
  ) end as client
 from representative p join profile_groups g on g.identity=p.identity
 left join app_users u on u.id=p.account_id`;
}
