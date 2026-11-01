#!/usr/bin/env bash
# Local, consistent snapshot. Does not recreate containers, resolve old app image IDs, or change networking.
set -Eeuo pipefail
umask 077
cd /opt/pulsedv
exec 9>/var/lock/pulsedv-update.lock
flock -n 9 || { echo 'Сейчас выполняется обновление.'; exit 1; }
exec 8>/var/lock/pulsedv-backup.lock
flock -n 8 || { echo 'Резервная копия уже создаётся.'; exit 1; }
folder=$(mktemp -d /root/pulsedv-before-ip.XXXXXX)
paused=0
restore_container=''
api=$(docker compose ps -q api);worker=$(docker compose ps -q worker);web=$(docker compose ps -q web)
for container in "$api" "$worker" "$web"; do
 test -n "$container" && test "$(docker inspect --format '{{.State.Running}}' "$container")" = true || { echo 'Не все сервисы работают; ничего не остановлено.'; exit 1; }
done
resume(){
 if [ "$paused" -eq 1 ]; then
  docker start "$api" "$worker" > /dev/null
  paused=0
 fi
}
cleanup(){
 status=$?;trap - EXIT HUP INT TERM
 if [ -n "$restore_container" ]; then docker rm -fv "$restore_container" > /dev/null 2>&1 || true; fi
 if ! resume; then echo "Не удалось запустить прежние API/worker. Копии: $folder"; exit 1; fi
 if [ "$status" -ne 0 ]; then echo "Резервное копирование не завершено. Сохранённые материалы: $folder"; fi
 exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
# The restore check uses the already installed PostgreSQL image, never the missing old application images.
docker image inspect postgres:16-alpine > /dev/null
source_kb=$(du -sk --exclude=.git --exclude=node_modules --exclude=dist . | awk '{print $1}')
media_kb=$(docker exec "$web" du -sk /srv/media | awk '{print $1}')
db_bytes=$(docker compose exec -T db psql -U pulse -d pulse -Atc "select pg_database_size(current_database())" | tr -d '\r\n')
[[ "$source_kb:$media_kb:$db_bytes" =~ ^[0-9]+:[0-9]+:[0-9]+$ ]] || exit 1
free_bytes=$(df -PB1 "$folder" | awk 'NR==2{print $4}')
required=$((3*(source_kb*1024+media_kb*1024+db_bytes)+1073741824))
[ "$free_bytes" -ge "$required" ] || { echo "Недостаточно места: нужно минимум $required байт, свободно $free_bytes."; exit 1; }
echo "1/5. Сохраняем исходники и настройки в $folder"
git rev-parse HEAD > "$folder/commit.txt"
docker compose config > "$folder/effective-compose.yaml"
ip -4 addr show > "$folder/ip-addresses.txt"
ip -4 route show > "$folder/ip-routes.txt"
tar --exclude='./.git' --exclude='./node_modules' --exclude='*/node_modules' --exclude='./dist' --exclude='./test-results' --exclude='./playwright-report' --exclude='./coverage' -czf "$folder/source.tgz" .
settings=()
for item in etc/netplan etc/NetworkManager/system-connections etc/systemd/network etc/network/interfaces etc/network/interfaces.d etc/cloud/cloud.cfg.d etc/ssh/sshd_config etc/ssh/sshd_config.d; do
 if [ -e "/$item" ]; then settings+=("$item"); fi
done
if [ "${#settings[@]}" -gt 0 ]; then tar -czf "$folder/network-settings.tgz" -C / "${settings[@]}"; fi
echo '2/5. Кратко останавливаем API/worker для согласованной копии базы и медиа'
paused=1
docker stop --time 30 "$worker" "$api" > /dev/null
docker compose exec -T db pg_dump -U pulse -d pulse -Fc > "$folder/database.dump"
test -s "$folder/database.dump"
docker exec "$web" tar -czf - -C /srv/media . > "$folder/media.tgz"
resume
echo 'API и worker запущены обратно.'
echo '3/5. Сохраняем сертификаты и проверяем архивы'
docker exec "$web" tar -czf - -C /data . > "$folder/caddy-data.tgz"
for archive in "$folder"/*.tgz; do tar -tzf "$archive" > /dev/null; done
docker compose exec -T db pg_restore -l < "$folder/database.dump" > /dev/null
(cd "$folder" && sha256sum -- *.tgz database.dump commit.txt effective-compose.yaml ip-addresses.txt ip-routes.txt > SHA256SUMS)
echo '4/5. Проверяем восстановление в отдельном изолированном контейнере'
(cd "$folder" && sha256sum -c SHA256SUMS)
restore_container="pulse-preip-restore-$(date +%s)-$$"
docker run --pull=never -d --name "$restore_container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine > /dev/null
restore_ready=0
for attempt in $(seq 1 60); do
 if docker exec "$restore_container" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres' > /dev/null 2>&1; then restore_ready=1; break; fi
 sleep 1
done
[ "$restore_ready" -eq 1 ] || { echo 'Проверочная база не запустилась; рабочие сервисы уже возобновлены.'; exit 1; }
docker exec "$restore_container" createdb -U postgres pulse_restore
docker exec -i "$restore_container" pg_restore -U postgres -d pulse_restore --no-owner --no-privileges --exit-on-error < "$folder/database.dump"
docker exec "$restore_container" psql -U postgres -d pulse_restore -v ON_ERROR_STOP=1 -c 'select count(*) as migrations from schema_migrations; select count(*) as leads from leads;'
docker rm -fv "$restore_container" > /dev/null
restore_container=''
echo '5/5. Упаковываем копию для скачивания'
archive="/root/PULSEDV-before-ip-$(date -u +%Y%m%d-%H%M%S)-$$.tar"
tar -cf "$archive" -C "$folder" .
tar -tf "$archive" > /dev/null
sha256sum "$archive" | tee "$archive.sha256"
ready=0
for attempt in $(seq 1 30); do
 if curl --fail --silent --show-error --connect-timeout 3 --max-time 5 --resolve pulsedv.ru:443:127.0.0.1 https://pulsedv.ru/ready -o "$folder/ready.json" 2>/dev/null && python3 -c 'import json,sys;sys.exit(0 if json.load(open(sys.argv[1])).get("status")=="ready" else 1)' "$folder/ready.json"; then ready=1; break; fi
 sleep 2
done
[ "$ready" -eq 1 ] || { echo "Копия создана: $archive; API не подтвердил готовность. IP пока не меняйте."; exit 1; }
trap - EXIT HUP INT TERM
printf '\nГОТОВО: база восстановлена в изолированной проверке, архивы и контрольные суммы проверены, API ready.\nСкачать: %s\nКонтрольная сумма: %s.sha256\n' "$archive" "$archive"
