#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
release=${1:?Укажите SHA релиза}
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
exec 9>/var/lock/pulsedv-update.lock
flock -n 9
backup=$(mktemp -d /root/pulsedv-pwa-backend.XXXXXX)
echo "Журнал и резервная копия: $backup"
mkdir "$backup/build"
git archive "$release" backend packages deploy/Dockerfile.api package.json package-lock.json apps/mini-app/package.json apps/control-center/package.json | tar -x -C "$backup/build"
docker compose config --format json > "$backup/compose.json"
for service in api worker; do
  container=$(docker compose ps -q "$service")
  test -n "$container"
  docker image tag "$(docker inspect --format '{{.Image}}' "$container")" "pulsedv-rollback:${backup##*/}-$service"
done
image="pulsedv-release:${backup##*/}"
python3 - "$backup" "$image" <<'PY'
import json, sys
from pathlib import Path
folder = Path(sys.argv[1])
original = json.loads((folder / 'compose.json').read_text())
refs = {}
new = {}
old = {}
for service in ('api', 'worker'):
    spec = original['services'][service]
    refs[service] = spec.get('image') or f"{original['name']}-{service}"
    if '@' in refs[service] or refs[service].startswith('sha256:'):
        raise SystemExit('Нужна сверка закреплённого образа ' + service)
    new[service] = {'image': sys.argv[2], 'pull_policy': 'never', 'environment': {'PWA_CALL_LOGIN': 'false', 'PWA_SMS_LOGIN': 'false'}}
    old[service] = {'image': f'pulsedv-rollback:{folder.name}-{service}', 'pull_policy': 'never'}
for name, spec in [('candidate', new), ('rollback', old)]:
    (folder / f'{name}.json').write_text(json.dumps({'services': spec}))
(folder / 'image-refs').write_text('\n'.join(dict.fromkeys(refs.values()))+'\n')
PY
roll() {
  local mode=$1
  shift
  docker compose --project-directory /opt/pulsedv -f "$backup/compose.json" -f "$backup/$mode.json" "$@"
}
docker build -t "$image" -f "$backup/build/deploy/Dockerfile.api" "$backup/build"
roll candidate run --rm -T --no-deps api node --import tsx backend/src/preflight.ts
scratch_db="pulse_pwa_check_$$"
scratch_created=0
rollback=0
cleanup() {
  local status=$?
  if (( scratch_created )); then docker compose exec -T db dropdb -U pulse --if-exists "$scratch_db" || true; fi
  if (( status != 0 && rollback )); then
    echo "Возвращаем прежние API и worker. Резервная копия: $backup"
    roll rollback up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 api worker || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
docker compose exec -T db pg_dump -U pulse -d pulse -Fc > "$backup/rehearsal.dump"
docker compose exec -T db createdb -U pulse "$scratch_db"
scratch_created=1
docker compose exec -T db pg_restore -U pulse -d "$scratch_db" --exit-on-error --no-owner --no-privileges < "$backup/rehearsal.dump"
roll candidate run --rm -T --no-deps -e "PULSE_TEST_DATABASE=$scratch_db" api node --import tsx --input-type=module -e '
const url=new URL(process.env.DATABASE_URL);
url.pathname="/"+process.env.PULSE_TEST_DATABASE;
process.env.DATABASE_URL=url.href;
const {migrate}=await import("./backend/src/migrate.ts");
const {postgresDatabase}=await import("./backend/src/database.ts");
const db=postgresDatabase(url.href);
try{await migrate(db)}finally{await db.close()}
'
docker compose exec -T db dropdb -U pulse "$scratch_db"
scratch_created=0
rm "$backup/rehearsal.dump"
rollback=1
docker compose stop worker api
docker compose exec -T db pg_dump -U pulse -d pulse -Fc > "$backup/database.dump"
docker compose exec -T db pg_restore -l < "$backup/database.dump" >/dev/null
roll candidate run --rm -T --no-deps api node --import tsx backend/src/migrate.ts
roll candidate up -d --force-recreate --no-deps --no-build --wait --wait-timeout 180 api worker
for path in /ready /api/v1/public/state /api/v1/public/catalog /api/v1/public/pwa; do
  curl -fsS --retry 3 --max-time 20 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$path" -o "$backup/response.json"
done
python3 - "$backup/response.json" <<'PY'
import json, sys
with open(sys.argv[1]) as response:
    if json.load(response).get('phoneLogin') is not False:
        raise SystemExit('Ожидалось, что вход по телефону выключен')
PY
while IFS= read -r ref; do docker image tag "$image" "$ref"; done < "$backup/image-refs"
rollback=0
echo "PWA API готов. Вход по телефону выключен. Резервная копия: $backup"
