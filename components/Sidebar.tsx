'use client'

import { useState, useMemo, useEffect } from 'react'
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
  Star,
  UserCircle,
  Trash2,
  Image,
  Flag,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { useTranslation } from '@/lib/i18n-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useEditMode } from '@/lib/edit-mode-context'
import { AvatarDisplay } from './PhotoUpload'
import MemberProfileModal from './MemberProfileModal'
import LanguageToggle from './LanguageToggle'
import { FamilyMember } from '@/lib/database.types'

// Nav items with translation keys
const DEFAULT_NAV_ITEMS = [
  { href: '/', labelKey: 'nav.dashboard', icon: Home },
  { href: '/routines', labelKey: 'nav.routines', icon: Sun },
  { href: '/calendar', labelKey: 'nav.calendar', icon: Calendar },
  { href: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { href: '/rewards', labelKey: 'nav.rewards', icon: Gift, requiresRewards: true },
  { href: '/shopping', labelKey: 'nav.shopping', icon: ShoppingCart },
  { href: '/gallery', labelKey: 'nav.gallery', icon: Image },
  { href: '/bindicator', labelKey: 'nav.bindicator', icon: Trash2 },
  { href: '/f1', labelKey: 'nav.f1', icon: Flag },
  { href: '/notes', labelKey: 'nav.notes', icon: StickyNote },
  { href: '/contacts', labelKey: 'nav.contacts', icon: UserCircle },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const { members, reorderMembers } = useFamily()
  const { rewardsEnabled, sidebarNavOrder, updateSetting } = useSettings()
  const { isEditMode } = useEditMode()
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) {
      onClose()
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    await signOut()
  }

  // Get nav items in the correct order
  const navItems = useMemo(() => {
    if (!sidebarNavOrder || sidebarNavOrder.length === 0) {
      return DEFAULT_NAV_ITEMS
    }
    // Sort nav items based on saved order
    const orderedItems = [...DEFAULT_NAV_ITEMS].sort((a, b) => {
      const indexA = sidebarNavOrder.indexOf(a.href)
      const indexB = sidebarNavOrder.indexOf(b.href)
      // Items not in the saved order go to the end
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
    return orderedItems
  }, [sidebarNavOrder])

  const moveNavItem = async (href: string, direction: 'up' | 'down') => {
    const currentOrder = navItems.map(item => item.href)
    const currentIndex = currentOrder.indexOf(href)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return

    // Swap positions
    const newOrder = [...currentOrder]
    ;[newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]]

    await updateSetting('sidebar_nav_order', newOrder)
  }

  const moveMember = async (memberId: string, direction: 'up' | 'down') => {
    await reorderMembers(memberId, direction)
  }

  const handleNavClick = () => {
    // Close sidebar on mobile when navigating
    if (onClose && window.innerWidth < 1024) {
      onClose()
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-full w-72 lg:w-64 glass shadow-xl z-50 flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-4 lg:p-6 flex-1 overflow-y-auto safe-top">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 lg:mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="font-display text-xl font-semibold bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-400 dark:to-teal-500 bg-clip-text text-transparent">
                {t('nav.appName')}
              </h1>
            </div>
            {/* Close button - mobile only */}
            <button
              onClick={onClose}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {navItems
              .filter(item => !item.requiresRewards || rewardsEnabled)
              .map((item, index, filteredItems) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                const isFirst = index === 0
                const isLast = index === filteredItems.length - 1

                return (
                  <div key={item.href} className="flex items-center gap-1">
                    {isEditMode && (
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveNavItem(item.href, 'up')}
                          disabled={isFirst}
                          className={`p-0.5 rounded ${isFirst ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700'}`}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveNavItem(item.href, 'down')}
                          disabled={isLast}
                          className={`p-0.5 rounded ${isLast ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700'}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <Link
                      href={isEditMode ? '#' : item.href}
                      onClick={(e) => {
                        if (isEditMode) {
                          e.preventDefault()
                        } else {
                          handleNavClick()
                        }
                      }}
                      className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 touch-target ${
                        isActive && !isEditMode
                          ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/25'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-slate-700/50 hover:text-teal-700 dark:hover:text-teal-400'
                      } ${isEditMode ? 'cursor-default' : ''}`}
                    >
                      <Icon className={`w-5 h-5 ${isActive && !isEditMode ? '' : 'text-teal-600 dark:text-teal-400'}`} />
                      <span className="font-medium">{t(item.labelKey)}</span>
                    </Link>
                  </div>
                )
              })}
          </nav>

          {/* Family Section */}
          <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
            <h3 className="font-display text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
              {t('nav.family')}
            </h3>
            <div className="space-y-1">
              {members.map((member, index) => {
                const isFirst = index === 0
                const isLast = index === members.length - 1

                return (
                  <div key={member.id} className="flex items-center gap-1">
                    {isEditMode && (
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveMember(member.id, 'up')}
                          disabled={isFirst}
                          className={`p-0.5 rounded ${isFirst ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700'}`}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveMember(member.id, 'down')}
                          disabled={isLast}
                          className={`p-0.5 rounded ${isLast ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700'}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (!isEditMode) {
                          setSelectedMember(member)
                        }
                      }}
                      className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left touch-target ${isEditMode ? 'cursor-default' : ''}`}
                    >
                      <AvatarDisplay
                        photoUrl={member.photo_url}
                        emoji={member.avatar}
                        name={member.name}
                        color={member.color}
                        size="xs"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 font-medium">{member.name}</span>
                      {rewardsEnabled && member.role === 'child' && !isEditMode && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                          <Star className="w-3 h-3 fill-current" />
                          {member.points}
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* User section at bottom */}
        {user && (
          <div className="p-4 border-t border-slate-200/60 dark:border-slate-700/60 safe-bottom">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-teal-500/20">
                E
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Ed
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t('nav.admin')}
                </p>
              </div>
              {/* Language and theme toggles */}
              <div className="flex items-center gap-1">
                <LanguageToggle />
                <button
                  onClick={toggleTheme}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={theme === 'light' ? t('nav.switchToDark') : t('nav.switchToLight')}
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-coral-50 dark:hover:bg-coral-900/20 hover:text-coral-600 dark:hover:text-coral-400 rounded-xl transition-colors touch-target"
            >
              <LogOut className="w-4 h-4" />
              {t('nav.signOut')}
            </button>
          </div>
        )}

        {/* Member Profile Modal */}
        <MemberProfileModal
          member={selectedMember}
          isOpen={selectedMember !== null}
          onClose={() => setSelectedMember(null)}
        />
      </aside>
    </>
  )
}
