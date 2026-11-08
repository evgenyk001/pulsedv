#!/usr/bin/env bash
# Web-only cumulative update: silent successful PDF delivery in Telegram Mini App.
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
target=${1:?Pass the reviewed 40-character release SHA}
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || exit 2
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Другое обновление уже выполняется.'; exit 1; }
backup=$(mktemp -d /root/pulsedv-pdf-silent.XXXXXX)
cp -p compose.yaml deploy/Caddyfile "$backup/"
git rev-parse HEAD > "$backup/previous-commit.txt"
git diff --binary > "$backup/local-changes.patch"
echo "Материалы обновления: $backup"
stage='Подготовка';activated=0;sources_changed=0
compose(){ docker compose "$@"; }
new_compose(){ docker compose --project-directory /opt/pulsedv -f "$backup/effective-compose.json" -f "$backup/build-image.json" "$@"; }
old_compose(){ docker compose --project-directory /opt/pulsedv -f "$backup/effective-compose.json" -f "$backup/rollback-image.json" "$@"; }
recover(){
 status=$?;trap - EXIT HUP INT TERM
 if [ "$status" -ne 0 ]; then
  echo "ОШИБКА на этапе: $stage (код $status). Материалы: $backup"
  if [ "$sources_changed" -eq 1 ]; then cp -p "$backup/Caddyfile" deploy/Caddyfile || true; fi
  if [ "$activated" -eq 1 ]; then old_compose up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 web || echo 'Не удалось вернуть прежний web; сохраните вывод.'; fi
 fi
 exit "$status"
}
trap recover EXIT
trap 'exit 129' HUP;trap 'exit 130' INT;trap 'exit 143' TERM
stage='1/4. Сохраняем прежний web для отката';echo "$stage"
container=$(compose ps -a -q web)
if [ -z "$container" ] || [[ "$container" == *$'\n'* ]]; then echo 'Ожидался один существующий контейнер web.';exit 1;fi
old_id=$(docker inspect --format '{{.Image}}' "$container")
rollback_ref="pulsedv-recovery:$(basename "$backup")-web"
if docker image inspect "$old_id" >/dev/null 2>&1;then docker image tag "$old_id" "$rollback_ref";else docker commit --pause=false "$container" "$rollback_ref" > "$backup/web-snapshot.txt";fi
docker image inspect "$rollback_ref" >/dev/null
compose config --format json > "$backup/effective-compose.json"
python3 - "$backup" "$rollback_ref" <<'PY'
from pathlib import Path
import json,re,sys
folder=Path(sys.argv[1]);config=json.loads((folder/'effective-compose.json').read_text());web=config['services']['web']
if not web.get('build'):raise SystemExit('Нет настройки сборки web; контейнеры не изменены.')
default=web.get('image') or (config.get('name') or 'pulsedv')+'-web'
if default.startswith('sha256:') or '@' in default or re.fullmatch('[a-f0-9]{64}',default):raise SystemExit('В Compose закреплён неизменяемый образ web; требуется сверка.')
(folder/'default-ref.txt').write_text(default)
for name,ref in [('build-image.json','pulsedv-release:'+folder.name+'-web'),('rollback-image.json',sys.argv[2])]:
 (folder/name).write_text(json.dumps({'services':{'web':{'image':ref,'pull_policy':'never'}}}))
PY
stage='2/4. Проверяем и обновляем только интерфейс';echo "$stage"
git diff --cached --quiet || { echo 'Есть подготовленные изменения Git.';exit 1; }
git diff --quiet HEAD -- . ':(exclude)deploy/Caddyfile' ':(exclude)compose.yaml' || { echo 'Есть локальные изменения исходников.';exit 1; }
umask 022
git fetch origin "$target"
umask 077
git merge-base --is-ancestor HEAD "$target" || { echo 'Текущий релиз не предок обновления.';exit 1; }
git diff --name-only HEAD "$target" > "$backup/changed-files.txt"
python3 - "$backup/changed-files.txt" <<'PY'
from pathlib import Path
import sys
allowed=('apps/control-center/','apps/mini-app/','tests/')
for p in Path(sys.argv[1]).read_text().splitlines():
 if not p.startswith(allowed) and p not in ('deploy/update-presentation-silent.sh','docs/presentation-silent.md','deploy/update-giveaway-experience.sh','docs/giveaway-experience.md','deploy/update-control-workspace.sh','deploy/update-control-studio.sh','deploy/update-giveaway-page.sh','docs/giveaway.md','docs/control-workspace.md','docs/control-studio.md','packages/journey/ControlJourneyPanel.tsx','packages/journey/controlJourney.css'):
  raise SystemExit('Обнаружены дополнительные изменения: '+p+'. Установите объединённый релиз сначала.')
