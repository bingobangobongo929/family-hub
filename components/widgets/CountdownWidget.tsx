'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { differenceInDays, parseISO, format, addYears, isBefore, startOfDay } from 'date-fns'
import { useWidgetSize } from '@/lib/useWidgetSize'
import { useContacts } from '@/lib/contacts-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { CountdownEvent as DbCountdownEvent, DEFAULT_DANISH_EVENTS } from '@/lib/database.types'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'

interface DisplayCountdownEvent {
  id: string
  title: string
  date: string
  emoji: string
  type: 'birthday' | 'family_birthday' | 'holiday' | 'event' | 'trip' | 'school' | 'other'
  color?: string
  linkedRelationships?: string[]
}

function getNextOccurrence(month: number, day: number): string {
  const now = new Date()
  let year = now.getFullYear()
  const date = new Date(year, month - 1, day)
  if (date < startOfDay(now)) {
    year++
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getNextBirthdayDate(dateOfBirth: string): string {
  const dob = parseISO(dateOfBirth)
  const today = startOfDay(new Date())
  let nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
  if (isBefore(nextBirthday, today)) {
    nextBirthday = addYears(nextBirthday, 1)
  }
  return format(nextBirthday, 'yyyy-MM-dd')
}

export default function CountdownWidget() {
  const [now, setNow] = useState(new Date())
  const [ref, { size, isWide }] = useWidgetSize()
  const [customEvents, setCustomEvents] = useState<DbCountdownEvent[]>([])
  const { user } = useAuth()
  const { contacts, getContactLinks } = useContacts()
  const { members, getMember } = useFamily()
  const { countdownRelationshipGroups } = useSettings()
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)

  // Fetch custom countdown events from database
  const fetchCustomEvents = useCallback(async () => {
    if (!user) {
      // Demo mode - use defaults
      const demoEvents = DEFAULT_DANISH_EVENTS.map((e, i) => ({
        ...e,
        id: `demo-${i}`,
        user_id: 'demo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })) as DbCountdownEvent[]
      setCustomEvents(demoEvents)
      return
    }

    try {
      const { data, error } = await supabase
        .from('countdown_events')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setCustomEvents(data || [])
    } catch (error) {
      console.error('Error fetching countdown events:', error)
      // Fall back to defaults
      const demoEvents = DEFAULT_DANISH_EVENTS.map((e, i) => ({
        ...e,
        id: `demo-${i}`,
        user_id: 'demo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })) as DbCountdownEvent[]
      setCustomEvents(demoEvents)
    }
  }, [user])

  useEffect(() => {
    fetchCustomEvents()
  }, [fetchCustomEvents])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Convert custom events to display format
  const customCountdowns: DisplayCountdownEvent[] = useMemo(() => {
    return customEvents.map(event => {
      let eventDate = event.date

      // For recurring events, calculate next occurrence
      if (event.is_recurring) {
        const originalDate = parseISO(event.date)
        eventDate = getNextOccurrence(originalDate.getMonth() + 1, originalDate.getDate())
      }

      return {
        id: `custom-${event.id}`,
        title: event.title,
        date: eventDate,
        emoji: event.emoji,
        type: event.event_type as DisplayCountdownEvent['type'],
      }
    })
  }, [customEvents])

  // Family member birthdays
  const familyBirthdays: DisplayCountdownEvent[] = useMemo(() => {
    return members
      .filter(member => member.date_of_birth)
      .map(member => ({
        id: `family-${member.id}`,
        title: t('countdown.birthday', { name: member.name }),
        date: getNextBirthdayDate(member.date_of_birth!),
        emoji: '🎂',
        type: 'family_birthday' as const,
        color: member.color,
      }))
  }, [members, t])

  // Contact birthdays - only those with show_birthday_countdown enabled
  const contactBirthdays: DisplayCountdownEvent[] = useMemo(() => {
    const filteredContacts = contacts.filter(contact =>
      contact.date_of_birth &&
      contact.show_birthday_countdown &&
      (countdownRelationshipGroups as string[])?.includes(contact.relationship_group)
    )

    return filteredContacts.map(contact => {
      // Get linked relationships for this contact
      const links = getContactLinks(contact.id)
      const linkedRelationships = links
        .map(link => {
          const member = getMember(link.member_id)
          return member ? `${member.name}'s ${link.relationship_type}` : null
        })
        .filter(Boolean) as string[]

      return {
        id: `contact-${contact.id}`,
        title: t('countdown.birthday', { name: contact.display_name || contact.name }),
        date: getNextBirthdayDate(contact.date_of_birth!),
        emoji: '🎂',
        type: 'birthday' as const,
        color: contact.color,
        linkedRelationships: linkedRelationships.length > 0 ? linkedRelationships : undefined,
      }
    })
  }, [contacts, countdownRelationshipGroups, getContactLinks, getMember, t])

  // Combine all events
  const allCountdowns = useMemo(() => {
    const combined = [...familyBirthdays, ...contactBirthdays, ...customCountdowns]
    return combined
      .map(c => ({ ...c, daysLeft: differenceInDays(parseISO(c.date), startOfDay(now)) }))
      .filter(c => c.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [familyBirthdays, contactBirthdays, customCountdowns, now])

  const nextEvent = allCountdowns[0]

  // Number of secondary events based on size
  const secondaryCount = {
    small: 0,  // No secondary events for small (2x2)
    medium: 1,
    large: 3,
    xlarge: 4,
  }[size]

  const otherEvents = allCountdowns.slice(1, 1 + secondaryCount)

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'birthday': return 'from-pink-500 to-rose-500'
      case 'family_birthday': return 'from-pink-600 to-rose-600'
      case 'holiday': return 'from-amber-500 to-orange-500'
      case 'trip': return 'from-teal-500 to-cyan-500'
      case 'school': return 'from-blue-500 to-indigo-500'
      default: return 'from-purple-500 to-indigo-500'
    }
  }

  // Size-based styling
  const emojiSize = {
    small: 'text-3xl',
    medium: 'text-4xl',
    large: 'text-4xl',
    xlarge: 'text-5xl',
  }[size]

  const countdownSize = {
    small: 'text-4xl',
    medium: 'text-5xl',
    large: 'text-5xl',
    xlarge: 'text-6xl',
  }[size]

  const titleSize = {
    small: 'text-sm',
    medium: 'text-sm',
    large: 'text-base',
    xlarge: 'text-lg',
  }[size]

  if (!nextEvent) {
    return (
      <div ref={ref} className="h-full flex items-center justify-center p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
        <p className="text-slate-500 dark:text-slate-400">{t('countdown.noUpcoming')}</p>
      </div>
    )
  }

  // Wide layout - show multiple countdowns in grid
  if (isWide && (size === 'large' || size === 'xlarge')) {
    const displayEvents = allCountdowns.slice(0, 4)
    const useGrid = displayEvents.length === 4

    // Scale text based on size
    const gridEmoji = size === 'xlarge' ? 'text-4xl' : 'text-2xl'
    const gridName = size === 'xlarge' ? 'text-base' : 'text-sm'
    const gridDays = size === 'xlarge' ? 'text-4xl' : 'text-2xl'
    const gridDate = size === 'xlarge' ? 'text-sm' : 'text-xs'

    return (
      <div ref={ref} className={`h-full ${useGrid ? 'grid grid-cols-2 grid-rows-2' : 'flex'} gap-2 p-3 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark`}>
        {displayEvents.map((event, idx) => (
          <div
            key={event.id}
            className={`flex-1 flex flex-col items-center justify-center text-center rounded-2xl bg-gradient-to-br ${getTypeColor(event.type)} p-2 text-white shadow-lg ${!useGrid && idx === 0 ? 'scale-[1.02]' : ''}`}
          >
            <span className={gridEmoji}>{event.emoji}</span>
            <p className={`${gridName} opacity-90 mt-1 truncate w-full px-1 font-medium`}>{event.title.replace("'s Birthday", "")}</p>
            {event.linkedRelationships && event.linkedRelationships.length > 0 && (
              <p className="text-[10px] opacity-75 truncate w-full px-1">
                ({event.linkedRelationships[0]})
              </p>
            )}
            <div className={`font-bold ${gridDays}`}>
              {event.daysLeft === 0 ? t('countdown.today') : event.daysLeft === 1 ? t('countdown.oneDay') : `${event.daysLeft}${t('countdown.daysShort')}`}
            </div>
            <p className={`${gridDate} opacity-75 mt-1`}>
              {format(parseISO(event.date), 'MMM d', { locale: dateLocale })}
            </p>
          </div>
        ))}
      </div>
    )
  }

  // Compact padding for small size
  const padding = size === 'small' ? 'p-2' : 'p-4'
  const innerPadding = size === 'small' ? 'p-3' : 'p-4'

  return (
    <div ref={ref} className={`h-full flex flex-col ${padding} bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark`}>
      {/* Main countdown */}
      <div className={`flex-1 flex flex-col items-center justify-center text-center rounded-2xl bg-gradient-to-br ${getTypeColor(nextEvent.type)} ${innerPadding} text-white shadow-lg min-h-0`}>
        <span className={`${emojiSize} ${size === 'small' ? 'mb-0.5' : 'mb-1'}`}>{nextEvent.emoji}</span>
        <p className={`${titleSize} opacity-90 ${size === 'small' ? 'mb-0.5' : 'mb-1'} font-medium truncate w-full px-1`}>
          {nextEvent.title.replace("'s Birthday", "")}
        </p>
        {nextEvent.linkedRelationships && nextEvent.linkedRelationships.length > 0 && size !== 'small' && (
          <p className="text-xs opacity-75 -mt-0.5 mb-1">
            ({nextEvent.linkedRelationships.join(', ')})
          </p>
        )}
        <div className={`font-display ${countdownSize} font-bold leading-tight`}>
          {nextEvent.daysLeft === 0 ? (
            <span>{t('countdown.today')}</span>
          ) : nextEvent.daysLeft === 1 ? (
            <span>{size === 'small' ? '1' + t('countdown.daysShort') : t('countdown.oneDay')}</span>
          ) : (
            <span>{size === 'small' ? `${nextEvent.daysLeft}${t('countdown.daysShort')}` : t('countdown.days', { count: nextEvent.daysLeft })}</span>
          )}
        </div>
        <p className={`text-xs opacity-75 ${size === 'small' ? 'mt-0.5' : 'mt-1'} font-medium`}>
          {format(parseISO(nextEvent.date), size === 'small' ? 'MMM d' : 'EEEE, MMM d', { locale: dateLocale })}
        </p>
      </div>

      {/* Other upcoming */}
      {otherEvents.length > 0 && (
        <div className={`mt-3 ${size === 'large' || size === 'xlarge' ? 'grid grid-cols-2 gap-2' : 'space-y-1'}`}>
          {otherEvents.map(event => (
            <div key={event.id} className="flex items-center gap-2 text-sm bg-white/50 dark:bg-slate-700/30 px-2 py-1.5 rounded-xl">
              <span>{event.emoji}</span>
              <span className="flex-1 text-slate-700 dark:text-slate-300 truncate font-medium">{event.title}</span>
              <span className="text-teal-600 dark:text-teal-400 font-semibold">{event.daysLeft}{t('countdown.daysShort')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
