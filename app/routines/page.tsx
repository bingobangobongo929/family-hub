'use client'

import { useState, useEffect, useCallback } from 'react'
import Card, { CardHeader } from '@/components/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Sun, Moon, RotateCcw, Plus, Clock, Edit2, Trash2, GripVertical, X, Play, Pause, Star, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineCompletion, FamilyMember } from '@/lib/database.types'

// Extended routine type with steps and members
type RoutineWithDetails = Routine & {
  steps: RoutineStep[]
  members?: FamilyMember[]
  member_ids?: string[]
}

// Demo routines for when not logged in (synced with RoutinesWidget)
const DEMO_ROUTINES: RoutineWithDetails[] = [
  {
    id: 'demo-bedtime',
    user_id: 'demo',
    title: 'Bedtime Routine',
    emoji: '🌙',
    type: 'evening',
    assigned_to: null,
    scheduled_time: '19:30',
    points_reward: 2,
    is_active: true,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    member_ids: ['demo-olivia', 'demo-ellie'],
    steps: [
      { id: 'step-1', routine_id: 'demo-bedtime', title: 'Porridge', emoji: '🥣', duration_minutes: 10, sort_order: 0, created_at: '' },
      { id: 'step-2', routine_id: 'demo-bedtime', title: 'Pajamas', emoji: '👕', duration_minutes: 5, sort_order: 1, created_at: '' },
      { id: 'step-3', routine_id: 'demo-bedtime', title: 'Toothbrushing', emoji: '🪥', duration_minutes: 3, sort_order: 2, created_at: '' },
      { id: 'step-4', routine_id: 'demo-bedtime', title: 'Supper Milk', emoji: '🥛', duration_minutes: 5, sort_order: 3, created_at: '' },
      { id: 'step-5', routine_id: 'demo-bedtime', title: 'Kiss & Goodnight', emoji: '😘', duration_minutes: 2, sort_order: 4, created_at: '' },
    ]
  },
  {
    id: 'demo-morning',
    user_id: 'demo',
    title: 'Morning Routine',
    emoji: '☀️',
    type: 'morning',
    assigned_to: null,
    scheduled_time: '07:00',
    points_reward: 2,
    is_active: true,
    sort_order: 1,
    created_at: '',
    updated_at: '',
    member_ids: ['demo-olivia', 'demo-ellie'],
    steps: [
      { id: 'ms1', routine_id: 'demo-morning', title: 'Get dressed', emoji: '👕', duration_minutes: 5, sort_order: 0, created_at: '' },
      { id: 'ms2', routine_id: 'demo-morning', title: 'Brush teeth', emoji: '🪥', duration_minutes: 3, sort_order: 1, created_at: '' },
      { id: 'ms3', routine_id: 'demo-morning', title: 'Eat breakfast', emoji: '🥣', duration_minutes: 15, sort_order: 2, created_at: '' },
      { id: 'ms4', routine_id: 'demo-morning', title: 'Tidy bedroom', emoji: '🛏️', duration_minutes: 5, sort_order: 3, created_at: '' },
    ]
  }
]

