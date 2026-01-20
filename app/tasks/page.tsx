'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns'
import {
  CheckSquare, Plus, Star, Trash2, Send, Sparkles, Clock, AlertTriangle,
  Archive, Play, Pause, ChevronDown, Filter, MoreHorizontal, Calendar
} from 'lucide-react'
import Card, { CardHeader } from '@/components/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { Chore, CHORE_CATEGORIES, getChoreCategoryConfig } from '@/lib/database.types'
import { useTranslation } from '@/lib/i18n-context'
import { hapticSuccess, hapticLight, hapticMedium } from '@/lib/haptics'

// Types
interface Task {
  id: string
  title: string
  description: string | null
  raw_input: string | null
  assignee_id: string | null
  creator_id: string | null
  category_id: string | null
  due_date: string | null
  due_time: string | null
  due_context: string | null
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed' | 'archived' | 'snoozed'
  snoozed_until: string | null
  is_recurring: boolean
  ai_parsed: boolean
  ai_confidence: number | null
  completed_at: string | null
  created_at: string
  assignee?: { id: string; name: string; color: string; avatar?: string } | null
  creator?: { id: string; name: string; color: string } | null
  category?: { id: string; name: string; emoji: string; color: string } | null
}

interface TaskCategory {
  id: string
  name: string
  emoji: string
  color: string
}

type TabType = 'tasks' | 'chores'

