# Production landing only

Run `update-landing-only.sh FULL_40_CHARACTER_SHA` as root from `/opt/pulsedv`.
The target commit must contain this script, `prepare-landing.py` and the reviewed
`design/landing-dual-entry` directory. The script fetches the target without
checking it out or modifying tracked server sources.

It saves the effective Compose configuration privately under `/root`, snapshots
the running web container, and installs a versioned static payload under
`/opt/pulsedv-landing/public/releases`. The public directory contains only landing
files. A persistent `compose.override.yaml` adds two read-only mounts: the root
index and the versioned landing assets. Existing override settings are retained;
any unrelated resolved configuration difference aborts the operation.

Only `web` is recreated, using the snapshot of its actual current filesystem.
There are no builds, migrations, application branch changes, API or worker
restarts. This can briefly interrupt HTTPS during web recreation. Production
SEO and the current acquisition tracker are retained. The PWA button says
“Скоро” and is disabled; the Telegram path remains active. No claims of working
PWA availability are published by this update.

The update compares the root HTML and every release asset over local HTTPS,
checks `/ready`, and compares API/worker/db container IDs. On activation/check
failure it invokes the saved rollback. The printed rollback command also works
manually. It restores the previous override/symlink and web snapshot. Roll back
this release before a later app deployment, or create a fresh backup then: its
web snapshot represents the moment of this installation.

Tomorrow's normal PWA build must retain `compose.override.yaml` and the
`/opt/pulsedv-landing` directory. Standard `docker compose` automatically loads
the override. An update that explicitly passes `-f compose.yaml` must also pass
`-f compose.override.yaml`, or use captured effective config. Enabling the PWA
button requires a new landing payload after `/app/` has been verified.

Prerequisites: root, standard `compose.yaml`, Docker Compose v2, Python3, Git,
curl, tar, flock. Existing YAML override requires Python's `yaml` package;
JSON overrides use the standard library. Explicit COMPOSE_FILE and alternative
override filenames stop safely for adaptation. Backups contain private resolved
environment values and must stay under `/root`, never in a public directory.

Local verification: `bash -n deploy/update-landing-only.sh` and
`PYTHONDONTWRITEBYTECODE=1 python3 deploy/test-prepare-landing.py`.
These validate payload preparation and configuration isolation; they do not
substitute for a Docker deployment on the actual server.
