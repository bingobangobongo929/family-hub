'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Card from '@/components/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { StickyNote, Plus, Pin, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useTranslation } from '@/lib/i18n-context'
import { Note, NOTE_COLORS } from '@/lib/database.types'

// Demo notes
const DEMO_NOTES: Note[] = [
  { id: 'demo-1', user_id: 'demo', title: 'Grocery List', content: 'Milk, Bread, Eggs, Cheese, Apples, Bananas', color: '#fef3c7', pinned: true, author_id: 'demo-mum', created_at: '', updated_at: '' },
  { id: 'demo-2', user_id: 'demo', title: 'Doctor Appointment', content: "Ellie's 18 month checkup - Thursday 10am at Wilmslow Health Centre", color: '#dbeafe', pinned: true, author_id: 'demo-dad', created_at: '', updated_at: '' },
  { id: 'demo-3', user_id: 'demo', title: null, content: "Olivia's playdate with Sophie on Saturday at 2pm", color: '#fce7f3', pinned: false, author_id: 'demo-mum', created_at: '', updated_at: '' },
  { id: 'demo-4', user_id: 'demo', title: 'WiFi Password', content: 'YourWiFiPasswordHere', color: '#e0e7ff', pinned: true, author_id: null, created_at: '', updated_at: '' },
  { id: 'demo-5', user_id: 'demo', title: 'School Term Dates', content: 'Half term: Feb 12-16\nEaster hols: Mar 29 - Apr 12\nSummer: Jul 19', color: '#dcfce7', pinned: false, author_id: null, created_at: '', updated_at: '' },
  { id: 'demo-6', user_id: 'demo', title: 'Bin Collection', content: 'Black bin: Tuesday\nGreen bin: Alternate Tuesdays\nNext green bin: Jan 14th', color: '#ffedd5', pinned: false, author_id: null, created_at: '', updated_at: '' },
]

