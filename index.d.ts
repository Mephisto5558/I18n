import type { LocaleString } from 'discord-api-types/v10';
export type Locale = Exclude<LocaleString, `en${string}`> | 'en';

type i18nFuncConfig = { locale?: Locale; errorNotFound?: boolean; undefinedNotFound?: boolean; backupPath?: string };

export default I18nProvider;
declare class I18nProvider {
  constructor(options: {
    localesPath?: string; defaultLocale?: string; separator?: string;
    notFoundMessage?: string; errorNotFound?: boolean; undefinedNotFound?: boolean;
    warnLoggingFunction?(...msg: string[]): unknown;
  });

  config: {
    localesPath: string; defaultLocale: Locale; separator: string;
    errorNotFound: boolean; undefinedNotFound: boolean; notFoundMessage: string;
  };

  availableLocales: Map<Locale, string>;
  localeData: Record<Locale, string | string[]>;

  loadLocale(locale: Locale): Promise<void>;
  loadAllLocales(): Promise<void>;

  /** @returns the message*/
  __<UNF extends boolean | undefined = undefined>(
    config: i18nFuncConfig & { undefinedNotFound?: UNF }, key: string, replacements?: string | Record<string, string>
  ): UNF extends true ? string | undefined : string;

  /** same as {@link I18nProvider.__ __} but returns the whole array instead of a random element from an array.*/
  array__(config: i18nFuncConfig, key: string, replacements?: string | Record<string, string>): string | string[];

  /** @returns flatted object*/
  flatten(object: object, objectPath: string): object;

  /** @returns list of entries that are missing or equal with default data*/
  findMissing(checkEqual: boolean): object;

  logWarn(...msg: string[]): unknown;

  static formatMessage(message: string, replacements?: string | Record<string, unknown>): typeof message;
}