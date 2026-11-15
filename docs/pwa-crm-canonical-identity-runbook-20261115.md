# PWA / Mini App — диагностика дублей в CRM

## Текущее поведение

- `sessions.id` — идентификатор устройства/сеанса, **должен отличаться**.
- `app_users.id` — единая личность клиента, **должна совпадать** после подтвержденного входа.
- `app_users.telegram_user_id` — Telegram identity, подтверждаемая через Telegram initData либо OIDC.
- Телефон используется для привязки только после подтверждения. Имя/username не являются основанием для слияния.
- Гостевая PWA-сессия без `user_id` может отображаться отдельно в CRM. Это ожидаемо до авторизации.
- Авторизация по телефону может создать отдельный `app_users` до привязки Telegram; если обе записи имеют историю, автоматическое слияние запрещено.

## Read-only диагностика на сервере

Выполнять **только в защищённом окружении**, не публиковать телефоны/Telegram ID/токены в тикетах.

```sql
-- Подставить известный подтвержденный Telegram ID в параметр $1.
select u.id as user_id, u.telegram_user_id, u.phone,
       count(distinct s.id) as sessions,
       array_agg(distinct s.auth_provider) filter(where s.id is not null) as providers
from app_users u
left join sessions s on s.user_id=u.id
where u.telegram_user_id=$1
group by u.id,u.telegram_user_id,u.phone;

-- Поиск нескольких user_id у одного подтвержденного номера (без автоисправлений).
select p.phone, count(distinct p.user_id) as users
from (
  select phone,user_id from phone_identities
  union all
  select phone,id as user_id from app_users where phone is not null
) p
group by p.phone
having count(distinct p.user_id)>1;

-- Проверка расхождений в профилях и событиях, связанных с сессиями.
select s.user_id as session_user_id, count(*) as mismatched_events
from sessions s join user_events e on e.session_id=s.id
where s.user_id is not null and e.user_id is distinct from s.user_id
group by s.user_id;
```

## Матрица проверки перед выпуском

1. Новый пользователь: вход через Mini App и через PWA с тем же проверенным Telegram ID — один `app_users.id`, две `sessions.id`.
2. Повторный вход PWA — тот же `user_id`; CRM группирует все сессии в одну карточку.
3. Розыгрыш: один `giveaway_entries.user_id`, одна заявка, одинаковый статус и кнопка «Обсудить покупку» в обоих клиентах.
4. Избранное, сохраненный поиск, сообщения, история событий — доступны из обоих каналов согласно правилам доступа.
5. Разные Telegram ID, даже при одинаковом имени, не сливаются.
6. Телефонный аккаунт с существующими заявками/сделками не сливается автоматически без проверки.
7. Анонимная PWA не считается авторизованным Telegram-клиентом; CRM может показывать гостевой сеанс отдельно до входа.
8. В CRM сохраняется источник активности каждой сессии (Mini App / PWA), без изменения канонического ID.

## Выпуск

- Запустить backend tests (включая `backend/test/pwa.test.ts` и `backend/test/control-profile-identity.test.ts`) и UI-тесты.
- Сверить deployed build flags, в том числе `VITE_PWA_PREVIEW`; preview не должен менять production-розыгрыш.
- Выполнить резервную копию БД до любой ручной консолидации.
- Отдельно проверить legacy-дубли и составить миграцию с журналом изменений; **не удалять строки app_users вручную**.
- Выпустить backend и клиенты согласованно, проверить реальные два входа и откат.
