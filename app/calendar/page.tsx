'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO, isToday, addWeeks, subWeeks, addDays, isBefore, isAfter } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Sparkles, Repeat } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import AICalendarInput from '@/components/AICalendarInput'
import EventDetailModal from '@/components/EventDetailModal'
import CategorySelector from '@/components/CategorySelector'
import MemberMultiSelect from '@/components/MemberMultiSelect'
import { MemberDotStack } from '@/components/MemberAvatarStack'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useCategories } from '@/lib/categories-context'
import { useContacts } from '@/lib/contacts-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'
import { CalendarEvent, MEMBER_COLORS, RecurrencePattern } from '@/lib/database.types'
import RecurrenceSelector from '@/components/RecurrenceSelector'
import { patternToRRule, getOccurrences, isRecurrenceActive } from '@/lib/rrule'
import { getBinsForDate, getBinInfo } from '@/lib/bin-schedule'

type ViewMode = 'month' | 'week' | 'day' | 'agenda'

// Demo events
const DEMO_EVENTS: CalendarEvent[] = [
  { id: 'demo-1', user_id: 'demo', title: "Olivia's Playgroup", description: '', start_time: new Date().toISOString(), end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), all_day: false, color: '#8b5cf6', member_id: null, category_id: null, location: 'Community Centre', source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: 'demo-2', user_id: 'demo', title: 'Family Swim', description: '', start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), end_time: null, all_day: false, color: '#ec4899', member_id: null, category_id: null, location: 'Leisure Centre', source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: 'demo-3', user_id: 'demo', title: 'Health Visitor', description: '', start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), end_time: null, all_day: false, color: '#22c55e', member_id: null, category_id: null, location: 'Home', source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
]

