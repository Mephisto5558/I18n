const
  { readdir, readFile } = require('fs/promises'),
  path = require('path');

global.log ??= {
  debug: (...data) => { console.debug(...data); return log; },
  setType: () => log
}; //if the file is running separately

module.exports = class I18nProvider {
  constructor({
    localesPath = './locales', defaultLocale = 'en', separator = '.', notFoundMessage = '',
    errorNotFound = false, undefinedNotFound = false
  }) {
    this.config = { localesPath, defaultLocale, separator, errorNotFound, undefinedNotFound, notFoundMessage };

    this.loadAllLocales();
  }

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

  async loadAllLocales() {
    this.availableLocales = new Map(await readdir(this.config.localesPath).then(e => e.reduce(async (acc, e) => {
      if (!(await readdir(`${this.config.localesPath}/${e}`)).includes('.ignore')) (await acc).push([path.basename(e, '.json'), path.resolve(this.config.localesPath, e)]);
      return await acc;
    }, Promise.resolve([]))));
    this.localeData = {};

    for (const [locale] of this.availableLocales) await this.loadLocale(locale);

    this.defaultLocaleData = this.localeData[this.config.defaultLocale];
    if (!this.defaultLocaleData) throw new Error(`There are no language files for the default locale (${this.config.defaultLocale}) in the supplied locales path!`);
  }

  /**@param {string}key @param {string|object}replacements @returns {string}the message*/
  __({ locale = this.config.defaultLocale, errorNotFound = this.config.errorNotFound, undefinedNotFound = this.config.undefinedNotFound, backupPath } = {}, key, replacements) {
    if (!key) throw new Error(`A key string must be provided! Got ${key}.`);

    let message = this.localeData[locale]?.[key] ?? (backupPath && this.localeData[locale]?.[`${backupPath}.${key}`]);
    if (!message) {
      if (!undefinedNotFound) log.setType('I18n').warn(`Missing "${locale}" localization for ${key}` + (backupPath ? ` (${backupPath}.${key})!` : '!')).setType();
      if (this.config.defaultLocale != locale) message = this.defaultLocaleData[key] ?? (backupPath && this.defaultLocaleData[`${backupPath}.${key}`]);
    }

    if (Array.isArray(message)) message = message.random();
    if (!message) {
      if (errorNotFound) throw new Error(`Key not found: "${key}"` + (backupPath ? ` (${backupPath}.${key})` : ''));
      if (undefinedNotFound) return undefined;
      log.setType('I18n').warn(`Missing default ("${this.config.defaultLocale}") localization for ${key}` + (backupPath ? ` (${backupPath}.${key})!` : '!')).setType();
      return this.config.notFoundMessage?.replaceAll('{key}', key) ?? key;
    }

    if (!replacements?.toString()) return message;
    if (typeof replacements != 'object') return message.replace(/{\w+}/g, replacements.toString());

    for (const [key, value] of Object.entries(replacements)) message = message.replaceAll(`{${key}}`, value?.toString());
    return message;
  }

  /**@param {object}object @param {string}objectPath @returns {object}flatted object*/
  flatten = (object, objectPath) => Object.keys(object).reduce((acc, key) => {
    const newObjectPath = [objectPath, key].filter(Boolean).join(this.config.separator);
    return Object.assign(Object.assign({}, acc), ({}).toString() == object?.[key]
      ? this.flatten(object[key], newObjectPath)
      : { [newObjectPath]: object[key] }
    );
  }, {});

  /**@param {boolean}checkEqual @returns {object}list of entries that are missing or equal with default data*/
  findMissing(checkEqual) {
    const defaultKeys = Object.keys(this.defaultLocaleData);
    const missing = {};

    for (const [locale] of this.availableLocales) missing[locale] = defaultKeys.filter(k => {
      if (checkEqual && this.config.defaultLocale != locale && this.localeData[locale][k] == this.defaultLocaleData[k]) return true;
      return !this.localeData[locale][k];
    });
    return Object.fromEntries(Object.entries(missing).filter(([, e]) => e.length));
  }
};
