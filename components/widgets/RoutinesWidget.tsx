'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Play, Check, Moon, Sun, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineCompletion, FamilyMember } from '@/lib/database.types'
import { useWidgetSize } from '@/lib/useWidgetSize'

// Demo routines for when not logged in
const DEMO_ROUTINES: (Routine & { steps: RoutineStep[], members: FamilyMember[] })[] = [
  {
    id: 'demo-bedtime',
    user_id: 'demo',
    title: 'Bedtime Routine',
    emoji: '🌙',
    type: 'evening',
    scheduled_time: '19:30',
    points_reward: 2,
    is_active: true,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    steps: [
      { id: 'step-1', routine_id: 'demo-bedtime', title: 'Porridge', emoji: '🥣', duration_minutes: 10, sort_order: 0, created_at: '' },
      { id: 'step-2', routine_id: 'demo-bedtime', title: 'Pajamas', emoji: '👕', duration_minutes: 5, sort_order: 1, created_at: '' },
      { id: 'step-3', routine_id: 'demo-bedtime', title: 'Toothbrushing', emoji: '🪥', duration_minutes: 3, sort_order: 2, created_at: '' },
      { id: 'step-4', routine_id: 'demo-bedtime', title: 'Supper Milk', emoji: '🥛', duration_minutes: 5, sort_order: 3, created_at: '' },
      { id: 'step-5', routine_id: 'demo-bedtime', title: 'Kiss & Goodnight', emoji: '😘', duration_minutes: 2, sort_order: 4, created_at: '' },
    ],
    members: [
      { id: 'demo-olivia', user_id: 'demo', name: 'Olivia', color: '#8b5cf6', role: 'child', avatar: null, photo_url: null, date_of_birth: '2017-09-10', aliases: [], description: null, points: 47, stars_enabled: true, sort_order: 2, created_at: '', updated_at: '' },
      { id: 'demo-ellie', user_id: 'demo', name: 'Ellie', color: '#22c55e', role: 'child', avatar: null, photo_url: null, date_of_birth: '2020-01-28', aliases: [], description: null, points: 23, stars_enabled: false, sort_order: 3, created_at: '', updated_at: '' },
    ],
  },
]

interface RoutineWithData extends Routine {
  steps: RoutineStep[]
  members: FamilyMember[]
}

interface Props {
  onOpenRoutine?: (routine: RoutineWithData, completions: RoutineCompletion[]) => void
}

