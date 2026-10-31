const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = process.argv[2];
const target = process.cwd();
assert.ok(source, 'Pass the overlay directory');
fs.cpSync(path.join(source, 'admin/src'), path.join(target, 'src'), { recursive: true });
fs.copyFileSync(path.join(source, 'localization/i18n.ts'), 'src/locales/i18n.ts');
fs.copyFileSync(path.join(source, 'localization/ru.json'), 'src/locales/ru/translation.json');
for (const language of ['en', 'ru']) {
  const file = `src/locales/${language}/translation.json`;
  const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
  const additions = JSON.parse(fs.readFileSync(path.join(source, `${language}.json`), 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...existing, ...additions }, null, 2) + '\n');
}
function replace(file, before, after) {
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(text.split(before).length, 2, `Pinned source changed: ${file}`);
  fs.writeFileSync(file, text.replace(before, after));
}
fs.appendFileSync('src/server/index.ts', "\nexport * from './headhunter';\n");
fs.appendFileSync('src/types/index.ts', "\nexport type * from './headhunter';\n");
replace('src/types/server.ts', '  codeVerifier?: string;', '  codeVerifier?: string;\n  hhOAuthState?: string;\n  hhOAuthStartedAt?: number;\n  hhOAuthUserId?: string;');
replace('src/server/auth.ts', '    lastActivity: undefined,', '    lastActivity: undefined,\n    hhOAuthState: undefined,\n    hhOAuthStartedAt: undefined,\n    hhOAuthUserId: undefined,');
replace('src/components/Sidebar.tsx', 'const navItems: t.NavItem[] = [', `const navItems: t.NavItem[] = [
  { labelKey: 'com_hh_title', path: '/headhunter', icon: 'settings', capability: SystemCapabilities.MANAGE_CONFIGS },`);
replace('src/routes/_app.tsx', "  '/help': 'com_help_title',", "  '/help': 'com_help_title',\n  '/headhunter': 'com_hh_title',");
replace('src/routes/__root.tsx', '<html lang="en"', '<html lang="ru"');
replace('src/routes/__root.tsx', "title: 'LibreChat Admin Panel'", "title: 'Панель администратора Artdent AI'");
for (const file of ['src/assets/librechat.svg', 'public/librechat-logo.svg', 'public/favicon.svg']) {
  fs.copyFileSync(path.join(source, 'localization/logo.svg'), file);
}
console.log('HeadHunter administration overlay applied to the pinned admin panel.');
