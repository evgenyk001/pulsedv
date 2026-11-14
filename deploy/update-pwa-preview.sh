#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
release=${1:?Release commit required}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
exec 9>/var/lock/pulsedv-update.lock
flock -n 9
public=/opt/pulsedv-landing/public
target="$public/pwa-preview"
web=$(docker compose ps -q web)
test -n "$web"
docker inspect --format '{{range .Mounts}}{{println .Type .Source .Destination}}{{end}}' "$web" |
  grep -Fx "bind $public /srv/landing-cinematic"
work=$(mktemp -d /root/pulsedv-pwa-preview.XXXXXX)
stage=''
container=''
published=0
previous=''
cleanup() {
  local code=$?
  if [[ -n "$container" ]]; then docker rm -f "$container" >/dev/null || true; fi
  if [[ -n "$stage" ]]; then rm -rf -- "$stage"; fi
  if (( code != 0 )); then
    if (( published == 1 )); then mv -T "$target" "$work/failed-preview"; fi
    if [[ -n "$previous" ]]; then mv -T "$previous" "$target"; fi
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
git archive "$release" package.json package-lock.json apps/mini-app apps/control-center/package.json backend/package.json packages dist | tar -x -C "$work"
cat > "$work/Dockerfile" <<'DOCKERFILE'
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/mini-app/package.json apps/mini-app/package.json
COPY apps/control-center/package.json apps/control-center/package.json
COPY backend/package.json backend/package.json
RUN npm ci --no-audit --no-fund
COPY apps/mini-app apps/mini-app
COPY packages packages
COPY dist dist
ENV VITE_APP_VARIANT=pwa VITE_PWA_PREVIEW=true VITE_PULSE_MODE=api VITE_API_BASE_URL=/api/v1
RUN npm run build -w apps/mini-app
DOCKERFILE
image="pulsedv-pwa-preview:${release:0:12}"
docker build -t "$image" "$work"
container=$(docker create "$image")
stage=$(mktemp -d "$public/.pwa-preview.XXXXXX")
docker cp "$container:/app/dist/pwa-preview/." "$stage/"
chmod -R a+rX "$stage"
test -s "$stage/index.html"
test -s "$stage/sw.js"
printf '%s\n' "$release" > "$stage/release.txt"
python3 - "$stage" <<'PY'
import json, re, sys
from pathlib import Path
directory = Path(sys.argv[1])
base = '/landing-cinematic/pwa-preview/'
manifest = json.loads((directory / 'manifest.webmanifest').read_text())
assert all(manifest[key] == base for key in ('id', 'scope', 'start_url'))
html = (directory / 'index.html').read_text()
assert 'noindex,nofollow' in html
assets = re.findall(r'(?:href|src)="(' + re.escape(base) + r'assets/[^"]+)"', html)
assert any(asset.endswith('.js') for asset in assets)
assert any(asset.endswith('.css') for asset in assets)
assert all((directory / asset.removeprefix(base)).is_file() for asset in assets)
(directory / '.preview-check-assets').write_text('\n'.join(assets))
PY
if [[ -e "$target" ]]; then
  previous=$(mktemp -d "/opt/pulsedv-landing/.previous-pwa-preview.XXXXXX")
  mv -T "$target" "$previous"
fi
mv -T "$stage" "$target"
stage=''
published=1
url=https://pulsedv.ru/landing-cinematic/pwa-preview/
get() { curl -fsS --retry 3 --max-time 15 --resolve pulsedv.ru:443:127.0.0.1 "$1" -o "$work/response"; }
get https://pulsedv.ru/api/v1/public/state
get https://pulsedv.ru/api/v1/public/catalog
for file in index.html manifest.webmanifest sw.js release.txt; do
  path="$file"
  if [[ "$file" == index.html ]]; then path=''; fi
  get "$url$path"
  cmp "$target/$file" "$work/response"
done
while IFS= read -r asset; do
  get "https://pulsedv.ru$asset"
  cmp "$target/${asset#/landing-cinematic/pwa-preview/}" "$work/response"
done < <(cat "$target/.preview-check-assets"; echo)
rm "$target/.preview-check-assets"
echo "PWA Preview готов: $url"
