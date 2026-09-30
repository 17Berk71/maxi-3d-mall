// Отделы магазинов, демо-товары и ссылки на сайты сетей.
// Товары и цены — примеры для концепта. Настоящие данные должны приходить из фидов магазинов.
// Ассортимент большой: из базовых товаров и настоящих цветов генерируются варианты — у каждого своё место на полке.
import {mulberry} from '../utils.js';
import {PHOTOS,PHOTO_BY_ITEM} from './photos.js';

// сайты — только проверенные адреса; для остальных магазинов открывается поиск на Яндекс Картах
const SITES={'Спортмастер Pro':'https://www.sportmaster.ru/','Лэтуаль':'https://www.letu.ru/','Рив Гош':'https://rivegauche.ru/','Gloria Jeans':'https://www.gloria-jeans.ru/','befree':'https://befree.ru/','Zarina':'https://zarina.ru/','Love Republic':'https://loverepublic.ru/','Henderson':'https://henderson.ru/','Zolla':'https://zolla.com/','Askona':'https://www.askona.ru/','Ormatek':'https://www.ormatek.com/','Sokolov':'https://sokolov.ru/','585 Золотой':'https://www.585zolotoy.ru/','Adamas':'https://www.adamas.ru/','Yves Rocher':'https://www.yves-rocher.ru/','Natura Siberica':'https://naturasiberica.ru/','билайн':'https://beeline.ru/','МегаФон | Yota':'https://moscow.megafon.ru/','T2':'https://t2.ru/','Снежная Королева':'https://snowqueen.ru/','Дом Лента':'https://lenta.com/','Перекрёсток Select':'https://www.perekrestok.ru/','Четыре Лапы':'https://4lapy.ru/','Копицентр Офисмаг':'https://www.officemag.ru/','Kuchenland Home':'https://www.kuchenland.ru/','Ригла':'https://www.rigla.ru/','Calzedonia':'https://www.calzedonia.com/ru/','Terranova':'https://terranovastyle.com/','Kanzler':'https://kanzler-style.ru/','Мир часов':'https://chasy71.ru/','2scoop':'https://tula.2scoop.ru/','Алеф':'https://alefmex.ru/',
 'ДНС':'https://www.dns-shop.ru/','Технопарк':'https://www.technopark.ru/','Детский мир':'https://www.detmir.ru/','Фамилия':'https://famil.ru/','Ostin':'https://ostin.com/','Zenden':'https://zenden.ru/','Kari':'https://kari.com/','Леонардо':'https://leonardo.ru/','Читай-город':'https://www.chitai-gorod.ru/','Синема Парк':'https://kinoteatr.ru/raspisanie-kinoteatrov/tula/maxi/','Ralf Ringer':'https://ralf.ru/','Бургер Кинг':'https://burgerkingrus.ru/','Вкусно — и точка':'https://vkusnoitochka.ru/',"Rostic's":'https://rostics.ru/'};
function siteOf(s){return SITES[s.name]||null;}
function mapsOf(s){return 'https://yandex.ru/maps/15/tula/search/'+encodeURIComponent(s.name+' ТРЦ Макси');}