export default function TasksPage() {
  const { user, session } = useAuth()
  const { members, getMember, updateMemberPoints } = useFamily()
  const { t } = useTranslation()

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('tasks')

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [taskInput, setTaskInput] = useState('')
  const [isParsingTask, setIsParsingTask] = useState(false)
  const [taskFilter, setTaskFilter] = useState<string>('active')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Chores state (existing)
  const [chores, setChores] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [choreFilter, setChoreFilter] = useState<string>('all')
  const [showChoreModal, setShowChoreModal] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    emoji: '✨',
    description: '',
    assigned_to: '',
    points: 1,
    due_date: '',
    category: 'general',
    repeat_frequency: 'none' as const,
  })

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!user || !session?.access_token) return

    try {
      const response = await fetch('/api/tasks?include_archived=false', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }, [user, session])

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!user || !session?.access_token) return

    try {
      const response = await fetch('/api/tasks/categories', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [user, session])

  // Fetch chores
  const fetchChores = useCallback(async () => {
    if (!user) {
      setChores([])
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('chores')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setChores((data as Chore[]) || [])
    } catch (error) {
      console.error('Error fetching chores:', error)
      setChores([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTasks()
    fetchCategories()
    fetchChores()
  }, [fetchTasks, fetchCategories, fetchChores])

  // Parse task with AI
  const handleParseTask = async () => {
    if (!taskInput.trim() || !session?.access_token) return

    setIsParsingTask(true)
    hapticLight()

    try {
      const response = await fetch('/api/tasks/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: taskInput }),
      })

      if (response.ok) {
        const data = await response.json()

        if (data.tasks && data.tasks.length > 0) {
          // Create tasks from parsed results
          for (const parsedTask of data.tasks) {
            await createTask({
              title: parsedTask.title,
              description: parsedTask.description,
              raw_input: taskInput,
              assignee_id: parsedTask.assignee_match?.id || null,
              due_date: parsedTask.due_date,
              due_time: parsedTask.due_time,
              due_context: parsedTask.due_context,
              urgency: parsedTask.urgency,
              category_name: parsedTask.suggested_category,
              ai_parsed: true,
              ai_confidence: data.confidence,
            })
          }
          hapticSuccess()
          setTaskInput('')
          await fetchTasks()
        } else {
          // If no tasks parsed, create a simple task
          await createTask({
            title: taskInput,
            raw_input: taskInput,
            ai_parsed: false,
          })
          hapticMedium()
          setTaskInput('')
          await fetchTasks()
        }
      }
    } catch (error) {
      console.error('Error parsing task:', error)
      // Fallback: create simple task
      await createTask({
        title: taskInput,
        raw_input: taskInput,
        ai_parsed: false,
      })
      setTaskInput('')
      await fetchTasks()
    }

    setIsParsingTask(false)
  }

  // Create task
  const createTask = async (taskData: Partial<Task> & { category_name?: string }) => {
    if (!session?.access_token) return

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(taskData),
      })

      return response.ok
    } catch (error) {
      console.error('Error creating task:', error)
      return false
    }
  }

  // Update task status
  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    if (!session?.access_token) return

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status, completed_at: status === 'completed' ? new Date().toISOString() : null } : t
    ))

    if (status === 'completed') {
      hapticSuccess()
    } else {
      hapticLight()
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        // Revert on failure
        await fetchTasks()
      }
    } catch (error) {
      console.error('Error updating task:', error)
      await fetchTasks()
    }
  }

  // Delete task
  const deleteTask = async (taskId: string) => {
    if (!session?.access_token) return

    // Optimistic update
    setTasks(prev => prev.filter(t => t.id !== taskId))

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
    } catch (error) {
      console.error('Error deleting task:', error)
      await fetchTasks()
    }
  }

  // Archive task
  const archiveTask = async (taskId: string) => {
    await updateTaskStatus(taskId, 'archived')
  }

  // Chore handlers (existing)
  const handleToggleChore = async (chore: Chore) => {
    if (!user) return

    const newStatus = chore.status === 'completed' ? 'pending' : 'completed'
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null
    const pointsChange = newStatus === 'completed' ? chore.points : -chore.points

    if (newStatus === 'completed') {
      hapticSuccess()
    } else {
      hapticLight()
    }

    setChores(prev => prev.map(c =>
      c.id === chore.id
        ? { ...c, status: newStatus, completed_at: completedAt, completed_by: newStatus === 'completed' ? chore.assigned_to : null }
        : c
    ))

    if (chore.assigned_to && chore.points > 0) {
      updateMemberPoints(chore.assigned_to, pointsChange)
    }

    supabase
      .from('chores')
      .update({
        status: newStatus,
        completed_at: completedAt,
        completed_by: newStatus === 'completed' ? chore.assigned_to : null,
      })
      .eq('id', chore.id)
      .then(({ error }) => {
        if (error) {
          console.error('Error updating chore:', error)
          setChores(prev => prev.map(c =>
            c.id === chore.id ? chore : c
          ))
          if (chore.assigned_to && chore.points > 0) {
            updateMemberPoints(chore.assigned_to, -pointsChange)
          }
        }
      })
  }

  const handleAddChore = () => {
    setFormData({
      title: '',
      emoji: '✨',
      description: '',
      assigned_to: '',
      points: 1,
      due_date: format(new Date(), 'yyyy-MM-dd'),
      category: 'general',
      repeat_frequency: 'none',
    })
    setShowChoreModal(true)
  }

  const handleSaveChore = async () => {
    if (!user || !formData.title.trim()) return

    const choreData = {
      title: formData.title,
      emoji: formData.emoji,
      description: formData.description || null,
      assigned_to: formData.assigned_to || null,
      points: formData.points,
      due_date: formData.due_date || null,
      category: formData.category,
      repeat_frequency: formData.repeat_frequency,
      status: 'pending' as const,
      repeat_interval: 1,
      sort_order: chores.length,
    }

    try {
      const { error } = await supabase
        .from('chores')
        .insert(choreData)

      if (error) throw error
      await fetchChores()
      setShowChoreModal(false)
    } catch (error) {
      console.error('Error saving chore:', error)
    }
  }

  const handleDeleteChore = async (choreId: string) => {
    if (!user) return

    const deletedChore = chores.find(c => c.id === choreId)
    setChores(prev => prev.filter(c => c.id !== choreId))

    supabase
      .from('chores')
      .delete()
      .eq('id', choreId)
      .then(({ error }) => {
        if (error) {
          console.error('Error deleting chore:', error)
          if (deletedChore) {
            setChores(prev => [...prev, deletedChore].sort((a, b) => a.sort_order - b.sort_order))
          }
        }
      })
  }

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (taskFilter === 'active') return task.status === 'pending' || task.status === 'in_progress'
    if (taskFilter === 'completed') return task.status === 'completed'
    if (taskFilter === 'all') return task.status !== 'archived'
    return true
  })

  // Filter chores
  const filteredChores = choreFilter === 'all'
    ? chores
    : chores.filter(c => c.assigned_to === choreFilter)

  // Stats
  const pendingTasksCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length
  const completedTasksCount = tasks.filter(t => t.status === 'completed').length
  const urgentTasksCount = tasks.filter(t => (t.status === 'pending' || t.status === 'in_progress') && (t.urgency === 'urgent' || t.urgency === 'high')).length

  const completedChoresCount = chores.filter(c => c.status === 'completed').length
  const totalChoresCount = chores.length
  const totalStarsToday = chores
    .filter(c => c.status === 'completed')
    .reduce((sum, c) => sum + c.points, 0)

  // Get urgency style
  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
      case 'low': return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
    }
  }

  // Get due date display
  const getDueDateDisplay = (task: Task) => {
    if (!task.due_date) return null

    const dueDate = new Date(task.due_date)
    const isOverdue = isPast(dueDate) && !isToday(dueDate)

    if (isToday(dueDate)) {
      return { text: 'Today', className: 'text-orange-600 dark:text-orange-400' }
    }
    if (isTomorrow(dueDate)) {
      return { text: 'Tomorrow', className: 'text-yellow-600 dark:text-yellow-400' }
    }
    if (isOverdue) {
      return { text: 'Overdue', className: 'text-red-600 dark:text-red-400' }
    }
    return { text: format(dueDate, 'MMM d'), className: 'text-slate-500 dark:text-slate-400' }
  }

  return (
    <div className="page-container">
      {/* Tab Header */}
      <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 px-1 text-lg font-semibold transition-colors relative ${
            activeTab === 'tasks'
              ? 'text-sage-600 dark:text-sage-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Tasks
          {pendingTasksCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300">
              {pendingTasksCount}
            </span>
          )}
          {activeTab === 'tasks' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('chores')}
          className={`pb-3 px-1 text-lg font-semibold transition-colors relative ${
            activeTab === 'chores'
              ? 'text-sage-600 dark:text-sage-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Chores
          {totalChoresCount - completedChoresCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {totalChoresCount - completedChoresCount}
            </span>
          )}
          {activeTab === 'chores' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-500" />
          )}
        </button>
      </div>

      {activeTab === 'tasks' ? (
        /* TASKS TAB */
        <div>
          {/* Quick Add Input */}
          <Card className="mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isParsingTask) {
                      handleParseTask()
                    }
                  }}
                  placeholder="Type a task... e.g., 'Call dentist tomorrow' or 'For Ed: Pick up dry cleaning'"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  disabled={isParsingTask}
                />
                {isParsingTask && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Sparkles className="w-5 h-5 text-sage-500 animate-pulse" />
                  </div>
                )}
              </div>
              <Button
                onClick={handleParseTask}
                disabled={!taskInput.trim() || isParsingTask}
                className="gap-2 px-6"
              >
                <Send className="w-5 h-5" />
                Add
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              AI will automatically detect deadlines, urgency, and who it's for
            </p>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-sage-500 to-sage-600 text-white">
              <div className="text-center">
                <p className="text-sage-100 text-sm">Pending</p>
                <p className="text-2xl font-bold">{pendingTasksCount}</p>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <div className="text-center">
                <p className="text-green-100 text-sm">Done</p>
                <p className="text-2xl font-bold">{completedTasksCount}</p>
              </div>
            </Card>
            {urgentTasksCount > 0 && (
              <Card className="bg-gradient-to-br from-red-500 to-orange-500 text-white">
                <div className="text-center">
                  <p className="text-red-100 text-sm">Urgent</p>
                  <p className="text-2xl font-bold">{urgentTasksCount}</p>
                </div>
              </Card>
            )}
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {['active', 'completed', 'all'].map(filter => (
              <button
                key={filter}
                onClick={() => setTaskFilter(filter)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-[44px] capitalize ${
                  taskFilter === filter
                    ? 'bg-sage-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <Card>
                <div className="text-center py-8">
                  <CheckSquare className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {taskFilter === 'active' ? 'No pending tasks' : 'No tasks found'}
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    Type a task above to get started
                  </p>
                </div>
              </Card>
            ) : (
              filteredTasks.map(task => {
                const dueDisplay = getDueDateDisplay(task)
                const isCompleted = task.status === 'completed'
                const isInProgress = task.status === 'in_progress'

                return (
                  <Card
                    key={task.id}
                    className={`transition-all ${
                      isCompleted ? 'opacity-60' : ''
                    }`}
                    hover={!isCompleted}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Toggle */}
                      <button
                        onClick={() => updateTaskStatus(
                          task.id,
                          isCompleted ? 'pending' : 'completed'
                        )}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all flex-shrink-0 mt-1 ${
                          isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : isInProgress
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 hover:border-sage-500 hover:bg-sage-50 dark:hover:bg-sage-900/20'
                        }`}
                      >
                        {isCompleted ? '✓' : isInProgress ? <Play className="w-4 h-4" /> : null}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${
                          isCompleted
                            ? 'text-slate-400 dark:text-slate-500 line-through'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}>
                          {task.title}
                        </p>

                        {task.description && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Category */}
                          {task.category && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: task.category.color + '20',
                                color: task.category.color,
                              }}
                            >
                              {task.category.emoji} {task.category.name}
                            </span>
                          )}

                          {/* Urgency */}
                          {task.urgency !== 'normal' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getUrgencyStyle(task.urgency)}`}>
                              {task.urgency === 'urgent' && '🚨 '}
                              {task.urgency === 'high' && '⚠️ '}
                              {task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)}
                            </span>
                          )}

                          {/* Due Date */}
                          {dueDisplay && (
                            <span className={`text-xs flex items-center gap-1 ${dueDisplay.className}`}>
                              <Clock className="w-3 h-3" />
                              {dueDisplay.text}
                            </span>
                          )}

                          {/* AI Badge */}
                          {task.ai_parsed && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> AI
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assignee */}
                      {task.assignee && (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                          style={{ backgroundColor: task.assignee.color }}
                          title={task.assignee.name}
                        >
                          {task.assignee.avatar || task.assignee.name[0]}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {!isCompleted && (
                          <button
                            onClick={() => updateTaskStatus(
                              task.id,
                              isInProgress ? 'pending' : 'in_progress'
                            )}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title={isInProgress ? 'Pause' : 'Start'}
                          >
                            {isInProgress ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          </button>
                        )}
                        <button
                          onClick={() => archiveTask(task.id)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* CHORES TAB (Existing) */
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-slate-500 dark:text-slate-400">{t('tasks.subtitle')}</p>
            </div>
            <Button onClick={handleAddChore} className="gap-2 w-full sm:w-auto">
              <Plus className="w-5 h-5" />
              {t('tasks.addChore')}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-sage-500 to-sage-600 text-white">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-8 h-8 opacity-80" />
                <div>
                  <p className="text-sage-100 text-sm">{t('tasks.completed')}</p>
                  <p className="text-2xl font-bold">{completedChoresCount}/{totalChoresCount}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-amber-400 to-orange-500 text-white">
              <div className="flex items-center gap-3">
                <Star className="w-8 h-8 opacity-80" />
                <div>
                  <p className="text-amber-100 text-sm">{t('tasks.starsToday')}</p>
                  <p className="text-2xl font-bold">{totalStarsToday}</p>
                </div>
              </div>
            </Card>
            <Card className="hidden sm:block">
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('tasks.progress')}</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {totalChoresCount > 0 ? Math.round((completedChoresCount / totalChoresCount) * 100) : 0}%
                </p>
              </div>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setChoreFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                choreFilter === 'all'
                  ? 'bg-sage-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('common.all')}
            </button>
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => setChoreFilter(member.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-[44px] flex items-center gap-2 ${
                  choreFilter === member.id
                    ? 'bg-sage-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ backgroundColor: member.color }}
                >
                  {member.name[0]}
                </div>
                {member.name}
              </button>
            ))}
          </div>

          {/* Chore List */}
          <Card hover={false}>
            <CardHeader
              title={t('tasks.todaysChores')}
              icon={<CheckSquare className="w-5 h-5" />}
            />
            {loading ? (
              <p className="text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
            ) : filteredChores.length === 0 ? (
              <div className="text-center py-8">
                <CheckSquare className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">{t('tasks.noChores')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredChores.map(chore => {
                  const assignee = getMember(chore.assigned_to)
                  const categoryConfig = getChoreCategoryConfig(chore.category)
                  const isCompleted = chore.status === 'completed'

                  return (
                    <div
                      key={chore.id}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                        isCompleted
                          ? 'bg-green-50 dark:bg-green-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <button
                        onClick={() => handleToggleChore(chore)}
                        className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl transition-all flex-shrink-0 ${
                          isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 hover:border-sage-500 hover:bg-sage-50 dark:hover:bg-sage-900/20'
                        }`}
                      >
                        {isCompleted ? '✓' : chore.emoji}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${isCompleted ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                          {chore.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${categoryConfig.color}`}>
                            {categoryConfig.label}
                          </span>
                          {chore.points > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 flex items-center gap-1">
                              <Star className="w-3 h-3" /> {chore.points}
                            </span>
                          )}
                        </div>
                      </div>

                      {assignee && (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                          style={{ backgroundColor: assignee.color }}
                          title={assignee.name}
                        >
                          {assignee.name[0]}
                        </div>
                      )}

                      <button
                        onClick={() => handleDeleteChore(chore.id)}
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 tap-highlight"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Add Chore Modal */}
      <Modal isOpen={showChoreModal} onClose={() => setShowChoreModal(false)} title={t('tasks.addChore')} size="md">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('tasks.icon')}
              </label>
              <select
                value={formData.emoji}
                onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                className="w-16 h-12 text-2xl text-center rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                {CHORE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.emoji}>{c.emoji}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('tasks.choreTitle')} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                placeholder={t('tasks.choreTitlePlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('tasks.assignTo')}
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              >
                <option value="">{t('tasks.unassigned')}</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('stars.title')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  className="w-20 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
                <Star className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.category')}
            </label>
            <div className="flex flex-wrap gap-2">
              {CHORE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.id, emoji: cat.emoji })}
                  className={`px-3 py-2 rounded-xl text-sm transition-all ${
                    formData.category === cat.id
                      ? 'ring-2 ring-sage-500 ' + cat.color
                      : cat.color + ' opacity-70 hover:opacity-100'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.repeat')}
            </label>
            <select
              value={formData.repeat_frequency}
              onChange={(e) => setFormData({ ...formData, repeat_frequency: e.target.value as typeof formData.repeat_frequency })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              <option value="none">{t('tasks.oneTime')}</option>
              <option value="daily">{t('tasks.daily')}</option>
              <option value="weekly">{t('tasks.weekly')}</option>
              <option value="monthly">{t('tasks.monthly')}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowChoreModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveChore} disabled={!formData.title.trim()}>
              {t('tasks.saveChore')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
