import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { encode } from 'blurhash';
import sharp from 'sharp';

const ASSETS_DIR = join(process.cwd(), 'src/lib/assets');
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function calculateBlurhash(filePath: string) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .ensureAlpha()
    .resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
}

async function main() {
  try {
    const files = await readdir(ASSETS_DIR);
    const imageFiles = files.filter((file) => SUPPORTED_EXTENSIONS.has(extname(file).toLowerCase()));

    if (imageFiles.length === 0) {
      console.log('No images found in src/lib/assets');
      return;
    }

    console.log(`Calculating blurhashes for ${imageFiles.length} images...\n`);

    for (const file of imageFiles) {
      const filePath = join(ASSETS_DIR, file);
      try {
        const hash = await calculateBlurhash(filePath);
        console.log(`${file}:`);
        console.log(`  ${hash}\n`);
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
      }
    }
  } catch (err) {
    console.error('Error reading assets directory:', err);
  }
}

main();
