#!/usr/bin/env bash
set -euo pipefail
# Run on a test host after `restic restore <snapshot> --target <directory>`.
# This script only creates/removes a uniquely named disposable container.
: "${1:?Pass directory containing database.dump, media.tgz and SHA256SUMS}"
stage=$(cd "$1" && pwd)
(cd "$stage" && sha256sum -c SHA256SUMS)
tar -tzf "$stage/media.tgz" >/dev/null
container="pulse-restore-check-$(date +%s)-$$"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in $(seq 1 30); do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec "$container" createdb -U postgres pulse_restore
docker exec -i "$container" pg_restore -U postgres -d pulse_restore --no-owner --exit-on-error < "$stage/database.dump"
docker exec "$container" psql -U postgres -d pulse_restore -v ON_ERROR_STOP=1 -c 'select count(*) as migrations from schema_migrations; select count(*) as leads from leads;'
echo 'Database restored in isolated container; media archive and checksums verified.'
