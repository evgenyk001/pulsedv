#!/usr/bin/env bash
# Run the reviewed script with the exact release commit as its first argument.
set -euo pipefail
umask 077
cd /opt/pulsedv
target=${1:?Pass the reviewed 40-character commit SHA}
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || exit 2
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Другое обновление уже выполняется.'; exit 1; }
git diff --quiet HEAD -- . ':(exclude)deploy/Caddyfile' ':(exclude)compose.yaml' || {
  echo 'Есть локальные изменения исходников. Обновление не начато.'; exit 1;
}
backup="/root/pulsedv-backups/$(date -u +%Y%m%d-%H%M%S)-before-swipe-inbox"
mkdir -p "$backup"
cp -p .env compose.yaml deploy/Caddyfile "$backup/"
git rev-parse HEAD > "$backup/previous-commit.txt"
git diff --binary > "$backup/local-changes.patch"
tag="before-swipe-inbox-$(date -u +%Y%m%d%H%M%S)"
for service in api worker web; do
  image=$(docker compose images -q "$service")
  test -n "$image"
  docker image tag "$image" "pulsedv-$service:$tag"
done
paused=0
activated=0
recover(){
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    echo "Обновление остановлено. Резервные материалы: $backup"
    if [ "$activated" -eq 1 ]; then
      for service in api worker web; do docker image tag "pulsedv-$service:$tag" "pulsedv-$service:latest"; done
      if docker compose up -d --no-build --wait --wait-timeout 180; then
        echo 'Прежние образы запущены. Исходники остаются на новом коммите; база не восстанавливалась.'
      else
        echo 'Автоматический возврат не завершён. Сохраните этот вывод для разбора.'
      fi
    elif [ "$paused" -eq 1 ]; then
      docker compose start api worker || true
    fi
  fi
  exit "$status"
}
trap recover EXIT
# Git checkout permissions must allow the unprivileged container user to read new sources.
umask 022
git fetch origin "$target"
git merge --ff-only "$target"
test "$(git rev-parse HEAD)" = "$target"
umask 077
docker compose config --quiet
docker compose build api worker web
docker compose run --rm -T --no-deps api node --import tsx backend/src/preflight.ts
paused=1
docker compose stop worker api
docker compose exec -T db pg_dump -U pulse -d pulse -Fc > "$backup/database.dump"
docker compose run --rm -T --no-deps --entrypoint tar api -czf - -C /data/media . > "$backup/media.tar.gz"
test -s "$backup/database.dump"
docker compose exec -T db pg_restore -l < "$backup/database.dump" > /dev/null
gzip -t "$backup/media.tar.gz"
echo "Резервная копия проверена: $backup"
docker compose run --rm -T --no-deps api node --import tsx backend/src/migrate.ts
activated=1
docker compose up -d --no-build --wait --wait-timeout 180
curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 3 \
  --connect-timeout 5 --max-time 10 --resolve pulsedv.ru:443:127.0.0.1 \
  https://pulsedv.ru/ready -o "$backup/ready.json"
python3 - "$backup/ready.json" <<'PY'
import json,sys
with open(sys.argv[1]) as response:
    if json.load(response).get('status') != 'ready':
        raise SystemExit('API не подтвердил готовность')
print('HTTPS/API: ready')
PY
docker compose ps
echo "Обновление свайпов и списка обращений установлено. Резервная копия: $backup"
