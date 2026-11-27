import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {SaxesParser} from 'saxes';
import sharp from 'sharp';
import {z} from 'zod';

export const domoplanerUrl = z.string().regex(/^https:\/\/domoplaner\.ru\/dc-api\/feeds\/[0-9]+-[A-Za-z0-9]+\/$/);
const imageUrl = /^https:\/\/storage\.yandexcloud\.net\/domoplaner\/[A-Za-z0-9_./-]+\.(?:jpg|jpeg|png|webp)(?:\?v=\d+)?$/i;
const complexPath = 'complexes/complex';
const buildingPath = complexPath + '/buildings/building';
const flatPath = buildingPath + '/flats/flat';
const required = z.string().trim().min(1).max(120);
const numericId = z.string().regex(/^\d+$/);
const positive = z.string().regex(/^\d+(?:[.,]\d+)?$/).transform(value => Number(value.replace(',', '.'))).pipe(z.number().finite().positive());
const integer = positive.pipe(z.number().int());
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const finishTypes = new Map([
  ['черновая', 'rough'], ['предчистовая', 'white_box'], ['чистовая', 'finished'],
] as const);

type DomoplanerConfig = {projectName: string; domoplaner: {complexId: string; firstImageIsPlan?: boolean}};
type DomoplanerApartment = {
  id: string; externalId: string; roomLabel: string; area: number; price: number; image: string; drawingCandidates?: string[];
  apartment: {building: string; entrance: null; number: string; floor: number; floorsTotal: number; finishType: string | null};
};
type Fields = Record<string, string>;
type Building = {fields: Fields; flats: {fields: Fields; plans: string[]}[]};

const normalizedName = (name: string) => name.trim().toLowerCase().replace(/ё/g, 'е');

export function parseDomoplanerFeed(xml: string, config: DomoplanerConfig, city: string, generation: string) {
  const parser = new SaxesParser({xmlns: true});
  const path: string[] = [];
  const project: Fields = {};
  const buildings: Building[] = [];
  const images: string[] = [];
  let building: Building | undefined;
  let flat: Building['flats'][number] | undefined;
  let text = '';
  let complexes = 0;

  parser.on('doctype', () => { throw new Error('DTD запрещён'); });
  parser.on('opentag', tag => {
    if (tag.uri || (!path.length && tag.local !== 'complexes')) throw new Error('Неизвестный формат Domoplaner');
    path.push(tag.local);
    const key = path.join('/');
    if (key === complexPath) complexes++;
    if (key === buildingPath) building = {fields: {}, flats: []};
    if (key === flatPath) flat = {fields: {}, plans: []};
    text = '';
  });
  parser.on('text', value => { text += value; });
  parser.on('cdata', value => { text += value; });
  parser.on('closetag', () => {
    const key = path.join('/');
    const value = text.trim();
    const tag = path.at(-1)!;
    if (path.length === 3) project[tag] = value;
    if (key === complexPath + '/description_main/text') project.description = value;
    if (key === complexPath + '/developer/name') project.developer = value;
    if (key === complexPath + '/images/image' && imageUrl.test(value)) images.push(value);
    if (building && path.length === 5) building.fields[tag] = value;
    if (flat && path.length === 7) flat.fields[tag] = value;
    if (flat && key === flatPath + '/plans/plan') flat.plans.push(value);
    if (key === flatPath && building && flat) building.flats.push(flat);
    if (key === buildingPath && building) buildings.push(building);
    path.pop();
    text = '';
  });
  parser.write(xml).close();
  const feedCity = project.address?.split(',')[0].replace(/^г\s*\.\s*/i, '') ?? '';
  if (complexes !== 1 || project.id !== config.domoplaner.complexId ||
      normalizedName(project.name ?? '') !== normalizedName(config.projectName) ||
      normalizedName(feedCity) !== normalizedName(city)) throw new Error('Domoplaner: неверный ЖК или город');

  const buildingIds = new Set<string>();
  const lotIds = new Set<string>();
  const gallery = new Set(images);
  const apartments: DomoplanerApartment[] = [];
  const projectBuildings = buildings.map(({fields, flats}) => {
    const id = numericId.parse(fields.id);
    const name = required.parse(fields.name);
    const floors = integer.parse(fields.floors);
    if (buildingIds.has(id)) throw new Error('Domoplaner: дубли корпусов');
    buildingIds.add(id);
    const numbers = new Set<string>();
    for (const {fields: lot, plans} of flats) {
      if (lot.housing_type !== '0') continue;
      const externalId = numericId.parse(lot.flat_id);
      const number = required.parse(lot.apartment);
      const floor = integer.parse(lot.floor);
      const rooms = numericId.parse(lot.room);
      if (lotIds.has(externalId) || numbers.has(number) || floor > floors) throw new Error('Domoplaner: некорректный лот');
      lotIds.add(externalId);
      numbers.add(number);
      // Atlant lists an optional branded preview before the plan. Some offers start with the bare plan.
      // Greenhills lists the apartment drawing first, followed by optional visualizations.
      const first = plans[0];
      const second = plans[1];
      const drawing = !config.domoplaner.firstImageIsPlan && second?.includes('/flats/') && !gallery.has(second)
        ? second : first;
      const isApartmentMedia = (url: string | undefined): url is string =>
        Boolean(url && url.includes('/flats/') && imageUrl.test(url) && !gallery.has(url));
      const drawingCandidates = project.id === '120013' ? plans.slice(0, 2).filter(isApartmentMedia) : undefined;
      const image = isApartmentMedia(drawing) ? drawing : '';
      apartments.push({
        id: 'feed-' + sha('domoplaner:' + project.id + ':' + externalId).slice(0, 32),
        externalId, roomLabel: rooms === '0' ? 'Студия' : rooms,
        area: positive.parse(lot.area), price: positive.parse(lot.price) / 1_000_000, image, drawingCandidates,
        apartment: {building: name, entrance: null, number, floor, floorsTotal: floors,
          finishType: finishTypes.get(lot.renovation as Parameters<typeof finishTypes.get>[0]) ?? null},
      });
    }
    return {
      id: 'domoplaner-' + id, name, phase: '', sections: '',
      status: 'unknown' as const, address: fields.address || null,
      deliveryYear: /^20\d{2}$/.test(fields.built_year) ? Number(fields.built_year) : null,
      deliveryQuarter: /^[1-4]$/.test(fields.ready_quarter) ? Number(fields.ready_quarter) : null,
      floorsFrom: floors, floorsTo: floors, commissioningDate: null, handoverDate: null,
      totalApartments: null, availableApartments: numbers.size,
      latitude: Number(fields.latitude), longitude: Number(fields.longitude),
    };
  });
  if (!apartments.length || !apartments.some(lot => lot.image)) throw new Error('Domoplaner: пустая выгрузка');
  return {generation, apartments, project, projectBuildings, images};
}