PY
git show HEAD:deploy/Caddyfile > "$backup/tracked.Caddyfile"
python3 - "$backup" <<'PY'
from pathlib import Path
import shlex,sys
folder=Path(sys.argv[1])
def tokens(name):return shlex.split('\n'.join(line for line in (folder/name).read_text().splitlines() if line.strip()!='debug'),comments=True)
if tokens('Caddyfile')!=tokens('tracked.Caddyfile'):raise SystemExit('Локальный Caddyfile отличается; требуется сверка. Контейнеры не изменены.')
PY
sources_changed=1
git restore --source=HEAD -- deploy/Caddyfile
umask 022
git merge --ff-only "$target"
umask 077
test "$(git rev-parse HEAD)" = "$target"
stage='3/4. Собираем и запускаем новый web';echo "$stage"
new_compose build web
new_compose run --rm -T --no-deps --entrypoint caddy web validate --config /etc/caddy/Caddyfile --adapter caddyfile
activated=1
new_compose up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 web
container=$(compose ps -q web)
test -n "$container"
ref=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["services"]["web"]["image"])' "$backup/build-image.json")
test "$(docker inspect --format '{{.Config.Image}}' "$container")" = "$ref"
stage='4/4. Проверяем HTTPS и файлы Mini App и Control';echo "$stage"
check_https(){ curl --fail --silent --show-error --retry 8 --retry-all-errors --retry-delay 2 --connect-timeout 5 --max-time 15 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$1" "${@:2}"; }
for surface in control-center mini-app;do
 compose exec -T web cat "/srv/$surface/index.html" > "$backup/expected-$surface.html"
 check_https "/pulsedv/$surface/" -o "$backup/served-$surface.html"
 cmp "$backup/expected-$surface.html" "$backup/served-$surface.html"
 python3 - "$backup/expected-$surface.html" "$surface" > "$backup/$surface-assets.txt" <<'PY_ASSETS'
import re,sys
surface=sys.argv[2]
paths=sorted(set(re.findall(r'(?:src|href)="(/pulsedv/'+re.escape(surface)+r'/assets/[A-Za-z0-9_.-]+\.(?:js|css))"',open(sys.argv[1]).read())))
if not any(p.endswith('.js') for p in paths) or not any(p.endswith('.css') for p in paths):raise SystemExit('Нет ссылок на JS/CSS: '+surface)
print('\n'.join(paths))
PY_ASSETS
 while IFS= read -r asset;do
  file="$surface-$(basename "$asset")"
  compose exec -T web cat "/srv/${asset#/pulsedv/}" > "$backup/expected-$file"
  check_https "$asset" -o "$backup/served-$file"
  cmp "$backup/expected-$file" "$backup/served-$file"
 done < "$backup/$surface-assets.txt"
done
check_https /ready -o "$backup/ready.json"
python3 - "$backup/ready.json" <<'PY'
import json,sys
if json.load(open(sys.argv[1])).get('status')!='ready':raise SystemExit('API не подтвердил готовность')
PY
docker image tag "$ref" "$(cat "$backup/default-ref.txt")"
trap - EXIT HUP INT TERM
echo "ГОТОВО: отправка презентаций без лишних плашек установлена; HTML, JS/CSS обоих интерфейсов и API ready проверены. База, API, worker, правила и заявки не изменялись. Копия прежнего web: $backup"
