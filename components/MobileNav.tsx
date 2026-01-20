'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Calendar,
  CheckSquare,
  ShoppingCart,
  StickyNote,
  Gift,
  Settings,
  Trash2,
  Image as ImageIcon,
  Flag,
  History,
  UserCircle,
  Sun,
  MoreHorizontal,
  Star,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n-context'
import { useSettings } from '@/lib/settings-context'
import { useFamily } from '@/lib/family-context'
import QuickAccessSheet from './QuickAccessSheet'
import Modal from './ui/Modal'
import { AvatarDisplay } from './PhotoUpload'
import MemberProfileModal from './MemberProfileModal'
import { FamilyMember } from '@/lib/database.types'

// All available nav items with icons
const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '/': Home,
  '/calendar': Calendar,
  '/tasks': CheckSquare,
  '/routines': Sun,
  '/shopping': ShoppingCart,
  '/f1': Flag,
  '/history': History,
  '/rewards': Gift,
  '/gallery': ImageIcon,
  '/bindicator': Trash2,
  '/notes': StickyNote,
  '/contacts': UserCircle,
  '/settings': Settings,
}

const NAV_LABELS: Record<string, string> = {
  '/': 'nav.dashboard',
  '/calendar': 'nav.calendar',
  '/tasks': 'nav.tasks',
  '/routines': 'nav.routines',
  '/shopping': 'nav.shopping',
  '/f1': 'nav.f1',
  '/history': 'nav.history',
  '/rewards': 'nav.rewards',
  '/gallery': 'nav.gallery',
  '/bindicator': 'nav.bindicator',
  '/notes': 'nav.notes',
  '/contacts': 'nav.contacts',
  '/settings': 'nav.settings',
}

// Default mobile nav items if no pinned items set
const DEFAULT_MOBILE_NAV = ['/', '/calendar', '/tasks', '/shopping']

interface MobileNavProps {
  onMoreClick: () => void
}

export default function MobileNav({ onMoreClick }: MobileNavProps) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { sidebarPinnedItems, rewardsEnabled } = useSettings()
  const { members } = useFamily()
  const [showQuickSheet, setShowQuickSheet] = useState(false)
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)

  // Get pinned items for mobile nav (max 4 to fit nicely with "more" button)
  const pinnedItems = sidebarPinnedItems.length > 0
    ? sidebarPinnedItems.slice(0, 4)
    : DEFAULT_MOBILE_NAV

  // Filter out rewards if disabled
  const mobileNavItems = pinnedItems.filter(href => {
    if (href === '/rewards' && !rewardsEnabled) return false
    return NAV_ICONS[href] !== undefined
  })

  // Check if current path is one of the pinned items
  const isMoreActive = !mobileNavItems.some(href => href === pathname)

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-700/80"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-around px-1 py-1">
          {mobileNavItems.map(href => {
            const Icon = NAV_ICONS[href]
            const labelKey = NAV_LABELS[href]
            const isActive = pathname === href

            if (!Icon) return null

            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[60px] px-2 py-1.5 rounded-2xl transition-all tap-highlight no-select focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30'
                    : 'text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-teal-500 text-white shadow-sm' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-teal-700 dark:text-teal-300' : ''}`}>{t(labelKey)}</span>
              </Link>
            )
          })}

          {/* More button - opens quick access sheet */}
          <button
            onClick={() => setShowQuickSheet(true)}
            aria-label={t('nav.menu')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[60px] px-2 py-1.5 rounded-2xl transition-all tap-highlight no-select focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
              isMoreActive
                ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30'
                : 'text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${isMoreActive ? 'bg-teal-500 text-white shadow-sm' : ''}`}>
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className={`text-xs font-medium ${isMoreActive ? 'text-teal-700 dark:text-teal-300' : ''}`}>{t('nav.menu')}</span>
          </button>
        </div>
      </nav>

      {/* Quick Access Sheet */}
      <QuickAccessSheet
        isOpen={showQuickSheet}
        onClose={() => setShowQuickSheet(false)}
        onFamilyClick={() => setShowFamilyModal(true)}
      />

      {/* Family Modal */}
      <Modal
        isOpen={showFamilyModal}
        onClose={() => setShowFamilyModal(false)}
        title={t('nav.family')}
        size="md"
      >
        <div className="space-y-2">
          {members.map(member => (
            <button
              key={member.id}
              onClick={() => {
                setShowFamilyModal(false)
                setSelectedMember(member)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left tap-highlight no-select min-h-[56px]"
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
              {rewardsEnabled && member.role === 'child' && (
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full">
                  <Star className="w-4 h-4 fill-current" />
                  {member.points}
                </span>
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* Member Profile Modal */}
      <MemberProfileModal
        member={selectedMember}
        isOpen={selectedMember !== null}
        onClose={() => setSelectedMember(null)}
      />
    </>
  )
}
