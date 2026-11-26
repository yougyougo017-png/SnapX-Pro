'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'src', 'assets', 'app-icon.svg');
const buildDir = path.join(root, 'build');
const iconPng = path.join(buildDir, 'icon.png');
const appIcon = path.join(root, 'src', 'assets', 'app-icon.png');
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function main() {
  fs.mkdirSync(buildDir, { recursive: true });
  const svg = fs.readFileSync(svgPath);
  const pngPaths = [];

  for (const size of sizes) {
    const target = path.join(buildDir, `icon-${size}.png`);
    await sharp(svg, { density: 320 }).resize(size, size).png().toFile(target);
    pngPaths.push(target);
  }

  await sharp(svg, { density: 320 }).resize(1024, 1024).png().toFile(iconPng);
  await sharp(svg, { density: 320 }).resize(512, 512).png().toFile(appIcon);

  const icoBuffer = await pngToIco(pngPaths.filter((file) => {
    const size = Number(path.basename(file).match(/\d+/)[0]);
    return size <= 256;
  }));
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('Generated build/icon.png, build/icon.ico and src/assets/app-icon.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
