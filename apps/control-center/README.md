# PULSE Control Center

Private operational application for the PULSE.DV team.

This app is intentionally separate from `apps/mini-app`:
- separate bundle and deployment;
- separate authentication/RBAC boundary;
- no admin routes or admin UI shipped to Telegram users;
- shared domain models/API contracts will move into packages later.

## Current migration state

The standalone app now has routed sections for:
- Overview
- Leads
- Users / activity timeline
- Tasks
- Objects
- Mortgage
- PULSE Select
- Content
- Analytics
- Settings / RBAC

No fake backend data is presented. Screens expose honest empty states and the target operational structure until the shared backend is connected.

The preserved Floot admin baseline lives under `apps/floot-mirror/current` and is the migration reference for endpoint/schema behavior.

## Дата ввода и количество квартир

В редакторе объекта блок «Ввод дома и квартиры» сохраняет необязательный
`projectDetails`: `commissioningDate` (плановая дата ввода, ISO `YYYY-MM-DD`),
`totalApartments` (всего квартир в ЖК/очереди этой карточки) и
`availableApartments` (подтверждённый остаток в продаже). Пустое поле означает
неизвестное значение; нулевой остаток — известное отсутствие квартир в продаже.
Количество квартир не выводится из количества планировок. Дата ввода хранится
отдельно от общего `delivery` и не обозначает дату выдачи ключей.

Серверный каталог хранит эти поля после миграции `026_project_details.sql`.
CSV-шаблон объектов содержит одноимённые колонки. Старые запросы сохранения и
импорта без `projectDetails` сохраняют ранее внесённые значения.
