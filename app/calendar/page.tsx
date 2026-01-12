'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Trash2, Calendar, Sparkles, Tag, Users, Repeat } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import AICalendarInput from '@/components/AICalendarInput'
import EventDetailModal from '@/components/EventDetailModal'
import CategorySelector, { CategoryPill } from '@/components/CategorySelector'
import MemberMultiSelect from '@/components/MemberMultiSelect'
import MemberAvatarStack, { MemberDotStack } from '@/components/MemberAvatarStack'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useCategories } from '@/lib/categories-context'
import { useSettings } from '@/lib/settings-context'
import { CalendarEvent, MEMBER_COLORS, RecurrencePattern } from '@/lib/database.types'
import RecurrenceSelector, { RecurrenceBadge } from '@/components/RecurrenceSelector'
import { patternToRRule, rruleToPattern, describeRecurrence } from '@/lib/rrule'
import { getBinsForDate, getBinInfo } from '@/lib/bin-schedule'

type ViewMode = 'month' | 'week' | 'day'

// Demo events for when not logged in
const DEMO_EVENTS: CalendarEvent[] = [
  { id: 'demo-1', user_id: 'demo', title: "Olivia's Playgroup", description: '', start_time: new Date().toISOString(), end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), all_day: false, color: '#8b5cf6', member_id: null, category_id: null, location: 'Community Centre', source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: 'demo-2', user_id: 'demo', title: 'Family Swim Class', description: '', start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), all_day: false, color: '#ec4899', member_id: null, category_id: null, location: 'Leisure Centre', source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: 'demo-3', user_id: 'demo', title: 'Health Visitor', description: '', start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), end_time: null, all_day: false, color: '#22c55e', member_id: null, category_id: null, location: 'Home', source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
]

