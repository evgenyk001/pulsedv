#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
: "${RESTIC_REPOSITORY:?Set an encrypted off-host Restic repository}"
: "${RESTIC_PASSWORD_FILE:?Set the Restic password file path}"
command -v restic >/dev/null
exec 9>/var/lock/pulsedv-backup.lock
flock -n 9 || exit 0
stage=$(mktemp -d)
mapfile -t running < <(docker compose ps --status running --services | grep -E '^(api|worker)$' || true)
resume(){ if ((${#running[@]})); then docker compose start "${running[@]}"; fi; }
cleanup(){ resume; rm -rf "$stage"; }
trap cleanup EXIT
# Pause writers so the database and media are one restorable snapshot.
if ((${#running[@]})); then docker compose stop "${running[@]}"; fi
docker compose exec -T db pg_dump -U pulse -d pulse -Fc > "$stage/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar api -czf - -C /data/media . > "$stage/media.tgz"
resume
running=()
(cd "$stage" && sha256sum database.dump media.tgz > SHA256SUMS)
restic backup --tag pulsedv --host pulsedv "$stage"
restic forget --tag pulsedv --host pulsedv --group-by host,tags --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
restic check
install -d -m 700 /var/lib/pulsedv
date -u +%FT%TZ > /var/lib/pulsedv/backup-success
