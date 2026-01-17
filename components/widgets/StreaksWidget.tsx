'use client'

import { useState, useEffect, useCallback } from 'react'
import { Flame, Trophy, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useTranslation } from '@/lib/i18n-context'
import { MemberStreak, Routine } from '@/lib/database.types'

interface StreakWithDetails extends MemberStreak {
  routine?: Routine
}

export default function StreaksWidget() {
  const { user } = useAuth()
  const { members } = useFamily()
  const { t } = useTranslation()
  const [streaks, setStreaks] = useState<StreakWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStreaks = useCallback(async () => {
    if (!user) {
      setStreaks([])
      setLoading(false)
      return
    }

    try {
      // Get all streaks with routine details
      const { data, error } = await supabase
        .from('member_streaks')
        .select(`
          *,
          routine:routines(id, title, emoji, type)
        `)
        .gt('current_streak', 0)
        .order('current_streak', { ascending: false })

      if (error) throw error
      setStreaks(data || [])
    } catch (error) {
      console.error('Error fetching streaks:', error)
      setStreaks([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchStreaks()
  }, [fetchStreaks])

  const getMember = (id: string) => members.find(m => m.id === id)

  // Group streaks by member
  const memberStreaks = members
    .filter(m => m.role === 'child')
    .map(member => ({
      member,
      streaks: streaks.filter(s => s.member_id === member.id)
    }))
    .filter(ms => ms.streaks.length > 0)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
        <div className="animate-pulse">
          <Flame className="w-8 h-8 text-orange-300 dark:text-orange-700" />
        </div>
      </div>
    )
  }

  if (memberStreaks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark text-center">
        <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm text-slate-400 dark:text-slate-500">{t('streaks.noStreaks') || 'No active streaks'}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('streaks.completeRoutines') || 'Complete routines daily to build streaks!'}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-orange-500" />
        <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">{t('streaks.title') || 'Streaks'}</h3>
      </div>

      <div className="flex-1 space-y-3 overflow-auto">
        {memberStreaks.map(({ member, streaks: memberStreakList }) => (
          <div key={member.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: member.color }}
              >
                {member.avatar || member.name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{member.name}</span>
            </div>

            <div className="pl-8 space-y-1">
              {memberStreakList.map(streak => (
                <div
                  key={streak.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span>{streak.routine?.emoji || '📋'}</span>
                  <span className="flex-1 text-slate-600 dark:text-slate-300 truncate">
                    {streak.routine?.title || 'Routine'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Flame className={`w-4 h-4 ${
                      streak.current_streak >= 7
                        ? 'text-red-500 animate-pulse'
                        : streak.current_streak >= 3
                        ? 'text-orange-500'
                        : 'text-amber-500'
                    }`} />
                    <span className={`font-bold ${
                      streak.current_streak >= 7
                        ? 'text-red-600 dark:text-red-400'
                        : streak.current_streak >= 3
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {streak.current_streak}
                    </span>
                  </div>
                  {streak.current_streak >= streak.longest_streak && streak.current_streak > 1 && (
                    <span title="Personal best!">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
