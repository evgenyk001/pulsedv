#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
release=${1:?Укажите SHA релиза}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
exec 9>/var/lock/pulsedv-update.lock
flock -n 9
work=$(mktemp -d /root/pulsedv-pwa-production-identity.XXXXXX)
echo "Материалы выпуска PWA: $work"
mkdir "$work/build"
git archive "$release" package.json package-lock.json apps/control-center apps/mini-app backend/package.json packages dist | tar -x -C "$work/build"
docker compose config --format json > "$work/compose.json"
container=$(docker compose ps -q web)
test -n "$container"
previous="pulsedv-pwa-production-base:${work##*/}"
candidate="pulsedv-pwa-production-release:${work##*/}"
docker exec "$container" cat /etc/caddy/Caddyfile > "$work/Caddyfile.previous"
python3 - "$work/Caddyfile.previous" "$work/build/Caddyfile" <<'PY'
import re, sys
from pathlib import Path

original, destination = map(Path, sys.argv[1:])
config = original.read_text()
route = re.compile(r'(?m)^[ \t]*handle_path[ \t]+/app/\*[ \t]*\{')
if not route.search(config):
    headers = list(re.finditer(
        r'(?m)^(?:\{\$SITE_DOMAIN(?::[^}\n]+)?\}|(?:https://)?pulsedv\.ru)[ \t]+\{[ \t]*(?:#.*)?$',
        config,
    ))
    if len(headers) != 1:
        raise SystemExit('Не удалось однозначно найти блок pulsedv.ru в живом Caddyfile.')
    end = headers[0].end()
    app = """
	redir /app /app/ 308
	handle_path /app/* {
		root * /srv/pwa
		@productionPwaEntry path / /index.html /sw.js /manifest.webmanifest /app-release.json /offline.html /offline.js
		header @productionPwaEntry Cache-Control "no-store"
		file_server
	}
"""
    config = config[:end] + '\n' + app + config[end:]
destination.write_text(config)
PY
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
COPY apps/mini-app apps/mini-app
COPY apps/control-center apps/control-center
COPY packages packages
COPY dist dist
ENV VITE_PULSE_MODE=api VITE_API_BASE_URL=/api/v1
RUN npm run build -w apps/mini-app && npm run build -w apps/control-center
RUN VITE_APP_VARIANT=pwa VITE_PWA_PREVIEW=false npm run build -w apps/mini-app
FROM ${LIVE_WEB}
COPY --from=build /app/dist/pwa/ /srv/pwa/
COPY --from=build /app/dist/mini-app/ /srv/mini-app/
COPY --from=build /app/dist/control-center/ /srv/control-center/
COPY Caddyfile /etc/caddy/Caddyfile
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
compose_release candidate run --rm -T --no-deps --entrypoint cat web /etc/caddy/Caddyfile | cmp "$work/build/Caddyfile" -
compose_release candidate run --rm -T --no-deps --entrypoint caddy web validate --config /etc/caddy/Caddyfile --adapter caddyfile
activated=1
compose_release candidate up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 web
container=$(docker compose ps -q web)
test "$(docker inspect --format '{{.Image}}' "$container")" = "$(docker image inspect --format '{{.Id}}' "$candidate")"
get(){ curl -fsS --retry 4 --retry-all-errors --max-time 15 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$1" -o "$2"; }
for file in index.html manifest.webmanifest app-release.json sw.js; do
  docker exec "$container" cat "/srv/pwa/$file" > "$work/$file"
  url="/app/$file"
  if [[ "$file" == index.html ]]; then url=/app/; fi
  get "$url" "$work/served"
  cmp "$work/$file" "$work/served"
done
python3 - "$work" > "$work/assets.txt" <<'PY'
import json, re, sys
from pathlib import Path
folder = Path(sys.argv[1])
manifest = json.loads((folder / 'manifest.webmanifest').read_text())
assert all(manifest[k] == '/app/' for k in ('id', 'scope', 'start_url'))
release = json.loads((folder / 'app-release.json').read_text())
assert re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', release['version'])
assert re.fullmatch(r'[a-f0-9]{16}', release['build'])
assert release['build'] in (folder / 'sw.js').read_text()
assets = re.findall(r'(?:src|href)="(/app/assets/[^"]+\.(?:js|css))"', (folder / 'index.html').read_text())
assert any(a.endswith('.js') for a in assets) and any(a.endswith('.css') for a in assets)
print('\n'.join(dict.fromkeys(assets)))
PY
while IFS= read -r asset; do
  get "$asset" "$work/served"
  docker exec "$container" cat "/srv/pwa/${asset#/app/}" | cmp - "$work/served"
done < "$work/assets.txt"
for url in /ready /api/v1/public/pwa /pulsedv/control-center/ /pulsedv/mini-app/ /landing-cinematic/pwa-preview/app-release.json; do
  get "$url" "$work/served"
done
docker image tag "$candidate" "$(cat "$work/image-ref")"
activated=0
echo 'Публичная PWA готова: https://pulsedv.ru/app/'
