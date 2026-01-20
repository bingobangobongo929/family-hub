'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, isToday, isTomorrow, isPast, addHours, addDays } from 'date-fns'
import {
  CheckSquare, Plus, Trash2, Send, Sparkles, Clock,
  Archive, Play, Pause, Filter, Edit3, X, Calendar,
  Bell, BellOff, User, Tag, ChevronDown
} from 'lucide-react'
import Card, { CardHeader } from '@/components/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
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

type StatusFilter = 'active' | 'completed' | 'all'

export default function TasksPage() {
  const { user, session } = useAuth()
  const { members } = useFamily()

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [taskInput, setTaskInput] = useState('')
  const [isParsingTask, setIsParsingTask] = useState(false)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Modals
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<string | null>(null)
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('📌')

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!user || !session?.access_token) {
      setLoading(false)
      return
    }

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
    setLoading(false)
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

  useEffect(() => {
    fetchTasks()
    fetchCategories()
  }, [fetchTasks, fetchCategories])

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
    if (!session?.access_token) return false

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

  // Update task
  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!session?.access_token) return

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    ))

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        await fetchTasks()
      }
    } catch (error) {
      console.error('Error updating task:', error)
      await fetchTasks()
    }
  }

  // Update task status
  const updateTaskStatus = async (taskId: string, status: Task['status'], snoozedUntil?: string) => {
    if (!session?.access_token) return

    const updates: Partial<Task> = {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      snoozed_until: snoozedUntil || null,
    }

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
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
        body: JSON.stringify({ status, snoozed_until: snoozedUntil }),
      })

      if (!response.ok) {
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

  // Create category
  const createCategory = async () => {
    if (!newCategoryName.trim() || !session?.access_token) return

    try {
      const response = await fetch('/api/tasks/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: newCategoryName,
          emoji: newCategoryEmoji,
        }),
      })

      if (response.ok) {
        await fetchCategories()
        setShowNewCategoryModal(false)
        setNewCategoryName('')
        setNewCategoryEmoji('📌')
      }
    } catch (error) {
      console.error('Error creating category:', error)
    }
  }

  // Snooze options
  const snoozeOptions = [
    { label: 'In 1 hour', getValue: () => addHours(new Date(), 1).toISOString() },
    { label: 'In 3 hours', getValue: () => addHours(new Date(), 3).toISOString() },
    { label: 'Tomorrow morning', getValue: () => {
      const tomorrow = addDays(new Date(), 1)
      tomorrow.setHours(9, 0, 0, 0)
      return tomorrow.toISOString()
    }},
    { label: 'Tomorrow evening', getValue: () => {
      const tomorrow = addDays(new Date(), 1)
      tomorrow.setHours(18, 0, 0, 0)
      return tomorrow.toISOString()
    }},
    { label: 'Next week', getValue: () => addDays(new Date(), 7).toISOString() },
  ]

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Status filter
    if (statusFilter === 'active' && task.status !== 'pending' && task.status !== 'in_progress' && task.status !== 'snoozed') return false
    if (statusFilter === 'completed' && task.status !== 'completed') return false
    if (statusFilter === 'all' && task.status === 'archived') return false

    // Assignee filter
    if (assigneeFilter && task.assignee_id !== assigneeFilter) return false

    // Category filter
    if (categoryFilter && task.category_id !== categoryFilter) return false

    return true
  })

  // Sort: urgent first, then by due date, then by created
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Urgent/high first
    const urgencyOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (urgencyDiff !== 0) return urgencyDiff

    // Then by due date
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date) return -1
    if (b.due_date) return 1

    // Then by created
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Stats
  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length
  const completedTodayCount = tasks.filter(t =>
    t.status === 'completed' && t.completed_at && isToday(new Date(t.completed_at))
  ).length
  const urgentCount = tasks.filter(t =>
    (t.status === 'pending' || t.status === 'in_progress') &&
    (t.urgency === 'urgent' || t.urgency === 'high')
  ).length
  const overdueCount = tasks.filter(t =>
    (t.status === 'pending' || t.status === 'in_progress') &&
    t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
  ).length

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
      return { text: 'Today', className: 'text-orange-600 dark:text-orange-400', urgent: true }
    }
    if (isTomorrow(dueDate)) {
      return { text: 'Tomorrow', className: 'text-yellow-600 dark:text-yellow-400', urgent: false }
    }
    if (isOverdue) {
      return { text: 'Overdue', className: 'text-red-600 dark:text-red-400 font-semibold', urgent: true }
    }
    return { text: format(dueDate, 'MMM d'), className: 'text-slate-500 dark:text-slate-400', urgent: false }
  }

  const hasActiveFilters = assigneeFilter || categoryFilter

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tasks</h1>
        <p className="text-slate-500 dark:text-slate-400">Quick capture with smart reminders</p>
      </div>

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
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          AI detects deadlines, urgency, and assigns to family members automatically
        </p>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="bg-gradient-to-br from-sage-500 to-sage-600 text-white p-4">
          <div className="text-center">
            <p className="text-sage-100 text-xs uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-4">
          <div className="text-center">
            <p className="text-green-100 text-xs uppercase tracking-wide">Done Today</p>
            <p className="text-2xl font-bold">{completedTodayCount}</p>
          </div>
        </Card>
        {overdueCount > 0 && (
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4">
            <div className="text-center">
              <p className="text-red-100 text-xs uppercase tracking-wide">Overdue</p>
              <p className="text-2xl font-bold">{overdueCount}</p>
            </div>
          </Card>
        )}
        {urgentCount > 0 && overdueCount === 0 && (
          <Card className="bg-gradient-to-br from-orange-500 to-amber-500 text-white p-4">
            <div className="text-center">
              <p className="text-orange-100 text-xs uppercase tracking-wide">Urgent</p>
              <p className="text-2xl font-bold">{urgentCount}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 no-select-interactive">
        {/* Status Filter */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(['active', 'completed', 'all'] as StatusFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                statusFilter === filter
                  ? 'bg-white dark:bg-slate-700 text-sage-600 dark:text-sage-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
            hasActiveFilters
              ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-sage-500" />
          )}
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setAssigneeFilter(null)
              setCategoryFilter(null)
            }}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <Card className="mb-4 p-4 no-select-interactive">
          <div className="flex flex-wrap gap-4">
            {/* Assignee Filter */}
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                <User className="w-3 h-3" /> Assigned to
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAssigneeFilter(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    !assigneeFilter
                      ? 'bg-sage-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  All
                </button>
                {members.map(member => (
                  <button
                    key={member.id}
                    onClick={() => setAssigneeFilter(member.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      assigneeFilter === member.id
                        ? 'bg-sage-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: member.color }}
                    />
                    {member.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Category
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    !categoryFilter
                      ? 'bg-sage-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      categoryFilter === cat.id
                        ? 'bg-sage-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat.emoji} {cat.name}
                  </button>
                ))}
                <button
                  onClick={() => setShowNewCategoryModal(true)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <div className="text-center py-8">
              <div className="animate-pulse text-slate-400">Loading tasks...</div>
            </div>
          </Card>
        ) : sortedTasks.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-700 mb-4" />
              <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
                {statusFilter === 'active' ? 'All caught up!' : 'No tasks found'}
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Type a task above to get started
              </p>
            </div>
          </Card>
        ) : (
          sortedTasks.map(task => {
            const dueDisplay = getDueDateDisplay(task)
            const isCompleted = task.status === 'completed'
            const isInProgress = task.status === 'in_progress'
            const isSnoozed = task.status === 'snoozed'

            return (
              <Card
                key={task.id}
                className={`transition-all ${isCompleted ? 'opacity-60' : ''} ${
                  dueDisplay?.urgent && !isCompleted ? 'ring-2 ring-red-200 dark:ring-red-900' : ''
                }`}
                hover={!isCompleted}
              >
                <div className="flex items-start gap-3">
                  {/* Status Toggle */}
                  <button
                    onClick={() => updateTaskStatus(
                      task.id,
                      isCompleted ? 'pending' : 'completed'
                    )}
                    className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isInProgress
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : isSnoozed
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-sage-500 hover:bg-sage-50 dark:hover:bg-sage-900/20'
                    }`}
                  >
                    {isCompleted ? '✓' : isInProgress ? <Play className="w-4 h-4" /> : isSnoozed ? <BellOff className="w-4 h-4" /> : null}
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
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
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
                      {task.urgency !== 'normal' && !isCompleted && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getUrgencyStyle(task.urgency)}`}>
                          {task.urgency === 'urgent' && '🚨 '}
                          {task.urgency === 'high' && '⚠️ '}
                          {task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)}
                        </span>
                      )}

                      {/* Due Date */}
                      {dueDisplay && !isCompleted && (
                        <span className={`text-xs flex items-center gap-1 ${dueDisplay.className}`}>
                          <Clock className="w-3 h-3" />
                          {dueDisplay.text}
                        </span>
                      )}

                      {/* Snoozed indicator */}
                      {isSnoozed && task.snoozed_until && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <BellOff className="w-3 h-3" />
                          Until {format(new Date(task.snoozed_until), 'MMM d, h:mm a')}
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
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: task.assignee.color }}
                      title={task.assignee.name}
                    >
                      {task.assignee.name[0]}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {!isCompleted && (
                      <>
                        {/* Start/Pause */}
                        <button
                          onClick={() => updateTaskStatus(
                            task.id,
                            isInProgress ? 'pending' : 'in_progress'
                          )}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title={isInProgress ? 'Pause' : 'Start'}
                        >
                          {isInProgress ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        {/* Snooze */}
                        <div className="relative">
                          <button
                            onClick={() => setShowSnoozeMenu(showSnoozeMenu === task.id ? null : task.id)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            title="Snooze"
                          >
                            <Bell className="w-4 h-4" />
                          </button>

                          {showSnoozeMenu === task.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10 min-w-[160px]">
                              {snoozeOptions.map(option => (
                                <button
                                  key={option.label}
                                  onClick={() => {
                                    updateTaskStatus(task.id, 'snoozed', option.getValue())
                                    setShowSnoozeMenu(null)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Edit */}
                    <button
                      onClick={() => setEditingTask(task)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-sage-500 hover:bg-sage-50 dark:hover:bg-sage-900/20 transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Archive/Delete */}
                    <button
                      onClick={() => isCompleted ? deleteTask(task.id) : updateTaskStatus(task.id, 'archived')}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title={isCompleted ? 'Delete' : 'Archive'}
                    >
                      {isCompleted ? <Trash2 className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Edit Task Modal */}
      <Modal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Edit Task"
        size="md"
      >
        {editingTask && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={editingTask.description || ''}
                onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned to
                </label>
                <select
                  value={editingTask.assignee_id || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, assignee_id: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Unassigned</option>
                  {members.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={editingTask.category_id || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, category_id: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="">No category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editingTask.due_date || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value || null })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Urgency
                </label>
                <select
                  value={editingTask.urgency}
                  onChange={(e) => setEditingTask({ ...editingTask, urgency: e.target.value as Task['urgency'] })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {editingTask.raw_input && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Original input</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{editingTask.raw_input}"</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setEditingTask(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateTask(editingTask.id, {
                    title: editingTask.title,
                    description: editingTask.description,
                    assignee_id: editingTask.assignee_id,
                    category_id: editingTask.category_id,
                    due_date: editingTask.due_date,
                    urgency: editingTask.urgency,
                  })
                  setEditingTask(null)
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Category Modal */}
      <Modal
        isOpen={showNewCategoryModal}
        onClose={() => setShowNewCategoryModal(false)}
        title="New Category"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Emoji
              </label>
              <input
                type="text"
                value={newCategoryEmoji}
                onChange={(e) => setNewCategoryEmoji(e.target.value.slice(-2))}
                className="w-16 h-12 text-2xl text-center rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                maxLength={2}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Taxes, Car, Travel"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNewCategoryModal(false)}>
              Cancel
            </Button>
            <Button onClick={createCategory} disabled={!newCategoryName.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Click outside to close snooze menu */}
      {showSnoozeMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowSnoozeMenu(null)}
        />
      )}
    </div>
  )
}
