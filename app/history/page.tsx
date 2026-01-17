'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, Flame, Trophy, Star, ChevronLeft, ChevronRight, BarChart3, Clock, RotateCcw, Check, X, AlertCircle, Filter, List } from 'lucide-react'
import Card from '@/components/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useTranslation } from '@/lib/i18n-context'
import { MemberStreak, RoutineCompletionLog, PointsHistory, Routine, RoutineStep, FamilyMember } from '@/lib/database.types'
import { AvatarDisplay } from '@/components/PhotoUpload'

interface StreakWithRoutine extends MemberStreak {
  routine?: Routine
}

interface PointsWithDetails extends PointsHistory {
  routine?: { title: string, emoji: string }
  chore?: { title: string, emoji: string }
  reward?: { title: string, emoji: string }
}

interface LogEntryWithDetails extends RoutineCompletionLog {
  routine?: Routine
  step?: RoutineStep
  member?: FamilyMember
}

type TabType = 'overview' | 'activity'

export default function HistoryPage() {
  const { user } = useAuth()
  const { members } = useFamily()
  const { t, locale } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [completionsByDate, setCompletionsByDate] = useState<Record<string, RoutineCompletionLog[]>>({})
  const [activityLog, setActivityLog] = useState<LogEntryWithDetails[]>([])
  const [activityLogLoading, setActivityLogLoading] = useState(false)
  const [streaks, setStreaks] = useState<StreakWithRoutine[]>([])
  const [pointsHistory, setPointsHistory] = useState<PointsWithDetails[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [routineSteps, setRoutineSteps] = useState<RoutineStep[]>([])
  const [selectedMember, setSelectedMember] = useState<string | 'all'>('all')
  const [selectedRoutine, setSelectedRoutine] = useState<string | 'all'>('all')

  const children = members.filter(m => m.role === 'child')

  // Fetch overview data
  const fetchOverviewData = useCallback(async () => {
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

      // Fetch completions for the month (only completed actions for calendar)
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

      // Fetch all steps for reference
      const { data: stepsData } = await supabase
        .from('routine_steps')
        .select('*')
        .order('sort_order')

      setRoutineSteps(stepsData || [])

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

  // Fetch activity log for selected date
  const fetchActivityLog = useCallback(async () => {
    if (!user || !selectedDate) return

    setActivityLogLoading(true)
    try {
      const { data } = await supabase
        .from('routine_completion_log')
        .select(`
          *,
          routine:routines(id, title, emoji, type),
          step:routine_steps(id, title, emoji),
          member:family_members(id, name, avatar, color, photo_url)
        `)
        .eq('completed_date', selectedDate)
        .order('completed_at', { ascending: true })

      setActivityLog(data || [])
    } catch (error) {
      console.error('Error fetching activity log:', error)
    }
    setActivityLogLoading(false)
  }, [user, selectedDate])

  useEffect(() => {
    fetchOverviewData()
  }, [fetchOverviewData])

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityLog()
    }
  }, [fetchActivityLog, activeTab, selectedDate])

  const getMember = (id: string) => members.find(m => m.id === id)
  const getRoutine = (id: string) => routines.find(r => r.id === id)
  const getStep = (id: string) => routineSteps.find(s => s.id === id)

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

  // Navigate date for activity log
  const prevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const nextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
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

  // Filter activity log
  const filteredActivityLog = useMemo(() => {
    return activityLog.filter(entry => {
      const memberMatch = selectedMember === 'all' || entry.member_id === selectedMember
      const routineMatch = selectedRoutine === 'all' || entry.routine_id === selectedRoutine
      return memberMatch && routineMatch
    })
  }, [activityLog, selectedMember, selectedRoutine])

  // Group activity log by routine for daily summary
  const activityByRoutine = useMemo(() => {
    const grouped: Record<string, LogEntryWithDetails[]> = {}
    for (const entry of filteredActivityLog) {
      if (!grouped[entry.routine_id]) {
        grouped[entry.routine_id] = []
      }
      grouped[entry.routine_id].push(entry)
    }
    return grouped
  }, [filteredActivityLog])

  // Calculate stats for each routine
  const routineStats = useMemo(() => {
    const stats: Record<string, {
      startTime: Date | null
      endTime: Date | null
      totalSteps: number
      completedSteps: number
      redoCount: number
      undoCount: number
    }> = {}

    for (const [routineId, entries] of Object.entries(activityByRoutine)) {
      const completedEntries = entries.filter(e => e.action === 'completed')
      const uncompletedEntries = entries.filter(e => e.action === 'uncompleted')

      // Track unique steps that ended up completed
      const finalSteps = new Set<string>()
      for (const entry of entries) {
        if (entry.action === 'completed') {
          finalSteps.add(`${entry.step_id}:${entry.member_id}`)
        } else if (entry.action === 'uncompleted') {
          finalSteps.delete(`${entry.step_id}:${entry.member_id}`)
        }
      }

      // Find first and last completion times
      const completionTimes = completedEntries.map(e => new Date(e.completed_at))
      const startTime = completionTimes.length > 0 ? new Date(Math.min(...completionTimes.map(d => d.getTime()))) : null
      const endTime = completionTimes.length > 0 ? new Date(Math.max(...completionTimes.map(d => d.getTime()))) : null

      // Count redos (steps completed more than once)
      const stepCompletionCounts: Record<string, number> = {}
      for (const entry of completedEntries) {
        const key = `${entry.step_id}:${entry.member_id}`
        stepCompletionCounts[key] = (stepCompletionCounts[key] || 0) + 1
      }
      const redoCount = Object.values(stepCompletionCounts).filter(c => c > 1).reduce((sum, c) => sum + c - 1, 0)

      stats[routineId] = {
        startTime,
        endTime,
        totalSteps: finalSteps.size,
        completedSteps: finalSteps.size,
        redoCount,
        undoCount: uncompletedEntries.length,
      }
    }

    return stats
  }, [activityByRoutine])

  // Format time
  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString(locale === 'da' ? 'da-DK' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format duration
  const formatDuration = (start: Date, end: Date) => {
    const diffMs = end.getTime() - start.getTime()
    const diffMins = Math.round(diffMs / 60000)
    if (diffMins < 60) {
      return `${diffMins} ${t('history.minutes')}`
    }
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}${t('history.hoursShort')} ${mins}${t('history.minutesShort')}`
  }

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
        <div className="flex gap-2 flex-wrap">
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-sage-600 border-b-2 border-sage-600'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t('history.overview')}</span>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'activity'
              ? 'text-sage-600 border-b-2 border-sage-600'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <List className="w-4 h-4" />
          <span>{t('history.activityLog')}</span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
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
                  const isSelected = dateStr === selectedDate

                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setSelectedDate(dateStr)
                        setActiveTab('activity')
                      }}
                      className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all hover:scale-105 ${
                        status === 'complete'
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : status === 'partial'
                          ? 'bg-amber-400 text-white hover:bg-amber-500'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      } ${isToday ? 'ring-2 ring-sage-500 ring-offset-2' : ''} ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
                      title={t('history.clickToViewLog')}
                    >
                      {day}
                    </button>
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
                          {new Date(entry.created_at).toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB')} • {member?.name}
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
        </>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-6">
          {/* Date Navigator & Filters */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Date Navigation */}
              <div className="flex items-center gap-3">
                <button onClick={prevDay} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center min-w-[180px]">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {new Date(selectedDate).toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </p>
                  {selectedDate === today && (
                    <span className="text-xs text-sage-600 dark:text-sage-400 font-medium">{t('common.today')}</span>
                  )}
                </div>
                <button onClick={nextDay} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedDate(today)}
                  className="px-3 py-1 text-sm bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 rounded-lg hover:bg-sage-200"
                >
                  {t('common.today')}
                </button>
              </div>

              {/* Routine Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedRoutine}
                  onChange={(e) => setSelectedRoutine(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 border-0 text-slate-700 dark:text-slate-200"
                >
                  <option value="all">{t('history.allRoutines')}</option>
                  {routines.map(routine => (
                    <option key={routine.id} value={routine.id}>
                      {routine.emoji} {routine.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {activityLogLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
            </div>
          ) : filteredActivityLog.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">{t('history.noActivityForDate')}</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Daily Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(activityByRoutine).map(([routineId, entries]) => {
                  const routine = getRoutine(routineId)
                  const stats = routineStats[routineId]
                  if (!routine || !stats) return null

                  return (
                    <Card key={routineId} className="relative overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{routine.emoji}</span>
                          <div>
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{routine.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {routine.type === 'morning' ? t('routines.morning') : routine.type === 'evening' ? t('routines.evening') : t('routines.custom')}
                            </p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          stats.completedSteps > 0
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                        }`}>
                          {stats.completedSteps > 0 ? (
                            <span className="flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {stats.completedSteps} {t('history.steps')}
                            </span>
                          ) : (
                            t('history.notStarted')
                          )}
                        </div>
                      </div>

                      {/* Time Info */}
                      {stats.startTime && stats.endTime && (
                        <div className="flex items-center gap-4 mb-3 text-sm">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <Clock className="w-4 h-4" />
                            <span>{formatTime(stats.startTime)} → {formatTime(stats.endTime)}</span>
                          </div>
                          <span className="text-slate-400 dark:text-slate-500">
                            ({formatDuration(stats.startTime, stats.endTime)})
                          </span>
                        </div>
                      )}

                      {/* Warnings */}
                      {(stats.redoCount > 0 || stats.undoCount > 0) && (
                        <div className="flex items-center gap-3 text-xs">
                          {stats.undoCount > 0 && (
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <X className="w-3 h-3" />
                              {stats.undoCount} {t('history.undos')}
                            </span>
                          )}
                          {stats.redoCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <RotateCcw className="w-3 h-3" />
                              {stats.redoCount} {t('history.redos')}
                            </span>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>

              {/* Timeline */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100">
                    {t('history.timeline')}
                  </h2>
                  <span className="text-sm text-slate-400">({filteredActivityLog.length} {t('history.actions')})</span>
                </div>

                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

                  <div className="space-y-0">
                    {filteredActivityLog.map((entry, index) => {
                      const member = entry.member || getMember(entry.member_id)
                      const step = entry.step || getStep(entry.step_id)
                      const routine = entry.routine || getRoutine(entry.routine_id)

                      // Determine if this is a redo (same step completed again after being undone)
                      const previousEntries = filteredActivityLog.slice(0, index)
                      const wasUndone = previousEntries.some(
                        e => e.step_id === entry.step_id &&
                             e.member_id === entry.member_id &&
                             e.action === 'uncompleted' &&
                             new Date(e.completed_at) > new Date(
                               previousEntries.filter(
                                 pe => pe.step_id === entry.step_id &&
                                       pe.member_id === entry.member_id &&
                                       pe.action === 'completed'
                               ).slice(-1)[0]?.completed_at || 0
                             )
                      )
                      const isRedo = entry.action === 'completed' && wasUndone

                      return (
                        <div key={entry.id} className="relative flex gap-4 pb-4">
                          {/* Timeline dot */}
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            entry.action === 'completed'
                              ? isRedo
                                ? 'bg-amber-500 text-white'
                                : 'bg-green-500 text-white'
                              : entry.action === 'uncompleted'
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-400 text-white'
                          }`}>
                            {entry.action === 'completed' ? (
                              isRedo ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />
                            ) : entry.action === 'uncompleted' ? (
                              <X className="w-4 h-4" />
                            ) : (
                              <AlertCircle className="w-4 h-4" />
                            )}
                          </div>

                          {/* Content */}
                          <div className={`flex-1 pb-4 ${index < filteredActivityLog.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {member && (
                                  <AvatarDisplay
                                    photoUrl={member.photo_url}
                                    emoji={member.avatar}
                                    name={member.name}
                                    color={member.color}
                                    size="xs"
                                  />
                                )}
                                <div>
                                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                    <span className="text-slate-600 dark:text-slate-300">{member?.name}</span>
                                    {' '}
                                    <span className={
                                      entry.action === 'completed'
                                        ? isRedo ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }>
                                      {entry.action === 'completed'
                                        ? isRedo ? t('history.redid') : t('history.completed')
                                        : t('history.unchecked')}
                                    </span>
                                    {' '}
                                    <span className="font-semibold">{step?.emoji} {step?.title}</span>
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {routine?.emoji} {routine?.title}
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {formatTime(entry.completed_at)}
                              </span>
                            </div>
                            {entry.notes && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic">
                                "{entry.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>

              {/* Step-focused breakdown */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100">
                    {t('history.stepBreakdown')}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(() => {
                    // Group entries by step
                    const stepGroups: Record<string, LogEntryWithDetails[]> = {}
                    for (const entry of filteredActivityLog) {
                      const key = `${entry.step_id}:${entry.member_id}`
                      if (!stepGroups[key]) {
                        stepGroups[key] = []
                      }
                      stepGroups[key].push(entry)
                    }

                    return Object.entries(stepGroups).map(([key, entries]) => {
                      const [stepId, memberId] = key.split(':')
                      const step = getStep(stepId)
                      const member = getMember(memberId)
                      const routine = getRoutine(entries[0].routine_id)

                      // Calculate final state
                      let isCompleted = false
                      for (const e of entries) {
                        if (e.action === 'completed') isCompleted = true
                        if (e.action === 'uncompleted') isCompleted = false
                      }

                      const completionCount = entries.filter(e => e.action === 'completed').length
                      const uncheckedCount = entries.filter(e => e.action === 'uncompleted').length
                      const hasRedos = completionCount > 1

                      return (
                        <div
                          key={key}
                          className={`p-3 rounded-xl border-2 transition-all ${
                            isCompleted
                              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{step?.emoji}</span>
                              <div>
                                <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{step?.title}</p>
                                <div className="flex items-center gap-1.5">
                                  {member && (
                                    <AvatarDisplay
                                      photoUrl={member.photo_url}
                                      emoji={member.avatar}
                                      name={member.name}
                                      color={member.color}
                                      size="xs"
                                    />
                                  )}
                                  <span className="text-xs text-slate-500 dark:text-slate-400">{member?.name}</span>
                                </div>
                              </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              isCompleted ? 'bg-green-500' : 'bg-red-500'
                            }`}>
                              {isCompleted ? <Check className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
                            </div>
                          </div>

                          {/* Action history */}
                          <div className="space-y-1 text-xs">
                            {entries.map((e, i) => (
                              <div key={e.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <span className="font-mono">{formatTime(e.completed_at)}</span>
                                <span className={
                                  e.action === 'completed'
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }>
                                  {e.action === 'completed' ? '✓' : '✗'} {e.action}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Warnings */}
                          {(hasRedos || uncheckedCount > 0) && (
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
                              {hasRedos && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <RotateCcw className="w-3 h-3" />
                                  {completionCount - 1} redo{completionCount > 2 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