// настоящие цвета: одежда, обувь, техника, мебель, косметика, игрушки
const PAL={
 wear:[['#1e1f22','чёрный'],['#3b3e44','графит'],['#243447','тёмно-синий'],['#3d5a80','синий деним'],['#5b6146','хаки'],['#cbb89d','бежевый'],['#b08855','кэмел'],['#6e2433','бордовый'],['#ecebe7','молочный'],['#9ea2a6','серый меланж'],['#5c4033','шоколадный'],['#9fb8cf','голубой'],['#d8b4b8','пудровый'],['#7a8a6c','оливковый']],
 shoe:[['#1e1f22','чёрный'],['#f2f0ea','белый'],['#3b3e44','графит'],['#8b6a4a','коричневый'],['#cbb89d','бежевый'],['#243447','тёмно-синий'],['#9ea2a6','серый'],['#6e2433','бордовый']],
 tech:[['#1c1d20','чёрный'],['#c9ccd0','серебристый'],['#3a3f47','графит'],['#e9e7e2','белый'],['#445a73','синий'],['#b9a48a','золотистый']],
 furn:[['#8f9094','серый'],['#cbbfae','бежевый'],['#3f5a4b','зелёный велюр'],['#344a63','синий велюр'],['#7b5b44','коричневый'],['#e2ddd4','молочный']],
 beauty:[['#d8a7a0','розовый'],['#b0413e','красный'],['#e6c9a8','нюд'],['#a67c52','золотистый'],['#f1e6d8','сливочный'],['#6b3a5b','сливовый'],['#c9d8e3','голубой']],
 toys:[['#c77b4a','рыжий'],['#8a6a4a','коричневый'],['#e8dcc8','кремовый'],['#9fb8cf','голубой'],['#d8b4b8','розовый'],['#7a8a6c','оливковый'],['#e0b23a','жёлтый']],
 metal:[['#d4af37','золото'],['#c0c3c7','серебро'],['#b76e5a','розовое золото']],
 goods:[['#6f8f7a','зелёный'],['#8b98a8','серо-голубой'],['#c3a57a','песочный'],['#8a5a4a','терракота'],['#5b6572','графит'],['#d7cfc2','светлый']],
 sport:[['#1e1f22','чёрный'],['#2b4a6f','синий'],['#a23b3b','красный'],['#3c6e4f','зелёный'],['#9ea2a6','серый'],['#e3e1dc','белый']],
 food:[['#f4f1ea','']]
};
// отделы: заголовок, иконка, модель, выкладка, палитра, товары [название, цена, модель?]
const DEPT={
 shoes:{t:'Обувь',icon:'shoe',model:'shoe',lay:'wall',pal:'shoe',items:[['Кроссовки беговые',5990],['Кроссовки для зала',4490],['Кеды',3290],['Кроссовки кожаные',7490],['Слипоны',2790],['Ботинки демисезонные',6990],['Ботинки зимние',8490],['Туфли',5490],['Лоферы',4990],['Кроссовки детские',2490]]},
 jackets:{t:'Верхняя одежда',icon:'jacket',model:'jacket',lay:'racks',pal:'wear',items:[['Пуховик с капюшоном',9990],['Куртка стёганая',6990],['Ветровка',3990],['Парка',8490],['Жилет утеплённый',3490],['Куртка-бомбер',5490],['Пальто',11990],['Софтшелл',5990]]},
 pants:{t:'Брюки и джинсы',icon:'pants',model:'pants',lay:'racks',pal:'wear',items:[['Джинсы прямые',3490],['Джинсы slim',3290],['Брюки чинос',2990],['Брюки классические',3990],['Джоггеры',2490],['Брюки карго',3190],['Шорты',1690]]},
 tshirts:{t:'Футболки, худи, свитеры',icon:'tshirt',model:'tshirt',lay:'racks',pal:'wear',items:[['Футболка базовая',990],['Футболка оверсайз',1290],['Поло',1790],['Лонгслив',1490,'longsleeve'],['Худи',3490,'longsleeve'],['Свитшот',2790,'longsleeve'],['Свитер вязаный',3290,'longsleeve'],['Рубашка',2290,'longsleeve']]},
 football:{t:'Футбол',icon:'football',model:'football',lay:'football',pal:'sport',items:[['Футбольный мяч',1990],['Бутсы',4790,'shoe'],['Щитки',890,'box'],['Вратарские перчатки',1690,'box'],['Игровая форма',2490,'tshirt'],['Складные ворота',5990,'box']]},
 basketball:{t:'Баскетбол',icon:'basketball',model:'basketball',lay:'basketball',pal:'sport',items:[['Баскетбольный мяч',2490],['Кольцо с сеткой',3490,'box'],['Баскетбольные кроссовки',8990,'shoe'],['Игровая форма',2790,'tshirt'],['Напульсники',490,'box'],['Уличная стойка',19990,'box']]},
 bikes:{t:'Велосипеды',icon:'bike',model:'bike',lay:'bikes',pal:'sport',items:[['Горный велосипед 27,5″',32990],['Городской велосипед',21990],['Детский велосипед 20″',9990],['Гравийный велосипед',45990]]},
 fitness:{t:'Фитнес',icon:'dumbbell',model:'dumbbell',lay:'fitness',pal:'sport',items:[['Гантель 5 кг',1490],['Гантель 3 кг',990],['Коврик для йоги',1490,'box'],['Скакалка',590,'box'],['Фитнес-резинки',790,'box'],['Скамья для жима',8990,'box']]},
 dresses:{t:'Платья и юбки',icon:'dress',model:'dress',lay:'racks',pal:'wear',items:[['Платье миди',3990],['Платье-рубашка',3490],['Платье трикотажное',2990],['Сарафан',2990],['Вечернее платье',6990],['Юбка плиссе',2490,'dress']]},
 accbox:{t:'Сумки и аксессуары',icon:'bag',model:'box',lay:'tables',pal:'goods',items:[['Сумка кожаная',4990],['Рюкзак городской',2990],['Ремень',1290],['Шарф',990],['Шапка',890],['Перчатки',790],['Кошелёк',1490]]},
 kidswear:{t:'Детская одежда',icon:'tshirt',model:'tshirt',lay:'racks',pal:'wear',items:[['Комбинезон зимний',4990,'jacket'],['Куртка детская',3990,'jacket'],['Футболка детская',590],['Пижама',1290,'longsleeve'],['Штаны детские',990,'pants'],['Платье детское',1490,'dress'],['Худи детское',1790,'longsleeve']],scale:0.72},
 toys:{t:'Игрушки',icon:'toy',model:'toy',lay:'wall',pal:'toys',items:[['Мягкий мишка',990],['Плюшевый зайка',890],['Конструктор',2490,'box'],['Настольная игра',1490,'box'],['Пазл 500 деталей',590,'box'],['Набор для творчества',790,'box']]},
 fun:{t:'Развлечения',icon:'toy',model:'toy',lay:'floor',pal:'toys',items:[['Разовый вход',500],['Абонемент на 5 посещений',2000],['День рождения',9900],['Игровой жетон',100]]},
 perfume:{t:'Парфюмерия',icon:'perfume',model:'bottle',lay:'counters',pal:'beauty',items:[['Туалетная вода 50 мл',4990],['Парфюмерная вода 50 мл',7990],['Парфюмерная вода 100 мл',11990],['Мини-формат 10 мл',1490],['Мужской аромат',5990]]},
 makeup:{t:'Макияж',icon:'lipstick',model:'tube',lay:'wall',pal:'beauty',items:[['Помада',890],['Тушь',790],['Тональный крем',1490],['Блеск для губ',690],['Карандаш для глаз',490]]},
 care:{t:'Уход',icon:'jar',model:'jar',lay:'wall',pal:'beauty',items:[['Крем для лица',1290],['Сыворотка',1990,'bottle'],['Крем для рук',290,'tube'],['Маска для лица',490],['Бальзам для губ',390,'tube']]},
 pharmacy:{t:'Аптека',icon:'jar',model:'box',lay:'wall',pal:'goods',items:[['Витамины',790],['Пластыри',150],['Термометр',690],['Крем',350,'tube'],['Маски медицинские',190]]},
 jewel:{t:'Украшения',icon:'ring',model:'small',lay:'counters',pal:'metal',items:[['Кольцо',12990],['Серьги',6990],['Цепочка',2990],['Подвеска',3490],['Браслет',4990],['Обручальное кольцо',15990]]},
 watch:{t:'Часы',icon:'watch',model:'small',lay:'counters',pal:'metal',items:[['Часы наручные',6990],['Смарт-часы',12990],['Часы механические',19990],['Ремешок',990]]},
 glasses:{t:'Оптика',icon:'glasses',model:'small',lay:'wall',pal:'metal',items:[['Оправа',4990],['Солнцезащитные очки',3990],['Футляр для очков',490]]},
 phones:{t:'Смартфоны',icon:'phone',model:'phone',lay:'tables',pal:'tech',items:[['Смартфон 128 ГБ',24990],['Смартфон 256 ГБ',34990],['Смартфон флагманский',79990],['Планшет 11″',34990],['Кнопочный телефон',1990]]},
 phoneacc:{t:'Аксессуары',icon:'headphones',model:'box',lay:'wall',pal:'tech',items:[['Чехол',990],['Защитное стекло',690],['Беспроводные наушники',4990],['Зарядное устройство',1290],['Кабель',490],['Пауэрбанк',1990]]},
 laptops:{t:'Ноутбуки',icon:'laptop',model:'laptop',lay:'tables',pal:'tech',items:[['Ноутбук 15,6″',54990],['Ноутбук 14″',49990],['Игровой ноутбук',99990],['Ультрабук',79990]]},
 tv:{t:'Телевизоры',icon:'tv',model:'tv',lay:'wall',pal:'tech',items:[['Телевизор 43″',27990],['Телевизор 50″ 4K',37990],['Телевизор 55″ 4K',44990],['Телевизор 65″',69990]]},
 appliance:{t:'Бытовая техника',icon:'fridge',model:'appliance',lay:'floor',pal:'tech',items:[['Холодильник',54990],['Холодильник двухкамерный',64990],['Морозильник',24990],['Стиральная машина',39990,'appliance']]},
 sofa:{t:'Диваны и кресла',icon:'sofa',model:'sofa',lay:'floor',pal:'furn',items:[['Диван прямой',34990],['Диван-кровать',39990],['Диван угловой',49990],['Модульный диван',69990]]},
 bed:{t:'Кровати и матрасы',icon:'bed',model:'bed',lay:'floor',pal:'furn',items:[['Кровать 160×200',39990],['Кровать 140×200',34990],['Кровать с подъёмным механизмом',49990]]},
 kitchen:{t:'Посуда и кухня',icon:'pot',model:'jar',lay:'wall',pal:'goods',items:[['Кастрюля',2990],['Сковорода',2490],['Набор ножей',3990,'box'],['Чайник',1990],['Контейнеры',790,'box']]},
 office:{t:'Канцтовары',icon:'box',model:'box',lay:'wall',pal:'goods',items:[['Тетрадь',120],['Ежедневник',590],['Ручки, набор',190],['Рюкзак школьный',2990],['Пенал',490]]},
 grocery:{t:'Продукты',icon:'bag',model:'box',lay:'wall',pal:'goods',items:[['Хлеб',70],['Молоко',95],['Сыр',349],['Готовая еда',299],['Напитки',89]]},
 garden:{t:'Сад и дача',icon:'pot',model:'jar',lay:'wall',pal:'goods',items:[['Семена',49],['Грунт',299,'box'],['Кашпо',490],['Садовый инструмент',990,'box'],['Удобрения',390,'box']]},
 pets:{t:'Зоотовары',icon:'bone',model:'box',lay:'wall',pal:'goods',items:[['Корм для кошек',990],['Корм для собак',1490],['Наполнитель',590],['Игрушка для питомца',290,'toy'],['Поводок',690]]},
 sportfood:{t:'Спортивное питание',icon:'jar',model:'jar',lay:'wall',pal:'goods',items:[['Протеин 900 г',2990],['Гейнер',2490],['BCAA',1490],['Витамины',790,'box'],['Шейкер',390]]},
 auto:{t:'Автотовары',icon:'box',model:'box',lay:'wall',pal:'goods',items:[['Авточехлы',5990],['Коврики',2490],['Органайзер',990],['Держатель телефона',690],['Щётка',390]]},
 sweets:{t:'Сладости',icon:'candy',model:'box',lay:'wall',pal:'goods',items:[['Мармелад',199],['Шоколад',249],['Пастила',390],['Подарочный набор',990]]},
 gifts:{t:'Подарки',icon:'gift',model:'box',lay:'tables',pal:'goods',items:[['Подарочный набор',1490],['Свеча',590,'jar'],['Кружка',490,'cup'],['Сувенир',390],['Подарочная карта',1000]]},
 coffee:{t:'Меню',icon:'cup',model:'cup',lay:'cafe',pal:'food',items:[['Капучино',220],['Латте',240],['Американо',180],['Раф',270],['Какао',210]]},
 menu:{t:'Меню',icon:'plate',model:'cup',lay:'cafe',pal:'food',items:[['Блюдо дня',490],['Салат',390],['Суп дня',290],['Десерт',290],['Лимонад',250]]},
 bakery:{t:'Выпечка',icon:'plate',model:'cup',lay:'cafe',pal:'food',items:[['Круассан',120],['Пирог',350],['Эклер',150],['Кофе с собой',150]]},
 sushi:{t:'Меню',icon:'plate',model:'cup',lay:'cafe',pal:'food',items:[['Роллы',490],['Сет',1490],['Суп мисо',290],['Лимонад',220]]},
 pizza:{t:'Пицца',icon:'plate',model:'cup',lay:'cafe',pal:'food',items:[['Маргарита',490],['Пепперони',590],['Четыре сыра',640],['Лимонад',220]]},
 bliny:{t:'Блины',icon:'plate',model:'cup',lay:'cafe',pal:'food',items:[['Блин с ветчиной и сыром',290],['Блин со сгущёнкой',190],['Суп',260],['Морс',150]]},
 asian:{t:'Азиатская кухня',icon:'plate',model:'cup',lay:'cafe',pal:'food',items:[['Лапша вок',390],['Рис с курицей',360],['Суп том ям',420],['Чай',120]]},
 georgian:{t:'Грузинская кухня',icon:'plate',model:'cup',lay:'cafe',pal:'food',items:[['Хачапури',390],['Шаурма',290],['Шашлык',490],['Лимонад',180]]},
 indian:{t:'Индийская кухня',icon:'plate',model:'cup',lay:'cafe',pal:'food',items:[['Карри с курицей',420],['Рис басмати',190],['Лепёшка наан',120],['Ласси',190]]},
 bk:{t:'Меню',icon:'burger',model:'cup',lay:'cafe',pal:'food',items:[['Бургер',329],['Чизбургер',99],['Картофель фри',129],['Наггетсы',149],['Молочный коктейль',169]]},
 vkusno:{t:'Меню',icon:'burger',model:'cup',lay:'cafe',pal:'food',items:[['Бургер',289],['Чикенбургер',199],['Картофель по-деревенски',129],['Мороженое',99],['Кофе',129]]},
 rostics:{t:'Меню',icon:'burger',model:'cup',lay:'cafe',pal:'food',items:[['Крылья',399],['Твистер',249],['Стрипсы',219],['Бургер',239],['Лимонад',149]]},
 icecream:{t:'Мороженое',icon:'cup',model:'cup',lay:'cafe',pal:'food',items:[['Шарик мороженого',150],['Два шарика',270],['Молочный коктейль',290]]},
 movies:{t:'Билеты',icon:'ticket',model:'ticket',lay:'tables',pal:'goods',items:[['Билет на сеанс',450],['Билет в зал IMAX',650],['Билет в зал RELAX',850],['Детский сеанс',350],['Подарочный сертификат',1000]]},
 popcorn:{t:'Кинобар',icon:'popcorn',model:'cup',lay:'cafe',pal:'food',items:[['Попкорн большой',490],['Попкорн сырный',390],['Начос',350],['Напиток 0,5',190]]},
 hobby:{t:'Творчество',icon:'box',model:'box',lay:'wall',pal:'goods',items:[['Акварель, набор',690],['Холст на подрамнике',490],['Пряжа',199],['Набор для вышивки',890],['Кисти, набор',390],['Раскраска по номерам',990]]},
 books:{t:'Книги',icon:'book',model:'book',lay:'wall',pal:'goods',items:[['Роман',690],['Детская книга',490],['Комикс',790],['Энциклопедия',1290],['Учебник',590]]},
 textile:{t:'Текстиль',icon:'box',model:'box',lay:'tables',pal:'furn',items:[['Постельное бельё',2990],['Плед',1490],['Полотенце',490],['Подушка декоративная',790],['Шторы',2490]]},
 decor:{t:'Декор',icon:'gift',model:'jar',lay:'tables',pal:'goods',items:[['Ваза',890],['Свеча ароматическая',490],['Рамка для фото',390,'box'],['Часы настенные',1490,'box'],['Корзина для хранения',690,'box']]},
 bags:{t:'Сумки',icon:'bag',model:'box',lay:'tables',pal:'goods',items:[['Сумка кожаная',6990],['Рюкзак',3990],['Клатч',2490],['Кошелёк',1990],['Поясная сумка',1490],['Чемодан',8990]]},
 fur:{t:'Меха и пальто',icon:'jacket',model:'jacket',lay:'racks',pal:'wear',items:[['Шуба',59990],['Пальто',19990],['Дублёнка',29990],['Жилет меховой',9990]]},
 linen:{t:'Бельё',icon:'tshirt',model:'tshirt',lay:'racks',pal:'wear',items:[['Бюстгальтер',1990],['Трусы',590],['Пижама',2490,'longsleeve'],['Халат',2990,'longsleeve']]},
 service:{t:'Услуги',icon:'box',model:'box',lay:'tables',pal:'goods',items:[['Консультация',0],['Стандартная услуга',300],['Комплекс услуг',1200],['Подарочный сертификат',1000]]},
 generic:{t:'Товары',icon:'box',model:'box',lay:'wall',pal:'goods',items:[['Товар',990],['Набор',1990],['Новинка',1490]]}
};
// отделы для конкретных магазинов
const BY_NAME={'Спортмастер Pro':['shoes','jackets','pants','tshirts','football','basketball','bikes','fitness'],
 'ДНС':['phones','laptops','tv','appliance','phoneacc'],'Технопарк':['appliance','tv','phones','laptops'],'Синема Парк':['movies','popcorn'],'Касса кинотеатра':['movies'],
 'Бургер Кинг':['bk'],'Вкусно — и точка':['vkusno'],"Rostic's":['rostics'],'Ташир Пицца':['pizza'],'Томато':['pizza'],'Терем-теремок':['bliny'],'Азиатское бистро':['asian'],'Мясное шоу':['georgian'],'Вкус Индии':['indian'],
 'Gelateria Plombir':['icecream'],'Сова':['coffee'],'Suli&Co':['coffee'],'T&w Coffee Co':['coffee'],'Дружба':['menu'],'Снеки':['sweets'],
 'Леонардо':['hobby','office'],'Читай-город':['books','office'],'Детский мир':['kidswear','toys','shoes','fun'],'Фамилия':['jackets','dresses','tshirts','shoes','textile'],
 'Kari':['shoes','accbox'],'Империя Сумок':['bags','accbox'],'Apple Bags':['bags','accbox'],'Тверская меховая':['fur'],'Бель':['linen'],'Купи слона':['gifts','decor'],'Лолита':['accbox','gifts'],'Смешик':['gifts','toys']};
