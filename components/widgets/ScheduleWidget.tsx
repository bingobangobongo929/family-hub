'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, parseISO, isToday, isTomorrow, isThisWeek, startOfWeek, endOfWeek, addWeeks, differenceInHours, isAfter, isBefore, startOfDay, addDays, isWithinInterval } from 'date-fns'
import { Calendar, MapPin, ChevronRight, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useContacts } from '@/lib/contacts-context'
import { useCategories } from '@/lib/categories-context'
import { CalendarEvent } from '@/lib/database.types'
import { useWidgetSize } from '@/lib/useWidgetSize'
import EventDetailModal from '@/components/EventDetailModal'
import { getOccurrences, isRecurrenceActive } from '@/lib/rrule'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'
import { updateEventsWidget } from '@/lib/widget-bridge'

// Helper function since date-fns doesn't export isNextWeek
function isNextWeek(date: Date, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): boolean {
  const now = new Date()
  const nextWeekStart = startOfWeek(addWeeks(now, 1), options)
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), options)
  return isWithinInterval(date, { start: nextWeekStart, end: nextWeekEnd })
}

// Demo events spread across the week
const generateDemoEvents = (): CalendarEvent[] => {
  const today = new Date()
  const events: CalendarEvent[] = []

  const templates = [
    { title: 'School drop-off', time: '08:30', color: '#8b5cf6', member: 'demo-olivia' },
    { title: 'Swimming lesson', time: '16:00', color: '#3b82f6', member: 'demo-olivia', location: 'Leisure Centre' },
    { title: 'Grocery shopping', time: '10:00', color: '#f59e0b', member: 'demo-mum', location: 'Føtex' },
    { title: 'Playdate with Emma', time: '15:00', color: '#8b5cf6', member: 'demo-olivia', location: "Emma's house" },
    { title: 'Doctor appointment', time: '11:00', color: '#ef4444', member: 'demo-ellie', location: 'Health Centre' },
    { title: 'Piano practice', time: '17:00', color: '#8b5cf6', member: 'demo-olivia' },
    { title: 'Family dinner', time: '18:00', color: '#22c55e', member: null },
    { title: 'Dentist checkup', time: '09:30', color: '#f59e0b', member: 'demo-dad', location: 'Dental Clinic' },
  ]

  // Spread events across this week and next
  for (let i = 0; i < 10; i++) {
    const dayOffset = i % 7
    const weekOffset = i >= 7 ? 7 : 0
    const template = templates[i % templates.length]
    const eventDate = addDays(startOfDay(today), dayOffset + weekOffset)

    events.push({
      id: `demo-${i}`,
      user_id: 'demo',
      title: template.title,
      start_time: format(eventDate, 'yyyy-MM-dd') + `T${template.time}:00`,
      end_time: null,
      all_day: false,
      color: template.color,
      member_id: template.member,
      description: null,
      location: template.location || null,
      source: 'manual',
      source_id: null,
      recurrence_rule: null,
      category_id: null,
      created_at: '',
      updated_at: '',
    })
  }

  return events
}

interface GroupedEvents {
  label: string
  shortLabel: string
  date: Date
  events: CalendarEvent[]
  isUrgent: boolean
}