export default function RoutinesPage() {
  const { user } = useAuth()
  const { members, getMember, updateMemberPoints } = useFamily()
  const { t } = useTranslation()
  const [routines, setRoutines] = useState<RoutineWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineWithDetails | null>(null)
  // Track completions per member per step: "stepId:memberId"
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<RoutineWithDetails | null>(null)
  const [activeTimer, setActiveTimer] = useState<{ stepId: string; timeLeft: number } | null>(null)

  // Get children for routine assignment
  const children = members.filter(m => m.role === 'child')

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    emoji: '📋',
    type: 'morning' as 'morning' | 'evening' | 'custom',
    member_ids: [] as string[],
    scheduled_time: '',
    points_reward: 1,
    steps: [{ title: '', emoji: '✨', duration_minutes: 5 }]
  })

  const fetchRoutines = useCallback(async () => {
    if (!user) {
      setRoutines(DEMO_ROUTINES)
      // Auto-select based on time of day
      const hour = new Date().getHours()
      setSelectedRoutine(hour < 14 ? DEMO_ROUTINES[0] : DEMO_ROUTINES[1])
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

      // Fetch steps and members for each routine
      const routinesWithDetails = await Promise.all(
        (routinesData || []).map(async (routine) => {
          const [stepsResult, membersResult] = await Promise.all([
            supabase
              .from('routine_steps')
              .select('*')
              .eq('routine_id', routine.id)
              .order('sort_order', { ascending: true }),
            supabase
              .from('routine_members')
              .select('member_id')
              .eq('routine_id', routine.id)
          ])

          return {
            ...routine,
            steps: stepsResult.data || [],
            member_ids: (membersResult.data || []).map(rm => rm.member_id)
          }
        })
      )

      setRoutines(routinesWithDetails as RoutineWithDetails[])

      // Auto-select based on time of day
      const hour = new Date().getHours()
      const morning = routinesWithDetails.find(r => r.type === 'morning')
      const evening = routinesWithDetails.find(r => r.type === 'evening')
      setSelectedRoutine(
        hour < 14
          ? (morning || routinesWithDetails[0] || null)
          : (evening || routinesWithDetails[0] || null)
      )
    } catch (error) {
      console.error('Error fetching routines:', error)
      setRoutines(DEMO_ROUTINES)
      const hour = new Date().getHours()
      setSelectedRoutine(hour < 14 ? DEMO_ROUTINES[0] : DEMO_ROUTINES[1])
    }
    setLoading(false)
  }, [user])

  // Load completions for today (per-member tracking with "stepId:memberId" keys)
  const loadCompletions = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]

    if (!user) {
      const saved = localStorage.getItem('routine-completions-' + today)
      if (saved) {
        setCompletedSteps(new Set(JSON.parse(saved)))
      }
      return
    }

    try {
      const { data } = await supabase
        .from('routine_completions')
        .select('step_id, member_id')
        .eq('completed_date', today)

      if (data) {
        // Create keys as "stepId:memberId" for per-member tracking
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

  // Toggle step completion for a specific member
  const toggleStepForMember = async (stepId: string, memberId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const key = `${stepId}:${memberId}`
    const newCompleted = new Set(completedSteps)

    if (newCompleted.has(key)) {
      newCompleted.delete(key)
      if (!user) {
        localStorage.setItem('routine-completions-' + today, JSON.stringify([...newCompleted]))
      } else {
        await supabase
          .from('routine_completions')
          .delete()
          .eq('step_id', stepId)
          .eq('member_id', memberId)
          .eq('completed_date', today)
      }
    } else {
      newCompleted.add(key)
      if (!user) {
        localStorage.setItem('routine-completions-' + today, JSON.stringify([...newCompleted]))
      } else {
        await supabase
          .from('routine_completions')
          .insert({
            routine_id: selectedRoutine?.id,
            step_id: stepId,
            member_id: memberId,
            completed_date: today
          })
      }

      // Check if this member completed all steps - award stars if enabled
      if (selectedRoutine) {
        const memberCompletedAll = selectedRoutine.steps.every(
          s => newCompleted.has(`${s.id}:${memberId}`) || s.id === stepId
        )
        if (memberCompletedAll && selectedRoutine.points_reward > 0) {
          const member = getMember(memberId)
          if (member?.stars_enabled) {
            updateMemberPoints(memberId, selectedRoutine.points_reward)
          }
        }
      }
    }

    setCompletedSteps(newCompleted)
  }

  // Legacy toggle for simple mode (marks all members as complete)
  const toggleStep = async (stepId: string) => {
    const routineMembers = selectedRoutine?.member_ids || []
    if (routineMembers.length === 0) {
      // No specific members - use a default key
      const today = new Date().toISOString().split('T')[0]
      const key = `${stepId}:all`
      const newCompleted = new Set(completedSteps)
      if (newCompleted.has(key)) {
        newCompleted.delete(key)
      } else {
        newCompleted.add(key)
      }
      localStorage.setItem('routine-completions-' + today, JSON.stringify([...newCompleted]))
      setCompletedSteps(newCompleted)
    } else {
      // Toggle for all assigned members
      for (const memberId of routineMembers) {
        await toggleStepForMember(stepId, memberId)
      }
    }
  }

  const resetRoutine = async () => {
    if (!selectedRoutine) return

    const today = new Date().toISOString().split('T')[0]
    const stepIds = selectedRoutine.steps.map(s => s.id)
    // Filter out any completion keys that start with this routine's step IDs
    const newCompleted = new Set([...completedSteps].filter(key => {
      const stepId = key.split(':')[0]
      return !stepIds.includes(stepId)
    }))

    if (!user) {
      localStorage.setItem('routine-completions-' + today, JSON.stringify([...newCompleted]))
    } else {
      await supabase
        .from('routine_completions')
        .delete()
        .in('step_id', stepIds)
        .eq('completed_date', today)
    }

    setCompletedSteps(newCompleted)
    setActiveTimer(null)
  }

  const startTimer = (step: RoutineStep) => {
    if (activeTimer?.stepId === step.id) {
      setActiveTimer(null)
    } else {
      setActiveTimer({ stepId: step.id, timeLeft: step.duration_minutes * 60 })
    }
  }

  // Timer countdown
  useEffect(() => {
    if (!activeTimer) return

    const interval = setInterval(() => {
      setActiveTimer(prev => {
        if (!prev || prev.timeLeft <= 0) {
          // Auto-complete when timer finishes
          if (prev) toggleStep(prev.stepId)
          return null
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [activeTimer?.stepId])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAddRoutine = async () => {
    if (!formData.title || formData.steps.every(s => !s.title)) return

    const validSteps = formData.steps.filter(s => s.title.trim())
    const routineId = 'demo-' + Date.now()

    if (!user) {
      const newRoutine: RoutineWithDetails = {
        id: routineId,
        user_id: 'demo',
        title: formData.title,
        emoji: formData.emoji,
        type: formData.type,
        points_reward: formData.points_reward,
        assigned_to: null,
        scheduled_time: formData.scheduled_time || null,
        is_active: true,
        sort_order: routines.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        member_ids: formData.member_ids,
        steps: validSteps.map((s, i) => ({
          id: 'step-' + Date.now() + '-' + i,
          routine_id: routineId,
          title: s.title,
          emoji: s.emoji,
          duration_minutes: s.duration_minutes,
          sort_order: i,
          created_at: new Date().toISOString()
        }))
      }
      setRoutines([...routines, newRoutine])
      setShowAddModal(false)
      resetForm()
      return
    }

    try {
      const { data: routineData, error: routineError } = await supabase
        .from('routines')
        .insert({
          title: formData.title,
          emoji: formData.emoji,
          type: formData.type,
          points_reward: formData.points_reward,
          scheduled_time: formData.scheduled_time || null,
          sort_order: routines.length
        })
        .select()
        .single()

      if (routineError) throw routineError

      // Insert steps
      const stepsToInsert = validSteps.map((s, i) => ({
        routine_id: routineData.id,
        title: s.title,
        emoji: s.emoji,
        duration_minutes: s.duration_minutes,
        sort_order: i
      }))

      const { error: stepsError } = await supabase
        .from('routine_steps')
        .insert(stepsToInsert)

      if (stepsError) throw stepsError

      // Insert routine members
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
    if (!editingRoutine || !formData.title) return

    const validSteps = formData.steps.filter(s => s.title.trim())

    if (!user) {
      const updated = routines.map(r =>
        r.id === editingRoutine.id
          ? {
              ...r,
              title: formData.title,
              emoji: formData.emoji,
              type: formData.type,
              points_reward: formData.points_reward,
              member_ids: formData.member_ids,
              scheduled_time: formData.scheduled_time || null,
              steps: validSteps.map((s, i) => ({
                id: 'step-' + Date.now() + '-' + i,
                routine_id: r.id,
                title: s.title,
                emoji: s.emoji,
                duration_minutes: s.duration_minutes,
                sort_order: i,
                created_at: new Date().toISOString()
              }))
            }
          : r
      )
      setRoutines(updated)
      if (selectedRoutine?.id === editingRoutine.id) {
        setSelectedRoutine(updated.find(r => r.id === editingRoutine.id) || null)
      }
      setShowEditModal(false)
      setEditingRoutine(null)
      resetForm()
      return
    }

    try {
      const { error: routineError } = await supabase
        .from('routines')
        .update({
          title: formData.title,
          emoji: formData.emoji,
          type: formData.type,
          points_reward: formData.points_reward,
          scheduled_time: formData.scheduled_time || null
        })
        .eq('id', editingRoutine.id)

      if (routineError) throw routineError

      // Delete old steps and insert new ones
      await supabase
        .from('routine_steps')
        .delete()
        .eq('routine_id', editingRoutine.id)

      const stepsToInsert = validSteps.map((s, i) => ({
        routine_id: editingRoutine.id,
        title: s.title,
        emoji: s.emoji,
        duration_minutes: s.duration_minutes,
        sort_order: i
      }))

      await supabase
        .from('routine_steps')
        .insert(stepsToInsert)

      // Update routine members
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
    if (!confirm('Delete this routine?')) return

    if (!user) {
      setRoutines(routines.filter(r => r.id !== routine.id))
      if (selectedRoutine?.id === routine.id) {
        setSelectedRoutine(routines[0] || null)
      }
      return
    }

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
      member_ids: routine.member_ids || [],
      scheduled_time: routine.scheduled_time || '',
      points_reward: routine.points_reward,
      steps: routine.steps.map(s => ({
        title: s.title,
        emoji: s.emoji,
        duration_minutes: s.duration_minutes
      }))
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      emoji: '📋',
      type: 'morning',
      member_ids: [],
      scheduled_time: '',
      points_reward: 1,
      steps: [{ title: '', emoji: '✨', duration_minutes: 5 }]
    })
  }

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, { title: '', emoji: '✨', duration_minutes: 5 }]
    })
  }

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index)
    })
  }

  const updateStep = (index: number, field: string, value: string | number) => {
    const newSteps = [...formData.steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setFormData({ ...formData, steps: newSteps })
  }

  // Check if a step is complete for a member
  const isStepCompleteForMember = (stepId: string, memberId: string) => {
    return completedSteps.has(`${stepId}:${memberId}`)
  }

  // Check if step is complete (all assigned members done, or no members assigned)
  const isStepComplete = (stepId: string, memberIds: string[] = []) => {
    if (memberIds.length === 0) {
      return completedSteps.has(`${stepId}:all`)
    }
    return memberIds.every(mid => completedSteps.has(`${stepId}:${mid}`))
  }

  const getProgress = (routine: RoutineWithDetails) => {
    const memberIds = routine.member_ids || []
    const completed = routine.steps.filter(s => isStepComplete(s.id, memberIds)).length
    return { completed, total: routine.steps.length }
  }

  const getTotalDuration = (routine: RoutineWithDetails) => {
    return routine.steps.reduce((acc, s) => acc + s.duration_minutes, 0)
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
          <h1 className="page-header">{t('routines.title')}</h1>
          <p className="page-subtitle">{t('routines.subtitle')}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
          <Plus className="w-5 h-5 mr-2" />
          {t('routines.addRoutine')}
        </Button>
      </div>

      {/* Routine Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {routines.map(routine => {
          const progress = getProgress(routine)
          const isComplete = progress.completed === progress.total
          const isSelected = selectedRoutine?.id === routine.id

          return (
            <Card
              key={routine.id}
              className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-sage-400 dark:ring-sage-500' : ''}`}
              onClick={() => setSelectedRoutine(routine)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  routine.type === 'morning'
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                    : routine.type === 'evening'
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                    : 'bg-gradient-to-br from-sage-400 to-sage-600'
                }`}>
                  {routine.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{routine.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{progress.completed}/{progress.total} {t('routines.done')}</p>
                </div>
                {isComplete && <span className="text-2xl">✓</span>}
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sage-500 transition-all duration-300"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Selected Routine */}
      {selectedRoutine && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedRoutine.emoji}</span>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedRoutine.title}</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    ~{getTotalDuration(selectedRoutine)} min
                  </span>
                  {selectedRoutine.scheduled_time && (
                    <span>{t('routines.startsAt')} {selectedRoutine.scheduled_time}</span>
                  )}
                  {selectedRoutine.points_reward > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500" />
                      {selectedRoutine.points_reward}
                    </span>
                  )}
                  {(selectedRoutine.member_ids?.length || 0) > 0 && (
                    <span className="flex items-center gap-1">
                      {selectedRoutine.member_ids?.slice(0, 3).map(memberId => {
                        const member = getMember(memberId)
                        return member ? (
                          <span
                            key={memberId}
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: member.color }}
                            title={member.name}
                          />
                        ) : null
                      })}
                      {(selectedRoutine.member_ids?.length || 0) > 3 && (
                        <span className="text-xs">+{(selectedRoutine.member_ids?.length || 0) - 3}</span>
                      )}
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

          <div className="space-y-3">
            {selectedRoutine.steps.map((step, index) => {
              const routineMembers = selectedRoutine.member_ids || []
              const hasMembers = routineMembers.length > 0
              const isDone = isStepComplete(step.id, routineMembers)
              const isTimerActive = activeTimer?.stepId === step.id

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isDone
                      ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                      : isTimerActive
                      ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-medium text-slate-400 w-6">{index + 1}</span>

                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-slate-200 dark:bg-slate-600">
                      {step.emoji}
                    </div>

                    <div className="flex-1">
                      <p className={`font-medium text-lg ${isDone ? 'text-green-700 dark:text-green-300 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                        {step.title}
                      </p>
                      {isTimerActive && activeTimer && (
                        <p className="text-amber-600 dark:text-amber-400 font-mono text-lg">
                          {formatTime(activeTimer.timeLeft)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {step.duration_minutes}m
                      </span>
                      {!isDone && (
                        <button
                          onClick={() => startTimer(step)}
                          className={`p-2 rounded-lg transition-colors ${
                            isTimerActive
                              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'
                          }`}
                        >
                          {isTimerActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Per-member completion buttons */}
                  {hasMembers ? (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t('routines.tapToComplete')}:</span>
                      <div className="flex gap-2">
                        {routineMembers.map(memberId => {
                          const member = getMember(memberId)
                          if (!member) return null
                          const memberDone = isStepCompleteForMember(step.id, memberId)
                          return (
                            <button
                              key={memberId}
                              onClick={() => toggleStepForMember(step.id, memberId)}
                              className={`relative w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium transition-all ${
                                memberDone ? 'ring-2 ring-green-500 ring-offset-2' : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: member.color }}
                            >
                              {member.avatar || member.name.charAt(0)}
                              {memberDone && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                      <button
                        onClick={() => toggleStep(step.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                          isDone
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                        }`}
                      >
                        {isDone ? <Check className="w-4 h-4" /> : null}
                        {isDone ? t('routines.done') : t('routines.tapToComplete')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {getProgress(selectedRoutine).completed === selectedRoutine.steps.length && (
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 text-center">
              <p className="text-xl font-bold mb-1">{t('routines.allDoneGreat')}</p>
              <p className="text-sm">
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

          <div className="grid grid-cols-3 gap-4">
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
                {t('routines.startTime')}
              </label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              />
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

          {/* Participants - Multi-select for children */}
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {formData.member_ids.length === 0
                  ? t('routines.everyone')
                  : `${formData.member_ids.length} selected`}
              </p>
            </div>
          )}

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
                    className="w-12 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-center"
                  />
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateStep(index, 'title', e.target.value)}
                    placeholder={t('routines.stepTitlePlaceholder')}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={step.duration_minutes}
                      onChange={(e) => updateStep(index, 'duration_minutes', parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-center"
                      min="1"
                    />
                    <span className="text-sm text-slate-500">min</span>
                  </div>
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
  )
}
