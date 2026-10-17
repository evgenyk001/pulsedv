#!/usr/bin/env bash
set -euo pipefail
# Run on a test host after `restic restore <snapshot> --target <directory>`.
# This script only creates/removes a uniquely named disposable container.
: "${1:?Pass directory containing database.dump, media.tgz and SHA256SUMS}"
stage=$(cd "$1" && pwd)
(cd "$stage" && sha256sum -c SHA256SUMS)
tar -tzf "$stage/media.tgz" >/dev/null
container="pulse-restore-check-$(date +%s)-$$"
cleanup(){ docker rm -fv "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
ready=0
for attempt in $(seq 1 60); do
 # initdb starts a temporary server, then stops it. Wait for the final PID 1
 # postgres process as well as its socket, rather than racing that restart.
 if docker exec "$container" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres' >/dev/null 2>&1; then ready=1; break; fi
 sleep 1
done
if (( ! ready )); then docker logs "$container" >&2; echo 'Restore database did not become ready' >&2; exit 1; fi
docker exec "$container" createdb -U postgres pulse_restore
docker exec -i "$container" pg_restore -U postgres -d pulse_restore --no-owner --exit-on-error < "$stage/database.dump"
docker exec "$container" psql -U postgres -d pulse_restore -v ON_ERROR_STOP=1 -c 'select count(*) as migrations from schema_migrations; select count(*) as leads from leads;'
echo 'Database restored in isolated container; media archive and checksums verified.'
