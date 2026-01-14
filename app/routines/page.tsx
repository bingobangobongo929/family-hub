'use client'

import { useState, useEffect, useCallback } from 'react'
import Card, { CardHeader } from '@/components/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Sun, Moon, RotateCcw, Plus, Clock, Edit2, Trash2, GripVertical, X, Play, Pause } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useTranslation } from '@/lib/i18n-context'
import { Routine, RoutineStep, RoutineCompletion } from '@/lib/database.types'

// Demo routines for when not logged in
const DEMO_ROUTINES: (Routine & { steps: RoutineStep[] })[] = [
  {
    id: 'demo-morning',
    user_id: 'demo',
    title: 'Morning Routine',
    emoji: '☀️',
    type: 'morning',
    assigned_to: null,
    scheduled_time: '07:00',
    is_active: true,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    steps: [
      { id: 'ms1', routine_id: 'demo-morning', title: 'Get dressed', emoji: '👕', duration_minutes: 5, sort_order: 0, created_at: '' },
      { id: 'ms2', routine_id: 'demo-morning', title: 'Brush teeth', emoji: '🪥', duration_minutes: 3, sort_order: 1, created_at: '' },
      { id: 'ms3', routine_id: 'demo-morning', title: 'Eat breakfast', emoji: '🥣', duration_minutes: 15, sort_order: 2, created_at: '' },
      { id: 'ms4', routine_id: 'demo-morning', title: 'Tidy bedroom', emoji: '🛏️', duration_minutes: 5, sort_order: 3, created_at: '' },
    ]
  },
  {
    id: 'demo-evening',
    user_id: 'demo',
    title: 'Bedtime Routine',
    emoji: '🌙',
    type: 'evening',
    assigned_to: null,
    scheduled_time: '19:00',
    is_active: true,
    sort_order: 1,
    created_at: '',
    updated_at: '',
    steps: [
      { id: 'es1', routine_id: 'demo-evening', title: 'Tidy living room', emoji: '🧹', duration_minutes: 5, sort_order: 0, created_at: '' },
      { id: 'es2', routine_id: 'demo-evening', title: 'Bath time', emoji: '🛁', duration_minutes: 15, sort_order: 1, created_at: '' },
      { id: 'es3', routine_id: 'demo-evening', title: 'Put on pyjamas', emoji: '👚', duration_minutes: 3, sort_order: 2, created_at: '' },
      { id: 'es4', routine_id: 'demo-evening', title: 'Brush teeth', emoji: '🪥', duration_minutes: 3, sort_order: 3, created_at: '' },
      { id: 'es5', routine_id: 'demo-evening', title: 'Bedtime story', emoji: '📖', duration_minutes: 10, sort_order: 4, created_at: '' },
    ]
  }
]

