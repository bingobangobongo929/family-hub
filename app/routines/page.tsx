'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Sun, Moon, RotateCcw, Plus, Edit2, Trash2, GripVertical, X, Star, Check, ChevronUp, ChevronDown, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import { AvatarDisplay } from '@/components/PhotoUpload'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useDevice } from '@/lib/device-context'
import { useFamily } from '@/lib/family-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineScenario, FamilyMember, ScheduleType, SCHEDULE_TYPES } from '@/lib/database.types'
import Confetti from '@/components/Confetti'
import { hapticSuccess, hapticLight, hapticMedium } from '@/lib/haptics'

// Extended routine type with steps, members, and scenarios
type RoutineWithDetails = Routine & {
  steps: RoutineStep[]
  members?: FamilyMember[]
  member_ids?: string[]
  scenarios?: RoutineScenario[]
}

// =============================================================================
// TODDLER-PROOF CONSTANTS - Designed for 3-year-olds!
// =============================================================================
const TODDLER_MODE = {
  TAP_DEBOUNCE: 1000,           // 1 second between accepted taps
  TOUCH_MOVE_THRESHOLD: 30,     // 30px movement = cancel tap (shaky fingers)
  UNDO_HOLD_DURATION: 5000,     // 5 seconds to undo (practically impossible for kids)
  POST_COMPLETE_COOLDOWN: 1500, // 1.5s before next tap registers after completion
  STEP_TRANSITION_DELAY: 800,   // 800ms pause before showing next step
  CELEBRATION_PAUSE: 1200,      // 1.2s disable inputs during celebration
}

