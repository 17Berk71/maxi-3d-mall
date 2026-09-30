"""Собирает src/shop/photos.js из src/assets/products/*.webp (вырезанные фото товаров с прозрачным фоном).
Запуск: python3 tools/photos2js.py. Описание каждого фото — в PHOTO_META ниже."""
import base64,json,os
from PIL import Image
D='src/assets/products'
# ключ: цвет (hex), название цвета, высота вещи в метрах, к каким товарам каталога относится (имя базового товара)
PHOTO_META={
 'tee_black':{'color':'#1b1b1c','colorName':'чёрный','h':0.74,'items':['Футболка базовая','Футболка оверсайз','Футболка детская']},
 'puffer_red':{'color':'#8a2434','colorName':'бордовый','h':0.8,'items':['Пуховик с капюшоном','Куртка стёганая']},
 'trousers_beige':{'color':'#c99a7f','colorName':'бежевый','h':1.02,'items':['Брюки чинос','Брюки классические']},
}
out={}
for k,m in PHOTO_META.items():
    p=f'{D}/{k}.webp';im=Image.open(p)
    out[k]=dict(m,aspect=round(im.size[0]/im.size[1],4),url='data:image/webp;base64,'+base64.b64encode(open(p,'rb').read()).decode())
s='// Сгенерировано tools/photos2js.py — не править руками.\n// Фото настоящих вещей (фон вырезан). Позже — свои фото под каждый магазин.\nexport const PHOTOS='+json.dumps(out,ensure_ascii=False)+';\n'
s+='// товар каталога → ключ фото (по названию базового товара)\nexport const PHOTO_BY_ITEM={};for(const [k,v] of Object.entries(PHOTOS))for(const n of v.items)PHOTO_BY_ITEM[n]=k;\n'
open('src/shop/photos.js','w').write(s);print(len(s))
