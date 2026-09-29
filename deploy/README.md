# Запуск PULSE на VPS

Нужны Docker с Compose, домен с A/AAAA-записью на VPS, открытые TCP 80/443. API и PostgreSQL не публикуют порты наружу. Caddy получает HTTPS-сертификат автоматически.

## Первый запуск

```sh
cp .env.example .env
```

Заполните `SITE_DOMAIN` без протокола/пути и `POSTGRES_PASSWORD` (случайная URL-safe строка минимум 32 символа). Для уведомлений и двухэтапного входа заполните `BOT_TOKEN`; для карты — `MAP_2GIS_KEY`. Не добавляйте `.env` в git. Ключ карты доступен клиенту по назначению — ограничьте его вашим доменом в кабинете провайдера.

По умолчанию закрытые/lost лиды анонимизируются через 365 дней, аналитика хранится 180 дней, аудит 365 дней, обработанная очередь уведомлений 30 дней. Периоды меняются переменными `CLIENT_DATA_RETENTION_DAYS`, `ANALYTICS_RETENTION_DAYS`, `AUDIT_RETENTION_DAYS`, `OUTBOX_RETENTION_DAYS`.

```sh
docker compose build
docker compose up -d db
docker compose run --rm api node --import tsx backend/src/migrate.ts
read -r -p 'Owner email: ' OWNER_EMAIL
read -r -s -p 'Owner password (14+ chars): ' OWNER_PASSWORD
export OWNER_EMAIL OWNER_PASSWORD
docker compose run --rm -e OWNER_EMAIL -e OWNER_PASSWORD api node --import tsx backend/src/bootstrap.ts
unset OWNER_EMAIL OWNER_PASSWORD
docker compose up -d
docker compose ps
```

Адреса:
- `https://ВАШ-ДОМЕН/pulsedv/mini-app/`
- `https://ВАШ-ДОМЕН/pulsedv/control-center/`
- `https://ВАШ-ДОМЕН/ready`

В Control войдите владельцем, добавьте сотрудников и реальные объекты. Сразу откройте кнопку «Защита», укажите свой Telegram ID и включите двухэтапный вход: после пароля сервер будет требовать одноразовый шестизначный код из Telegram. Перед включением пользователь должен открыть вашего бота и нажать «Старт». Каталог хранится отдельно от системной конфигурации: можно создавать ЖК по одному, импортировать до 1000 объектов за раз и загружать фото/планировки/PDF-презентации. Публичные материалы ЖК сохраняются в `media_data`; вложения клиентских чатов хранятся в закрытой части volume и отдаются только после проверки доступа. В BotFather задайте URL Mini App. Токен бота используется только сервером.

## Обновление

Сначала сделайте резервную копию. После получения нового кода:

```sh
docker compose build
docker compose stop api worker
docker compose run --rm api node --import tsx backend/src/migrate.ts
docker compose up -d
```

При неудаче миграции не продолжайте запуск новой версии; проверьте логи и совместимость старой версии со схемой. SQL-миграции выполняются транзакционно и учитываются в schema_migrations.

## Резервная копия и диагностика

```sh
docker compose exec -T db pg_dump -U pulse -d pulse -Fc > pulse-backup.dump
docker run --rm -v pulsedv_media_data:/data -v "$PWD":/backup alpine sh -c 'tar czf /backup/pulse-media-backup.tgz -C /data .'
docker compose logs --tail=100 api worker web
```

Резервируйте и PostgreSQL, и volume `media_data`: база содержит структуру каталога и ссылки, а volume — сами фото и PDF. Храните резервные копии шифрованными отдельно от VPS. Проверяйте восстановление в отдельной тестовой базе командой `pg_restore --no-owner`. Не выполняйте восстановление поверх рабочей базы без плана переключения. `docker compose down` сохраняет тома; добавление `-v` удаляет БД.

## Защита VPS

До приёма реальных заявок оставьте снаружи только 80/443 и административный SSH. PostgreSQL и API не публикуют host-порты, а база находится в отдельной internal Docker-сети. Для SSH используйте ключи, отключите вход root и парольную авторизацию, ограничьте 22/tcp доверенным IP/VPN, если это возможно. Включите автоматические security-обновления ОС и храните резервные копии зашифрованными вне VPS.

Контейнеры API/worker запускаются с read-only root filesystem, без Linux capabilities и с `no-new-privileges`. Если после обновления Docker/ядра эти ограничения мешают запуску, не снимайте их вслепую: сначала проверьте, какой конкретно доступ требуется.

## Проверка перед приёмом заявок

Проверьте вход и роли на двух устройствах, обязательно включите 2FA владельцу и администраторам, отправку и повтор заявки, приватность вложений чата, появление задачи, доставку Telegram, сохранение после перезапуска, карту и восстановление резервной копии. Проверьте фактические значения retention-переменных и текст/версию согласия на обработку данных.

GitHub Pages остаётся отдельной демонстрацией без доступа к рабочим данным VPS. Боевой репозиторий рекомендуется держать Private и запретить прямые push в `main` через GitHub Ruleset/Branch protection с обязательными CI-проверками.
