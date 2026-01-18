'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, Trash2, Calendar, ShoppingCart, Repeat, Trash, Flag, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatDistanceToNow } from 'date-fns'

interface NotificationLog {
  id: string
  user_id: string
  category: string
  notification_type: string
  title: string
  body: string
  data: Record<string, any> | null
  status: 'sent' | 'read' | 'dismissed'
  sent_at: string
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  calendar: <Calendar className="w-5 h-5" />,
  shopping: <ShoppingCart className="w-5 h-5" />,
  routine: <Repeat className="w-5 h-5" />,
  bins: <Trash className="w-5 h-5" />,
  f1: <Flag className="w-5 h-5" />,
  chores: <Check className="w-5 h-5" />,
}

const CATEGORY_COLORS: Record<string, string> = {
  calendar: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  shopping: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  routine: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  bins: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  f1: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  chores: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    try {
      let query = supabase
        .from('notification_log')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'dismissed') // Don't show dismissed notifications
        .order('sent_at', { ascending: false })
        .limit(50)

      if (filter) {
        query = query.eq('category', filter)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching notifications:', error)
      } else {
        setNotifications(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [user, filter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    await supabase
      .from('notification_log')
      .update({ status: 'read' })
      .eq('id', id)

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, status: 'read' as const } : n)
    )
  }

  const dismissNotification = async (id: string) => {
    await supabase
      .from('notification_log')
      .update({ status: 'dismissed' })
      .eq('id', id)

    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const markAllAsRead = async () => {
    if (!user) return

    await supabase
      .from('notification_log')
      .update({ status: 'read' })
      .eq('user_id', user.id)
      .eq('status', 'sent')

    setNotifications(prev =>
      prev.map(n => ({ ...n, status: 'read' as const }))
    )
  }

  const handleNotificationClick = (notification: NotificationLog) => {
    markAsRead(notification.id)

    // Navigate based on deep_link or category
    const deepLink = notification.data?.deep_link
    if (deepLink) {
      router.push(deepLink)
      return
    }

    // Fallback navigation based on category
    switch (notification.category) {
      case 'calendar':
        router.push('/calendar')
        break
      case 'shopping':
        router.push('/shopping')
        break
      case 'routine':
        router.push('/routines')
        break
      case 'bins':
        router.push('/bindicator')
        break
      case 'f1':
        router.push('/f1')
        break
      case 'chores':
        router.push('/tasks')
        break
    }
  }

  const unreadCount = notifications.filter(n => n.status === 'sent').length
  const categories = [...new Set(notifications.map(n => n.category))]

  if (!user) {
    return (
      <div className="page-container">
        <div className="text-center py-12">
          <Bell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">Sign in to view notifications</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-sm bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="page-subtitle">Your notification history</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Category filters */}
      {categories.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === null
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors capitalize ${
                filter === cat
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto" />
        </div>
      ) : notifications.length === 0 ? (
        <Card className="text-center py-12" hover={false}>
          <Bell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 mb-2">No notifications yet</p>
          <p className="text-sm text-slate-400">
            You'll see notifications here when events are created, bins need taking out, and more.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => (
            <Card
              key={notification.id}
              className={`p-4 cursor-pointer transition-all ${
                notification.status === 'sent'
                  ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                  : ''
              }`}
              hover={true}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${CATEGORY_COLORS[notification.category] || 'bg-slate-100 text-slate-600'}`}>
                  {CATEGORY_ICONS[notification.category] || <Bell className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-medium ${notification.status === 'sent' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(notification.sent_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-line line-clamp-2">
                    {notification.body}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissNotification(notification.id)
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
