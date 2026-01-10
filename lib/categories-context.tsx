'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'
import { EventCategory, InsertEventCategory, UpdateEventCategory, DEFAULT_EVENT_CATEGORIES } from './database.types'

interface CategoriesContextType {
  categories: EventCategory[]
  loading: boolean
  getCategory: (id: string | null) => EventCategory | undefined
  getCategoryByName: (name: string) => EventCategory | undefined
  refreshCategories: () => Promise<void>
  addCategory: (category: Omit<InsertEventCategory, 'user_id'>) => Promise<EventCategory | null>
  updateCategory: (id: string, updates: UpdateEventCategory) => Promise<void>
  archiveCategory: (id: string) => Promise<void>
  reorderCategories: (orderedIds: string[]) => Promise<void>
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined)

// Demo categories when not logged in
const DEMO_CATEGORIES: EventCategory[] = DEFAULT_EVENT_CATEGORIES.map((cat, index) => ({
  id: `demo-cat-${index}`,
  user_id: 'demo',
  name: cat.name,
  emoji: cat.emoji,
  color: cat.color,
  is_archived: false,
  sort_order: index,
  created_at: '',
  updated_at: '',
}))

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories(DEMO_CATEGORIES)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('event_categories')
        .select('*')
        .eq('is_archived', false)
        .order('sort_order', { ascending: true })

      if (error) throw error

      // If no categories exist, seed the defaults
      if (!data || data.length === 0) {
        await seedDefaultCategories()
        return
      }

      setCategories((data as EventCategory[]) || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      setCategories(DEMO_CATEGORIES)
    }
    setLoading(false)
  }, [user])

  const seedDefaultCategories = useCallback(async () => {
    if (!user) return

    try {
      const categoriesToInsert = DEFAULT_EVENT_CATEGORIES.map((cat, index) => ({
        user_id: user.id,
        name: cat.name,
        emoji: cat.emoji,
        color: cat.color,
        is_archived: false,
        sort_order: index,
      }))

      const { error } = await supabase
        .from('event_categories')
        .insert(categoriesToInsert)

      if (error) throw error

      // Refetch after seeding
      const { data } = await supabase
        .from('event_categories')
        .select('*')
        .eq('is_archived', false)
        .order('sort_order', { ascending: true })

      setCategories((data as EventCategory[]) || [])
    } catch (error) {
      console.error('Error seeding default categories:', error)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const getCategory = useCallback((id: string | null) => {
    if (!id) return undefined
    return categories.find(c => c.id === id)
  }, [categories])

  const getCategoryByName = useCallback((name: string) => {
    return categories.find(c => c.name.toLowerCase() === name.toLowerCase())
  }, [categories])

  const refreshCategories = useCallback(async () => {
    await fetchCategories()
  }, [fetchCategories])

  const addCategory = useCallback(async (category: Omit<InsertEventCategory, 'user_id'>): Promise<EventCategory | null> => {
    if (!user) {
      // Demo mode - add locally
      const newCat: EventCategory = {
        id: `demo-cat-${Date.now()}`,
        user_id: 'demo',
        ...category,
        is_archived: false,
        sort_order: categories.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setCategories(prev => [...prev, newCat])
      return newCat
    }

    try {
      const { data, error } = await supabase
        .from('event_categories')
        .insert({
          user_id: user.id,
          ...category,
          is_archived: false,
          sort_order: categories.length,
        })
        .select()
        .single()

      if (error) throw error
      await fetchCategories()
      return data as EventCategory
    } catch (error) {
      console.error('Error adding category:', error)
      return null
    }
  }, [user, categories.length, fetchCategories])

  const updateCategory = useCallback(async (id: string, updates: UpdateEventCategory) => {
    if (!user) {
      // Demo mode - update locally
      setCategories(prev => prev.map(c =>
        c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
      ))
      return
    }

    try {
      const { error } = await supabase
        .from('event_categories')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      await fetchCategories()
    } catch (error) {
      console.error('Error updating category:', error)
    }
  }, [user, fetchCategories])

  const archiveCategory = useCallback(async (id: string) => {
    if (!user) {
      // Demo mode - remove locally
      setCategories(prev => prev.filter(c => c.id !== id))
      return
    }

    try {
      const { error } = await supabase
        .from('event_categories')
        .update({ is_archived: true })
        .eq('id', id)

      if (error) throw error
      await fetchCategories()
    } catch (error) {
      console.error('Error archiving category:', error)
    }
  }, [user, fetchCategories])

  const reorderCategories = useCallback(async (orderedIds: string[]) => {
    if (!user) {
      // Demo mode - reorder locally
      const reordered = orderedIds.map((id, index) => {
        const cat = categories.find(c => c.id === id)
        return cat ? { ...cat, sort_order: index } : null
      }).filter(Boolean) as EventCategory[]
      setCategories(reordered)
      return
    }

    try {
      // Update each category's sort_order
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('event_categories')
          .update({ sort_order: index })
          .eq('id', id)
      )

      await Promise.all(updates)
      await fetchCategories()
    } catch (error) {
      console.error('Error reordering categories:', error)
    }
  }, [user, categories, fetchCategories])

  return (
    <CategoriesContext.Provider value={{
      categories,
      loading,
      getCategory,
      getCategoryByName,
      refreshCategories,
      addCategory,
      updateCategory,
      archiveCategory,
      reorderCategories
    }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  const context = useContext(CategoriesContext)
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoriesProvider')
  }
  return context
}
