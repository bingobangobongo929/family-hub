'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, CheckSquare, ShoppingCart, Menu } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-context'

interface MobileNavProps {
  onMoreClick: () => void
}

// Main quick-access items for bottom nav
const MOBILE_NAV_ITEMS = [
  { href: '/', labelKey: 'nav.dashboard', icon: Home },
  { href: '/calendar', labelKey: 'nav.calendar', icon: Calendar },
  { href: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { href: '/shopping', labelKey: 'nav.shopping', icon: ShoppingCart },
]

export default function MobileNav({ onMoreClick }: MobileNavProps) {
  const pathname = usePathname()
  const { t } = useTranslation()

  // Check if current path is one of the "more" items (not in main nav)
  const isMoreActive = !MOBILE_NAV_ITEMS.some(item => item.href === pathname)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-slate-200/60 dark:border-slate-700/60 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all touch-target min-w-[64px] ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </Link>
          )
        })}

        {/* Menu button */}
        <button
          onClick={onMoreClick}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all touch-target min-w-[64px] ${
            isMoreActive
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Menu className={`w-6 h-6 ${isMoreActive ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-medium">{t('nav.menu')}</span>
        </button>
      </div>
    </nav>
  )
}
