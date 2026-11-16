#!/usr/bin/env bash
set -euo pipefail
cd /opt/pulsedv

db() { docker compose exec -T db psql -X -U pulse -d pulse -v ON_ERROR_STOP=1 "$@"; }

if [[ "${1:-}" != --status ]]; then
  version=${1:?Укажите публичную версию или --status}
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
  build=$(curl -fsS --retry 2 --max-time 15 --resolve pulsedv.ru:443:127.0.0.1 \
    https://pulsedv.ru/app/app-release.json | python3 -c '
import json, re, sys
release = json.load(sys.stdin)
if release.get("version") != sys.argv[1] or not re.fullmatch(r"[0-9a-f]{16}", release.get("build", "")):
    sys.exit("Указанная версия не совпадает с текущим публичным релизом.")
print(release["build"])
' "$version")
  db -v version="$version" -v build="$build" <<'SQL'
select pulse_queue_public_push('release', 'app:' || :'version',
 jsonb_build_object('appScope','app','version',:'version','build',:'build')) as queued;
SQL
fi

db <<'SQL'
select app_scope, count(*) as enabled_devices
from push_subscriptions where enabled group by app_scope order by app_scope;

select o.topic, coalesce(o.payload->>'version', o.payload->>'change') as event,
       o.created_at, count(d.id) filter (where d.delivered_at is not null) as accepted_by_push_service,
       count(d.id) filter (where d.dead_at is not null) as failed,
       count(d.id) filter (where d.delivered_at is null and d.dead_at is null) as pending,
       max(round(extract(epoch from d.delivered_at - o.available_at))) as max_seconds
from outbox_events o left join push_deliveries d on d.event_id=o.id
where o.topic in ('pwa.release','pwa.catalog','user.journey','pwa.guest_reply')
group by o.id order by o.created_at desc limit 20;
SQL
