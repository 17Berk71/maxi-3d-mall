// Отделы магазинов, демо-товары и ссылки на сайты сетей.
// Товары и цены — примеры для концепта. Настоящие данные должны приходить из фидов магазинов.
import {mulberry} from '../utils.js';

const SITES={'Спортмастер Pro':'https://www.sportmaster.ru/','Лэтуаль':'https://www.letu.ru/','Рив Гош':'https://rivegauche.ru/','Gloria Jeans':'https://www.gloria-jeans.ru/','befree':'https://befree.ru/','Zarina':'https://zarina.ru/','Love Republic':'https://loverepublic.ru/','Henderson':'https://henderson.ru/','Zolla':'https://zolla.com/','Askona':'https://www.askona.ru/','Ormatek':'https://www.ormatek.com/','Sokolov':'https://sokolov.ru/','585 Золотой':'https://www.585zolotoy.ru/','Adamas':'https://www.adamas.ru/','Yves Rocher':'https://www.yves-rocher.ru/','Natura Siberica':'https://naturasiberica.ru/','билайн':'https://beeline.ru/','МегаФон | Yota':'https://moscow.megafon.ru/','T2':'https://t2.ru/','Снежная Королева':'https://snowqueen.ru/','Дом Лента':'https://lenta.com/','Перекрёсток Select':'https://www.perekrestok.ru/','Четыре Лапы':'https://4lapy.ru/','Копицентр Офисмаг':'https://www.officemag.ru/','Kuchenland Home':'https://www.kuchenland.ru/','Ригла':'https://www.rigla.ru/','Calzedonia':'https://www.calzedonia.com/ru/','Terranova':'https://terranovastyle.com/','Kanzler':'https://kanzler-style.ru/','Мир часов':'https://chasy71.ru/','2scoop':'https://tula.2scoop.ru/','Алеф':'https://alefmex.ru/'};
function siteOf(s){return SITES[s.name]||null;}
function mapsOf(s){return 'https://yandex.ru/maps/15/tula/search/'+encodeURIComponent(s.name+' ТРЦ Макси');}

