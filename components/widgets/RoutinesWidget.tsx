'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ClipboardList, Check, Moon, Sun, Star, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineCompletion, FamilyMember, RoutineScenario } from '@/lib/database.types'
import Confetti from '@/components/Confetti'
import { AvatarDisplay } from '@/components/PhotoUpload'
import { hapticSuccess, hapticLight } from '@/lib/haptics'

interface RoutineWithData extends Routine {
  steps: RoutineStep[]
  members: FamilyMember[]
  scenarios?: RoutineScenario[]
}

type WidgetSize = 'tiny' | 'compact' | 'standard' | 'large' | 'xlarge'

export default function RoutinesWidget() {
  const { user } = useAuth()
  const { getMember, updateMemberPoints } = useFamily()
  const { rewardsEnabled } = useSettings()
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [widgetSize, setWidgetSize] = useState<WidgetSize>('standard')
  const [routines, setRoutines] = useState<RoutineWithData[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [cooldowns, setCooldowns] = useState<Set<string>>(new Set())
  const cooldownTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const [confettiConfig, setConfettiConfig] = useState<{ intensity: 'small' | 'medium' | 'big' | 'epic', emoji?: string }>({ intensity: 'small' })
  const [cardExiting, setCardExiting] = useState(false)
  const [selectedScenarios, setSelectedScenarios] = useState<Record<string, string[]>>({})

  const today = new Date().toISOString().split('T')[0]
  const isWeekend = [0, 6].includes(new Date().getDay())

  // Measure container and determine size class
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const area = width * height

        if (area < 15000 || width < 120 || height < 120) {
          setWidgetSize('tiny')
        } else if (area < 30000 || width < 180 || height < 180) {
          setWidgetSize('compact')
        } else if (area < 60000 || width < 280) {
          setWidgetSize('standard')
        } else if (area < 100000) {
          setWidgetSize('large')
        } else {
          setWidgetSize('xlarge')
        }
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const fetchRoutines = useCallback(async () => {
    if (!user) {
      setRoutines([])
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
        const [stepsResult, membersResult, scenariosResult, completionsResult, dailyStateResult] = await Promise.all([
          supabase
            .from('routine_steps')
            .select('*')
            .in('routine_id', routinesData.map(r => r.id))
            .order('sort_order', { ascending: true }),
          supabase
            .from('routine_members')
            .select('*, member:family_members(*)')
            .in('routine_id', routinesData.map(r => r.id)),
          supabase
            .from('routine_scenarios')
            .select('*')
            .in('routine_id', routinesData.map(r => r.id))
            .order('sort_order', { ascending: true }),
          supabase
            .from('routine_completions')
            .select('*')
            .in('routine_id', routinesData.map(r => r.id))
            .eq('completed_date', today),
          supabase
            .from('routine_daily_state')
            .select('*')
            .in('routine_id', routinesData.map(r => r.id))
            .eq('date', today)
        ])

        const routinesWithData: RoutineWithData[] = routinesData.map(routine => ({
          ...routine,
          steps: (stepsResult.data || []).filter(s => s.routine_id === routine.id),
          members: (membersResult.data || [])
            .filter(m => m.routine_id === routine.id)
            .map(m => m.member)
            .filter(Boolean) as FamilyMember[],
          scenarios: (scenariosResult.data || []).filter(s => s.routine_id === routine.id),
        }))

        // Set up selected scenarios from daily state or defaults
        const newSelectedScenarios: Record<string, string[]> = {}
        for (const routine of routinesWithData) {
          const dailyState = dailyStateResult.data?.find(ds => ds.routine_id === routine.id)
          if (dailyState?.selected_scenario_ids?.length) {
            newSelectedScenarios[routine.id] = dailyState.selected_scenario_ids
          } else if (routine.scenarios && routine.scenarios.length > 0) {
            const defaultScenarios = routine.scenarios.filter(s =>
              isWeekend ? s.is_default_weekend : s.is_default_weekday
            )
            newSelectedScenarios[routine.id] = defaultScenarios.map(s => s.id)
          }
        }
        setSelectedScenarios(newSelectedScenarios)

        setRoutines(routinesWithData)
        setCompletions(completionsResult.data || [])
      } else {
        setRoutines([])
        setCompletions([])
      }
    } catch (error) {
      console.error('Error fetching routines:', error)
      setRoutines([])
    }
  }, [user, today, isWeekend])

  useEffect(() => {
    fetchRoutines()
    return () => {
      cooldownTimers.current.forEach(timer => clearTimeout(timer))
    }
  }, [fetchRoutines])

  const isStepCompletedBy = (routineId: string, stepId: string, memberId: string) => {
    return completions.some(
      c => c.routine_id === routineId && c.step_id === stepId && c.member_id === memberId
    )
  }

  const isStepVisibleForScenarios = (step: RoutineStep, routineId: string): boolean => {
    if (!step.scenario_ids || step.scenario_ids.length === 0) return true
    const currentScenarios = selectedScenarios[routineId] || []
    return step.scenario_ids.some(id => currentScenarios.includes(id))
  }

  const stepAppliesToMember = (step: RoutineStep, memberId: string): boolean => {
    if (!step.member_ids || step.member_ids.length === 0) return true
    return step.member_ids.includes(memberId)
  }

  const getVisibleSteps = (routine: RoutineWithData): RoutineStep[] => {
    return routine.steps.filter(step => isStepVisibleForScenarios(step, routine.id))
  }

  const getStepMembers = (step: RoutineStep, routineMembers: FamilyMember[]): FamilyMember[] => {
    if (!step.member_ids || step.member_ids.length === 0) return routineMembers
    return routineMembers.filter(m => step.member_ids!.includes(m.id))
  }

  // Find the current step = first step where NOT all applicable members have completed
  const getCurrentStep = (routine: RoutineWithData): RoutineStep | null => {
    const visibleSteps = getVisibleSteps(routine)
    for (const step of visibleSteps) {
      const stepMembers = getStepMembers(step, routine.members)
      const allDone = stepMembers.every(m => isStepCompletedBy(routine.id, step.id, m.id))
      if (!allDone) return step
    }
    return null
  }

  const toggleStepForMember = async (routine: RoutineWithData, stepId: string, memberId: string) => {
    const cooldownKey = `${stepId}:${memberId}`
    if (cooldowns.has(cooldownKey)) return

    const isCompleted = isStepCompletedBy(routine.id, stepId, memberId)

    setCooldowns(prev => new Set(prev).add(cooldownKey))
    const timer = setTimeout(() => {
      setCooldowns(prev => {
        const next = new Set(prev)
        next.delete(cooldownKey)
        return next
      })
      cooldownTimers.current.delete(cooldownKey)
    }, 3000)
    cooldownTimers.current.set(cooldownKey, timer)

    if (isCompleted) {
      hapticLight()
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
      hapticSuccess()
      const newCompletion: RoutineCompletion = {
        id: `temp-${Date.now()}`,
        routine_id: routine.id,
        step_id: stepId,
        member_id: memberId,
        completed_date: today,
        completed_at: new Date().toISOString()
      }
      setCompletions(prev => [...prev, newCompletion])

      const step = routine.steps.find(s => s.id === stepId)
      setConfettiConfig({ intensity: 'small', emoji: step?.emoji })
      setConfettiTrigger(t => t + 1)

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

      // Check if this completes the step for all members (card animation)
      const visibleSteps = getVisibleSteps(routine)
      const currentStepMembers = getStepMembers(step!, routine.members)
      const stepNowComplete = currentStepMembers.every(m =>
        m.id === memberId || isStepCompletedBy(routine.id, stepId, m.id)
      )

      if (stepNowComplete) {
        setCardExiting(true)
        setTimeout(() => setCardExiting(false), 400)
      }

      // Check if member completed all their steps
      const memberSteps = visibleSteps.filter(s => stepAppliesToMember(s, memberId))
      const memberNowCompletedAll = memberSteps.every(s =>
        s.id === stepId || isStepCompletedBy(routine.id, s.id, memberId)
      )
      if (memberNowCompletedAll && memberSteps.length > 0 && routine.points_reward > 0 && rewardsEnabled) {
        const member = getMember(memberId)
        if (member?.stars_enabled) {
          updateMemberPoints(memberId, routine.points_reward)
        }
        setTimeout(() => {
          setConfettiConfig({ intensity: 'big', emoji: '⭐' })
          setConfettiTrigger(t => t + 1)
        }, 300)
      }

      // Check if ALL members completed ALL steps - EPIC!
      const allMembersCompletedAll = visibleSteps.length > 0 && routine.members.every(m => {
        const memberSpecificSteps = visibleSteps.filter(s => stepAppliesToMember(s, m.id))
        return memberSpecificSteps.every(s =>
          (s.id === stepId && m.id === memberId) || isStepCompletedBy(routine.id, s.id, m.id)
        )
      })
      if (allMembersCompletedAll) {
        setTimeout(() => {
          setConfettiConfig({ intensity: 'epic', emoji: '🎉' })
          setConfettiTrigger(t => t + 1)
        }, 500)
      }
    }
  }

  const isRoutineComplete = (routine: RoutineWithData) => {
    const visibleSteps = getVisibleSteps(routine)
    if (visibleSteps.length === 0 || routine.members.length === 0) return false
    return routine.members.every(member => {
      const memberSteps = visibleSteps.filter(s => stepAppliesToMember(s, member.id))
      return memberSteps.every(step => isStepCompletedBy(routine.id, step.id, member.id))
    })
  }

  // Select the appropriate routine based on time of day
  const hour = new Date().getHours()
  const activeRoutine = routines.find(r =>
    hour < 14 ? r.type === 'morning' : r.type === 'evening'
  ) || routines[0]

  if (!activeRoutine) {
    return (
      <div ref={containerRef} className="h-full flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark">
        <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">{t('routines.noRoutines')}</p>
      </div>
    )
  }

  const complete = isRoutineComplete(activeRoutine)
  const currentStep = getCurrentStep(activeRoutine)
  const visibleSteps = getVisibleSteps(activeRoutine)
  const currentStepMembers = currentStep ? getStepMembers(currentStep, activeRoutine.members) : []
  const currentStepIndex = currentStep ? visibleSteps.findIndex(s => s.id === currentStep.id) : -1
  const remainingSteps = visibleSteps.length - currentStepIndex - 1

  // Calculate progress
  const totalStepMemberPairs = visibleSteps.reduce((acc, step) => {
    return acc + getStepMembers(step, activeRoutine.members).length
  }, 0)
  const completedStepMemberPairs = visibleSteps.reduce((acc, step) => {
    const stepMembers = getStepMembers(step, activeRoutine.members)
    return acc + stepMembers.filter(m => isStepCompletedBy(activeRoutine.id, step.id, m.id)).length
  }, 0)
  const progressPercent = totalStepMemberPairs > 0 ? (completedStepMemberPairs / totalStepMemberPairs) * 100 : 0

  // Sizing
  const isTiny = widgetSize === 'tiny'
  const isCompact = widgetSize === 'compact'
  const isSmall = isTiny || isCompact

  return (
    <>
      <Confetti trigger={confettiTrigger} {...confettiConfig} />
      <div
        ref={containerRef}
        className="h-full flex flex-col bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            {activeRoutine.type === 'morning' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
            {!isTiny && (
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {activeRoutine.type === 'morning' ? 'Morning' : 'Bedtime'}
              </span>
            )}
          </div>
          {!isSmall && (
            <span className="text-xs text-slate-400">
              {completedStepMemberPairs}/{totalStepMemberPairs}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mx-3 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {complete ? (
          // All done state
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-6xl mb-2 animate-bounce">
              {activeRoutine.type === 'morning' ? '🌟' : '🌙'}
            </div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              All done!
            </p>
            {!isSmall && (
              <div className="flex items-center gap-1 mt-2">
                {activeRoutine.members.map(m => (
                  <div key={m.id} className="relative">
                    <AvatarDisplay
                      photoUrl={m.photo_url}
                      emoji={m.avatar}
                      name={m.name}
                      color={m.color}
                      size="xs"
                    />
                    <span className="absolute -bottom-1 -right-1 text-xs">✨</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Card Stack View
          <div className="flex-1 flex flex-col p-3 pt-2 min-h-0">
            {/* Current Step Card */}
            <div
              className={`flex-1 bg-white dark:bg-slate-700 rounded-2xl shadow-lg p-4 flex flex-col transition-all duration-300 ${
                cardExiting ? 'opacity-0 -translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'
              }`}
            >
              {/* Step Content */}
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <span className={`${isSmall ? 'text-4xl' : 'text-5xl'} mb-2`}>
                  {currentStep?.emoji || '📋'}
                </span>
                <h3 className={`font-semibold text-slate-800 dark:text-slate-100 ${isSmall ? 'text-base' : 'text-lg'}`}>
                  {currentStep?.title || 'Loading...'}
                </h3>
              </div>

              {/* Member Buttons */}
              <div className={`flex items-center justify-center ${isSmall ? 'gap-2' : 'gap-3'} mt-3`}>
                {currentStepMembers.map(member => {
                  const done = currentStep ? isStepCompletedBy(activeRoutine.id, currentStep.id, member.id) : false
                  const cooldownKey = currentStep ? `${currentStep.id}:${member.id}` : ''
                  const onCooldown = cooldowns.has(cooldownKey)

                  return (
                    <button
                      key={member.id}
                      onClick={() => currentStep && toggleStepForMember(activeRoutine, currentStep.id, member.id)}
                      disabled={onCooldown || !currentStep}
                      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                        done
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-slate-100 dark:bg-slate-600 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                      } ${onCooldown ? 'opacity-50' : 'active:scale-95'}`}
                    >
                      <div className={`relative ${isSmall ? 'w-10 h-10' : 'w-12 h-12'}`}>
                        <AvatarDisplay
                          photoUrl={member.photo_url}
                          emoji={member.avatar}
                          name={member.name}
                          color={member.color}
                          size={isSmall ? 'sm' : 'md'}
                          className="w-full h-full"
                        />
                        {done && (
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      {!isTiny && (
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {member.name.split(' ')[0]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Remaining Steps Indicator */}
            {remainingSteps > 0 && !isTiny && (
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{remainingSteps} more step{remainingSteps > 1 ? 's' : ''}</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            )}
          </div>
        )}

        {/* Stars indicator */}
        {rewardsEnabled && activeRoutine.points_reward > 0 && !complete && !isSmall && (
          <div className="flex items-center justify-center gap-0.5 pb-2 text-amber-500 opacity-70">
            <Star className="w-3 h-3 fill-amber-400" />
            <span className="text-xs font-medium">+{activeRoutine.points_reward}</span>
          </div>
        )}
      </div>
    </>
  )
}
