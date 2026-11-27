#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/pulsedv
release=${1:?Укажите коммит исправления}
exec 9>/run/lock/pulsedv-domoplaner.lock
flock -n 9
override=compose.override.yaml
compose=(docker compose -f compose.yaml -f "$override")
worker=$("${compose[@]}" ps -q worker)
test -n "$worker"
work=$(mktemp -d /root/pulsedv-greenwood.XXXXXX)
cp -p "$override" "$work/compose.override.before.yaml"
docker tag "$(docker inspect --format '{{.Image}}' "$worker")" "pulsedv-greenwood:before-${work##*.}"
before="pulsedv-greenwood:before-${work##*.}"
image="pulsedv-greenwood:$(git rev-parse --short "$release")"
mkdir "$work/build"
git show "$release:backend/src/domoplanerFeed.ts" > "$work/build/domoplanerFeed.ts"
cat > "$work/build/Dockerfile" <<'DOCKERFILE'
ARG BASE=alpine:3
FROM ${BASE}
COPY --chmod=0644 domoplanerFeed.ts /app/backend/src/domoplanerFeed.ts
DOCKERFILE
docker build --build-arg "BASE=$before" -t "$image" "$work/build"
docker run --rm --entrypoint node "$image" --import tsx --input-type=module -e '
  const module = await import("./backend/src/domoplanerFeed.ts");
  if (typeof module.cacheDomoplanerPlans !== "function") process.exit(1);
'
python3 - "$work" "$image" <<'PY'
import sys, yaml
from pathlib import Path
work = Path(sys.argv[1])
cfg = yaml.safe_load((work / "compose.override.before.yaml").read_text())
cfg["services"]["worker"]["image"] = sys.argv[2]
(work / "compose.override.next.yaml").write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False))
PY
docker compose -f compose.yaml -f "$work/compose.override.next.yaml" config -q
install -m 0600 "$work/compose.override.next.yaml" "$override.greenwood-tmp"
mv "$override.greenwood-tmp" "$override"
rm "$work/compose.override.next.yaml"
if ! "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 100 worker; then
  cp -p "$work/compose.override.before.yaml" "$override.greenwood-tmp"
  mv "$override.greenwood-tmp" "$override"
  docker compose -f compose.yaml -f "$override" -f - up -d --no-deps --no-build --pull never worker <<YAML
services:
  worker:
    image: $before
YAML
  exit 1
fi
printf 'Worker обновлён. Резервная копия: %s/compose.override.before.yaml\n' "$work"
