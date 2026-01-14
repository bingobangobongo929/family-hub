'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, Edit2, Cake, X } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ContactMemberLink, { ContactMemberLinkDisplay } from '@/components/ContactMemberLink'
import PhotoUpload, { AvatarDisplay } from '@/components/PhotoUpload'
import { useContacts } from '@/lib/contacts-context'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'
import { Contact, RelationshipGroup, RELATIONSHIP_GROUPS, MEMBER_COLORS } from '@/lib/database.types'

export default function ContactsPage() {
  const { contacts, addContact, updateContact, deleteContact, getContactsByGroup, getUpcomingBirthdays, linkContactToMember, unlinkContactFromMember, getContactLinks } = useContacts()
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    date_of_birth: '',
    relationship_group: 'friends' as RelationshipGroup,
    notes: '',
    color: '#3b82f6',
    photo_url: null as string | null,
    avatar: '',
    show_birthday_countdown: false,
  })
  const [memberLinks, setMemberLinks] = useState<{ memberId: string; relationshipType: string }[]>([])

  const upcomingBirthdays = getUpcomingBirthdays(60)

  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      date_of_birth: '',
      relationship_group: 'friends',
      notes: '',
      color: '#3b82f6',
      photo_url: null,
      avatar: '',
      show_birthday_countdown: false,
    })
    setMemberLinks([])
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
      display_name: contact.display_name || '',
      date_of_birth: contact.date_of_birth || '',
      relationship_group: contact.relationship_group,
      notes: contact.notes || '',
      color: contact.color,
      photo_url: contact.photo_url || null,
      avatar: contact.avatar || '',
      show_birthday_countdown: contact.show_birthday_countdown || false,
    })
    // Load existing member links
    const existingLinks = getContactLinks(contact.id)
    setMemberLinks(existingLinks.map(l => ({ memberId: l.member_id, relationshipType: l.relationship_type })))
    setShowAddModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return

    const contactData = {
      name: formData.name.trim(),
      display_name: formData.display_name.trim() || null,
      date_of_birth: formData.date_of_birth || null,
      relationship_group: formData.relationship_group,
      notes: formData.notes.trim() || null,
      color: formData.color,
      photo_url: formData.photo_url,
      avatar: formData.avatar || null,
      show_birthday_countdown: formData.show_birthday_countdown,
    }

    let contactId: string

    if (editingContact) {
      await updateContact(editingContact.id, contactData)
      contactId = editingContact.id

      // Update member links - first get existing links
      const existingLinks = getContactLinks(contactId)

      // Remove links that are no longer present
      for (const existing of existingLinks) {
        if (!memberLinks.some(l => l.memberId === existing.member_id)) {
          await unlinkContactFromMember(contactId, existing.member_id)
        }
      }

      // Add or update links
      for (const link of memberLinks) {
        await linkContactToMember(contactId, link.memberId, link.relationshipType)
      }
    } else {
      const newContact = await addContact(contactData)
      if (newContact) {
        contactId = newContact.id
        // Add member links for new contact
        for (const link of memberLinks) {
          await linkContactToMember(contactId, link.memberId, link.relationshipType)
        }
      }
    }

    setShowAddModal(false)
    resetForm()
  }

  const handleDelete = async (id: string) => {
    if (confirm(t('contacts.confirmDelete'))) {
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
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{t('contacts.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('contacts.subtitle')}</p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="w-5 h-5" />
          {t('contacts.addContact')}
        </Button>
      </div>

      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Cake className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {t('contacts.upcomingBirthdays')}
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcomingBirthdays.slice(0, 6).map(contact => (
              <div
                key={contact.id}
                className="flex-shrink-0 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 min-w-[140px]"
              >
                <div className="mb-2">
                  <AvatarDisplay
                    photoUrl={contact.photo_url}
                    emoji={contact.avatar}
                    name={contact.name}
                    color={contact.color}
                    size="md"
                  />
                </div>
                <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                  {contact.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {contact.daysUntil === 0 ? t('common.today') : t('contacts.daysUntil', { count: contact.daysUntil })}
                </p>
                <p className="text-xs text-pink-600 dark:text-pink-400 font-medium">
                  {t('contacts.turningAge', { age: contact.age })}
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
                  {t(`relationships.${group.id}`)}
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
                    <AvatarDisplay
                      photoUrl={contact.photo_url}
                      emoji={contact.avatar}
                      name={contact.name}
                      color={contact.color}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {contact.name}
                        {contact.display_name && contact.display_name !== contact.name && (
                          <span className="ml-2 text-sm font-normal text-teal-600 dark:text-teal-400">
                            → {contact.display_name}
                          </span>
                        )}
                      </p>
                      {contact.date_of_birth && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          <Cake className="w-3 h-3 inline mr-1" />
                          {format(parseISO(contact.date_of_birth), 'd MMM', { locale: dateLocale })} ({t('contacts.yearsOld', { age: calculateAge(contact.date_of_birth) })})
                        </p>
                      )}
                      <ContactMemberLinkDisplay
                        links={getContactLinks(contact.id).map(l => ({ memberId: l.member_id, relationshipType: l.relationship_type }))}
                        className="mt-1"
                      />
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
            {t('contacts.noContactsYet')}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {t('contacts.noContactsDescription')}
          </p>
          <Button onClick={handleOpenAdd}>{t('contacts.addFirstContact')}</Button>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          resetForm()
        }}
        title={editingContact ? t('contacts.editContact') : t('contacts.addContact')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contacts.name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder={t('contacts.namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contacts.displayName')}
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder={t('contacts.displayNamePlaceholder')}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('contacts.displayNameHelp')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contacts.dateOfBirth')}
            </label>
            <input
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Birthday Countdown Toggle - only show if birthday is set */}
          {formData.date_of_birth && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-pink-50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-900/30">
              <div className="flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{t('contacts.showInCountdown')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('contacts.showInCountdownDescription')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, show_birthday_countdown: !formData.show_birthday_countdown })}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  formData.show_birthday_countdown ? 'bg-pink-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    formData.show_birthday_countdown ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contacts.relationship')}
            </label>
            <select
              value={formData.relationship_group}
              onChange={(e) => setFormData({ ...formData, relationship_group: e.target.value as RelationshipGroup })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              {RELATIONSHIP_GROUPS.map(group => (
                <option key={group.id} value={group.id}>
                  {group.emoji} {t(`relationships.${group.id}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contacts.color')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {MEMBER_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c.color })}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    formData.color === c.color ? 'scale-110 ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-500' : ''
                  }`}
                  style={{ backgroundColor: c.color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('contacts.avatar')}
            </label>
            <div className="flex justify-center">
              <PhotoUpload
                photoUrl={formData.photo_url}
                emoji={formData.avatar}
                name={formData.name || t('contacts.newContact')}
                color={formData.color}
                onPhotoChange={(url) => setFormData(prev => ({ ...prev, photo_url: url, avatar: url ? '' : prev.avatar }))}
                onEmojiChange={(emoji) => setFormData(prev => ({ ...prev, avatar: emoji, photo_url: emoji ? null : prev.photo_url }))}
                bucket="contact-photos"
                size="lg"
              />
            </div>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
              {t('contacts.avatarHelp')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contacts.notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              rows={2}
              placeholder={t('contacts.notesPlaceholder')}
            />
          </div>

          {/* Member Links */}
          <ContactMemberLink
            links={memberLinks}
            onChange={setMemberLinks}
            contactName={formData.name}
            onDisplayNameSuggestion={(suggested) => {
              // Only suggest if display_name is currently empty
              if (!formData.display_name) {
                setFormData(prev => ({ ...prev, display_name: suggested }))
              }
            }}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => {
              setShowAddModal(false)
              resetForm()
            }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              {editingContact ? t('common.saveChanges') : t('contacts.addContact')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
