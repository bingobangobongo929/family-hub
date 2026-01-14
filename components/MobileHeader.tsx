'use client'

import { Menu } from 'lucide-react'

interface MobileHeaderProps {
  onMenuClick: () => void
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <button
      onClick={onMenuClick}
      className="lg:hidden fixed top-3 left-3 z-40 w-11 h-11 flex items-center justify-center rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 active:scale-95 transition-all touch-target safe-top"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}
