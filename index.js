const
  { randomInt } = require('node:crypto'),
  { readFile, readdir } = require('node:fs/promises'),
  path = require('node:path');

module.exports.I18nProvider = class I18nProvider {
  /** @type {import('.').I18nProvider['availableLocales']} */ availableLocales;
  /** @type {import('.').I18nProvider['localeData']} */ localeData;
  /** @type {import('.').I18nProvider['defaultLocaleData']} */ defaultLocaleData = {};
  /** @type {Record<string, Intl.NumberFormat>} */ #numberFormatters = {};

  /** @param {import('.').I18nProviderInitOptions} options */
  constructor({
    localesPath = './locales', defaultLocale = 'en', separator = '.', notFoundMessage = '', backupPaths = [],
    errorNotFound = false, undefinedNotFound = false, warnLoggingFunction = console.warn
  } = {}) {
    this.config = { localesPath, defaultLocale, separator, errorNotFound, undefinedNotFound, notFoundMessage, backupPaths };
    this.logWarn = warnLoggingFunction;

    void this.loadAllLocales();
  }

  /** @type {import('.').I18nProvider['loadLocale']} */
  async loadLocale(locale) {
    const filePath = this.availableLocales.get(locale);
    if (!filePath) return;

    const /** @type {Record<string, JSONValue>} */ data = {};
    for (const item of await readdir(filePath, { withFileTypes: true })) {
      if (item.isFile() && item.name.endsWith('.json'))
        data[item.name.replace('.json', '')] = JSON.parse(await readFile(`${filePath}/${item.name}`, 'utf8'));
      else {
        data[item.name] = {};
        for (const file of await readdir(`${filePath}/${item.name}`)) {
          if (file.endsWith('.json'))
            data[item.name][file.replace('.json', '')] = JSON.parse(await readFile(`${filePath}/${item.name}/${file}`, 'utf8'));
        }
      }

      if (Object.keys(data).length) this.#numberFormatters[locale] = new Intl.NumberFormat(locale);
    }

    this.localeData[locale] = this.flatten(data);
  }

  /** @type {import('.').I18nProvider['loadAllLocales']} */
  async loadAllLocales() {
    this.availableLocales = new Map(await readdir(this.config.localesPath).then(async e => e.reduce(async (acc, e) => {
      if (!(await readdir(`${this.config.localesPath}/${e}`)).includes('.ignore'))
        (await acc).push([path.basename(e, '.json'), path.resolve(this.config.localesPath, e)]);
      return acc;
    }, Promise.resolve([]))));
    this.localeData = {};

    for (const [locale] of this.availableLocales) await this.loadLocale(locale);

    this.defaultLocaleData = this.localeData[this.config.defaultLocale];
    if (!this.defaultLocaleData) /* eslint-disable-line @typescript-eslint/no-unnecessary-condition */
      throw new Error(`There are no language files for the default locale (${this.config.defaultLocale}) in the supplied locales path!`);
  }

  /** @type {import('.').I18nProvider['getTranslator']} */
  getTranslator(config = {}) {
    const 
      translatorConfig = {...this.config, ...config},
      /** @type {import('.').Translator} */ translator = this.__.bind(this, translatorConfig);

    translator.defaultConfig = this.config;
    translator.config = translatorConfig;

    translator.array__ = this.array__.bind(this, config);

    /** @type {import('.').Translator['formatNumber']} */
    translator.formatNumber = num => this.formatNumber(num, config.locale);

    return translator;
  }

  /**
   * Wrapper function to improve typing.
   * @this {import('.').I18nProvider}
   * @param {import('.').i18nFuncConfig} config
   * @param {string} key
   * @param {string | Record<string,string>} replacements
   * @param {boolean?} returnArray
   * @returns {string | string[]} based on returnArray (only `string` if `false`) */
  /* eslint-disable-next-line @typescript-eslint/default-param-last -- The first param is intended to be bound by the end user. */
  #__({
    locale = this.config.defaultLocale, errorNotFound = this.config.errorNotFound,
    undefinedNotFound = this.config.undefinedNotFound, backupPaths = []
  } = {}, key, replacements, returnArray) {
    if (!key) throw new Error(`A key string must be provided! Got ${key}.`);

    const backupKeys = backupPaths.map(e => `${e}.${key}`);

    let message = locale in this.localeData ? [key, ...backupKeys].map(k => this.localeData[locale][k]).find(Boolean) : undefined;
    if (!message) {
      if (!undefinedNotFound)
        this.logWarn(`Missing "${locale}" localization for ${key}` + (backupKeys.length ? ` (${backupKeys.join(' or ')})!` : '!'));
      if (this.config.defaultLocale != locale) message = [key, ...backupKeys].map(k => this.defaultLocaleData[k]).find(Boolean);
    }

    if (Array.isArray(message)) {
      if (returnArray) return message.map(msg => this.constructor.formatMessage(msg, replacements));
      message = message[randomInt(message.length)];
    }

    if (!message) {
      if (errorNotFound) throw new Error(`Key not found: "${key}"` + (backupKeys.length ? ` (${backupKeys.join(' or ')})` : ''));
      if (undefinedNotFound) return;

      this.logWarn(
        `Missing default ("${this.config.defaultLocale}") localization for ${key}`
        + (backupKeys.length ? ` (${backupKeys.join(' or ')})!` : '!')
      );
      return this.config.notFoundMessage.replaceAll('{key}', key) || key;
    }

    return this.constructor.formatMessage(message, replacements);
  }

  /** @type {import('.').I18nProvider['__']} */
  __(config, key, replacements) { return this.#__(config, key, replacements, false); }

  /** @type {import('.').I18nProvider['array__']} */
  array__(config, key, replacements) { return this.#__(config, key, replacements, true); }

  /**
   * @type {import('.').I18nProvider['formatNumber']}
   * @param {Parameters<import('.').I18nProvider['formatNumber']>[0] | undefined} num */
  formatNumber(num, locale) {
    return this.#numberFormatters[locale ?? this.config.defaultLocale]?.format(num) ?? num;
  }

  /** @type {import('.').I18nProvider['flatten']} */
  flatten(object, objectPath = '') {
    return Object.keys(object).reduce((acc, key) => {
      const newObjectPath = [objectPath, key].filter(Boolean).join(this.config.separator);
      if (typeof object[key] == 'object' && Object.prototype.toString.call(object[key]) === '[object Object]')
        return { ...acc, ...this.flatten(object[key], newObjectPath) };
      return { ...acc, [newObjectPath]: object[key] };
    }, {});
  }

  /** @type {import('.').I18nProvider['findMissing']} */
  findMissing(checkEqual) {
    const
      defaultKeys = Object.keys(this.defaultLocaleData),
      missing = {};

    for (const [locale] of this.availableLocales) {
      missing[locale] = defaultKeys.filter(k => {
        if (checkEqual && this.config.defaultLocale != locale && this.localeData[locale][k] == this.defaultLocaleData[k]) return true;
        return !this.localeData[locale][k];
      });
    }
    return Object.fromEntries(Object.entries(missing).filter(([, e]) => !!e.length));
  }

  /** @type {(typeof import('.').I18nProvider)['formatMessage']} */
  static formatMessage(message, replacements) {
    if (replacements == undefined || replacements == '') return message;
    if (typeof replacements != 'object') return message.replaceAll(/\{\w+\}/g, replacements);

    for (const [replacer, replacement] of Object.entries(replacements)) {
      if (!replacement?.toString()) continue;

      /* eslint-disable-next-line @typescript-eslint/no-base-to-string -- up to the library user to not send an object. */
      message = message.replaceAll(`{${replacer}}`, replacement.toString());
    }

    return message;
  }
};