function deptsFor(s){const w=s.what||'',n=s.name;
 if(BY_NAME[n])return BY_NAME[n];
 if(s.cat==='fashion'&&/^Обувь/.test(w))return['shoes','accbox'];
 if(s.cat==='sport')return w.includes('питание')?['sportfood','fitness']:['shoes','tshirts','fitness','football'];
 if(s.cat==='fashion'){if(w.includes('Кроссовки'))return['shoes','accbox'];if(w.includes('Мужская'))return['jackets','pants','tshirts','shoes'];return['jackets','pants','tshirts','dresses','shoes','accbox'];}
 if(s.cat==='kids')return /одежда|обувь/i.test(w)?['kidswear','toys','shoes']:w.includes('Кигуруми')?['kidswear','toys']:['fun','toys'];
 if(s.cat==='beauty')return w==='Аптека'?['pharmacy','care']:w==='Косметика'?['care','makeup']:['perfume','makeup','care'];
 if(s.cat==='acc')return w==='Часы'?['watch','jewel']:w==='Оптика'?['glasses','phoneacc']:['jewel','watch'];
 if(s.cat==='tech')return w==='Бытовая техника'?['appliance']:/телефон/i.test(w)?['phoneacc']:['phones','phoneacc'];
 if(s.cat==='food')return w==='Кофейня'||w.includes('Кофе')?['coffee']:w==='Пекарня'?['bakery']:w==='Суши'?['sushi']:w==='Пиццерия'?['pizza']:w==='Магазин у дома'||w.includes('Микрозелень')?['grocery']:['menu'];
 if(s.cat==='gifts')return w==='Подарки'?['gifts']:['sweets'];
 if(s.cat==='furn')return w.includes('Матрасы')?['bed','sofa']:['sofa','bed'];
 if(s.cat==='home'){if(w.includes('Гипермаркет'))return['kitchen','garden','office','auto'];if(w.includes('сада'))return['garden'];if(w.includes('Посуда'))return['kitchen'];if(w.includes('Канц')||w.includes('Книги'))return['books','office'];if(w.includes('Зоо'))return['pets'];if(w.includes('Авто'))return['auto'];return['kitchen','textile','decor'];}
 if(s.cat==='serv')return['service'];
 return['generic'];}
