'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'
import { FamilyMember } from './database.types'

interface FamilyContextType {
  members: FamilyMember[]
  loading: boolean
  getMember: (id: string | null) => FamilyMember | undefined
  refreshMembers: () => Promise<void>
  updateMemberPoints: (memberId: string, points: number) => Promise<void>
  updateMemberPhoto: (memberId: string, photoUrl: string | null) => Promise<void>
  updateMemberEmoji: (memberId: string, emoji: string) => Promise<void>
  reorderMembers: (memberId: string, direction: 'up' | 'down') => Promise<void>
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined)

// Demo family members when not logged in
const DEMO_MEMBERS: FamilyMember[] = [
  { id: 'demo-dad', user_id: 'demo', name: 'Dad', color: '#3b82f6', role: 'parent', avatar: null, photo_url: null, date_of_birth: '1985-06-15', aliases: [], description: null, points: 0, sort_order: 0, created_at: '', updated_at: '' },
  { id: 'demo-mum', user_id: 'demo', name: 'Mum', color: '#ec4899', role: 'parent', avatar: null, photo_url: null, date_of_birth: '1987-03-22', aliases: [], description: null, points: 0, sort_order: 1, created_at: '', updated_at: '' },
  { id: 'demo-olivia', user_id: 'demo', name: 'Olivia', color: '#8b5cf6', role: 'child', avatar: null, photo_url: null, date_of_birth: '2017-09-10', aliases: [], description: null, points: 47, sort_order: 2, created_at: '', updated_at: '' },
  { id: 'demo-ellie', user_id: 'demo', name: 'Ellie', color: '#22c55e', role: 'child', avatar: null, photo_url: null, date_of_birth: '2020-01-28', aliases: [], description: null, points: 23, sort_order: 3, created_at: '', updated_at: '' },
]

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    if (!user) {
      setMembers(DEMO_MEMBERS)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setMembers((data as FamilyMember[]) || [])
    } catch (error) {
      console.error('Error fetching family members:', error)
      setMembers(DEMO_MEMBERS)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const getMember = useCallback((id: string | null) => {
    if (!id) return undefined
    return members.find(m => m.id === id)
  }, [members])

  const refreshMembers = useCallback(async () => {
    await fetchMembers()
  }, [fetchMembers])

  const updateMemberPoints = useCallback(async (memberId: string, points: number) => {
    if (!user) {
      // Demo mode - update locally
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, points: m.points + points } : m
      ))
      return
    }

    const member = members.find(m => m.id === memberId)
    if (!member) return

    try {
      const { error } = await supabase
        .from('family_members')
        .update({ points: member.points + points })
        .eq('id', memberId)

      if (error) throw error
      await fetchMembers()
    } catch (error) {
      console.error('Error updating points:', error)
    }
  }, [user, members, fetchMembers])

  const updateMemberPhoto = useCallback(async (memberId: string, photoUrl: string | null) => {
    if (!user) {
      // Demo mode - update locally
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, photo_url: photoUrl, avatar: photoUrl ? null : m.avatar } : m
      ))
      return
    }

    try {
      const { error } = await supabase
        .from('family_members')
        .update({ photo_url: photoUrl, avatar: photoUrl ? null : undefined })
        .eq('id', memberId)

      if (error) throw error
      await fetchMembers()
    } catch (error) {
      console.error('Error updating photo:', error)
    }
  }, [user, fetchMembers])

  const updateMemberEmoji = useCallback(async (memberId: string, emoji: string) => {
    if (!user) {
      // Demo mode - update locally
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, avatar: emoji, photo_url: emoji ? null : m.photo_url } : m
      ))
      return
    }

    try {
      const { error } = await supabase
        .from('family_members')
        .update({ avatar: emoji, photo_url: emoji ? null : undefined })
        .eq('id', memberId)

      if (error) throw error
      await fetchMembers()
    } catch (error) {
      console.error('Error updating emoji:', error)
    }
  }, [user, fetchMembers])

  const reorderMembers = useCallback(async (memberId: string, direction: 'up' | 'down') => {
    const currentIndex = members.findIndex(m => m.id === memberId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= members.length) return

    const currentMember = members[currentIndex]
    const targetMember = members[targetIndex]

    if (!user) {
      // Demo mode - update locally
      setMembers(prev => {
        const newMembers = [...prev]
        newMembers[currentIndex] = { ...targetMember, sort_order: currentMember.sort_order }
        newMembers[targetIndex] = { ...currentMember, sort_order: targetMember.sort_order }
        return newMembers.sort((a, b) => a.sort_order - b.sort_order)
      })
      return
    }

    try {
      // Swap sort_order values in database
      await Promise.all([
        supabase
          .from('family_members')
          .update({ sort_order: targetMember.sort_order })
          .eq('id', currentMember.id),
        supabase
          .from('family_members')
          .update({ sort_order: currentMember.sort_order })
          .eq('id', targetMember.id)
      ])
      await fetchMembers()
    } catch (error) {
      console.error('Error reordering members:', error)
    }
  }, [user, members, fetchMembers])

  return (
    <FamilyContext.Provider value={{ members, loading, getMember, refreshMembers, updateMemberPoints, updateMemberPhoto, updateMemberEmoji, reorderMembers }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  const context = useContext(FamilyContext)
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider')
  }
  return context
}
