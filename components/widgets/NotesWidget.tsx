'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Note } from '@/lib/database.types'

// Demo notes
const DEMO_NOTES: Note[] = [
  { id: '1', user_id: 'demo', title: 'Grocery List', content: 'Milk, Bread, Eggs', color: '#fef3c7', pinned: true, author_id: null, created_at: '', updated_at: '' },
  { id: '2', user_id: 'demo', title: 'Doctor Appt', content: 'Thursday 10am', color: '#dbeafe', pinned: true, author_id: null, created_at: '', updated_at: '' },
]

export default function NotesWidget() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])

  const fetchNotes = useCallback(async () => {
    if (!user) {
      setNotes(DEMO_NOTES)
      return
    }

    try {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('pinned', true)
        .order('updated_at', { ascending: false })
        .limit(3)

      if (data) {
        setNotes(data)
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
      setNotes(DEMO_NOTES)
    }
  }, [user])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  return (
    <div className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark">
      <div className="flex items-center gap-2 mb-3">
        <Pin className="w-4 h-4 text-teal-500" />
        <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">Pinned Notes</h3>
      </div>

      <div className="flex-1 space-y-2 overflow-hidden">
        {notes.map(note => (
          <div
            key={note.id}
            className="p-2.5 rounded-xl text-sm transition-colors hover:ring-2 hover:ring-teal-200 dark:hover:ring-teal-800"
            style={{ backgroundColor: note.color + '80' }}
          >
            {note.title && (
              <p className="font-medium text-slate-800 truncate">{note.title}</p>
            )}
            <p className="text-slate-600 text-xs line-clamp-2">{note.content}</p>
          </div>
        ))}

        {notes.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">No pinned notes</p>
          </div>
        )}
      </div>
    </div>
  )
}
