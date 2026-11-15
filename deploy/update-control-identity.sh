#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
release=${1:?Укажите SHA релиза}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
exec 9>/var/lock/pulsedv-update.lock
flock -n 9
work=$(mktemp -d /root/pulsedv-control-identity.XXXXXX)
echo "Материалы обновления CRM: $work"
mkdir "$work/build"
git archive "$release" package.json package-lock.json apps/control-center apps/mini-app/package.json backend/package.json packages dist | tar -x -C "$work/build"
docker compose config --format json > "$work/compose.json"
container=$(docker compose ps -q web)
test -n "$container"
previous="pulsedv-control-base:${work##*/}"
candidate="pulsedv-control-release:${work##*/}"
docker image tag "$(docker inspect --format '{{.Image}}' "$container")" "$previous"
cat > "$work/build/Dockerfile" <<'DOCKER'
ARG LIVE_WEB
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY apps/mini-app/package.json apps/mini-app/package.json
COPY apps/control-center/package.json apps/control-center/package.json
RUN npm ci --no-audit --no-fund
COPY apps/control-center apps/control-center
COPY packages packages
COPY dist dist
ENV VITE_PULSE_MODE=api VITE_API_BASE_URL=/api/v1
RUN npm run build -w apps/control-center
FROM ${LIVE_WEB}
COPY --from=build /app/dist/control-center/ /srv/control-center/
DOCKER
docker build --build-arg "LIVE_WEB=$previous" -t "$candidate" "$work/build"
python3 - "$work" "$previous" "$candidate" <<'PY'
import json, sys
from pathlib import Path
folder = Path(sys.argv[1])
config = json.loads((folder / 'compose.json').read_text())
ref = config['services']['web'].get('image') or config['name'] + '-web'
if '@' in ref or ref.startswith('sha256:'):
    raise SystemExit('В Compose закреплён неизменяемый образ web')
(folder / 'image-ref').write_text(ref + '\n')
for name, image in zip(('previous', 'candidate'), sys.argv[2:]):
    (folder / (name+'.json')).write_text(json.dumps({'services':{'web':{'image': image, 'pull_policy':'never'}}}))
PY
compose_release(){
 local revision=$1
 shift
 docker compose --project-directory /opt/pulsedv -f "$work/compose.json" -f "$work/$revision.json" "$@"
}
activated=0
cleanup(){
 local result=$?
 if (( result != 0 && activated )); then
  compose_release previous up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 web || true
 fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
compose_release candidate run --rm -T --no-deps --entrypoint caddy web validate --config /etc/caddy/Caddyfile --adapter caddyfile
activated=1
compose_release candidate up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 web
container=$(docker compose ps -q web)
test "$(docker inspect --format '{{.Image}}' "$container")" = "$(docker image inspect --format '{{.Id}}' "$candidate")"
docker exec "$container" cat /srv/control-center/index.html > "$work/expected.html"
get(){ curl -fsS --retry 5 --retry-all-errors --max-time 15 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$1" -o "$2"; }
get /pulsedv/control-center/ "$work/served.html"
cmp "$work/expected.html" "$work/served.html"
python3 - "$work/expected.html" > "$work/assets.txt" <<'PY'
import re, sys
from pathlib import Path
assets = re.findall(r'(?:src|href)="(/pulsedv/control-center/assets/[^"]+\.(?:js|css))"', Path(sys.argv[1]).read_text())
assert any(asset.endswith('.js') for asset in assets)
assert any(asset.endswith('.css') for asset in assets)
print('\n'.join(dict.fromkeys(assets)))
PY
while IFS= read -r asset; do
 get "$asset" "$work/served-asset"
 docker exec "$container" cat "/srv/${asset#/pulsedv/}" | cmp - "$work/served-asset"
done < "$work/assets.txt"
get /ready "$work/ready.json"
docker image tag "$candidate" "$(cat "$work/image-ref")"
activated=0
echo 'PULSE Control готов'
