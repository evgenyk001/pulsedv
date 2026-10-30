#!/usr/bin/env bash
# Reviewed Control/API release, no database migrations or data rewrites.
set -euo pipefail
umask 077
cd /opt/pulsedv
target=${1:?Pass the reviewed 40-character release SHA}
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || exit 2
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Другое обновление уже выполняется.'; exit 1; }
git diff --cached --quiet || { echo 'Есть подготовленные изменения Git; обновление не начато.'; exit 1; }
git diff --quiet HEAD -- . ':(exclude)deploy/Caddyfile' ':(exclude)compose.yaml' || {
 echo 'Есть локальные изменения исходников; обновление не начато.'; exit 1;
}
backup=$(mktemp -d /root/pulsedv-control-polish-backup.XXXXXX)
cp -p .env deploy/Caddyfile compose.yaml "$backup/"
git rev-parse HEAD > "$backup/previous-commit.txt"
git diff --binary > "$backup/local-changes.patch"
declare -A image_names old_tags expected_images
tag="before-control-polish-$(date -u +%Y%m%d%H%M%S)-$$"
for service in api worker web; do
 container=$(docker compose ps -q "$service")
 test -n "$container"
 image_names[$service]=$(docker inspect --format '{{.Config.Image}}' "$container")
 old_tags[$service]="pulsedv-$service:$tag"
 docker image tag "$(docker inspect --format '{{.Image}}' "$container")" "${old_tags[$service]}"
 printf '%s\t%s\t%s\n' "$service" "${image_names[$service]}" "${old_tags[$service]}" >> "$backup/images.tsv"
done
activated=0
paused=0
sources_changed=0
recover(){
 status=$?
 trap - EXIT
 if [ "$status" -ne 0 ]; then
  echo "Обновление остановлено. Резервные материалы: $backup"
  if [ "$sources_changed" -eq 1 ]; then
   cp -p "$backup/Caddyfile" deploy/Caddyfile
   for service in api worker web; do docker image tag "${old_tags[$service]}" "${image_names[$service]}" || true; done
  fi
  if [ "$activated" -eq 1 ]; then
   if docker compose up -d --no-deps --no-build --wait --wait-timeout 180 api worker web; then
    echo 'Прежние образы возвращены. Исходники остаются на новом коммите; база не менялась.'
   else echo 'Автоматический возврат не завершён; сохраните этот вывод.'; fi
  elif [ "$paused" -eq 1 ]; then docker compose start api worker || true
  fi
 fi
 exit "$status"
}
trap recover EXIT
umask 022
git fetch origin "$target"
umask 077
git merge-base --is-ancestor HEAD "$target" || { echo 'Текущий коммит не предок обновления; исходники не изменены.'; exit 1; }
git diff --quiet HEAD "$target" -- backend/migrations || { echo 'Найдены дополнительные миграции. Этот установщик рассчитан на уже установленное обновление чата; ничего не изменено.'; exit 1; }
git diff --quiet HEAD "$target" -- compose.yaml || { echo 'Состав сервисов отличается; нужен отдельный разбор обновления. Ничего не изменено.'; exit 1; }
git show "$target:deploy/Caddyfile" > "$backup/new.Caddyfile"
git show HEAD:deploy/Caddyfile > "$backup/tracked.Caddyfile"
python3 - "$backup" <<'PY'
from pathlib import Path
import shlex,sys
folder=Path(sys.argv[1])
def tokens(name):
    return shlex.split('\n'.join(line for line in (folder/name).read_text().splitlines() if line.strip()!='debug'),comments=True)
if tokens('Caddyfile') not in (tokens('new.Caddyfile'),tokens('tracked.Caddyfile')):
    raise SystemExit('Локальный Caddyfile отличается от проверенного. Исходники не изменены; отправьте конфигурацию для сверки.')
PY
sources_changed=1
git restore --source=HEAD -- deploy/Caddyfile
umask 022
git merge --ff-only "$target"
umask 077
test "$(git rev-parse HEAD)" = "$target"
docker compose config --quiet
docker compose build api worker web
for service in api worker web; do expected_images[$service]=$(docker image inspect --format '{{.Id}}' "${image_names[$service]}"); done
docker compose run --rm -T --no-deps api node --import tsx backend/src/preflight.ts
docker compose run --rm -T --no-deps --entrypoint caddy web validate --config /etc/caddy/Caddyfile --adapter caddyfile
paused=1
docker compose stop worker api
docker compose exec -T db pg_dump -U pulse -d pulse -Fc > "$backup/database.dump"
docker compose run --rm -T --no-deps --entrypoint tar api -czf - -C /data/media . > "$backup/media.tar.gz"
test -s "$backup/database.dump"
docker compose exec -T db pg_restore -l < "$backup/database.dump" > /dev/null
gzip -t "$backup/media.tar.gz"
echo "Копия базы и медиа проверена: $backup"
activated=1
docker compose up -d --no-deps --no-build --wait --wait-timeout 180 api worker web
paused=0
for service in api worker web; do
 container=$(docker compose ps -q "$service")
 test "$(docker inspect --format '{{.Image}}' "$container")" = "${expected_images[$service]}"
done
docker compose exec -T api node --import tsx --input-type=module -e '
import {postgresDatabase} from "./backend/src/database.ts";
import {adminCatalogSummary} from "./backend/src/catalogRepository.ts";
const db=postgresDatabase(process.env.DATABASE_URL);
try{const data=await adminCatalogSummary(db);if(!Array.isArray(data.cities)||typeof data.counts.all!=="number")throw new Error("Invalid catalog summary");console.log("Метаданные городов: готовы")}finally{await db.close()}
'
docker compose exec -T web cat /srv/control-center/index.html > "$backup/expected-control.html"
check_https(){
 curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 2 \
  --connect-timeout 5 --max-time 15 --resolve "$1:443:127.0.0.1" "https://$1$2" "${@:3}"
}
check_https pulsedv.ru /ready -o "$backup/ready.json"
check_https pulsedv.ru /pulsedv/control-center/ -o "$backup/control.html"
check_https www.pulsedv.ru /ready -D "$backup/www.headers" -o /dev/null
python3 - "$backup" <<'PY'
from pathlib import Path
import json,re,sys
folder=Path(sys.argv[1])
if json.loads((folder/'ready.json').read_text()).get('status')!='ready':
    raise SystemExit('API не подтвердил готовность')
html=(folder/'control.html').read_text()
if html!=(folder/'expected-control.html').read_text() or '/pulsedv/control-center/assets/' not in html:
    raise SystemExit('HTTPS отдал HTML, отличный от установленного Control')
headers=(folder/'www.headers').read_text()
if not re.search(r'^HTTP/\S+ 308\b',headers,re.M) or not re.search(r'^location:\s*https://pulsedv\.ru/ready\s*$',headers,re.I|re.M):
    raise SystemExit('Перенаправление www не прошло проверку')
print('Новые образы, HTTPS/API ready, HTML Control и перенаправление www проверены на сервере.')
PY
trap - EXIT
echo "PULSE Control обновлён. Резервная копия: $backup"
