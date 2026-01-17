'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Flame, Trophy, Star, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import Card from '@/components/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useTranslation } from '@/lib/i18n-context'
import { MemberStreak, RoutineCompletionLog, PointsHistory, Routine } from '@/lib/database.types'
import { AvatarDisplay } from '@/components/PhotoUpload'

interface StreakWithRoutine extends MemberStreak {
  routine?: Routine
}

interface PointsWithDetails extends PointsHistory {
  routine?: { title: string, emoji: string }
  chore?: { title: string, emoji: string }
  reward?: { title: string, emoji: string }
}

export default function HistoryPage() {
  const { user } = useAuth()
  const { members } = useFamily()
  const { t, locale } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [completionsByDate, setCompletionsByDate] = useState<Record<string, RoutineCompletionLog[]>>({})
  const [streaks, setStreaks] = useState<StreakWithRoutine[]>([])
  const [pointsHistory, setPointsHistory] = useState<PointsWithDetails[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [selectedMember, setSelectedMember] = useState<string | 'all'>('all')

  const children = members.filter(m => m.role === 'child')

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // Get month range
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      const startStr = startOfMonth.toISOString().split('T')[0]
      const endStr = endOfMonth.toISOString().split('T')[0]

      // Fetch completions for the month
      const { data: completions } = await supabase
        .from('routine_completion_log')
        .select('*')
        .gte('completed_date', startStr)
        .lte('completed_date', endStr)
        .eq('action', 'completed')
        .order('completed_at', { ascending: false })

      // Group by date
      const byDate: Record<string, RoutineCompletionLog[]> = {}
      for (const c of completions || []) {
        if (!byDate[c.completed_date]) {
          byDate[c.completed_date] = []
        }
        byDate[c.completed_date].push(c)
      }
      setCompletionsByDate(byDate)

      // Fetch streaks
      const { data: streakData } = await supabase
        .from('member_streaks')
        .select(`
          *,
          routine:routines(id, title, emoji, type)
        `)
        .order('current_streak', { ascending: false })

      setStreaks(streakData || [])

      // Fetch routines
      const { data: routineData } = await supabase
        .from('routines')
        .select('*')
        .eq('is_active', true)

      setRoutines(routineData || [])

      // Fetch points history
      const { data: pointsData } = await supabase
        .from('points_history')
        .select('*')
        .gte('created_at', startStr)
        .lte('created_at', endStr + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(50)

      setPointsHistory(pointsData || [])
    } catch (error) {
      console.error('Error fetching history:', error)
    }
    setLoading(false)
  }, [user, currentMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getMember = (id: string) => members.find(m => m.id === id)

  // Calendar helpers
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const today = new Date().toISOString().split('T')[0]

  const getDayStatus = (date: string) => {
    const completions = completionsByDate[date] || []
    if (completions.length === 0) return 'none'

    // Filter by selected member
    const filteredCompletions = selectedMember === 'all'
      ? completions
      : completions.filter(c => c.member_id === selectedMember)

    if (filteredCompletions.length === 0) return 'none'

    // Check if all routines were completed
    const completedRoutineIds = new Set(filteredCompletions.map(c => c.routine_id))
    const expectedRoutines = routines.length

    if (completedRoutineIds.size >= expectedRoutines) return 'complete'
    if (completedRoutineIds.size > 0) return 'partial'
    return 'none'
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  // Stats calculations
  const filteredStreaks = selectedMember === 'all'
    ? streaks
    : streaks.filter(s => s.member_id === selectedMember)

  const totalCompletionsThisMonth = Object.values(completionsByDate).flat().filter(c =>
    selectedMember === 'all' || c.member_id === selectedMember
  ).length

  const daysWithActivity = Object.keys(completionsByDate).filter(date => {
    const completions = completionsByDate[date] || []
    return selectedMember === 'all'
      ? completions.length > 0
      : completions.some(c => c.member_id === selectedMember)
  }).length

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-header">{t('history.title')}</h1>
          <p className="page-subtitle">{t('history.subtitle')}</p>
        </div>

        {/* Member Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedMember('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedMember === 'all'
                ? 'bg-sage-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {t('common.all')}
          </button>
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedMember(child.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                selectedMember === child.id
                  ? 'ring-2 ring-sage-500 ring-offset-2'
                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200'
              }`}
            >
              <AvatarDisplay
                photoUrl={child.photo_url}
                emoji={child.avatar}
                name={child.name}
                color={child.color}
                size="xs"
              />
              <span className="text-slate-700 dark:text-slate-200">{child.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sage-500" />
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100">
                {t('history.calendar')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-medium text-slate-700 dark:text-slate-200 min-w-[140px] text-center">
                {currentMonth.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {[t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'), t('days.thu'), t('days.fri'), t('days.sat')].map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2">
                {day}
              </div>
            ))}

            {/* Empty cells for days before month starts */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const status = getDayStatus(dateStr)
              const isToday = dateStr === today

              return (
                <div
                  key={day}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                    status === 'complete'
                      ? 'bg-green-500 text-white'
                      : status === 'partial'
                      ? 'bg-amber-400 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  } ${isToday ? 'ring-2 ring-sage-500 ring-offset-2' : ''}`}
                  title={`${dateStr}: ${status}`}
                >
                  {day}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>{t('history.allDone')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-400" />
              <span>{t('history.partial')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-600" />
              <span>{t('history.noActivity')}</span>
            </div>
          </div>
        </Card>

        {/* Stats & Streaks */}
        <div className="space-y-6">
          {/* Monthly Stats */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100">
                {t('history.stats')}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-center">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalCompletionsThisMonth}</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400">{t('history.stepsCompleted')}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/30 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{daysWithActivity}</p>
                <p className="text-xs text-green-500 dark:text-green-400">{t('history.activeDays')}</p>
              </div>
            </div>
          </Card>

          {/* Streak Leaderboard */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100">
                {t('history.streaks')}
              </h2>
            </div>

            <div className="space-y-2">
              {filteredStreaks.filter(s => s.current_streak > 0).slice(0, 5).map(streak => {
                const member = getMember(streak.member_id)
                return (
                  <div key={streak.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    {member && (
                      <AvatarDisplay
                        photoUrl={member.photo_url}
                        emoji={member.avatar}
                        name={member.name}
                        color={member.color}
                        size="sm"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {streak.routine?.emoji} {streak.routine?.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{member?.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Flame className={`w-4 h-4 ${
                        streak.current_streak >= 7 ? 'text-red-500' : 'text-orange-500'
                      }`} />
                      <span className="font-bold text-orange-600 dark:text-orange-400">{streak.current_streak}</span>
                    </div>
                    {streak.current_streak >= streak.longest_streak && streak.current_streak > 1 && (
                      <Trophy className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                )
              })}

              {filteredStreaks.filter(s => s.current_streak > 0).length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  {t('history.noActiveStreaks')}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Points History */}
      <Card className="mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-amber-500" />
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100">
            {t('history.points')}
          </h2>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {pointsHistory
            .filter(p => selectedMember === 'all' || p.member_id === selectedMember)
            .map(entry => {
              const member = getMember(entry.member_id)
              const isPositive = entry.points_change > 0

              return (
                <div key={entry.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  {member && (
                    <AvatarDisplay
                      photoUrl={member.photo_url}
                      emoji={member.avatar}
                      name={member.name}
                      color={member.color}
                      size="sm"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {entry.reason.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(entry.created_at).toLocaleDateString()} • {member?.name}
                    </p>
                  </div>
                  <span className={`font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isPositive ? '+' : ''}{entry.points_change}
                  </span>
                  <Star className="w-4 h-4 text-amber-500" />
                </div>
              )
            })}

          {pointsHistory.filter(p => selectedMember === 'all' || p.member_id === selectedMember).length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
              {t('history.noPointsHistory')}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
