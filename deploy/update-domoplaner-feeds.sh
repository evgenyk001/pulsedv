#!/usr/bin/env bash
set -euo pipefail
umask 077

release=${1:?Укажите коммит релиза Domoplaner}
cd /opt/pulsedv
exec 9>/run/lock/pulsedv-domoplaner.lock
flock -n 9
test -f compose.yaml
test -f compose.override.yaml
python3 -c 'import yaml'

work=$(mktemp -d /root/pulsedv-domoplaner.XXXXXX)
trap 'rm -f -- "$work/urls" "$work/input.json" "$work/existing.json" "$work/merged.json" "$work/status.json" "$work/compose.override.next.yaml"' EXIT
override=compose.override.yaml
cp -p "$override" "$work/compose.override.before.yaml"
compose=(docker compose -f compose.yaml -f "$override")
old_worker=$("${compose[@]}" ps -q worker)
test -n "$old_worker"
live_image=$(docker inspect --format '{{.Image}}' "$old_worker")
short=$(git rev-parse --short "$release")
before_image="pulsedv-worker-domoplaner:before-${work##*.}"
new_image="pulsedv-worker-domoplaner:$short"
docker tag "$live_image" "$before_image"

docker cp "$old_worker:/app/backend/src/catalogFeed.ts" "$work/catalogFeed.ts"
for file in domoplanerFeed.ts prepareDomoplanerRelease.ts; do
  git show "$release:backend/src/$file" > "$work/$file"
done
if ! grep -q "from './domoplanerFeed'" "$work/catalogFeed.ts"; then
  git diff -U1 9c073dae078cc043c3b07b929c7b2e64f604a00c "$release" -- backend/src/catalogFeed.ts > "$work/feed.patch"
  (cd "$work" && git apply --check --unsafe-paths -p3 feed.patch && git apply --unsafe-paths -p3 feed.patch)
fi

cat > "$work/Dockerfile" <<'DOCKERFILE'
ARG LIVE_WORKER=alpine:3
FROM ${LIVE_WORKER}
COPY --chmod=0644 catalogFeed.ts domoplanerFeed.ts prepareDomoplanerRelease.ts /app/backend/src/
DOCKERFILE
cat > "$work/.dockerignore" <<'DOCKERIGNORE'
*
!Dockerfile
!catalogFeed.ts
!domoplanerFeed.ts
!prepareDomoplanerRelease.ts
DOCKERIGNORE
docker build --build-arg "LIVE_WORKER=$before_image" -t "$new_image" "$work"

docker inspect "$old_worker" | python3 -c '
import json, sys
env = dict(s.split("=", 1) for s in json.load(sys.stdin)[0]["Config"]["Env"] if "=" in s)
feeds = json.loads(env["PLAN7_APARTMENT_FEEDS"])
if not isinstance(feeds, list) or not feeds or env.get("PLAN7_APARTMENT_FEEDS_ENABLED") != "true":
    sys.exit("Действующие фиды не найдены в запущенном worker")
json.dump(feeds, sys.stdout, ensure_ascii=False)
' > "$work/existing.json"

printf 'Вставляйте ссылки по очереди. Терминал их не показывает.\n'
for project in 'Визионер' 'Каскада' 'Шоколад' 'Гринвуд' 'Гринхилс'; do
  IFS= read -rs -p "$project: " url </dev/tty
  printf '\n'
  printf '%s\n' "$url" >> "$work/urls"
done
unset url
python3 - "$work" <<'PY' > "$work/input.json"
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
json.dump({"existing": json.loads((root / "existing.json").read_text()),
           "urls": [line.strip() for line in (root / "urls").read_text().splitlines()]},
          sys.stdout, ensure_ascii=False)
PY
rm "$work/urls"

python3 - "$work" "$new_image" <<'PY'
import sys, yaml
from pathlib import Path
root = Path(sys.argv[1])
(root / "worker-image.yaml").write_text(yaml.safe_dump({"services": {"worker": {"image": sys.argv[2]}}}))
PY
staged=("${compose[@]}" -f "$work/worker-image.yaml")
"${staged[@]}" run -T --rm --no-deps worker node --import tsx -e '
  const fs = require("node:fs");
  const { join } = require("node:path");
  const root = process.env.MEDIA_ROOT || "/data/media";
  for (const dir of ["domoplaner-plans", "private/domoplaner-plans"]) {
    const path = join(root, dir);
    fs.mkdirSync(path, { recursive: true, mode: dir.startsWith("private") ? 0o700 : 0o755 });
    fs.accessSync(path, fs.constants.W_OK);
  }
  require("sharp");
'
"${staged[@]}" run -T --rm --no-deps worker node --import tsx backend/src/prepareDomoplanerRelease.ts \
  < "$work/input.json" > "$work/merged.json"
rm "$work/input.json" "$work/existing.json"

python3 - "$work" "$new_image" <<'PY'
import json, sys, yaml
from pathlib import Path
root = Path(sys.argv[1])
override = yaml.safe_load((root / "compose.override.before.yaml").read_text()) or {}
worker = override.setdefault("services", {}).setdefault("worker", {})
env = worker.get("environment") or {}
if isinstance(env, list):
    env = {line.split("=", 1)[0]: line.split("=", 1)[1] if "=" in line else None for line in env}
feeds = json.loads((root / "merged.json").read_text())
env = dict(env)
env.update({
    "PLAN7_APARTMENT_FEEDS_ENABLED": "true",
    "PLAN7_APARTMENT_FEEDS": json.dumps(feeds, ensure_ascii=False).replace("$", "$$"),
})
worker.update(image=sys.argv[2], environment=env)
(root / "compose.override.next.yaml").write_text(yaml.safe_dump(override, allow_unicode=True, sort_keys=False))
(root / "status.json").write_text(json.dumps({"existing": feeds}, ensure_ascii=False))
PY
rm "$work/merged.json"
# Validate the full effective Compose configuration without printing secrets.
docker compose -f compose.yaml -f "$work/compose.override.next.yaml" config -q
install -m 0600 "$work/compose.override.next.yaml" "$override.domoplaner-tmp"
mv "$override.domoplaner-tmp" "$override"
rm "$work/compose.override.next.yaml"
if ! "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 100 worker; then
  cp -p "$work/compose.override.before.yaml" "$override.domoplaner-tmp"
  mv "$override.domoplaner-tmp" "$override"
  docker compose -f compose.yaml -f "$override" -f - up -d --no-deps --no-build --pull never worker <<YAML
services:
  worker:
    image: $before_image
YAML
  exit 1
fi

printf 'Worker обновлён. Резервная копия настроек: %s/compose.override.before.yaml\n' "$work"
status() {
  "${compose[@]}" exec -T worker node --import tsx backend/src/prepareDomoplanerRelease.ts --status < "$work/status.json"
}
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if status > "$work/status.txt"; then
    cat "$work/status.txt"
    rm "$work/status.json"
    exit 0
  fi
  sleep 20
done
cat "$work/status.txt"
printf 'Worker работает. Первый импорт ещё не подтверждён по всем ЖК.\n' >&2
rm "$work/status.json"
exit 1
