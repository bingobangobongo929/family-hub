'use client'

import { useTranslation } from '@/lib/i18n-context'

const FLAGS = {
  en: '🇬🇧',
  da: '🇩🇰',
} as const

export default function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation()

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'da' : 'en')
  }

  const title = locale === 'en' ? t('nav.switchToDanish') : t('nav.switchToEnglish')

  return (
    <button
      onClick={toggleLocale}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      title={title}
      aria-label={title}
    >
      {FLAGS[locale]}
    </button>
  )
}
