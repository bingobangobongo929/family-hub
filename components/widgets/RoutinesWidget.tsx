'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ClipboardList, Check, Moon, Sun, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineCompletion, FamilyMember } from '@/lib/database.types'

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

export default function RoutinesWidget() {
  const { user } = useAuth()
  const { getMember, updateMemberPoints } = useFamily()
  const { rewardsEnabled } = useSettings()
  const { t } = useTranslation()
  const [routines, setRoutines] = useState<RoutineWithData[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [cooldowns, setCooldowns] = useState<Set<string>>(new Set())
  const cooldownTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const today = new Date().toISOString().split('T')[0]

  const fetchRoutines = useCallback(async () => {
    if (!user) {
      setRoutines(DEMO_ROUTINES)
      setCompletions([
        { id: 'c1', routine_id: 'demo-bedtime', step_id: 'step-1', member_id: 'demo-olivia', completed_date: today, completed_at: new Date().toISOString() },
        { id: 'c2', routine_id: 'demo-bedtime', step_id: 'step-2', member_id: 'demo-olivia', completed_date: today, completed_at: new Date().toISOString() },
        { id: 'c3', routine_id: 'demo-bedtime', step_id: 'step-1', member_id: 'demo-ellie', completed_date: today, completed_at: new Date().toISOString() },
      ])
      return
    }

    try {
      const { data: routinesData } = await supabase
        .from('routines')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (routinesData && routinesData.length > 0) {
        const { data: stepsData } = await supabase
          .from('routine_steps')
          .select('*')
          .in('routine_id', routinesData.map(r => r.id))
          .order('sort_order', { ascending: true })

        const { data: membersData } = await supabase
          .from('routine_members')
          .select('*, member:family_members(*)')
          .in('routine_id', routinesData.map(r => r.id))

        const { data: completionsData } = await supabase
          .from('routine_completions')
          .select('*')
          .in('routine_id', routinesData.map(r => r.id))
          .eq('completed_date', today)

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
    return () => {
      // Cleanup timers on unmount
      cooldownTimers.current.forEach(timer => clearTimeout(timer))
    }
  }, [fetchRoutines])

  const isStepCompletedBy = (routineId: string, stepId: string, memberId: string) => {
    return completions.some(
      c => c.routine_id === routineId && c.step_id === stepId && c.member_id === memberId
    )
  }

  const toggleStepForMember = async (routine: RoutineWithData, stepId: string, memberId: string) => {
    const cooldownKey = `${stepId}:${memberId}`

    // Check cooldown
    if (cooldowns.has(cooldownKey)) return

    const isCompleted = isStepCompletedBy(routine.id, stepId, memberId)

    // Set 5-second cooldown
    setCooldowns(prev => new Set(prev).add(cooldownKey))
    const timer = setTimeout(() => {
      setCooldowns(prev => {
        const next = new Set(prev)
        next.delete(cooldownKey)
        return next
      })
      cooldownTimers.current.delete(cooldownKey)
    }, 5000)
    cooldownTimers.current.set(cooldownKey, timer)

    if (isCompleted) {
      // Remove completion
      setCompletions(prev => prev.filter(
        c => !(c.routine_id === routine.id && c.step_id === stepId && c.member_id === memberId)
      ))

      if (user) {
        await supabase
          .from('routine_completions')
          .delete()
          .eq('routine_id', routine.id)
          .eq('step_id', stepId)
          .eq('member_id', memberId)
          .eq('completed_date', today)
      }
    } else {
      // Add completion
      const newCompletion: RoutineCompletion = {
        id: `temp-${Date.now()}`,
        routine_id: routine.id,
        step_id: stepId,
        member_id: memberId,
        completed_date: today,
        completed_at: new Date().toISOString()
      }
      setCompletions(prev => [...prev, newCompletion])

      if (user) {
        await supabase
          .from('routine_completions')
          .insert({
            routine_id: routine.id,
            step_id: stepId,
            member_id: memberId,
            completed_date: today
          })
      }

      // Check if member completed all steps - award stars
      const memberNowCompletedAll = routine.steps.every(s =>
        s.id === stepId || isStepCompletedBy(routine.id, s.id, memberId)
      )
      if (memberNowCompletedAll && routine.points_reward > 0 && rewardsEnabled) {
        const member = getMember(memberId)
        if (member?.stars_enabled) {
          updateMemberPoints(memberId, routine.points_reward)
        }
      }
    }
  }

  const isRoutineComplete = (routine: RoutineWithData) => {
    if (routine.steps.length === 0 || routine.members.length === 0) return false
    return routine.steps.every(step =>
      routine.members.every(member =>
        isStepCompletedBy(routine.id, step.id, member.id)
      )
    )
  }

  // Select the appropriate routine based on time of day
  const hour = new Date().getHours()
  const activeRoutine = routines.find(r =>
    hour < 14 ? r.type === 'morning' : r.type === 'evening'
  ) || routines[0]

  if (!activeRoutine) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark">
        <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">{t('routines.noRoutines')}</p>
      </div>
    )
  }

  const complete = isRoutineComplete(activeRoutine)

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500">
        <div className="flex items-center gap-2 text-white">
          {activeRoutine.type === 'morning' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="font-semibold text-sm">{activeRoutine.title}</span>
        </div>
        {complete && (
          <div className="flex items-center gap-1 text-white/90">
            <Check className="w-4 h-4" />
            <span className="text-xs font-medium">{t('routines.done')}</span>
          </div>
        )}
      </div>

      {/* Steps Grid - Fill the rest */}
      <div className="flex-1 p-3 flex flex-col">
        {/* Large Step Icons */}
        <div className="flex-1 flex flex-wrap justify-center items-center gap-2 content-center">
          {activeRoutine.steps.map((step) => {
            const allMembersDone = activeRoutine.members.every(m =>
              isStepCompletedBy(activeRoutine.id, step.id, m.id)
            )
            const someMembersDone = activeRoutine.members.some(m =>
              isStepCompletedBy(activeRoutine.id, step.id, m.id)
            )

            return (
              <div
                key={step.id}
                className={`relative flex flex-col items-center transition-all duration-300 ${
                  allMembersDone ? 'scale-90 opacity-60' : ''
                }`}
              >
                {/* Step Icon */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all ${
                    allMembersDone
                      ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-400'
                      : someMembersDone
                      ? 'bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-300'
                      : 'bg-slate-100 dark:bg-slate-700'
                  }`}
                >
                  {allMembersDone ? (
                    <Check className="w-7 h-7 text-green-500" />
                  ) : (
                    step.emoji
                  )}
                </div>

                {/* Member buttons below each step */}
                <div className="flex gap-1 mt-1.5">
                  {activeRoutine.members.map(member => {
                    const done = isStepCompletedBy(activeRoutine.id, step.id, member.id)
                    const cooldownKey = `${step.id}:${member.id}`
                    const onCooldown = cooldowns.has(cooldownKey)

                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleStepForMember(activeRoutine, step.id, member.id)}
                        disabled={onCooldown}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all ${
                          onCooldown
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:scale-110 active:scale-95'
                        } ${
                          done ? 'ring-2 ring-green-400 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: member.color }}
                        title={member.name}
                      >
                        {done ? '✓' : member.name.charAt(0)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Completion message */}
        {complete && (
          <div className="text-center py-2 animate-bounce">
            <span className="text-lg">
              {activeRoutine.type === 'evening' ? '🌟 ' + t('routines.sweetDreams') + ' 🌟' : '🌟 ' + t('routines.haveGreatDay') + ' 🌟'}
            </span>
          </div>
        )}

        {/* Stars reward indicator */}
        {rewardsEnabled && activeRoutine.points_reward > 0 && !complete && (
          <div className="flex items-center justify-center gap-1 text-amber-500 text-xs">
            <Star className="w-3 h-3" />
            <span>+{activeRoutine.points_reward} {t('routines.starsReward')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
