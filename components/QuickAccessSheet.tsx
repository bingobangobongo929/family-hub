'use client'

import { useEffect, useRef } from 'react'
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
  X,
  Users,
  Star,
  ChevronRight,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n-context'
import { useSettings } from '@/lib/settings-context'
import { useFamily } from '@/lib/family-context'
import { AvatarDisplay } from './PhotoUpload'

// All nav items available
const ALL_NAV_ITEMS = [
  { href: '/', labelKey: 'nav.dashboard', icon: Home },
  { href: '/calendar', labelKey: 'nav.calendar', icon: Calendar },
  { href: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { href: '/routines', labelKey: 'nav.routines', icon: Sun },
  { href: '/shopping', labelKey: 'nav.shopping', icon: ShoppingCart },
  { href: '/f1', labelKey: 'nav.f1', icon: Flag },
  { href: '/history', labelKey: 'nav.history', icon: History },
  { href: '/rewards', labelKey: 'nav.rewards', icon: Gift, requiresRewards: true },
  { href: '/gallery', labelKey: 'nav.gallery', icon: ImageIcon },
  { href: '/bindicator', labelKey: 'nav.bindicator', icon: Trash2 },
  { href: '/notes', labelKey: 'nav.notes', icon: StickyNote },
  { href: '/contacts', labelKey: 'nav.contacts', icon: UserCircle },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
]

interface QuickAccessSheetProps {
  isOpen: boolean
  onClose: () => void
  onFamilyClick?: () => void
}

export default function QuickAccessSheet({ isOpen, onClose, onFamilyClick }: QuickAccessSheetProps) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { rewardsEnabled } = useSettings()
  const { members } = useFamily()
  const sheetRef = useRef<HTMLDivElement>(null)

  // Filter out unavailable items
  const availableItems = ALL_NAV_ITEMS.filter(item => !item.requiresRewards || rewardsEnabled)

  // Close on route change
  useEffect(() => {
    if (isOpen) {
      onClose()
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle swipe down to close
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return

    let startY = 0
    let currentY = 0

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      currentY = e.touches[0].clientY
      const diff = currentY - startY

      if (diff > 0 && sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${diff}px)`
      }
    }

    const handleTouchEnd = () => {
      const diff = currentY - startY
      if (diff > 100) {
        onClose()
      }
      if (sheetRef.current) {
        sheetRef.current.style.transform = ''
      }
      startY = 0
      currentY = 0
    }

    const sheet = sheetRef.current
    sheet.addEventListener('touchstart', handleTouchStart, { passive: true })
    sheet.addEventListener('touchmove', handleTouchMove, { passive: true })
    sheet.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart)
      sheet.removeEventListener('touchmove', handleTouchMove)
      sheet.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl animate-slide-up transition-transform"
        style={{ maxHeight: '85vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('nav.menu')}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 tap-highlight"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid of navigation items */}
        <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
          <div className="grid grid-cols-4 gap-2">
            {availableItems.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all tap-highlight no-select ${
                    isActive
                      ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                      : 'text-slate-600 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${isActive ? 'bg-teal-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">{t(item.labelKey)}</span>
                </Link>
              )
            })}
          </div>

          {/* Family Section */}
          {members.length > 0 && onFamilyClick && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  onClose()
                  onFamilyClick()
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 tap-highlight no-select"
              >
                <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span className="flex-1 text-left font-medium text-slate-700 dark:text-slate-300">{t('nav.family')}</span>
                <div className="flex -space-x-2">
                  {members.slice(0, 4).map(member => (
                    <div key={member.id} className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 overflow-hidden">
                      <AvatarDisplay
                        photoUrl={member.photo_url}
                        emoji={member.avatar}
                        name={member.name}
                        color={member.color}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
