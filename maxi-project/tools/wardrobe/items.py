"""Вещи пользователя: какое фото — какая вещь и какой вид.
В выгрузке магазина то же самое приходит готовым: фото товара (обычно 2–5 ракурсов), название, категория, цвет.
front/back — каталожные фото (на вешалке или лёжа); worn — фото на человеке (для сравнения и состояний).
"""
ITEMS = [
    # id, название, тип (как в classify), фото спереди, фото сзади, фото на человеке, состояния.
    # Посадка: elastic — пояс на резинке (лёжа он собран), crop — укороченная вещь,
    # cm — мерки с бирки или сантиметром, если есть: {'len': длина по спинке, 'chest': ширина в груди лёжа, 'waist': пояс лёжа, 'outseam': длина брюк по боку}
    dict(id='zolla-tee', name='Футболка базовая Zolla', kind='tee', front='d6cbc787', back='debeed5c', flat='60a8f89b', worn=['299304a0', '96542ff8']),
    dict(id='qs-tee', name='Футболка оверсайз «Quiet Supremacy»', kind='tee', front='6af4c56f', back='26fd3eb4', worn=['2330cb00', '10ecb09e']),
    dict(id='suede-tee', name='Футболка замшевая с кантом', kind='tee', front='09b4dfde', back='ed7df16c', worn=['871d9e5b', 'a5e4b13e']),
    dict(id='glo-tee', name='Футболка Glo Gang', kind='tee', front='aad6e215', back='819777c8', worn=['27d9cca4', 'a691f022']),
    dict(id='polo', name='Поло «Venichtens»', kind='tee', collar=True, front='a48dfae4', back='5478f592', worn=['a78239c7', '8188baad']),
    dict(id='rib-long', name='Лонгслив в рубчик', kind='sweater', front='07fcd5c7', back='0db0db60', worn=['5cd206e6', '8a13ec42'],
         states=[('loose', 'Навыпуск'), ('tucked', 'Заправлен')], worn_states={'tucked': '7a30274a'}),
    dict(id='knit-polo', name='Свитер-поло вязаный на молнии', kind='sweater', collar=True, front='148a3c47', back='496cb56b', worn=['7a208de3', '456a03df']),
    dict(id='ghost-sweat', name='Свитшот с фигурами', kind='sweater', front='f2610e08', back='7b122ab5', worn=['58eea924', '40c34949']),
    dict(id='ami-zip', name='Зипка AMI', kind='hoodie', zip=True, front='75d37f40', back='0544f581', worn=['03ebe21b', '10dd47f0'],
         states=[('closed', 'Застёгнута'), ('open', 'Расстёгнута'), ('hood', 'Капюшон')], worn_states={'open': 'a99ee68f', 'hood': '2fd62240'}),
    dict(id='patch-zip', name='Зипка пэчворк', kind='hoodie', zip=True, front='b2c8342a', back='a75c1160', worn=['b2e57225', 'be05d4b3'],
         states=[('closed', 'Застёгнута'), ('open', 'Расстёгнута'), ('hood', 'Капюшон')], worn_states={'open': '9e374bcc', 'hood': 'f5c93b4f'}),
    dict(id='blazer', name='Пиджак укороченный', kind='jacket', crop=True, front='bc8f4254', back='723787be', worn=['44137c8e', 'f5b54112'],
         states=[('open', 'Нараспашку'), ('closed', 'Застёгнут')]),
    dict(id='barrel-jeans', name='Джинсы широкие «бочка»', kind='jeans', front='9e18a85c', back='3df4cd22', worn=['28155c96', '02244c91']),
    dict(id='brown-pants', name='Брюки на резинке', kind='pants', elastic=True, front='3ee4d24c', back='65e4e52b', worn=['fdf4f8dd', 'f5b54112x']),
    dict(id='nike-pants', name='Штаны нейлоновые Nike', kind='pants', elastic=True, front='a6435039', back='40f40230', worn=['afdd9abd', '8bb621b4']),
    dict(id='cream-shorts', name='Шорты джинсовые', kind='shorts', front='e7268e0b', back='c8f49e61', worn=['a7529a3a', '9e360828']),
]