export default function ScheduleWidget() {
  const { user } = useAuth()
  const { getMember } = useFamily()
  const { contacts } = useContacts()
  const { getCategory } = useCategories()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventMembers, setEventMembers] = useState<Record<string, string[]>>({})
  const [eventContacts, setEventContacts] = useState<Record<string, string[]>>({})
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showBackgroundSection, setShowBackgroundSection] = useState(true)
  const [ref, { size, isWide, isTall }] = useWidgetSize()
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)

  const fetchWeekEvents = useCallback(async () => {
    if (!user) {
      setEvents(generateDemoEvents())
      setEventMembers({
        'demo-0': ['demo-olivia'],
        'demo-1': ['demo-olivia'],
        'demo-2': ['demo-mum'],
        'demo-3': ['demo-olivia'],
        'demo-4': ['demo-ellie'],
        'demo-5': ['demo-olivia'],
        'demo-7': ['demo-dad'],
      })
      return
    }

    try {
      const now = new Date()
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
      const twoWeeksEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 })

      // Fetch regular events within date range
      const { data: regularEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .is('recurrence_rule', null)
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', twoWeeksEnd.toISOString())
        .order('start_time', { ascending: true })

      // Fetch recurring events (regardless of start_time)
      const { data: recurringEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .not('recurrence_rule', 'is', null)

      // Expand recurring events into occurrences within the visible range
      const expandedEvents: CalendarEvent[] = []

      if (recurringEvents) {
        for (const event of recurringEvents) {
          if (!event.recurrence_rule) continue

          // Check if recurrence is still active
          const eventStart = parseISO(event.start_time)
          if (!isRecurrenceActive(event.recurrence_rule, eventStart)) continue

          // Get occurrences within the visible range
          const occurrences = getOccurrences(
            event.recurrence_rule,
            eventStart,
            20, // Get up to 20 occurrences
            weekStart // Only after week start
          )

          // Filter to only those within our date range and create virtual events
          for (const occurrence of occurrences) {
            if (isBefore(occurrence, weekStart) || isAfter(occurrence, twoWeeksEnd)) continue

            // Preserve original time from the event
            const originalTime = eventStart
            occurrence.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0)

            // Create a virtual event for this occurrence
            expandedEvents.push({
              ...event,
              id: `${event.id}_${occurrence.getTime()}`, // Unique ID for this occurrence
              start_time: occurrence.toISOString(),
              // Keep end_time relative if it exists
              end_time: event.end_time ? (() => {
                const originalEnd = parseISO(event.end_time)
                const duration = originalEnd.getTime() - eventStart.getTime()
                return new Date(occurrence.getTime() + duration).toISOString()
              })() : null,
            })
          }
        }
      }

      // Combine and sort all events
      const allEvents = [...(regularEvents || []), ...expandedEvents]
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

      setEvents(allEvents)

      // Fetch event_members and event_contacts for all real event IDs
      // (Get base IDs from both regular and recurring events)
      const realEventIds = [
        ...(regularEvents || []).map(e => e.id),
        ...(recurringEvents || []).map(e => e.id)
      ]

      if (realEventIds.length > 0) {
        const { data: membersData } = await supabase
          .from('event_members')
          .select('event_id, member_id')
          .in('event_id', realEventIds)

        if (membersData) {
          const membersMap: Record<string, string[]> = {}
          membersData.forEach(em => {
            if (!membersMap[em.event_id]) membersMap[em.event_id] = []
            membersMap[em.event_id].push(em.member_id)
          })
          // Also map to virtual occurrence IDs
          expandedEvents.forEach(e => {
            const baseId = e.id.split('_')[0]
            if (membersMap[baseId]) {
              membersMap[e.id] = membersMap[baseId]
            }
          })
          setEventMembers(membersMap)
        }

        // Fetch event_contacts
        const { data: contactsData } = await supabase
          .from('event_contacts')
          .select('event_id, contact_id')
          .in('event_id', realEventIds)

        if (contactsData) {
          const contactsMap: Record<string, string[]> = {}
          contactsData.forEach(ec => {
            if (!contactsMap[ec.event_id]) contactsMap[ec.event_id] = []
            contactsMap[ec.event_id].push(ec.contact_id)
          })
          // Also map to virtual occurrence IDs
          expandedEvents.forEach(e => {
            const baseId = e.id.split('_')[0]
            if (contactsMap[baseId]) {
              contactsMap[e.id] = contactsMap[baseId]
            }
          })
          setEventContacts(contactsMap)
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      setEvents(generateDemoEvents())
    }
  }, [user])

  useEffect(() => {
    fetchWeekEvents()
  }, [fetchWeekEvents])

  // Update iOS widget with event data
  useEffect(() => {
    if (events.length > 0) {
      updateEventsWidget(
        events.map(event => ({
          id: event.id,
          title: event.title,
          start: new Date(event.start_time),
          end: event.end_time ? new Date(event.end_time) : undefined,
          allDay: event.all_day || false,
          color: event.color || undefined,
        }))
      )
    }
  }, [events])

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) {
      setEvents(prev => prev.filter(e => e.id !== eventId))
      setShowEventModal(false)
      return
    }

    try {
      await supabase.from('calendar_events').delete().eq('id', eventId)
      await fetchWeekEvents()
      setShowEventModal(false)
    } catch (error) {
      console.error('Error deleting event:', error)
    }
  }

  const handleUpdateEvent = async (
    eventId: string,
    updates: Partial<CalendarEvent>,
    memberIds?: string[],
    contactIds?: string[]
  ) => {
    if (!user) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e))
      if (memberIds) setEventMembers(prev => ({ ...prev, [eventId]: memberIds }))
      if (contactIds) setEventContacts(prev => ({ ...prev, [eventId]: contactIds }))
      setShowEventModal(false)
      return
    }

    try {
      await supabase.from('calendar_events').update(updates).eq('id', eventId)

      // Update event_members if provided
      if (memberIds !== undefined) {
        await supabase.from('event_members').delete().eq('event_id', eventId)
        if (memberIds.length > 0) {
          await supabase.from('event_members').insert(
            memberIds.map(memberId => ({ event_id: eventId, member_id: memberId }))
          )
        }
      }

      // Update event_contacts if provided
      if (contactIds !== undefined) {
        await supabase.from('event_contacts').delete().eq('event_id', eventId)
        if (contactIds.length > 0) {
          await supabase.from('event_contacts').insert(
            contactIds.map(contactId => ({ event_id: eventId, contact_id: contactId }))
          )
        }
      }

      await fetchWeekEvents()
      setShowEventModal(false)
    } catch (error) {
      console.error('Error updating event:', error)
    }
  }

  const now = new Date()

  // Helper to check if an event is from a background category
  const isBackgroundEvent = useCallback((event: CalendarEvent): boolean => {
    if (!event.category_id) return false
    const category = getCategory(event.category_id)
    return category?.is_background ?? false
  }, [getCategory])

  // Separate events into active and background
  const { activeEvents, backgroundEvents } = useMemo(() => {
    const upcoming = events.filter(event => {
      const eventTime = parseISO(event.start_time)
      return isAfter(eventTime, now) ||
             (isToday(eventTime) && eventTime.getHours() >= now.getHours())
    })

    const active: CalendarEvent[] = []
    const background: CalendarEvent[] = []

    upcoming.forEach(event => {
      if (isBackgroundEvent(event)) {
        background.push(event)
      } else {
        active.push(event)
      }
    })

    return { activeEvents: active, backgroundEvents: background }
  }, [events, now, isBackgroundEvent])

  // Group active events by day with smart labels
  const groupedEvents = useMemo((): GroupedEvents[] => {
    const groups: Map<string, GroupedEvents> = new Map()

    activeEvents.forEach(event => {
      const eventDate = parseISO(event.start_time)
      const dateKey = format(eventDate, 'yyyy-MM-dd')

      if (!groups.has(dateKey)) {
        let label: string
        let shortLabel: string

        if (isToday(eventDate)) {
          label = t('common.today')
          shortLabel = t('common.today')
        } else if (isTomorrow(eventDate)) {
          label = t('common.tomorrow')
          shortLabel = t('common.tomorrow')
        } else if (isThisWeek(eventDate, { weekStartsOn: 1 })) {
          label = format(eventDate, 'EEEE', { locale: dateLocale })
          shortLabel = format(eventDate, 'EEE', { locale: dateLocale })
        } else if (isNextWeek(eventDate, { weekStartsOn: 1 })) {
          label = `${t('schedule.next')} ${format(eventDate, 'EEEE', { locale: dateLocale })}`
          shortLabel = `${t('schedule.next')} ${format(eventDate, 'EEE', { locale: dateLocale })}`
        } else {
          label = format(eventDate, 'EEE, MMM d', { locale: dateLocale })
          shortLabel = format(eventDate, 'MMM d', { locale: dateLocale })
        }

        // Events within 24 hours are urgent
        const hoursUntil = differenceInHours(eventDate, now)
        const isUrgent = hoursUntil >= 0 && hoursUntil <= 24

        groups.set(dateKey, {
          label,
          shortLabel,
          date: eventDate,
          events: [],
          isUrgent,
        })
      }

      groups.get(dateKey)!.events.push(event)
    })

    return Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [activeEvents, now, t, dateLocale])

  // Group background events by unique title (dedupe recurring instances)
  const uniqueBackgroundEvents = useMemo(() => {
    const seen = new Map<string, { event: CalendarEvent; endDate: Date }>()

    backgroundEvents.forEach(event => {
      // Use base event ID for recurring events
      const baseId = event.id.includes('_') ? event.id.split('_')[0] : event.id
      const key = `${baseId}-${event.title}`

      const eventDate = parseISO(event.start_time)
      const existing = seen.get(key)

      if (!existing) {
        seen.set(key, { event, endDate: eventDate })
      } else if (isAfter(eventDate, existing.endDate)) {
        // Update end date to the latest occurrence
        seen.set(key, { event: existing.event, endDate: eventDate })
      }
    })

    return Array.from(seen.values())
  }, [backgroundEvents])

  // Calculate display limits based on size
  const displayConfig = useMemo(() => {
    switch (size) {
      case 'small':
        return { maxDays: 2, maxEventsPerDay: 2, showLocation: false, showPeople: false, compact: true }
      case 'medium':
        return { maxDays: 3, maxEventsPerDay: 3, showLocation: false, showPeople: true, compact: false }
      case 'large':
        return { maxDays: 5, maxEventsPerDay: 4, showLocation: true, showPeople: true, compact: false }
      case 'xlarge':
        return { maxDays: 7, maxEventsPerDay: 5, showLocation: true, showPeople: true, compact: false }
      default:
        return { maxDays: 3, maxEventsPerDay: 3, showLocation: false, showPeople: true, compact: false }
    }
  }, [size])

  // Helper to get contact by id
  const getContact = (id: string) => contacts.find(c => c.id === id)

  // Total upcoming active events count
  const totalUpcoming = groupedEvents.reduce((sum, g) => sum + g.events.length, 0)

  // Get next urgent event (within 24 hours) - only from active events
  const nextUrgent = groupedEvents.find(g => g.isUrgent)?.events[0]

  // Slice groups for display
  const displayGroups = groupedEvents.slice(0, displayConfig.maxDays)

  // Format end date for background events
  const formatEndDate = (endDate: Date): string => {
    if (isToday(endDate)) return t('common.today')
    if (isTomorrow(endDate)) return t('common.tomorrow')
    return format(endDate, 'EEE', { locale: dateLocale })
  }

  return (
    <>
      <div
        ref={ref}
        className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-teal-500" />
          <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">
            {size === 'small' ? t('schedule.upNext') : t('schedule.weekAhead')}
          </h3>
          {totalUpcoming > 0 && (
            <span className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full ml-auto">
              {totalUpcoming === 1 ? t('schedule.oneEvent') : t('schedule.events', { count: totalUpcoming })}
            </span>
          )}
        </div>

        {/* Urgent Alert (if something is coming up very soon) */}
        {nextUrgent && size !== 'small' && (
          <div
            className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            onClick={() => handleEventClick(nextUrgent)}
          >
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300 truncate">
              <span className="font-medium">{t('schedule.soon')}</span> {nextUrgent.title} {t('schedule.at')} {format(parseISO(nextUrgent.start_time), 'HH:mm')}
            </p>
          </div>
        )}

        {/* Events List */}
        {displayGroups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('schedule.noUpcoming')}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden space-y-3">
            {displayGroups.map((group) => (
              <div key={group.label}>
                {/* Day Header */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-semibold ${
                    group.isUrgent
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {displayConfig.compact ? group.shortLabel : group.label}
                  </span>
                  {!displayConfig.compact && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {format(group.date, 'MMM d', { locale: dateLocale })}
                    </span>
                  )}
                  <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
                </div>

                {/* Events for this day */}
                <div className="space-y-1">
                  {group.events.slice(0, displayConfig.maxEventsPerDay).map(event => {
                    const memberIds = eventMembers[event.id] || []
                    const contactIds = eventContacts[event.id] || []
                    const firstMember = memberIds.length > 0 ? getMember(memberIds[0]) : null
                    const time = format(parseISO(event.start_time), 'HH:mm')

                    // Build people names list (members + contacts)
                    const peopleNames: string[] = []
                    memberIds.forEach(id => {
                      const m = getMember(id)
                      if (m) peopleNames.push(m.name)
                    })
                    contactIds.forEach(id => {
                      const c = getContact(id)
                      if (c) peopleNames.push(c.display_name || c.name)
                    })

                    return (
                      <div
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className={`flex items-center gap-2 ${displayConfig.compact ? 'py-1 px-2' : 'py-1.5 px-2.5'} rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer`}
                      >
                        <div
                          className="w-1 h-6 rounded-full flex-shrink-0"
                          style={{ backgroundColor: event.color || firstMember?.color || '#14b8a6' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${displayConfig.compact ? 'text-xs' : 'text-sm'} text-slate-800 dark:text-slate-100 truncate`}>
                            {event.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="font-medium">{time}</span>
                            {displayConfig.showPeople && peopleNames.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="truncate">{peopleNames.join(', ')}</span>
                              </>
                            )}
                            {displayConfig.showLocation && event.location && (
                              <>
                                <span>•</span>
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="truncate">{event.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {group.events.length > displayConfig.maxEventsPerDay && (
                    <p className="text-[10px] text-teal-600 dark:text-teal-400 pl-3 font-medium">
                      {t('common.more', { count: group.events.length - displayConfig.maxEventsPerDay })}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Show if there are more days */}
            {groupedEvents.length > displayConfig.maxDays && (
              <div className="flex items-center justify-center gap-1 text-xs text-teal-600 dark:text-teal-400 pt-1">
                <span>{t('schedule.moreDays', { count: groupedEvents.length - displayConfig.maxDays })}</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            )}

            {/* Background/Contextual Events Section */}
            {uniqueBackgroundEvents.length > 0 && size !== 'small' && (
              <div className="pt-2 mt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setShowBackgroundSection(!showBackgroundSection)}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400 transition-colors w-full"
                >
                  <span>{t('schedule.thisWeek')}</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${showBackgroundSection ? 'rotate-90' : ''}`} />
                </button>

                {showBackgroundSection && (
                  <div className="mt-1.5 space-y-1">
                    {uniqueBackgroundEvents.slice(0, 3).map(({ event, endDate }) => {
                      const category = event.category_id ? getCategory(event.category_id) : null
                      const memberIds = eventMembers[event.id] || []
                      const firstMember = memberIds.length > 0 ? getMember(memberIds[0]) : null

                      return (
                        <div
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className="flex items-center gap-2 py-1 px-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                        >
                          {category && (
                            <span className="text-xs flex-shrink-0">{category.emoji}</span>
                          )}
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1">
                            {event.title}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                            →{formatEndDate(endDate)}
                          </span>
                        </div>
                      )
                    })}
                    {uniqueBackgroundEvents.length > 3 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 pl-2">
                        +{uniqueBackgroundEvents.length - 3} {t('common.more', { count: uniqueBackgroundEvents.length - 3 })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        eventMembers={selectedEvent ? eventMembers[selectedEvent.id] || [] : []}
        eventContacts={selectedEvent ? eventContacts[selectedEvent.id] || [] : []}
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        onDelete={handleDeleteEvent}
        onUpdate={handleUpdateEvent}
      />
    </>
  )
}
