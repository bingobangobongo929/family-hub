'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckSquare, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { Chore } from '@/lib/database.types'

// Demo chores
const DEMO_CHORES: Chore[] = [
  { id: '1', user_id: 'demo', title: 'Make bed', emoji: '🛏️', description: null, assigned_to: 'demo-olivia', points: 2, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'pending', category: 'bedroom', sort_order: 0, created_at: '', completed_at: null, completed_by: null, updated_at: '' },
  { id: '2', user_id: 'demo', title: 'Brush teeth', emoji: '🪥', description: null, assigned_to: 'demo-olivia', points: 1, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'completed', category: 'health', sort_order: 1, created_at: '', completed_at: new Date().toISOString(), completed_by: 'demo-olivia', updated_at: '' },
  { id: '3', user_id: 'demo', title: 'Tidy toys', emoji: '🧸', description: null, assigned_to: 'demo-olivia', points: 3, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'pending', category: 'tidying', sort_order: 2, created_at: '', completed_at: null, completed_by: null, updated_at: '' },
  { id: '4', user_id: 'demo', title: 'Help set table', emoji: '🍽️', description: null, assigned_to: 'demo-olivia', points: 2, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'pending', category: 'meals', sort_order: 3, created_at: '', completed_at: null, completed_by: null, updated_at: '' },
]

export default function ChoresWidget() {
  const { user } = useAuth()
  const { getMember, updateMemberPoints } = useFamily()
  const [chores, setChores] = useState<Chore[]>([])

  const fetchChores = useCallback(async () => {
    if (!user) {
      setChores(DEMO_CHORES)
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('chores')
        .select('*')
        .or(`due_date.is.null,due_date.eq.${today}`)
        .order('status', { ascending: true })
        .order('sort_order', { ascending: true })
        .limit(5)

      if (data) {
        setChores(data)
      }
    } catch (error) {
      console.error('Error fetching chores:', error)
      setChores(DEMO_CHORES)
    }
  }, [user])

  useEffect(() => {
    fetchChores()
  }, [fetchChores])

  const toggleChore = async (chore: Chore) => {
    const newStatus = chore.status === 'completed' ? 'pending' : 'completed'
    const pointDelta = newStatus === 'completed' ? chore.points : -chore.points

    // Update member points
    if (chore.assigned_to) {
      await updateMemberPoints(chore.assigned_to, pointDelta)
    }

    // Update chore status
    if (!user) {
      setChores(chores.map(c =>
        c.id === chore.id
          ? { ...c, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }
          : c
      ))
      return
    }

    try {
      await supabase
        .from('chores')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          completed_by: newStatus === 'completed' ? chore.assigned_to : null
        })
        .eq('id', chore.id)

      await fetchChores()
    } catch (error) {
      console.error('Error updating chore:', error)
    }
  }

  const pendingChores = chores.filter(c => c.status === 'pending')
  const completedCount = chores.filter(c => c.status === 'completed').length

  return (
    <div className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-sage-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Chores</h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {completedCount}/{chores.length} done
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-hidden">
        {pendingChores.slice(0, 4).map(chore => {
          const member = getMember(chore.assigned_to)

          return (
            <button
              key={chore.id}
              onClick={() => toggleChore(chore)}
              className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
            >
              <span className="text-lg">{chore.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-100 truncate">
                  {chore.title}
                </p>
              </div>
              {member && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]"
                  style={{ backgroundColor: member.color }}
                >
                  {member.name.charAt(0)}
                </div>
              )}
              <span className="text-xs text-amber-600 dark:text-amber-400">+{chore.points}</span>
            </button>
          )
        })}

        {pendingChores.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Check className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">All done!</p>
          </div>
        )}
      </div>
    </div>
  )
}
