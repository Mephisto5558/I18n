/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import type * as __ from '@mephisto5558/better-types'; /* eslint-disable-line import-x/order, import-x/no-namespace -- load in global definitions */

import { randomInt } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Locale as APILocale } from 'discord-api-types/v10';

type i18nFuncConfig = { locale?: Locale; errorNotFound?: boolean; undefinedNotFound?: boolean; backupPaths: string[] };
type i18nFuncConfigPart = Partial<StrictOmit<i18nFuncConfig, 'undefinedNotFound' | 'locale'>>;

export type Locale = Exclude<APILocale, `en${string}`> | 'en';
type LocaleData = Record<string, string | string[]>;

export type Translator<
  UNF extends boolean = false,
  L extends Locale | undefined = undefined
> = {
  (
    key: string, replacements?: string | Record<string, string>
  ): UNF extends true ? string | undefined : string;

  config: i18nFuncConfigPart & { undefinedNotFound?: UNF; locale?: L };
  defaultConfig: I18nProvider['config'];

  array__(key: string, replacements?: string | Record<string, string>
  ): string | string[];

  formatNumber<N extends number | bigint>(num: N): L extends undefined ? N : N | `${L}`;
};

export class I18nProvider {
  get defaultLocaleData(): LocaleData {
    return this.localeData[this.config.defaultLocale] ?? {};
  }

  constructor({
    localesPath = './locales', defaultLocale = 'en', separator = '.', notFoundMessage = '', backupPaths = [],
    errorNotFound = false, undefinedNotFound = false, warnLoggingFunction
  }: {
    localesPath?: string; defaultLocale?: Locale; separator?: string; notFoundMessage?: string; backupPaths?: string[];
    errorNotFound?: boolean; undefinedNotFound?: boolean; warnLoggingFunction?(this: void, ...msg: string[]): unknown;
  } = {}) {
    this.config = {
      localesPath: path.resolve(localesPath),
      defaultLocale, separator, notFoundMessage, backupPaths, errorNotFound, undefinedNotFound
    };
    if (warnLoggingFunction) this.logWarn = warnLoggingFunction;
  }

  config: {
    /** always a fully resolved path */
    localesPath: string; defaultLocale: Locale; separator: string; backupPaths: string[];
    errorNotFound: boolean; undefinedNotFound: boolean; notFoundMessage: string;
  };

  availableLocales = new Map<Locale, string>();
  localeData: Partial<Record<Locale, LocaleData>> = {};
  #numberFormatters: Partial<Record<Locale, Intl.NumberFormat>> = {};

  logWarn: (...msg: string[]) => unknown = console.warn;

  /** Loads locale data */
  async init(): Promise<this> {
    this.localeData = {};
    await this.fetchAvailableLocales();
    await this.loadAllLocales();

    return this;
  }

  async fetchAvailableLocales(): Promise<void> {
    this.availableLocales = new Map<Locale, string>();
    for (const localeDir of await readdir(this.config.localesPath)) {
      const fullPath = path.join(this.config.localesPath, localeDir);

      if ((await readdir(fullPath)).includes('.ignore')) continue;
      this.availableLocales.set(path.basename(localeDir) as Locale, fullPath);
    }
  }