export default function RoutinesPage() {
  const { user } = useAuth()
  const { members, getMember } = useFamily()
  const { t } = useTranslation()
  const [routines, setRoutines] = useState<(Routine & { steps: RoutineStep[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoutine, setSelectedRoutine] = useState<(Routine & { steps: RoutineStep[] }) | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<(Routine & { steps: RoutineStep[] }) | null>(null)
  const [activeTimer, setActiveTimer] = useState<{ stepId: string; timeLeft: number } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    emoji: '📋',
    type: 'morning' as 'morning' | 'evening' | 'custom',
    assigned_to: null as string | null,
    scheduled_time: '',
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

      // Fetch steps for each routine
      const routinesWithSteps = await Promise.all(
        (routinesData || []).map(async (routine) => {
          const { data: stepsData } = await supabase
            .from('routine_steps')
            .select('*')
            .eq('routine_id', routine.id)
            .order('sort_order', { ascending: true })

          return {
            ...routine,
            steps: stepsData || []
          }
        })
      )

      setRoutines(routinesWithSteps as (Routine & { steps: RoutineStep[] })[])

      // Auto-select based on time of day
      const hour = new Date().getHours()
      const morning = routinesWithSteps.find(r => r.type === 'morning')
      const evening = routinesWithSteps.find(r => r.type === 'evening')
      setSelectedRoutine(
        hour < 14
          ? (morning || routinesWithSteps[0] || null)
          : (evening || routinesWithSteps[0] || null)
      )
    } catch (error) {
      console.error('Error fetching routines:', error)
      setRoutines(DEMO_ROUTINES)
      const hour = new Date().getHours()
      setSelectedRoutine(hour < 14 ? DEMO_ROUTINES[0] : DEMO_ROUTINES[1])
    }
    setLoading(false)
  }, [user])

  // Load completions for today
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
        .select('step_id')
        .eq('completed_date', today)

      if (data) {
        setCompletedSteps(new Set(data.map(c => c.step_id)))
      }
    } catch (error) {
      console.error('Error loading completions:', error)
    }
  }, [user])

  useEffect(() => {
    fetchRoutines()
    loadCompletions()
  }, [fetchRoutines, loadCompletions])

  const toggleStep = async (stepId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const newCompleted = new Set(completedSteps)

    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId)
      if (!user) {
        localStorage.setItem('routine-completions-' + today, JSON.stringify([...newCompleted]))
      } else {
        await supabase
          .from('routine_completions')
          .delete()
          .eq('step_id', stepId)
          .eq('completed_date', today)
      }
    } else {
      newCompleted.add(stepId)
      if (!user) {
        localStorage.setItem('routine-completions-' + today, JSON.stringify([...newCompleted]))
      } else {
        await supabase
          .from('routine_completions')
          .insert({
            routine_id: selectedRoutine?.id,
            step_id: stepId,
            completed_date: today
          })
      }
    }

    setCompletedSteps(newCompleted)
  }

  const resetRoutine = async () => {
    if (!selectedRoutine) return

    const today = new Date().toISOString().split('T')[0]
    const stepIds = selectedRoutine.steps.map(s => s.id)
    const newCompleted = new Set([...completedSteps].filter(id => !stepIds.includes(id)))

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

    if (!user) {
      const newRoutine: Routine & { steps: RoutineStep[] } = {
        id: 'demo-' + Date.now(),
        user_id: 'demo',
        title: formData.title,
        emoji: formData.emoji,
        type: formData.type,
        assigned_to: formData.assigned_to,
        scheduled_time: formData.scheduled_time || null,
        is_active: true,
        sort_order: routines.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        steps: validSteps.map((s, i) => ({
          id: 'step-' + Date.now() + '-' + i,
          routine_id: 'demo-' + Date.now(),
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
          assigned_to: formData.assigned_to,
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
              assigned_to: formData.assigned_to,
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
          assigned_to: formData.assigned_to,
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

  const openEditModal = (routine: Routine & { steps: RoutineStep[] }) => {
    setEditingRoutine(routine)
    setFormData({
      title: routine.title,
      emoji: routine.emoji,
      type: routine.type,
      assigned_to: routine.assigned_to,
      scheduled_time: routine.scheduled_time || '',
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
      assigned_to: null,
      scheduled_time: '',
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

  const getProgress = (routine: Routine & { steps: RoutineStep[] }) => {
    const completed = routine.steps.filter(s => completedSteps.has(s.id)).length
    return { completed, total: routine.steps.length }
  }

  const getTotalDuration = (routine: Routine & { steps: RoutineStep[] }) => {
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
                  {selectedRoutine.assigned_to && (
                    <span className="flex items-center gap-1">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getMember(selectedRoutine.assigned_to)?.color || '#888' }}
                      />
                      {getMember(selectedRoutine.assigned_to)?.name}
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
              const isDone = completedSteps.has(step.id)
              const isTimerActive = activeTimer?.stepId === step.id

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    isDone
                      ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                      : isTimerActive
                      ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className="text-lg font-medium text-slate-400 w-6">{index + 1}</span>

                  <button
                    onClick={() => toggleStep(step.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${
                      isDone
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-400 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'
                    }`}
                  >
                    {isDone ? '✓' : step.emoji}
                  </button>

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
                {t('routines.assignedTo')}
              </label>
              <select
                value={formData.assigned_to || ''}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value || null })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              >
                <option value="">{t('routines.everyone')}</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
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
          </div>

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
