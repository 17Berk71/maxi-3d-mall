# Каталог: формат данных v1

Как устроены данные магазинов на сайте (PRD 9.3). Источник сейчас — карточки Wildberries, потом выгрузки магазинов; формат от источника не зависит.

Файлы лежат в `public/feeds/` и попадают в сборку как `feeds/…`.

```
public/feeds/
  index.json          список магазинов
  taxonomy.json       виды и цвета (из tools/catalog/taxonomy.py)
  <магазин>.json      вещи магазина
  cut/                вырезки для холста: <id>_f.webp (спереди), <id>_b.webp (сзади)
  thumb/              миниатюры <id>.webp, ~240 px
  img/                фото карточки для галереи
```

## index.json

```json
{
  "version": 1,
  "updated": "2026-10-26T14:00:00+03:00",
  "shops": {
    "befree": {"name": "befree", "file": "befree.json", "floor": 1, "items": 123,
               "source": "wildberries", "updated": "2026-10-26T14:00:00+03:00", "hidden": false}
  }
}
```

Ключ магазина — как `name` помещения в модели ТРЦ (`src/data/maxi-data.json`), по нему сайт находит зал и место на карте.

## <магазин>.json

```json
{"version": 1, "shop": "befree", "updated": "…", "source": "wildberries", "items": [ … ]}
```

Вещь:

| Поле | Что | Обязательно |
|---|---|---|
| `id` | `wb-55243617` — источник и номер; уникален во всём каталоге | да |
| `src` | `{kind: "wildberries", id: 55243617, url, collected}` — откуда и когда взято | да |
| `brand`, `name` | бренд и название как в карточке | да |
| `kind` | вид из `taxonomy.KINDS` (`jeans`, `puffer`…) | да |
| `sex` | `f`, `m` или `u` (унисекс) | да |
| `colors` | основные цвета из `taxonomy.COLORS`, первый — главный | да, хотя бы один |
| `color_name` | цвет словами из карточки («молочный») | нет |
| `price` | `{now: 2292, old: 5699, cur: "RUB", at: "…"}` — рубли; `old` — до скидки, если есть | да, `now` > 0 и `at` |
| `sizes` | `[{name: "46", label: "M", status: "in_stock", qty: 3, at: "…"}]`; `status` — `in_stock`, `out_of_stock`, `unknown` | да, хотя бы один |
| `size_table` | `{cols: ["RU", "Обхват талии, см"], rows: [["42", "62-66"]]}` | нет |
| `desc` | описание из карточки | нет |
| `composition` | `["97% полиэстер", "3% эластан"]` | нет |
| `props` | прочие характеристики `{"Покрой": "А-силуэт"}` | нет |
| `photos` | фото карточки для галереи, пути от `public/feeds/` | да, хотя бы одно |
| `cut` | `{front: "cut/wb-…_f.webp", back: "cut/wb-…_b.webp" или null, w, h}` | да, `front` |
| `thumb` | миниатюра | да |
| `status` | `published` (видна на сайте), `review` (ждёт проверки), `rejected` (не берём) | да |
| `hidden` | `true` — скрыта (PRD H1), сайт её не показывает | да |

Даты — ISO 8601 с часовым поясом.

## Проверка

```
python3 tools/catalog/validate.py [public/feeds]
```

Ошибки — вещь опубликована, но не годится для сайта (нет цены, фото, вырезки, размеров со статусом и датой, вид или цвет не из списка, файлы не найдены). Предупреждения — можно жить, но стоит доделать (нет вырезки сзади, нет описания). Выход с кодом 1, если есть ошибки. Вещи со статусом `review` и `rejected` проверяются мягче: им достаточно `id`, `src`, `brand`, `name`.

## Виды и цвета

`python3 tools/catalog/taxonomy.py` — список для глаз, `python3 tools/catalog/taxonomy.py json > public/feeds/taxonomy.json` — для сайта.
