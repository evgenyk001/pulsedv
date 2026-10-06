#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
failed=0
for service in db api worker web; do
 id=$(docker compose ps -q "$service")
 if [[ -z "$id" ]]; then echo "CRITICAL: $service absent" >&2; failed=1; continue; fi
 status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")
 if [[ "$status" != healthy && "$status" != running ]]; then echo "CRITICAL: $service $status" >&2; failed=1; fi
done
if [[ ! -f /var/lib/pulsedv/backup-success ]] || (( $(date +%s)-$(stat -c %Y /var/lib/pulsedv/backup-success) > 93600 )); then
 echo 'CRITICAL: no successful backup in 26 hours' >&2; failed=1
fi
stuck=$(docker compose exec -T db psql -U pulse -d pulse -Atqc "select count(*) from outbox_events where topic<>'manager.security_code' and processed_at is null and (dead_at is not null or created_at<now()-interval '15 minutes')")
if ((stuck>0)); then echo "WARNING: $stuck old or failed notifications" >&2; failed=1; fi
if ! docker compose exec -T api node -e "const f=require('fs').statfsSync('/data/media');process.exit(f.bavail*f.bsize>=1024**3?0:1)"; then
 echo 'CRITICAL: less than 1 GiB free on media volume' >&2; failed=1
fi
if ((failed)); then exit 1; fi
# Optional external dead-man switch: the monitor reports success only if every check passed.
if [[ -n "${HEALTHCHECK_URL:-}" ]]; then curl --fail --silent --show-error --max-time 10 "$HEALTHCHECK_URL" >/dev/null; fi
echo 'PULSE operational checks passed'
