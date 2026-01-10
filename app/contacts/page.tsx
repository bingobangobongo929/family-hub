'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, Edit2, Cake, X } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useContacts } from '@/lib/contacts-context'
import { Contact, RelationshipGroup, RELATIONSHIP_GROUPS, MEMBER_COLORS } from '@/lib/database.types'

export default function ContactsPage() {
  const { contacts, addContact, updateContact, deleteContact, getContactsByGroup, getUpcomingBirthdays } = useContacts()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    date_of_birth: '',
    relationship_group: 'friends' as RelationshipGroup,
    notes: '',
    color: '#3b82f6',
  })

  const upcomingBirthdays = getUpcomingBirthdays(60)

  const resetForm = () => {
    setFormData({
      name: '',
      date_of_birth: '',
      relationship_group: 'friends',
      notes: '',
      color: '#3b82f6',
    })
    setEditingContact(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact)
    setFormData({
      name: contact.name,
      date_of_birth: contact.date_of_birth || '',
      relationship_group: contact.relationship_group,
      notes: contact.notes || '',
      color: contact.color,
    })
    setShowAddModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return

    const contactData = {
      name: formData.name.trim(),
      date_of_birth: formData.date_of_birth || null,
      relationship_group: formData.relationship_group,
      notes: formData.notes.trim() || null,
      color: formData.color,
    }

    if (editingContact) {
      await updateContact(editingContact.id, contactData)
    } else {
      await addContact(contactData)
    }

    setShowAddModal(false)
    resetForm()
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      await deleteContact(id)
    }
  }

  const calculateAge = (dob: string) => {
    const birthDate = parseISO(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Contacts</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage birthdays and contacts</p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="w-5 h-5" />
          Add Contact
        </Button>
      </div>

      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Cake className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Upcoming Birthdays
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcomingBirthdays.slice(0, 6).map(contact => (
              <div
                key={contact.id}
                className="flex-shrink-0 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 min-w-[140px]"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold mb-2"
                  style={{ backgroundColor: contact.color }}
                >
                  {contact.name[0]}
                </div>
                <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                  {contact.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {contact.daysUntil === 0 ? 'Today!' : `${contact.daysUntil} days`}
                </p>
                <p className="text-xs text-pink-600 dark:text-pink-400 font-medium">
                  Turning {contact.age}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Contacts by Group */}
      <div className="space-y-6">
        {RELATIONSHIP_GROUPS.map(group => {
          const groupContacts = getContactsByGroup(group.id)
          if (groupContacts.length === 0) return null

          return (
            <Card key={group.id}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{group.emoji}</span>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {group.label}
                </h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  ({groupContacts.length})
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {groupContacts.map(contact => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                      style={{ backgroundColor: contact.color }}
                    >
                      {contact.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {contact.name}
                      </p>
                      {contact.date_of_birth && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          <Cake className="w-3 h-3 inline mr-1" />
                          {format(parseISO(contact.date_of_birth), 'MMM d')} ({calculateAge(contact.date_of_birth)} yrs)
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(contact)}
                        className="p-2 rounded-lg text-slate-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {contacts.length === 0 && (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Cake className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
            No contacts yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Add contacts to track birthdays and important dates
          </p>
          <Button onClick={handleOpenAdd}>Add your first contact</Button>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          resetForm()
        }}
        title={editingContact ? 'Edit Contact' : 'Add Contact'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Contact name..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Relationship
            </label>
            <select
              value={formData.relationship_group}
              onChange={(e) => setFormData({ ...formData, relationship_group: e.target.value as RelationshipGroup })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              {RELATIONSHIP_GROUPS.map(group => (
                <option key={group.id} value={group.id}>
                  {group.emoji} {group.label}
                </option>
              ))}
            </select>
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
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              rows={2}
              placeholder="Any notes about this contact..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => {
              setShowAddModal(false)
              resetForm()
            }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              {editingContact ? 'Save Changes' : 'Add Contact'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
