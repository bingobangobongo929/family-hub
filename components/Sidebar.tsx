'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Calendar,
  CheckSquare,
  ShoppingCart,
  StickyNote,
  Users,
  LogOut,
  Sun,
  Moon,
  Gift,
  Settings,
  Star
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/routines', label: 'Routines', icon: Sun },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/rewards', label: 'Rewards', icon: Gift, requiresRewards: true },
  { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { members } = useFamily()
  const { rewardsEnabled } = useSettings()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 glass shadow-xl z-50 flex flex-col">
      <div className="p-6 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-display text-xl font-semibold bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-400 dark:to-teal-500 bg-clip-text text-transparent">
              Family Hub
            </h1>
          </div>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-teal-50 dark:hover:bg-slate-700 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems
            .filter(item => !item.requiresRewards || rewardsEnabled)
            .map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-slate-700/50 hover:text-teal-700 dark:hover:text-teal-400'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? '' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
        </nav>

        {/* Family Section */}
        <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-display text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
            Family
          </h3>
          <div className="space-y-1">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ring-2 ring-white dark:ring-slate-700 shadow-sm"
                  style={{ backgroundColor: member.color }}
                >
                  {member.avatar || member.name[0]}
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 font-medium">{member.name}</span>
                {rewardsEnabled && member.role === 'child' && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-current" />
                    {member.points}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User section at bottom */}
      {user && (
        <div className="p-4 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-teal-500/20">
              E
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Ed
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Admin
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-coral-50 dark:hover:bg-coral-900/20 hover:text-coral-600 dark:hover:text-coral-400 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  )
}
