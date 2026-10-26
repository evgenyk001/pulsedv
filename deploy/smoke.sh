#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
# A unique project plus loopback-only random port; never touches production volumes.
stage=$(mktemp -d)
export COMPOSE_PROJECT_NAME="pulse-smoke-$(date +%s)-$$"
export COMPOSE_FILE="compose.yaml:deploy/compose.smoke.yaml"
export SITE_DOMAIN=localhost
export POSTGRES_PASSWORD
POSTGRES_PASSWORD=$(openssl rand -hex 24)
# Native Telegram registration is tested by account-registration.test.ts; this probe exercises anonymous CRM fixtures.
export REQUIRE_TELEGRAM_PHONE=false
export BOT_TOKEN= MAP_YANDEX_KEY= MAP_2GIS_KEY= PARTNER_OFFER_PUBLISHED=false PARTNER_OFFER_APPROVED_VERSION=
export OWNER_EMAIL=owner@smoke.test OWNER_PASSWORD
OWNER_PASSWORD=$(openssl rand -hex 24)
compose(){ docker compose --env-file "$stage/empty.env" "$@"; }
touch "$stage/empty.env"
cleanup(){ code=$?; trap - EXIT; if ((code)); then compose logs --tail=60; fi; compose down -v --remove-orphans >/dev/null; rm -rf "$stage"; exit "$code"; }
trap cleanup EXIT
compose up -d --wait db
compose run --rm --no-deps api node --import tsx backend/src/migrate.ts
# Running twice checks migration bookkeeping on an existing database.
compose run --rm --no-deps api node --import tsx backend/src/migrate.ts
compose run --rm --no-deps -e OWNER_EMAIL -e OWNER_PASSWORD api node --import tsx backend/src/bootstrap.ts
compose up -d --no-build --wait --wait-timeout 180
export PULSE_SMOKE_URL="https://$(compose port web 443)"
export PULSE_SMOKE_STATE_FILE="$stage/state.json"
smoke_port=${PULSE_SMOKE_URL##*:}
for attempt in $(seq 1 30); do
 if curl --insecure --fail --silent --resolve "localhost:$smoke_port:127.0.0.1" "https://localhost:$smoke_port/ready" >/dev/null; then break; fi
 sleep 1
done
node --import tsx backend/src/deploymentProbe.ts seed
compose restart db api worker
compose up -d --no-build --wait --wait-timeout 180
node --import tsx backend/src/deploymentProbe.ts verify
# Consistent dump + media snapshot, then actual pg_restore in a disposable container.
compose stop api worker
compose exec -T db pg_dump -U pulse -d pulse -Fc > "$stage/database.dump"
compose run --rm --no-deps -T --entrypoint tar api -czf - -C /data/media . > "$stage/media.tgz"
(cd "$stage" && sha256sum database.dump media.tgz > SHA256SUMS)
bash deploy/restore-check.sh "$stage"
echo 'VPS Compose smoke and isolated restore passed'
