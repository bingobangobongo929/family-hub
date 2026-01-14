'use client'

import { useTranslation } from '@/lib/i18n-context'

// SVG flag components that work on all platforms
function UKFlag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
      <clipPath id="uk-clip">
        <path d="M0,0 v30 h60 v-30 z"/>
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-clip)" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
    </svg>
  )
}

function DanishFlag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 37 28" xmlns="http://www.w3.org/2000/svg">
      <rect width="37" height="28" fill="#C8102E"/>
      <rect x="12" y="0" width="4" height="28" fill="#fff"/>
      <rect x="0" y="12" width="37" height="4" fill="#fff"/>
    </svg>
  )
}

export default function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation()

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'da' : 'en')
  }

  const title = locale === 'en' ? t('nav.switchToDanish') : t('nav.switchToEnglish')

  return (
    <button
      onClick={toggleLocale}
      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors overflow-hidden"
      title={title}
      aria-label={title}
    >
      <div className="w-5 h-3.5 rounded-sm overflow-hidden shadow-sm">
        {locale === 'en' ? (
          <UKFlag className="w-full h-full" />
        ) : (
          <DanishFlag className="w-full h-full" />
        )}
      </div>
    </button>
  )
}