// The clean Greenwood drawings are printed on white sheets. Photos and the
// developer's green advertising cards appear in the same XML image list.
async function isGreenwoodDrawing(file: string) {
  const {data, info: {width, height}} = await sharp(file)
    .removeAlpha().toColourspace('srgb').resize(96, 96, {fit: 'fill'}).raw()
    .toBuffer({resolveWithObject: true});
  let white = 0;
  let ink = 0;
  let border = 0;
  let whiteBorder = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      const low = Math.min(data[offset], data[offset + 1], data[offset + 2]);
      const high = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      const isWhite = low >= 242;
      if (isWhite) white++;
      if (low < 208 && high - low < 25) ink++;
      if (x < 4 || x >= width - 4 || y < 4 || y >= height - 4) {
        border++;
        if (isWhite) whiteBorder++;
      }
    }
  }
  const pixels = width * height;
  return white / pixels >= 0.58 && whiteBorder / border >= 0.90 && ink / pixels >= 0.005;
}

async function normalizeImage(url: string, root: string, cache: string) {
  const key = sha(url);
  const cacheFile = join(cache, key);
  const previous = await readFile(cacheFile, 'utf8').catch(() => '');
  if (/^[a-f0-9]{64}$/.test(previous)) return '/media/domoplaner-plans/' + previous + '.webp';
  const response = await fetch(url, {redirect: 'error', signal: AbortSignal.timeout(7_000)});
  if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Domoplaner: нет изображения');
  const chunks: Buffer[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) throw new Error('Domoplaner: слишком большой файл');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  const png = await sharp(Buffer.concat(chunks), {limitInputPixels: 16_000_000})
    .rotate().flatten({background: '#fff'}).toColourspace('srgb').png().toBuffer();
  const digest = sha(png);
  const result = join(root, digest + '.webp');
  const temporary = result + '.' + randomUUID() + '.tmp';
  try {
    await sharp(png).resize({width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true})
      .webp({quality: 90}).toFile(temporary);
    await rename(temporary, result);
    const cacheTemp = cacheFile + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(cacheTemp, digest, {mode: 0o600});
      await rename(cacheTemp, cacheFile);
    } finally { await rm(cacheTemp, {force: true}); }
  } finally { await rm(temporary, {force: true}); }
  return '/media/domoplaner-plans/' + digest + '.webp';
}

export async function cacheDomoplanerPlans(apartments: DomoplanerApartment[], mediaRoot: string) {
  const root = join(mediaRoot, 'domoplaner-plans');
  const cache = join(mediaRoot, 'private', 'domoplaner-plans');
  await mkdir(root, {recursive: true});
  await mkdir(cache, {recursive: true, mode: 0o700});
  const urls = [...new Set(apartments.flatMap(lot => lot.drawingCandidates ?? [lot.image]).filter(Boolean))].values();
  const local = new Map<string, string>();
  const drawingsOnly = apartments.some(lot => lot.drawingCandidates);
  async function consume() {
    for (const url of urls) {
      try {
        const path = await normalizeImage(url, root, cache);
        if (!drawingsOnly || await isGreenwoodDrawing(join(root, path.split('/').at(-1)!))) local.set(url, path);
      } catch { /* Retry unavailable images on the next sync. */ }
    }
  }
  await Promise.all(Array.from({length: 8}, consume));
  return apartments.map(lot => {
    const {drawingCandidates, ...apartment} = lot;
    const image = drawingCandidates
      ? (drawingCandidates.map(url => local.get(url)).find(Boolean) ?? '')
      : (local.get(lot.image) ?? lot.image);
    return {...apartment, image};
  });
}
