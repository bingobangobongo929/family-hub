'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, differenceInDays, differenceInYears, addYears, isBefore, startOfDay } from 'date-fns'
import { X, Cake, Calendar, Star, Trophy, Clock } from 'lucide-react'
import { FamilyMember, CalendarEvent } from '@/lib/database.types'
import { AvatarDisplay } from './PhotoUpload'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/lib/settings-context'

interface MemberProfileModalProps {
  member: FamilyMember | null
  isOpen: boolean
  onClose: () => void
}

export default function MemberProfileModal({ member, isOpen, onClose }: MemberProfileModalProps) {
  const { rewardsEnabled } = useSettings()
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
      if (member.points >= 100) return { emoji: '🌟', text: 'Super Star!' }
      if (member.points >= 50) return { emoji: '⭐', text: 'Rising Star!' }
      if (member.points >= 25) return { emoji: '✨', text: 'Star in Training' }
      return { emoji: '🚀', text: 'Just Getting Started!' }
    }
    if (member.role === 'pet') {
      return { emoji: '🐾', text: 'Best Friend' }
    }
    return { emoji: '🏠', text: 'Family Captain' }
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

      {/* Modal - 2:3 aspect ratio, sized for large touchscreen */}
      <div
        className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        style={{
          width: 'min(420px, 90vw)',
          height: 'min(630px, 85vh)',
          aspectRatio: '2/3',
          background: `linear-gradient(180deg, ${member.color}20 0%, transparent 50%), ${typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff'}`,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-3 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header with avatar */}
        <div className="pt-10 pb-6 px-8 flex flex-col items-center">
          <div
            className="w-36 h-36 rounded-full ring-4 ring-white dark:ring-slate-700 shadow-xl overflow-hidden flex items-center justify-center text-6xl"
            style={{ backgroundColor: member.photo_url ? 'transparent' : member.color }}
          >
            {member.photo_url ? (
              <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
            ) : member.avatar ? (
              <span>{member.avatar}</span>
            ) : (
              <span className="text-white font-bold text-5xl">{member.name.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <h2 className="mt-5 text-3xl font-bold text-slate-800 dark:text-slate-100">
            {member.name}
          </h2>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl">{getRoleEmoji()}</span>
            <span className="text-lg text-slate-500 dark:text-slate-400 capitalize">{member.role}</span>
          </div>

          {/* Fun badge */}
          <div
            className="mt-4 px-5 py-2 rounded-full text-base font-medium"
            style={{
              backgroundColor: `${member.color}20`,
              color: member.color,
            }}
          >
            {funFact.emoji} {funFact.text}
          </div>
        </div>

        {/* Content - scrollable area */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-5">
          {/* Birthday Card */}
          {birthdayInfo && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-100 dark:border-pink-900/30">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center">
                  <Cake className="w-7 h-7 text-pink-500" />
                </div>
                <div className="flex-1">
                  <p className="text-base text-pink-600 dark:text-pink-400 font-medium">
                    {birthdayInfo.dateFormatted}
                  </p>
                  <p className="text-sm text-pink-500/70 dark:text-pink-400/70">
                    {birthdayInfo.daysUntil === 0 ? (
                      <span className="font-bold">Today! 🎉</span>
                    ) : birthdayInfo.daysUntil === 1 ? (
                      <span>Tomorrow! Turning {birthdayInfo.turningAge}</span>
                    ) : (
                      <span>{birthdayInfo.daysUntil} days until turning {birthdayInfo.turningAge}</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-pink-600 dark:text-pink-400">{birthdayInfo.age}</p>
                  <p className="text-sm text-pink-500/70 dark:text-pink-400/70">years old</p>
                </div>
              </div>
            </div>
          )}

          {/* Points Card - Only for children with rewards enabled */}
          {member.role === 'child' && rewardsEnabled && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Star className="w-7 h-7 text-amber-500 fill-current" />
                </div>
                <div className="flex-1">
                  <p className="text-base text-amber-600 dark:text-amber-400 font-medium">
                    Star Points
                  </p>
                  <p className="text-sm text-amber-500/70 dark:text-amber-400/70">
                    Earned from chores
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{member.points}</p>
                  <p className="text-sm text-amber-500/70 dark:text-amber-400/70">stars</p>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-teal-500" />
              <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                Coming Up
              </p>
            </div>

            {loading ? (
              <div className="py-6 text-center">
                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-slate-800"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${event.color}20`, color: event.color }}
                    >
                      {event.category?.emoji || '📅'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-slate-700 dark:text-slate-200 truncate">
                        {event.title}
                      </p>
                      <p className="text-sm text-slate-400">
                        {format(parseISO(event.start_time), 'EEE, MMM d')}
                        {!event.all_day && ` at ${format(parseISO(event.start_time), 'h:mm a')}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-base text-slate-400 dark:text-slate-500 text-center py-4">
                No upcoming events
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
