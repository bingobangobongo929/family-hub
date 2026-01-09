'use client'

import { useState } from 'react'
import Card, { CardHeader } from '@/components/Card'
import { CheckSquare, Plus, Filter, User } from 'lucide-react'

interface Task {
  id: number
  title: string
  assignee: string
  assigneeColor: string
  priority: 'low' | 'medium' | 'high'
  done: boolean
  category: string
}

const initialTasks: Task[] = [
  { id: 1, title: "Take out trash", assignee: "Jake", assigneeColor: "bg-green-500", priority: "low", done: true, category: "Chores" },
  { id: 2, title: "Walk the dog", assignee: "Emma", assigneeColor: "bg-purple-500", priority: "medium", done: false, category: "Pets" },
  { id: 3, title: "Grocery shopping", assignee: "Mom", assigneeColor: "bg-pink-500", priority: "high", done: false, category: "Shopping" },
  { id: 4, title: "Fix garage door", assignee: "Dad", assigneeColor: "bg-blue-500", priority: "medium", done: false, category: "Home" },
  { id: 5, title: "Clean bedroom", assignee: "Emma", assigneeColor: "bg-purple-500", priority: "medium", done: false, category: "Chores" },
  { id: 6, title: "Mow the lawn", assignee: "Dad", assigneeColor: "bg-blue-500", priority: "low", done: false, category: "Yard" },
  { id: 7, title: "Do homework", assignee: "Jake", assigneeColor: "bg-green-500", priority: "high", done: false, category: "School" },
  { id: 8, title: "Wash car", assignee: "Dad", assigneeColor: "bg-blue-500", priority: "low", done: true, category: "Chores" },
]

const priorityColors = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<string>('all')

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, done: !task.done } : task
    ))
  }

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter(t => t.assignee === filter)

  const completedCount = tasks.filter(t => t.done).length
  const totalCount = tasks.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)

  const members = [...new Set(tasks.map(t => t.assignee))]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Tasks</h1>
          <p className="text-slate-500 mt-1">Manage family chores and responsibilities.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors">
          <Plus className="w-5 h-5" />
          Add Task
        </button>
      </div>

      {/* Progress */}
      <Card className="mb-6" hover={false}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-600">Weekly Progress</span>
          <span className="text-sm font-bold text-primary-600">{completedCount}/{totalCount} completed</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Card>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {members.map(member => (
          <button
            key={member}
            onClick={() => setFilter(member)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === member
                ? 'bg-primary-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {member}
          </button>
        ))}
      </div>

      {/* Task List */}
      <Card hover={false}>
        <CardHeader
          title="Task List"
          icon={<CheckSquare className="w-5 h-5" />}
        />
        <div className="space-y-2">
          {filteredTasks.map(task => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                task.done ? 'bg-green-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                task.done
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-slate-300 hover:border-primary-500'
              }`}>
                {task.done && <span className="text-sm">✓</span>}
              </div>

              <div className="flex-1">
                <p className={`font-medium ${task.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {task.title}
                </p>
                <span className="text-xs text-slate-500">{task.category}</span>
              </div>

              <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>

              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full ${task.assigneeColor} flex items-center justify-center text-white text-xs font-medium`}>
                  {task.assignee[0]}
                </div>
                <span className="text-sm text-slate-600 hidden sm:inline">{task.assignee}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
