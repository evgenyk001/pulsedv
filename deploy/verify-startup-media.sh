#!/usr/bin/env bash
# Read-only verification after an interrupted rollout; do not rebuild, migrate or recreate anything.
set -euo pipefail
umask 077
cd /opt/pulsedv
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Обновление ещё выполняется; проверку запустите после его окончания.'; exit 1; }
expected=9afc93216b7fe098fcc33cabff06d54ef7a36859
test "$(git rev-parse HEAD)" = "$expected" || { echo 'На сервере другой коммит; сохраните вывод git rev-parse HEAD.'; exit 1; }
git diff --quiet HEAD -- backend/src packages package.json package-lock.json backend/package.json apps/mini-app || { echo 'Исходники изменены локально; проверка остановлена.'; exit 1; }
folder=$(mktemp -d /root/pulsedv-media-verify.XXXXXX)
echo "Материалы проверки: $folder"
python3 - "$folder" <<'PY'
import subprocess,hashlib,json,sys
from pathlib import Path
folder=Path(sys.argv[1]);files=subprocess.check_output(['git','ls-files','backend/src','packages','package.json','package-lock.json','backend/package.json'],text=True).splitlines()
(folder/'files.json').write_text(json.dumps(files))
(folder/'expected.json').write_text(json.dumps({f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files}))
PY
for service in api worker; do
 docker compose exec -T "$service" node -e '
const fs=require("node:fs"),crypto=require("node:crypto");const files=JSON.parse(fs.readFileSync(0,"utf8"));
process.stdout.write(JSON.stringify(Object.fromEntries(files.map(f=>[f,crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")]))));
 ' < "$folder/files.json" > "$folder/$service.json"
 python3 - "$folder" "$service" <<'PY'
from pathlib import Path
import json,sys
folder=Path(sys.argv[1]);service=sys.argv[2]
if json.loads((folder/'expected.json').read_text())!=json.loads((folder/(service+'.json')).read_text()):raise SystemExit(service+': код отличается от текущих исходников. Контейнеры не изменены.')
print(service+': код совпадает с установленным релизом')
PY
done
fetch(){ curl --fail --silent --show-error --connect-timeout 5 --max-time 25 --resolve pulsedv.ru:443:127.0.0.1 "https://pulsedv.ru$1" -o "$2"; }
docker compose exec -T web cat /srv/mini-app/index.html > "$folder/expected.html"
fetch /pulsedv/mini-app/ "$folder/served.html"
cmp "$folder/expected.html" "$folder/served.html"
python3 - "$folder/expected.html" > "$folder/assets.txt" <<'PY'
import re,sys
html=open(sys.argv[1]).read()
paths=sorted(set(re.findall(r'(?:src|href)="(/pulsedv/mini-app/assets/[A-Za-z0-9_.-]+\.(?:js|css))"',html)))
if not any(p.endswith('.js') for p in paths) or not any(p.endswith('.css') for p in paths):raise SystemExit('Не найдены JS/CSS мини-аппа')
print('\n'.join(paths))
PY
while IFS= read -r asset; do
 name=$(basename "$asset")
 docker compose exec -T web cat "/srv/mini-app/${asset#/pulsedv/mini-app/}" > "$folder/expected-$name"
 fetch "$asset" "$folder/served-$name"
 cmp "$folder/expected-$name" "$folder/served-$name"
done < "$folder/assets.txt"
fetch /ready "$folder/ready.json"
python3 - "$folder/ready.json" <<'PY'
import json,sys
if json.load(open(sys.argv[1])).get('status')!='ready':raise SystemExit('API не подтвердил готовность')
PY
echo 'ГОТОВО: код API/worker совпадает, HTML и JS/CSS мини-аппа доступны через HTTPS, API ready. Контейнеры не изменялись.'
