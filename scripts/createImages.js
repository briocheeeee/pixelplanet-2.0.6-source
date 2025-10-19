/*
 * Create needed images from SVG
 * Creates images needed for pixelplanet out of svg files
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import ico from 'sharp-ico';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

const svgLogo = path.resolve(__dirname, '..', 'dist', 'public', 'logo.svg');
const targetIco = path.resolve(__dirname, '..', 'dist', 'public', 'favicon.ico');
const tilePng = path.resolve(__dirname, '..', 'dist', 'public', 'tile.png');
const touchIconPng = path.resolve(__dirname, '..', 'dist', 'public', 'apple-touch-icon.png');

async function createImages() {
  await ico.sharpsToIco(
    [ sharp(svgLogo) ],
    targetIco,
    {
      sizes: [256, 128, 64, 32, 24],
    }
  );
  console.log('Created favicon');
  await sharp(svgLogo)
    .resize({ height: 256 })
    .png()
    .toFile(tilePng);
  console.log('Created tile.png');
  fs.copyFileSync(tilePng, touchIconPng);
  console.log('Created apple-touch-icon.png');
}

export default createImages;
