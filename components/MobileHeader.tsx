'use client'

import { Menu, Users } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-context'

interface MobileHeaderProps {
  onMenuClick: () => void
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 glass safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onMenuClick}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors touch-target"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-display text-lg font-semibold bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-400 dark:to-teal-500 bg-clip-text text-transparent">
            {t('nav.appName')}
          </h1>
        </div>

        {/* Spacer for balance */}
        <div className="w-10" />
      </div>
    </header>
  )
}