export default function RoutinesWidget({ onOpenRoutine }: Props) {
  const { user } = useAuth()
  const { getMember } = useFamily()
  const { rewardsEnabled } = useSettings()
  const { t } = useTranslation()
  const [routines, setRoutines] = useState<RoutineWithData[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [ref, { size }] = useWidgetSize()

  const today = new Date().toISOString().split('T')[0]

  const fetchRoutines = useCallback(async () => {
    if (!user) {
      setRoutines(DEMO_ROUTINES)
      // Demo completions - Olivia completed first 2 steps, Ellie completed first step
      setCompletions([
        { id: 'c1', routine_id: 'demo-bedtime', step_id: 'step-1', member_id: 'demo-olivia', completed_date: today, completed_at: new Date().toISOString() },
        { id: 'c2', routine_id: 'demo-bedtime', step_id: 'step-2', member_id: 'demo-olivia', completed_date: today, completed_at: new Date().toISOString() },
        { id: 'c3', routine_id: 'demo-bedtime', step_id: 'step-1', member_id: 'demo-ellie', completed_date: today, completed_at: new Date().toISOString() },
      ])
      return
    }

    try {
      // Fetch routines with steps and members
      const { data: routinesData } = await supabase
        .from('routines')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (routinesData && routinesData.length > 0) {
        // Fetch steps for all routines
        const { data: stepsData } = await supabase
          .from('routine_steps')
          .select('*')
          .in('routine_id', routinesData.map(r => r.id))
          .order('sort_order', { ascending: true })

        // Fetch routine members
        const { data: membersData } = await supabase
          .from('routine_members')
          .select('*, member:family_members(*)')
          .in('routine_id', routinesData.map(r => r.id))

        // Fetch today's completions
        const { data: completionsData } = await supabase
          .from('routine_completions')
          .select('*')
          .in('routine_id', routinesData.map(r => r.id))
          .eq('completed_date', today)

        // Combine data
        const routinesWithData: RoutineWithData[] = routinesData.map(routine => ({
          ...routine,
          steps: (stepsData || []).filter(s => s.routine_id === routine.id),
          members: (membersData || [])
            .filter(m => m.routine_id === routine.id)
            .map(m => m.member)
            .filter(Boolean) as FamilyMember[],
        }))

        setRoutines(routinesWithData)
        setCompletions(completionsData || [])
      } else {
        // No routines in DB - show demo data as starting point
        setRoutines(DEMO_ROUTINES)
        setCompletions([])
      }
    } catch (error) {
      console.error('Error fetching routines:', error)
      setRoutines(DEMO_ROUTINES)
    }
  }, [user, today])

  useEffect(() => {
    fetchRoutines()
  }, [fetchRoutines])

  // Get routine type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'morning': return <Sun className="w-3 h-3 text-amber-500" />
      case 'evening': return <Moon className="w-3 h-3 text-indigo-500" />
      default: return <Clock className="w-3 h-3 text-slate-500" />
    }
  }

  // Check if a step is completed by a member
  const isStepCompletedBy = (routineId: string, stepId: string, memberId: string) => {
    return completions.some(
      c => c.routine_id === routineId && c.step_id === stepId && c.member_id === memberId
    )
  }

  // Get completion count for a step (how many members completed it)
  const getStepCompletionCount = (routineId: string, stepId: string, totalMembers: number) => {
    const count = completions.filter(
      c => c.routine_id === routineId && c.step_id === stepId
    ).length
    return { count, total: totalMembers }
  }

  // Check if routine is fully complete (all members completed all steps)
  const isRoutineComplete = (routine: RoutineWithData) => {
    if (routine.steps.length === 0 || routine.members.length === 0) return false
    return routine.steps.every(step =>
      routine.members.every(member =>
        isStepCompletedBy(routine.id, step.id, member.id)
      )
    )
  }

  // Calculate overall progress for a routine
  const getRoutineProgress = (routine: RoutineWithData) => {
    if (routine.steps.length === 0 || routine.members.length === 0) return 0
    const totalPossible = routine.steps.length * routine.members.length
    const completed = routine.steps.reduce((acc, step) => {
      return acc + routine.members.filter(m => isStepCompletedBy(routine.id, step.id, m.id)).length
    }, 0)
    return Math.round((completed / totalPossible) * 100)
  }

  const compactMode = size === 'small'
  const showMultiple = size === 'large' || size === 'xlarge'

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-500" />
          <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">
            {t('routines.title')}
          </h3>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-hidden">
        {routines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-2">
              <ClipboardList className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('routines.noRoutines')}</p>
          </div>
        ) : (
          routines.slice(0, showMultiple ? 2 : 1).map(routine => {
            const progress = getRoutineProgress(routine)
            const complete = isRoutineComplete(routine)

            return (
              <button
                key={routine.id}
                onClick={() => onOpenRoutine?.(routine, completions.filter(c => c.routine_id === routine.id))}
                className={`w-full p-3 rounded-2xl transition-all text-left ${
                  complete
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={compactMode ? 'text-lg' : 'text-xl'}>{routine.emoji}</span>
                    <span className={`font-medium ${compactMode ? 'text-sm' : 'text-base'} text-slate-800 dark:text-slate-100`}>
                      {routine.title}
                    </span>
                    {getTypeIcon(routine.type)}
                  </div>
                  {complete ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
                      <Check className="w-3 h-3" />
                      <span className="text-xs font-medium">{t('routines.done')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Play className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{progress}%</span>
                    </div>
                  )}
                </div>

                {/* Steps progress - horizontal */}
                <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                  {routine.steps.map((step, index) => {
                    const { count, total } = getStepCompletionCount(routine.id, step.id, routine.members.length)
                    const allComplete = count === total && total > 0

                    return (
                      <div key={step.id} className="flex items-center">
                        {/* Step emoji with completion indicator */}
                        <div
                          className={`relative flex flex-col items-center ${compactMode ? 'min-w-[36px]' : 'min-w-[44px]'}`}
                        >
                          <div
                            className={`${compactMode ? 'w-8 h-8 text-base' : 'w-10 h-10 text-lg'} rounded-full flex items-center justify-center transition-all ${
                              allComplete
                                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-400'
                                : count > 0
                                ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400'
                                : 'bg-slate-100 dark:bg-slate-600'
                            }`}
                          >
                            {allComplete ? (
                              <Check className={`${compactMode ? 'w-4 h-4' : 'w-5 h-5'} text-green-600 dark:text-green-400`} />
                            ) : (
                              step.emoji
                            )}
                          </div>

                          {/* Member completion dots */}
                          {!compactMode && routine.members.length > 0 && (
                            <div className="flex gap-0.5 mt-1">
                              {routine.members.map(member => (
                                <div
                                  key={member.id}
                                  className={`w-2 h-2 rounded-full transition-all ${
                                    isStepCompletedBy(routine.id, step.id, member.id)
                                      ? ''
                                      : 'opacity-30'
                                  }`}
                                  style={{ backgroundColor: member.color }}
                                  title={member.name}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Arrow between steps */}
                        {index < routine.steps.length - 1 && (
                          <div className={`text-slate-300 dark:text-slate-600 ${compactMode ? 'text-xs' : 'text-sm'}`}>
                            →
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Member avatars */}
                {!compactMode && (
                  <div className="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-600">
                    <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">
                      {t('routines.participants')}:
                    </span>
                    {routine.members.map(member => (
                      <div
                        key={member.id}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-white dark:ring-slate-700"
                        style={{ backgroundColor: member.color }}
                        title={member.name}
                      >
                        {member.avatar || member.name.charAt(0)}
                      </div>
                    ))}
                    {rewardsEnabled && routine.points_reward > 0 && (
                      <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 font-medium">
                        +{routine.points_reward} ⭐
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