// отделы: заголовок, иконка карточки, 3D-модель товара, тип выкладки, товары [название, цена]
const DEPT={
 shoes:{t:'Кроссовки и обувь',icon:'shoe',model:'shoe',lay:'wall',items:[['Беговые кроссовки',5990],['Кроссовки для зала',4490],['Баскетбольные кроссовки',8990],['Кеды',3290],['Бутсы',4790],['Зимние ботинки',7490]]},
 jackets:{t:'Куртки',icon:'jacket',model:'jacket',lay:'racks',items:[['Пуховик',9990],['Ветровка',3990],['Утеплённая куртка',6990],['Софтшелл',5490],['Жилет',2990],['Парка',8490]]},
 pants:{t:'Брюки и штаны',icon:'pants',model:'pants',lay:'racks',items:[['Спортивные брюки',2990],['Джоггеры',2490],['Тайтсы',1990],['Утеплённые брюки',4490],['Шорты',1490],['Джинсы',3490]]},
 tshirts:{t:'Футболки и худи',icon:'tshirt',model:'tshirt',lay:'racks',items:[['Футболка',990],['Лонгслив',1490],['Худи',3490],['Свитшот',2790],['Поло',1790],['Рубашка',2290]]},
 football:{t:'Футбол',icon:'football',model:'football',lay:'football',items:[['Футбольный мяч',1990],['Бутсы',4790],['Щитки',890],['Вратарские перчатки',1690],['Игровая форма',2490],['Складные ворота',5990]]},
 basketball:{t:'Баскетбол',icon:'basketball',model:'basketball',lay:'basketball',items:[['Баскетбольный мяч',2490],['Кольцо с сеткой',3490],['Баскетбольные кроссовки',8990],['Игровая форма',2790],['Напульсники',490],['Уличная стойка',19990]]},
 bikes:{t:'Велосипеды',icon:'bike',model:'bike',lay:'bikes',items:[['Горный велосипед',32990],['Городской велосипед',21990],['Детский велосипед',9990],['Шлем',2490],['Велозамок',990],['Самокат',6990]]},
 fitness:{t:'Фитнес',icon:'dumbbell',model:'dumbbell',lay:'fitness',items:[['Гантели 2×5 кг',2990],['Коврик для йоги',1490],['Скакалка',590],['Фитнес-резинки',790],['Гиря 12 кг',3290],['Скамья для жима',8990]]},
 dresses:{t:'Платья и юбки',icon:'dress',model:'dress',lay:'racks',items:[['Платье миди',3990],['Платье-рубашка',3490],['Юбка плиссе',2490],['Сарафан',2990],['Вечернее платье',6990],['Юбка-карандаш',2290]]},
 accbox:{t:'Аксессуары',icon:'bag',model:'box',lay:'tables',items:[['Сумка',2990],['Ремень',1290],['Шарф',990],['Шапка',890],['Рюкзак',2490],['Перчатки',790]]},
 kidswear:{t:'Детская одежда',icon:'tshirt',model:'tshirt',lay:'racks',items:[['Комбинезон',4990],['Футболка детская',590],['Пижама',1290],['Куртка детская',3990],['Штаны детские',990],['Платье детское',1490]]},
 toys:{t:'Игрушки и игры',icon:'toy',model:'toy',lay:'wall',items:[['Мягкая игрушка',990],['Конструктор',2490],['Настольная игра',1490],['Кукла',1290],['Машинка',790],['Пазл',590]]},
 fun:{t:'Развлечения',icon:'toy',model:'toy',lay:'floor',items:[['Разовый вход',500],['Абонемент на 5 посещений',2000],['День рождения',9900],['Игровой автомат',100],['Аттракцион',200],['Кафе для детей',350]]},
 perfume:{t:'Парфюмерия',icon:'perfume',model:'bottle',lay:'counters',items:[['Туалетная вода',4990],['Парфюмерная вода',7990],['Мини-формат',1490],['Набор миниатюр',2990],['Мужской аромат',5990],['Спрей для тела',990]]},
 makeup:{t:'Макияж',icon:'lipstick',model:'bottle',lay:'wall',items:[['Помада',890],['Тушь',790],['Тональный крем',1490],['Палетка теней',1690],['Румяна',990],['Лак для ногтей',390]]},
 care:{t:'Уход',icon:'jar',model:'jar',lay:'wall',items:[['Крем для лица',1290],['Сыворотка',1990],['Маска',490],['Шампунь',590],['Гель для душа',390],['Крем для рук',290]]},
 pharmacy:{t:'Аптека',icon:'jar',model:'box',lay:'wall',items:[['Витамины',790],['Средство от простуды',490],['Пластыри',150],['Крем',350],['Термометр',690],['Маски медицинские',190]]},
 jewel:{t:'Украшения',icon:'ring',model:'small',lay:'counters',items:[['Кольцо из золота',12990],['Серьги с фианитами',6990],['Цепочка серебряная',2990],['Подвеска',3490],['Браслет',4990],['Обручальное кольцо',15990]]},
 watch:{t:'Часы',icon:'watch',model:'small',lay:'counters',items:[['Часы наручные',6990],['Смарт-часы',12990],['Детские часы',1990],['Настенные часы',2490],['Ремешок',990],['Часы механические',19990]]},
 glasses:{t:'Оптика',icon:'glasses',model:'small',lay:'wall',items:[['Оправа',4990],['Солнцезащитные очки',3990],['Линзы для очков',2990],['Контактные линзы',1490],['Проверка зрения',0],['Футляр',490]]},
 phones:{t:'Смартфоны',icon:'phone',model:'phone',lay:'tables',items:[['Смартфон',24990],['Смартфон флагман',79990],['Планшет',34990],['Кнопочный телефон',1990],['Сим-карта',200],['Тариф «Всё включено»',600]]},
 phoneacc:{t:'Аксессуары',icon:'headphones',model:'small',lay:'wall',items:[['Чехол',990],['Защитное стекло',690],['Беспроводные наушники',4990],['Зарядка',1290],['Кабель',490],['Пауэрбанк',1990]]},
 appliance:{t:'Бытовая техника',icon:'fridge',model:'appliance',lay:'floor',items:[['Холодильник',54990],['Стиральная машина',39990],['Кондиционер',32990],['Посудомойка',36990],['Морозильник',24990],['Духовой шкаф',29990]]},
 sofa:{t:'Диваны',icon:'sofa',model:'sofa',lay:'floor',items:[['Угловой диван',49990],['Прямой диван',34990],['Кресло',14990],['Диван-кровать',39990],['Пуф',4990],['Модульный диван',69990]]},
 bed:{t:'Кровати и матрасы',icon:'bed',model:'bed',lay:'floor',items:[['Кровать 160×200',39990],['Матрас',24990],['Подушка',2990],['Одеяло',3990],['Топпер',6990],['Основание',14990]]},
 kitchen:{t:'Посуда и кухня',icon:'pot',model:'jar',lay:'wall',items:[['Кастрюля',2990],['Сковорода',2490],['Набор ножей',3990],['Чайник',1990],['Сервиз',4990],['Контейнеры',790]]},
 office:{t:'Канцтовары',icon:'box',model:'box',lay:'wall',items:[['Бумага А4',490],['Ручки, набор',190],['Тетради',120],['Рюкзак школьный',2990],['Печать фото',25],['Копирование',10]]},
 grocery:{t:'Продукты',icon:'bag',model:'box',lay:'wall',items:[['Хлеб',70],['Молоко',95],['Фрукты',199],['Сыр',349],['Готовая еда',299],['Напитки',89]]},
 garden:{t:'Сад и дача',icon:'pot',model:'jar',lay:'wall',items:[['Семена',49],['Грунт',299],['Кашпо',490],['Садовый инструмент',990],['Шланг',790],['Удобрения',390]]},
 pets:{t:'Зоотовары',icon:'bone',model:'box',lay:'wall',items:[['Корм для кошек',990],['Корм для собак',1490],['Наполнитель',590],['Лежанка',1990],['Игрушка',290],['Поводок',690]]},
 sportfood:{t:'Спортивное питание',icon:'jar',model:'jar',lay:'wall',items:[['Протеин',2990],['Гейнер',2490],['BCAA',1490],['Витамины',790],['Батончик',120],['Шейкер',390]]},
 auto:{t:'Автотовары',icon:'box',model:'box',lay:'wall',items:[['Авточехлы',5990],['Коврики',2490],['Органайзер',990],['Ароматизатор',190],['Держатель телефона',690],['Щётка',390]]},
 sweets:{t:'Сладости',icon:'candy',model:'toy',lay:'wall',items:[['Мармелад на развес',99],['Шоколад',249],['Пастила',390],['Подарочный набор',990],['Жевательная резинка',59],['Леденцы',149]]},
 gifts:{t:'Подарки',icon:'gift',model:'box',lay:'tables',items:[['Подарочный набор',1490],['Свеча',590],['Кружка',490],['Открытка',99],['Сувенир',390],['Подарочная карта',1000]]},
 coffee:{t:'Меню',icon:'cup',model:'cup',lay:'cafe',items:[['Капучино',220],['Латте',240],['Американо',180],['Раф',270],['Круассан',160],['Чизкейк',290]]},
 menu:{t:'Меню',icon:'plate',model:'cup',lay:'cafe',items:[['Паста',490],['Салат',390],['Суп дня',290],['Пицца',590],['Десерт',290],['Лимонад',250]]},
 bakery:{t:'Выпечка',icon:'plate',model:'cup',lay:'cafe',items:[['Багет',90],['Круассан',120],['Пирог',350],['Эклер',150],['Торт',1490],['Кофе с собой',150]]},
 sushi:{t:'Суши',icon:'plate',model:'cup',lay:'cafe',items:[['Филадельфия',590],['Калифорния',490],['Сет',1490],['Суп мисо',290],['Роллы запечённые',520],['Лимонад',220]]},
 service:{t:'Услуги',icon:'box',model:'box',lay:'tables',items:[['Консультация',0],['Срочный заказ',500],['Стандартная услуга',300],['Комплекс услуг',1200],['Доставка',300],['Подарочный сертификат',1000]]},
 generic:{t:'Товары',icon:'box',model:'box',lay:'wall',items:[['Хит продаж',990],['Новинка',1490],['Товар дня',690],['Набор',1990],['Акция',490],['Премиум',2990]]}
};
function deptsFor(s){const w=s.what||'',n=s.name;
 if(n==='Спортмастер Pro')return['shoes','jackets','pants','tshirts','football','basketball','bikes','fitness'];
 if(s.cat==='sport')return w.includes('питание')?['sportfood','fitness']:['shoes','tshirts','fitness','football'];
 if(s.cat==='fashion'){if(w.includes('Кроссовки'))return['shoes','accbox'];return['jackets','pants','tshirts','dresses','shoes','accbox'];}
 if(s.cat==='kids')return w.includes('одежда')?['kidswear','toys','shoes']:w.includes('Кигуруми')?['kidswear','toys']:['fun','toys'];
 if(s.cat==='beauty')return w==='Аптека'?['pharmacy','care']:w==='Косметика'?['care','makeup']:['perfume','makeup','care'];
 if(s.cat==='acc')return w==='Часы'?['watch','jewel']:w==='Оптика'?['glasses','phoneacc']:['jewel','watch'];
 if(s.cat==='tech')return w==='Бытовая техника'?['appliance']:w==='Аксессуары для телефонов'?['phoneacc']:['phones','phoneacc'];
 if(s.cat==='food')return w==='Кофейня'?['coffee']:w==='Пекарня'?['bakery']:w==='Суши'?['sushi']:w==='Магазин у дома'||w.includes('Микрозелень')?['grocery']:['menu'];
 if(s.cat==='gifts')return w==='Подарки'?['gifts']:['sweets'];
 if(s.cat==='furn')return w.includes('Матрасы')?['bed','sofa']:['sofa','bed'];
 if(s.cat==='home'){if(w.includes('Гипермаркет'))return['kitchen','garden','office','auto'];if(w.includes('сада'))return['garden'];if(w.includes('Посуда'))return['kitchen'];if(w.includes('Канц'))return['office'];if(w.includes('Зоо'))return['pets'];if(w.includes('Авто'))return['auto'];return['kitchen'];}
 if(s.cat==='serv')return['service'];
 return['generic'];}
const PALETTE=['#2f6fb5','#d9502b','#2e9e6b','#e0b23a','#7b4fc4','#222428','#e8e4dc','#c23b5a','#3fa7c9','#8a6a4a','#5a6b7c','#f07c2a'];
function catalogOf(s){if(s._cat)return s._cat;const r=mulberry(s.id*97+13);const deps=deptsFor(s).map(k=>{const d=DEPT[k];return{key:k,title:d.t,icon:d.icon,model:d.model,lay:d.lay,items:d.items.map(([nm,pr],i)=>({name:nm,price:pr?Math.round(pr*(0.85+r()*0.3)/10)*10-(pr>500?10:0):0,color:PALETTE[Math.floor(r()*PALETTE.length)],icon:d.icon,dept:k,id:k+'-'+i}))};});
 s._cat=deps;return deps;}
const fmtPrice=p=>p?p.toLocaleString('ru-RU')+' ₽':'бесплатно';

export {SITES,siteOf,mapsOf,DEPT,deptsFor,PALETTE,catalogOf,fmtPrice};
