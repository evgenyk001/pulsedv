import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { gloraxPlanProjects, gloraxPlanSource, type GloraxPlanManifest } from '../../packages/domain/gloraxPlans';
import { postgresDatabase } from './database';

const maxBytes = 12 * 1024 * 1024;
const reviewedGroups = z.array(z.array(z.string().regex(gloraxPlanSource)).min(2));
const knownGroup = [
  'https://crmftp.glorax.com/Klub1_site/1-2-14-8-383.png',
  'https://crmftp.glorax.com/Klub1_site/1-2-16-8-409.png',
];
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

async function fetchPlan(url: string) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('PNG exceeds limit');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks, size);
}

async function writeAtomically(destination: string, content: string | Buffer) {
  const temporary = destination + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, content);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function prepare() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const mediaRoot = process.env.MEDIA_ROOT || '/data/media';
  const previewDir = join(mediaRoot, 'glorax-plans');
  const manifestDir = join(mediaRoot, 'private', 'glorax-plans');
  await Promise.all([mkdir(previewDir, { recursive: true }), mkdir(manifestDir, { recursive: true })]);
  const reviewFile = process.argv[2];
  const groups = reviewFile
    ? [...reviewedGroups.parse(JSON.parse(await readFile(reviewFile, 'utf8')))]
    : [knownGroup];
  const approved = new Map<string, string>();
  for (const group of groups) {
    const key = 'reviewed:' + digest(JSON.stringify([...group].sort()));
    for (const url of group) {
      if (approved.has(url)) throw new Error('Image appears more than once in reviewed groups: ' + url);
      approved.set(url, key);
    }
  }

  const db = postgresDatabase(databaseUrl);
  try {
    const { rows } = await db.query(`
      select distinct property_id, image_url
      from catalog_feed_apartments
      where active and property_id = any($1::text[])
      order by property_id, image_url
    `, [[...gloraxPlanProjects]]);
    for (const projectId of gloraxPlanProjects) {
      const path = join(manifestDir, projectId + '.json');
      const previous = await readFile(path, 'utf8').then(
        value => JSON.parse(value) as GloraxPlanManifest,
        (error: NodeJS.ErrnoException): GloraxPlanManifest => {
          if (error.code !== 'ENOENT') throw error;
          return {};
        },
      );
      const sources = rows.filter(row => row.property_id === projectId).map(row => row.image_url);
      if (!sources.length) continue;
      const urls = sources.filter((url): url is string => typeof url === 'string' && gloraxPlanSource.test(url));
      const manifest: GloraxPlanManifest = {};
      let failed = 0;
      const queue = urls.values();
      await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
        for (const url of queue) {
          try {
            const input = await fetchPlan(url);
            const image = sharp(input, { limitInputPixels: 16_000_000 });
            if ((await image.metadata()).format !== 'png') throw new Error('Expected a PNG');
            const normalized = image.flatten({ background: '#fff' }).toColourspace('srgb');
            const { data, info } = await normalized.clone().raw().toBuffer({ resolveWithObject: true });
            const drawing = createHash('sha256').update(info.width + 'x' + info.height + ':').update(data).digest('hex');
            const preview = await normalized.resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 85 }).toBuffer();
            const filename = digest(preview) + '.webp';
            await writeAtomically(join(previewDir, filename), preview);
            manifest[url] = { drawing, preview: '/media/glorax-plans/' + filename };
          } catch (error) {
            failed++;
            if (previous[url]) manifest[url] = previous[url];
            console.warn(projectId, url, error instanceof Error ? error.message : String(error));
          }
        }
      }));
      for (const url of urls) {
        const drawing = approved.get(url);
        const entry = manifest[url];
        if (drawing) manifest[url] = { ...entry, drawing };
        else if (entry?.drawing.startsWith('reviewed:')) manifest[url] = { ...entry, drawing: 'source:' + digest(url) };
      }
      await writeAtomically(path, JSON.stringify(manifest));
      console.log(JSON.stringify({ projectId, distinctSources: urls.length, previews: Object.values(manifest).filter(entry => entry.preview).length, failed, missingOrUnsupported: sources.length - urls.length }));
      if (failed) process.exitCode = 1;
    }
  } finally {
    await db.close();
  }
}

void prepare().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
