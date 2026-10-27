// Identity is resolved at read time, so existing journeys show newly shared contacts.
// Only the already scoped Control profile endpoints may use this projection.
export const controlProfileSelect=`select p.*,coalesce(p.user_id,s.user_id) as user_id,
 case when u.id is null then null else jsonb_build_object(
  'firstName',u.first_name,'lastName',u.last_name,'phone',u.phone,
  'telegramId',u.telegram_user_id::text,'username',u.telegram_username
 ) end as client
 from visitor_profiles p
 left join sessions s on s.id=p.session_id
 left join app_users u on u.id=coalesce(p.user_id,s.user_id)`;
