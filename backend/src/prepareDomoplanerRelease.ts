import {readFileSync} from 'node:fs';
import {parseFeedConfig, readDomoplanerSnapshot, type FeedConfig} from './catalogFeed';
import {postgresDatabase, type Sql} from './database';
import {upsertCatalogProperty, type CatalogProperty} from './catalogRepository';

const specs = [
  {projectName: 'ВИЗИОНЕР', city: 'Владивосток', complexId: '124849', propertyId: 'vdk26-6684de88d320', aliases: ['визионер']},
  {projectName: 'КАСКАДА', city: 'Владивосток', complexId: '124848', propertyId: 'vdk26-35db7e009c61', aliases: ['каскада', 'каскаду']},
  {projectName: 'ШОКОЛАД', city: 'Артём', complexId: '124810', propertyId: 'domoplaner-124810', aliases: ['шоколад']},
  {projectName: 'GREENWOOD', city: 'Владивосток', complexId: '120013', propertyId: 'vdk26-f633dc72ccbf', aliases: ['greenwood', 'гринвуд']},
  {projectName: 'ЖК Гринхилс', city: 'Владивосток', complexId: '118870', propertyId: 'domoplaner-118870', aliases: ['гринхилс', 'гринхиллс', 'greenhills']},
] as const;
const normalize = (value: string) => value.toLowerCase().replace(/ё/g, 'е').replace(/^жк\s*/u, '').replace(/[^а-яa-z0-9]/gu, '');

function makeDraft(feed: FeedConfig, snapshot: Awaited<ReturnType<typeof readDomoplanerSnapshot>>): CatalogProperty {
  const chocolate = feed.domoplaner?.complexId === '124810';
  const name = chocolate ? 'ЖК «Шоколад»' : 'ЖК «Гринхилс»';
  const first = snapshot.projectBuildings[0];
  if (!first || !Number.isFinite(first.latitude) || !Number.isFinite(first.longitude) || !snapshot.images.length) {
    throw new Error('Недостаточно данных для карточки');
  }
  const buildings = snapshot.projectBuildings.map(({latitude, longitude, ...building}, index) => ({
    ...building,
    status: chocolate || index !== 0 ? 'building' as const : 'completed' as const,
    // The registry and feed disagree on the quarter for Chocolate. Leave it for review.
    ...(chocolate ? {deliveryQuarter: null} : {}),
  }));
  const areas = snapshot.apartments.map(lot => lot.area);
  return {
    id: feed.propertyId, name, city: chocolate ? 'Артём' : 'Владивосток', district: chocolate ? '' : 'Зелёный угол',
    status: 'draft', address: chocolate ? 'ул. Куйбышева, 11А' : 'ул. Расула Гамзатова, 7',
    latitude: first.latitude, longitude: first.longitude,
    developerName: chocolate ? 'ООО СЗ «Атлантстрой»' : 'ООО СЗ «Жилой комплекс Гринхилс»',
    className: '', delivery: '',
    description: chocolate
      ? 'Жилой комплекс «Шоколад» в Артёме. В каталоге представлены квартиры с черновой и предчистовой отделкой.'
      : (snapshot.project.description || 'Жилой комплекс в микрорайоне Зелёный угол во Владивостоке.'),
    priceFrom: Math.min(...snapshot.apartments.map(lot => lot.price)),
    coverImageUrl: snapshot.images[0], sortOrder: 999, tags: [],
    images: snapshot.images.map((url, sortOrder) => ({url, alt: name, sortOrder})),
    features: [], floorplans: [],
    projectDetails: {buildings, commissioningDate: null, totalApartments: null,
      availableApartments: snapshot.apartments.length, areaFrom: Math.min(...areas), areaTo: Math.max(...areas)},
  };
}

