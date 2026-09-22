# PULSE.DV

Единый репозиторий экосистемы PULSE.DV.

## Сейчас
- `apps/web` — одностраничный сайт-воронка PULSE.DV.

## Следующий этап
После переноса текущего проекта из Floot сюда будут добавлены:
- `apps/mini-app` — клиентский Telegram Mini App;
- `apps/control-center` — отдельный закрытый PULSE Control Center / CRM;
- `packages/*` — общие типы, UI-токены, API-клиент и бизнес-логика.

Control Center не должен попадать в клиентский bundle Mini App.

## Сайт локально

```bash
npm install
npm run dev:web
```

## Сборка сайта

```bash
npm run build:web
```

Публичная версия сайта разворачивается GitHub Actions из ветки `main`.
