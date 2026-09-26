# PULSE Catalog Engine

Каталог рассчитан на 100–1000+ ЖК и в production хранится отдельно от `app_config`.

## Где что хранится

- PostgreSQL:
  - `catalog_properties`
  - `catalog_property_images`
  - `catalog_property_features`
  - `catalog_property_floorplans`
  - `catalog_property_documents`
- Файлы:
  - Docker volume `media_data`
  - публичный путь `/media/*`
- GitHub:
  - только код и demo-данные; реальные фото/PDF в Git не загружаются.

## Одиночное добавление

PULSE Control → **Объекты** → **Добавить ЖК**.

Для публикации обязательны:
- обложка;
- цена от;
- застройщик;
- срок сдачи.

Фото: JPG/PNG/WebP до 15 МБ.  
Презентации: PDF до 50 МБ.

## Массовый CSV-импорт

В Control кнопка **Шаблоны CSV** скачивает Excel-совместимые CSV.

Основной файл:

### pulse-objects.csv

`id;name;city;district;address;developerName;delivery;className;priceFrom;description;tags;latitude;longitude;status;coverImageUrl;sortOrder`

- `id` — стабильный slug/ID ЖК, не менять после публикации;
- `priceFrom` — в млн ₽, например `8.6`;
- `tags` — через `|`, например `Вид на море|Старт продаж`;
- `status` — `draft`, `published`, `archived`;
- пустой `coverImageUrl` можно заполнить позже загрузкой файла.

Дополнительные файлы можно загружать одновременно.

### pulse-floorplans.csv

`propertyId;id;roomLabel;areaFrom;areaTo;priceFrom;imageUrl;sortOrder`

### pulse-features.csv

`propertyId;id;label;icon;sortOrder`

Иконки: `building`, `waves`, `trees`, `car`, `baby`, `map-pin`.

### pulse-images.csv

`propertyId;id;url;alt;sortOrder`

Используется, если изображения уже лежат на внешнем HTTPS CDN/storage. Для локальных файлов удобнее пакетный media upload.

### pulse-documents.csv

`propertyId;id;kind;name;url;mimeType;sizeBytes;sortOrder`

`kind`: `presentation` или `document`.

### Безопасное обновление

Если загружен только `pulse-objects.csv`, уже существующие фото, планировки, преимущества и документы не удаляются.

Дочерний набор заменяется только если соответствующий CSV присутствует в выбранных файлах. Перед записью Control показывает подтверждение.

Один запрос принимает до 1000 ЖК.

## Массовая загрузка медиа

Выберите **Медиа пачкой** и выделите файлы с именами:

- `PROPERTY_ID__cover.jpg`
- `PROPERTY_ID__gallery__01.jpg`
- `PROPERTY_ID__gallery__02.webp`
- `PROPERTY_ID__presentation.pdf`
- `PROPERTY_ID__document.pdf`
- `PROPERTY_ID__floorplan__FLOORPLAN_ID.jpg`

Примеры:

- `solnechniy__cover.jpg`
- `solnechniy__gallery__01.jpg`
- `solnechniy__presentation.pdf`
- `solnechniy__floorplan__2room-56.jpg`

Для floorplan имя после `floorplan__` должно совпадать с ID планировки из CSV/Control.

## Публичная выдача

Mini App не получает весь каталог при старте.

- Home: только 3 объекта.
- Catalog list: 20 объектов за страницу.
- «Показать ещё»: следующая страница.
- Map: отдельная облегчённая выборка.
- Favorites: только сохранённые ID.
- Property page: полный объект по ID.
- PULSE Select: matching-данные без галерей и PDF.

API:

- `GET /api/v1/public/catalog/meta`
- `GET /api/v1/public/catalog`
- `GET /api/v1/public/catalog/:id`

## Backup

Нужно резервировать **оба** слоя:

1. PostgreSQL;
2. Docker volume `media_data`.

Команды есть в `deploy/README.md`.
