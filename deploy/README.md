# Запуск PULSE на VPS

Нужны Docker с Compose, домен с A/AAAA-записью на VPS, открытые TCP 80/443. API и PostgreSQL не публикуют порты наружу. Caddy получает HTTPS-сертификат автоматически.

## Первый запуск

```sh
cp .env.example .env
```

Заполните `SITE_DOMAIN` без протокола/пути и `POSTGRES_PASSWORD` (случайная строка из букв и цифр минимум 32 символа). При необходимости заполните `BOT_TOKEN`, `MAP_2GIS_KEY`. Не добавляйте `.env` в git. Ключ карты доступен клиенту по назначению — ограничьте домены в кабинете провайдера.

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

В Control войдите владельцем, добавьте сотрудников и реальные объекты, переведите готовые объекты в published и нажмите «Сохранить изменения». Чтобы получать уведомления, сотрудник должен запустить бота, а владелец — указать его Telegram ID. В BotFather задайте URL Mini App. Токен бота используется только сервером.

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
docker compose logs --tail=100 api worker web
```

Храните резервные копии шифрованными отдельно от VPS. Проверяйте восстановление в отдельной тестовой базе командой `pg_restore --no-owner`. Не выполняйте восстановление поверх рабочей базы без плана переключения. `docker compose down` сохраняет тома; добавление `-v` удаляет БД.

## Проверка перед приёмом заявок

Проверьте вход и роли на двух устройствах, отправку и повтор заявки, появление задачи, доставку Telegram, сохранение после перезапуска, карту, восстановление резервной копии. Уточните текст и версию согласия, контактные ссылки и срок хранения данных. Автоматический retention, внешнее наблюдение за доступностью и нагрузочное тестирование в этот запуск не входят.

GitHub Pages остаётся отдельной демонстрацией без доступа к рабочим данным VPS.
