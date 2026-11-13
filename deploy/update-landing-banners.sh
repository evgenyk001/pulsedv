#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
release=${1:?Release commit required}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
exec 9>/var/lock/pulsedv-update.lock
flock -n 9
test "$(git rev-parse HEAD)" = "$(git rev-parse 9ee9632)"
test "$(git rev-parse "$release^")" = "$(git rev-parse HEAD)"
backup=$(mktemp -d /root/pulsedv-web-20261113.XXXXXX)
echo "Резервная копия и журнал: $backup"
mkdir "$backup/build"
web=$(docker compose ps -q web)
test -n "$web"
docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' "$web" > "$backup/mounts"
if grep -Eq '^(/srv/?$|/srv/(index\.html|landing-cinematic|mini-app)(/|$)|/etc/?$|/etc/caddy(/|$))' "$backup/mounts"; then
  echo 'Файлы web перекрыты Docker mount. Выкладка остановлена.'
  exit 1
fi
old="pulsedv-rollback:$(basename "$backup")"
new="pulsedv-release:$(basename "$backup")"
docker image tag "$(docker inspect --format '{{.Image}}' "$web")" "$old"
docker compose config --format json > "$backup/compose.json"
docker cp "$web:/etc/caddy/Caddyfile" "$backup/build/Caddyfile"
git archive "$release" deploy/landing-web deploy/mini-web | tar -x -C "$backup/build"
python3 - "$backup" "$old" "$new" <<'PY'
import base64, hashlib, json, re, sys
from pathlib import Path
folder = Path(sys.argv[1])
compose = json.loads((folder / "compose.json").read_text())
web = compose["services"]["web"]
default = web.get("image") or f"{compose['name']}-web"
if "@" in default or default.startswith("sha256:"):
    raise SystemExit("Compose использует неизменяемый тег web.")
(folder / "default-image").write_text(default)
for name, image in zip(("rollback", "candidate"), sys.argv[2:]):
    config = {"services": {"web": {"image": image, "pull_policy": "never"}}}
    (folder / f"{name}.json").write_text(json.dumps(config))
html = (folder / "build/deploy/landing-web/index.html").read_text()
inline = re.findall(r"<script>(.*?)</script>", html, re.S)
if len(inline) != 1:
    raise SystemExit("Изменился набор встроенных скриптов.")
digest = base64.b64encode(hashlib.sha256(inline[0].encode()).digest()).decode()
path = folder / "build/Caddyfile"
caddy = path.read_text()
if re.search(r"(?m)^\s*@pulseLanding20261113\b", caddy):
    raise SystemExit("Политика уже присутствует в активном образе.")
anchor = re.search(r"(?m)^(?:pulsedv\.ru|\{\$SITE_DOMAIN\})[ \t]*\{[ \t]*$", caddy)
if anchor is None:
    raise SystemExit("Не найден блок pulsedv.ru в активном Caddyfile.")
policy = f"""
    @pulseLanding20261113 path / /index.html
    header @pulseLanding20261113 {{
        X-Frame-Options SAMEORIGIN
        Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'sha256-{digest}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:"
    }}
"""
path.write_text(caddy[:anchor.end()] + "\n" + policy + caddy[anchor.end():])
PY
cat > "$backup/build/Dockerfile" <<DOCKERFILE
FROM $old
COPY deploy/landing-web/ /srv/landing-cinematic/releases/4e2d342/
COPY deploy/landing-web/index.html /srv/index.html
COPY deploy/mini-web/ /srv/mini-app/
COPY Caddyfile /etc/caddy/Caddyfile
DOCKERFILE
docker build -t "$new" "$backup/build"
roll() {
  local mode=$1
  shift
  docker compose --project-directory /opt/pulsedv -f "$backup/compose.json" -f "$backup/$mode.json" "$@"
}
roll candidate run --rm -T --no-deps --entrypoint caddy web validate --config /etc/caddy/Caddyfile --adapter caddyfile
activated=0
recover() {
  local status=$?
  if (( status != 0 && activated == 1 )); then
    roll rollback up -d --no-deps --no-build --force-recreate web || true
  fi
}
trap recover EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
activated=1
roll candidate up -d --no-deps --no-build --force-recreate web
get() {
  curl -fsS --retry 6 --retry-all-errors --retry-delay 1 --max-time 10 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$1" "${@:2}"
}
get / -D "$backup/landing.headers" -o "$backup/served-landing.html"
cmp "$backup/served-landing.html" "$backup/build/deploy/landing-web/index.html"
grep -qi '^content-security-policy:' "$backup/landing.headers"
grep -qi '^x-frame-options: SAMEORIGIN' "$backup/landing.headers"
get /landing-cinematic/releases/4e2d342/share.webp -o "$backup/served-share.webp"
cmp "$backup/served-share.webp" "$backup/build/deploy/landing-web/share.webp"
get /pulsedv/mini-app/ -o "$backup/served-mini.html"
cmp "$backup/served-mini.html" "$backup/build/deploy/mini-web/index.html"
while IFS= read -r asset; do
  get "$asset" -o "$backup/served-asset"
  cmp "$backup/served-asset" "$backup/build/deploy/mini-web/${asset#/pulsedv/mini-app/}"
done < <(grep -oE '/pulsedv/mini-app/assets/[A-Za-z0-9_.-]+\.(js|css)' "$backup/served-mini.html" | sort -u)
get /pulsedv/control-center/ -o /dev/null
get /ready -o /dev/null
docker image tag "$new" "$(cat "$backup/default-image")"
activated=0
echo "Лендинг и Mini App обновлены. Образ для отката: $old"
