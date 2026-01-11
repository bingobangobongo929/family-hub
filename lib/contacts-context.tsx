'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'
import { Contact, InsertContact, UpdateContact, RelationshipGroup, RELATIONSHIP_GROUPS, ContactMemberLink } from './database.types'

interface ContactsContextType {
  contacts: Contact[]
  loading: boolean
  refreshContacts: () => Promise<void>
  addContact: (contact: Omit<InsertContact, 'user_id'>) => Promise<Contact | null>
  updateContact: (id: string, updates: UpdateContact) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  getContactsByGroup: (group: RelationshipGroup) => Contact[]
  getUpcomingBirthdays: (days: number, groups?: RelationshipGroup[]) => ContactWithBirthday[]
  // New link methods
  linkContactToMember: (contactId: string, memberId: string, relationshipType: string) => Promise<void>
  unlinkContactFromMember: (contactId: string, memberId: string) => Promise<void>
  getContactsForMember: (memberId: string) => Contact[]
  getContactLinks: (contactId: string) => ContactMemberLink[]
}

export interface ContactWithBirthday extends Contact {
  nextBirthday: Date
  daysUntil: number
  age: number
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined)

// Demo contacts when not logged in
const DEMO_CONTACTS: Contact[] = [
  { id: 'demo-c1', user_id: 'demo', name: 'Grandma Rose', date_of_birth: '1955-03-15', relationship_group: 'grandparents', notes: null, color: '#ec4899', photo_url: null, avatar: null, created_at: '', updated_at: '' },
  { id: 'demo-c2', user_id: 'demo', name: 'Grandpa Joe', date_of_birth: '1952-07-22', relationship_group: 'grandparents', notes: null, color: '#3b82f6', photo_url: null, avatar: null, created_at: '', updated_at: '' },
  { id: 'demo-c3', user_id: 'demo', name: 'Uncle Tom', date_of_birth: '1980-11-08', relationship_group: 'aunts_uncles', notes: null, color: '#22c55e', photo_url: null, avatar: null, created_at: '', updated_at: '' },
  { id: 'demo-c4', user_id: 'demo', name: 'Aunt Sarah', date_of_birth: '1982-06-30', relationship_group: 'aunts_uncles', notes: null, color: '#f97316', photo_url: null, avatar: null, created_at: '', updated_at: '' },
  { id: 'demo-c5', user_id: 'demo', name: 'Cousin Emma', date_of_birth: '2015-09-12', relationship_group: 'cousins', notes: null, color: '#8b5cf6', photo_url: null, avatar: null, created_at: '', updated_at: '' },
  { id: 'demo-c6', user_id: 'demo', name: 'Best Friend Jake', date_of_birth: '2017-02-28', relationship_group: 'friends', notes: "Olivia's best friend from school", color: '#06b6d4', photo_url: null, avatar: null, created_at: '', updated_at: '' },
]

// Demo links
const DEMO_LINKS: ContactMemberLink[] = [
  { id: 'demo-l1', contact_id: 'demo-c1', member_id: 'demo-olivia', relationship_type: 'Mormor', created_at: '' },
  { id: 'demo-l2', contact_id: 'demo-c2', member_id: 'demo-olivia', relationship_type: 'Morfar', created_at: '' },
  { id: 'demo-l3', contact_id: 'demo-c1', member_id: 'demo-ellie', relationship_type: 'Mormor', created_at: '' },
  { id: 'demo-l4', contact_id: 'demo-c2', member_id: 'demo-ellie', relationship_type: 'Morfar', created_at: '' },
]

