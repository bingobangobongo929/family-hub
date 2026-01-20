'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Card, { CardHeader } from '@/components/Card'
import Button from '@/components/ui/Button'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw, Send, Trash2, Bell, Smartphone, Server, Clock, Zap, Terminal } from 'lucide-react'
import { usePush } from '@/lib/push-context'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { getDebugLogs, clearDebugLogs } from '@/lib/debug-logger'

interface StatusCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  detail: string
}

interface NotificationStatus {
  status: 'pass' | 'fail' | 'warning'
  checks: StatusCheck[]
  data: {
    push_token: { platform: string; token_preview: string; created_at: string; updated_at: string } | null
    notification_preferences: { exists: boolean; updated_at?: string; [key: string]: any }
    f1_notification_state: { exists: boolean; last_news_check?: string; last_news_article_id?: string; [key: string]: any }
    apns_config: { key_id_configured: boolean; team_id_configured: boolean; private_key_configured: boolean; production: boolean }
    cron_secret_configured: boolean
  }
  user_id: string
  checked_at: string
}

interface TestStep {
  step: string
  status: 'pass' | 'fail' | 'skip'
  detail: string
}

interface TestResult {
  success: boolean
  steps: TestStep[]
  notification_sent: boolean
  error?: string
}

interface NotificationLog {
  id: string
  category: string
  type: string
  title: string
  body: string
  time: string
  date: string
  created_at: string
}

const NOTIFICATION_TYPES = [
  { id: 'f1_news', label: 'F1 News', icon: '🏁' },
  { id: 'f1_session', label: 'F1 Session', icon: '🏎️' },
  { id: 'shopping', label: 'Shopping', icon: '🛒' },
  { id: 'bins', label: 'Bins', icon: '🗑️' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'routines', label: 'Routines', icon: '✨' },
  { id: 'chores', label: 'Chores', icon: '🧹' },
] as const

