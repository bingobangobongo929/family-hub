'use client'

import { useState } from 'react'
import { Megaphone, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFamily } from '@/lib/family-context'

interface Announcement {
  id: string
  message: string
  author_id: string | null
  created_at: string
  priority: 'normal' | 'important'
}

// Demo announcements
const DEMO_ANNOUNCEMENTS: Announcement[] = [
  { id: '1', message: "Don't forget - Olivia's swimming lesson at 4pm today!", author_id: 'demo-mum', created_at: new Date().toISOString(), priority: 'important' },
  { id: '2', message: "Grandma and Grandpa visiting this weekend", author_id: 'demo-dad', created_at: new Date().toISOString(), priority: 'normal' },
  { id: '3', message: "Please remember to take out the bins tonight", author_id: 'demo-mum', created_at: new Date().toISOString(), priority: 'normal' },
]

export default function AnnouncementsWidget() {
  const { getMember } = useFamily()
  const [announcements] = useState<Announcement[]>(DEMO_ANNOUNCEMENTS)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (announcements.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
        <p className="text-slate-500 dark:text-slate-400 text-sm">No announcements</p>
      </div>
    )
  }

  const current = announcements[currentIndex]
  const author = getMember(current.author_id)

  const next = () => setCurrentIndex((currentIndex + 1) % announcements.length)
  const prev = () => setCurrentIndex((currentIndex - 1 + announcements.length) % announcements.length)

  return (
    <div className={`h-full flex flex-col p-4 rounded-3xl shadow-widget dark:shadow-widget-dark ${
      current.priority === 'important'
        ? 'bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30'
        : 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className={`w-4 h-4 ${current.priority === 'important' ? 'text-rose-500' : 'text-teal-500'}`} />
        <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">Announcements</h3>
        {announcements.length > 1 && (
          <span className="text-xs text-slate-500 ml-auto">
            {currentIndex + 1}/{announcements.length}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center">
        {announcements.length > 1 && (
          <button
            onClick={prev}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 text-center px-2">
          <p className="text-slate-800 dark:text-slate-100 font-medium">
            {current.message}
          </p>
          {author && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-center gap-1">
              <span
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[10px]"
                style={{ backgroundColor: author.color }}
              >
                {author.name.charAt(0)}
              </span>
              {author.name}
            </p>
          )}
        </div>

        {announcements.length > 1 && (
          <button
            onClick={next}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Dots indicator */}
      {announcements.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {announcements.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex
                  ? current.priority === 'important' ? 'bg-rose-500' : 'bg-teal-500'
                  : 'bg-slate-300 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
