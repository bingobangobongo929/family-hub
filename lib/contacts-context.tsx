'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'
import { Contact, InsertContact, UpdateContact, RelationshipGroup, RELATIONSHIP_GROUPS } from './database.types'

interface ContactsContextType {
  contacts: Contact[]
  loading: boolean
  refreshContacts: () => Promise<void>
  addContact: (contact: Omit<InsertContact, 'user_id'>) => Promise<Contact | null>
  updateContact: (id: string, updates: UpdateContact) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  getContactsByGroup: (group: RelationshipGroup) => Contact[]
  getUpcomingBirthdays: (days: number, groups?: RelationshipGroup[]) => ContactWithBirthday[]
}

export interface ContactWithBirthday extends Contact {
  nextBirthday: Date
  daysUntil: number
  age: number
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined)

// Demo contacts when not logged in
const DEMO_CONTACTS: Contact[] = [
  { id: 'demo-c1', user_id: 'demo', name: 'Grandma Rose', date_of_birth: '1955-03-15', relationship_group: 'grandparents', notes: null, color: '#ec4899', created_at: '', updated_at: '' },
  { id: 'demo-c2', user_id: 'demo', name: 'Grandpa Joe', date_of_birth: '1952-07-22', relationship_group: 'grandparents', notes: null, color: '#3b82f6', created_at: '', updated_at: '' },
  { id: 'demo-c3', user_id: 'demo', name: 'Uncle Tom', date_of_birth: '1980-11-08', relationship_group: 'aunts_uncles', notes: null, color: '#22c55e', created_at: '', updated_at: '' },
  { id: 'demo-c4', user_id: 'demo', name: 'Aunt Sarah', date_of_birth: '1982-06-30', relationship_group: 'aunts_uncles', notes: null, color: '#f97316', created_at: '', updated_at: '' },
  { id: 'demo-c5', user_id: 'demo', name: 'Cousin Emma', date_of_birth: '2015-09-12', relationship_group: 'cousins', notes: null, color: '#8b5cf6', created_at: '', updated_at: '' },
  { id: 'demo-c6', user_id: 'demo', name: 'Best Friend Jake', date_of_birth: '2017-02-28', relationship_group: 'friends', notes: "Olivia's best friend from school", color: '#06b6d4', created_at: '', updated_at: '' },
]

export function ContactsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

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
  }, [fetchContacts])

  const refreshContacts = useCallback(async () => {
    await fetchContacts()
  }, [fetchContacts])

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
