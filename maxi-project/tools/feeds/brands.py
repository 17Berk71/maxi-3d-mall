"""Как бренды магазинов «Макси» называются в выгрузках партнёрских сетей.
Ключ — имя магазина на нашей карте, значение — варианты поля vendor/brand в выгрузке.
Дополняй, когда подключаешь новую выгрузку: загрузчик печатает бренды, которые не узнал."""
ALIASES = {
    'Ostin': ["O'STIN", 'O′STIN', 'OSTIN', "O'stin"],
    'befree': ['Befree', 'BEFREE'],
    'Gloria Jeans': ['GLORIA JEANS', 'Gloria-Jeans'],
    'Love Republic': ['LOVE REPUBLIC', 'LoveRepublic'],
    'Tom Tailor': ['TOM TAILOR', 'Tom Tailor Denim'],
    "Levi's": ['Levis', "LEVI'S", 'Levi Strauss'],
    'Zarina': ['ZARINA'], 'Zolla': ['ZOLLA'], 'Kanzler': ['KANZLER'], 'Henderson': ['HENDERSON'],
    'Ralf Ringer': ['RALF RINGER', 'Ralf'], 'Rieker': ['RIEKER'], 'Thomas Munz': ['THOMAS MUNZ'], 'Zenden': ['ZENDEN'],
    'Calzedonia': ['CALZEDONIA'], 'Terranova': ['TERRANOVA'], 'Incanto': ['INCANTO'], 'U.S. Polo Assn': ['U.S. POLO ASSN.', 'US Polo Assn'],
    'Camel Active': ['CAMEL ACTIVE'], 'Acoola': ['ACOOLA'], 'Котофей': ['Kotofey', 'КОТОФЕЙ'], 'Kari': ['KARI'],
    'Спортмастер Pro': ['Спортмастер', 'Sportmaster'], 'Лэтуаль': ["Л'Этуаль", 'Letual'], 'Рив Гош': ['Rive Gauche'],
    'Yves Rocher': ['YVES ROCHER'], 'Natura Siberica': ['NATURA SIBERICA'], 'Sokolov': ['SOKOLOV', 'SL'], '585 Золотой': ['585*ЗОЛОТОЙ'],
    'Askona': ['ASKONA', 'Аскона'], 'Ormatek': ['ORMATEK', 'Орматек'], 'Детский мир': ['Detmir'], 'ДНС': ['DNS'],
}
# у этих магазинов нет смысла в онлайн-витрине, даже если бренд встретится в выгрузке
NOT_ONLINE = {'Синема Парк', 'Касса кинотеатра', 'Бери заряд'}
