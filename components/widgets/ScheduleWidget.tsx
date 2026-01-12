'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, parseISO, isToday, isTomorrow, isThisWeek, startOfWeek, endOfWeek, addWeeks, differenceInHours, isAfter, startOfDay, addDays, isWithinInterval } from 'date-fns'
import { Calendar, MapPin, ChevronRight, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useContacts } from '@/lib/contacts-context'
import { CalendarEvent } from '@/lib/database.types'
import { useWidgetSize } from '@/lib/useWidgetSize'
import EventDetailModal from '@/components/EventDetailModal'

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
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventMembers, setEventMembers] = useState<Record<string, string[]>>({})
  const [eventContacts, setEventContacts] = useState<Record<string, string[]>>({})
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [ref, { size, isWide, isTall }] = useWidgetSize()

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

      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', twoWeeksEnd.toISOString())
        .order('start_time', { ascending: true })

      if (data) {
        setEvents(data)

        // Fetch event_members
        if (data.length > 0) {
          const eventIds = data.map(e => e.id)
          const { data: membersData } = await supabase
            .from('event_members')
            .select('event_id, member_id')
            .in('event_id', eventIds)

          if (membersData) {
            const membersMap: Record<string, string[]> = {}
            membersData.forEach(em => {
              if (!membersMap[em.event_id]) membersMap[em.event_id] = []
              membersMap[em.event_id].push(em.member_id)
            })
            setEventMembers(membersMap)
          }

          // Fetch event_contacts
          const { data: contactsData } = await supabase
            .from('event_contacts')
            .select('event_id, contact_id')
            .in('event_id', eventIds)

          if (contactsData) {
            const contactsMap: Record<string, string[]> = {}
            contactsData.forEach(ec => {
              if (!contactsMap[ec.event_id]) contactsMap[ec.event_id] = []
              contactsMap[ec.event_id].push(ec.contact_id)
            })
            setEventContacts(contactsMap)
          }
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

  // Group events by day with smart labels
  const groupedEvents = useMemo((): GroupedEvents[] => {
    const groups: Map<string, GroupedEvents> = new Map()

    // Filter to upcoming events only (not past)
    const upcomingEvents = events.filter(event => {
      const eventTime = parseISO(event.start_time)
      return isAfter(eventTime, now) ||
             (isToday(eventTime) && eventTime.getHours() >= now.getHours())
    })

    upcomingEvents.forEach(event => {
      const eventDate = parseISO(event.start_time)
      const dateKey = format(eventDate, 'yyyy-MM-dd')

      if (!groups.has(dateKey)) {
        let label: string
        let shortLabel: string

        if (isToday(eventDate)) {
          label = 'Today'
          shortLabel = 'Today'
        } else if (isTomorrow(eventDate)) {
          label = 'Tomorrow'
          shortLabel = 'Tomorrow'
        } else if (isThisWeek(eventDate, { weekStartsOn: 1 })) {
          label = format(eventDate, 'EEEE') // "Wednesday"
          shortLabel = format(eventDate, 'EEE') // "Wed"
        } else if (isNextWeek(eventDate, { weekStartsOn: 1 })) {
          label = `Next ${format(eventDate, 'EEEE')}`
          shortLabel = `Next ${format(eventDate, 'EEE')}`
        } else {
          label = format(eventDate, 'EEE, MMM d')
          shortLabel = format(eventDate, 'MMM d')
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
  }, [events, now])

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

  // Total upcoming events count
  const totalUpcoming = groupedEvents.reduce((sum, g) => sum + g.events.length, 0)

  // Get next urgent event (within 24 hours)
  const nextUrgent = groupedEvents.find(g => g.isUrgent)?.events[0]

  // Slice groups for display
  const displayGroups = groupedEvents.slice(0, displayConfig.maxDays)

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
            {size === 'small' ? 'Up Next' : 'Week Ahead'}
          </h3>
          {totalUpcoming > 0 && (
            <span className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full ml-auto">
              {totalUpcoming} event{totalUpcoming !== 1 ? 's' : ''}
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
              <span className="font-medium">Soon:</span> {nextUrgent.title} at {format(parseISO(nextUrgent.start_time), 'HH:mm')}
            </p>
          </div>
        )}

        {/* Events List */}
        {displayGroups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">No upcoming events</p>
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
                      {format(group.date, 'MMM d')}
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
                      if (c) peopleNames.push(c.name)
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
                      +{group.events.length - displayConfig.maxEventsPerDay} more
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Show if there are more days */}
            {groupedEvents.length > displayConfig.maxDays && (
              <div className="flex items-center justify-center gap-1 text-xs text-teal-600 dark:text-teal-400 pt-1">
                <span>+{groupedEvents.length - displayConfig.maxDays} more days</span>
                <ChevronRight className="w-3 h-3" />
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
