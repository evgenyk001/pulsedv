import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { postgresDatabase } from './database';
import { gloraxPlanProjects } from '../../packages/domain/gloraxPlans';

const root = process.env.MEDIA_ROOT || '/data/media';
const db = postgresDatabase(process.env.DATABASE_URL!);
try {
  const { rows } = await db.query(
    'select property_id, room_label, area_from, image_url, apartment from catalog_feed_apartments where active and property_id = any($1::text[]) order by property_id, id',
    [[...gloraxPlanProjects]],
  );
  for (const id of gloraxPlanProjects) {
    const manifest = JSON.parse(await readFile(join(root, 'private', 'glorax-plans', id + '.json'), 'utf8'));
    const lots = rows.filter(row => row.property_id === id);
    const buckets = new Map<string, typeof lots>();
    for (const lot of lots) {
      const key = JSON.stringify([lot.room_label, lot.area_from]);
      const group = buckets.get(key) ?? [];
      group.push(lot);
      buckets.set(key, group);
    }
    let compared = 0;
    let missing = 0;
    const candidates = [];
    for (const group of buckets.values()) {
      if (group.length < 2) continue;
      const drawn = [];
      for (const lot of group) {
        const preview = manifest[lot.image_url]?.preview;
        const match = typeof preview === 'string' && preview.match(/^\/media\/glorax-plans\/([a-f0-9]{64}\.webp)$/);
        if (!match) { missing++; continue; }
        const { data, info } = await sharp(join(root, 'glorax-plans', match[1])).greyscale().raw().toBuffer({ resolveWithObject: true });
        drawn.push({ lot, data, info });
      }
      for (const [i, a] of drawn.entries()) {
        for (let j = i + 1; j < drawn.length; j++) {
          const b = drawn[j];
          if (a.info.width !== b.info.width || a.info.height !== b.info.height) continue;
          compared++;
          const { width, height } = a.info;
          let left = width, right = -1, top = height, bottom = -1;
          for (let k = 0; k < a.data.length; k++) {
            if (Math.abs(a.data[k] - b.data[k]) <= 45) continue;
            const x = k % width, y = Math.floor(k / width);
            left = Math.min(left, x); right = Math.max(right, x);
            top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
          if (right >= 0 && (right - left + 1) / width > 0.16) continue;
          if (bottom >= 0 && (bottom - top + 1) / height > 0.08) continue;
          candidates.push([a.lot.area_from, a.lot.room_label, a.lot.apartment, b.lot.apartment, a.lot.image_url, b.lot.image_url]);
        }
      }
    }
    console.log(JSON.stringify({ id, lots: lots.length, compared, missing, candidates }));
  }
} finally {
  await db.close();
}
