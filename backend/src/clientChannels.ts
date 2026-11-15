import type {Sql} from './database';

// Recent builds label events at capture time. Older events can use the session's verified provider.
const channelSql=`case
 when e.metadata->>'clientChannel'='pwa' then 'pwa'
 when s.auth_provider='telegram' then 'miniApp'
 when s.auth_provider in ('telegram-web','passkey','call','sms') then 'pwa'
 else 'unknown'
 end`;

export async function summarizeClientChannels(db:Sql,managerId?:string){
 const rows=(await db.query(`select ${channelSql} as channel,
  count(distinct case when coalesce(s.user_id,e.user_id) is null then 'session:'||s.id
   else 'user:'||coalesce(s.user_id,e.user_id) end)::int as visitors
  from user_events e join sessions s on s.id=e.session_id
  where e.event_type='page_view' and e.occurred_at>=now()-interval '30 days' and e.occurred_at<=now()
  ${managerId?'and exists(select 1 from leads l where l.session_id=s.id and l.manager_id=$1)':''}
  group by 1`,managerId?[managerId]:[])).rows;
 const result={pwa:0,miniApp:0,unknown:0};
 for(const row of rows)result[row.channel as keyof typeof result]=Number(row.visitors);
 return result;
}

export async function lastClientActivity(db:Sql,sessionId:string|null,userId:string|null){
 if(!sessionId&&!userId)return null;
 const row=(await db.query(`with identity as (
   select coalesce($2::uuid,(select user_id from sessions where id=$1)) as user_id
  )
  select ${channelSql} as channel,e.occurred_at as at
  from user_events e join sessions s on s.id=e.session_id cross join identity i
  where (e.session_id=$1 or coalesce(s.user_id,e.user_id)=i.user_id)
   and e.event_type<>'attribution' and e.occurred_at<=now()
   and e.occurred_at>=now()-interval '30 days'
  order by e.occurred_at desc,e.id desc limit 1`,[sessionId,userId])).rows[0];
 return row?{channel:row.channel,at:row.at}:null;
}
