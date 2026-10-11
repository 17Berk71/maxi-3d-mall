// Что это за вещь: слот (верх, низ, платье, обувь…) и форма (футболка, джинсы, юбка…).

// ---------- что это за вещь: слот и форма ----------
const KIND_SLOT = {tee: 'top', sweater: 'top', shirt: 'top', hoodie: 'top', jacket: 'outer', coat: 'outer', puffer: 'outer', vest: 'outer', dress: 'dress',
  pants: 'bottom', jeans: 'bottom', shorts: 'bottom', skirt: 'bottom', sneaker: 'shoes', boot: 'shoes', shoe: 'shoes'};
export function classify(p) {
  // зипка (худи на молнии) носится поверх футболки — это верхний слой, а не «верх»
  if (p.kind && KIND_SLOT[p.kind]) return {slot: p.kind === 'hoodie' && p.zip ? 'outer' : KIND_SLOT[p.kind], kind: p.kind};
  const n = (p.name || '').toLowerCase(), m = p.model;
  const has = re => re.test(n);
  if (m === 'shoe' || has(/кроссов|кед|слипон|ботин|сапог|туфл|лофер|бутс|мокасин|сандал|босонож/))
    return {slot: 'shoes', kind: has(/ботин|сапог/) ? 'boot' : has(/туфл|лофер|мокасин/) ? 'shoe' : 'sneaker'};
  if (has(/платье|сарафан/)) return {slot: 'dress', kind: 'dress'};
  if (has(/юбк/)) return {slot: 'bottom', kind: 'skirt'};
  if (has(/шорт/)) return {slot: 'bottom', kind: 'shorts'};
  if (has(/джинс/)) return {slot: 'bottom', kind: 'jeans'};
  if (m === 'pants' || has(/брюк|джоггер|карго|чинос|штан|леггин|легинс/)) return {slot: 'bottom', kind: 'pants'};
  if (has(/пуховик|парк|пальто|тренч|комбинезон/)) return {slot: 'outer', kind: has(/пуховик|комбинезон/) ? 'puffer' : 'coat'};
  if (has(/жилет/)) return {slot: 'outer', kind: 'vest'};
  if (m === 'jacket' || has(/куртк|бомбер|ветровк|софтшелл|пиджак|жакет|косух/)) return {slot: 'outer', kind: 'jacket'};
  if (has(/худи|толстовк|зипк/)) return {slot: 'top', kind: 'hoodie'};
  if (has(/рубаш|блуз/)) return {slot: 'top', kind: 'shirt'};
  if (m === 'longsleeve' || has(/свитер|свитшот|джемпер|лонгслив|кардиган|водолазк|пижам/)) return {slot: 'top', kind: 'sweater'};
  if (m === 'tshirt' || has(/футболк|поло|майк|топ|форма/)) return {slot: 'top', kind: 'tee'};
  if (m === 'dress') return {slot: 'dress', kind: 'dress'};
  return null;
}
export const isWearable = p => !!classify(p);
