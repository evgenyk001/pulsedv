#!/usr/bin/env bash
# Resume the combined release, including when old services are stopped or were created by image ID.
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
target=${1:?Pass the reviewed 40-character release SHA}
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || exit 2
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Другое обновление уже выполняется.'; exit 1; }
backup=$(mktemp -d /root/pulsedv-buildings-recovery.XXXXXX)
cp -p .env compose.yaml deploy/Caddyfile "$backup/"
git rev-parse HEAD > "$backup/previous-commit.txt"
git diff --binary > "$backup/local-changes.patch"
stage='Подготовка'
paused=0
activated=0
sources_changed=0
images_ready=0
declare -A old_ids image_refs expected_ids
compose(){ docker compose "$@"; }
new_compose(){ docker compose --project-directory /opt/pulsedv -f "$backup/effective-compose.json" -f "$backup/build-images.json" "$@"; }
rollback_compose(){ docker compose --project-directory /opt/pulsedv -f "$backup/effective-compose.json" -f "$backup/rollback-images.json" "$@"; }
step(){ stage=$1; printf '\n%s\n' "$stage"; }
recover(){
 status=$?
 trap - EXIT HUP INT TERM
 if [ "$status" -ne 0 ]; then
  echo "ОШИБКА на этапе: $stage (код $status). Материалы: $backup"
  if [ "$sources_changed" -eq 1 ]; then cp -p "$backup/Caddyfile" deploy/Caddyfile || true; fi
  if [ "$images_ready" -eq 1 ]; then
   for service in api worker web; do docker image tag "${old_ids[$service]}" "${image_refs[$service]}" || true; done
  fi
  if [ "$activated" -eq 1 ]; then
   if rollback_compose up -d --no-deps --no-build --wait --wait-timeout 180 api worker web; then
    echo 'Прежние образы возвращены. Добавочные столбцы базы могут остаться; данные не восстанавливались поверх новых записей.'
   else echo 'Не удалось полностью вернуть прежние контейнеры; сохраните весь вывод.'; fi
  elif [ "$paused" -eq 1 ]; then
   compose start api worker || echo 'Не удалось запустить прежние API/worker; сохраните весь вывод.'
  fi
 fi
 exit "$status"
}
trap recover EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
step '1/8. Сохраняем точные ID прежних образов и запускаем существующие API/worker'
for service in api worker web; do
 container=$(compose ps -a -q "$service")
 if [ -z "$container" ] || [[ "$container" == *$'\n'* ]]; then echo "Ожидался один существующий контейнер $service; ничего не остановлено."; exit 1; fi
 old_ids[$service]=$(docker inspect --format '{{.Image}}' "$container")
 printf '%s\t%s\n' "$service" "${old_ids[$service]}" >> "$backup/old-images.tsv"
done
compose start api worker
step '2/8. Проверяем исходники и параметры сборки'
git diff --cached --quiet || { echo 'Есть подготовленные изменения Git.'; exit 1; }
git diff --quiet HEAD -- . ':(exclude)deploy/Caddyfile' ':(exclude)compose.yaml' || { echo 'Есть локальные изменения исходников.'; exit 1; }
compose config --format json > "$backup/effective-compose.json"
python3 - "$backup" <<'PY'
from pathlib import Path
import json,re,sys
folder=Path(sys.argv[1]);config=json.loads((folder/'effective-compose.json').read_text())
project=config.get('name') or 'pulsedv'
old=dict(line.split('\t') for line in (folder/'old-images.tsv').read_text().splitlines())
refs={}
for service in ('api','worker','web'):
    spec=config['services'][service]
    if not spec.get('build'):raise SystemExit('У сервиса '+service+' отсутствует настройка сборки; прежние контейнеры запущены.')
    ref=spec.get('image') or project+'-'+service
    if ref.startswith('sha256:') or '@' in ref or re.fullmatch('[a-f0-9]{64}',ref):
        raise SystemExit('В Compose у '+service+' закреплён неизменяемый ID образа. Нужна сверка compose.yaml; прежние контейнеры запущены.')
    refs[service]=ref
(folder/'image-refs.tsv').write_text(''.join(service+'\t'+ref+'\n' for service,ref in refs.items()))
for name,images in [('build-images.json',refs),('rollback-images.json',old)]:
    (folder/name).write_text(json.dumps({'services':{service:{'image':ref,'pull_policy':'never'} for service,ref in images.items()}}))
