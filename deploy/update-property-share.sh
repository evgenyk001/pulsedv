#!/usr/bin/env bash
# Reviewed property sharing and PDF delivery rollout. Preserve rollback images before changing services; verify runtime code, not manifest/config ID equality.
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
target=${1:?Pass the reviewed 40-character release SHA}
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || exit 2
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Другое обновление уже выполняется.'; exit 1; }
backup=$(mktemp -d /root/pulsedv-share-recovery.XXXXXX)
cp -p .env compose.yaml deploy/Caddyfile "$backup/"
echo "Материалы обновления: $backup"
git rev-parse HEAD > "$backup/previous-commit.txt"
git diff --binary > "$backup/local-changes.patch"
stage='Подготовка'
paused=0
activated=0
sources_changed=0
declare -A old_ids image_refs
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
  if [ "$activated" -eq 1 ]; then
   if rollback_compose up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 api worker web; then
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
 # Docker 29 may retain a running root filesystem without addressable old image metadata.
 # Preserve an independent local rollback snapshot, never remove/recreate first.
 rollback_ref="pulsedv-recovery:$(basename "$backup")-$service"
 if docker image inspect "${old_ids[$service]}" >/dev/null 2>&1; then
  docker image tag "${old_ids[$service]}" "$rollback_ref"
 else
  echo "$service: сохраняем локальный образ отката из существующего контейнера."
  docker commit --pause=false "$container" "$rollback_ref" > "$backup/snapshot-$service.txt"
 fi
 docker image inspect "$rollback_ref" >/dev/null
 printf '%s\t%s\n' "$service" "$rollback_ref" >> "$backup/old-images.tsv"
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
aliases={}
for service in ('api','worker','web'):
    spec=config['services'][service]
    if not spec.get('build'):raise SystemExit('У сервиса '+service+' отсутствует настройка сборки; прежние контейнеры запущены.')
    ref=spec.get('image') or project+'-'+service
    if ref.startswith('sha256:') or '@' in ref or re.fullmatch('[a-f0-9]{64}',ref):
        raise SystemExit('В Compose у '+service+' закреплён неизменяемый ID образа. Нужна сверка compose.yaml; прежние контейнеры запущены.')
    aliases[service]=ref
    refs[service]='pulsedv-release:'+folder.name+'-'+service
(folder/'default-refs.tsv').write_text(''.join(service+'\t'+ref+'\n' for service,ref in aliases.items()))
(folder/'image-refs.tsv').write_text(''.join(service+'\t'+ref+'\n' for service,ref in refs.items()))
for name,images in [('build-images.json',refs),('rollback-images.json',old)]:
    (folder/name).write_text(json.dumps({'services':{service:{'image':ref,'pull_policy':'never'} for service,ref in images.items()}}))
PY
while IFS=$'\t' read -r service ref; do image_refs[$service]=$ref; done < "$backup/image-refs.tsv"
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
python3 - "$backup" <<'VERIFY'
from pathlib import Path
import subprocess,hashlib,json,sys
folder=Path(sys.argv[1])
files=subprocess.check_output(['git','ls-files','backend/src','backend/migrations','packages','package.json','package-lock.json','backend/package.json'],text=True).splitlines()
(folder/'files.json').write_text(json.dumps(files))
(folder/'expected-code.json').write_text(json.dumps({f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files}))
VERIFY
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
restore_db="pulse_share_check_$$"
compose exec -T db createdb -U pulse "$restore_db"
if ! compose exec -T db pg_restore -U pulse -d "$restore_db" --exit-on-error --no-owner --no-privileges < "$backup/database.dump"; then
 compose exec -T db dropdb -U pulse --if-exists "$restore_db" || true
 echo 'Не удалось восстановить резервную копию в проверочную базу.'; exit 1
