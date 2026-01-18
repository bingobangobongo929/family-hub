'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, ListChecks, ShoppingCart, Menu } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-context'

interface MobileNavProps {
  onMoreClick: () => void
}

// Main quick-access items for bottom nav
const MOBILE_NAV_ITEMS = [
  { href: '/', labelKey: 'nav.dashboard', icon: Home },
  { href: '/calendar', labelKey: 'nav.calendar', icon: Calendar },
  { href: '/routines', labelKey: 'nav.routines', icon: ListChecks },
  { href: '/shopping', labelKey: 'nav.shopping', icon: ShoppingCart },
]

export default function MobileNav({ onMoreClick }: MobileNavProps) {
  const pathname = usePathname()
  const { t } = useTranslation()

  // Check if current path is one of the "more" items (not in main nav)
  const isMoreActive = !MOBILE_NAV_ITEMS.some(item => item.href === pathname)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-700/80" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-around px-1 py-1">
        {MOBILE_NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[60px] px-2 py-1.5 rounded-2xl transition-all tap-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30'
                  : 'text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-teal-500 text-white shadow-sm' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-teal-700 dark:text-teal-300' : ''}`}>{t(item.labelKey)}</span>
            </Link>
          )
        })}

        {/* Menu button */}
        <button
          onClick={onMoreClick}
          aria-label={t('nav.menu')}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[60px] px-2 py-1.5 rounded-2xl transition-all tap-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
            isMoreActive
              ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30'
              : 'text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${isMoreActive ? 'bg-teal-500 text-white shadow-sm' : ''}`}>
            <Menu className="w-5 h-5" />
          </div>
          <span className={`text-xs font-medium ${isMoreActive ? 'text-teal-700 dark:text-teal-300' : ''}`}>{t('nav.menu')}</span>
        </button>
      </div>
    </nav>
  )
}
