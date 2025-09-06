import type { Locale as APILocale } from 'discord-api-types/v10';

type i18nFuncConfig = { locale?: Locale; errorNotFound?: boolean; undefinedNotFound?: boolean; backupPaths: string[] };
type i18nFuncConfigPart = Omit<i18nFuncConfig, 'undefinedNotFound' | 'locale'>;

export declare type Locale = Exclude<APILocale, `en${string}`> | 'en';

export declare type Translator<
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

  formatNumber<N extends number | bigint>(num: N): L extends undefined ? string : string | N;
};

export declare type I18nProviderInitOptions = {
  localesPath?: string; defaultLocale?: Locale; separator?: string;
  notFoundMessage?: string; errorNotFound?: boolean; undefinedNotFound?: boolean; backupPaths?: string[];
  warnLoggingFunction?(this: void, ...msg: string[]): unknown;
};

export declare class I18nProvider {
  constructor(options: I18nProviderInitOptions);

  config: {
    localesPath: string; defaultLocale: Locale; separator: string;
    errorNotFound: boolean; undefinedNotFound: boolean; notFoundMessage: string;
  };

  availableLocales: Map<Locale, string>;
  localeData: Record<Locale, string | string[]>;
  defaultLocaleData: I18nProvider['localeData'][Locale];

  loadLocale(locale: Locale): Promise<void>;
  loadAllLocales(): Promise<void>;

  /** @returns the message */
  __<UNF extends boolean | undefined = undefined>(
    config: Partial<i18nFuncConfigPart> & { undefinedNotFound?: UNF; locale?: Locale }, key: string, replacements?: string | Record<string, string>
  ): UNF extends true ? string | undefined : string;

  getTranslator<UNF extends boolean = false, L extends Locale | undefined = undefined>(
    config?: i18nFuncConfigPart & { undefinedNotFound?: UNF; locale?: L }
  ): Translator<UNF, L>;

  /** same as {@link I18nProvider.__ __} but returns the whole array instead of a random element from an array. */
  array__(config: Partial<i18nFuncConfig>, key: string, replacements?: string | Record<string, string>): string | string[];

  /** @returns the formatted number as a string, or the original number if the formatter for the locale does not exist. */
  formatNumber<N extends number | bigint>(num: N, locale: Locale): string | N;
  formatNumber(num: number | bigint, locale?: never): string;

  /** @returns flatted object */
  flatten(object: Record<string, unknown>, objectPath?: string): Record<string, unknown>;

  /** @returns list of entries that are missing or equal with default data */
  findMissing(checkEqual?: boolean): Record<string, string[]>;

  logWarn(...msg: string[]): unknown;

  static formatMessage(message: string, replacements?: string | Record<string, unknown>): typeof message;
}