export default function CalendarPage() {
  const { user } = useAuth()
  const { members, getMember } = useFamily()
  const { categories, getCategory } = useCategories()
  const { contacts } = useContacts()
  const { googleCalendarAutoPush } = useSettings()
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)

  const getContact = (id: string) => contacts.find(c => c.id === id)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventMembers, setEventMembers] = useState<Record<string, string[]>>({})
  const [eventContacts, setEventContacts] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [isMobile, setIsMobile] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [cellHeight, setCellHeight] = useState(120)

  // Detect mobile and set smart default view
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Default to agenda view on mobile for better UX
      if (mobile && viewMode === 'month') {
        setViewMode('agenda')
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, []) // Only run once on mount

  // Calculate actual number of rows for current month
  const monthRows = useMemo(() => {
    if (viewMode !== 'month') return 1
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    return Math.ceil(days.length / 7)
  }, [currentDate, viewMode])

  // Calculate cell height based on viewport - fit to screen without scrolling
  useEffect(() => {
    const updateCellHeight = () => {
      const vh = window.innerHeight
      const isMobileView = window.innerWidth < 768
      // Account for: header (~110px), day headers (~44px), mobile nav (~70px on mobile)
      const headerHeight = isMobileView ? 110 : 120
      const dayHeaderHeight = 44
      const mobileNavHeight = isMobileView ? 70 : 0
      const safeAreaBottom = isMobileView ? 20 : 0 // Extra buffer for notch phones
      const availableHeight = vh - headerHeight - dayHeaderHeight - mobileNavHeight - safeAreaBottom
      const rows = viewMode === 'week' ? 1 : viewMode === 'day' ? 1 : monthRows
      const calculatedHeight = Math.floor(availableHeight / rows)
      // On mobile, allow smaller cells to fit; on desktop keep minimum of 100
      const minHeight = isMobileView ? 60 : 100
      setCellHeight(Math.max(minHeight, Math.min(200, calculatedHeight)))
    }

    updateCellHeight()
    window.addEventListener('resize', updateCellHeight)
    return () => window.removeEventListener('resize', updateCellHeight)
  }, [viewMode, monthRows])

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    all_day: false,
    color: '#3b82f6',
    member_ids: [] as string[],
    category_id: null as string | null,
    location: '',
    is_recurring: false,
    recurrence_pattern: null as RecurrencePattern | null,
  })

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents(DEMO_EVENTS)
      setEventMembers({
        'demo-1': ['demo-olivia'],
        'demo-2': ['demo-dad', 'demo-mum', 'demo-olivia', 'demo-ellie'],
        'demo-3': ['demo-ellie'],
      })
      setLoading(false)
      return
    }

    try {
      const start = startOfMonth(subMonths(currentDate, 1))
      const end = endOfMonth(addMonths(currentDate, 1))

      // Fetch regular events within date range
      const { data: regularEvents, error } = await supabase
        .from('calendar_events')
        .select('*')
        .is('recurrence_rule', null)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true })

      if (error) throw error

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
            50, // Get up to 50 occurrences for calendar view
            start
          )

          // Filter to only those within our date range and create virtual events
          for (const occurrence of occurrences) {
            if (isBefore(occurrence, start) || isAfter(occurrence, end)) continue

            // Preserve original time from the event
            const originalTime = eventStart
            occurrence.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0)

            // Create a virtual event for this occurrence
            expandedEvents.push({
              ...event,
              id: `${event.id}_${occurrence.getTime()}`, // Unique ID for this occurrence
              start_time: occurrence.toISOString(),
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
    }
    setLoading(false)
  }, [user, currentDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handlePrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, -1))
    } else if (viewMode === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1))
    } else {
      setCurrentDate(prev => subMonths(prev, 1))
    }
  }

  const handleNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1))
    } else {
      setCurrentDate(prev => addMonths(prev, 1))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleDayClick = (date: Date) => {
    setFormData({
      title: '',
      description: '',
      start_date: format(date, 'yyyy-MM-dd'),
      end_date: format(date, 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '10:00',
      all_day: false,
      color: '#3b82f6',
      member_ids: [],
      category_id: null,
      location: '',
      is_recurring: false,
      recurrence_pattern: null,
    })
    setShowAddModal(true)
  }

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handleAddEvent = () => {
    setFormData({
      title: '',
      description: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_date: format(new Date(), 'yyyy-MM-dd'),
      end_time: '10:00',
      all_day: false,
      color: '#3b82f6',
      member_ids: [],
      category_id: null,
      location: '',
      is_recurring: false,
      recurrence_pattern: null,
    })
    setShowAddModal(true)
  }

  const handleSaveEvent = async () => {
    if (!formData.title.trim()) return

    const startDateTime = formData.all_day
      ? `${formData.start_date}T00:00:00`
      : `${formData.start_date}T${formData.start_time}:00`

    const endDateTime = formData.all_day
      ? null
      : formData.end_date && formData.end_time
        ? `${formData.end_date}T${formData.end_time}:00`
        : null

    const recurrenceRule = formData.is_recurring && formData.recurrence_pattern
      ? patternToRRule(formData.recurrence_pattern, new Date(startDateTime))
      : null

    const eventData = {
      title: formData.title,
      description: formData.description || null,
      start_time: new Date(startDateTime).toISOString(),
      end_time: endDateTime ? new Date(endDateTime).toISOString() : null,
      all_day: formData.all_day,
      color: formData.color,
      member_id: formData.member_ids.length === 1 ? formData.member_ids[0] : null,
      category_id: formData.category_id || null,
      location: formData.location || null,
      recurrence_rule: recurrenceRule,
      source: 'manual' as const,
      user_id: user?.id || 'demo',
    }

    if (!user) {
      const newEventId = `demo-${Date.now()}`
      const newEvent: CalendarEvent = {
        ...eventData,
        id: newEventId,
        source_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setEvents(prev => [...prev, newEvent])
      if (formData.member_ids.length > 0) {
        setEventMembers(prev => ({ ...prev, [newEventId]: formData.member_ids }))
      }
      setShowAddModal(false)
      return
    }

    try {
      const { data: insertedEvent, error } = await supabase
        .from('calendar_events')
        .insert(eventData)
        .select()
        .single()

      if (error) throw error

      if (formData.member_ids.length > 0 && insertedEvent) {
        await supabase.from('event_members').insert(
          formData.member_ids.map(memberId => ({
            event_id: insertedEvent.id,
            member_id: memberId,
          }))
        )
      }

      if (googleCalendarAutoPush && insertedEvent) {
        try {
          await fetch('/api/google-calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, event: insertedEvent }),
          })
        } catch (gcalError) {
          console.error('Failed to sync to Google Calendar:', gcalError)
        }
      }

      await fetchEvents()
      setShowAddModal(false)
    } catch (error) {
      console.error('Error saving event:', error)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) {
      setEvents(prev => prev.filter(e => e.id !== eventId))
      setShowEventModal(false)
      return
    }

    try {
      await supabase.from('calendar_events').delete().eq('id', eventId)
      await fetchEvents()
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

      if (memberIds !== undefined) {
        await supabase.from('event_members').delete().eq('event_id', eventId)
        if (memberIds.length > 0) {
          await supabase.from('event_members').insert(
            memberIds.map(memberId => ({ event_id: eventId, member_id: memberId }))
          )
        }
      }

      if (contactIds !== undefined) {
        await supabase.from('event_contacts').delete().eq('event_id', eventId)
        if (contactIds.length > 0) {
          await supabase.from('event_contacts').insert(
            contactIds.map(contactId => ({ event_id: eventId, contact_id: contactId }))
          )
        }
      }

      await fetchEvents()
      setShowEventModal(false)
    } catch (error) {
      console.error('Error updating event:', error)
    }
  }

  const handleAIEvents = async (aiEvents: any[]) => {
    for (const event of aiEvents) {
      console.log('Creating AI event:', event.title)
      console.log('  member_ids:', event.member_ids)
      console.log('  contact_ids:', event.contact_ids)

      const startDateTime = event.all_day
        ? `${event.start_date}T00:00:00`
        : `${event.start_date}T${event.start_time || '09:00'}:00`

      const endDateTime = event.all_day || !event.end_time
        ? null
        : `${event.end_date || event.start_date}T${event.end_time}:00`

      const memberIds: string[] = event.member_ids || []
      const contactIds: string[] = event.contact_ids || []
      console.log('  resolved memberIds:', memberIds)
      console.log('  resolved contactIds:', contactIds)

      const eventData = {
        title: event.title,
        description: event.description || null,
        start_time: new Date(startDateTime).toISOString(),
        end_time: endDateTime ? new Date(endDateTime).toISOString() : null,
        all_day: event.all_day,
        color: event.color || '#3b82f6',
        member_id: memberIds.length === 1 ? memberIds[0] : null,
        category_id: event.category_id || null,
        location: event.location || null,
        recurrence_rule: event.recurrence_rrule || null,
        source: 'manual' as const,
        user_id: user?.id || 'demo',
      }

      if (!user) {
        const newEventId = `demo-${Date.now()}-${Math.random()}`
        const newEvent: CalendarEvent = {
          ...eventData,
          id: newEventId,
          source_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setEvents(prev => [...prev, newEvent])
        if (memberIds.length > 0) {
          setEventMembers(prev => ({ ...prev, [newEventId]: memberIds }))
        }
      } else {
        try {
          const { data: insertedEvent } = await supabase
            .from('calendar_events')
            .insert(eventData)
            .select()
            .single()

          if (memberIds.length > 0 && insertedEvent) {
            console.log('  Inserting event_members:', memberIds)
            const { error: memberError } = await supabase.from('event_members').insert(
              memberIds.map(memberId => ({ event_id: insertedEvent.id, member_id: memberId }))
            )
            if (memberError) {
              console.error('  Failed to insert event_members:', memberError)
            } else {
              console.log('  Successfully inserted', memberIds.length, 'members')
            }
          }

          if (contactIds.length > 0 && insertedEvent) {
            await supabase.from('event_contacts').insert(
              contactIds.map(contactId => ({ event_id: insertedEvent.id, contact_id: contactId }))
            )
          }

          if (googleCalendarAutoPush && insertedEvent) {
            try {
              await fetch('/api/google-calendar/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, event: insertedEvent }),
              })
            } catch (gcalError) {
              console.error('Failed to sync to Google Calendar:', gcalError)
            }
          }
        } catch (error) {
          console.error('Error saving AI event:', error)
        }
      }
    }

    if (user) {
      await fetchEvents()
    }
  }

  // Generate calendar days based on view mode
  const calendarDays = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate]
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({
        start: weekStart,
        end: addDays(weekStart, 6)
      })
    } else {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    }
  }, [currentDate, viewMode])

  // Generate upcoming events for agenda view (next 30 days)
  const agendaEvents = useMemo(() => {
    if (viewMode !== 'agenda') return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = addDays(today, 30)

    // Get all events within the next 30 days
    const upcoming = events
      .filter(event => {
        const eventDate = parseISO(event.start_time)
        return !isBefore(eventDate, today) && !isAfter(eventDate, endDate)
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    // Group by date
    const grouped: { date: Date; events: CalendarEvent[] }[] = []
    let currentGroup: { date: Date; events: CalendarEvent[] } | null = null

    upcoming.forEach(event => {
      const eventDate = parseISO(event.start_time)
      eventDate.setHours(0, 0, 0, 0)

      if (!currentGroup || !isSameDay(currentGroup.date, eventDate)) {
        currentGroup = { date: eventDate, events: [] }
        grouped.push(currentGroup)
      }
      currentGroup.events.push(event)
    })

    return grouped
  }, [events, viewMode])

  const getEventsForDay = (date: Date) => {
    return events.filter(event => isSameDay(parseISO(event.start_time), date))
  }

  // Check if an event is from a background category
  const isBackgroundEvent = useCallback((event: CalendarEvent): boolean => {
    if (!event.category_id) return false
    const category = getCategory(event.category_id)
    return category?.is_background ?? false
  }, [getCategory])

  // Split events for a day into background and active
  const getEventsSplit = useCallback((date: Date) => {
    const dayEvents = getEventsForDay(date)
    const background: CalendarEvent[] = []
    const active: CalendarEvent[] = []

    dayEvents.forEach(event => {
      if (isBackgroundEvent(event)) {
        background.push(event)
      } else {
        active.push(event)
      }
    })

    return { background, active }
  }, [events, isBackgroundEvent])

  // Calculate how many events can fit in a cell
  const maxEventsPerCell = useMemo(() => {
    // Compact events on mobile (24px), larger on desktop (36px)
    const eventHeight = isMobile ? 24 : 36
    const headerHeight = isMobile ? 28 : 32 // Day number header
    const padding = 4
    const available = cellHeight - headerHeight - padding
    return Math.max(1, Math.floor(available / eventHeight))
  }, [cellHeight, isMobile])

  return (
    <div className="h-full flex flex-col">
      {/* Header - Touch friendly */}
      <div className="flex-shrink-0 px-2 sm:px-4 py-2 sm:py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevious}
              className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all touch-target"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-slate-300" />
            </button>
            <button
              onClick={handleNext}
              className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all touch-target"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          {/* Title */}
          <div className="flex-1 text-center min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
              {viewMode === 'day'
                ? format(currentDate, 'EEEE, d MMMM yyyy', { locale: dateLocale })
                : viewMode === 'week'
                  ? t('calendar.weekOf', { date: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: dateLocale }) })
                  : viewMode === 'agenda'
                    ? t('calendar.upcoming')
                    : format(currentDate, 'MMMM yyyy', { locale: dateLocale })
              }
            </h1>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handleToday}
              className="px-2 sm:px-4 h-10 sm:h-12 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 touch-target"
            >
              {t('common.today')}
            </button>
          </div>
        </div>

        {/* View toggle + Add buttons */}
        <div className="flex items-center justify-between mt-2 sm:mt-3 gap-2">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-700 p-1 overflow-x-auto">
            {/* Mobile: Show agenda and day first as they're more useful */}
            {(isMobile
              ? ['agenda', 'day', 'week', 'month'] as ViewMode[]
              : ['month', 'week', 'day', 'agenda'] as ViewMode[]
            ).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all touch-target whitespace-nowrap ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t(`calendar.${mode}`)}
              </button>
            ))}
          </div>

          <div className="flex gap-1 sm:gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="h-10 sm:h-12 px-2 sm:px-4 rounded-xl bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 active:scale-95 transition-all flex items-center gap-1 sm:gap-2 touch-target"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline text-sm font-medium text-purple-700 dark:text-purple-300">{t('calendar.smart')}</span>
            </button>
            <button
              onClick={handleAddEvent}
              className="h-10 sm:h-12 px-3 sm:px-4 rounded-xl bg-teal-500 hover:bg-teal-600 active:scale-95 transition-all flex items-center gap-1 sm:gap-2 touch-target"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span className="hidden sm:inline text-sm font-medium text-white">{t('common.add')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Agenda View */}
      {viewMode === 'agenda' && (
        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 px-4 py-4">
          {agendaEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <ChevronRight className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('calendar.noUpcomingEvents')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('calendar.noUpcomingEventsDesc')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {agendaEvents.map(group => {
                const isTodayDate = isToday(group.date)
                const isTomorrow = isSameDay(group.date, addDays(new Date(), 1))

                return (
                  <div key={group.date.toISOString()}>
                    {/* Date header */}
                    <div className="sticky top-0 bg-white dark:bg-slate-900 pb-2 z-10">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                        isTodayDate
                          ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300'
                          : isTomorrow
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        <span>{isTodayDate ? t('common.today') : isTomorrow ? t('common.tomorrow') : format(group.date, 'EEEE', { locale: dateLocale })}</span>
                        <span className="text-xs opacity-75">{format(group.date, 'd MMM', { locale: dateLocale })}</span>
                      </div>
                    </div>

                    {/* Events for this day */}
                    <div className="space-y-2">
                      {group.events.map(event => {
                        const category = event.category_id ? getCategory(event.category_id) : null
                        const memberIds = eventMembers[event.id] || []
                        const contactIds = eventContacts[event.id] || []
                        const isRecurring = !!event.recurrence_rule
                        const time = format(parseISO(event.start_time), 'HH:mm')
                        const endTime = event.end_time ? format(parseISO(event.end_time), 'HH:mm') : null

                        return (
                          <button
                            key={event.id}
                            onClick={(e) => handleEventClick(event, e)}
                            className="w-full min-h-[60px] px-4 py-3 rounded-2xl text-left transition-all active:scale-[0.99] flex items-start gap-3 tap-highlight"
                            style={{ backgroundColor: event.color + '15', borderLeft: `4px solid ${event.color}` }}
                          >
                            {/* Time column */}
                            <div className="flex-shrink-0 w-14 text-center">
                              <div className="text-sm font-bold" style={{ color: event.color }}>{time}</div>
                              {endTime && <div className="text-xs text-slate-400 dark:text-slate-500">{endTime}</div>}
                            </div>

                            {/* Event details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {isRecurring && <Repeat className="w-3.5 h-3.5 flex-shrink-0" style={{ color: event.color }} />}
                                {category && <span className="text-sm flex-shrink-0">{category.emoji}</span>}
                                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                                  {event.title}
                                </span>
                              </div>
                              {event.location && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{event.location}</p>
                              )}
                              {(memberIds.length > 0 || contactIds.length > 0) && (
                                <div className="flex items-center gap-1 mt-1">
                                  {memberIds.slice(0, 4).map(id => {
                                    const m = getMember(id)
                                    return m ? (
                                      <span
                                        key={id}
                                        className="w-5 h-5 rounded-full flex-shrink-0 text-xs flex items-center justify-center text-white font-medium"
                                        style={{ backgroundColor: m.color }}
                                        title={m.name}
                                      >
                                        {m.name.charAt(0)}
                                      </span>
                                    ) : null
                                  })}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 px-4 py-4">
          {(() => {
            const dayEvents = getEventsForDay(currentDate)
            const dayBins = getBinsForDate(currentDate)

            if (dayEvents.length === 0 && dayBins.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Plus className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('calendar.noEventsToday')}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('calendar.tapToAddEvent')}</p>
                  <button
                    onClick={() => handleDayClick(currentDate)}
                    className="px-4 py-2 bg-teal-500 text-white rounded-xl font-medium hover:bg-teal-600 transition-colors"
                  >
                    {t('calendar.addEvent')}
                  </button>
                </div>
              )
            }

            return (
              <div className="space-y-3">
                {/* Bin reminders for this day */}
                {dayBins.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {dayBins.map(binType => (
                          <span key={binType} className="text-2xl">{getBinInfo(binType).emoji}</span>
                        ))}
                      </div>
                      <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-200">{t('bindicator.binDay')}</p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          {dayBins.map(b => t(`bins.${b}.name`)).join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Events */}
                {dayEvents.map(event => {
                  const category = event.category_id ? getCategory(event.category_id) : null
                  const memberIds = eventMembers[event.id] || []
                  const contactIds = eventContacts[event.id] || []
                  const isRecurring = !!event.recurrence_rule
                  const time = format(parseISO(event.start_time), 'HH:mm')
                  const endTime = event.end_time ? format(parseISO(event.end_time), 'HH:mm') : null

                  return (
                    <button
                      key={event.id}
                      onClick={(e) => handleEventClick(event, e)}
                      className="w-full min-h-[72px] px-4 py-4 rounded-2xl text-left transition-all active:scale-[0.99] flex items-start gap-4 tap-highlight"
                      style={{ backgroundColor: event.color + '15', borderLeft: `4px solid ${event.color}` }}
                    >
                      {/* Time column */}
                      <div className="flex-shrink-0 w-16 text-center">
                        <div className="text-base font-bold" style={{ color: event.color }}>{time}</div>
                        {endTime && <div className="text-sm text-slate-400 dark:text-slate-500">{endTime}</div>}
                      </div>

                      {/* Event details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isRecurring && <Repeat className="w-4 h-4 flex-shrink-0" style={{ color: event.color }} />}
                          {category && <span className="text-base flex-shrink-0">{category.emoji}</span>}
                          <span className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {event.title}
                          </span>
                        </div>
                        {event.location && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate mb-1">{event.location}</p>
                        )}
                        {event.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{event.description}</p>
                        )}
                        {(memberIds.length > 0 || contactIds.length > 0) && (
                          <div className="flex items-center gap-1.5 mt-2">
                            {memberIds.map(id => {
                              const m = getMember(id)
                              return m ? (
                                <span
                                  key={id}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                  style={{ backgroundColor: m.color }}
                                >
                                  {m.name}
                                </span>
                              ) : null
                            })}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Day headers - only for month/week views */}
      {(viewMode === 'month' || viewMode === 'week') && (
        <div className="flex-shrink-0 grid grid-cols-7 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          {[t('calendar.dayMon'), t('calendar.dayTue'), t('calendar.dayWed'), t('calendar.dayThu'), t('calendar.dayFri'), t('calendar.daySat'), t('calendar.daySun')].map(day => (
            <div key={day} className="text-center py-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
              {day}
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid - only for month/week views */}
      {(viewMode === 'month' || viewMode === 'week') && (
        <div className={`flex-1 grid grid-cols-7 ${viewMode === 'week' ? '' : 'auto-rows-fr'} bg-white dark:bg-slate-900 overflow-hidden`}>
          {calendarDays.map(day => {
            const { background: backgroundEvents, active: activeEvents } = getEventsSplit(day)
            const isCurrentMonth = viewMode === 'week' || isSameMonth(day, currentDate)
            const isTodayDate = isToday(day)
            const dayBins = getBinsForDate(day)
            const visibleEvents = activeEvents.slice(0, maxEventsPerCell)
            const hiddenCount = activeEvents.length - visibleEvents.length

            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={`border-b border-r border-slate-200 dark:border-slate-700 p-1 cursor-pointer transition-colors overflow-hidden ${
                  isCurrentMonth
                    ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                    : 'bg-slate-50 dark:bg-slate-900/50 opacity-50'
                }`}
                style={{ height: viewMode === 'week' ? '100%' : cellHeight }}
              >
                {/* Day header */}
                <div className="flex items-center justify-between">
                  <div className={`font-semibold flex items-center justify-center rounded-full ${
                    isMobile ? 'text-xs w-6 h-6' : 'text-sm w-8 h-8'
                  } ${
                    isTodayDate
                      ? 'bg-teal-500 text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  {dayBins.length > 0 && (
                    <div className="flex gap-0.5">
                      {dayBins.map(binType => (
                        <span key={binType} className={isMobile ? 'text-xs' : 'text-sm'}>{getBinInfo(binType).emoji}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Background events as subtle banner */}
                {backgroundEvents.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mb-1">
                    {backgroundEvents.slice(0, 2).map(event => {
                      const category = event.category_id ? getCategory(event.category_id) : null
                      return (
                        <button
                          key={event.id}
                          onClick={(e) => handleEventClick(event, e)}
                          className={`flex items-center gap-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
                            isMobile ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
                          }`}
                          title={event.title}
                        >
                          {category && <span className={isMobile ? 'text-[9px]' : 'text-[11px]'}>{category.emoji}</span>}
                          <span className={`text-slate-500 dark:text-slate-400 truncate ${isMobile ? 'text-[9px] max-w-[80px]' : 'text-[11px] max-w-[120px]'}`}>
                            {event.title}
                          </span>
                        </button>
                      )
                    })}
                    {backgroundEvents.length > 2 && (
                      <span className={`text-slate-400 dark:text-slate-500 ${isMobile ? 'text-[9px]' : 'text-[11px]'}`}>
                        +{backgroundEvents.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Active Events */}
                <div className={isMobile ? 'space-y-0.5' : 'space-y-1'}>
                  {visibleEvents.map(event => {
                    const category = event.category_id ? getCategory(event.category_id) : null
                    const memberIds = eventMembers[event.id] || []
                    const contactIds = eventContacts[event.id] || []
                    const isRecurring = !!event.recurrence_rule
                    const time = format(parseISO(event.start_time), 'HH:mm')

                    return (
                      <button
                        key={event.id}
                        onClick={(e) => handleEventClick(event, e)}
                        className={`w-full rounded-md text-left transition-all active:scale-[0.98] flex items-center gap-1 tap-highlight ${
                          isMobile ? 'px-1 py-0.5 min-h-[22px]' : 'px-2 py-1.5 min-h-[34px]'
                        }`}
                        style={{ backgroundColor: event.color + '20', borderLeft: `2px solid ${event.color}` }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-0.5">
                            {isRecurring && <Repeat className={`flex-shrink-0 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} style={{ color: event.color }} />}
                            {category && !isMobile && <span className="text-xs flex-shrink-0">{category.emoji}</span>}
                            <span className={`font-semibold truncate ${isMobile ? 'text-[10px]' : 'text-xs'}`} style={{ color: event.color }}>
                              {event.title}
                            </span>
                          </div>
                          {!isMobile && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                              <span>{time}</span>
                              {(memberIds.length > 0 || contactIds.length > 0) && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center gap-0.5">
                                    {memberIds.slice(0, 2).map(id => {
                                      const m = getMember(id)
                                      return m ? (
                                        <span
                                          key={id}
                                          className="w-3 h-3 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: m.color }}
                                          title={m.name}
                                        />
                                      ) : null
                                    })}
                                    {contactIds.slice(0, 2).map(id => {
                                      const c = getContact(id)
                                      const displayName = c?.display_name || c?.name || ''
                                      return c ? (
                                        <span
                                          key={id}
                                          className="w-3 h-3 rounded-full bg-slate-400 text-white text-[7px] flex items-center justify-center font-bold flex-shrink-0"
                                          title={displayName}
                                        >
                                          {displayName.charAt(0)}
                                        </span>
                                      ) : null
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {hiddenCount > 0 && (
                    <div className="text-xs text-teal-600 dark:text-teal-400 font-medium pl-2 py-1">
                      {t('calendar.moreEvents', { count: hiddenCount })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <EventDetailModal
        event={selectedEvent}
        eventMembers={selectedEvent ? eventMembers[selectedEvent.id] || [] : []}
        eventContacts={selectedEvent ? eventContacts[selectedEvent.id] || [] : []}
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        onDelete={handleDeleteEvent}
        onUpdate={handleUpdateEvent}
      />

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t('calendar.addEvent')} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('calendar.eventTitle')} *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-base"
              placeholder={t('calendar.eventTitlePlaceholder')}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="all_day"
              checked={formData.all_day}
              onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
              className="w-6 h-6 rounded border-slate-300 text-teal-500 focus:ring-teal-500"
            />
            <label htmlFor="all_day" className="text-base text-slate-700 dark:text-slate-300">
              {t('calendar.allDayEvent')}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('calendar.startDate')}
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
            {!formData.all_day && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('calendar.startTime')}
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {!formData.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('calendar.endDate')}
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('calendar.endTime')}
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('calendar.category')}
            </label>
            <CategorySelector
              value={formData.category_id}
              onChange={(categoryId) => {
                const category = categories.find(c => c.id === categoryId)
                setFormData({
                  ...formData,
                  category_id: categoryId,
                  color: (formData.member_ids.length === 0 && category) ? category.color : formData.color
                })
              }}
              placeholder={t('calendar.selectCategory')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('calendar.familyMembers')}
            </label>
            <MemberMultiSelect
              value={formData.member_ids}
              onChange={(memberIds) => {
                const firstMember = memberIds.length > 0 ? members.find(m => m.id === memberIds[0]) : null
                setFormData({
                  ...formData,
                  member_ids: memberIds,
                  color: firstMember?.color || formData.color
                })
              }}
              placeholder={t('calendar.selectMembersOptional')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('calendar.color')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {MEMBER_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c.color })}
                  className={`w-10 h-10 rounded-full transition-transform ${
                    formData.color === c.color ? 'scale-110 ring-2 ring-offset-2 ring-slate-400' : ''
                  }`}
                  style={{ backgroundColor: c.color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('calendar.location')}
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              placeholder={t('calendar.locationPlaceholder')}
            />
          </div>

          <div className="border-t pt-4 border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({
                  ...formData,
                  is_recurring: e.target.checked,
                  recurrence_pattern: e.target.checked ? {
                    frequency: 'weekly',
                    interval: 1,
                    daysOfWeek: [new Date(formData.start_date).getDay()],
                    endType: 'never',
                  } : null
                })}
                className="w-6 h-6 rounded border-slate-300 text-teal-500 focus:ring-teal-500"
              />
              <div className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-slate-500" />
                <span className="text-base text-slate-700 dark:text-slate-300">{t('calendar.repeatThisEvent')}</span>
              </div>
            </label>

            {formData.is_recurring && (
              <div className="ml-9">
                <RecurrenceSelector
                  value={formData.recurrence_pattern}
                  onChange={(pattern) => setFormData({ ...formData, recurrence_pattern: pattern })}
                  startDate={formData.start_date ? new Date(formData.start_date) : new Date()}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('calendar.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              rows={3}
              placeholder={t('calendar.descriptionPlaceholder')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" size="lg" onClick={() => setShowAddModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="lg" onClick={handleSaveEvent} disabled={!formData.title.trim()}>
              {t('calendar.saveEvent')}
            </Button>
          </div>
        </div>
      </Modal>

      <AICalendarInput
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onAddEvents={handleAIEvents}
      />
    </div>
  )
}
