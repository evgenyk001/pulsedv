#!/usr/bin/env bash
# Web-only release: do not stop, rebuild or migrate API/worker/database.
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
target=${1:?Pass the reviewed 40-character release SHA}
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || exit 2
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Другое обновление уже выполняется.'; exit 1; }
backup=$(mktemp -d /root/pulsedv-floorplans-grid.XXXXXX)
cp -p deploy/Caddyfile compose.yaml "$backup/"
git rev-parse HEAD > "$backup/previous-commit.txt"
git diff --binary > "$backup/local-changes.patch"
stage='Подготовка'
activated=0
sources_changed=0
image_ref=''
old_id=''
compose(){ docker compose "$@"; }
new_compose(){ docker compose --project-directory /opt/pulsedv -f "$backup/effective-compose.json" -f "$backup/build-image.json" "$@"; }
rollback_compose(){ docker compose --project-directory /opt/pulsedv -f "$backup/effective-compose.json" -f "$backup/rollback-image.json" "$@"; }
recover(){
 status=$?
 trap - EXIT HUP INT TERM
 if [ "$status" -ne 0 ]; then
  echo "ОШИБКА на этапе: $stage (код $status). Материалы: $backup"
  if [ "$sources_changed" -eq 1 ]; then cp -p "$backup/Caddyfile" deploy/Caddyfile || true; fi
  if [ -n "$image_ref" ] && [ -n "$old_id" ]; then docker image tag "$old_id" "$image_ref" || true; fi
  if [ "$activated" -eq 1 ]; then
   rollback_compose up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 web || echo 'Не удалось вернуть прежний web; сохраните вывод.'
  fi
 fi
 exit "$status"
}
trap recover EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
stage='1/4. Сохраняем прежний веб-образ'; echo "$stage"
container=$(compose ps -a -q web)
if [ -z "$container" ] || [[ "$container" == *$'\n'* ]]; then echo 'Ожидался один контейнер web.'; exit 1; fi
old_id=$(docker inspect --format '{{.Image}}' "$container")
if ! docker image inspect --format '{{.Id}}' "$old_id" > /dev/null 2>&1; then
 echo 'Образ прежнего web недоступен для отката; обновление не начато.'; exit 1
fi
docker image tag "$old_id" "pulsedv-recovery:$(basename "$backup")-web"
printf '%s\n' "$old_id" > "$backup/old-image.txt"
compose config --format json > "$backup/effective-compose.json"
python3 - "$backup" <<'PY'
from pathlib import Path
import json,re,sys
folder=Path(sys.argv[1]);config=json.loads((folder/'effective-compose.json').read_text())
ref=config['services']['web'].get('image') or (config.get('name') or 'pulsedv')+'-web'
if ref.startswith('sha256:') or '@' in ref or re.fullmatch('[a-f0-9]{64}',ref):raise SystemExit('В Compose закреплён ID web; требуется сверка. Контейнеры не изменены.')
(folder/'image-ref.txt').write_text(ref)
for name,image in [('build-image.json',ref),('rollback-image.json',(folder/'old-image.txt').read_text().strip())]:
    (folder/name).write_text(json.dumps({'services':{'web':{'image':image,'pull_policy':'never'}}}))
PY
image_ref=$(cat "$backup/image-ref.txt")
# Refuse to publish a phone gate against a server that allows phone-free accounts.
compose exec -T api node -e 'if(process.env.REQUIRE_TELEGRAM_PHONE!=="true"){console.error("Обязательное подтверждение номера отключено на API; обновление не начато.");process.exit(1)}'
stage='2/4. Проверяем и обновляем исходники'; echo "$stage"
git diff --cached --quiet || { echo 'Есть подготовленные изменения Git.'; exit 1; }
git diff --quiet HEAD -- . ':(exclude)deploy/Caddyfile' ':(exclude)compose.yaml' || { echo 'Есть локальные изменения исходников.'; exit 1; }
umask 022
git fetch origin "$target"
umask 077
git merge-base --is-ancestor HEAD "$target" || { echo 'Текущий коммит не предок обновления.'; exit 1; }
git diff --quiet HEAD "$target" -- backend/src backend/migrations backend/package.json packages compose.yaml deploy/Caddyfile || { echo 'Обнаружены дополнительные изменения; этот блок обновляет только веб-интерфейсы.'; exit 1; }
git show HEAD:deploy/Caddyfile > "$backup/tracked.Caddyfile"
python3 - "$backup" <<'PY'
from pathlib import Path
import shlex,sys
folder=Path(sys.argv[1])
def tokens(name):return shlex.split('\n'.join(line for line in (folder/name).read_text().splitlines() if line.strip()!='debug'),comments=True)
if tokens('Caddyfile')!=tokens('tracked.Caddyfile'):raise SystemExit('Локальный Caddyfile отличается от проверенного; контейнеры не изменены.')
PY
sources_changed=1
git restore --source=HEAD -- deploy/Caddyfile
umask 022
git merge --ff-only "$target"
umask 077
test "$(git rev-parse HEAD)" = "$target"
stage='3/4. Собираем и запускаем только web'; echo "$stage"
new_compose build web
expected_id=$(docker image inspect --format '{{.Id}}' "$image_ref")
new_compose run --rm -T --no-deps --entrypoint caddy web validate --config /etc/caddy/Caddyfile --adapter caddyfile
activated=1
new_compose up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 web
container=$(compose ps -q web)
test -n "$container"
test "$(docker inspect --format '{{.Image}}' "$container")" = "$expected_id"
stage='4/4. Проверяем оба интерфейса через HTTPS'; echo "$stage"
check_https(){ curl --fail --silent --show-error --retry 8 --retry-all-errors --retry-delay 2 --connect-timeout 5 --max-time 15 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$1" "${@:2}"; }
for app in mini-app control-center; do
 compose exec -T web cat "/srv/$app/index.html" > "$backup/expected-$app.html"
 check_https "/pulsedv/$app/" -o "$backup/$app.html"
 cmp "$backup/expected-$app.html" "$backup/$app.html"
 python3 - "$backup/$app.html" "$app" > "$backup/assets-$app.txt" <<'PYASSETS'
import re,sys
html=open(sys.argv[1]).read();app=re.escape(sys.argv[2])
for attribute,extension in [('src','js'),('href','css')]:
    match=re.search(attribute+r'="(/pulsedv/'+app+r'/assets/[A-Za-z0-9_-]+\.'+extension+r')"',html)
    if not match:raise SystemExit('Не найден '+extension+' для '+sys.argv[2])
    print(match.group(1))
PYASSETS
 while IFS= read -r asset; do
  compose exec -T web cat "/srv/$app/${asset#/pulsedv/$app/}" > "$backup/expected-$(basename "$asset")"
  check_https "$asset" -o "$backup/$(basename "$asset")"
  cmp "$backup/expected-$(basename "$asset")" "$backup/$(basename "$asset")"
 done < "$backup/assets-$app.txt"
done
check_https /ready -o "$backup/ready.json"
python3 - "$backup/ready.json" <<'PY'
import json,sys
if json.load(open(sys.argv[1])).get('status')!='ready':raise SystemExit('API не подтвердил готовность')
PY
trap - EXIT HUP INT TERM
echo "ГОТОВО: сетка планировок в Control и Mini App обновлена; новые HTML/JS/CSS и API ready проверены. Копия: $backup"