const PALETTE=PAL.goods.map(c=>c[0]).concat(PAL.wear.slice(0,6).map(c=>c[0]));
// товар номер k отдела: базовый товар × цвет × модель; список растёт, пока хватает мест на полках
function makeItem(shopId,key,d,k){const base=d.items,nb=base.length,pal=PAL[d.pal]||PAL.goods,np=pal.length;
 const b=base[k%nb],round=Math.floor(k/nb),col=pal[(round*3+Math.floor(k*1.7))%np];
 const r=mulberry(shopId*7919+k*131+key.length*17);const pr=b[1];
 const price=pr?Math.max(49,Math.round(pr*(0.82+r()*0.46)/10)*10-(pr>500?10:0)):0;
 const line=round>=np?' · модель '+(Math.floor(round/np)+1):'';
 const nm=col[1]?b[0]+', '+col[1]+line:b[0]+(round?' · вариант '+(round+1):'');
 const ph=PHOTO_BY_ITEM[b[0]];
 // есть фото настоящей вещи — цвет и название берём с фото (пока пример; дальше — свои фото под каждый магазин)
 if(ph){const P=PHOTOS[ph];return{name:b[0]+', '+P.colorName+(round?' · вариант '+(round+1):''),price,color:P.color,colorName:P.colorName,icon:d.icon,dept:key,model:b[2]||d.model,scale:d.scale||1,photo:ph,id:key+'-'+shopId+'-'+k};}
 return{name:nm,price,color:col[0],colorName:col[1],icon:d.icon,dept:key,model:b[2]||d.model,scale:d.scale||1,id:key+'-'+shopId+'-'+k};}
function catalogOf(s){if(s._cat)return s._cat;const deps=deptsFor(s).map(k=>{const d=DEPT[k];const food=d.lay==='cafe';const N=food?d.items.length:Math.max(48,d.items.length*6);
  const dep={key:k,title:d.t,icon:d.icon,model:d.model,lay:d.lay,items:[],itemAt(i){while(dep.items.length<=i)dep.items.push(makeItem(s.id,k,d,dep.items.length));return dep.items[i];}};
  for(let i=0;i<N;i++)dep.itemAt(i);return dep;});
 s._cat=deps;return deps;}
const fmtPrice=p=>p?p.toLocaleString('ru-RU')+' ₽':'бесплатно';

export {SITES,siteOf,mapsOf,DEPT,deptsFor,PALETTE,catalogOf,fmtPrice,PHOTOS};
