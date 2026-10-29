#!/usr/bin/env bash
# Frontend/Caddy update only. API, worker, database and media are not modified.
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
backup=$(mktemp -d /root/pulsedv-swipe-polish-backup.XXXXXX)
cp -p deploy/Caddyfile compose.yaml "$backup/"
git rev-parse HEAD > "$backup/previous-commit.txt"
git diff --binary > "$backup/local-changes.patch"
web_container=$(docker compose ps -q web)
test -n "$web_container"
web_image=$(docker inspect --format '{{.Config.Image}}' "$web_container")
image_id=$(docker inspect --format '{{.Image}}' "$web_container")
rollback_tag="pulsedv-web:before-swipe-polish-$(date -u +%Y%m%d%H%M%S)"
docker image tag "$image_id" "$rollback_tag"
activated=0
sources_changed=0
recover(){
 status=$?
 trap - EXIT
 if [ "$status" -ne 0 ]; then
  echo "Обновление остановлено. Копия настроек и прежний образ: $backup ; $rollback_tag"
  if [ "$sources_changed" -eq 1 ]; then cp -p "$backup/Caddyfile" deploy/Caddyfile; fi
  if [ "$sources_changed" -eq 1 ]; then docker image tag "$rollback_tag" "$web_image"; fi
  if [ "$activated" -eq 1 ]; then
   if docker compose up -d --no-deps --no-build --wait --wait-timeout 180 web; then
    echo 'Прежний веб-образ возвращён. Исходники могут оставаться на новом коммите.'
   else echo 'Автоматический возврат веб-контейнера не завершён; сохраните этот вывод.'; fi
  fi
 fi
 exit "$status"
}
trap recover EXIT
umask 022
git fetch origin "$target"
umask 077
git merge-base --is-ancestor HEAD "$target" || { echo 'Текущий коммит не предок обновления; исходники не изменены.'; exit 1; }
git show "$target:deploy/Caddyfile" > "$backup/new.Caddyfile"
git show HEAD:deploy/Caddyfile > "$backup/tracked.Caddyfile"
# Accept only the tracked config or the working config already reviewed in this incident.
python3 - "$backup" <<'PY'
from pathlib import Path
import shlex,sys
folder=Path(sys.argv[1])
def tokens(name):
    text='\n'.join(line for line in (folder/name).read_text().splitlines() if line.strip()!='debug')
    return shlex.split(text,comments=True)
if tokens('Caddyfile') not in (tokens('new.Caddyfile'),tokens('tracked.Caddyfile')):
    raise SystemExit('Локальный Caddyfile содержит другие настройки. Ничего не заменено; отправьте его для сверки.')
PY
sources_changed=1
git restore --source=HEAD -- deploy/Caddyfile
umask 022
git merge --ff-only "$target"
umask 077
test "$(git rev-parse HEAD)" = "$target"
docker compose config --quiet
docker compose build web
expected_image=$(docker image inspect --format '{{.Id}}' "$web_image")
docker compose run --rm -T --no-deps --entrypoint caddy web validate --config /etc/caddy/Caddyfile --adapter caddyfile
activated=1
docker compose up -d --no-deps --no-build --wait --wait-timeout 180 web
running_container=$(docker compose ps -q web)
test "$(docker inspect --format '{{.Image}}' "$running_container")" = "$expected_image"
docker compose exec -T web cat /srv/mini-app/index.html > "$backup/expected-mini-app.html"
check_https(){
 curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 2 \
  --connect-timeout 5 --max-time 15 --resolve "$1:443:127.0.0.1" "https://$1$2" "${@:3}"
}
check_https pulsedv.ru /ready -o "$backup/ready.json"
check_https pulsedv.ru /pulsedv/mini-app/ -o "$backup/mini-app.html"
check_https www.pulsedv.ru /ready -D "$backup/www.headers" -o /dev/null
python3 - "$backup" <<'PY'
from pathlib import Path
import json,re,sys
folder=Path(sys.argv[1])
if json.loads((folder/'ready.json').read_text()).get('status')!='ready':
    raise SystemExit('API не подтвердил готовность')
html=(folder/'mini-app.html').read_text()
if html!=(folder/'expected-mini-app.html').read_text():
    raise SystemExit('HTTPS отдал HTML, отличный от установленного образа')
if not re.search(r'<script\b[^>]*id="pulse-telegram-sdk"[^>]*\basync\b',html):
    raise SystemExit('Сервер отдал прежний HTML Mini App')
headers=(folder/'www.headers').read_text()
if not re.search(r'^HTTP/\S+ 308\b',headers,re.M) or not re.search(r'^location:\s*https://pulsedv\.ru/ready\s*$',headers,re.I|re.M):
    raise SystemExit('Перенаправление www не прошло проверку')
print('Новый веб-образ, HTTPS/API ready, HTML и перенаправление www проверены на сервере.')
PY
trap - EXIT
echo "Полировка свайпов установлена. Копия настроек: $backup"
echo 'Доступность из проблемной сети этим тестом не подтверждается.'
