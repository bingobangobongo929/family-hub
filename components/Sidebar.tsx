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
  X,
  Edit3,
  History,
  ChevronRight,
  MoreHorizontal,
  Pin
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
import Modal from './ui/Modal'
import { FamilyMember } from '@/lib/database.types'

// Nav items with translation keys
const ALL_NAV_ITEMS = [
  { href: '/', labelKey: 'nav.dashboard', icon: Home },
  { href: '/calendar', labelKey: 'nav.calendar', icon: Calendar },
  { href: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { href: '/routines', labelKey: 'nav.routines', icon: Sun },
  { href: '/shopping', labelKey: 'nav.shopping', icon: ShoppingCart },
  { href: '/f1', labelKey: 'nav.f1', icon: Flag },
  { href: '/history', labelKey: 'nav.history', icon: History },
  { href: '/rewards', labelKey: 'nav.rewards', icon: Gift, requiresRewards: true },
  { href: '/gallery', labelKey: 'nav.gallery', icon: Image },
  { href: '/bindicator', labelKey: 'nav.bindicator', icon: Trash2 },
  { href: '/notes', labelKey: 'nav.notes', icon: StickyNote },
  { href: '/contacts', labelKey: 'nav.contacts', icon: UserCircle },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
]

const MAX_PINNED = 6

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
  const { rewardsEnabled, sidebarPinnedItems, updateSetting } = useSettings()
  const { isEditMode, setIsEditMode } = useEditMode()
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [moreExpanded, setMoreExpanded] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) {
      onClose()
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    await signOut()
  }

  // Split nav items into pinned and more
  const { pinnedItems, moreItems } = useMemo(() => {
    const available = ALL_NAV_ITEMS.filter(item => !item.requiresRewards || rewardsEnabled)

    // Get pinned items in order
    const pinned = sidebarPinnedItems
      .map(href => available.find(item => item.href === href))
      .filter(Boolean) as typeof ALL_NAV_ITEMS

    // Get remaining items for "More" section
    const more = available.filter(item => !sidebarPinnedItems.includes(item.href))

    return { pinnedItems: pinned, moreItems: more }
  }, [sidebarPinnedItems, rewardsEnabled])

  // Pin/unpin an item
  const togglePin = async (href: string) => {
    const isPinned = sidebarPinnedItems.includes(href)
    let newPinned: string[]

    if (isPinned) {
      // Unpin - remove from pinned list
      newPinned = sidebarPinnedItems.filter(h => h !== href)
    } else {
      // Pin - add to pinned list (if under max)
      if (sidebarPinnedItems.length >= MAX_PINNED) {
        // At max, can't pin more
        return
      }
      newPinned = [...sidebarPinnedItems, href]
    }

    await updateSetting('sidebar_pinned_items', newPinned)
  }

  // Move item within pinned section
  const movePinnedItem = async (href: string, direction: 'up' | 'down') => {
    const currentIndex = sidebarPinnedItems.indexOf(href)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= sidebarPinnedItems.length) return

    const newPinned = [...sidebarPinnedItems]
    ;[newPinned[currentIndex], newPinned[targetIndex]] = [newPinned[targetIndex], newPinned[currentIndex]]

    await updateSetting('sidebar_pinned_items', newPinned)
  }

  const moveMember = async (memberId: string, direction: 'up' | 'down') => {
    await reorderMembers(memberId, direction)
  }

  const handleNavClick = () => {
    if (onClose && window.innerWidth < 1024) {
      onClose()
    }
  }

  // Render a nav item
  const renderNavItem = (item: typeof ALL_NAV_ITEMS[0], isPinned: boolean, index: number, total: number) => {
    const Icon = item.icon
    const isActive = pathname === item.href
    const isFirst = index === 0
    const isLast = index === total - 1
    const canPin = !isPinned && sidebarPinnedItems.length < MAX_PINNED

    return (
      <div key={item.href} className="flex items-center gap-1">
        {isEditMode && (
          <div className="flex items-center gap-0.5">
            {/* Pin/Unpin button */}
            <button
              onClick={() => togglePin(item.href)}
              disabled={!isPinned && !canPin}
              aria-label={isPinned ? 'Unpin' : 'Pin'}
              className={`p-1 rounded transition-colors ${
                isPinned
                  ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                  : canPin
                    ? 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <Star className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
            </button>
            {/* Reorder arrows (only for pinned items) */}
            {isPinned && (
              <div className="flex flex-col">
                <button
                  onClick={() => movePinnedItem(item.href, 'up')}
                  disabled={isFirst}
                  aria-label="Move up"
                  className={`p-0.5 rounded ${isFirst ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700'}`}
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => movePinnedItem(item.href, 'down')}
                  disabled={isLast}
                  aria-label="Move down"
                  className={`p-0.5 rounded ${isLast ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700'}`}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}
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
          className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
            isActive && !isEditMode
              ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-slate-700/50 hover:text-teal-700 dark:hover:text-teal-400'
          } ${isEditMode ? 'cursor-default' : ''}`}
        >
          <Icon className={`w-5 h-5 ${isActive && !isEditMode ? '' : 'text-teal-600 dark:text-teal-400'}`} />
          <span className="font-medium text-sm">{t(item.labelKey)}</span>
        </Link>
      </div>
    )
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
        <div className="p-3 lg:p-4 flex-1 flex flex-col safe-top">
          {/* Header - more compact */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-display text-lg font-semibold bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-400 dark:to-teal-500 bg-clip-text text-transparent">
                {t('nav.appName')}
              </h1>
            </div>
            {/* Close button - mobile only */}
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="lg:hidden w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pinned Navigation */}
          <nav className="space-y-0.5">
            {pinnedItems.map((item, index) => renderNavItem(item, true, index, pinnedItems.length))}
          </nav>

          {/* More Section - Collapsible */}
          {moreItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
              <button
                onClick={() => setMoreExpanded(!moreExpanded)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              >
                <MoreHorizontal className="w-5 h-5" />
                <span className="font-medium text-sm flex-1 text-left">{t('nav.more') || 'More'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${moreExpanded ? 'rotate-180' : ''}`} />
              </button>
              {moreExpanded && (
                <div className="mt-1 space-y-0.5">
                  {moreItems.map((item, index) => renderNavItem(item, false, index, moreItems.length))}
                </div>
              )}
            </div>
          )}

          {/* Family Section - Compact button that opens modal */}
          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setShowFamilyModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-slate-700/50 hover:text-teal-700 dark:hover:text-teal-400 transition-all duration-200"
            >
              <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span className="font-medium text-sm flex-1 text-left">{t('nav.family')}</span>
              {/* Show member avatars preview */}
              <div className="flex -space-x-1.5">
                {members.slice(0, 3).map(member => (
                  <div key={member.id} className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-slate-800 overflow-hidden">
                    <AvatarDisplay
                      photoUrl={member.photo_url}
                      emoji={member.avatar}
                      name={member.name}
                      color={member.color}
                      size="xs"
                    />
                  </div>
                ))}
                {members.length > 3 && (
                  <div className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    +{members.length - 3}
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Spacer to push user section to bottom */}
          <div className="flex-1" />
        </div>

        {/* User section at bottom - more compact */}
        {user && (
          <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/60 safe-bottom">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-xs font-semibold shadow-md">
                E
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">Ed</p>
              </div>
              {/* Action buttons */}
              <div className="flex items-center">
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  aria-label={isEditMode ? 'Done editing' : 'Edit sidebar'}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isEditMode
                      ? 'bg-teal-500 text-white'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600'
                  }`}
                >
                  {isEditMode ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </button>
                <LanguageToggle />
                <button
                  onClick={toggleTheme}
                  aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors"
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-coral-50 dark:hover:bg-coral-900/20 hover:text-coral-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Member Profile Modal */}
        <MemberProfileModal
          member={selectedMember}
          isOpen={selectedMember !== null}
          onClose={() => setSelectedMember(null)}
        />

        {/* Family Modal */}
        <Modal
          isOpen={showFamilyModal}
          onClose={() => setShowFamilyModal(false)}
          title={t('nav.family')}
          size="md"
        >
          <div className="space-y-2">
            {members.map((member, index) => {
              const isFirst = index === 0
              const isLast = index === members.length - 1

              return (
                <div key={member.id} className="flex items-center gap-2">
                  {isEditMode && (
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveMember(member.id, 'up')}
                        disabled={isFirst}
                        aria-label="Move up"
                        className={`p-1 rounded ${isFirst ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700'}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveMember(member.id, 'down')}
                        disabled={isLast}
                        aria-label="Move down"
                        className={`p-1 rounded ${isLast ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700'}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (!isEditMode) {
                        setShowFamilyModal(false)
                        setSelectedMember(member)
                      }
                    }}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left min-h-[56px] ${isEditMode ? 'cursor-default' : ''}`}
                  >
                    <AvatarDisplay
                      photoUrl={member.photo_url}
                      emoji={member.avatar}
                      name={member.name}
                      color={member.color}
                      size="sm"
                    />
                    <div className="flex-1">
                      <span className="text-base font-medium text-slate-700 dark:text-slate-200">{member.name}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{member.role}</p>
                    </div>
                    {rewardsEnabled && member.role === 'child' && !isEditMode && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full">
                        <Star className="w-4 h-4 fill-current" />
                        {member.points}
                      </span>
                    )}
                    {!isEditMode && <ChevronRight className="w-5 h-5 text-slate-400" />}
                  </button>
                </div>
              )
            })}
          </div>
        </Modal>
      </aside>
    </>
  )
}
