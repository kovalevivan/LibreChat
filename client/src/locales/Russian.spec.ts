import i18n, { changeLanguageSafely, initializeI18n } from './i18n';
import English from './en/translation.json';
import Russian from './ru/translation.json';

describe('Russian locale', () => {
  it('covers every English UI key with a nonempty translation', () => {
    const missing = Object.keys(English).filter(
      (key) => !Russian[key as keyof typeof Russian]?.trim(),
    );
    expect(missing).toEqual([]);
  });

  it('preserves interpolation variables, rich-text slots and link destinations', () => {
    const patterns = [/\{\{.*?\}\}/g, /<\/?\d+>/g, /\]\(([^)]+)\)/g];
    const mismatches = Object.entries(English).flatMap(([key, english]) => {
      const russian = Russian[key as keyof typeof Russian];
      return patterns.flatMap((pattern) => {
        const source = [...english.matchAll(pattern)].map((match) => match[0]).sort();
        const translated = [...russian.matchAll(pattern)].map((match) => match[0]).sort();
        return JSON.stringify(source) === JSON.stringify(translated) ? [] : [key];
      });
    });
    expect(mismatches).toEqual([]);
  });

  it('loads Russian UI labels and substitutes error and sharing details', async () => {
    await initializeI18n();
    try {
      await changeLanguageSafely('ru-RU');
      expect(document.documentElement.lang).toBe('ru');
      expect(i18n.t('com_ui_schedules')).toBe('Чаты по расписанию');
      expect(i18n.t('com_ui_tools_configure')).toBe('Настроить');
      expect(i18n.t('com_agents_marketplace')).toBe('Каталог агентов');
      expect(i18n.t('com_error_input_length', { 0: '900', 1: '800' })).toBe(
        'Для вашего сообщения требуется 900 токенов, но в этом чате доступно 800.',
      );
      const shared = i18n.t('com_ui_share_everyone_description_var', { resource: 'Отчёт' });
      expect(shared.match(/Отчёт/g)).toHaveLength(2);
      expect(shared).not.toContain('{{');
    } finally {
      await changeLanguageSafely('en');
    }
  });
});
