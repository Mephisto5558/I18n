const
  { readdir, readFile } = require('node:fs/promises'),
  path = require('node:path');

module.exports = class I18nProvider {
  constructor({
    localesPath = './locales', defaultLocale = 'en', separator = '.', notFoundMessage = '',
    errorNotFound = false, undefinedNotFound = false, warnLoggingFunction = console.warn
  } = {}) {
    this.config = { localesPath, defaultLocale, separator, errorNotFound, undefinedNotFound, notFoundMessage };
    this.logWarn = warnLoggingFunction;

    this.loadAllLocales();
  }

  /** @type {import('.')['loadLocale']} */
  async loadLocale(locale) {
    if (!locale) return;

    const data = {};
    const filePath = this.availableLocales.get(locale);

    if (!filePath) return;

    for (const item of await readdir(filePath, { withFileTypes: true })) {
      if (item.isFile() && item.name.endsWith('.json')) data[item.name.replace('.json', '')] = JSON.parse(await readFile(`${filePath}/${item.name}`, 'utf8'));
      else {
        data[item.name] = {};
        for (const file of await readdir(`${filePath}/${item.name}`))
          if (file.endsWith('.json')) data[item.name][file.replace('.json', '')] = JSON.parse(await readFile(`${filePath}/${item.name}/${file}`, 'utf8'));
      }
    }

    this.localeData[locale] = this.flatten(data);
  }

  /** @type {import('.')['loadAllLocales']} */
  async loadAllLocales() {
    this.availableLocales = new Map(await readdir(this.config.localesPath).then(e => e.reduce(async (acc, e) => {
      if (!(await readdir(`${this.config.localesPath}/${e}`)).includes('.ignore')) (await acc).push([path.basename(e, '.json'), path.resolve(this.config.localesPath, e)]);
      return acc;
    }, Promise.resolve([]))));
    this.localeData = {};

    for (const [locale] of this.availableLocales) await this.loadLocale(locale);

    this.defaultLocaleData = this.localeData[this.config.defaultLocale];
    if (!this.defaultLocaleData) throw new Error(`There are no language files for the default locale (${this.config.defaultLocale}) in the supplied locales path!`);
  }

  /** @type {import('.')['__']} */
  /* eslint-disable-next-line default-param-last -- The first param is intended to be bound by the end user. */
  __({ locale = this.config.defaultLocale, errorNotFound = this.config.errorNotFound, undefinedNotFound = this.config.undefinedNotFound, backupPath } = {}, key, replacements) {
    if (!key) throw new Error(`A key string must be provided! Got ${key}.`);

    let message = this.localeData[locale]?.[key] ?? (backupPath && this.localeData[locale]?.[`${backupPath}.${key}`]);
    if (!message) {
      if (!undefinedNotFound) this.logWarn(`Missing "${locale}" localization for ${key}` + (backupPath ? ` (${backupPath}.${key})!` : '!'));
      if (this.config.defaultLocale != locale) message = this.defaultLocaleData[key] ?? (backupPath && this.defaultLocaleData[`${backupPath}.${key}`]);
    }

    if (Array.isArray(message)) message = message.random();
    if (!message) {
      if (errorNotFound) throw new Error(`Key not found: "${key}"` + (backupPath ? ` (${backupPath}.${key})` : ''));
      if (undefinedNotFound) return;
      this.logWarn(`Missing default ("${this.config.defaultLocale}") localization for ${key}` + (backupPath ? ` (${backupPath}.${key})!` : '!'));
      return this.config.notFoundMessage?.replaceAll('{key}', key) ?? key;
    }

    if (!replacements?.toString()) return message;
    if (typeof replacements != 'object') return message.replaceAll(/{\w+}/g, replacements.toString());

    for (const [replacer, replacement] of Object.entries(replacements)) message = message.replaceAll(`{${replacer}}`, replacement?.toString());
    return message;
  }

  /** @type {import('.')['flatten']} */
  flatten(object, objectPath = '') {
    return Object.keys(object).reduce((acc, key) => {
      const newObjectPath = [objectPath, key].filter(Boolean).join(this.config.separator);
      if (Object.prototype.toString.call(object[key]) === '[object Object]')
        return { ...acc, ...this.flatten(object[key], newObjectPath) };
      return { ...acc, [newObjectPath]: object[key] };
    }, {});
  }

  /** @type {import('.')['findMissing']} */
  findMissing(checkEqual) {
    const defaultKeys = Object.keys(this.defaultLocaleData);
    const missing = {};

    for (const [locale] of this.availableLocales) {
      missing[locale] = defaultKeys.filter(k => {
        if (checkEqual && this.config.defaultLocale != locale && this.localeData[locale][k] == this.defaultLocaleData[k]) return true;
        return !this.localeData[locale][k];
      });
    }
    return Object.fromEntries(Object.entries(missing).filter(([, e]) => e.length));
  }
};