export default function NotificationDebugPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { isNative, isEnabled, permissionStatus, token, debugLog } = usePush()

  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testingType, setTestingType] = useState<string | null>(null)
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState<ReturnType<typeof getDebugLogs>>([])
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true)

  // Fetch notification status
  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setStatus(null)
        return
      }

      const response = await fetch('/api/notifications/status', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await response.json()
      if (response.ok && data.checks) {
        setStatus(data)
      } else {
        console.error('Status API error:', data)
        setStatus(null)
      }
    } catch (error) {
      console.error('Error fetching status:', error)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch notification logs
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/notifications/logs?limit=20', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchLogs()
  }, [fetchStatus, fetchLogs])

  // Auto-refresh console logs
  useEffect(() => {
    setConsoleLogs(getDebugLogs())

    if (!autoRefreshLogs) return

    const interval = setInterval(() => {
      setConsoleLogs(getDebugLogs())
    }, 1000)

    return () => clearInterval(interval)
  }, [autoRefreshLogs])

  // Send test notification
  const sendTestNotification = async (type: string) => {
    setTestingType(type)
    setTestResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type }),
      })
      const data = await response.json()

      if (response.ok && data.steps) {
        setTestResult(data)
        // Refresh logs after sending
        if (data.notification_sent) {
          setTimeout(fetchLogs, 1000)
        }
      } else {
        setTestResult({
          success: false,
          steps: [],
          notification_sent: false,
          error: data.error || `API returned ${response.status}`,
        })
      }
    } catch (error) {
      console.error('Error sending test:', error)
      setTestResult({
        success: false,
        steps: [],
        notification_sent: false,
        error: String(error),
      })
    } finally {
      setTestingType(null)
    }
  }

  // Reset F1 notification state
  const resetF1State = async () => {
    setResetting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      await fetch('/api/notifications/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'reset_f1_state' }),
      })

      // Refresh status
      await fetchStatus()
    } catch (error) {
      console.error('Error resetting F1 state:', error)
    } finally {
      setResetting(false)
    }
  }

  const StatusIcon = ({ status }: { status: 'pass' | 'fail' | 'warning' | 'skip' }) => {
    if (status === 'pass') return <CheckCircle className="w-5 h-5 text-green-500" />
    if (status === 'fail') return <XCircle className="w-5 h-5 text-red-500" />
    if (status === 'skip') return <AlertTriangle className="w-5 h-5 text-slate-400" />
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />
  }

  if (!user) {
    return (
      <div className="min-h-screen p-4">
        <Card>
          <p className="text-center text-slate-500">Please log in to view notification debugging.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/settings')}
          className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Notification Debugging
        </h1>
      </div>

      {/* Console Logs - Most Important for Debugging */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <CardHeader title="Console Logs" icon={<Terminal className="w-5 h-5" />} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={autoRefreshLogs}
                onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                className="rounded"
              />
              Auto
            </label>
            <button
              onClick={() => setConsoleLogs(getDebugLogs())}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                clearDebugLogs()
                setConsoleLogs([])
              }}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-red-500"
              title="Clear"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 max-h-80 overflow-auto font-mono text-xs">
          {consoleLogs.length === 0 ? (
            <p className="text-slate-500">No logs yet. Share content to the app to see logs here.</p>
          ) : (
            consoleLogs.slice().reverse().map((log, i) => (
              <div
                key={i}
                className={`py-0.5 ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-yellow-400' :
                  log.message.includes('[AutoProcess') ? 'text-green-400' :
                  'text-slate-300'
                }`}
              >
                <span className="text-slate-500">{log.timestamp}</span>{' '}
                <span>{log.message}</span>
                {log.data && (
                  <pre className="text-slate-400 ml-4 whitespace-pre-wrap break-all">{log.data}</pre>
                )}
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Logs auto-refresh every second. Green = AutoProcess logs. Look for [AutoProcess] entries after sharing.
        </p>
      </Card>

      {/* Client-Side Push Status */}
      <Card className="mb-4">
        <CardHeader title="Client Push Status" icon={<Smartphone className="w-5 h-5" />} />
        <div className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Platform</span>
            <span className="font-medium">{isNative ? 'iOS Native' : 'Web Browser'}</span>
          </div>
          {!isNative && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Web Push Available</span>
              <span className={`font-medium ${typeof window !== 'undefined' && 'PushManager' in window ? 'text-green-600' : 'text-red-600'}`}>
                {typeof window !== 'undefined' && 'PushManager' in window ? 'Yes' : 'No'}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Permission</span>
            <span className={`font-medium ${permissionStatus === 'granted' ? 'text-green-600' : permissionStatus === 'unsupported' ? 'text-slate-500' : 'text-red-600'}`}>
              {permissionStatus}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Token Loaded</span>
            <span className={`font-medium ${token ? 'text-green-600' : 'text-red-600'}`}>
              {token ? 'Yes' : 'No'}
            </span>
          </div>
          {token && (
            <div className="text-xs text-slate-500 font-mono break-all bg-slate-100 dark:bg-slate-800 p-2 rounded">
              {token.substring(0, 40)}...
            </div>
          )}
          {debugLog.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Debug Log:</p>
              <div className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded max-h-32 overflow-auto">
                {debugLog.map((log, i) => (
                  <div key={i} className="text-slate-600 dark:text-slate-400">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Server-Side Status */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Server Status" icon={<Server className="w-5 h-5" />} />
          <button
            onClick={fetchStatus}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : status?.checks ? (
          <div className="space-y-3">
            {status.checks.map((check, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <StatusIcon status={check.status} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
                    {check.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                    {check.detail}
                  </p>
                </div>
              </div>
            ))}

            {/* APNs Details */}
            {status.data.apns_config && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">APNs Configuration</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    {status.data.apns_config.key_id_configured ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                    <span>Key ID</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {status.data.apns_config.team_id_configured ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                    <span>Team ID</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {status.data.apns_config.private_key_configured ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                    <span>Private Key</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={status.data.apns_config.production ? 'text-green-600' : 'text-yellow-600'}>
                      {status.data.apns_config.production ? 'Production' : 'Sandbox'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-slate-500">Failed to load status</p>
        )}
      </Card>

      {/* F1 Notification State */}
      {status?.data?.f1_notification_state && (
        <Card className="mb-4">
          <CardHeader title="F1 Notification State" icon={<span className="text-lg">🏎️</span>} />
          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Last News Check</span>
              <span className="text-sm font-medium">
                {status.data.f1_notification_state.last_news_check
                  ? new Date(status.data.f1_notification_state.last_news_check).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            {status.data.f1_notification_state.last_news_article_id && (
              <div className="text-xs text-slate-500 font-mono break-all bg-slate-100 dark:bg-slate-800 p-2 rounded">
                Last Article: {status.data.f1_notification_state.last_news_article_id}
              </div>
            )}
            <Button
              onClick={resetF1State}
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={resetting}
            >
              {resetting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Reset F1 State
            </Button>
            <p className="text-xs text-slate-500">
              Resetting will allow the next cron trigger to send notifications for all current news articles.
            </p>
          </div>
        </Card>
      )}

      {/* Send Test Notifications */}
      <Card className="mb-4">
        <CardHeader title="Send Test Notification" icon={<Send className="w-5 h-5" />} />
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            {NOTIFICATION_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => sendTestNotification(type.id)}
                disabled={testingType !== null}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  testingType === type.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                  {testingType === type.id && (
                    <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex items-center gap-2 mb-3">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className={`font-semibold ${testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {testResult.notification_sent ? 'Notification Sent!' : 'Test Failed'}
                </span>
              </div>
              {testResult.steps && testResult.steps.length > 0 && (
                <div className="space-y-2">
                  {testResult.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <StatusIcon status={step.status} />
                      <div>
                        <span className="font-medium">{step.step.replace(/_/g, ' ')}:</span>{' '}
                        <span className="text-slate-600 dark:text-slate-400">{step.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {testResult.error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Error: {testResult.error}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Recent Notification Log */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Recent Notifications" icon={<Clock className="w-5 h-5" />} />
          <button
            onClick={fetchLogs}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
            disabled={logsLoading}
          >
            <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No notifications logged yet</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                      {log.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {log.body}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {log.time}
                    </p>
                    <p className="text-xs text-slate-400">
                      {log.date}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {log.category}
                  </span>
                  <span className="text-xs text-slate-400">
                    {log.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader title="Quick Actions" icon={<Zap className="w-5 h-5" />} />
        <div className="mt-4 space-y-2">
          <Button
            onClick={() => router.push('/settings')}
            variant="secondary"
            size="sm"
            className="w-full justify-start"
          >
            <Bell className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </div>
      </Card>
    </div>
  )
}
