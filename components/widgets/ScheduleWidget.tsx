'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { CalendarEvent } from '@/lib/database.types'

// Demo events
const DEMO_EVENTS: CalendarEvent[] = [
  { id: '1', user_id: 'demo', title: 'School drop-off', start_time: new Date().toISOString().split('T')[0] + 'T08:30:00', end_time: null, all_day: false, color: '#8b5cf6', member_id: 'demo-olivia', description: null, location: null, source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: '2', user_id: 'demo', title: 'Grocery shopping', start_time: new Date().toISOString().split('T')[0] + 'T10:00:00', end_time: null, all_day: false, color: '#3b82f6', member_id: 'demo-dad', description: null, location: null, source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: '3', user_id: 'demo', title: 'Nap time', start_time: new Date().toISOString().split('T')[0] + 'T13:00:00', end_time: null, all_day: false, color: '#22c55e', member_id: 'demo-ellie', description: null, location: null, source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
  { id: '4', user_id: 'demo', title: 'Playdate', start_time: new Date().toISOString().split('T')[0] + 'T15:30:00', end_time: null, all_day: false, color: '#8b5cf6', member_id: 'demo-olivia', description: null, location: null, source: 'manual', source_id: null, recurrence_rule: null, created_at: '', updated_at: '' },
]

export default function ScheduleWidget() {
  const { user } = useAuth()
  const { getMember } = useFamily()
  const [events, setEvents] = useState<CalendarEvent[]>([])

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
  }).slice(0, 4)

  return (
    <div className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-sage-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Today</h3>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">No more events today</p>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-hidden">
          {upcomingEvents.map(event => {
            const member = getMember(event.member_id)
            const time = format(parseISO(event.start_time), 'HH:mm')

            return (
              <div
                key={event.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"
              >
                <div
                  className="w-1 h-10 rounded-full"
                  style={{ backgroundColor: event.color || member?.color || '#888' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">
                    {event.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {time}
                    {member && ` • ${member.name}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
