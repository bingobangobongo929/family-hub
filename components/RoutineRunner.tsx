'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, ChevronRight, Star, Moon, Sun, Clock, PartyPopper } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineCompletion, FamilyMember } from '@/lib/database.types'

interface RoutineWithData extends Routine {
  steps: RoutineStep[]
  members: FamilyMember[]
}

interface Props {
  routine: RoutineWithData
  completions: RoutineCompletion[]
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

export default function RoutineRunner({ routine, completions: initialCompletions, isOpen, onClose, onComplete }: Props) {
  const { user } = useAuth()
  const { getMember, updateMemberPoints } = useFamily()
  const { rewardsEnabled } = useSettings()
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const [completions, setCompletions] = useState<RoutineCompletion[]>(initialCompletions)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebratingMember, setCelebratingMember] = useState<FamilyMember | null>(null)
  const [routineComplete, setRoutineComplete] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    setCompletions(initialCompletions)
    // Find the first incomplete step
    const firstIncompleteIndex = routine.steps.findIndex(step =>
      !routine.members.every(member =>
        initialCompletions.some(c => c.step_id === step.id && c.member_id === member.id)
      )
    )
    setCurrentStepIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : routine.steps.length - 1)
  }, [initialCompletions, routine])

  // Check if a member has completed the current step
  const isMemberDoneWithStep = useCallback((memberId: string, stepId: string) => {
    return completions.some(c => c.step_id === stepId && c.member_id === memberId)
  }, [completions])

  // Check if all members completed a step
  const isStepComplete = useCallback((stepId: string) => {
    return routine.members.every(member => isMemberDoneWithStep(member.id, stepId))
  }, [routine.members, isMemberDoneWithStep])

  // Check if entire routine is complete
  const isRoutineComplete = useCallback(() => {
    return routine.steps.every(step => isStepComplete(step.id))
  }, [routine.steps, isStepComplete])

  // Handle member tapping to complete their current step
  const handleMemberComplete = async (member: FamilyMember) => {
    const currentStep = routine.steps[currentStepIndex]
    if (!currentStep || isMemberDoneWithStep(member.id, currentStep.id)) return

    const newCompletion: RoutineCompletion = {
      id: `${Date.now()}-${member.id}`,
      routine_id: routine.id,
      step_id: currentStep.id,
      member_id: member.id,
      completed_date: today,
      completed_at: new Date().toISOString(),
    }

    // Optimistically update local state
    setCompletions(prev => [...prev, newCompletion])

    // Show celebration for this member
    setCelebratingMember(member)
    setShowCelebration(true)
    setTimeout(() => {
      setShowCelebration(false)
      setCelebratingMember(null)
    }, 1000)

    // Save to database
    if (user) {
      try {
        await supabase.from('routine_completions').insert({
          routine_id: routine.id,
          step_id: currentStep.id,
          member_id: member.id,
          completed_date: today,
        })
      } catch (error) {
        console.error('Error saving completion:', error)
      }
    }

    // Check if all members completed this step
    const updatedCompletions = [...completions, newCompletion]
    const allDoneWithStep = routine.members.every(m =>
      updatedCompletions.some(c => c.step_id === currentStep.id && c.member_id === m.id)
    )

    if (allDoneWithStep) {
      // Auto-advance to next step after a short delay
      setTimeout(() => {
        if (currentStepIndex < routine.steps.length - 1) {
          setCurrentStepIndex(currentStepIndex + 1)
        } else {
          // Routine complete!
          handleRoutineComplete()
        }
      }, 1200)
    }
  }

  // Handle routine completion
  const handleRoutineComplete = async () => {
    setRoutineComplete(true)

    // Award stars to members with stars_enabled
    if (rewardsEnabled && routine.points_reward > 0) {
      for (const member of routine.members) {
        if (member.stars_enabled) {
          await updateMemberPoints(member.id, routine.points_reward)
        }
      }
    }

    onComplete?.()
  }

  // Manual next step
  const handleNextStep = () => {
    if (currentStepIndex < routine.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    } else if (isRoutineComplete()) {
      handleRoutineComplete()
    }
  }

  // Get type icon
  const getTypeIcon = () => {
    switch (routine.type) {
      case 'morning': return <Sun className="w-6 h-6 text-amber-500" />
      case 'evening': return <Moon className="w-6 h-6 text-indigo-500" />
      default: return <Clock className="w-6 h-6 text-slate-500" />
    }
  }

  if (!mounted || !isOpen) return null

  const currentStep = routine.steps[currentStepIndex]
  const membersWaiting = routine.members.filter(m => !isMemberDoneWithStep(m.id, currentStep?.id || ''))
  const stepDone = currentStep ? isStepComplete(currentStep.id) : false

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {routineComplete ? (
        // Completion celebration screen
        <div className="text-center animate-in zoom-in-95 duration-300">
          <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-bounce">
            <PartyPopper className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">{t('routines.allComplete')}</h1>

          {/* Show members */}
          <div className="flex justify-center gap-4 mb-6">
            {routine.members.map(member => (
              <div key={member.id} className="text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-bold ring-4 ring-green-400"
                  style={{ backgroundColor: member.color }}
                >
                  {member.avatar || member.name.charAt(0)}
                </div>
                <p className="text-white/80 text-sm mt-2">{member.name}</p>
              </div>
            ))}
          </div>

          {/* Stars earned */}
          {rewardsEnabled && routine.points_reward > 0 && (
            <div className="flex items-center justify-center gap-2 text-amber-400 text-xl mb-8">
              <Star className="w-6 h-6 fill-current" />
              <span>{t('routines.earnedStars', { count: routine.points_reward })}</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-8 py-4 rounded-2xl bg-white text-purple-600 font-bold text-lg hover:bg-white/90 transition-colors"
          >
            {t('common.done')}
          </button>
        </div>
      ) : (
        // Active routine screen
        <div className="w-full max-w-2xl px-6">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              {getTypeIcon()}
              <span className="text-4xl">{routine.emoji}</span>
            </div>
            <h1 className="text-3xl font-bold text-white">{routine.title}</h1>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 mt-4">
              {routine.steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index < currentStepIndex
                      ? 'bg-green-400'
                      : index === currentStepIndex
                      ? 'bg-white scale-125'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Current step */}
          {currentStep && (
            <div className="text-center mb-8">
              <div
                className={`w-40 h-40 mx-auto rounded-3xl flex items-center justify-center text-8xl mb-4 transition-all ${
                  stepDone
                    ? 'bg-green-500/30 ring-4 ring-green-400'
                    : 'bg-white/10'
                }`}
              >
                {stepDone ? (
                  <Check className="w-20 h-20 text-green-400" />
                ) : (
                  currentStep.emoji
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{currentStep.title}</h2>
              {currentStep.duration_minutes > 0 && (
                <p className="text-white/60">{currentStep.duration_minutes} {t('time.minutesShort', { count: currentStep.duration_minutes })}</p>
              )}
            </div>
          )}

          {/* Member buttons */}
          <div className="mb-8">
            <p className="text-center text-white/60 mb-4">{t('routines.tapToComplete')}</p>
            <div className="flex justify-center gap-4 flex-wrap">
              {routine.members.map(member => {
                const isDone = currentStep ? isMemberDoneWithStep(member.id, currentStep.id) : false
                const isCelebrating = showCelebration && celebratingMember?.id === member.id

                return (
                  <button
                    key={member.id}
                    onClick={() => !isDone && handleMemberComplete(member)}
                    disabled={isDone}
                    className={`relative flex flex-col items-center transition-all ${
                      isDone ? 'opacity-50' : 'hover:scale-105 active:scale-95'
                    } ${isCelebrating ? 'animate-bounce' : ''}`}
                  >
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white font-bold transition-all ${
                        isDone ? 'ring-4 ring-green-400' : 'ring-4 ring-white/30'
                      }`}
                      style={{ backgroundColor: member.color }}
                    >
                      {isDone ? (
                        <Check className="w-10 h-10 text-white" />
                      ) : (
                        member.avatar || member.name.charAt(0)
                      )}
                    </div>
                    <p className="text-white text-sm mt-2 font-medium">{member.name}</p>
                    {isDone && (
                      <span className="text-green-400 text-xs">{t('routines.done')}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Status / Next button */}
          <div className="text-center">
            {stepDone ? (
              <button
                onClick={handleNextStep}
                className="px-8 py-4 rounded-2xl bg-white text-purple-600 font-bold text-lg hover:bg-white/90 transition-colors flex items-center gap-2 mx-auto"
              >
                {currentStepIndex < routine.steps.length - 1 ? (
                  <>
                    {t('routines.nextStep')}
                    <ChevronRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    {t('routines.complete')}
                    <PartyPopper className="w-5 h-5" />
                  </>
                )}
              </button>
            ) : membersWaiting.length > 0 ? (
              <p className="text-white/60">
                {t('routines.waitingFor', { names: membersWaiting.map(m => m.name).join(', ') })}
              </p>
            ) : (
              <p className="text-green-400 font-medium">{t('routines.everyoneDone')}</p>
            )}
          </div>
        </div>
      )}

      {/* Celebration overlay */}
      {showCelebration && celebratingMember && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="animate-ping">
            <Star className="w-32 h-32 text-amber-400" />
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
