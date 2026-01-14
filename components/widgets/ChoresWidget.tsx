'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckSquare, Check, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { Chore } from '@/lib/database.types'
import { useWidgetSize } from '@/lib/useWidgetSize'

// Demo chores
const DEMO_CHORES: Chore[] = [
  { id: '1', user_id: 'demo', title: 'Make bed', emoji: '🛏️', description: null, assigned_to: 'demo-olivia', points: 2, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'pending', category: 'bedroom', sort_order: 0, created_at: '', completed_at: null, completed_by: null, updated_at: '' },
  { id: '2', user_id: 'demo', title: 'Brush teeth', emoji: '🪥', description: null, assigned_to: 'demo-olivia', points: 1, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'completed', category: 'health', sort_order: 1, created_at: '', completed_at: new Date().toISOString(), completed_by: 'demo-olivia', updated_at: '' },
  { id: '3', user_id: 'demo', title: 'Tidy toys', emoji: '🧸', description: null, assigned_to: 'demo-olivia', points: 3, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'pending', category: 'tidying', sort_order: 2, created_at: '', completed_at: null, completed_by: null, updated_at: '' },
  { id: '4', user_id: 'demo', title: 'Help set table', emoji: '🍽️', description: null, assigned_to: 'demo-olivia', points: 2, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'pending', category: 'meals', sort_order: 3, created_at: '', completed_at: null, completed_by: null, updated_at: '' },
  { id: '5', user_id: 'demo', title: 'Put shoes away', emoji: '👟', description: null, assigned_to: 'demo-ellie', points: 1, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'pending', category: 'tidying', sort_order: 4, created_at: '', completed_at: null, completed_by: null, updated_at: '' },
  { id: '6', user_id: 'demo', title: 'Water plants', emoji: '🌱', description: null, assigned_to: 'demo-olivia', points: 2, due_date: null, due_time: null, repeat_frequency: 'daily', repeat_interval: 1, repeat_days: null, status: 'pending', category: 'garden', sort_order: 5, created_at: '', completed_at: null, completed_by: null, updated_at: '' },
]

export default function ChoresWidget() {
  const { user } = useAuth()
  const { getMember, updateMemberPoints } = useFamily()
  const { rewardsEnabled } = useSettings()
  const { t } = useTranslation()
  const [chores, setChores] = useState<Chore[]>([])
  const [ref, { size, isWide }] = useWidgetSize()

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
        .limit(10)

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

    if (chore.assigned_to) {
      await updateMemberPoints(chore.assigned_to, pointDelta)
    }

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
  const completedChores = chores.filter(c => c.status === 'completed')
  const completedCount = completedChores.length

  // Number of chores to show based on size
  const maxChores = {
    small: 3,
    medium: 4,
    large: 6,
    xlarge: 8,
  }[size]

  const showCompleted = size === 'large' || size === 'xlarge'
  const compactMode = size === 'small'

  // Points available
  const totalPoints = pendingChores.reduce((sum, c) => sum + c.points, 0)

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-teal-500" />
          <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">{t('chores.title')}</h3>
        </div>
        <div className="flex items-center gap-2">
          {rewardsEnabled && (size === 'medium' || size === 'large' || size === 'xlarge') && totalPoints > 0 && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3" />
              {totalPoints}
            </span>
          )}
          <span className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">
            {completedCount}/{chores.length}
          </span>
        </div>
      </div>

      {/* Wide layout - show in columns */}
      {isWide && (size === 'large' || size === 'xlarge') ? (
        <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">
          {/* Pending column */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('chores.toDo')}</p>
            {pendingChores.slice(0, Math.ceil(maxChores / 2)).map(chore => (
              <ChoreItem
                key={chore.id}
                chore={chore}
                compact={false}
                getMember={getMember}
                onToggle={toggleChore}
                showPoints={rewardsEnabled}
              />
            ))}
          </div>
          {/* Completed column */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mb-1">{t('chores.done')}</p>
            {completedChores.slice(0, Math.ceil(maxChores / 2)).map(chore => (
              <ChoreItem
                key={chore.id}
                chore={chore}
                compact={false}
                getMember={getMember}
                onToggle={toggleChore}
                completed
                showPoints={rewardsEnabled}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className={`flex-1 space-y-${compactMode ? '1' : '2'} overflow-hidden`}>
          {pendingChores.slice(0, maxChores).map(chore => (
            <ChoreItem
              key={chore.id}
              chore={chore}
              compact={compactMode}
              getMember={getMember}
              onToggle={toggleChore}
              showPoints={rewardsEnabled}
            />
          ))}

          {pendingChores.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
              <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-2">
                <Check className="w-6 h-6 text-teal-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('chores.allDone')}</p>
            </div>
          )}

          {pendingChores.length > maxChores && (
            <p className="text-xs text-teal-600 dark:text-teal-400 text-center pt-1 font-medium">
              {t('common.more', { count: pendingChores.length - maxChores })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ChoreItem({
  chore,
  compact,
  getMember,
  onToggle,
  completed = false,
  showPoints = true
}: {
  chore: Chore
  compact: boolean
  getMember: (id: string | null) => any
  onToggle: (chore: Chore) => void
  completed?: boolean
  showPoints?: boolean
}) {
  const member = getMember(chore.assigned_to)

  return (
    <button
      onClick={() => onToggle(chore)}
      className={`w-full flex items-center gap-3 ${compact ? 'py-1.5 px-2' : 'p-2.5'} rounded-xl ${
        completed
          ? 'bg-teal-50 dark:bg-teal-900/20'
          : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700'
      } transition-colors text-left`}
    >
      <span className={`${compact ? 'text-base' : 'text-lg'} ${completed ? 'opacity-50' : ''}`}>
        {completed ? '✓' : chore.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${compact ? 'text-xs' : 'text-sm'} ${
          completed
            ? 'text-slate-500 dark:text-slate-400 line-through'
            : 'text-slate-800 dark:text-slate-100'
        } truncate`}>
          {chore.title}
        </p>
      </div>
      {member && (
        <div
          className={`${compact ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'} rounded-full flex items-center justify-center text-white font-medium ring-2 ring-white dark:ring-slate-700`}
          style={{ backgroundColor: member.color }}
        >
          {member.name.charAt(0)}
        </div>
      )}
      {showPoints && !completed && (
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-amber-600 dark:text-amber-400`}>
          +{chore.points}
        </span>
      )}
    </button>
  )
}
