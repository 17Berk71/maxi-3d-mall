# Лаборатория: проверка примерочной и сайта

Скрипты, которыми проверяется каждая правка примерочной: снимки вещей на фигуре, автопроверка посадки, кадры анимации и видео, текстуры после обработки, данные расчёта ткани, полная проверка сайта, проверка имён в модулях.

Всё запускается из `maxi-project/tools/lab/`. Нужны Node 18+, Python 3 с Pillow, Chromium для Playwright, а для видео — ffmpeg.
- **Зависимости.** После `npm install` в `maxi-project` скрипты находят playwright, esbuild и three сами. Без этого — через переменные `PLAYWRIGHT_PATH`, `ESBUILD_PATH`, `ESLINT_PATH`, `PW_CHROMIUM`. В облачной песочнице Claude они находятся без настройки.
- **three.js.** Копия r128 лежит в `vendor/` и нужна на случай, если `node_modules` нет.

## Ваши вещи (гардероб)

Примерочная лаборатории надевает вещи из `tools/wardrobe/out/`. Эту папку собирает фабрика вещей из фото в `tools/wardrobe/raw/`.

Обе папки — личные фото, в публичный репозиторий они не попадают (`.gitignore`). Копия хранится в закрытом репозитории `17Berk71/maxi-wardrobe-private`. Как вернуть её на место:

```bash
git clone https://github.com/17Berk71/maxi-wardrobe-private /tmp/wardrobe-private
cp -r /tmp/wardrobe-private/raw /tmp/wardrobe-private/out tools/wardrobe/     # из maxi-project
```

Пересобрать вещи из фото: `python3 tools/wardrobe/build.py` (все) или `python3 tools/wardrobe/build.py sk-pleat dr-marsala` (выбранные). Список вещей — `tools/wardrobe/items.py`. Нужны opencv-python, numpy, Pillow, а для фото на человеке — onnxruntime и модель `u2net_cloth_seg.onnx` в `tools/wardrobe/models/` (ссылка на скачивание — в `seg_person.py`).

## Команды

| Что | Команда |
|---|---|
| Собрать страницу кабины и поднять сервер (порт 8091, `PORT=` — другой) | `./serve.sh` |
| Снять вещи на фигуре: 3 угла, автопроверка и подсказка посадки | `node shot.mjs skirt sk-pleat` → `shots/w_skirt_*.png` |
| Пакет вещей: каждая отдельно, 3 ракурса + автопроверка → `OUTD/qc.jsonl` | `BODY=f OUTD=shots/wb node batch.mjs wb-1,wb-2` |
| Отчёт для глаз по пакету (один HTML с картинками) | `python3 wb_report.py report.html shots/wb` |
| Только автопроверка списка вещей | `node qc.mjs zolla-tee,polo,sk-pleat` (`ALL=1` — все пункты с цифрами, `X=__qcProf` — ещё и строки силуэта; `PACK=feeds/fit/` — пакеты выгрузки магазинов) |
| Старая версия вещей с текущей автопроверкой (эталон «плохих» версий) | `./rev-qc.sh a30cedb v_karkas.html`, затем `PAGE=v_karkas.html ALL=1 node qc.mjs barrel-jeans` |
| Силуэт вещи против фото по строкам | `node prof.mjs barrel-jeans,cream-shorts` |
| Кадры анимации надевания | `node anim.mjs dress '["dr-marsala"]'` (`KS=0,40,80` — отдельные кадры) |
| Видео анимации | `./vid.sh dress '["dr-marsala"]'` → `./mkvid.sh dress dress.mp4` |
| Текстуры ткани после обработки фото | `node texdump.mjs sk-pleat` |
| Посчитать что-то по расчёту ткани | `node dump.mjs sk-pleat "C.seams.length"` |
| «До/после»: страница из прошлой версии | `./make-rev.sh HEAD~1 before.html`, затем `PAGE=before.html node shot.mjs old sk-pleat` |
| Лист сравнения снимков | `python3 sheet.py cmp.jpg "ДО=shots/w_old_0.png" "ПОСЛЕ=shots/w_skirt_0.png"` |
| Сайт собирается целиком? | `node bundle-site.mjs /tmp/site.html` |
| Нет ли необъявленных имён в модулях | `node lint.mjs` |
| Полная проверка сайта (15–30 мин) | `./site-check.sh new` → `out/check_new.log`, скриншоты в `out/check_new/` |

Переменные `shot.mjs`:
- `V=0,0.8,1.57` — углы поворота.
- `Z`, `ZH` — приближение и высота взгляда.
- `BODY=m|f|JSON` — фигура: `m` — 186/83, грудь 110, талия 82, бёдра 98; `f` — женская для юбок и платьев.
- `HIDE=1` — без тела, видны дыры в ткани.
- `NR=1` — без рельефа складок.
- `PD=0.013` — глубина плиссе.
- `CELL`, `FAB` — пробы сетки и ткани.
- `PAGE` — другая сборка страницы.

Снимки, страницы и логи (`shots/`, `www/`, `www-esm/`, `vid/`, `out/`) в git не попадают.

## Как проверять правку примерочной

1. После правки выкройки, расчёта или тела для столкновений сменить `CLOTH_VER` в `src/shop/fitting/worker.js`, иначе в браузере останется старый кэш. Проверочный браузер каждый раз запускается с чистым кэшем.
2. Прогнать `ALL=1 node qc.mjs` по всему гардеробу и сравнить с прошлой версией: `./make-rev.sh HEAD base.html`, потом `PAGE=base.html ALL=1 node qc.mjs …`. Балл — не приговор: что именно не так, пишет каждый пункт; спорное смотреть на снимке рядом с фото.
3. Снять затронутые вещи (`shot.mjs`, при необходимости с `HIDE=1`) и посмотреть снимки глазами.
4. Прогнать `node lint.mjs` и `node bundle-site.mjs`. Перед коммитом крупной правки — ещё и `./site-check.sh`.

Ловушки:
- `pgrep -f` / `pkill -f` с шаблоном, который есть в той же командной строке, находят саму оболочку, и цикл ожидания не кончается.
- 6 браузеров параллельно в облаке не успевают за 10 минут; запускать не больше 2–3.