async function exposeFeedFinishes(sql: Sql) {
  const [{definition}] = (await sql.query(
    "select pg_get_viewdef('catalog_public_floorplans'::regclass, true) as definition",
  )).rows;
  const marker = '/* domoplaner finish */';
  const expression = "CASE WHEN f.apartment ->> 'finishType' IN ('rough', 'white_box', 'finished') " +
    "THEN f.apartment ->> 'finishType' ELSE NULL::text END AS finish_type";
  if (definition.includes("f.apartment ->> 'finishType'")) return;
  const feedSection = /NULL::text AS finish_type(?=,\s*'\[\]'::jsonb AS finish_options[\s\S]*?FROM catalog_feed_apartments f\b)/g;
  if ([...definition.matchAll(feedSection)].length !== 1) {
    throw new Error('Не удалось однозначно определить колонку отделки в каталоге');
  }
  await sql.query('create or replace view catalog_public_floorplans as ' +
    definition.replace(feedSection, marker + ' ' + expression));
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL отсутствует');
const db = postgresDatabase(databaseUrl);
try {
  const input = JSON.parse(readFileSync(0, 'utf8')) as {existing: unknown; urls: string[]};
  const current = parseFeedConfig(JSON.stringify(input.existing));
  if (process.argv.includes('--status')) {
    const ids = current.filter(feed => feed.domoplaner).map(feed => feed.propertyId);
    const rows = (await db.query(`select p.name,p.status,s.successful_at,s.error,coalesce(i.available,0) as available
      from catalog_properties p left join catalog_feed_state s on s.property_id=p.id
      left join catalog_feed_inventory i on i.property_id=p.id
      where p.id=any($1::text[]) order by p.name`, [ids])).rows;
    console.table(rows);
    if (rows.length !== specs.length || rows.some(row => row.error || !row.successful_at || !row.available)) process.exitCode = 1;
  } else {
    if (input.urls.length !== specs.length || new Set(input.urls).size !== specs.length) throw new Error('Нужны пять разных URL');
    const pending = parseFeedConfig(JSON.stringify(specs.map((spec, index) => ({
      propertyId: spec.propertyId, projectName: spec.projectName, url: input.urls[index],
      domoplaner: {complexId: spec.complexId, firstImageIsPlan: index === 4},
    }))));
    const snapshots = await Promise.all(pending.map(async (feed, i) => {
      try { return await readDomoplanerSnapshot(feed, specs[i].city); }
      catch { throw new Error('Не удалось проверить XML: ' + feed.projectName); }
    }));
    const feeds = await db.transaction(async sql => {
      await sql.query('select pg_advisory_xact_lock($1)', [1685024103]);
      const properties = (await sql.query('select id,name,city,status from catalog_properties')).rows;
      const resolved: FeedConfig[] = [];
      for (const [index, spec] of specs.entries()) {
        const feed = pending[index];
        const candidates = properties.filter(p => normalize(p.city) === normalize(spec.city) &&
          (p.id === spec.propertyId || (spec.aliases as readonly string[]).includes(normalize(p.name))));
        if (candidates.length > 1) throw new Error('Найдено несколько карточек: ' + spec.projectName);
        const property = candidates[0];
        if (!property && index !== 2 && index !== 4) throw new Error('Не найдена карточка: ' + spec.projectName);
        if (property?.status === 'archived') throw new Error('Карточка в архиве: ' + spec.projectName);
        if (property) feed.propertyId = property.id;
        const previous = current.find(item => item.propertyId === feed.propertyId);
        const state = (await sql.query('select source from catalog_feed_state where property_id=$1', [feed.propertyId])).rows[0];
        if ((previous && previous.url !== feed.url) || (state && state.source !== feed.url)) {
          throw new Error('Уже настроен другой источник: ' + spec.projectName);
        }
        if (!property) await upsertCatalogProperty(sql, makeDraft(feed, snapshots[index]));
        console.error(spec.projectName + ' | ' + feed.propertyId + ' | ' + (property?.status ?? 'создан черновик') +
          ' | ' + snapshots[index].apartments.length + ' квартир в XML');
        resolved.push(feed);
      }
      await exposeFeedFinishes(sql);
      const ids = new Set(resolved.map(feed => feed.propertyId));
      return parseFeedConfig(JSON.stringify([...current.filter(feed => !ids.has(feed.propertyId)), ...resolved]));
    });
    process.stdout.write(JSON.stringify(feeds));
  }
} catch (error) {
  console.error(error instanceof Error && error.name !== 'ZodError' && !('code' in error)
    ? error.message : 'Проверьте конфигурацию и схему каталога');
  process.exitCode = 1;
} finally {
  await db.close();
}
