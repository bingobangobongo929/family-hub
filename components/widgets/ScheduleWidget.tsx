'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { Clock, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { CalendarEvent } from '@/lib/database.types'
import { useWidgetSize } from '@/lib/useWidgetSize'

// Demo events
const DEMO_EVENTS: CalendarEvent[] = [
  { id: '1', user_id: 'demo', title: 'School drop-off', start_time: new Date().toISOString().split('T')[0] + 'T08:30:00', end_time: null, all_day: false, color: '#8b5cf6', member_id: 'demo-olivia', description: null, location: 'Randers School', source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: '2', user_id: 'demo', title: 'Grocery shopping', start_time: new Date().toISOString().split('T')[0] + 'T10:00:00', end_time: null, all_day: false, color: '#3b82f6', member_id: 'demo-dad', description: null, location: 'Føtex', source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: '3', user_id: 'demo', title: 'Nap time', start_time: new Date().toISOString().split('T')[0] + 'T13:00:00', end_time: null, all_day: false, color: '#22c55e', member_id: 'demo-ellie', description: null, location: null, source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: '4', user_id: 'demo', title: 'Playdate with Emma', start_time: new Date().toISOString().split('T')[0] + 'T15:30:00', end_time: null, all_day: false, color: '#8b5cf6', member_id: 'demo-olivia', description: null, location: "Emma's house", source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: '5', user_id: 'demo', title: 'Dinner prep', start_time: new Date().toISOString().split('T')[0] + 'T17:00:00', end_time: null, all_day: false, color: '#f59e0b', member_id: 'demo-mum', description: null, location: null, source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: '6', user_id: 'demo', title: 'Bath time', start_time: new Date().toISOString().split('T')[0] + 'T18:30:00', end_time: null, all_day: false, color: '#22c55e', member_id: 'demo-ellie', description: null, location: null, source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
]

export default function ScheduleWidget() {
  const { user } = useAuth()
  const { getMember } = useFamily()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [ref, { size, isTall }] = useWidgetSize()

  const fetchTodaysEvents = useCallback(async () => {
    if (!user) {
      setEvents(DEMO_EVENTS)
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', today + 'T00:00:00')
        .lte('start_time', today + 'T23:59:59')
        .order('start_time', { ascending: true })

      if (data) {
        setEvents(data)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      setEvents(DEMO_EVENTS)
    }
  }, [user])

  useEffect(() => {
    fetchTodaysEvents()
  }, [fetchTodaysEvents])

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  // Find upcoming events
  const upcomingEvents = events.filter(event => {
    const eventTime = new Date(event.start_time)
    return eventTime.getHours() > currentHour ||
           (eventTime.getHours() === currentHour && eventTime.getMinutes() >= currentMinutes)
  })

  // Number of events to show based on size
  const maxEvents = {
    small: 3,
    medium: 4,
    large: 6,
    xlarge: 8,
  }[size]

  const displayEvents = upcomingEvents.slice(0, maxEvents)
  const showLocation = size === 'large' || size === 'xlarge'
  const compactMode = size === 'small'

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark"
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-teal-500" />
        <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">Today</h3>
        {events.length > 0 && (
          <span className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full ml-auto">
            {upcomingEvents.length} upcoming
          </span>
        )}
      </div>

      {displayEvents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">No more events today</p>
        </div>
      ) : (
        <div className={`flex-1 space-y-${compactMode ? '1' : '2'} overflow-hidden`}>
          {displayEvents.map(event => {
            const member = getMember(event.member_id)
            const time = format(parseISO(event.start_time), 'HH:mm')

            return (
              <div
                key={event.id}
                className={`flex items-center gap-3 ${compactMode ? 'py-1.5 px-2' : 'p-2.5'} rounded-xl bg-slate-50 dark:bg-slate-700/50 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700`}
              >
                <div
                  className={`${compactMode ? 'w-1 h-8' : 'w-1 h-10'} rounded-full flex-shrink-0`}
                  style={{ backgroundColor: event.color || member?.color || '#14b8a6' }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${compactMode ? 'text-xs' : 'text-sm'} text-slate-800 dark:text-slate-100 truncate`}>
                    {event.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className={`${compactMode ? 'text-[10px]' : 'text-xs'} text-slate-500 dark:text-slate-400 font-medium`}>
                      {time}
                      {member && ` • ${member.name}`}
                    </p>
                    {showLocation && event.location && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {upcomingEvents.length > maxEvents && (
            <p className="text-xs text-teal-600 dark:text-teal-400 text-center pt-1 font-medium">
              +{upcomingEvents.length - maxEvents} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}
