#!/usr/bin/env bash
# Landing-only installation. Run as root from /opt/pulsedv with an immutable SHA.
set -Eeuo pipefail
umask 077
[[ ${EUID} == 0 ]] || { echo 'Запустите от root'; exit 1; }
TARGET=${1:?Укажите полный SHA релиза}
[[ $TARGET =~ ^[a-f0-9]{40}$ ]] || { echo 'Нужен полный SHA'; exit 1; }
cd /opt/pulsedv
for command in git docker python3 curl flock tar; do command -v "$command" >/dev/null; done
[[ -f compose.yaml && -z ${COMPOSE_FILE:-} ]] || { echo 'Нужен стандартный compose.yaml без COMPOSE_FILE'; exit 1; }
for name in compose.override.yml docker-compose.override.yml docker-compose.override.yaml; do
  [[ ! -e $name ]] || { echo "Нестандартный override $name: требуется адаптация установщика"; exit 1; }
done
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Другое обновление уже выполняется'; exit 1; }
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
RELEASE=${TARGET:0:12}-$STAMP
BACKUP=/root/pulsedv-landing-backup-$RELEASE
PUBLIC=/opt/pulsedv-landing/public
mkdir -m 700 "$BACKUP"
DC=(docker compose --project-directory /opt/pulsedv --project-name pulsedv)
"${DC[@]}" config --format json > "$BACKUP/before.json"
WEB=$("${DC[@]}" ps -q web)
[[ -n $WEB ]] || { echo 'Контейнер web не найден'; exit 1; }
docker cp "$WEB:/srv/index.html" "$BACKUP/old-index.html"
TRACKER=()
if docker cp "$WEB:/srv/acquisition.js" "$BACKUP/acquisition.js" 2>/dev/null; then TRACKER=(--tracker "$BACKUP/acquisition.js"); fi
"${DC[@]}" ps -q api worker db > "$BACKUP/other-containers"
curl --fail --silent --show-error --max-time 15 --resolve pulsedv.ru:443:127.0.0.1 https://pulsedv.ru/ready > "$BACKUP/ready-before.json"
python3 - "$BACKUP/ready-before.json" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['status']=='ready', 'API is not ready before deployment'
PY
mkdir "$BACKUP/source"
git fetch origin "$TARGET"
git archive "$TARGET" design/landing-dual-entry deploy/prepare-landing.py | tar -x -C "$BACKUP/source"
HELPER=$BACKUP/source/deploy/prepare-landing.py
OVERRIDE=/opt/pulsedv/compose.override.yaml
if [[ -e $OVERRIDE ]]; then cp -a "$OVERRIDE" "$BACKUP/override.original"; fi
python3 "$HELPER" override "$OVERRIDE" "$BACKUP/override.next"
mkdir -p "$PUBLIC/releases"
chmod 755 /opt/pulsedv-landing "$PUBLIC" "$PUBLIC/releases"
[[ ! -e $PUBLIC/current || -L $PUBLIC/current ]] || { echo 'current должен быть симлинком'; exit 1; }
readlink "$PUBLIC/current" > "$BACKUP/previous-current" || true
python3 "$HELPER" prepare --source "$BACKUP/source/design/landing-dual-entry" --destination "$PUBLIC/releases/$RELEASE" --current "$BACKUP/old-index.html" --release "$RELEASE" --manifest "$BACKUP/manifest.json" "${TRACKER[@]}"
find "$PUBLIC/releases/$RELEASE" -type d -exec chmod 755 {} +
find "$PUBLIC/releases/$RELEASE" -type f -exec chmod 644 {} +
SNAPSHOT=pulsedv-landing-backup:${RELEASE,,}
docker commit --pause=false "$WEB" "$SNAPSHOT" > "$BACKUP/image-id"
python3 - "$BACKUP" "$SNAPSHOT" <<'PY'
import json,sys
from pathlib import Path
root=Path(sys.argv[1])
image={'services':{'web':{'image':sys.argv[2],'pull_policy':'never'}}}
(root/'image.json').write_text(json.dumps(image))
PY
# Backup includes effective Compose (private environment), original override and image.
cat > "$BACKUP/rollback.sh" <<ROLLBACK
#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/pulsedv
if [[ -f '$BACKUP/override.original' ]]; then cp -a '$BACKUP/override.original' '$OVERRIDE'; else rm -f '$OVERRIDE'; fi
PREVIOUS=\$(cat '$BACKUP/previous-current')
if [[ -n \$PREVIOUS ]]; then ln -sfn "\$PREVIOUS" '$PUBLIC/current'; else rm -f '$PUBLIC/current'; fi
docker compose --project-directory /opt/pulsedv --project-name pulsedv -f '$BACKUP/before.json' -f '$BACKUP/image.json' up -d --no-deps --no-build --force-recreate web
ROLLBACK
chmod 700 "$BACKUP/rollback.sh"
rollback_on_error() {
  code=$?
  trap - ERR HUP INT TERM
  echo 'Проверка не прошла. Возвращаю предыдущий web…'
  bash "$BACKUP/rollback.sh" || echo "Автооткат не завершён: bash $BACKUP/rollback.sh"
  exit "$code"
}
trap rollback_on_error ERR
trap '(exit 129); rollback_on_error' HUP
trap '(exit 130); rollback_on_error' INT
trap '(exit 143); rollback_on_error' TERM
cp "$BACKUP/override.next" "$OVERRIDE"
ln -sfn "releases/$RELEASE" "$PUBLIC/current"
"${DC[@]}" config --format json > "$BACKUP/after.json"
python3 "$HELPER" verify-config "$BACKUP/before.json" "$BACKUP/after.json"
"${DC[@]}" -f "$BACKUP/after.json" -f "$BACKUP/image.json" up -d --no-deps --no-build --force-recreate web
# HTTPS and byte-level checks; no server credentials printed.
python3 - "$PUBLIC/releases/$RELEASE" "$BACKUP/manifest.json" "$RELEASE" <<'PY'
import hashlib,json,subprocess,sys,time
from pathlib import Path
root=Path(sys.argv[1]); manifest=json.load(open(sys.argv[2])); release=sys.argv[3]
def fetch(path):
    return subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','12','--resolve','pulsedv.ru:443:127.0.0.1','https://pulsedv.ru'+path],stderr=subprocess.DEVNULL)
for attempt in range(15):
    try:
        assert fetch('/')==(root/'index.html').read_bytes()
        assert json.loads(fetch('/ready'))['status']=='ready'
        break
    except (subprocess.CalledProcessError,AssertionError,ValueError):
        if attempt==14: raise
        time.sleep(2)
for name,digest in manifest.items():
    assert hashlib.sha256(fetch('/landing-cinematic/releases/'+release+'/'+name)).hexdigest()==digest, name
print('HTML, API и все файлы релиза проверены по HTTPS.')
PY
"${DC[@]}" ps -q api worker db > "$BACKUP/other-containers-after"
cmp "$BACKUP/other-containers" "$BACKUP/other-containers-after"
trap - ERR HUP INT TERM
echo "Лендинг обновлён: $RELEASE"
echo "Откат: bash $BACKUP/rollback.sh"
echo 'PWA: Скоро. Telegram активен. Ветка приложения и база не изменены.'
