'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, differenceInDays, differenceInYears, addYears, isBefore, startOfDay } from 'date-fns'
import { Cake, Calendar, Star } from 'lucide-react'
import { FamilyMember, CalendarEvent } from '@/lib/database.types'
import { AvatarDisplay } from './PhotoUpload'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'

interface MemberProfileModalProps {
  member: FamilyMember | null
  isOpen: boolean
  onClose: () => void
}

export default function MemberProfileModal({ member, isOpen, onClose }: MemberProfileModalProps) {
  const { rewardsEnabled } = useSettings()
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (!member || !isOpen) return

    const fetchUpcomingEvents = async () => {
      setLoading(true)
      try {
        const today = new Date()
        const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)

        // Fetch events where this member is tagged
        const { data: eventMembers } = await supabase
          .from('event_members')
          .select('event_id')
          .eq('member_id', member.id)

        if (eventMembers && eventMembers.length > 0) {
          const eventIds = eventMembers.map(em => em.event_id)

          const { data: events } = await supabase
            .from('calendar_events')
            .select('*, category:event_categories(*)')
            .in('id', eventIds)
            .gte('start_time', today.toISOString())
            .lte('start_time', twoWeeksLater.toISOString())
            .order('start_time', { ascending: true })
            .limit(5)

          setUpcomingEvents((events as CalendarEvent[]) || [])
        } else {
          setUpcomingEvents([])
        }
      } catch (error) {
        console.error('Error fetching events:', error)
      }
      setLoading(false)
    }

    fetchUpcomingEvents()
  }, [member, isOpen])

  // Don't render until mounted (for SSR) or if not open
  if (!mounted || !isOpen || !member) return null

  // Calculate birthday info
  const getBirthdayInfo = () => {
    if (!member.date_of_birth) return null

    const dob = parseISO(member.date_of_birth)
    const today = startOfDay(new Date())
    const age = differenceInYears(today, dob)

    // Find next birthday
    let nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
    if (isBefore(nextBirthday, today)) {
      nextBirthday = addYears(nextBirthday, 1)
    }

    const daysUntil = differenceInDays(nextBirthday, today)
    const turningAge = age + (daysUntil === 0 ? 0 : 1)

    return {
      age,
      daysUntil,
      turningAge,
      dateFormatted: format(dob, 'MMMM do'),
    }
  }

  const birthdayInfo = getBirthdayInfo()

  // Get role emoji
  const getRoleEmoji = () => {
    switch (member.role) {
      case 'parent': return '👨‍👩‍👧'
      case 'child': return '🧒'
      case 'pet': return '🐾'
      default: return '👤'
    }
  }

  // Get fun fact based on role
  const getFunFact = () => {
    if (member.role === 'child') {
      // Only show star-based badges if stars are enabled for this member
      if (member.stars_enabled) {
        if (member.points >= 100) return { emoji: '🌟', text: t('memberProfile.badges.superStar') }
        if (member.points >= 50) return { emoji: '⭐', text: t('memberProfile.badges.risingStar') }
        if (member.points >= 25) return { emoji: '✨', text: t('memberProfile.badges.starInTraining') }
        return { emoji: '🚀', text: t('memberProfile.badges.justStarted') }
      }
      // Generic badge for kids without stars tracking
      return { emoji: '🧒', text: t('memberProfile.badges.littleOne') }
    }
    if (member.role === 'pet') {
      return { emoji: '🐾', text: t('memberProfile.badges.bestFriend') }
    }
    return { emoji: '🏠', text: t('memberProfile.badges.familyCaptain') }
  }

  const funFact = getFunFact()

  // Use portal to render at document body level (outside sidebar)
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal - 4:3 aspect ratio, sized for large touchscreen */}
      <div
        className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          width: 'min(720px, 85vw)',
          height: 'min(540px, 80vh)',
          aspectRatio: '4/3',
          background: `linear-gradient(135deg, ${member.color}15 0%, transparent 60%), ${typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff'}`,
        }}
      >
        {/* Two-column layout for 4:3 */}
        <div className="h-full flex">
          {/* Left side - Avatar and identity */}
          <div className="w-2/5 h-full flex flex-col items-center justify-center p-6 border-r border-slate-100 dark:border-slate-700">
            <div
              className="w-32 h-32 rounded-full ring-4 ring-slate-100 dark:ring-slate-600 shadow-xl overflow-hidden flex items-center justify-center text-5xl"
              style={{ backgroundColor: member.photo_url ? 'transparent' : member.color }}
            >
              {member.photo_url ? (
                <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
              ) : member.avatar ? (
                <span>{member.avatar}</span>
              ) : (
                <span className="text-white font-bold text-4xl">{member.name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <h2 className="mt-4 text-2xl font-bold text-slate-800 dark:text-slate-100 text-center">
              {member.name}
            </h2>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl">{getRoleEmoji()}</span>
              <span className="text-base text-slate-500 dark:text-slate-400 capitalize">{member.role}</span>
            </div>

            {/* Fun badge */}
            <div
              className="mt-3 px-4 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${member.color}20`,
                color: member.color,
              }}
            >
              {funFact.emoji} {funFact.text}
            </div>
          </div>

          {/* Right side - Info cards */}
          <div className="w-3/5 h-full p-5 flex flex-col justify-center gap-4">
            {/* Birthday Card */}
            {birthdayInfo && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-100 dark:border-pink-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center">
                    <Cake className="w-6 h-6 text-pink-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-pink-600 dark:text-pink-400 font-medium">
                      {birthdayInfo.dateFormatted}
                    </p>
                    <p className="text-xs text-pink-500/70 dark:text-pink-400/70">
                      {birthdayInfo.daysUntil === 0 ? (
                        <span className="font-bold">{t('memberProfile.birthdayToday')} 🎉</span>
                      ) : birthdayInfo.daysUntil === 1 ? (
                        <span>{t('memberProfile.birthdayTomorrow', { age: birthdayInfo.turningAge })}</span>
                      ) : (
                        <span>{t('memberProfile.daysUntilBirthday', { days: birthdayInfo.daysUntil, age: birthdayInfo.turningAge })}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">{birthdayInfo.age}</p>
                    <p className="text-xs text-pink-500/70 dark:text-pink-400/70">{t('memberProfile.yearsOld')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Points Card - Only for children with rewards enabled and stars_enabled */}
            {member.role === 'child' && rewardsEnabled && member.stars_enabled && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-100 dark:border-amber-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <Star className="w-6 h-6 text-amber-500 fill-current" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                      {t('memberProfile.starPoints')}
                    </p>
                    <p className="text-xs text-amber-500/70 dark:text-amber-400/70">
                      {t('memberProfile.earnedFromChores')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{member.points}</p>
                    <p className="text-xs text-amber-500/70 dark:text-amber-400/70">{t('memberProfile.stars')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Events */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/50 flex-1 min-h-0">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-teal-500" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('memberProfile.comingUp')}
                </p>
              </div>

              {loading ? (
                <div className="py-4 text-center">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : upcomingEvents.length > 0 ? (
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-slate-800"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                        style={{ backgroundColor: `${event.color}20`, color: event.color }}
                      >
                        {event.category?.emoji || '📅'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          {format(parseISO(event.start_time), 'EEE, MMM d')}
                          {!event.all_day && ` at ${format(parseISO(event.start_time), 'h:mm a')}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-3">
                  {t('memberProfile.noUpcomingEvents')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
