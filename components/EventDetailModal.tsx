'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { Clock, MapPin, Trash2, Users, Repeat, Pencil, X, UserPlus, Calendar } from 'lucide-react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useFamily } from '@/lib/family-context'
import { useCategories } from '@/lib/categories-context'
import { useContacts } from '@/lib/contacts-context'
import { CalendarEvent, MEMBER_COLORS, RecurrencePattern } from '@/lib/database.types'
import { CategoryPill } from '@/components/CategorySelector'
import CategorySelector from '@/components/CategorySelector'
import MemberAvatarStack from '@/components/MemberAvatarStack'
import MemberMultiSelect from '@/components/MemberMultiSelect'
import RecurrenceSelector from '@/components/RecurrenceSelector'
import { patternToRRule, rruleToPattern, describeRecurrence } from '@/lib/rrule'

interface EventDetailModalProps {
  event: CalendarEvent | null
  eventMembers?: string[] // member IDs for this event
  eventContacts?: string[] // contact IDs for this event
  isOpen: boolean
  onClose: () => void
  onDelete: (eventId: string) => void
  onUpdate?: (eventId: string, updates: Partial<CalendarEvent>, memberIds?: string[], contactIds?: string[]) => void
}

export default function EventDetailModal({
  event,
  eventMembers = [],
  eventContacts = [],
  isOpen,
  onClose,
  onDelete,
  onUpdate,
}: EventDetailModalProps) {
  const { members, getMember } = useFamily()
  const { categories, getCategory } = useCategories()
  const { contacts } = useContacts()
  const [isEditing, setIsEditing] = useState(false)
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
    contact_ids: [] as string[],
    category_id: null as string | null,
    location: '',
    is_recurring: false,
    recurrence_pattern: null as RecurrencePattern | null,
  })

  // Populate form when event changes or editing starts
  useEffect(() => {
    if (event && isEditing) {
      const startDate = parseISO(event.start_time)
      const endDate = event.end_time ? parseISO(event.end_time) : null

      let recurrencePattern: RecurrencePattern | null = null
      if (event.recurrence_rule) {
        recurrencePattern = rruleToPattern(event.recurrence_rule)
      }

      setFormData({
        title: event.title,
        description: event.description || '',
        start_date: format(startDate, 'yyyy-MM-dd'),
        start_time: format(startDate, 'HH:mm'),
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : format(startDate, 'yyyy-MM-dd'),
        end_time: endDate ? format(endDate, 'HH:mm') : '',
        all_day: event.all_day,
        color: event.color || '#3b82f6',
        member_ids: eventMembers,
        contact_ids: eventContacts,
        category_id: event.category_id,
        location: event.location || '',
        is_recurring: !!event.recurrence_rule,
        recurrence_pattern: recurrencePattern,
      })
    }
  }, [event, isEditing, eventMembers, eventContacts])

  // Reset editing state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false)
    }
  }, [isOpen])

  const handleSave = () => {
    if (!event || !onUpdate) return

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

    const updates: Partial<CalendarEvent> = {
      title: formData.title,
      description: formData.description || null,
      start_time: new Date(startDateTime).toISOString(),
      end_time: endDateTime ? new Date(endDateTime).toISOString() : null,
      all_day: formData.all_day,
      color: formData.color,
      category_id: formData.category_id,
      location: formData.location || null,
      recurrence_rule: recurrenceRule,
    }

    onUpdate(event.id, updates, formData.member_ids, formData.contact_ids)
    setIsEditing(false)
  }

  if (!event) return null

  const category = event.category_id ? getCategory(event.category_id) : null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Event' : 'Event Details'} size="lg">
      {isEditing ? (
        // Edit Mode
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
              id="edit_all_day"
              checked={formData.all_day}
              onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-sage-500 focus:ring-sage-500"
            />
            <label htmlFor="edit_all_day" className="text-sm text-slate-700 dark:text-slate-300">
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
                const cat = categories.find(c => c.id === categoryId)
                setFormData({
                  ...formData,
                  category_id: categoryId,
                  color: (formData.member_ids.length === 0 && cat) ? cat.color : formData.color
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

          {/* Contacts */}
          {contacts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <UserPlus className="w-4 h-4 inline mr-1" />
                Contacts (Extended Family/Friends)
              </label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                {contacts.map(contact => {
                  const isSelected = formData.contact_ids.includes(contact.id)
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => {
                        const newIds = isSelected
                          ? formData.contact_ids.filter(id => id !== contact.id)
                          : [...formData.contact_ids, contact.id]
                        setFormData({ ...formData, contact_ids: newIds })
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? 'text-white'
                          : 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-500'
                      }`}
                      style={isSelected ? { backgroundColor: contact.color || '#6b7280' } : undefined}
                      title={contact.display_name && contact.display_name !== contact.name ? contact.name : undefined}
                    >
                      {contact.display_name || contact.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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

          <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.title.trim()}>
              Save Changes
            </Button>
          </div>
        </div>
      ) : (
        // View Mode
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: event.color }}
            />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {event.title}
              </h3>
              {category && (
                <CategoryPill categoryId={event.category_id!} className="mt-1" />
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Clock className="w-4 h-4" />
              <span>
                {format(parseISO(event.start_time), 'EEEE, MMMM d, yyyy')}
                {!event.all_day && (
                  <> at {format(parseISO(event.start_time), 'h:mm a')}</>
                )}
                {event.end_time && (
                  <> - {format(parseISO(event.end_time), 'h:mm a')}</>
                )}
              </span>
            </div>

            {event.recurrence_rule && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Repeat className="w-4 h-4" />
                <span>
                  {(() => {
                    const pattern = rruleToPattern(event.recurrence_rule)
                    return pattern ? describeRecurrence(pattern) : 'Repeating'
                  })()}
                </span>
              </div>
            )}

            {event.location && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <MapPin className="w-4 h-4" />
                <span>{event.location}</span>
              </div>
            )}

            {eventMembers.length > 0 && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Users className="w-4 h-4" />
                <MemberAvatarStack memberIds={eventMembers} size="sm" />
                <span className="text-xs text-slate-500">
                  {eventMembers.map(id => getMember(id)?.name).filter(Boolean).join(', ')}
                </span>
              </div>
            )}

            {eventContacts.length > 0 && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <UserPlus className="w-4 h-4" />
                <div className="flex flex-wrap gap-1">
                  {eventContacts.map(id => {
                    const contact = contacts.find(c => c.id === id)
                    if (!contact) return null
                    return (
                      <span
                        key={id}
                        className="px-2 py-0.5 rounded-full text-xs text-white"
                        style={{ backgroundColor: contact.color || '#6b7280' }}
                        title={contact.display_name && contact.display_name !== contact.name ? contact.name : undefined}
                      >
                        {contact.display_name || contact.name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {event.description && (
              <p className="text-slate-600 dark:text-slate-300 pt-2">
                {event.description}
              </p>
            )}
          </div>

          <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(event.id)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Link href="/calendar">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Calendar
                </Button>
              </Link>
              {onUpdate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
