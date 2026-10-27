#!/usr/bin/env bash
# Read-only production diagnostics. No migrations, messages, test users or payments.
set -uo pipefail
umask 077
cd "${PULSE_PROJECT_DIR:-/opt/pulsedv}" || exit 1
doctor_report=$(mktemp) || exit 1
trap 'rm -f "$doctor_report"' EXIT

run_doctor() {
 echo '[INFO] PULSEDV.RU: проверка текущего VPS, без изменения данных'
 printf '[INFO] UTC: %s; commit: %s\n' "$(date -u +%FT%TZ)" "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
 if ! command -v docker >/dev/null; then echo '[FAIL] Docker не найден'; return; fi
 if ! docker compose config --quiet >/dev/null 2>&1; then echo '[FAIL] Конфигурация Compose (значения окружения скрыты)'; return; fi
 for service in db api worker web; do
  id=$(docker compose ps -q "$service" 2>/dev/null)
  if [[ -z "$id" ]]; then echo "[FAIL] $service: контейнер не запущен"; continue; fi
  state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null)
  if [[ "$state" == healthy || "$state" == running ]]; then
   echo "[OK] $service: $state"
  else echo "[FAIL] $service: $state"; fi
 done
 mode=$(stat -c %a .env 2>/dev/null || echo unknown)
 if [[ "$mode" == 600 || "$mode" == 400 ]]; then echo '[OK] Права файла .env'; else echo "[WARN] Права .env: $mode, ожидаются 600"; fi

 docker compose exec -T api node --import tsx --input-type=module <<'PULSE_DOCTOR_JS'
import pg from 'pg';
import {readdir,stat,statfs,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,sep} from 'node:path';
import {readConfig} from './backend/src/config.ts';
import {deploymentIssues} from './backend/src/deploymentReadiness.ts';

const report=(level,label,detail='')=>console.log(`[${level}] ${label}${detail?': '+detail:''}`);
const safeError=e=>String(e?.code||e?.name||'unknown').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);
async function check(label,fn){try{await fn()}catch(e){report('FAIL',label,safeError(e))}}
let config;
try{config=readConfig()}catch{report('FAIL','Конфигурация','некорректные переменные окружения; значения скрыты');process.exit(0)}
const issues=deploymentIssues(config);
for(const issue of issues)report(issue.level==='error'?'FAIL':'WARN','Конфигурация',issue.message);
if(!issues.length)report('OK','Конфигурация запуска и реквизиты');
const origin=new URL(config.PUBLIC_ORIGIN).origin;
async function http(path){return fetch(new URL(path,origin),{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'Cache-Control':'no-cache'}})}
async function json(path){const r=await http(path);if(!r.ok)throw {code:'HTTP_'+r.status};return r.json()}