export default function NotesPage() {
  const { user } = useAuth()
  const { members, getMember } = useFamily()
  const { t } = useTranslation()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    color: NOTE_COLORS[0].color,
    pinned: false,
    author_id: null as string | null
  })

  const fetchNotes = useCallback(async () => {
    if (!user) {
      setNotes(DEMO_NOTES)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })

      if (error) throw error
      setNotes(data || [])
    } catch (error) {
      console.error('Error fetching notes:', error)
      setNotes(DEMO_NOTES)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const handleAddNote = async () => {
    if (!formData.content.trim()) return

    if (!user) {
      const newNote: Note = {
        id: 'demo-' + Date.now(),
        user_id: 'demo',
        title: formData.title || null,
        content: formData.content,
        color: formData.color,
        pinned: formData.pinned,
        author_id: formData.author_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setNotes([newNote, ...notes])
      setShowAddModal(false)
      resetForm()
      return
    }

    try {
      const { error } = await supabase
        .from('notes')
        .insert({
          title: formData.title || null,
          content: formData.content,
          color: formData.color,
          pinned: formData.pinned,
          author_id: formData.author_id
        })

      if (error) throw error
      await fetchNotes()
      setShowAddModal(false)
      resetForm()
    } catch (error) {
      console.error('Error adding note:', error)
    }
  }

  const handleEditNote = async () => {
    if (!editingNote || !formData.content.trim()) return

    if (!user) {
      setNotes(notes.map(n =>
        n.id === editingNote.id
          ? { ...n, ...formData, title: formData.title || null, updated_at: new Date().toISOString() }
          : n
      ))
      setEditingNote(null)
      setShowAddModal(false)
      resetForm()
      return
    }

    try {
      const { error } = await supabase
        .from('notes')
        .update({
          title: formData.title || null,
          content: formData.content,
          color: formData.color,
          pinned: formData.pinned,
          author_id: formData.author_id
        })
        .eq('id', editingNote.id)

      if (error) throw error
      await fetchNotes()
      setEditingNote(null)
      setShowAddModal(false)
      resetForm()
    } catch (error) {
      console.error('Error updating note:', error)
    }
  }

  const handleDeleteNote = async (note: Note) => {
    if (!confirm('Delete this note?')) return

    if (!user) {
      setNotes(notes.filter(n => n.id !== note.id))
      return
    }

    try {
      await supabase.from('notes').delete().eq('id', note.id)
      await fetchNotes()
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const togglePin = async (note: Note) => {
    if (!user) {
      setNotes(notes.map(n =>
        n.id === note.id ? { ...n, pinned: !n.pinned } : n
      ).sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1
        return 0
      }))
      return
    }

    try {
      await supabase
        .from('notes')
        .update({ pinned: !note.pinned })
        .eq('id', note.id)
      await fetchNotes()
    } catch (error) {
      console.error('Error toggling pin:', error)
    }
  }

  const openEditModal = (note: Note) => {
    setEditingNote(note)
    setFormData({
      title: note.title || '',
      content: note.content,
      color: note.color,
      pinned: note.pinned,
      author_id: note.author_id
    })
    setShowAddModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      color: NOTE_COLORS[0].color,
      pinned: false,
      author_id: null
    })
  }

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter(n => n.pinned)
  const unpinnedNotes = notes.filter(n => !n.pinned)

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-40 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-header">{t('notes.title')}</h1>
          <p className="page-subtitle">{t('notes.subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingNote(null); setShowAddModal(true) }} className="w-full sm:w-auto">
          <Plus className="w-5 h-5 mr-2" />
          {t('notes.addNote')}
        </Button>
      </div>

      {/* Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Pin className="w-5 h-5" />
            {t('notes.pinned')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => openEditModal(note)}
                onDelete={() => handleDeleteNote(note)}
                onTogglePin={() => togglePin(note)}
                getMember={getMember}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Notes */}
      <div>
        {pinnedNotes.length > 0 && unpinnedNotes.length > 0 && (
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            {t('notes.allNotes')}
          </h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {unpinnedNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => openEditModal(note)}
              onDelete={() => handleDeleteNote(note)}
              onTogglePin={() => togglePin(note)}
              getMember={getMember}
            />
          ))}
        </div>
      </div>

      {notes.length === 0 && (
        <Card className="text-center py-12">
          <StickyNote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{t('notes.noNotes')}</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{t('notes.noNotesHint')}</p>
          <Button onClick={() => { resetForm(); setShowAddModal(true) }}>
            <Plus className="w-5 h-5 mr-2" />
            {t('notes.createFirst')}
          </Button>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingNote(null); resetForm() }}
        title={editingNote ? t('notes.editNote') : t('notes.newNote')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('notes.titleOptional')}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('notes.titlePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('notes.content')}
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder={t('notes.contentPlaceholder')}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('notes.color')}
            </label>
            <div className="flex gap-2">
              {NOTE_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setFormData({ ...formData, color: c.color })}
                  className={`w-10 h-10 rounded-xl transition-all ${
                    formData.color === c.color ? 'ring-2 ring-sage-500 ring-offset-2 dark:ring-offset-slate-800' : ''
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('notes.from')}
              </label>
              <select
                value={formData.author_id || ''}
                onChange={(e) => setFormData({ ...formData, author_id: e.target.value || null })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              >
                <option value="">{t('notes.noAuthor')}</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  onClick={() => setFormData({ ...formData, pinned: !formData.pinned })}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    formData.pinned
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                  }`}
                >
                  <Pin className="w-5 h-5" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">{t('notes.pinToTop')}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingNote(null); resetForm() }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={editingNote ? handleEditNote : handleAddNote}>
              {editingNote ? t('common.saveChanges') : t('notes.addNote')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Note Card Component
function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  getMember
}: {
  note: Note
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
  getMember: (id: string | null) => any
}) {
  const author = getMember(note.author_id)

  return (
    <div
      className="p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group"
      style={{ backgroundColor: note.color }}
    >
      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onTogglePin}
          className={`p-1.5 rounded-lg ${
            note.pinned
              ? 'bg-amber-200/80 text-amber-700'
              : 'bg-white/50 text-slate-600 hover:bg-white/80'
          }`}
        >
          <Pin className="w-4 h-4" />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg bg-white/50 text-slate-600 hover:bg-white/80"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg bg-white/50 text-slate-600 hover:bg-coral-100 hover:text-coral-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Pinned indicator */}
      {note.pinned && (
        <Pin className="absolute top-2 left-2 w-4 h-4 text-amber-600" />
      )}

      {/* Content */}
      <div className="pt-2">
        {note.title && (
          <h3 className="font-semibold text-slate-800 mb-2">{note.title}</h3>
        )}
        <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
          {note.content}
        </p>
      </div>

      {/* Author */}
      {author && (
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: author.color }}
          >
            {author.name.charAt(0)}
          </div>
          <span className="text-xs text-slate-600">{author.name}</span>
        </div>
      )}
    </div>
  )
}
