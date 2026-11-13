#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
release=${1:?Release commit required}
exec 9>/var/lock/pulsedv-update.lock
flock -n 9
backup=$(mktemp -d /root/pulsedv-banner-fix.XXXXXX)
echo "Резервная копия: $backup"
web=$(docker compose ps -q web)
test -n "$web"
if docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' "$web" | grep -Eq '^/srv/?$|^/srv/mini-app(/|$)'; then
  echo 'Каталог Mini App перекрыт подключением Docker.'
  exit 1
fi
old="pulsedv-rollback:$(basename "$backup")"
new="pulsedv-release:$(basename "$backup")"
docker image tag "$(docker inspect --format '{{.Image}}' "$web")" "$old"
docker compose config --format json > "$backup/compose.json"
python3 - "$backup" "$old" "$new" <<'PY'
import json, sys
from pathlib import Path
folder = Path(sys.argv[1])
compose = json.loads((folder / 'compose.json').read_text())
default = compose['services']['web'].get('image') or f"{compose['name']}-web"
if '@' in default or default.startswith('sha256:'):
    raise SystemExit('Compose использует неизменяемый тег web.')
(folder / 'default-image').write_text(default)
for name, image in zip(('rollback', 'candidate'), sys.argv[2:]):
    (folder / f'{name}.json').write_text(json.dumps({'services': {'web': {'image': image, 'pull_policy': 'never'}}}))
PY
mkdir "$backup/build"
git archive "$release" package.json package-lock.json apps/mini-app apps/control-center/package.json backend/package.json packages dist | tar -x -C "$backup/build"
cat > "$backup/build/Dockerfile" <<DOCKERFILE
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/mini-app/package.json apps/mini-app/package.json
COPY apps/control-center/package.json apps/control-center/package.json
COPY backend/package.json backend/package.json
RUN npm ci --no-audit --no-fund
COPY apps/mini-app apps/mini-app
COPY packages packages
COPY dist dist
ENV VITE_PULSE_MODE=api
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build -w pulse-dv-mini-app
FROM $old
COPY --from=build /app/dist/mini-app/ /srv/mini-app/
DOCKERFILE
docker build -t "$new" "$backup/build"
roll() {
  local mode=$1
  shift
  docker compose --project-directory /opt/pulsedv -f "$backup/compose.json" -f "$backup/$mode.json" "$@"
}
rollback() {
  status=$?
  if (( status != 0 )); then
    roll rollback up -d --no-deps --no-build --force-recreate web ||
      echo "Не удалось вернуть прежний web. Резервная копия: $backup"
  fi
}
trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
roll candidate up -d --no-deps --no-build --force-recreate web
get() {
  curl -fsS --retry 8 --retry-all-errors --retry-delay 1 --max-time 10 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$1" "${@:2}"
}
test "$(docker inspect --format '{{.Image}}' "$(docker compose ps -q web)")" = "$(docker image inspect --format '{{.Id}}' "$new")"
get /pulsedv/mini-app/ -o "$backup/served-mini.html"
docker compose exec -T web cat /srv/mini-app/index.html > "$backup/expected-mini.html"
cmp "$backup/served-mini.html" "$backup/expected-mini.html"
grep -oE '/pulsedv/mini-app/assets/[A-Za-z0-9_.-]+\.(js|css)' "$backup/served-mini.html" | sort -u > "$backup/assets"
test -s "$backup/assets"
while IFS= read -r asset; do
  get "$asset" -o "$backup/served-asset"
  docker compose exec -T web cat "/srv/${asset#/pulsedv/}" > "$backup/expected-asset"
  cmp "$backup/served-asset" "$backup/expected-asset"
done < "$backup/assets"
get / -o /dev/null
get /ready -o /dev/null
docker image tag "$new" "$(cat "$backup/default-image")"
trap - EXIT INT HUP TERM
echo "Mini App обновлён. Образ для отката: $old"