const db=new pg.Client({connectionString:config.DATABASE_URL,connectionTimeoutMillis:5000,options:'-c default_transaction_read_only=on -c statement_timeout=8000'});
db.on('error',()=>{});
let connected=false,publishedCount=null;
try{
 await check('База PostgreSQL',async()=>{await db.connect();connected=true;const r=(await db.query('show default_transaction_read_only')).rows[0];if(r.default_transaction_read_only!=='on')throw {code:'READONLY_NOT_SET'};report('OK','PostgreSQL','диагностическое соединение только для чтения')});
 if(connected){
  await check('Миграции',async()=>{
   const expected=(await readdir('./backend/migrations')).filter(x=>x.endsWith('.sql'));
   const applied=new Set((await db.query('select name from schema_migrations')).rows.map(r=>r.name));
   const missing=expected.filter(x=>!applied.has(x));
   report(missing.length?'FAIL':'OK','Миграции',missing.length?'не применены: '+missing.join(', '):`${expected.length} применены`);
  });
  await check('Фоновый worker',async()=>{
   const r=(await db.query("select extract(epoch from now()-updated_at)::int as age from worker_health where name='notifications'")).rows[0];
   report(r&&r.age<120?'OK':'FAIL','Heartbeat worker',r?`${r.age} сек. назад`:'отсутствует');
  });
  await check('Количество записей',async()=>{
   const r=(await db.query(`select
    (select count(*) from app_users)::int as accounts,
    (select count(*) from app_users u join telegram_contact_consent c on c.user_id=u.id where u.phone is not null and c.accepted_at is not null)::int as registered,
    (select count(*) from leads)::int as leads,
    (select count(*) from user_events)::int as events,
    (select count(*) from visitor_profiles)::int as profiles,
    (select count(*) from crm_tasks)::int as tasks,
    (select count(*) from partner_profiles)::int as partners,
    (select count(*) from partner_referrals)::int as referrals,
    (select count(*) from partner_terms_acceptances)::int as acceptances,
    (select count(*) from catalog_properties where status='published')::int as published`)).rows[0];
   publishedCount=r.published;
   report('INFO','Аккаунты',`${r.accounts}; с подтверждённым номером: ${r.registered}`);
   report('INFO','Control',`заявок ${r.leads}, событий ${r.events}, профилей ${r.profiles}, задач ${r.tasks}`);
   report('INFO','Партнёры',`${r.partners}; рекомендаций ${r.referrals}; принятий оферты ${r.acceptances}`);
   report('INFO','Опубликовано ЖК',String(r.published));
   const limited=[['заявки',r.leads,300],['события',r.events,500],['профили',r.profiles,300],['задачи',r.tasks,300]].filter(([,count,limit])=>count>limit);
   report('INFO','Пагинация Control',limited.length?limited.map(([label,count,limit])=>`${label}: ${count}, первая страница ${limit}`).join('; '):'все четыре списка помещаются на первую страницу');
  });
  await check('Очередь уведомлений',async()=>{
   const rows=(await db.query(`select topic,
    count(*) filter(where processed_at is null and dead_at is not null)::int as dead,
    count(*) filter(where processed_at is null and dead_at is null and available_at<=now() and (locked_until is null or locked_until<now()) and created_at<now()-interval '15 minutes')::int as overdue
    from outbox_events where topic<>'manager.security_code' group by topic`)).rows;
   const problems=rows.filter(r=>r.dead||r.overdue);
   if(!problems.length)report('OK','Очередь уведомлений','нет просроченных доступных задач и окончательных ошибок');
   for(const r of problems)report('WARN','Очередь '+r.topic,`ошибок ${r.dead}; ожидание более 15 мин. ${r.overdue}`);
  });
  await check('Настройки анонсов',async()=>{
   const r=(await db.query(`select count(*) filter(where s.enabled=true)::int as enabled,
    count(*) filter(where s.enabled=false)::int as disabled,
    count(*) filter(where s.user_id is null)::int as missing
    from app_users u left join announcement_subscriptions s on s.user_id=u.id where u.telegram_user_id is not null`)).rows[0];
   report(r.missing?'WARN':'OK','Анонсы',`включены ${r.enabled}, отключены ${r.disabled}, без настройки ${r.missing}`);
  });
  await check('Файлы каталога',async()=>{
   const rows=(await db.query(`select cover_image_url as url from catalog_properties where cover_image_url is not null
    union select url from catalog_property_images
    union select image_url as url from catalog_property_floorplans where image_url is not null
    union select url from catalog_property_documents
    union select b->>'imageUrl' as url from app_config c cross join lateral jsonb_array_elements(coalesce(c.document->'banners','[]'::jsonb)) b`)).rows;
   let local=0,external=0,missing=0,other=0;const root=resolve(config.MEDIA_ROOT);
   const urls=[...new Set(rows.map(r=>r.url).filter(Boolean))];
   for(const value of urls){
    let url;try{url=new URL(value,origin)}catch{other++;continue}
    if(url.origin!==origin){external++;continue}
    if(!url.pathname.startsWith('/media/')){other++;continue}
    const file=resolve(root,decodeURIComponent(url.pathname.slice('/media/'.length)));
    if(!file.startsWith(root+sep)){missing++;continue}
    local++;
    try{const info=await stat(file);if(!info.isFile()||info.size===0)missing++}catch{missing++}
   }
   report(missing?'FAIL':'OK','Локальные файлы каталога',`проверено ${local}; отсутствуют или пустые ${missing}`);
   if(external)report('WARN','Внешние ссылки в каталоге/баннерах',`${external}; доступность зависит от стороннего хостинга`);
   if(other)report('INFO','Другие ссылки на изображения/документы',`${other}; это не пути /media/, проверка файлов на диске к ним не применяется`);
   report('INFO','Файлы','проверяются исходные файлы; варианты миниатюр и приватные вложения этим пунктом не охвачены');
   const sample=urls.find(value=>{try{const u=new URL(value,origin);return u.origin===origin&&u.pathname.startsWith('/media/')}catch{return false}});
   if(sample){const r=await fetch(new URL(sample,origin),{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(12000)});const type=r.headers.get('content-type')||'';report(r.ok&&(/^(image|video)\//.test(type)||type.includes('pdf'))?'OK':'FAIL','Выдача одного файла по HTTPS',`HTTP ${r.status}; ${type.split(';')[0]}`)}
  });
 }else report('INFO','Проверки БД','пропущены: соединение не установлено');

 await check('Диск медиа',async()=>{
  const info=await statfs(config.MEDIA_ROOT);const free=Number(info.bavail)*Number(info.bsize)/1024**3;
  report(free<0.5?'FAIL':free<2?'WARN':'OK','Свободно на диске медиа',free.toFixed(1)+' ГиБ');
  await access(config.MEDIA_ROOT,constants.R_OK|constants.W_OK);report('OK','Права каталога медиа','чтение/запись разрешены для пользователя API; тестовая запись не выполняется');
 });

 const assets=new Set();
 for(const [label,path] of [['Лендинг','/'],['Mini App','/pulsedv/mini-app/'],['Control','/pulsedv/control-center/'],['Страница оферты','/partner-offer/']]){
  await check('HTML '+label,async()=>{
   const r=await http(path);const type=r.headers.get('content-type')||'';const html=await r.text();
   if(!r.ok||!type.includes('text/html')||!/<!doctype html/i.test(html))throw {code:'HTTP_OR_HTML_INVALID'};
   report('OK','HTML '+label,'HTTPS '+r.status);
   for(const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)){
    const u=new URL(match[1],new URL(path,origin));
    if(u.origin===origin&&/\.(?:js|mjs|css)$/.test(u.pathname))assets.add(u.href);
   }
  });
 }
 await check('JS/CSS',async()=>{
  if(!assets.size)throw {code:'NO_ASSETS'};
  let good=0;for(const url of assets){const r=await fetch(url,{signal:AbortSignal.timeout(12000)});const type=r.headers.get('content-type')||'';if(r.ok&&/(javascript|text\/css)/i.test(type))good++;await r.arrayBuffer()}
  report(good===assets.size?'OK':'FAIL','Начальные JS/CSS',`${good} из ${assets.size}; выполнение кода в браузере не проверяется`);
 });
 for(const [path,status] of [['/health','ok'],['/ready','ready']])await check(path,async()=>{const d=await json(path);report(d.status===status?'OK':'FAIL',path,String(d.status))});
 await check('Обязательный номер',async()=>{const d=await json('/api/v1/public/state');report(d.requiresPhone?'OK':'WARN','Вход с подтверждённым номером',d.requiresPhone?'включён':'выключен')});
 await check('Каталог API',async()=>{const d=await json('/api/v1/public/catalog?limit=1');if(!Array.isArray(d.items)||typeof d.total!=='number')throw {code:'INVALID_CATALOG'};report(publishedCount===null||d.total===publishedCount?'OK':'WARN','Каталог API',`в API ${d.total}; в БД ${publishedCount??'не проверено'}`)});
 await check('Карта',async()=>{const d=await json('/api/v1/public/map');report(d.provider&&d.key?'OK':'FAIL','Настройка карты',`${d.provider||'не задана'}; отрисовка проверяется в браузере`)});
 await check('Оферта',async()=>{const d=await json('/api/v1/public/partner-offer');report(d.published&&d.operator?.registration?'OK':'WARN','Оферта',`${d.published?'опубликована':'подключение партнёров закрыто'}; ${d.version||'нет версии'}`)});
 for(const path of ['/api/v1/control/bootstrap','/api/v1/control/registrations','/api/v1/control/partners','/api/v1/me/account'])await check('Защита '+path,async()=>{const r=await http(path);report(r.status===401?'OK':'FAIL','Без входа '+path,'HTTP '+r.status);await r.arrayBuffer()});

 if(config.BOT_TOKEN){
  async function telegram(method){const r=await fetch('https://api.telegram.org/bot'+config.BOT_TOKEN+'/'+method,{signal:AbortSignal.timeout(12000)});const d=await r.json();if(!r.ok||!d.ok)throw {code:'TG_'+(d.error_code||r.status)};return d.result}
  await check('Telegram getMe',async()=>{const d=await telegram('getMe');report(d.username?.toLowerCase()===config.TELEGRAM_BOT_USERNAME.toLowerCase()?'OK':'FAIL','Telegram getMe','проверено соответствие бота настройке')});
  await check('Telegram webhook',async()=>{const d=await telegram('getWebhookInfo');report(d.url?'WARN':'OK','Telegram polling',d.url?'настроен webhook: конфликт с polling worker':'webhook отсутствует; сообщения и очередь обновлений не изменялись')});
 }else report('FAIL','Telegram','токен не настроен');
}finally{await db.end().catch(()=>{})}
report('INFO','Границы проверки','вход/2FA, Face ID, карта на телефоне, отправка заявок, загрузка файлов и фактические выплаты требуют отдельных пользовательских сценариев');
PULSE_DOCTOR_JS
 if [[ $? -ne 0 ]]; then echo '[FAIL] Внутренняя диагностика API не завершена'; fi

 backup_dump=$(find /root/pulsedv-backups -mindepth 2 -maxdepth 2 -type f -name database.dump -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)
 if [[ -z "$backup_dump" ]]; then
  echo '[WARN] Локальный database.dump не найден в /root/pulsedv-backups'
 else
  backup_age=$(( ($(date +%s)-$(stat -c %Y "$backup_dump"))/3600 ))
  echo "[INFO] Возраст последнего локального дампа: $backup_age ч."
  if ((backup_age>26)); then echo '[WARN] Локальная копия старше 26 часов'; fi
  if timeout 30 docker compose exec -T db pg_restore -l < "$backup_dump" >/dev/null 2>&1; then echo '[OK] Каталог локального дампа читается'; else echo '[FAIL] Проверка каталога дампа не завершилась успешно'; fi
  backup_media="$(dirname "$backup_dump")/media.tar.gz"
  [[ -f "$backup_media" ]] || backup_media="$(dirname "$backup_dump")/media.tgz"
  if [[ ! -f "$backup_media" ]]; then echo '[WARN] Рядом с дампом нет архива медиа';
  elif timeout 30 gzip -t "$backup_media"; then echo '[OK] Gzip-целостность архива медиа';
  else echo '[WARN] Проверка архива медиа не завершилась успешно (ошибка или лимит 30 сек.)'; fi
  echo '[INFO] Реальное восстановление этой копии и внешнее хранилище этим скриптом не проверялись'
 fi
 if systemctl is-enabled --quiet pulsedv-backup.timer 2>/dev/null; then echo '[INFO] Таймер резервного копирования включён; успешность задания проверяется отдельно'; else echo '[WARN] Таймер pulsedv-backup.timer не включён'; fi
}

run_doctor 2>&1 | tee "$doctor_report"
doctor_pipeline_status=${PIPESTATUS[0]}
doctor_ok=$(awk '/^\[OK\]/{n++}END{print n+0}' "$doctor_report")
doctor_warn=$(awk '/^\[WARN\]/{n++}END{print n+0}' "$doctor_report")
doctor_fail=$(awk '/^\[FAIL\]/{n++}END{print n+0}' "$doctor_report")
printf '\nSUMMARY: OK=%s WARN=%s FAIL=%s\n' "$doctor_ok" "$doctor_warn" "$doctor_fail"
echo 'WARN — требует разбора; FAIL — проверка не пройдена. Отсутствие FAIL не заменяет проверку функций на телефоне.'
if ((doctor_fail>0||doctor_pipeline_status!=0)); then exit 1; fi
