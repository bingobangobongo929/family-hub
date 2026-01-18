'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ClipboardList, Check, Moon, Sun, Star } from 'lucide-react'
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
  const [celebratingMember, setCelebratingMember] = useState<string | null>(null)
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

        // Determine size based on dimensions
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
    return null // All done!
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
    }, 5000)
    cooldownTimers.current.set(cooldownKey, timer)

    if (isCompleted) {
      hapticLight() // Light haptic for uncomplete
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
      hapticSuccess() // Success haptic for completing step
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

      // Celebrate member completion
      setCelebratingMember(memberId)
      setConfettiConfig({ intensity: 'small', emoji: step?.emoji })
      setConfettiTrigger(t => t + 1)
      setTimeout(() => setCelebratingMember(null), 600)

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

      // Check if member completed all their steps
      const visibleSteps = getVisibleSteps(routine)
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

  // Calculate progress
  const totalStepMemberPairs = visibleSteps.reduce((acc, step) => {
    return acc + getStepMembers(step, activeRoutine.members).length
  }, 0)
  const completedStepMemberPairs = visibleSteps.reduce((acc, step) => {
    const stepMembers = getStepMembers(step, activeRoutine.members)
    return acc + stepMembers.filter(m => isStepCompletedBy(activeRoutine.id, step.id, m.id)).length
  }, 0)
  const progressPercent = totalStepMemberPairs > 0 ? (completedStepMemberPairs / totalStepMemberPairs) * 100 : 0

  // Get emoji size based on widget size - BIGGER!
  const getEmojiSize = () => {
    switch (widgetSize) {
      case 'tiny': return 'text-6xl'
      case 'compact': return 'text-7xl'
      case 'standard': return 'text-8xl'
      case 'large': return 'text-9xl'
      case 'xlarge': return 'text-[10rem]'
    }
  }

  // Get avatar size based on widget size - BIGGER tap targets!
  const getAvatarSize = () => {
    switch (widgetSize) {
      case 'tiny': return 'w-12 h-12'
      case 'compact': return 'w-14 h-14'
      case 'standard': return 'w-16 h-16'
      case 'large': return 'w-20 h-20'
      case 'xlarge': return 'w-24 h-24'
    }
  }

  const getAvatarSizeProp = (): 'xs' | 'sm' | 'md' | 'lg' => {
    switch (widgetSize) {
      case 'tiny': return 'sm'
      case 'compact': return 'md'
      case 'standard': return 'md'
      case 'large': return 'lg'
      case 'xlarge': return 'lg'
    }
  }

  return (
    <>
      <Confetti trigger={confettiTrigger} {...confettiConfig} />
      <div
        ref={containerRef}
        className="h-full flex flex-col bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden relative"
      >
        {/* Subtle routine type indicator */}
        <div className="absolute top-2 right-2 opacity-50">
          {activeRoutine.type === 'morning' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
        </div>

        {/* Progress ring around the edge (subtle) */}
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect
              x="1" y="1" width="98" height="98" rx="24" ry="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-200 dark:text-slate-600"
            />
            <rect
              x="1" y="1" width="98" height="98" rx="24" ry="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={`${progressPercent * 3.92} 392`}
              className="text-green-500 dark:text-green-400 transition-all duration-500"
            />
          </svg>
        </div>

        {complete ? (
          // All done state
          <div className="flex-1 flex flex-col items-center justify-center p-4 animate-pulse">
            <span className={`${getEmojiSize()} animate-bounce`}>
              {activeRoutine.type === 'morning' ? '🌟' : '🌙'}
            </span>
            {widgetSize !== 'tiny' && (
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
          // Active state - show current step
          <div className="flex-1 flex flex-col items-center justify-center p-2">
            {/* HERO: Current Step Emoji */}
            <div className="flex-1 flex items-center justify-center">
              <span
                className={`${getEmojiSize()} transition-transform duration-300 hover:scale-110 ${
                  celebratingMember ? 'animate-bounce' : ''
                }`}
              >
                {currentStep?.emoji || '📋'}
              </span>
            </div>

            {/* Children avatars as tap targets */}
            <div className={`flex items-center justify-center gap-2 ${widgetSize === 'tiny' ? 'gap-1' : 'gap-3'} pb-2`}>
              {currentStepMembers.map(member => {
                const done = currentStep ? isStepCompletedBy(activeRoutine.id, currentStep.id, member.id) : false
                const cooldownKey = currentStep ? `${currentStep.id}:${member.id}` : ''
                const onCooldown = cooldowns.has(cooldownKey)
                const isCelebrating = celebratingMember === member.id

                return (
                  <button
                    key={member.id}
                    onClick={() => currentStep && toggleStepForMember(activeRoutine, currentStep.id, member.id)}
                    disabled={onCooldown || !currentStep}
                    className={`relative ${getAvatarSize()} rounded-full transition-all duration-300 ${
                      onCooldown ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'
                    } ${isCelebrating ? 'animate-wiggle scale-125' : ''} ${
                      done ? 'ring-4 ring-green-400 ring-offset-2 ring-offset-indigo-50 dark:ring-offset-slate-700' : ''
                    }`}
                    title={member.name}
                  >
                    <AvatarDisplay
                      photoUrl={member.photo_url}
                      emoji={member.avatar}
                      name={member.name}
                      color={member.color}
                      size={getAvatarSizeProp()}
                      className="w-full h-full"
                    />
                    {done && (
                      <span className="absolute inset-0 flex items-center justify-center bg-green-500/80 rounded-full">
                        <Check className="w-1/2 h-1/2 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Step progress dots (larger sizes only) */}
            {(widgetSize === 'large' || widgetSize === 'xlarge') && (
              <div className="flex items-center justify-center gap-1.5 pb-2">
                {visibleSteps.map((step, idx) => {
                  const stepMembers = getStepMembers(step, activeRoutine.members)
                  const allDone = stepMembers.every(m => isStepCompletedBy(activeRoutine.id, step.id, m.id))
                  const someDone = stepMembers.some(m => isStepCompletedBy(activeRoutine.id, step.id, m.id))
                  const isCurrent = currentStep?.id === step.id

                  return (
                    <div
                      key={step.id}
                      className={`transition-all duration-300 ${
                        isCurrent ? 'scale-125' : ''
                      }`}
                    >
                      {widgetSize === 'xlarge' ? (
                        <span
                          className={`text-lg ${
                            allDone ? 'opacity-100' : someDone ? 'opacity-60' : 'opacity-30'
                          } ${isCurrent ? 'text-2xl' : ''}`}
                        >
                          {allDone ? '✓' : step.emoji}
                        </span>
                      ) : (
                        <div
                          className={`w-2 h-2 rounded-full transition-all ${
                            allDone
                              ? 'bg-green-500'
                              : someDone
                              ? 'bg-amber-400'
                              : 'bg-slate-300 dark:bg-slate-500'
                          } ${isCurrent ? 'w-3 h-3 ring-2 ring-indigo-400' : ''}`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Compact progress indicator (smaller sizes) */}
            {widgetSize === 'standard' && (
              <div className="flex items-center justify-center gap-1 pb-1">
                {visibleSteps.slice(0, 7).map((step, idx) => {
                  const stepMembers = getStepMembers(step, activeRoutine.members)
                  const allDone = stepMembers.every(m => isStepCompletedBy(activeRoutine.id, step.id, m.id))
                  const isCurrent = currentStep?.id === step.id

                  return (
                    <div
                      key={step.id}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        allDone ? 'bg-green-500' : isCurrent ? 'bg-indigo-500 w-2 h-2' : 'bg-slate-300 dark:bg-slate-500'
                      }`}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Stars reward indicator (if enabled and visible) */}
        {rewardsEnabled && activeRoutine.points_reward > 0 && !complete && (widgetSize === 'large' || widgetSize === 'xlarge') && (
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 text-amber-500 opacity-60">
            <Star className="w-3 h-3 fill-amber-400" />
            <span className="text-xs font-medium">+{activeRoutine.points_reward}</span>
          </div>
        )}
      </div>
    </>
  )
}
