#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd /opt/pulsedv

release=${1:?Укажите коммит релиза}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
exec 9>/var/lock/pulsedv-update.lock
flock -n 9

work=$(mktemp -d /root/pulsedv-landing-entry.XXXXXX)
git show "$release:deploy/landing-web/index.html" > "$work/index.html"
grep -Fq 'class="entry-button entry-pwa" href="https://pulsedv.ru/app/"' "$work/index.html"

web=$(docker compose ps -q web)
entry=/opt/pulsedv-landing/public/current/index.html
docker inspect --format '{{range .Mounts}}{{println .Type .Source .Destination}}{{end}}' "$web" |
  grep -Fx "bind $entry /srv/index.html"
target=$(realpath -e "$entry")
[[ "$target" == /opt/pulsedv-landing/public/* ]]
docker exec "$web" cat /srv/index.html > "$work/previous.html"
cmp "$target" "$work/previous.html"

get() {
  curl -fsS --retry 4 --retry-all-errors --max-time 10 \
    --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$1" "${@:2}"
}

if cmp -s "$work/index.html" "$work/previous.html"; then
  get / -o "$work/served.html"
  cmp "$work/index.html" "$work/served.html"
  echo 'Лендинг уже обновлён.'
  exit 0
fi
if [[ "$(git hash-object "$target")" != 32e2fae6d74fbc5a2fadb1cf23b0bcd63eaad345 ]]; then
  echo 'Боевой HTML изменился. Обновление остановлено.'
  exit 1
fi

docker compose config --format json > "$work/compose.json"
image=$(python3 - "$work/compose.json" <<'PY'
import json, sys
with open(sys.argv[1]) as config_file:
    config = json.load(config_file)
print(config["services"]["web"].get("image") or config["name"] + "-web")
PY
)
running_image=$(docker inspect --format '{{.Image}}' "$web")
test "$(docker image inspect --format '{{.Id}}' "$image")" = "$running_image"

replace_index() {
  local temporary
  temporary=$(mktemp "${target}.XXXXXX")
  if cp -p "$target" "$temporary" && cat "$1" > "$temporary" && mv -fT "$temporary" "$target"; then
    return
  fi
  rm -f -- "$temporary"
  return 1
}
restart_web() {
  docker compose up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 90 web
}
activated=0
recover() {
  local result=$?
  if (( result != 0 && activated )); then
    echo "Возвращаем прежний лендинг. Резервная копия: $work"
    if ! replace_index "$work/previous.html" || ! restart_web; then
      echo 'Автоматический откат не завершился.'
    fi
  fi
}
trap recover EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
activated=1
replace_index "$work/index.html"
restart_web
test "$(docker inspect --format '{{.Image}}' "$(docker compose ps -q web)")" = "$running_image"

get / -D "$work/headers" -o "$work/served.html"
cmp "$work/index.html" "$work/served.html"
grep -qi '^content-security-policy:' "$work/headers"
for route in /app/ /pulsedv/mini-app/ /pulsedv/control-center/ /ready; do
  get "$route" -o /dev/null
done
activated=0
echo "Лендинг обновлён: https://pulsedv.ru/ (резервная копия: $work)"
