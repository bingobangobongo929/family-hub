'use client'

import { useState, useMemo } from 'react'
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
  Edit3,
  ChevronUp,
  ChevronDown,
  Check
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { AvatarDisplay } from './PhotoUpload'
import MemberProfileModal from './MemberProfileModal'
import { FamilyMember } from '@/lib/database.types'

const DEFAULT_NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/routines', label: 'Routines', icon: Sun },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/rewards', label: 'Rewards', icon: Gift, requiresRewards: true },
  { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { href: '/gallery', label: 'Gallery', icon: Image },
  { href: '/bindicator', label: 'Bindicator', icon: Trash2 },
  { href: '/f1', label: 'Formula 1', icon: Flag },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/contacts', label: 'Contacts', icon: UserCircle },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { members, reorderMembers } = useFamily()
  const { rewardsEnabled, sidebarNavOrder, updateSetting } = useSettings()
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                isEditMode
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-teal-50 dark:hover:bg-slate-700 hover:text-teal-600 dark:hover:text-teal-400'
              }`}
              title={isEditMode ? 'Done editing' : 'Reorder sidebar'}
            >
              {isEditMode ? <Check className="w-5 h-5" /> : <Edit3 className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-teal-50 dark:hover:bg-slate-700 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
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
                    onClick={(e) => isEditMode && e.preventDefault()}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive && !isEditMode
                        ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/25'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-slate-700/50 hover:text-teal-700 dark:hover:text-teal-400'
                    } ${isEditMode ? 'cursor-default' : ''}`}
                  >
                    <Icon className={`w-5 h-5 ${isActive && !isEditMode ? '' : 'text-teal-600 dark:text-teal-400'}`} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </div>
              )
            })}
        </nav>

        {/* Family Section */}
        <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-display text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
            Family
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
                    onClick={() => !isEditMode && setSelectedMember(member)}
                    className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left ${isEditMode ? 'cursor-default' : ''}`}
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

      {/* Member Profile Modal */}
      <MemberProfileModal
        member={selectedMember}
        isOpen={selectedMember !== null}
        onClose={() => setSelectedMember(null)}
      />
    </aside>
  )
}
