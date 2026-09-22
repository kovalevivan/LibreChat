const fs = require('node:fs');
const assert = require('node:assert/strict');

const version = 'artdent-20260922';
function versionIcons(file, pattern) {
  const source = fs.readFileSync(file, 'utf8');
  let count = 0;
  const updated = source.replace(pattern, (match) => {
    count++;
    return `${match}?v=${version}`;
  });
  assert.ok(count > 0, `No icon references found in ${file}`);
  fs.writeFileSync(file, updated);
}

if (process.argv[2] === 'admin') {
  versionIcons('src/routes/__root.tsx', /\/favicon\.ico(?!\?)/g);
  const manifestPath = 'public/manifest.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.icons[0].src = `favicon.ico?v=${version}`;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
} else {
  const png =
    /assets\/(?:favicon-[\dx]+|apple-touch-icon-[\dx]+|icon-[\dx]+|maskable-icon)\.png(?!\?)/g;
  versionIcons('client/index.html', png);
  versionIcons('client/vite.config.ts', new RegExp("(?<=src: ')" + png.source, 'g'));
}
