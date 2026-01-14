// Date-fns locale integration for i18n
import { enGB, da } from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns'
import type { Locale } from './i18n-context'

// Map app locales to date-fns locales
const DATE_LOCALES: Record<Locale, DateFnsLocale> = {
  en: enGB,  // Using British English for day-first date format
  da: da,
}

/**
 * Get the date-fns locale object for a given app locale
 * @param locale - The app locale ('en' or 'da')
 * @returns The corresponding date-fns Locale object
 */
export function getDateLocale(locale: Locale): DateFnsLocale {
  return DATE_LOCALES[locale] || enGB
}

/**
 * Get locale string for Intl APIs (e.g., toLocaleDateString)
 * @param locale - The app locale ('en' or 'da')
 * @returns The locale string for Intl APIs
 */
export function getIntlLocale(locale: Locale): string {
  return locale === 'da' ? 'da-DK' : 'en-GB'
}
