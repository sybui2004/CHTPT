import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedImages } from './seed_image_manifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname);
const force = process.argv.includes('--force');

function buildDownloadUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('w', '1200');
  url.searchParams.set('q', '82');
  return url.toString();
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(item) {
  const targetPath = path.join(outputDir, item.path);
  if (!force && await exists(targetPath)) {
    console.log(`skip ${item.path}`);
    return;
  }

  const response = await fetch(buildDownloadUrl(item.sourceUrl), {
    headers: {
      'User-Agent': 'SunStack demo seed image downloader',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${item.sourceUrl}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
  console.log(`saved ${item.path}`);
}

for (const item of seedImages) {
  await downloadImage(item);
}

console.log(`Downloaded ${seedImages.length} seed images to ${outputDir}`);
