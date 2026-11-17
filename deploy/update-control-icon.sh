#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
release=${1:?Укажите SHA релиза}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
exec 9>/var/lock/pulsedv-update.lock
flock -n 9

work=$(mktemp -d /root/pulsedv-control-icon.XXXXXX)
container=$(docker compose ps -q web)
test -n "$container"
previous="pulsedv-control-icon-base:${work##*.}"
candidate="pulsedv-control-icon-release:${work##*.}"
docker image tag "$(docker inspect --format '{{.Image}}' "$container")" "$previous"
docker compose config --format json > "$work/compose.json"
mkdir -p "$work/build/static"
for file in pulse-control.ico pulse-control-32.png pulse-control-180.png; do
  git show "$release:apps/control-center/public/$file" > "$work/build/static/$file"
done
docker exec "$container" cat /srv/control-center/index.html > "$work/previous.html"
python3 - "$work" "$previous" "$candidate" <<'PY'
import json, re, sys
from pathlib import Path

folder = Path(sys.argv[1])
html = (folder / 'previous.html').read_text()
for old, new in [('pulse-mark-v2.ico', 'pulse-control.ico'),
                 ('pulse-mark-32-v2.png', 'pulse-control-32.png'),
                 ('pulse-mark-180-v2.png', 'pulse-control-180.png')]:
    pattern = r'(<link\b[^>]*\bhref="/pulsedv/control-center/)' + re.escape(old) + r'(")'
    html, count = re.subn(pattern, lambda match: match[1] + new + match[2], html)
    if not count and f'href="/pulsedv/control-center/{new}"' not in html:
        raise SystemExit(f'Не найдена ожидаемая ссылка на иконку {old}.')
(folder / 'build/static/index.html').write_text(html)
config = json.loads((folder / 'compose.json').read_text())
ref = config['services']['web'].get('image') or config['name'] + '-web'
if '@' in ref or ref.startswith('sha256:'):
    raise SystemExit('В Compose закреплён неизменяемый образ web')
(folder / 'image-ref').write_text(ref)
for name, image in zip(('previous', 'candidate'), sys.argv[2:]):
    (folder / (name + '.json')).write_text(json.dumps({'services': {'web': {'image': image, 'pull_policy': 'never'}}}))
PY
cat > "$work/build/Dockerfile" <<'DOCKER'
ARG LIVE_WEB
FROM ${LIVE_WEB}
COPY --chmod=644 static/ /srv/control-center/
DOCKER
docker build --build-arg "LIVE_WEB=$previous" -t "$candidate" "$work/build"
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
  echo "Материалы выкладки: $work"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
activated=1
compose_release candidate up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 web
for file in index.html pulse-control.ico pulse-control-32.png pulse-control-180.png; do
  url="/pulsedv/control-center/$file"
  if [[ "$file" == index.html ]]; then url=/pulsedv/control-center/; fi
  curl -fsS --retry 4 --retry-all-errors --max-time 15 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$url" -o "$work/served"
  cmp "$work/build/static/$file" "$work/served"
done
docker image tag "$candidate" "$(cat "$work/image-ref")"
activated=0
echo 'Новая иконка PULSE Control установлена.'
