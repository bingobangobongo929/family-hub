'use client'

import Link from 'next/link'
import { Plus, Calendar, ShoppingCart, StickyNote, Gift, CheckSquare, Sun } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-context'

const quickActions = [
  { href: '/calendar?add=true', icon: Calendar, labelKey: 'quickActions.event', color: 'bg-teal-500' },
  { href: '/tasks?add=true', icon: CheckSquare, labelKey: 'quickActions.chore', color: 'bg-emerald-500' },
  { href: '/shopping?add=true', icon: ShoppingCart, labelKey: 'quickActions.shopping', color: 'bg-amber-500' },
  { href: '/notes?add=true', icon: StickyNote, labelKey: 'quickActions.note', color: 'bg-sky-500' },
  { href: '/routines', icon: Sun, labelKey: 'quickActions.routine', color: 'bg-orange-500' },
  { href: '/rewards', icon: Gift, labelKey: 'quickActions.reward', color: 'bg-purple-500' },
]

export default function QuickActionsWidget() {
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark">
      <div className="flex items-center gap-2 mb-3">
        <Plus className="w-4 h-4 text-teal-500" />
        <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">{t('quickActions.title')}</h3>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-2">
        {quickActions.map(action => (
          <Link
            key={action.labelKey}
            href={action.href}
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className={`w-9 h-9 rounded-xl ${action.color} flex items-center justify-center shadow-sm`}>
              <action.icon className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t(action.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