PY
while IFS=$'\t' read -r service ref; do image_refs[$service]=$ref; done < "$backup/image-refs.tsv"
images_ready=1
umask 022
git fetch origin "$target"
umask 077
git merge-base --is-ancestor HEAD "$target" || { echo 'Текущий коммит не предок обновления.'; exit 1; }
git diff --name-only HEAD "$target" -- backend/migrations > "$backup/migration-changes.txt"
python3 - "$backup/migration-changes.txt" <<'PY'
from pathlib import Path
import sys
if set(Path(sys.argv[1]).read_text().splitlines())-{'backend/migrations/034_project_buildings.sql'}:
    raise SystemExit('Обнаружены другие миграции; прежние сервисы продолжают работать.')
PY
git diff --quiet HEAD "$target" -- compose.yaml || { echo 'Состав сервисов отличается; требуется сверка.'; exit 1; }
git show "$target:deploy/Caddyfile" > "$backup/new.Caddyfile"
git show HEAD:deploy/Caddyfile > "$backup/tracked.Caddyfile"
python3 - "$backup" <<'PY'
from pathlib import Path
import shlex,sys
folder=Path(sys.argv[1])
def tokens(name):return shlex.split('\n'.join(line for line in (folder/name).read_text().splitlines() if line.strip()!='debug'),comments=True)
if tokens('Caddyfile') not in (tokens('new.Caddyfile'),tokens('tracked.Caddyfile')):raise SystemExit('Локальный Caddyfile отличается от проверенного; прежние сервисы продолжают работать.')
PY
sources_changed=1
git restore --source=HEAD -- deploy/Caddyfile
umask 022
git merge --ff-only "$target"
umask 077
test "$(git rev-parse HEAD)" = "$target"
step '3/8. Собираем новые образы; существующие API/worker пока работают'
new_compose build api worker web
for service in api worker web; do expected_ids[$service]=$(docker image inspect --format '{{.Id}}' "${image_refs[$service]}"); done
new_compose run --rm -T --no-deps api node --import tsx backend/src/preflight.ts
new_compose run --rm -T --no-deps --entrypoint caddy web validate --config /etc/caddy/Caddyfile --adapter caddyfile
step '4/8. Останавливаем запись и проверяем резервную копию базы и медиа'
paused=1
compose stop worker api
compose exec -T db pg_dump -U pulse -d pulse -Fc > "$backup/database.dump"
new_compose run --rm -T --no-deps --entrypoint tar api -czf - -C /data/media . > "$backup/media.tar.gz"
test -s "$backup/database.dump"
compose exec -T db pg_restore -l < "$backup/database.dump" > /dev/null
gzip -t "$backup/media.tar.gz"
echo "Резервная копия проверена: $backup"
step '5/8. Применяем недостающую миграцию; повторный запуск безопасен'
new_compose run --rm -T --no-deps api node --import tsx backend/src/migrate.ts
step '6/8. Запускаем новые контейнеры и сверяем фактические ID образов'
activated=1
new_compose up -d --no-deps --no-build --wait --wait-timeout 180 api worker web
paused=0
for service in api worker web; do
 container=$(compose ps -q "$service")
 if [ -z "$container" ]; then echo "Не запущен $service"; exit 1; fi
 if [ "$(docker inspect --format '{{.Image}}' "$container")" != "${expected_ids[$service]}" ]; then echo "У $service запущен другой образ"; exit 1; fi
done
step '7/8. Проверяем базу и готовность API'
compose exec -T api node --import tsx --input-type=module -e '
import {postgresDatabase} from "./backend/src/database.ts";
import {adminCatalogSummary} from "./backend/src/catalogRepository.ts";
const db=postgresDatabase(process.env.DATABASE_URL);
try{await db.query("select building_id,section_label from catalog_property_floorplans limit 0");const data=await adminCatalogSummary(db);if(!Array.isArray(data.cities))throw new Error("Invalid catalog summary");console.log("Города, корпуса и секции: готовы")}finally{await db.close()}
'
check_https(){ curl --fail --silent --show-error --retry 8 --retry-all-errors --retry-delay 2 --connect-timeout 5 --max-time 15 --resolve "$1:443:127.0.0.1" "https://$1$2" "${@:3}"; }
check_https pulsedv.ru /ready -o "$backup/ready.json"
step '8/8. Проверяем установленный HTML Control и Mini App через HTTPS'
for app in control-center mini-app; do
 compose exec -T web cat "/srv/$app/index.html" > "$backup/expected-$app.html"
 check_https pulsedv.ru "/pulsedv/$app/" -o "$backup/served-$app.html"
 cmp "$backup/expected-$app.html" "$backup/served-$app.html"
done
python3 - "$backup/ready.json" <<'PY'
import json,sys
if json.load(open(sys.argv[1])).get('status')!='ready':raise SystemExit('API не подтвердил готовность')
PY
trap - EXIT HUP INT TERM
echo "ГОТОВО: новые API/worker/web, миграция, HTTPS и оба интерфейса проверены. Резервная копия: $backup"