export default function CalendarPage() {
  const { user } = useAuth()
  const { members, getMember } = useFamily()
  const { categories, getCategory } = useCategories()
  const { googleCalendarAutoPush } = useSettings()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventMembers, setEventMembers] = useState<Record<string, string[]>>({}) // event_id -> member_ids
  const [eventContacts, setEventContacts] = useState<Record<string, string[]>>({}) // event_id -> contact_ids
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)

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

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true })

      if (error) throw error
      setEvents((data as CalendarEvent[]) || [])

      // Fetch event members and contacts for all events
      if (data && data.length > 0) {
        const eventIds = data.map(e => e.id)

        // Fetch members
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

        // Fetch contacts
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
    } catch (error) {
      console.error('Error fetching events:', error)
    }
    setLoading(false)
  }, [user, currentDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handlePrevious = () => {
    setCurrentDate(prev => subMonths(prev, 1))
  }

  const handleNext = () => {
    setCurrentDate(prev => addMonths(prev, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    const dayEvents = events.filter(e => isSameDay(parseISO(e.start_time), date))
    if (dayEvents.length === 0) {
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

    // Generate RRULE if recurring
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
      member_id: formData.member_ids.length === 1 ? formData.member_ids[0] : null, // Keep for backwards compat
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

      // Insert event_members for multi-member support
      if (formData.member_ids.length > 0 && insertedEvent) {
        const eventMembersData = formData.member_ids.map(memberId => ({
          event_id: insertedEvent.id,
          member_id: memberId,
        }))
        await supabase.from('event_members').insert(eventMembersData)
      }

      // Auto-push to Google Calendar if enabled
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
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
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

      await fetchEvents()
      setShowEventModal(false)
    } catch (error) {
      console.error('Error updating event:', error)
    }
  }

  // Handle AI-extracted events
  const handleAIEvents = async (aiEvents: any[]) => {
    for (const event of aiEvents) {
      const startDateTime = event.all_day
        ? `${event.start_date}T00:00:00`
        : `${event.start_date}T${event.start_time || '09:00'}:00`

      const endDateTime = event.all_day || !event.end_time
        ? null
        : `${event.end_date || event.start_date}T${event.end_time}:00`

      const memberIds: string[] = event.member_ids || []
      const contactIds: string[] = event.contact_ids || []

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
        recurrence_rule: event.recurrence_rrule || null, // Include recurrence from AI
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

          // Insert event_members for multi-member support
          if (memberIds.length > 0 && insertedEvent) {
            const eventMembersData = memberIds.map(memberId => ({
              event_id: insertedEvent.id,
              member_id: memberId,
            }))
            await supabase.from('event_members').insert(eventMembersData)
          }

          // Insert event_contacts for contact tagging
          if (contactIds.length > 0 && insertedEvent) {
            const eventContactsData = contactIds.map(contactId => ({
              event_id: insertedEvent.id,
              contact_id: contactId,
            }))
            await supabase.from('event_contacts').insert(eventContactsData)
          }

          // Auto-push to Google Calendar if enabled
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

  // Generate calendar days
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getEventsForDay = (date: Date) => {
    return events.filter(event => isSameDay(parseISO(event.start_time), date))
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Calendar</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Family schedule and events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowAIModal(true)} className="gap-2">
            <Sparkles className="w-5 h-5" />
            Smart Add
          </Button>
          <Button onClick={handleAddEvent} className="gap-2">
            <Plus className="w-5 h-5" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <button
              onClick={handleNext}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 ml-2">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleToday}>
              Today
            </Button>
            <div className="hidden sm:flex rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
              {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                    viewMode === mode
                      ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Calendar Grid */}
      <Card hover={false}>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(day => {
            const dayEvents = getEventsForDay(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const isTodayDate = isToday(day)
            const dayBins = getBinsForDate(day)

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={`min-h-[100px] p-2 rounded-xl text-left transition-all ${
                  isCurrentMonth
                    ? 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700'
                    : 'bg-slate-25 dark:bg-slate-900/30 opacity-50'
                } ${isSelected ? 'ring-2 ring-sage-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                    isTodayDate
                      ? 'bg-sage-500 text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  {dayBins.length > 0 && (
                    <div className="flex gap-0.5" title={dayBins.map(b => getBinInfo(b).name).join(', ')}>
                      {dayBins.map(binType => (
                        <span key={binType} className="text-xs">{getBinInfo(binType).emoji}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => {
                    const category = event.category_id ? getCategory(event.category_id) : null
                    const memberIds = eventMembers[event.id] || []
                    const isRecurring = !!event.recurrence_rule
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => handleEventClick(event, e)}
                        className="text-xs p-1 rounded cursor-pointer hover:opacity-80 flex items-center gap-1"
                        style={{ backgroundColor: event.color + '20', color: event.color }}
                      >
                        {isRecurring && <Repeat className="w-3 h-3 flex-shrink-0" />}
                        {category && <span className="flex-shrink-0">{category.emoji}</span>}
                        <span className="truncate flex-1">{event.title}</span>
                        {memberIds.length > 0 && (
                          <MemberDotStack memberIds={memberIds} maxDisplay={3} />
                        )}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Event Details Modal */}
      <EventDetailModal
        event={selectedEvent}
        eventMembers={selectedEvent ? eventMembers[selectedEvent.id] || [] : []}
        eventContacts={selectedEvent ? eventContacts[selectedEvent.id] || [] : []}
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        onDelete={handleDeleteEvent}
        onUpdate={handleUpdateEvent}
      />

      {/* Add Event Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Event" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              placeholder="Event name..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="all_day"
              checked={formData.all_day}
              onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-sage-500 focus:ring-sage-500"
            />
            <label htmlFor="all_day" className="text-sm text-slate-700 dark:text-slate-300">
              All day event
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
            {!formData.all_day && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {!formData.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Category
            </label>
            <CategorySelector
              value={formData.category_id}
              onChange={(categoryId) => {
                const category = categories.find(c => c.id === categoryId)
                setFormData({
                  ...formData,
                  category_id: categoryId,
                  // Update color from category if no members selected
                  color: (formData.member_ids.length === 0 && category)
                    ? category.color
                    : formData.color
                })
              }}
              placeholder="Select category"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Family Members
            </label>
            <MemberMultiSelect
              value={formData.member_ids}
              onChange={(memberIds) => {
                const firstMember = memberIds.length > 0
                  ? members.find(m => m.id === memberIds[0])
                  : null
                setFormData({
                  ...formData,
                  member_ids: memberIds,
                  color: firstMember?.color || formData.color
                })
              }}
              placeholder="Select members (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {MEMBER_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c.color })}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    formData.color === c.color ? 'scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500' : ''
                  }`}
                  style={{ backgroundColor: c.color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              placeholder="Where is this event?"
            />
          </div>

          {/* Recurrence */}
          <div className="border-t pt-4 mt-4 border-slate-200 dark:border-slate-700">
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
                className="w-5 h-5 rounded border-slate-300 text-sage-500 focus:ring-sage-500"
              />
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Repeat this event</span>
              </div>
            </label>

            {formData.is_recurring && (
              <div className="ml-8">
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
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              rows={3}
              placeholder="Additional details..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEvent} disabled={!formData.title.trim()}>
              Save Event
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI Calendar Input Modal */}
      <AICalendarInput
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onAddEvents={handleAIEvents}
      />
    </div>
  )
}
