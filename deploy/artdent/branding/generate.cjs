const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../../..');
const assets = path.join(root, 'client/public/assets');

async function main() {
  const original = await fs.readFile(path.join(__dirname, 'source.svg'), 'utf8');
  const paths = original
    .replace(/<\/?svg[^>]*>/g, '')
    .trim()
    .replaceAll('fill="#fff"', 'fill="#07515B"')
    .replaceAll('fill="#0CB0C6"', 'fill="#087F8C"');
  const svg = (scale, radius) =>
    `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">\n<rect width="512" height="512" rx="${radius}" fill="#F1F8F8"/>\n<g transform="translate(${256 * (1 - scale)} ${256 * (1 - scale)}) scale(${scale})">\n${paths}\n</g>\n</svg>\n`;
  const regular = Buffer.from(svg(0.84, 88));
  await fs.writeFile(path.join(assets, 'logo.svg'), regular);
  for (const [name, size, input] of [
    ['favicon-16x16.png', 16, regular],
    ['favicon-32x32.png', 32, regular],
    ['apple-touch-icon-180x180.png', 180, regular],
    ['icon-192x192.png', 192, regular],
    ['maskable-icon.png', 512, Buffer.from(svg(0.68, 0))],
  ]) {
    await sharp(input).resize(size, size).png().toFile(path.join(assets, name));
  }
  const sizes = [16, 24, 32, 64];
  const images = await Promise.all(
    sizes.map((size) => sharp(regular).resize(size).png().toBuffer()),
  );
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const position = 6 + 16 * index;
    header[position] = sizes[index];
    header[position + 1] = sizes[index];
    header.writeUInt16LE(1, position + 4);
    header.writeUInt16LE(32, position + 6);
    header.writeUInt32LE(image.length, position + 8);
    header.writeUInt32LE(offset, position + 12);
    offset += image.length;
  });
  await fs.writeFile(path.join(assets, 'favicon.ico'), Buffer.concat([header, ...images]));
  console.log('Generated Artdent icons from the clinic SVG.');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
