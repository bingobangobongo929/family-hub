'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Sun, Moon, RotateCcw, Plus, Edit2, Trash2, GripVertical, X, Star, Check, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react'
import { AvatarDisplay } from '@/components/PhotoUpload'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineScenario, FamilyMember, ScheduleType, SCHEDULE_TYPES } from '@/lib/database.types'
import Confetti from '@/components/Confetti'

// Extended routine type with steps, members, and scenarios
type RoutineWithDetails = Routine & {
  steps: RoutineStep[]
  members?: FamilyMember[]
  member_ids?: string[]
  scenarios?: RoutineScenario[]
}

export default function RoutinesPage() {
  const { user } = useAuth()
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
  const [longPressActive, setLongPressActive] = useState<string | null>(null) // Shows visual feedback during long-press

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
      const { data } = await supabase
        .from('routine_completions')
        .select('step_id, member_id')
        .eq('completed_date', today)

      if (data) {
        setCompletedSteps(new Set(data.map(c => `${c.step_id}:${c.member_id}`)))
      }
    } catch (error) {
      console.error('Error loading completions:', error)
    }
  }, [user])

  useEffect(() => {
    fetchRoutines()
    loadCompletions()
  }, [fetchRoutines, loadCompletions])

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
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const key = `${stepId}:${memberId}`
    const newCompleted = new Set(completedSteps)

    if (newCompleted.has(key)) {
      newCompleted.delete(key)
      await supabase
        .from('routine_completions')
        .delete()
        .eq('step_id', stepId)
        .eq('member_id', memberId)
        .eq('completed_date', today)

      // Log uncomplete action to history
      await supabase.from('routine_completion_log').insert({
        routine_id: selectedRoutine?.id,
        step_id: stepId,
        member_id: memberId,
        completed_date: today,
        completed_by: user.id,
        action: 'uncompleted'
      })
    } else {
      newCompleted.add(key)

      // Find the step emoji for confetti
      const step = selectedRoutine?.steps.find(s => s.id === stepId)

      // Celebrate! Small burst for individual completion
      setCelebratingStep(stepId)
      setConfettiConfig({ intensity: 'small', emoji: step?.emoji })
      setConfettiTrigger(t => t + 1)
      setTimeout(() => setCelebratingStep(null), 600)

      await supabase
        .from('routine_completions')
        .insert({
          routine_id: selectedRoutine?.id,
          step_id: stepId,
          member_id: memberId,
          completed_date: today
        })

      // Log complete action to history
      await supabase.from('routine_completion_log').insert({
        routine_id: selectedRoutine?.id,
        step_id: stepId,
        member_id: memberId,
        completed_date: today,
        completed_by: user.id,
        action: 'completed'
      })

      if (selectedRoutine) {
        // Check completion using visible steps and per-member assignments
        const visibleSteps = getVisibleSteps(selectedRoutine)
        const memberSteps = visibleSteps.filter(s => stepAppliesToMember(s, memberId))

        const memberCompletedAll = memberSteps.every(
          s => newCompleted.has(`${s.id}:${memberId}`) || s.id === stepId
        )
        if (memberCompletedAll && memberSteps.length > 0 && selectedRoutine.points_reward > 0) {
          const member = getMember(memberId)
          if (member?.stars_enabled) {
            updateMemberPoints(memberId, selectedRoutine.points_reward)

            // Log points to history
            await supabase.from('points_history').insert({
              member_id: memberId,
              points_change: selectedRoutine.points_reward,
              reason: 'routine_completed',
              reference_id: selectedRoutine.id,
              reference_type: 'routine',
              created_by: user.id
            })
          }

          // Update streak
          await updateStreak(memberId, selectedRoutine.id, today)

          // BIG celebration for completing all steps!
          setTimeout(() => {
            setConfettiConfig({ intensity: 'big', emoji: '⭐' })
            setConfettiTrigger(t => t + 1)
          }, 300)
        }

        // Check if ALL members completed ALL their applicable steps
        const routineMembers = selectedRoutine.member_ids || []
        const allMembersCompletedAll = routineMembers.length > 0 && visibleSteps.length > 0 && routineMembers.every(mid => {
          const memberSpecificSteps = visibleSteps.filter(s => stepAppliesToMember(s, mid))
          return memberSpecificSteps.every(s =>
            newCompleted.has(`${s.id}:${mid}`) || (s.id === stepId && mid === memberId)
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

    setCompletedSteps(newCompleted)
  }

  // Long-press handling for uncheck protection
  const LONG_PRESS_DURATION = 600 // milliseconds

  const handleStepPressStart = (stepId: string, memberId: string) => {
    const key = `${stepId}:${memberId}`
    const isCompleted = completedSteps.has(key)

    if (isCompleted) {
      // Already completed - require long-press to uncheck
      setLongPressActive(key)
      const timer = setTimeout(() => {
        // Long press completed - do the uncheck
        toggleStepForMember(stepId, memberId)
        setLongPressActive(null)
        longPressTimers.current.delete(key)
      }, LONG_PRESS_DURATION)
      longPressTimers.current.set(key, timer)
    } else {
      // Not completed - instant check
      toggleStepForMember(stepId, memberId)
    }
  }

  const handleStepPressEnd = (stepId: string, memberId: string) => {
    const key = `${stepId}:${memberId}`
    // Cancel long-press if released early
    const timer = longPressTimers.current.get(key)
    if (timer) {
      clearTimeout(timer)
      longPressTimers.current.delete(key)
      setLongPressActive(null)
    }
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      longPressTimers.current.forEach(timer => clearTimeout(timer))
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
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                selectedRoutine.type === 'morning'
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                  : selectedRoutine.type === 'evening'
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                  : 'bg-gradient-to-br from-sage-400 to-sage-600'
              }`}>
                {selectedRoutine.emoji}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedRoutine.title}</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  {selectedRoutine.type === 'morning' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                  {selectedRoutine.points_reward > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Star className="w-4 h-4" />
                      +{selectedRoutine.points_reward}
                    </span>
                  )}
                  {(selectedRoutine.members?.length || 0) > 0 && (
                    <span className="flex items-center gap-1">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(selectedRoutine)}
                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={resetRoutine}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t('routines.reset')}
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

          {/* Fun Step Checklist */}
          <div className="space-y-3">
            {getVisibleSteps(selectedRoutine).map((step, index) => {
              const routineMembers = selectedRoutine.members || []
              // Get only the members this step applies to
              const stepMembers = getStepMembers(step, routineMembers)
              const stepMemberIds = stepMembers.map(m => m.id)
              const hasMembers = stepMembers.length > 0
              const isDone = isStepComplete(step.id, stepMemberIds)
              const isCelebrating = celebratingStep === step.id
              const isPerMemberStep = step.member_ids && step.member_ids.length > 0

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                    isDone
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 scale-[0.98]'
                      : 'bg-slate-50 dark:bg-slate-800/50'
                  } ${isCelebrating ? 'animate-wiggle !bg-yellow-50 dark:!bg-yellow-900/30 scale-105 shadow-lg' : ''}`}
                >
                  {/* Step number & emoji */}
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${
                      isDone
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-500'
                    } ${isCelebrating ? '!bg-yellow-400 !text-yellow-900 animate-pop' : ''}`}>
                      {isDone ? '✓' : index + 1}
                    </span>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all ${
                      isDone
                        ? 'bg-green-100 dark:bg-green-900/50'
                        : 'bg-white dark:bg-slate-700 shadow-sm'
                    } ${isCelebrating ? '!bg-yellow-100 dark:!bg-yellow-900/50 animate-bounce' : ''}`}>
                      {isDone ? (
                        <div className="relative">
                          <Check className="w-8 h-8 text-green-500" />
                          <span className="absolute -top-1 -right-1 text-base animate-bounce">✨</span>
                        </div>
                      ) : (
                        <span className={isCelebrating ? 'animate-bounce' : ''}>{step.emoji}</span>
                      )}
                    </div>
                  </div>

                  {/* Step title */}
                  <div className="flex-1">
                    <p className={`font-semibold text-lg transition-all ${
                      isDone
                        ? 'text-green-600 dark:text-green-400 line-through decoration-2'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}>
                      {step.title}
                    </p>
                    {isDone && (
                      <p className="text-sm text-green-500 dark:text-green-400 font-medium animate-fade-in">
                        Great job! 🌟
                      </p>
                    )}
                  </div>

                  {/* Member completion buttons - tap to complete, long-press to undo */}
                  {hasMembers ? (
                    <div className="flex items-center gap-3">
                      {/* Show indicator if this is a per-member step */}
                      {isPerMemberStep && stepMembers.length < routineMembers.length && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 mr-1" title="This step is for specific members only">
                          {stepMembers.map(m => m.name.charAt(0)).join(', ')} only
                        </span>
                      )}
                      {stepMembers.map(member => {
                        const memberDone = isStepCompleteForMember(step.id, member.id)
                        const pressKey = `${step.id}:${member.id}`
                        const isLongPressing = longPressActive === pressKey
                        return (
                          <button
                            key={member.id}
                            onMouseDown={() => handleStepPressStart(step.id, member.id)}
                            onMouseUp={() => handleStepPressEnd(step.id, member.id)}
                            onMouseLeave={() => handleStepPressEnd(step.id, member.id)}
                            onTouchStart={() => handleStepPressStart(step.id, member.id)}
                            onTouchEnd={() => handleStepPressEnd(step.id, member.id)}
                            className={`relative w-12 h-12 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg overflow-hidden select-none ${
                              isLongPressing
                                ? 'scale-95 ring-4 ring-red-400 ring-offset-2'
                                : memberDone
                                ? 'ring-4 ring-green-400 ring-offset-2 shadow-green-200 hover:scale-105'
                                : 'opacity-80 hover:opacity-100 hover:scale-110 active:scale-90'
                            }`}
                            title={memberDone ? `${member.name} - hold to undo` : member.name}
                          >
                            <AvatarDisplay
                              photoUrl={member.photo_url}
                              emoji={member.avatar}
                              name={member.name}
                              color={member.color}
                              size="md"
                              className="w-full h-full"
                            />
                            {memberDone && !isLongPressing && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <span className="animate-pop bg-white text-green-500 rounded-full w-8 h-8 flex items-center justify-center font-bold">✓</span>
                              </span>
                            )}
                            {isLongPressing && (
                              <span className="absolute inset-0 flex items-center justify-center bg-red-500/50">
                                <span className="bg-white text-red-500 rounded-full w-8 h-8 flex items-center justify-center font-bold animate-pulse">↩</span>
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleStep(step.id)}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-200 hover:scale-110 active:scale-90 ${
                        isDone
                          ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                          : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      {isDone ? '✓' : '○'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {getProgress(selectedRoutine).completed === getVisibleSteps(selectedRoutine).length && getVisibleSteps(selectedRoutine).length > 0 && (
            <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-xl font-bold text-green-700 dark:text-green-300 mb-1">{t('routines.allDoneGreat')}</p>
              <p className="text-green-600 dark:text-green-400">
                {selectedRoutine.type === 'morning' ? t('routines.haveGreatDay') : selectedRoutine.type === 'evening' ? t('routines.sweetDreams') : t('routines.wellDone')}
              </p>
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
      </div>
    </>
  )
}
