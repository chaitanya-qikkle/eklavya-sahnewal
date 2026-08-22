// Pads the GDL logo to a 1024×1024 square (transparent background) so
// the Tauri icon CLI accepts it.
import path from 'path';
import sharp from 'sharp';

const SRC = path.resolve('public/Images/gdl.png');
const OUT = path.resolve('src-tauri/icon-source.png');
const TARGET = 1024;

const meta = await sharp(SRC).metadata();
console.log(`source ${meta.width}×${meta.height}`);

await sharp(SRC)
  .resize(TARGET, TARGET, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  })
  .png()
  .toFile(OUT);
console.log(`wrote ${OUT}`);
