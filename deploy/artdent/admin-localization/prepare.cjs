const assert = require('node:assert/strict');
const fs = require('node:fs');

const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const ru = JSON.parse(fs.readFileSync('src/locales/ru/translation.json', 'utf8'));
const tokens = (value, pattern) => [...value.matchAll(pattern)].map((match) => match[0]).sort();

for (const [key, value] of Object.entries(en)) {
  assert.equal(typeof ru[key], 'string', `Missing Russian string: ${key}`);
  assert.ok(ru[key].trim(), `Empty Russian string: ${key}`);
  for (const pattern of [/\{\{[\s\S]*?\}\}/g, /<\/?\d+\s*\/?>/g, /https?:\/\/[^\s)"<>]+/g]) {
    assert.deepEqual(tokens(ru[key], pattern), tokens(value, pattern), `Changed token: ${key}`);
  }
  if (key.endsWith('_other') && value.includes('{{count}}')) {
    const base = key.slice(0, -6);
    for (const suffix of ['few', 'many']) {
      assert.equal(typeof ru[`${base}_${suffix}`], 'string', `Missing plural: ${base}_${suffix}`);
    }
  }
}

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  assert.equal(source.split(before).length, 2, `Upstream source changed: ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceOnce('src/routes/__root.tsx', '<html lang="en"', '<html lang="ru"');
replaceOnce(
  'src/routes/__root.tsx',
  "title: 'LibreChat Admin Panel'",
  "title: 'Панель администратора LibreChat'",
);
replaceOnce(
  'src/components/users/UsersPage.tsx',
  '.toLocaleDateString()',
  ".toLocaleDateString('ru-RU')",
);
replaceOnce(
  'src/components/grants/auditLogUtils.ts',
  'locale: string | undefined = undefined',
  "locale: string | undefined = 'ru-RU'",
);
console.log(
  `Validated ${Object.keys(en).length} Russian admin translations and prepared the Russian UI.`,
);