export default function RoutinesPage() {
  const { user } = useAuth()
  const { isKitchen, isMobile, scale } = useDevice()
  const { members, getMember, updateMemberPoints } = useFamily()
  const { t } = useTranslation()
  const [routines, setRoutines] = useState<RoutineWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineWithDetails | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<RoutineWithDetails | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const [confettiConfig, setConfettiConfig] = useState<{ intensity: 'small' | 'medium' | 'big' | 'epic', emoji?: string }>({ intensity: 'small' })
  const [celebratingStep, setCelebratingStep] = useState<string | null>(null)
  const [draggingRoutine, setDraggingRoutine] = useState<string | null>(null)
  const [selectedScenarios, setSelectedScenarios] = useState<Record<string, string[]>>({}) // routineId -> scenarioIds
  const [selectorExpanded, setSelectorExpanded] = useState(false) // Collapsed by default
  const [syncedRoutineId, setSyncedRoutineId] = useState<string | null>(null) // The active routine synced across devices
  const longPressTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const lastTouchTime = useRef<number>(0) // Track last touch to prevent double-events
  const pendingToggle = useRef<Set<string>>(new Set()) // Track in-flight toggles to prevent race conditions
  const [longPressActive, setLongPressActive] = useState<string | null>(null) // Shows visual feedback during long-press
  const [stepToRemove, setStepToRemove] = useState<{ routineId: string, step: RoutineStep } | null>(null) // For removal confirmation
  const stepRemoveLongPressTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const [stepRemoveLongPressActive, setStepRemoveLongPressActive] = useState<string | null>(null)
  // Drag-to-reorder state
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null)
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null)
  // Skipped steps state (now per-step, not per-member)
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set()) // key: stepId only
  // Sound effects
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  // Swipe-to-skip state
  const [swipingStepId, setSwipingStepId] = useState<string | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const swipeStartX = useRef<number>(0)
  const swipeStartY = useRef<number>(0)
  const swipeDirectionLocked = useRef<'horizontal' | 'vertical' | null>(null)
  const SWIPE_THRESHOLD = 100 // pixels to trigger skip
  const SWIPE_DIRECTION_THRESHOLD = 10 // pixels before we determine swipe direction
  // Confirmation modals
  const [skipConfirmStep, setSkipConfirmStep] = useState<RoutineStep | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  // Long-press progress for visual feedback
  const [longPressProgress, setLongPressProgress] = useState<number>(0)
  const longPressInterval = useRef<NodeJS.Timeout | null>(null)

  // Toddler-proof state
  const [celebrationPause, setCelebrationPause] = useState(false) // Disable inputs during celebration
  const [tapRipple, setTapRipple] = useState<{ id: string, x: number, y: number } | null>(null) // Visual feedback
  const touchStartPos = useRef<{ x: number, y: number } | null>(null) // Track touch start for movement detection
  const lastCompletionTime = useRef<number>(0) // Track last completion for cooldown

  // Focus Mode navigation - swipe between steps
  const [focusedStepIndex, setFocusedStepIndex] = useState<number>(0) // Which step is currently in view
  const focusSwipeStartX = useRef<number>(0)
  const focusSwipeStartY = useRef<number>(0)
  const [focusSwipeOffset, setFocusSwipeOffset] = useState(0)
  const focusSwipeLocked = useRef<'horizontal' | 'vertical' | null>(null)
  const FOCUS_SWIPE_THRESHOLD = 80 // pixels to trigger step change

  const children = members.filter(m => m.role === 'child')
  const isWeekend = [0, 6].includes(new Date().getDay())
  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    title: '',
    emoji: '📋',
    type: 'morning' as 'morning' | 'evening' | 'custom',
    schedule_type: 'daily' as ScheduleType,
    schedule_days: [] as number[],
    member_ids: [] as string[],
    scheduled_time: '',
    points_reward: 1,
    steps: [{ title: '', emoji: '✨' }]
  })

  // Helper to check if a routine applies today
  const routineAppliesToday = (routine: Routine): boolean => {
    const today = new Date().getDay() // 0 = Sunday, 6 = Saturday
    const scheduleType = routine.schedule_type || 'daily'

    switch (scheduleType) {
      case 'daily':
        return true
      case 'weekdays':
        return today >= 1 && today <= 5 // Mon-Fri
      case 'weekends':
        return today === 0 || today === 6 // Sat-Sun
      case 'custom':
        return routine.schedule_days?.includes(today) ?? true
      case 'manual':
        return false // Manual routines don't auto-apply - must be triggered
      default:
        return true
    }
  }

  const fetchRoutines = useCallback(async () => {
    if (!user) {
      setRoutines([])
      setSelectedRoutine(null)
      setLoading(false)
      return
    }

    try {
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (routinesError) throw routinesError

      const routinesWithDetails = await Promise.all(
        (routinesData || []).map(async (routine) => {
          const [stepsResult, membersResult, scenariosResult] = await Promise.all([
            supabase
              .from('routine_steps')
              .select('*')
              .eq('routine_id', routine.id)
              .order('sort_order', { ascending: true }),
            supabase
              .from('routine_members')
              .select('*, member:family_members(*)')
              .eq('routine_id', routine.id),
            supabase
              .from('routine_scenarios')
              .select('*')
              .eq('routine_id', routine.id)
              .order('sort_order', { ascending: true })
          ])

          const memberData = (membersResult.data || [])
            .map((rm: { member: FamilyMember }) => rm.member)
            .filter(Boolean) as FamilyMember[]

          return {
            ...routine,
            steps: stepsResult.data || [],
            members: memberData,
            member_ids: memberData.map(m => m.id),
            scenarios: scenariosResult.data || []
          }
        })
      )

      setRoutines(routinesWithDetails as RoutineWithDetails[])

      // Load daily state for scenarios
      const today = new Date().toISOString().split('T')[0]
      const { data: dailyStates } = await supabase
        .from('routine_daily_state')
        .select('*')
        .eq('date', today)

      // Set up selected scenarios from daily state or defaults
      const newSelectedScenarios: Record<string, string[]> = {}
      for (const routine of routinesWithDetails) {
        const dailyState = dailyStates?.find(ds => ds.routine_id === routine.id)
        if (dailyState?.selected_scenario_ids?.length) {
          newSelectedScenarios[routine.id] = dailyState.selected_scenario_ids
        } else if (routine.scenarios?.length) {
          // Apply smart defaults based on day
          const defaultScenarios = routine.scenarios.filter((s: RoutineScenario) =>
            isWeekend ? s.is_default_weekend : s.is_default_weekday
          )
          newSelectedScenarios[routine.id] = defaultScenarios.map((s: RoutineScenario) => s.id)
        }
      }
      setSelectedScenarios(newSelectedScenarios)

      // Load the active routine from synced state
      const { data: activeState } = await supabase
        .from('active_routine_state')
        .select('routine_id')
        .eq('date', today)
        .single()

      if (activeState?.routine_id) {
        // Use the synced active routine
        const activeRoutine = routinesWithDetails.find(r => r.id === activeState.routine_id)
        setSyncedRoutineId(activeState.routine_id)
        setSelectedRoutine(activeRoutine || null)
      } else {
        // No active routine yet - auto-select based on time of day
        const todayRoutines = routinesWithDetails.filter(routineAppliesToday)
        const hour = new Date().getHours()
        const morning = todayRoutines.find(r => r.type === 'morning')
        const evening = todayRoutines.find(r => r.type === 'evening')
        const defaultRoutine = hour < 14
          ? (morning || todayRoutines[0] || null)
          : (evening || todayRoutines[0] || null)
        setSelectedRoutine(defaultRoutine)
        setSyncedRoutineId(null)
      }
    } catch (error) {
      console.error('Error fetching routines:', error)
      setRoutines([])
      setSelectedRoutine(null)
    }
    setLoading(false)
  }, [user, isWeekend, today])

  const loadCompletions = useCallback(async () => {
    if (!user) {
      setCompletedSteps(new Set())
      return
    }

    const today = new Date().toISOString().split('T')[0]

    try {
      // Use API route to bypass RLS (same as save/delete)
      const response = await fetch(`/api/routines/completion?completed_date=${today}`)
      if (response.ok) {
        const { data } = await response.json()
        if (data) {
          setCompletedSteps(new Set(data.map((c: { step_id: string; member_id: string }) => `${c.step_id}:${c.member_id}`)))
        }
      } else {
        console.error('Error loading completions:', await response.text())
      }
    } catch (error) {
      console.error('Error loading completions:', error)
    }
  }, [user])

  useEffect(() => {
    fetchRoutines()
    loadCompletions()
  }, [fetchRoutines, loadCompletions])

  // Refetch completions when page becomes visible (user returns from minimized browser)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadCompletions()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [loadCompletions])

  // DISABLED: Real-time subscription was interfering with optimistic updates
  // Cross-device sync will use polling instead (on visibility change)
  // TODO: Re-enable with proper conflict resolution once core completion works

  // Real-time subscription for active routine sync
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('active-routine-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_routine_state',
          filter: `date=eq.${today}`
        },
        (payload) => {
          // Another device changed the active routine
          const newRoutineId = (payload.new as { routine_id?: string })?.routine_id
          if (newRoutineId && newRoutineId !== syncedRoutineId) {
            setSyncedRoutineId(newRoutineId)
            const routine = routines.find(r => r.id === newRoutineId)
            if (routine) {
              setSelectedRoutine(routine)
              setSelectorExpanded(false) // Collapse when another user selects
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, today, syncedRoutineId, routines])

  // Select a routine and sync across devices
  const selectRoutineAndSync = async (routine: RoutineWithDetails) => {
    if (!user) return

    setSelectedRoutine(routine)
    setSyncedRoutineId(routine.id)
    setSelectorExpanded(false) // Collapse after selection

    // Save to database for sync
    await supabase
      .from('active_routine_state')
      .upsert({
        user_id: user.id,
        routine_id: routine.id,
        date: today,
        started_by: user.id
      }, { onConflict: 'user_id,date' })
  }

  const toggleStepForMember = async (stepId: string, memberId: string) => {
    if (!user || !selectedRoutine) return

    const todayStr = new Date().toISOString().split('T')[0]
    const key = `${stepId}:${memberId}`
    const routineId = selectedRoutine.id

    // CRITICAL: Prevent double-toggle - check and set lock atomically
    if (pendingToggle.current.has(key)) {
      console.log('[TOGGLE] BLOCKED - already in progress:', key)
      return
    }
    pendingToggle.current.add(key)
    console.log('[TOGGLE] Lock acquired:', key)

    // Check current state ONCE (after acquiring lock)
    const isCurrentlyCompleted = completedSteps.has(key)

    console.log('[TOGGLE] Start:', { key, isCurrentlyCompleted, stateSize: completedSteps.size })

    if (isCurrentlyCompleted) {
      // === UNCOMPLETE ===
      hapticLight()

      // Update UI immediately (optimistic)
      setCompletedSteps(prev => {
        const next = new Set(prev)
        next.delete(key)
        console.log('[TOGGLE] UI updated (uncomplete):', { key, prevSize: prev.size, nextSize: next.size })
        return next
      })

      // Update DB via API (bypasses RLS)
      try {
        const response = await fetch('/api/routines/completion', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step_id: stepId, member_id: memberId, completed_date: todayStr })
        })

        if (!response.ok) {
          const error = await response.json()
          console.error('[TOGGLE] API delete error:', error)
          setCompletedSteps(prev => new Set([...prev, key])) // Revert
        } else {
          console.log('[TOGGLE] API delete success')
        }
      } catch (error) {
        console.error('[TOGGLE] API delete error:', error)
        setCompletedSteps(prev => new Set([...prev, key])) // Revert
      } finally {
        // Release lock
        pendingToggle.current.delete(key)
        console.log('[TOGGLE] Lock released:', key)
      }
    } else {
      // === COMPLETE ===
      hapticSuccess()
      playSound('complete')

      // Celebration
      const step = selectedRoutine.steps.find(s => s.id === stepId)
      setCelebratingStep(stepId)
      setConfettiConfig({ intensity: 'small', emoji: step?.emoji })
      setConfettiTrigger(t => t + 1)
      setTimeout(() => setCelebratingStep(null), 600)

      // Update UI immediately (optimistic)
      setCompletedSteps(prev => {
        const next = new Set(prev)
        next.add(key)
        console.log('[TOGGLE] UI updated (complete):', { key, prevSize: prev.size, nextSize: next.size })
        return next
      })

      // Update DB via API (bypasses RLS)
      try {
        const response = await fetch('/api/routines/completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routine_id: routineId, step_id: stepId, member_id: memberId, completed_date: todayStr })
        })

        if (!response.ok) {
          const error = await response.json()
          console.error('[TOGGLE] API upsert error:', error)
          // Revert optimistic update
          setCompletedSteps(prev => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        } else {
          console.log('[TOGGLE] API upsert success - completion persisted')
          // Note: Routine completion rewards handled separately to avoid state conflicts
        }
      } catch (error) {
        console.error('[TOGGLE] API upsert error:', error)
        setCompletedSteps(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        }) // Revert
      } finally {
        // Release lock
        pendingToggle.current.delete(key)
        console.log('[TOGGLE] Lock released:', key)
      }
    }
  }

  // Long-press handling for undo protection (toddler-proof: 5 seconds to undo!)
  const LONG_PRESS_DURATION = TODDLER_MODE.UNDO_HOLD_DURATION
  const lastClickTime = useRef<Map<string, number>>(new Map())

  // Toddler-proof tap handler with celebration pause and movement detection
  const handleMemberClick = (e: React.MouseEvent | React.TouchEvent, stepId: string, memberId: string) => {
    const key = `${stepId}:${memberId}`
    const now = Date.now()
    const lastClick = lastClickTime.current.get(key) || 0

    // Block during celebration pause
    if (celebrationPause) {
      console.log('[TODDLER] Blocked - celebration in progress')
      return
    }

    // Block if multi-touch detected (2+ fingers)
    if ('touches' in e && e.touches.length > 1) {
      console.log('[TODDLER] Blocked - multi-touch detected')
      return
    }

    // Toddler-proof debounce (1 second between taps)
    if (now - lastClick < TODDLER_MODE.TAP_DEBOUNCE) {
      console.log('[TODDLER] Blocked - debounce')
      return
    }

    // Post-completion cooldown (1.5 seconds after any completion)
    if (now - lastCompletionTime.current < TODDLER_MODE.POST_COMPLETE_COOLDOWN) {
      console.log('[TODDLER] Blocked - post-completion cooldown')
      return
    }

    lastClickTime.current.set(key, now)

    const isCompleted = completedSteps.has(key)

    if (isCompleted) {
      // Already done - tap does nothing, must long-press 5s to undo
      return
    }

    // Show tap ripple feedback
    if ('clientX' in e) {
      setTapRipple({ id: key, x: e.clientX, y: e.clientY })
      setTimeout(() => setTapRipple(null), 600)
    }

    // Not completed - mark as done!
    lastCompletionTime.current = now
    toggleStepForMember(stepId, memberId)

    // Trigger celebration pause
    setCelebrationPause(true)
    setTimeout(() => setCelebrationPause(false), TODDLER_MODE.CELEBRATION_PAUSE)
  }

  const handleStepPressStart = (e: React.TouchEvent | React.MouseEvent, stepId: string, memberId: string) => {
    const key = `${stepId}:${memberId}`
    const isCompleted = completedSteps.has(key)

    // Track touch start position for movement detection
    if ('touches' in e) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else {
      touchStartPos.current = { x: e.clientX, y: e.clientY }
    }

    // Only handle long-press for completed steps (to undo)
    if (isCompleted) {
      e.preventDefault()
      setLongPressActive(key)
      setLongPressProgress(0)

      // Start progress animation
      const startTime = Date.now()
      longPressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1)
        setLongPressProgress(progress)

        if (progress >= 1) {
          // Long press completed (5 seconds) - do the undo
          if (navigator.vibrate) navigator.vibrate([50, 50, 50])
          toggleStepForMember(stepId, memberId)
          setLongPressActive(null)
          setLongPressProgress(0)
          if (longPressInterval.current) clearInterval(longPressInterval.current)
        }
      }, 50)

      longPressTimers.current.set(key, longPressInterval.current as unknown as NodeJS.Timeout)
    }
  }

  const handleStepPressMove = (e: React.TouchEvent, stepId: string, memberId: string) => {
    // Cancel long-press if finger moves too far (toddler shaky fingers)
    if (touchStartPos.current && 'touches' in e) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x)
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y)
      if (dx > TODDLER_MODE.TOUCH_MOVE_THRESHOLD || dy > TODDLER_MODE.TOUCH_MOVE_THRESHOLD) {
        handleStepPressEnd(stepId, memberId)
      }
    }
  }

  const handleStepPressEnd = (stepId: string, memberId: string) => {
    const key = `${stepId}:${memberId}`
    touchStartPos.current = null
    // Cancel long-press if released early
    if (longPressInterval.current) {
      clearInterval(longPressInterval.current)
      longPressInterval.current = null
    }
    const timer = longPressTimers.current.get(key)
    if (timer) {
      clearInterval(timer as unknown as NodeJS.Timeout)
      longPressTimers.current.delete(key)
    }
    setLongPressActive(null)
    setLongPressProgress(0)
  }

  const handleStepPressCancel = (stepId: string, memberId: string) => {
    // Same as press end - cancel the long-press
    handleStepPressEnd(stepId, memberId)
  }

  // Long-press on step emoji to trigger removal (kid-friendly: 3 seconds)
  const STEP_REMOVE_LONG_PRESS_DURATION = 3000 // 3 seconds - prevents accidental deletions

  const handleStepEmojiPressStart = (e: React.TouchEvent | React.MouseEvent, routineId: string, step: RoutineStep) => {
    e.preventDefault()
    const key = step.id
    setStepRemoveLongPressActive(key)

    const timer = setTimeout(() => {
      // Long press completed - show removal confirmation
      if (navigator.vibrate) navigator.vibrate([50, 30, 50])
      setStepToRemove({ routineId, step })
      setStepRemoveLongPressActive(null)
      stepRemoveLongPressTimers.current.delete(key)
    }, STEP_REMOVE_LONG_PRESS_DURATION)
    stepRemoveLongPressTimers.current.set(key, timer)
  }

  const handleStepEmojiPressEnd = (stepId: string) => {
    const timer = stepRemoveLongPressTimers.current.get(stepId)
    if (timer) {
      clearTimeout(timer)
      stepRemoveLongPressTimers.current.delete(stepId)
      setStepRemoveLongPressActive(null)
    }
  }

  const removeStepFromRoutine = async () => {
    if (!stepToRemove || !user) return

    try {
      // Delete the step
      await supabase
        .from('routine_steps')
        .delete()
        .eq('id', stepToRemove.step.id)

      // Also delete any completions for this step
      await supabase
        .from('routine_completions')
        .delete()
        .eq('step_id', stepToRemove.step.id)

      // Refresh routines
      await fetchRoutines()
      await loadCompletions()

      setStepToRemove(null)
    } catch (error) {
      console.error('Error removing step:', error)
    }
  }

  // === SOUND EFFECTS ===
  const playSound = useCallback((type: 'complete' | 'skip' | 'allDone' | 'epic') => {
    if (!soundEnabled) return

    // Initialize AudioContext on first use (must be after user interaction)
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const ctx = audioContextRef.current

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(0.3, now)

    switch (type) {
      case 'complete':
        // Pleasant ding
        oscillator.frequency.setValueAtTime(880, now) // A5
        oscillator.frequency.setValueAtTime(1108, now + 0.1) // C#6
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
        oscillator.start(now)
        oscillator.stop(now + 0.3)
        break
      case 'skip':
        // Soft whoosh down
        oscillator.frequency.setValueAtTime(400, now)
        oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.2)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
        oscillator.start(now)
        oscillator.stop(now + 0.2)
        break
      case 'allDone':
        // Triumphant melody
        oscillator.frequency.setValueAtTime(523, now) // C5
        oscillator.frequency.setValueAtTime(659, now + 0.15) // E5
        oscillator.frequency.setValueAtTime(784, now + 0.3) // G5
        oscillator.frequency.setValueAtTime(1047, now + 0.45) // C6
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
        oscillator.start(now)
        oscillator.stop(now + 0.6)
        break
      case 'epic':
        // Fanfare
        oscillator.frequency.setValueAtTime(392, now) // G4
        oscillator.frequency.setValueAtTime(523, now + 0.1) // C5
        oscillator.frequency.setValueAtTime(659, now + 0.2) // E5
        oscillator.frequency.setValueAtTime(784, now + 0.3) // G5
        oscillator.frequency.setValueAtTime(1047, now + 0.5) // C6
        gainNode.gain.setValueAtTime(0.4, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
        oscillator.start(now)
        oscillator.stop(now + 0.8)
        break
    }
  }, [soundEnabled])

  // Load sound preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('routine-sounds-enabled')
    if (saved !== null) {
      setSoundEnabled(saved === 'true')
    }
  }, [])

  // === DRAG TO REORDER STEPS ===
  const handleStepDragStart = (e: React.DragEvent, stepId: string) => {
    setDraggingStepId(stepId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', stepId)
  }

  const handleStepDragOver = (e: React.DragEvent, stepId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (stepId !== draggingStepId) {
      setDragOverStepId(stepId)
    }
  }

  const handleStepDragLeave = () => {
    setDragOverStepId(null)
  }

  const handleStepDrop = async (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault()
    setDragOverStepId(null)
    setDraggingStepId(null)

    if (!selectedRoutine || !draggingStepId || draggingStepId === targetStepId) return

    const visibleSteps = getVisibleSteps(selectedRoutine)
    const dragIndex = visibleSteps.findIndex(s => s.id === draggingStepId)
    const dropIndex = visibleSteps.findIndex(s => s.id === targetStepId)

    if (dragIndex === -1 || dropIndex === -1) return

    // Reorder locally first for instant feedback
    const newSteps = [...visibleSteps]
    const [removed] = newSteps.splice(dragIndex, 1)
    newSteps.splice(dropIndex, 0, removed)

    // Update sort_order in database
    try {
      await Promise.all(
        newSteps.map((step, index) =>
          supabase
            .from('routine_steps')
            .update({ sort_order: index })
            .eq('id', step.id)
        )
      )
      // Refresh to get new order
      await fetchRoutines()
    } catch (error) {
      console.error('Error reordering steps:', error)
    }
  }

  const handleStepDragEnd = () => {
    setDraggingStepId(null)
    setDragOverStepId(null)
  }

  // === SKIP STEP FOR TODAY (whole step, all members) ===
  const loadSkippedSteps = useCallback(async () => {
    if (!user) return

    try {
      const { data } = await supabase
        .from('routine_completion_log')
        .select('step_id')
        .eq('completed_date', today)
        .eq('action', 'skipped')

      if (data) {
        // Get unique step IDs (step is skipped for everyone)
        setSkippedSteps(new Set(data.map(s => s.step_id)))
      }
    } catch (error) {
      console.error('Error loading skipped steps:', error)
    }
  }, [user, today])

  useEffect(() => {
    loadSkippedSteps()
  }, [loadSkippedSteps])

  // Skip entire step for today (all members)
  const skipStepForToday = async (step: RoutineStep) => {
    if (!user || !selectedRoutine) return

    const newSkipped = new Set(skippedSteps)
    newSkipped.add(step.id)
    setSkippedSteps(newSkipped)
    playSound('skip')
    hapticMedium()

    // Save to DB - one record per step (not per member)
    await supabase
      .from('routine_completion_log')
      .insert({
        routine_id: selectedRoutine.id,
        step_id: step.id,
        member_id: selectedRoutine.member_ids?.[0] || user.id, // Use first member or user as reference
        completed_date: today,
        completed_by: user.id,
        action: 'skipped',
        notes: 'Skipped for all members'
      })

    setSkipConfirmStep(null)
  }

  // Unskip step (restore it)
  const unskipStep = async (stepId: string) => {
    if (!user) return

    const newSkipped = new Set(skippedSteps)
    newSkipped.delete(stepId)
    setSkippedSteps(newSkipped)

    await supabase
      .from('routine_completion_log')
      .delete()
      .eq('step_id', stepId)
      .eq('completed_date', today)
      .eq('action', 'skipped')
  }

  const isStepSkipped = (stepId: string) => {
    return skippedSteps.has(stepId)
  }

  // === SWIPE TO SKIP HANDLERS ===
  const handleSwipeStart = (e: React.TouchEvent, stepId: string) => {
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
    swipeDirectionLocked.current = null // Reset direction lock
    setSwipingStepId(stepId)
  }

  const handleSwipeMove = (e: React.TouchEvent) => {
    if (!swipingStepId) return

    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const diffX = swipeStartX.current - currentX // Positive = swiping left
    const diffY = Math.abs(currentY - swipeStartY.current)

    // Determine swipe direction if not yet locked
    if (swipeDirectionLocked.current === null) {
      const totalMovement = Math.max(Math.abs(diffX), diffY)
      if (totalMovement > SWIPE_DIRECTION_THRESHOLD) {
        // Lock direction based on which axis has more movement
        if (diffY > Math.abs(diffX)) {
          // More vertical movement = scrolling, not swiping
          swipeDirectionLocked.current = 'vertical'
          setSwipingStepId(null)
          setSwipeOffset(0)
          return
        } else {
          // More horizontal movement = intentional swipe
          swipeDirectionLocked.current = 'horizontal'
        }
      }
    }

    // Only update swipe offset if locked to horizontal
    if (swipeDirectionLocked.current === 'horizontal' && diffX > 0) {
      setSwipeOffset(Math.min(diffX, SWIPE_THRESHOLD + 50))
    }
  }

  const handleSwipeEnd = (step: RoutineStep) => {
    if (swipeDirectionLocked.current === 'horizontal' && swipeOffset >= SWIPE_THRESHOLD) {
      // Trigger skip confirmation
      setSkipConfirmStep(step)
    }
    setSwipeOffset(0)
    setSwipingStepId(null)
    swipeDirectionLocked.current = null
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      longPressTimers.current.forEach(timer => clearTimeout(timer))
      stepRemoveLongPressTimers.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  // Update streak for a member completing a routine
  const updateStreak = async (memberId: string, routineId: string, completedDate: string) => {
    try {
      const { data: streak } = await supabase
        .from('member_streaks')
        .select('*')
        .eq('member_id', memberId)
        .eq('routine_id', routineId)
        .single()

      if (!streak) {
        // First time - create streak record
        await supabase.from('member_streaks').insert({
          member_id: memberId,
          routine_id: routineId,
          current_streak: 1,
          longest_streak: 1,
          last_completed_date: completedDate,
          streak_started_date: completedDate
        })
        return
      }

      const lastDate = new Date(streak.last_completed_date)
      const newDate = new Date(completedDate)
      const diffDays = Math.floor((newDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        // Consecutive day - extend streak
        const newStreak = streak.current_streak + 1
        await supabase.from('member_streaks').update({
          current_streak: newStreak,
          longest_streak: Math.max(newStreak, streak.longest_streak),
          last_completed_date: completedDate
        }).eq('id', streak.id)
      } else if (diffDays > 1) {
        // Missed days - reset streak (but preserve longest_streak record)
        await supabase.from('member_streaks').update({
          current_streak: 1,
          streak_started_date: completedDate,
          last_completed_date: completedDate
        }).eq('id', streak.id)
      }
      // diffDays === 0 means same day - no change needed
    } catch (error) {
      console.error('Error updating streak:', error)
    }
  }

  const toggleStep = async (stepId: string) => {
    if (!user) return
    const routineMembers = selectedRoutine?.member_ids || []
    for (const memberId of routineMembers) {
      await toggleStepForMember(stepId, memberId)
    }
  }

  // Toggle scenario selection for a routine
  const toggleScenario = async (routineId: string, scenarioId: string) => {
    if (!user) return

    const currentScenarios = selectedScenarios[routineId] || []
    const newScenarios = currentScenarios.includes(scenarioId)
      ? currentScenarios.filter(id => id !== scenarioId)
      : [...currentScenarios, scenarioId]

    setSelectedScenarios(prev => ({
      ...prev,
      [routineId]: newScenarios
    }))

    // Save to daily state
    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('routine_daily_state')
      .upsert({
        routine_id: routineId,
        date: today,
        selected_scenario_ids: newScenarios
      }, { onConflict: 'routine_id,date' })
  }

  // Check if a step should be visible based on selected scenarios
  const isStepVisibleForScenarios = (step: RoutineStep, routineId: string): boolean => {
    // If step has no scenario restriction, always show
    if (!step.scenario_ids || step.scenario_ids.length === 0) {
      return true
    }
    // Check if any selected scenario matches the step's scenarios
    const currentScenarios = selectedScenarios[routineId] || []
    return step.scenario_ids.some(id => currentScenarios.includes(id))
  }

  // Check if a step applies to a specific member
  const stepAppliesToMember = (step: RoutineStep, memberId: string): boolean => {
    // If step has no member restriction, applies to all
    if (!step.member_ids || step.member_ids.length === 0) {
      return true
    }
    return step.member_ids.includes(memberId)
  }

  // Get visible steps for the current routine and selected scenarios
  const getVisibleSteps = (routine: RoutineWithDetails): RoutineStep[] => {
    return routine.steps.filter(step => isStepVisibleForScenarios(step, routine.id))
  }

  // Get members that a step applies to
  const getStepMembers = (step: RoutineStep, routineMembers: FamilyMember[]): FamilyMember[] => {
    if (!step.member_ids || step.member_ids.length === 0) {
      return routineMembers
    }
    return routineMembers.filter(m => step.member_ids!.includes(m.id))
  }

  const resetRoutine = async () => {
    if (!selectedRoutine || !user) return

    const today = new Date().toISOString().split('T')[0]
    const stepIds = selectedRoutine.steps.map(s => s.id)
    const newCompleted = new Set([...completedSteps].filter(key => {
      const stepId = key.split(':')[0]
      return !stepIds.includes(stepId)
    }))

    await supabase
      .from('routine_completions')
      .delete()
      .in('step_id', stepIds)
      .eq('completed_date', today)

    setCompletedSteps(newCompleted)
  }

  const handleAddRoutine = async () => {
    if (!user || !formData.title || formData.steps.every(s => !s.title)) return

    const validSteps = formData.steps.filter(s => s.title.trim())

    try {
      const { data: routineData, error: routineError } = await supabase
        .from('routines')
        .insert({
          title: formData.title,
          emoji: formData.emoji,
          type: formData.type,
          schedule_type: formData.schedule_type,
          schedule_days: formData.schedule_type === 'custom' ? formData.schedule_days : null,
          points_reward: formData.points_reward,
          scheduled_time: formData.scheduled_time || null,
          sort_order: routines.length
        })
        .select()
        .single()

      if (routineError) throw routineError

      const stepsToInsert = validSteps.map((s, i) => ({
        routine_id: routineData.id,
        title: s.title,
        emoji: s.emoji,
        duration_minutes: 0,
        sort_order: i
      }))

      const { error: stepsError } = await supabase
        .from('routine_steps')
        .insert(stepsToInsert)

      if (stepsError) throw stepsError

      if (formData.member_ids.length > 0) {
        const membersToInsert = formData.member_ids.map(memberId => ({
          routine_id: routineData.id,
          member_id: memberId
        }))

        const { error: membersError } = await supabase
          .from('routine_members')
          .insert(membersToInsert)

        if (membersError) throw membersError
      }

      await fetchRoutines()
      setShowAddModal(false)
      resetForm()
    } catch (error) {
      console.error('Error adding routine:', error)
    }
  }

  const handleEditRoutine = async () => {
    if (!user || !editingRoutine || !formData.title) return

    const validSteps = formData.steps.filter(s => s.title.trim())

    try {
      const { error: routineError } = await supabase
        .from('routines')
        .update({
          title: formData.title,
          emoji: formData.emoji,
          type: formData.type,
          schedule_type: formData.schedule_type,
          schedule_days: formData.schedule_type === 'custom' ? formData.schedule_days : null,
          points_reward: formData.points_reward,
          scheduled_time: formData.scheduled_time || null
        })
        .eq('id', editingRoutine.id)

      if (routineError) throw routineError

      await supabase
        .from('routine_steps')
        .delete()
        .eq('routine_id', editingRoutine.id)

      const stepsToInsert = validSteps.map((s, i) => ({
        routine_id: editingRoutine.id,
        title: s.title,
        emoji: s.emoji,
        duration_minutes: 0,
        sort_order: i
      }))

      await supabase
        .from('routine_steps')
        .insert(stepsToInsert)

      await supabase
        .from('routine_members')
        .delete()
        .eq('routine_id', editingRoutine.id)

      if (formData.member_ids.length > 0) {
        const membersToInsert = formData.member_ids.map(memberId => ({
          routine_id: editingRoutine.id,
          member_id: memberId
        }))

        await supabase
          .from('routine_members')
          .insert(membersToInsert)
      }

      await fetchRoutines()
      setShowEditModal(false)
      setEditingRoutine(null)
      resetForm()
    } catch (error) {
      console.error('Error updating routine:', error)
    }
  }

  const handleDeleteRoutine = async (routine: Routine) => {
    if (!user || !confirm('Delete this routine?')) return

    try {
      await supabase.from('routine_steps').delete().eq('routine_id', routine.id)
      await supabase.from('routines').delete().eq('id', routine.id)
      await fetchRoutines()
    } catch (error) {
      console.error('Error deleting routine:', error)
    }
  }

  const openEditModal = (routine: RoutineWithDetails) => {
    setEditingRoutine(routine)
    setFormData({
      title: routine.title,
      emoji: routine.emoji,
      type: routine.type,
      schedule_type: routine.schedule_type || 'daily',
      schedule_days: routine.schedule_days || [],
      member_ids: routine.member_ids || [],
      scheduled_time: routine.scheduled_time || '',
      points_reward: routine.points_reward,
      steps: routine.steps.map(s => ({
        title: s.title,
        emoji: s.emoji
      }))
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      emoji: '📋',
      type: 'morning',
      schedule_type: 'daily',
      schedule_days: [],
      member_ids: [],
      scheduled_time: '',
      points_reward: 1,
      steps: [{ title: '', emoji: '✨' }]
    })
  }

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, { title: '', emoji: '✨' }]
    })
  }

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index)
    })
  }

  const updateStep = (index: number, field: string, value: string) => {
    const newSteps = [...formData.steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setFormData({ ...formData, steps: newSteps })
  }

  const isStepCompleteForMember = (stepId: string, memberId: string) => {
    return completedSteps.has(`${stepId}:${memberId}`)
  }

  const isStepComplete = (stepId: string, memberIds: string[] = []) => {
    if (memberIds.length === 0) {
      return completedSteps.has(`${stepId}:all`)
    }
    return memberIds.every(mid => completedSteps.has(`${stepId}:${mid}`))
  }

  const getProgress = (routine: RoutineWithDetails) => {
    const memberIds = routine.member_ids || []
    const visibleSteps = getVisibleSteps(routine)
    const completed = visibleSteps.filter(s => isStepComplete(s.id, memberIds)).length
    return { completed, total: visibleSteps.length }
  }

  // Get current step (first step where not all members have completed) - for Focus Mode
  const getCurrentStep = (routine: RoutineWithDetails): RoutineStep | null => {
    const visibleSteps = getVisibleSteps(routine).filter(s => !isStepSkipped(s.id))
    const routineMembers = routine.members || []

    for (const step of visibleSteps) {
      const stepMembers = getStepMembers(step, routineMembers)
      const allDone = stepMembers.every(m => isStepCompleteForMember(step.id, m.id))
      if (!allDone) return step
    }
    return null // All done!
  }

  // Check if routine is fully complete
  const isRoutineComplete = (routine: RoutineWithDetails): boolean => {
    const visibleSteps = getVisibleSteps(routine).filter(s => !isStepSkipped(s.id))
    const routineMembers = routine.members || []
    if (visibleSteps.length === 0 || routineMembers.length === 0) return false

    return visibleSteps.every(step => {
      const stepMembers = getStepMembers(step, routineMembers)
      return stepMembers.every(m => isStepCompleteForMember(step.id, m.id))
    })
  }

  // Focus Mode swipe handlers - navigate between steps
  const handleFocusSwipeStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    focusSwipeStartX.current = touch.clientX
    focusSwipeStartY.current = touch.clientY
    focusSwipeLocked.current = null
    setFocusSwipeOffset(0)
  }

  const handleFocusSwipeMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    const dx = touch.clientX - focusSwipeStartX.current
    const dy = touch.clientY - focusSwipeStartY.current

    // Determine swipe direction if not locked
    if (!focusSwipeLocked.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        focusSwipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      }
    }

    // Only track horizontal swipes
    if (focusSwipeLocked.current === 'horizontal') {
      e.preventDefault() // Prevent scroll
      setFocusSwipeOffset(dx)
    }
  }

  const handleFocusSwipeEnd = (visibleStepsCount: number) => {
    if (focusSwipeLocked.current === 'horizontal') {
      if (focusSwipeOffset < -FOCUS_SWIPE_THRESHOLD && focusedStepIndex < visibleStepsCount - 1) {
        // Swipe left - next step
        setFocusedStepIndex(prev => Math.min(prev + 1, visibleStepsCount - 1))
        hapticLight()
      } else if (focusSwipeOffset > FOCUS_SWIPE_THRESHOLD && focusedStepIndex > 0) {
        // Swipe right - previous step
        setFocusedStepIndex(prev => Math.max(prev - 1, 0))
        hapticLight()
      }
    }
    setFocusSwipeOffset(0)
    focusSwipeLocked.current = null
  }

  // Reset focused step index when routine changes or auto-advance after completion
  useEffect(() => {
    if (selectedRoutine) {
      const visibleSteps = getVisibleSteps(selectedRoutine).filter(s => !isStepSkipped(s.id))
      const routineMembers = selectedRoutine.members || []

      // Find first incomplete step
      let firstIncompleteIndex = visibleSteps.findIndex(step => {
        const stepMembers = getStepMembers(step, routineMembers)
        return !stepMembers.every(m => isStepCompleteForMember(step.id, m.id))
      })

      // If all complete, stay on last step
      if (firstIncompleteIndex === -1) firstIncompleteIndex = Math.max(0, visibleSteps.length - 1)

      setFocusedStepIndex(firstIncompleteIndex)
    }
  }, [selectedRoutine?.id]) // Only reset when routine changes

  // Drag and drop handlers for routine reordering
  const handleDragStart = (e: React.DragEvent, routineId: string) => {
    setDraggingRoutine(routineId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggingRoutine || draggingRoutine === targetId) {
      setDraggingRoutine(null)
      return
    }

    const dragIndex = routines.findIndex(r => r.id === draggingRoutine)
    const dropIndex = routines.findIndex(r => r.id === targetId)

    if (dragIndex === -1 || dropIndex === -1) {
      setDraggingRoutine(null)
      return
    }

    const newRoutines = [...routines]
    const [removed] = newRoutines.splice(dragIndex, 1)
    newRoutines.splice(dropIndex, 0, removed)

    // Update sort_order for all routines
    const updatedRoutines = newRoutines.map((r, i) => ({ ...r, sort_order: i }))
    setRoutines(updatedRoutines)
    setDraggingRoutine(null)

    // Persist to database
    if (user) {
      for (let i = 0; i < updatedRoutines.length; i++) {
        await supabase
          .from('routines')
          .update({ sort_order: i })
          .eq('id', updatedRoutines[i].id)
      }
    }
  }

  const moveRoutine = async (routineId: string, direction: 'up' | 'down') => {
    const index = routines.findIndex(r => r.id === routineId)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === routines.length - 1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const newRoutines = [...routines]
    const [removed] = newRoutines.splice(index, 1)
    newRoutines.splice(newIndex, 0, removed)

    const updatedRoutines = newRoutines.map((r, i) => ({ ...r, sort_order: i }))
    setRoutines(updatedRoutines)

    if (user) {
      for (let i = 0; i < updatedRoutines.length; i++) {
        await supabase
          .from('routines')
          .update({ sort_order: i })
          .eq('id', updatedRoutines[i].id)
      }
    }
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
    <>
      <Confetti trigger={confettiTrigger} {...confettiConfig} />
      <div className="page-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="page-header">{t('routines.title')}</h1>
            <p className="page-subtitle">{t('routines.subtitle')}</p>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" />
            {t('routines.addRoutine')}
          </Button>
        </div>

        {/* Collapsible Routine Selector - Synced across devices */}
        <div className="mb-6">
          {/* Current routine header / tap to expand */}
          <button
            onClick={() => setSelectorExpanded(!selectorExpanded)}
            className="w-full"
          >
            <Card className={`transition-all ${selectorExpanded ? 'ring-2 ring-sage-400 dark:ring-sage-500' : ''}`}>
              <div className="flex items-center gap-3">
                {selectedRoutine ? (
                  <>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      selectedRoutine.type === 'morning'
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                        : selectedRoutine.type === 'evening'
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                        : 'bg-gradient-to-br from-sage-400 to-sage-600'
                    }`}>
                      {selectedRoutine.emoji}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedRoutine.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {getProgress(selectedRoutine).completed}/{getProgress(selectedRoutine).total} {t('routines.done')}
                        {syncedRoutineId && <span className="ml-2 text-sage-600 dark:text-sage-400">• Synced</span>}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-2xl">
                      📋
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{t('routines.selectRoutine') || 'Select a routine'}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('routines.tapToChoose') || 'Tap to choose'}</p>
                    </div>
                  </>
                )}
                <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${selectorExpanded ? 'rotate-90' : ''}`} />
              </div>
            </Card>
          </button>

          {/* Expanded routine list */}
          {selectorExpanded && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-fade-in">
              {routines.map((routine, index) => {
                const progress = getProgress(routine)
                const isComplete = progress.completed === progress.total && progress.total > 0
                const isSelected = selectedRoutine?.id === routine.id
                const isDragging = draggingRoutine === routine.id
                const appliesToday = routineAppliesToday(routine)
                const scheduleInfo = SCHEDULE_TYPES.find(s => s.id === (routine.schedule_type || 'daily'))

                return (
                  <div
                    key={routine.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, routine.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, routine.id)}
                    onDragEnd={() => setDraggingRoutine(null)}
                    className={`transition-all duration-200 ${isDragging ? 'opacity-50 scale-95' : ''}`}
                  >
                    <Card
                      className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-sage-400 dark:ring-sage-500 bg-sage-50 dark:bg-sage-900/20' : ''} ${
                        isComplete ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' : ''
                      } ${!appliesToday ? 'opacity-50' : ''}`}
                      onClick={() => selectRoutineAndSync(routine)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Drag handle & reorder buttons */}
                        <div className="flex flex-col items-center gap-0.5 -ml-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveRoutine(routine.id, 'up') }}
                            className={`p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                            disabled={index === 0}
                          >
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          </button>
                          <GripVertical className="w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing" />
                          <button
                            onClick={(e) => { e.stopPropagation(); moveRoutine(routine.id, 'down') }}
                            className={`p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ${index === routines.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                            disabled={index === routines.length - 1}
                          >
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>

                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform ${isComplete ? 'animate-celebrate' : ''} ${
                          routine.type === 'morning'
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                            : routine.type === 'evening'
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                            : 'bg-gradient-to-br from-sage-400 to-sage-600'
                        }`}>
                          {routine.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-100 truncate text-sm">{routine.title}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>{progress.completed}/{progress.total}</span>
                            {scheduleInfo && scheduleInfo.id !== 'daily' && (
                              <span className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                                {scheduleInfo.emoji}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-sage-600 dark:text-sage-400" />}
                        {isComplete && !isSelected && <span className="text-lg">🎉</span>}
                      </div>
                      <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${isComplete ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-sage-500'}`}
                          style={{ width: progress.total > 0 ? `${(progress.completed / progress.total) * 100}%` : '0%' }}
                        />
                      </div>
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      {/* Selected Routine - Simple Checklist */}
      {selectedRoutine && (
        <Card className="p-3 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-3xl ${
                selectedRoutine.type === 'morning'
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                  : selectedRoutine.type === 'evening'
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                  : 'bg-gradient-to-br from-sage-400 to-sage-600'
              }`}>
                {selectedRoutine.emoji}
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-100">{selectedRoutine.title}</h2>
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {selectedRoutine.type === 'morning' ? <Sun className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" /> : <Moon className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />}
                  {selectedRoutine.points_reward > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                      +{selectedRoutine.points_reward}
                    </span>
                  )}
                  {/* Member avatars - hidden on mobile */}
                  {(selectedRoutine.members?.length || 0) > 0 && (
                    <span className="hidden sm:flex items-center gap-1">
                      {selectedRoutine.members?.map(member => (
                        <AvatarDisplay
                          key={member.id}
                          photoUrl={member.photo_url}
                          emoji={member.avatar}
                          name={member.name}
                          color={member.color}
                          size="xs"
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => {
                  const newValue = !soundEnabled
                  setSoundEnabled(newValue)
                  localStorage.setItem('routine-sounds-enabled', String(newValue))
                  if (newValue) playSound('complete') // Test sound
                }}
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors tap-highlight ${
                  soundEnabled
                    ? 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={soundEnabled ? t('routines.soundsOn') : t('routines.soundsOff')}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <button
                onClick={() => openEditModal(selectedRoutine)}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 tap-highlight"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-2 sm:px-3 sm:py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">{t('routines.reset')}</span>
              </button>
            </div>
          </div>

          {/* Scenario Selector */}
          {selectedRoutine.scenarios && selectedRoutine.scenarios.length > 0 && (
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
                {t('routines.todaysScenario') || "Today's plan:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedRoutine.scenarios.map(scenario => {
                  const isSelected = (selectedScenarios[selectedRoutine.id] || []).includes(scenario.id)
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => toggleScenario(selectedRoutine.id, scenario.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-sage-500 bg-sage-100 dark:bg-sage-900/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-lg">{scenario.emoji}</span>
                      <span className={`font-medium ${isSelected ? 'text-sage-700 dark:text-sage-300' : 'text-slate-700 dark:text-slate-200'}`}>
                        {scenario.name}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-sage-600 dark:text-sage-400" />}
                    </button>
                  )
                })}
              </div>
              {(selectedScenarios[selectedRoutine.id]?.length || 0) === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  {t('routines.selectScenarioHint') || 'Select one or more scenarios to customize steps'}
                </p>
              )}
            </div>
          )}

          {/* ====================================================================
              MOBILE FOCUS MODE - Toddler-proof single-step view
              Shows current step with swipe navigation, timeline header
              ==================================================================== */}
          {isMobile && selectedRoutine && (() => {
            const routineComplete = isRoutineComplete(selectedRoutine)
            const visibleSteps = getVisibleSteps(selectedRoutine).filter(s => !isStepSkipped(s.id))

            // Clamp focusedStepIndex to valid range
            const safeIndex = Math.max(0, Math.min(focusedStepIndex, visibleSteps.length - 1))
            const focusedStep = visibleSteps[safeIndex]
            const focusedStepMembers = focusedStep ? getStepMembers(focusedStep, selectedRoutine.members || []) : []

            return (
              <div
                className="min-h-[60vh] flex flex-col select-none"
                style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                onTouchStart={handleFocusSwipeStart}
                onTouchMove={handleFocusSwipeMove}
                onTouchEnd={() => handleFocusSwipeEnd(visibleSteps.length)}
              >
                {/* Timeline header with emojis - tappable */}
                <div className="flex items-center justify-center gap-1 mb-4 px-2 overflow-x-auto">
                  {visibleSteps.map((step, idx) => {
                    const stepMembers = getStepMembers(step, selectedRoutine.members || [])
                    const stepDone = stepMembers.every(m => isStepCompleteForMember(step.id, m.id))
                    const isFocused = idx === safeIndex

                    return (
                      <button
                        key={step.id}
                        onClick={() => {
                          setFocusedStepIndex(idx)
                          hapticLight()
                        }}
                        className={`flex flex-col items-center p-1.5 rounded-xl transition-all duration-200 min-w-[44px] ${
                          isFocused
                            ? 'bg-violet-100 dark:bg-violet-900/50 scale-110 shadow-md'
                            : stepDone
                            ? 'bg-green-50 dark:bg-green-900/30 opacity-80'
                            : 'opacity-50'
                        }`}
                      >
                        <span className={`text-xl ${stepDone && !isFocused ? 'grayscale' : ''}`}>
                          {stepDone && !isFocused ? '✓' : step.emoji}
                        </span>
                        <span className={`w-2 h-2 rounded-full mt-1 ${
                          stepDone ? 'bg-green-500' : isFocused ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`} />
                      </button>
                    )
                  })}
                </div>

                {/* Swipe hint */}
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 mb-4">
                  {focusSwipeOffset !== 0 ? (
                    <span className="text-violet-500">
                      {focusSwipeOffset < 0 ? '→ Next' : '← Previous'}
                    </span>
                  ) : (
                    <span>Swipe to see other steps</span>
                  )}
                </div>

                {routineComplete ? (
                  /* All done celebration */
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <div className="text-8xl mb-4 animate-bounce">
                      {selectedRoutine.type === 'morning' ? '🌟' : '🌙'}
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                      All done!
                    </h2>
                    <p className="text-lg text-slate-500 dark:text-slate-400">
                      Great job everyone! 🎉
                    </p>
                    <div className="flex items-center gap-3 mt-6">
                      {selectedRoutine.members?.map(m => (
                        <div key={m.id} className="relative">
                          <AvatarDisplay
                            photoUrl={m.photo_url}
                            emoji={m.avatar}
                            name={m.name}
                            color={m.color}
                            size="lg"
                          />
                          <span className="absolute -bottom-1 -right-1 text-xl">⭐</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : focusedStep ? (
                  /* Focused step - swipeable Focus Mode */
                  <div
                    className="flex-1 flex flex-col items-center justify-center transition-transform duration-200"
                    style={{ transform: `translateX(${focusSwipeOffset * 0.3}px)` }}
                  >
                    {/* Big emoji */}
                    <div className={`text-7xl mb-4 ${celebratingStep === focusedStep.id ? 'animate-bounce' : ''}`}>
                      {focusedStep.emoji}
                    </div>

                    {/* Step title */}
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 text-center px-4">
                      {focusedStep.title}
                    </h2>

                    {/* Step counter */}
                    <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
                      Step {safeIndex + 1} of {visibleSteps.length}
                    </p>

                    {/* Large avatar buttons - 80px minimum */}
                    <div className="flex items-center justify-center gap-6 flex-wrap px-4">
                      {focusedStepMembers.map(member => {
                        const memberDone = isStepCompleteForMember(focusedStep.id, member.id)
                        const pressKey = `${focusedStep.id}:${member.id}`
                        const isLongPressing = longPressActive === pressKey

                        // Calculate countdown for undo (5 seconds)
                        const ringCircumference = 251.33 // 2 * PI * 40
                        const ringViewBox = '0 0 88 88'
                        const ringRadius = 40
                        const ringCenter = 44

                        return (
                          <div key={member.id} className="flex flex-col items-center select-none">
                            <button
                              onClick={(e) => handleMemberClick(e, focusedStep.id, member.id)}
                              onTouchStart={(e) => {
                                // Only handle if not swiping
                                if (!focusSwipeLocked.current) {
                                  handleStepPressStart(e, focusedStep.id, member.id)
                                }
                              }}
                              onTouchMove={(e) => handleStepPressMove(e, focusedStep.id, member.id)}
                              onTouchEnd={() => handleStepPressEnd(focusedStep.id, member.id)}
                              onTouchCancel={() => handleStepPressCancel(focusedStep.id, member.id)}
                              onContextMenu={(e) => e.preventDefault()}
                              disabled={celebrationPause}
                              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                              className={`relative w-20 h-20 rounded-2xl transition-all duration-300 shadow-lg overflow-hidden select-none touch-manipulation ${
                                celebrationPause
                                  ? 'opacity-75 pointer-events-none'
                                  : isLongPressing
                                  ? 'scale-90 ring-4 ring-red-400'
                                  : memberDone
                                  ? 'ring-4 ring-green-400 ring-offset-2 shadow-green-200 scale-110'
                                  : 'active:scale-95 ring-2 ring-slate-200 dark:ring-slate-600'
                              }`}
                            >
                              <AvatarDisplay
                                photoUrl={member.photo_url}
                                emoji={member.avatar}
                                name={member.name}
                                color={member.color}
                                size="xl"
                                className="w-full h-full pointer-events-none"
                              />

                              {/* Completion overlay */}
                              {memberDone && !isLongPressing && (
                                <span className="absolute inset-0 flex items-center justify-center bg-green-500/50 pointer-events-none">
                                  <span className="animate-pop bg-white text-green-500 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold shadow-lg">✓</span>
                                </span>
                              )}

                              {/* Long-press progress ring (5 seconds to undo) */}
                              {isLongPressing && (
                                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <svg className="w-full h-full absolute" viewBox={ringViewBox}>
                                    <circle
                                      cx={ringCenter}
                                      cy={ringCenter}
                                      r={ringRadius}
                                      fill="rgba(239, 68, 68, 0.4)"
                                      stroke="#ef4444"
                                      strokeWidth="4"
                                      strokeDasharray={`${longPressProgress * ringCircumference} ${ringCircumference}`}
                                      strokeLinecap="round"
                                      transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
                                    />
                                  </svg>
                                  <span className="bg-white text-red-500 rounded-full w-8 h-8 flex items-center justify-center font-bold z-10 text-lg">
                                    {Math.ceil(5 - longPressProgress * 5)}
                                  </span>
                                </span>
                              )}
                            </button>

                            {/* Name inside tap area - also tappable */}
                            <span className={`mt-2 text-base font-semibold ${
                              memberDone
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {member.name}
                            </span>

                            {/* Status */}
                            <span className={`text-2xl ${memberDone ? 'animate-bounce' : 'opacity-30'}`}>
                              {memberDone ? '✓' : '○'}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Navigation hint when step is complete */}
                    {focusedStepMembers.every(m => isStepCompleteForMember(focusedStep.id, m.id)) && safeIndex < visibleSteps.length - 1 && (
                      <div className="mt-6 text-center animate-pulse">
                        <span className="text-violet-500 dark:text-violet-400 text-sm font-medium">
                          ← Swipe for next step →
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500">
                    Loading...
                  </div>
                )}
              </div>
            )
          })()}

          {/* ====================================================================
              DESKTOP/TABLET STEP LIST - Original 2-row card design
              ==================================================================== */}
          {!isMobile && <div className="space-y-3">
            {getVisibleSteps(selectedRoutine)
              .filter(step => !isStepSkipped(step.id)) // Hide skipped steps
              .map((step) => {
              const routineMembers = selectedRoutine.members || []
              const stepMembers = getStepMembers(step, routineMembers)
              const stepMemberIds = stepMembers.map(m => m.id)
              const hasMembers = stepMembers.length > 0
              const isDone = isStepComplete(step.id, stepMemberIds)
              const isCelebrating = celebratingStep === step.id
              const isSwiping = swipingStepId === step.id

              return (
                <div
                  key={step.id}
                  className="relative overflow-hidden rounded-2xl"
                  onTouchStart={(e) => handleSwipeStart(e, step.id)}
                  onTouchMove={handleSwipeMove}
                  onTouchEnd={() => handleSwipeEnd(step)}
                >
                  {/* Swipe reveal background - only visible when actively swiping horizontally */}
                  {isSwiping && swipeOffset > 20 && (
                    <div className="absolute inset-y-0 right-0 w-32 bg-amber-500 flex items-center justify-end pr-4">
                      <span className="text-white font-medium">Skip</span>
                    </div>
                  )}

                  {/* Main card content */}
                  <div
                    style={{ transform: isSwiping ? `translateX(-${swipeOffset}px)` : 'translateX(0)' }}
                    className={`relative ${isKitchen ? 'p-5' : 'p-3'} rounded-2xl transition-all duration-200 ${
                      isDone
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30'
                        : 'bg-slate-50 dark:bg-slate-800/50'
                    } ${isCelebrating ? 'animate-wiggle !bg-yellow-50 dark:!bg-yellow-900/30 shadow-lg scale-[1.02]' : ''}`}
                  >
                    {/* Row 1: Emoji + Title */}
                    <div className={`flex items-center ${isKitchen ? 'gap-4 mb-4' : 'gap-3 mb-3'}`}>
                      {/* Large emoji - long press to delete */}
                      <div
                        onMouseDown={(e) => !isDone && handleStepEmojiPressStart(e, selectedRoutine.id, step)}
                        onMouseUp={() => handleStepEmojiPressEnd(step.id)}
                        onMouseLeave={() => handleStepEmojiPressEnd(step.id)}
                        onTouchStart={(e) => !isDone && handleStepEmojiPressStart(e, selectedRoutine.id, step)}
                        onTouchEnd={() => handleStepEmojiPressEnd(step.id)}
                        onTouchCancel={() => handleStepEmojiPressEnd(step.id)}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`${isKitchen ? 'w-16 h-16' : 'w-12 h-12'} rounded-xl flex items-center justify-center ${isKitchen ? 'text-3xl' : 'text-2xl'} transition-all select-none touch-manipulation ${
                          isDone
                            ? 'bg-green-100 dark:bg-green-800/50'
                            : 'bg-white dark:bg-slate-700 shadow-sm'
                        } ${isCelebrating ? '!bg-yellow-100 animate-bounce' : ''} ${
                          stepRemoveLongPressActive === step.id ? 'ring-4 ring-red-400 scale-95 bg-red-50' : ''
                        }`}
                      >
                        {stepRemoveLongPressActive === step.id ? (
                          <Trash2 className={`${isKitchen ? 'w-8 h-8' : 'w-6 h-6'} text-red-500 animate-pulse`} />
                        ) : isDone ? (
                          <Check className={`${isKitchen ? 'w-8 h-8' : 'w-6 h-6'} text-green-500`} />
                        ) : (
                          <span>{step.emoji}</span>
                        )}
                      </div>

                      {/* Step title - ALWAYS visible */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold ${isKitchen ? 'text-xl' : 'text-base'} transition-all truncate ${
                          isDone
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}>
                          {step.title}
                        </p>
                        {isDone && (
                          <p className={`${isKitchen ? 'text-sm' : 'text-xs'} text-green-500 dark:text-green-400 font-medium`}>
                            Great job! 🌟
                          </p>
                        )}
                      </div>

                      {/* Drag handle - desktop only */}
                      <div className="hidden sm:flex text-slate-300 dark:text-slate-600 cursor-grab">
                        <GripVertical className={`${isKitchen ? 'w-6 h-6' : 'w-5 h-5'}`} />
                      </div>
                    </div>

                    {/* Row 2: Child avatars with names */}
                    {hasMembers && (
                      <div className={`flex justify-center ${isKitchen ? 'gap-8' : 'gap-4 sm:gap-6'}`}>
                        {stepMembers.map(member => {
                          const memberDone = isStepCompleteForMember(step.id, member.id)
                          const pressKey = `${step.id}:${member.id}`
                          const isLongPressing = longPressActive === pressKey
                          const showName = isKitchen || stepMembers.length <= 3 // Always show names in kitchen mode

                          // Avatar sizes: kitchen 80px, regular 56px
                          const avatarSize = isKitchen ? 'w-20 h-20' : 'w-14 h-14'
                          const checkSize = isKitchen ? 'w-10 h-10' : 'w-8 h-8'
                          const ringViewBox = isKitchen ? '0 0 80 80' : '0 0 56 56'
                          const ringRadius = isKitchen ? 37 : 26
                          const ringCenter = isKitchen ? 40 : 28
                          const ringCircumference = isKitchen ? 232.48 : 163.36

                          return (
                            <div key={member.id} className="flex flex-col items-center select-none">
                              {/* Avatar button - Toddler-proof with large tap target */}
                              <button
                                onClick={(e) => handleMemberClick(e, step.id, member.id)}
                                onTouchStart={(e) => handleStepPressStart(e, step.id, member.id)}
                                onTouchMove={(e) => handleStepPressMove(e, step.id, member.id)}
                                onTouchEnd={() => handleStepPressEnd(step.id, member.id)}
                                onTouchCancel={() => handleStepPressCancel(step.id, member.id)}
                                onMouseDown={(e) => handleStepPressStart(e, step.id, member.id)}
                                onMouseUp={() => handleStepPressEnd(step.id, member.id)}
                                onMouseLeave={() => handleStepPressEnd(step.id, member.id)}
                                onContextMenu={(e) => e.preventDefault()}
                                disabled={celebrationPause}
                                style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                                className={`relative ${avatarSize} rounded-2xl transition-all duration-300 shadow-md overflow-hidden select-none touch-manipulation ${
                                  celebrationPause
                                    ? 'opacity-75 pointer-events-none'
                                    : isLongPressing
                                    ? 'scale-90'
                                    : memberDone
                                    ? 'ring-4 ring-green-400 ring-offset-2 shadow-green-200 scale-105 animate-success-pulse'
                                    : 'hover:scale-110 active:scale-95'
                                }`}
                              >
                                <AvatarDisplay
                                  photoUrl={member.photo_url}
                                  emoji={member.avatar}
                                  name={member.name}
                                  color={member.color}
                                  size={isKitchen ? 'xl' : 'lg'}
                                  className="w-full h-full pointer-events-none"
                                />

                                {/* Completion overlay */}
                                {memberDone && !isLongPressing && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-green-500/40 pointer-events-none">
                                    <span className={`animate-pop bg-white text-green-500 rounded-full ${checkSize} flex items-center justify-center font-bold shadow-lg`}>✓</span>
                                  </span>
                                )}

                                {/* Long-press progress ring (5 seconds to undo) */}
                                {isLongPressing && (
                                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <svg className="w-full h-full absolute" viewBox={ringViewBox}>
                                      <circle
                                        cx={ringCenter}
                                        cy={ringCenter}
                                        r={ringRadius}
                                        fill="rgba(239, 68, 68, 0.3)"
                                        stroke="#ef4444"
                                        strokeWidth="4"
                                        strokeDasharray={`${longPressProgress * ringCircumference} ${ringCircumference}`}
                                        strokeLinecap="round"
                                        transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
                                      />
                                    </svg>
                                    <span className={`bg-white text-red-500 rounded-full ${isKitchen ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'} flex items-center justify-center font-bold z-10`}>
                                      {Math.ceil(5 - longPressProgress * 5)}
                                    </span>
                                  </span>
                                )}
                              </button>

                              {/* Name label */}
                              {showName && (
                                <span className={`mt-1.5 ${isKitchen ? 'text-sm' : 'text-xs'} font-medium truncate ${isKitchen ? 'max-w-[80px]' : 'max-w-[60px]'} ${
                                  memberDone ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'
                                }`}>
                                  {member.name}
                                </span>
                              )}

                              {/* Status indicator */}
                              <span className={`${isKitchen ? 'text-xl' : 'text-lg'} ${memberDone ? 'animate-bounce' : 'opacity-30'}`}>
                                {memberDone ? '✓' : '○'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* No members fallback */}
                    {!hasMembers && (
                      <button
                        onClick={() => toggleStep(step.id)}
                        className={`w-full py-3 rounded-xl font-medium transition-all ${
                          isDone
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {isDone ? '✓ Done!' : 'Mark Complete'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>}

          {!isMobile && getProgress(selectedRoutine).completed === getVisibleSteps(selectedRoutine).length && getVisibleSteps(selectedRoutine).length > 0 && (
            <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-center animate-scale-in">
              <div className="text-5xl mb-3 animate-tada">🎉</div>
              <p className="text-xl font-bold text-green-700 dark:text-green-300 mb-1">{t('routines.allDoneGreat')}</p>
              <p className="text-green-600 dark:text-green-400">
                {selectedRoutine.type === 'morning' ? t('routines.haveGreatDay') : selectedRoutine.type === 'evening' ? t('routines.sweetDreams') : t('routines.wellDone')}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                {selectedRoutine.members?.map(m => (
                  <div key={m.id} className="flex flex-col items-center">
                    <AvatarDisplay
                      photoUrl={m.photo_url}
                      emoji={m.avatar}
                      name={m.name}
                      color={m.color}
                      size="sm"
                      className="ring-2 ring-green-400 ring-offset-2"
                    />
                    <span className="text-xs text-green-600 dark:text-green-400 mt-1">⭐</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {routines.length === 0 && (
        <Card className="text-center py-12">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{t('routines.noRoutines')}</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{t('routines.noRoutinesHint')}</p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-5 h-5 mr-2" />
            {t('routines.createFirst')}
          </Button>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false)
          setShowEditModal(false)
          setEditingRoutine(null)
          resetForm()
        }}
        title={showEditModal ? t('routines.editRoutine') : t('routines.newRoutine')}
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('routines.routineName')}
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Morning Routine"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('common.emoji')}
              </label>
              <input
                type="text"
                value={formData.emoji}
                onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent text-center text-2xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('routines.type')}
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'morning' | 'evening' | 'custom' })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              >
                <option value="morning">{t('routines.morning')}</option>
                <option value="evening">{t('routines.evening')}</option>
                <option value="custom">{t('routines.custom')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('routines.starsReward')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.points_reward}
                  onChange={(e) => setFormData({ ...formData, points_reward: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="10"
                  className="w-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent text-center"
                />
                <Star className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </div>

          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('routines.scheduleType') || 'Schedule'}
            </label>
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_TYPES.map(scheduleType => {
                const isSelected = formData.schedule_type === scheduleType.id
                return (
                  <button
                    key={scheduleType.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, schedule_type: scheduleType.id })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-sage-500 bg-sage-50 dark:bg-sage-900/30'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{scheduleType.emoji}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{scheduleType.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-sage-600" />}
                  </button>
                )
              })}
            </div>
            {formData.schedule_type === 'custom' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                  const isSelected = formData.schedule_days.includes(index)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setFormData({ ...formData, schedule_days: formData.schedule_days.filter(d => d !== index) })
                        } else {
                          setFormData({ ...formData, schedule_days: [...formData.schedule_days, index].sort() })
                        }
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-sage-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {day.charAt(0)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Participants */}
          {children.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('routines.participants')}
              </label>
              <div className="flex flex-wrap gap-2">
                {children.map(child => {
                  const isSelected = formData.member_ids.includes(child.id)
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setFormData({ ...formData, member_ids: formData.member_ids.filter(id => id !== child.id) })
                        } else {
                          setFormData({ ...formData, member_ids: [...formData.member_ids, child.id] })
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-sage-500 bg-sage-50 dark:bg-sage-900/30'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: child.color }}
                      >
                        {child.avatar || child.name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{child.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-sage-600" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Steps - simplified, no duration */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('routines.steps')}
              </label>
              <button
                onClick={addStep}
                className="text-sm text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300"
              >
                + {t('routines.addStep')}
              </button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {formData.steps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <GripVertical className="w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={step.emoji}
                    onChange={(e) => updateStep(index, 'emoji', e.target.value)}
                    className="w-14 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-center text-xl"
                  />
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateStep(index, 'title', e.target.value)}
                    placeholder={t('routines.stepTitlePlaceholder')}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  />
                  {formData.steps.length > 1 && (
                    <button
                      onClick={() => removeStep(index)}
                      className="p-1 text-slate-400 hover:text-coral-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            {showEditModal && (
              <Button
                variant="danger"
                onClick={() => {
                  if (editingRoutine) handleDeleteRoutine(editingRoutine)
                  setShowEditModal(false)
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('common.delete')}
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddModal(false)
                setShowEditModal(false)
                setEditingRoutine(null)
                resetForm()
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={showEditModal ? handleEditRoutine : handleAddRoutine}>
              {showEditModal ? t('common.saveChanges') : t('routines.createRoutine')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Step Removal Confirmation Modal */}
      <Modal
        isOpen={!!stepToRemove}
        onClose={() => setStepToRemove(null)}
        title={t('routines.removeStep')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <span className="text-4xl">{stepToRemove?.step.emoji}</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{stepToRemove?.step.title}</p>
              <p className="text-sm text-red-600 dark:text-red-400">{t('routines.removeStepWarning')}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setStepToRemove(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={removeStepFromRoutine}
              className="!bg-red-500 hover:!bg-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('routines.removeStep')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Skip Step Confirmation Modal */}
      <Modal
        isOpen={!!skipConfirmStep}
        onClose={() => setSkipConfirmStep(null)}
        title="Skip Step?"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <span className="text-4xl">{skipConfirmStep?.emoji}</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{skipConfirmStep?.title}</p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Skip this step for everyone today?
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This will hide the step for the rest of today. It will return tomorrow.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setSkipConfirmStep(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => skipConfirmStep && skipStepForToday(skipConfirmStep)}
              className="!bg-amber-500 hover:!bg-amber-600"
            >
              <span className="mr-2">⏭️</span>
              Skip for Today
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Routine Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Routine?"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <span className="text-4xl">{selectedRoutine?.emoji}</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedRoutine?.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Uncheck all steps for today?
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            All progress for today will be cleared. This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                resetRoutine()
                setShowResetConfirm(false)
              }}
              className="!bg-slate-600 hover:!bg-slate-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Routine
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </>
  )
}
