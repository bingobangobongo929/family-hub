import Card, { CardHeader } from '@/components/Card'
import { Calendar, CheckSquare, ShoppingCart, StickyNote, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'

const upcomingEvents = [
  { id: 1, title: "Olivia's Playgroup", time: "10:00 AM", color: "bg-purple-500" },
  { id: 2, title: "Ellie's Nap Time", time: "1:00 PM", color: "bg-green-500" },
  { id: 3, title: "Family Swim Class", time: "Tomorrow 9:30 AM", color: "bg-pink-500" },
]

const recentTasks = [
  { id: 1, title: "Prepare Olivia's lunch box", assignee: "Mum", done: true },
  { id: 2, title: "Restock nappies", assignee: "Dad", done: false },
  { id: 3, title: "Book GP appointment for Ellie", assignee: "Mum", done: false },
  { id: 4, title: "Fix baby gate", assignee: "Dad", done: false },
]

const shoppingPreview = [
  "Nappies", "Baby wipes", "Whole milk", "Bananas", "Pasta"
]

export default function Dashboard() {
  const completedTasks = recentTasks.filter(t => t.done).length
  const totalTasks = recentTasks.length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Welcome back!</h1>
        <p className="text-slate-500 mt-1">Here's what's happening with your family today.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center gap-4">
            <Calendar className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-primary-100 text-sm">Today's Events</p>
              <p className="text-2xl font-bold">3</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center gap-4">
            <CheckSquare className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-green-100 text-sm">Tasks Done</p>
              <p className="text-2xl font-bold">{completedTasks}/{totalTasks}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center gap-4">
            <ShoppingCart className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-orange-100 text-sm">Shopping Items</p>
              <p className="text-2xl font-bold">{shoppingPreview.length}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center gap-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-purple-100 text-sm">Weekly Progress</p>
              <p className="text-2xl font-bold">78%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card>
          <CardHeader
            title="Upcoming Events"
            icon={<Clock className="w-5 h-5" />}
            action={
              <Link href="/calendar" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            }
          />
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className={`w-2 h-10 rounded-full ${event.color}`} />
                <div className="flex-1">
                  <p className="font-medium text-slate-700">{event.title}</p>
                  <p className="text-sm text-slate-500">{event.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader
            title="Family Tasks"
            icon={<CheckSquare className="w-5 h-5" />}
            action={
              <Link href="/tasks" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            }
          />
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                  task.done
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-slate-300'
                }`}>
                  {task.done && <span className="text-xs">✓</span>}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${task.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {task.title}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  {task.assignee}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Shopping List */}
        <Card>
          <CardHeader
            title="Shopping List"
            icon={<ShoppingCart className="w-5 h-5" />}
            action={
              <Link href="/shopping" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            }
          />
          <div className="flex flex-wrap gap-2">
            {shoppingPreview.map((item) => (
              <span
                key={item}
                className="px-3 py-2 rounded-xl bg-orange-50 text-orange-700 text-sm font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        </Card>

        {/* Quick Notes */}
        <Card>
          <CardHeader
            title="Quick Notes"
            icon={<StickyNote className="w-5 h-5" />}
            action={
              <Link href="/notes" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            }
          />
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-yellow-50 border-l-4 border-yellow-400">
              <p className="text-sm text-slate-700">Olivia's 3rd birthday party on Saturday - cake ordered from bakery!</p>
              <p className="text-xs text-slate-500 mt-2">- Mum</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border-l-4 border-blue-400">
              <p className="text-sm text-slate-700">Health visitor coming Thursday 10am</p>
              <p className="text-xs text-slate-500 mt-2">- Dad</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