  async loadLocale(locale: Locale): Promise<void> {
    const filePath = this.availableLocales.get(locale);
    if (!filePath) return;

    /* eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style -- Record<> does not support recursive types. */
    const data: { [x: string]: LocaleData | typeof data } = {};
    for (const file of await readdir(filePath, { recursive: true, withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;

      let current = data;
      const relativePath = path.relative(filePath, file.parentPath);
      if (relativePath) {
        for (const part of relativePath.split(path.sep)) {
          current[part] ??= {};
          current = current[part] as typeof data;
        }
      }

      current[path.basename(file.name, '.json')] = (await import(
        pathToFileURL(path.join(file.parentPath, file.name)).href, { with: { type: 'json' } }
      ) as { default: LocaleData }).default;
    }

    if (Object.keys(data).length) this.#numberFormatters[locale] = new Intl.NumberFormat(locale);
    this.localeData[locale] = this.flatten(data);
  }

  async loadAllLocales(): Promise<void> {
    await Promise.all(this.availableLocales.keys().map(async locale => this.loadLocale(locale)));
    if (!this.defaultLocaleData) /* eslint-disable-line @typescript-eslint/no-unnecessary-condition */
      throw new Error(`There are no language files for the default locale (${this.config.defaultLocale}) in the supplied locales path!`);
  }

  /** `config` is inherited from the class instance's {@link I18nProvider.config config} */
  getTranslator<UNF extends boolean = false, L extends Locale = Locale>(
    config: i18nFuncConfigPart & { undefinedNotFound?: UNF; locale?: L } = {}
  ): Translator<UNF, L> {
    const
      translatorConfig = { ...this.config, ...config },

      // @ts-expect-error They get added afterwards
      translator: Translator<UNF, L> = this.__.bind(this, translatorConfig);

    translator.defaultConfig = this.config;
    translator.config = translatorConfig as StrictOmit<I18nProvider['config'], 'undefinedNotFound'> & { undefinedNotFound: UNF; locale: L };

    translator.array__ = this.array__.bind(this, config);

    /* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */
    translator.formatNumber = num => this.formatNumber<typeof num, L>(num, config.locale);

    return translator;
  }

  /**
   * Wrapper function to improve typing.
   * @throws {Error} if no `key` is provided. */
  #__<
    UNF extends boolean | undefined = undefined, ARRAY extends boolean = false,
    /* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- is used in the function logic */
    RET = UNF extends true ? (ARRAY extends true ? string[] : string) | undefined : (ARRAY extends true ? string[] : string)
  >(
    /* eslint-disable-next-line @typescript-eslint/default-param-last -- The first param is intended to be bound by the end user. */
    {
      locale = this.config.defaultLocale, errorNotFound = this.config.errorNotFound,
      undefinedNotFound = this.config.undefinedNotFound, backupPaths = []
    }: i18nFuncConfigPart & { undefinedNotFound?: UNF; locale?: Locale } = {},
    key: string, replacements?: string | Record<string, string>, returnArray?: ARRAY
  ): RET {
    if (!key) throw new Error(`A key string must be provided! Got ${key}.`);

    const backupKeys = backupPaths.map(e => `${e}.${key}`);

    let message = locale in this.localeData ? [key, ...backupKeys].map(k => this.localeData[locale]?.[k]).find(Boolean) : undefined;
    if (!message) {
      if (!undefinedNotFound)
        this.logWarn(`Missing "${locale}" localization for ${key}` + (backupKeys.length ? ` (${backupKeys.join(' or ')})!` : '!'));
      if (this.config.defaultLocale != locale) message = [key, ...backupKeys].map(k => this.defaultLocaleData[k]).find(Boolean);
    }

    if (Array.isArray(message)) {
      if (returnArray) return message.map(msg => I18nProvider.formatMessage(msg, replacements)) as RET;
      message = message[randomInt(message.length)];
    }

    if (!message) {
      if (errorNotFound) throw new Error(`Key not found: "${key}"` + (backupKeys.length ? ` (${backupKeys.join(' or ')})` : ''));
      if (undefinedNotFound) return undefined as RET;

      this.logWarn(
        `Missing default ("${this.config.defaultLocale}") localization for ${key}`
        + (backupKeys.length ? ` (${backupKeys.join(' or ')})!` : '!')
      );
      return (this.config.notFoundMessage.replaceAll('{key}', key) || key) as RET;
    }

    return I18nProvider.formatMessage(message, replacements) as RET;
  }

  /** @returns the message */
  __<UNF extends boolean | undefined = undefined>(
    config: i18nFuncConfigPart & { undefinedNotFound?: UNF; locale?: Locale }, key: string, replacements?: string | Record<string, string>
  ): UNF extends true ? string | undefined : string {
    return this.#__(config, key, replacements, false);
  }

  /** same as {@link I18nProvider.__ __} but returns the whole array instead of a random element from an array. */
  array__(config: Partial<i18nFuncConfig>, key: string, replacements?: string | Record<string, string>): string | string[] {
    return this.#__(config, key, replacements, true);
  }

  /** @returns the formatted number as a string, or the original number if the formatter for the locale does not exist. */
  formatNumber<N extends number | bigint, L extends Locale | undefined>(num: N, locale?: L): L extends undefined ? N : N | `${L}` {
    return (this.#numberFormatters[locale ?? this.config.defaultLocale]?.format(num) ?? String(num)) as L extends undefined ? N : N | `${L}`;
  }

  /** @returns flatted object */
  flatten(object: Record<string, unknown>, objectPath = ''): LocaleData {
    return Object.keys(object).reduce((acc, key) => {
      const newObjectPath = [objectPath, key].filter(Boolean).join(this.config.separator);
      if (typeof object[key] == 'object' && Object.prototype.toString.call(object[key]) === '[object Object]')
        return { ...acc, ...this.flatten(object[key] as Record<string, unknown>, newObjectPath) };
      return { ...acc, [newObjectPath]: object[key] };
    }, {});
  }

  /** @returns list of entries that are missing or equal with default data */
  findMissing(checkEqual = false): Record<string, string[]> {
    const
      defaultKeys = Object.keys(this.defaultLocaleData),
      missing: Partial<Record<Locale, string[]>> = {};

    for (const [locale] of this.availableLocales) {
      missing[locale] = defaultKeys.filter(k => {
        if (checkEqual && this.config.defaultLocale != locale && this.localeData[locale]?.[k] == this.defaultLocaleData[k]) return true;
        return !this.localeData[locale]?.[k];
      });
    }

    return Object.fromEntries(Object.entries<string, string[]>(missing).filter(([, e]) => !!e.length));
  }


  static formatMessage(message: string, replacements?: string | Record<string, unknown>): string {
    if (replacements == undefined || replacements == '') return message;
    if (typeof replacements != 'object') return message.replaceAll(/\{\w+\}/g, replacements);

    for (const [replacer, replacement] of Object.entries(replacements)) {
      if (!replacement?.toString()) continue;

      /* eslint-disable-next-line @typescript-eslint/no-base-to-string -- up to the library user to not send an object. */
      message = message.replaceAll(`{${replacer}}`, replacement.toString());
    }

    return message;
  }
}