export function ContactsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactLinks, setContactLinks] = useState<ContactMemberLink[]>([])
  const [loading, setLoading] = useState(true)

  const fetchContactLinks = useCallback(async () => {
    if (!user) {
      setContactLinks(DEMO_LINKS)
      return
    }

    try {
      const { data, error } = await supabase
        .from('contact_member_links')
        .select('*')

      if (error) throw error
      setContactLinks((data as ContactMemberLink[]) || [])
    } catch (error) {
      console.error('Error fetching contact links:', error)
      setContactLinks([])
    }
  }, [user])

  const fetchContacts = useCallback(async () => {
    if (!user) {
      setContacts(DEMO_CONTACTS)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setContacts((data as Contact[]) || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
      setContacts(DEMO_CONTACTS)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchContacts()
    fetchContactLinks()
  }, [fetchContacts, fetchContactLinks])

  const refreshContacts = useCallback(async () => {
    await fetchContacts()
    await fetchContactLinks()
  }, [fetchContacts, fetchContactLinks])

  const addContact = useCallback(async (contact: Omit<InsertContact, 'user_id'>): Promise<Contact | null> => {
    if (!user) {
      // Demo mode - add locally
      const newContact: Contact = {
        id: `demo-contact-${Date.now()}`,
        user_id: 'demo',
        ...contact,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setContacts(prev => [...prev, newContact].sort((a, b) => a.name.localeCompare(b.name)))
      return newContact
    }

    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          ...contact,
        })
        .select()
        .single()

      if (error) throw error
      await fetchContacts()
      return data as Contact
    } catch (error) {
      console.error('Error adding contact:', error)
      return null
    }
  }, [user, fetchContacts])

  const updateContact = useCallback(async (id: string, updates: UpdateContact) => {
    if (!user) {
      // Demo mode - update locally
      setContacts(prev => prev.map(c =>
        c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
      ))
      return
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      await fetchContacts()
    } catch (error) {
      console.error('Error updating contact:', error)
    }
  }, [user, fetchContacts])

  const deleteContact = useCallback(async (id: string) => {
    if (!user) {
      // Demo mode - remove locally
      setContacts(prev => prev.filter(c => c.id !== id))
      return
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchContacts()
    } catch (error) {
      console.error('Error deleting contact:', error)
    }
  }, [user, fetchContacts])

  const getContactsByGroup = useCallback((group: RelationshipGroup) => {
    return contacts.filter(c => c.relationship_group === group)
  }, [contacts])

  const getUpcomingBirthdays = useCallback((days: number, groups?: RelationshipGroup[]): ContactWithBirthday[] => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const filteredContacts = groups
      ? contacts.filter(c => groups.includes(c.relationship_group))
      : contacts

    const withBirthdays: ContactWithBirthday[] = []

    for (const contact of filteredContacts) {
      if (!contact.date_of_birth) continue

      const dob = new Date(contact.date_of_birth)
      const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())

      // If birthday has passed this year, check next year
      let nextBirthday = thisYearBirthday
      if (thisYearBirthday < today) {
        nextBirthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate())
      }

      const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntil <= days) {
        const age = nextBirthday.getFullYear() - dob.getFullYear()
        withBirthdays.push({
          ...contact,
          nextBirthday,
          daysUntil,
          age,
        })
      }
    }

    // Sort by days until birthday
    return withBirthdays.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [contacts])

  // Link a contact to a family member with a relationship type
  const linkContactToMember = useCallback(async (contactId: string, memberId: string, relationshipType: string) => {
    if (!user) {
      // Demo mode - add locally
      const newLink: ContactMemberLink = {
        id: `demo-link-${Date.now()}`,
        contact_id: contactId,
        member_id: memberId,
        relationship_type: relationshipType,
        created_at: new Date().toISOString(),
      }
      setContactLinks(prev => [...prev.filter(l => !(l.contact_id === contactId && l.member_id === memberId)), newLink])
      return
    }

    try {
      // Upsert - update if exists, insert if not
      const { error } = await supabase
        .from('contact_member_links')
        .upsert({
          contact_id: contactId,
          member_id: memberId,
          relationship_type: relationshipType,
        }, {
          onConflict: 'contact_id,member_id',
        })

      if (error) throw error
      await fetchContactLinks()
    } catch (error) {
      console.error('Error linking contact to member:', error)
    }
  }, [user, fetchContactLinks])

  // Unlink a contact from a family member
  const unlinkContactFromMember = useCallback(async (contactId: string, memberId: string) => {
    if (!user) {
      // Demo mode - remove locally
      setContactLinks(prev => prev.filter(l => !(l.contact_id === contactId && l.member_id === memberId)))
      return
    }

    try {
      const { error } = await supabase
        .from('contact_member_links')
        .delete()
        .eq('contact_id', contactId)
        .eq('member_id', memberId)

      if (error) throw error
      await fetchContactLinks()
    } catch (error) {
      console.error('Error unlinking contact from member:', error)
    }
  }, [user, fetchContactLinks])

  // Get all contacts linked to a specific family member
  const getContactsForMember = useCallback((memberId: string) => {
    const memberLinks = contactLinks.filter(l => l.member_id === memberId)
    return contacts.filter(c => memberLinks.some(l => l.contact_id === c.id))
  }, [contacts, contactLinks])

  // Get all links for a specific contact
  const getContactLinks = useCallback((contactId: string): ContactMemberLink[] => {
    return contactLinks.filter(l => l.contact_id === contactId)
  }, [contactLinks])

  return (
    <ContactsContext.Provider value={{
      contacts,
      loading,
      refreshContacts,
      addContact,
      updateContact,
      deleteContact,
      getContactsByGroup,
      getUpcomingBirthdays,
      linkContactToMember,
      unlinkContactFromMember,
      getContactsForMember,
      getContactLinks,
    }}>
      {children}
    </ContactsContext.Provider>
  )
}

export function useContacts() {
  const context = useContext(ContactsContext)
  if (context === undefined) {
    throw new Error('useContacts must be used within a ContactsProvider')
  }
  return context
}
