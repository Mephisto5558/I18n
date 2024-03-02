export = I18nProvider;
declare class I18nProvider {
  constructor(
    localesPath?: string, defaultLocale?: string, separator?: string,
    notFoundMessage?: string, errorNotFound?: boolean, undefinedNotFound?: boolean,
    warnLoggingFunction?: (...msg: string) => unknown
  );

  config: {
    localesPath: string; defaultLocale: string; separator: string;
    errorNotFound: boolean; undefinedNotFound: boolean; notFoundMessage: string;
  };

  /** <locale key, file path>*/
  availableLocales: Map<string, string>;
  localeData: Record<string, string | string[]>;

  loadLocale(locale: string): Promise<void>;
  loadAllLocales(): Promise<void>;

  /** @returns the message*/
  __(
    config: { locale?: string; errorNotFound?: boolean; undefinedNotFound?: boolean; backupPath?: string },
    key: string, replacements?: string | Record<string, string>
  ): string;

  /** @returns flatted object*/
  flatten(object: object, objectPath: string): object;

  /** @returns list of entries that are missing or equal with default data*/
  findMissing(checkEqual: boolean): object;

  logWarn(...msg: string): unknown;
}