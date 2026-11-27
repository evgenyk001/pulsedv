import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseDomoplanerFeed} from '../src/domoplanerFeed';

const media = 'https://storage.yandexcloud.net/domoplaner/devmedia/1/p1/h1/';
const promo = media + 'flats/promo.jpg?v=1';
const drawing = media + 'flats/drawing.png?v=5';
const render = media + 'images/render.jpg?v=3';
const flat = (i: number, images: string[], renovation: string) => `
  <flat><flat_id>${i}</flat_id><apartment>${i}</apartment><floor>3</floor>
  <room>0</room><area>30.06</area><price>6000000.5</price>
  <housing_type>0</housing_type><renovation>${renovation}</renovation>
  <plans>${images.map(url => '<plan>' + url + '</plan>').join('')}</plans></flat>`;
const xml = (flats: string) => `<complexes><complex><id>123</id><name>ШОКОЛАД</name>
<address>г. Артем, ул. Первомайская, д. 4</address><images><image>${render}</image></images>
<buildings><building><id>456</id><name>Дом 1</name><floors>28</floors>
<address>Куйбышева, д. 11А</address><flats>${flats}</flats></building></buildings></complex></complexes>`;
const config = {projectName: 'ШОКОЛАД', domoplaner: {complexId: '123'}};
const generation = '2026-11-27T00:00:00Z';

test('Domoplaner selects drawings, keeps exact prices and imports each apartment finish', () => {
  const snapshot = parseDomoplanerFeed(xml(
    flat(1, [promo, drawing, render], 'предчистовая') +
    flat(2, [drawing, render], 'черновая') +
    flat(3, [drawing, render], 'чистовая'),
  ), config, 'Артём', generation);
  assert.deepEqual(snapshot.apartments.map(lot => lot.image), [drawing, drawing, drawing]);
  assert.deepEqual(snapshot.apartments.map(lot => lot.apartment.finishType), ['white_box', 'rough', 'finished']);
  assert.equal(snapshot.apartments[0].price, 6.0000005);
  assert.equal(new Set(snapshot.apartments.map(lot => lot.id)).size, 3);
  assert.equal(snapshot.projectBuildings[0].address, 'Куйбышева, д. 11А');
});

test('Domoplaner rejects unrelated or empty feeds and supports the first drawing position', () => {
  const data = xml(flat(1, [drawing, promo, render], ''));
  const first = {...config, domoplaner: {...config.domoplaner, firstImageIsPlan: true}};
  assert.equal(parseDomoplanerFeed(data, first, 'Артём', generation).apartments[0].image, drawing);
  assert.throws(() => parseDomoplanerFeed(data, first, 'Владивосток', generation), /неверный ЖК или город/);
  assert.throws(() => parseDomoplanerFeed(xml(''), first, 'Артём', generation), /пустая выгрузка/);
});
