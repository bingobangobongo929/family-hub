'use client'

import { useState } from 'react'
import Card, { CardHeader } from '@/components/Card'
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

const events = [
  { id: 1, title: "Olivia's Playgroup", date: 15, time: "10:00 AM", member: "Olivia", color: "bg-purple-500" },
  { id: 2, title: "Ellie's Nap Time", date: 15, time: "1:00 PM", member: "Ellie", color: "bg-green-500" },
  { id: 3, title: "Family Swim Class", date: 16, time: "9:30 AM", member: "All", color: "bg-pink-500" },
  { id: 4, title: "Health Visitor Check", date: 18, time: "10:00 AM", member: "Ellie", color: "bg-green-500" },
  { id: 5, title: "Olivia's Birthday Party", date: 20, time: "2:00 PM", member: "Olivia", color: "bg-purple-500" },
  { id: 6, title: "Soft Play Centre", date: 22, time: "11:00 AM", member: "All", color: "bg-pink-500" },
]

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 15))
  const [selectedDate, setSelectedDate] = useState(15)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const getEventsForDay = (day: number) => {
    return events.filter(e => e.date === day)
  }

  const selectedEvents = getEventsForDay(selectedDate)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Calendar</h1>
          <p className="text-slate-500 mt-1">Keep track of family events and appointments.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors">
          <Plus className="w-5 h-5" />
          Add Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2" hover={false}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">
              {months[month]} {year}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {daysOfWeek.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-slate-500">
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : []
              return (
                <div
                  key={index}
                  onClick={() => day && setSelectedDate(day)}
                  className={`p-2 min-h-[80px] rounded-lg cursor-pointer transition-colors ${
                    day === null
                      ? 'bg-transparent'
                      : day === selectedDate
                      ? 'bg-primary-100 border-2 border-primary-500'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {day && (
                    <>
                      <span className={`text-sm ${day === selectedDate ? 'font-bold text-primary-700' : 'text-slate-700'}`}>
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map(event => (
                          <div
                            key={event.id}
                            className={`${event.color} text-white text-xs px-1 py-0.5 rounded truncate`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-slate-500">+{dayEvents.length - 2} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Selected Day Events */}
        <Card hover={false}>
          <CardHeader
            title={`${months[month]} ${selectedDate}`}
            icon={<Calendar className="w-5 h-5" />}
          />
          {selectedEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedEvents.map(event => (
                <div key={event.id} className="p-4 rounded-xl bg-slate-50">
                  <div className="flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full ${event.color} mt-1.5`} />
                    <div>
                      <p className="font-medium text-slate-800">{event.title}</p>
                      <p className="text-sm text-slate-500">{event.time}</p>
                      <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-600">
                        {event.member}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No events scheduled</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
