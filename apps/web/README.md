# PULSE.DV Website Funnel

Одностраничный маркетинговый сайт PULSE.DV. Он **не дублирует Mini App** и не содержит каталог, карту, ипотечный калькулятор или CRM.

## Роль сайта

`интерес → понимание продукта → доверие → открыть PULSE Mini App`

## Уже реализовано

- premium light hero в стиле согласованного референса;
- два product mockup-телефона и лёгкий depth/parallax;
- короткая презентация PULSE Select, каталога, избранного и сравнения;
- блок «как это работает» из трёх шагов;
- финальный CTA на Mini App;
- desktop/tablet/mobile адаптация;
- safe-area friendly mobile layout;
- `prefers-reduced-motion` fallback;
- scroll reveal без тяжёлой 3D-сцены;
- CTA конфигурируется через `VITE_PULSE_TG_URL`;
- пока Mini App URL не подключён, CTA показывает понятный launch-state вместо битой ссылки.

## После переноса приложения из Floot

1. Подставить реальный Telegram Mini App URL.
2. Заменить CSS-мокапы экранов на актуальные product assets/screens.
3. Подключить настоящий QR.
4. Добавить event analytics/UTM.
5. Финально проверить Lighthouse, mobile Safari и Telegram WebView.

Сайт остаётся отдельной воронкой. Каталог, PULSE Select, ипотека, избранное и сравнение живут в Mini App, а PULSE Control Center — в отдельном закрытом приложении.
