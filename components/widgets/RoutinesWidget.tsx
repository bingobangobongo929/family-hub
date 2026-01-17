'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ClipboardList, Check, Moon, Sun, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineCompletion, FamilyMember } from '@/lib/database.types'
import Confetti from '@/components/Confetti'
import { AvatarDisplay } from '@/components/PhotoUpload'

// Default routines (used when database is empty)
const DEFAULT_ROUTINES: (Routine & { steps: RoutineStep[], members: FamilyMember[] })[] = [
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
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const [confettiConfig, setConfettiConfig] = useState<{ intensity: 'small' | 'medium' | 'big' | 'epic', emoji?: string }>({ intensity: 'small' })
  const [celebratingStep, setCelebratingStep] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Get child members from family context for use in default routines
  const { members: familyMembers } = useFamily()
  const childMembers = familyMembers.filter(m => m.role === 'child')

  // Create default routines with actual family members (with their photos)
  const getDefaultRoutinesWithRealMembers = useCallback(() => {
    if (childMembers.length === 0) return DEFAULT_ROUTINES

    return DEFAULT_ROUTINES.map(routine => ({
      ...routine,
      members: childMembers,
    }))
  }, [childMembers])

  const fetchRoutines = useCallback(async () => {
    if (!user) {
      const defaultWithMembers = getDefaultRoutinesWithRealMembers()
      setRoutines(defaultWithMembers)
      setCompletions([])
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
        const defaultWithMembers = getDefaultRoutinesWithRealMembers()
        setRoutines(defaultWithMembers)
        setCompletions([])
      }
    } catch (error) {
      console.error('Error fetching routines:', error)
      const defaultWithMembers = getDefaultRoutinesWithRealMembers()
      setRoutines(defaultWithMembers)
    }
  }, [user, today, getDefaultRoutinesWithRealMembers])

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

      // Find the step emoji for confetti
      const step = routine.steps.find(s => s.id === stepId)

      // Celebrate! Small burst for individual completion
      setCelebratingStep(stepId)
      setConfettiConfig({ intensity: 'small', emoji: step?.emoji })
      setConfettiTrigger(t => t + 1)
      setTimeout(() => setCelebratingStep(null), 600)

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
        // BIG celebration for completing all steps!
        setTimeout(() => {
          setConfettiConfig({ intensity: 'big', emoji: '⭐' })
          setConfettiTrigger(t => t + 1)
        }, 300)
      }

      // Check if ALL members completed ALL steps - EPIC celebration!
      const allMembersCompletedAll = routine.members.every(m =>
        routine.steps.every(s =>
          (s.id === stepId && m.id === memberId) || isStepCompletedBy(routine.id, s.id, m.id)
        )
      )
      if (allMembersCompletedAll) {
        setTimeout(() => {
          setConfettiConfig({ intensity: 'epic', emoji: '🎉' })
          setConfettiTrigger(t => t + 1)
        }, 500)
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
    <>
      <Confetti trigger={confettiTrigger} {...confettiConfig} />
      <div className="h-full flex flex-col bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            {activeRoutine.type === 'morning' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="font-semibold text-sm">{activeRoutine.title}</span>
          </div>
          {complete ? (
            <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium animate-pulse">
              {t('routines.done')}
            </span>
          ) : rewardsEnabled && activeRoutine.points_reward > 0 ? (
            <div className="flex items-center gap-1 text-amber-500 text-xs">
              <Star className="w-3 h-3 fill-amber-400" />
              <span>+{activeRoutine.points_reward}</span>
            </div>
          ) : null}
        </div>

        {/* Tall vertical cards grid */}
        <div className="flex-1 grid grid-cols-5 gap-2">
          {activeRoutine.steps.map((step) => {
            const allMembersDone = activeRoutine.members.every(m =>
              isStepCompletedBy(activeRoutine.id, step.id, m.id)
            )
            const someMembersDone = activeRoutine.members.some(m =>
              isStepCompletedBy(activeRoutine.id, step.id, m.id)
            )
            const isCelebrating = celebratingStep === step.id

            return (
              <div
                key={step.id}
                className={`flex flex-col items-center justify-between p-2 rounded-xl border-2 transition-all duration-300 ${
                  allMembersDone
                    ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-600 scale-95'
                    : someMembersDone
                    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                } ${isCelebrating ? 'animate-wiggle scale-110 !border-yellow-400 !bg-yellow-50 dark:!bg-yellow-900/30' : ''}`}
              >
                {/* Emoji at top */}
                <div className={`flex-1 flex items-center justify-center transition-transform duration-300 ${isCelebrating ? 'scale-125' : ''}`}>
                  {allMembersDone ? (
                    <div className="relative">
                      <Check className="w-8 h-8 text-green-500" />
                      <span className="absolute -top-1 -right-1 text-sm animate-bounce">✨</span>
                    </div>
                  ) : (
                    <span className={`text-3xl ${isCelebrating ? 'animate-bounce' : ''}`}>{step.emoji}</span>
                  )}
                </div>

                {/* Member buttons at bottom */}
                <div className="flex flex-col gap-1 mt-1">
                  {activeRoutine.members.map(member => {
                    const done = isStepCompletedBy(activeRoutine.id, step.id, member.id)
                    const cooldownKey = `${step.id}:${member.id}`
                    const onCooldown = cooldowns.has(cooldownKey)

                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleStepForMember(activeRoutine, step.id, member.id)}
                        disabled={onCooldown}
                        className={`relative w-8 h-8 rounded-lg transition-all duration-200 overflow-hidden ${
                          onCooldown
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:scale-110 active:scale-90'
                        } ${
                          done ? 'ring-2 ring-green-400 ring-offset-1 shadow-lg' : 'hover:shadow-md'
                        }`}
                        title={member.name}
                      >
                        <AvatarDisplay
                          photoUrl={member.photo_url}
                          emoji={member.avatar}
                          name={member.name}
                          color={member.color}
                          size="xs"
                          className="w-full h-full"
                        />
                        {done && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <span className="text-green-500 bg-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</span>
                          </span>
                        )}
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
          <div className="text-center pt-2">
            <span className="text-sm inline-block animate-bounce">
              {activeRoutine.type === 'evening' ? '🌟 ' + t('routines.sweetDreams') + ' 🌟' : '🌟 ' + t('routines.haveGreatDay') + ' 🌟'}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