fi
compose exec -T db psql -U pulse -d "$restore_db" -v ON_ERROR_STOP=1 -c 'select count(*) from app_users;' > "$backup/restore-check.txt"
compose exec -T db dropdb -U pulse "$restore_db"
(cd "$backup" && sha256sum database.dump media.tar.gz > SHA256SUMS)
echo "База восстановлена в изолированную проверочную БД, архив медиа проверен: $backup"
step '5/8. Применяем недостающую миграцию; повторный запуск безопасен'
new_compose run --rm -T --no-deps api node --import tsx backend/src/migrate.ts
step '6/8. Запускаем новые контейнеры и сверяем код API/worker'
activated=1
new_compose up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 api worker web
paused=0
for service in api worker web; do
 container=$(compose ps -q "$service")
 if [ -z "$container" ]; then echo "Не запущен $service"; exit 1; fi
 if [ "$(docker inspect --format '{{.Config.Image}}' "$container")" != "${image_refs[$service]}" ]; then echo "У $service другая ссылка образа"; exit 1; fi
done
for service in api worker; do
 compose exec -T "$service" node -e '
const fs=require("node:fs"),crypto=require("node:crypto");const files=JSON.parse(fs.readFileSync(0,"utf8"));
process.stdout.write(JSON.stringify(Object.fromEntries(files.map(f=>[f,crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")]))));
 ' < "$backup/files.json" > "$backup/$service-code.json"
 python3 - "$backup" "$service" <<'VERIFY'
from pathlib import Path
import json,sys
folder=Path(sys.argv[1]);service=sys.argv[2]
if json.loads((folder/'expected-code.json').read_text())!=json.loads((folder/(service+'-code.json')).read_text()):raise SystemExit(service+': код отличается от релиза')
print(service+': код проверен')
VERIFY
done
step '7/8. Проверяем базу и готовность API'
compose exec -T api node --import tsx --input-type=module -e '
import {postgresDatabase} from "./backend/src/database.ts";
import {adminCatalogSummary} from "./backend/src/catalogRepository.ts";
const db=postgresDatabase(process.env.DATABASE_URL);
try{await db.query("select building_id,section_label from catalog_property_floorplans limit 0");const data=await adminCatalogSummary(db);if(!Array.isArray(data.cities))throw new Error("Invalid catalog summary");console.log("Каталог: готов")}finally{await db.close()}
'
check_https(){ curl --fail --silent --show-error --retry 8 --retry-all-errors --retry-delay 2 --connect-timeout 5 --max-time 15 --resolve "$1:443:127.0.0.1" "https://$1$2" "${@:3}"; }
check_https pulsedv.ru /ready -o "$backup/ready.json"
step '8/8. Проверяем установленный HTML Control и Mini App через HTTPS'
for app in control-center mini-app; do
 compose exec -T web cat "/srv/$app/index.html" > "$backup/expected-$app.html"
 check_https pulsedv.ru "/pulsedv/$app/" -o "$backup/served-$app.html"
 cmp "$backup/expected-$app.html" "$backup/served-$app.html"
done
for app in control-center mini-app; do
 python3 - "$backup/expected-$app.html" > "$backup/$app-assets.txt" <<'ASSETS'
import re,sys
paths=sorted(set(re.findall(r'(?:src|href)="(/pulsedv/(?:mini-app|control-center)/assets/[A-Za-z0-9_.-]+\.(?:js|css))"',open(sys.argv[1]).read())))
if not any(p.endswith('.js') for p in paths) or not any(p.endswith('.css') for p in paths):raise SystemExit('Нет ссылок на JS/CSS')
print('\n'.join(paths))
ASSETS
 while IFS= read -r asset; do
  file=$(basename "$asset")
  compose exec -T web cat "/srv/${asset#/pulsedv/}" > "$backup/expected-$file"
  check_https pulsedv.ru "$asset" -o "$backup/served-$file"
  cmp "$backup/expected-$file" "$backup/served-$file"
 done < "$backup/$app-assets.txt"
done
python3 - "$backup/ready.json" <<'PY'
import json,sys
if json.load(open(sys.argv[1])).get('status')!='ready':raise SystemExit('API не подтвердил готовность')
PY
while IFS=$'\t' read -r service ref; do
 docker image tag "${image_refs[$service]}" "$ref"
done < "$backup/default-refs.tsv"
trap - EXIT HUP INT TERM
echo "ГОТОВО: отправка ЖК и PDF-презентаций через Telegram установлена; код API/worker, HTTPS и оба интерфейса проверены. Розыгрыш в этот релиз не входит. Резервная копия: $backup"
