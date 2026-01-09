'use client'

import { useState } from 'react'
import Card, { CardHeader } from '@/components/Card'
import { StickyNote, Plus, Trash2, Pin } from 'lucide-react'

interface Note {
  id: number
  title: string
  content: string
  author: string
  authorColor: string
  color: string
  pinned: boolean
  createdAt: string
}

const initialNotes: Note[] = [
  {
    id: 1,
    title: "Olivia's 3rd Birthday",
    content: "Party on Saturday at 2pm! Cake ordered from bakery (Peppa Pig theme). Grandparents arriving Friday evening.",
    author: "Mum",
    authorColor: "bg-pink-500",
    color: "bg-yellow-50 border-yellow-400",
    pinned: true,
    createdAt: "Jan 8"
  },
  {
    id: 2,
    title: "Ellie's Routine",
    content: "Morning nap: 9:30-10:30am\nAfternoon nap: 1:00-3:00pm\nBedtime: 7:00pm\nCurrently on 3 bottles a day",
    author: "Mum",
    authorColor: "bg-pink-500",
    color: "bg-green-50 border-green-400",
    pinned: true,
    createdAt: "Jan 7"
  },
  {
    id: 3,
    title: "Health Visitor",
    content: "Thursday 10am - Ellie's developmental check. Remember to mention the rash on her arm.",
    author: "Dad",
    authorColor: "bg-blue-500",
    color: "bg-blue-50 border-blue-400",
    pinned: true,
    createdAt: "Jan 5"
  },
  {
    id: 4,
    title: "Olivia's Favourite Foods",
    content: "Currently likes: pasta, bananas, cheese, peas\nWon't eat: anything green except peas\nAllergies: None known",
    author: "Mum",
    authorColor: "bg-pink-500",
    color: "bg-purple-50 border-purple-400",
    pinned: false,
    createdAt: "Jan 6"
  },
  {
    id: 5,
    title: "Emergency Contacts",
    content: "GP Surgery: 020 7123 4567\nNHS 111 for non-emergency\nGrandma: 07700 900123\nNeighbour Sarah: 07700 900456",
    author: "Mum",
    authorColor: "bg-pink-500",
    color: "bg-red-50 border-red-400",
    pinned: true,
    createdAt: "Jan 1"
  },
  {
    id: 6,
    title: "Nursery Info",
    content: "Olivia at Little Stars Nursery\nMon/Wed/Fri 9am-3pm\nKey worker: Sophie\nContact: 020 7890 1234",
    author: "Dad",
    authorColor: "bg-blue-500",
    color: "bg-orange-50 border-orange-400",
    pinned: false,
    createdAt: "Jan 3"
  },
]

const noteColors = [
  "bg-yellow-50 border-yellow-400",
  "bg-blue-50 border-blue-400",
  "bg-green-50 border-green-400",
  "bg-purple-50 border-purple-400",
  "bg-orange-50 border-orange-400",
  "bg-pink-50 border-pink-400",
]

export default function NotesPage() {
  const [notes, setNotes] = useState(initialNotes)
  const [showNewNote, setShowNewNote] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const togglePin = (id: number) => {
    setNotes(notes.map(note =>
      note.id === id ? { ...note, pinned: !note.pinned } : note
    ))
  }

  const deleteNote = (id: number) => {
    setNotes(notes.filter(note => note.id !== id))
  }

  const addNote = () => {
    if (newTitle.trim() && newContent.trim()) {
      setNotes([
        {
          id: Date.now(),
          title: newTitle,
          content: newContent,
          author: "You",
          authorColor: "bg-slate-500",
          color: noteColors[Math.floor(Math.random() * noteColors.length)],
          pinned: false,
          createdAt: "Just now"
        },
        ...notes
      ])
      setNewTitle('')
      setNewContent('')
      setShowNewNote(false)
    }
  }

  const pinnedNotes = notes.filter(n => n.pinned)
  const unpinnedNotes = notes.filter(n => !n.pinned)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Notes</h1>
          <p className="text-slate-500 mt-1">Share important information with your family.</p>
        </div>
        <button
          onClick={() => setShowNewNote(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Note
        </button>
      </div>

      {/* New Note Form */}
      {showNewNote && (
        <Card className="mb-6" hover={false}>
          <h3 className="font-semibold text-slate-800 mb-4">Create New Note</h3>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Note title..."
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all mb-3"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your note..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all resize-none mb-4"
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowNewNote(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addNote}
              className="px-6 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
            >
              Save Note
            </button>
          </div>
        </Card>
      )}

      {/* Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Pin className="w-4 h-4" />
            Pinned
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedNotes.map(note => (
              <div
                key={note.id}
                className={`p-5 rounded-2xl border-l-4 ${note.color} shadow-sm hover:shadow-md transition-shadow group`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-800">{note.title}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => togglePin(note.id)}
                      className="p-1.5 rounded-lg hover:bg-white/50 text-amber-500"
                    >
                      <Pin className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-1.5 rounded-lg hover:bg-white/50 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-line mb-4">{note.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${note.authorColor} flex items-center justify-center text-white text-xs font-medium`}>
                      {note.author[0]}
                    </div>
                    <span className="text-xs text-slate-500">{note.author}</span>
                  </div>
                  <span className="text-xs text-slate-400">{note.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Notes */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <StickyNote className="w-4 h-4" />
          All Notes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unpinnedNotes.map(note => (
            <div
              key={note.id}
              className={`p-5 rounded-2xl border-l-4 ${note.color} shadow-sm hover:shadow-md transition-shadow group`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-800">{note.title}</h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => togglePin(note.id)}
                    className="p-1.5 rounded-lg hover:bg-white/50 text-slate-400 hover:text-amber-500"
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="p-1.5 rounded-lg hover:bg-white/50 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-line mb-4">{note.content}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full ${note.authorColor} flex items-center justify-center text-white text-xs font-medium`}>
                    {note.author[0]}
                  </div>
                  <span className="text-xs text-slate-500">{note.author}</span>
                </div>
                <span className="text-xs text-slate-400">{note.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
