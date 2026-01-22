'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import Card from '@/components/Card'

function CronLogsSection() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications/debug/logs')
      const data = await response.json()
      // Filter to only cron_execution logs
      const cronLogs = (data.logs || []).filter((l: any) =>
        l.category === 'cron_execution' || l.type?.includes('shopping')
      )
      setLogs(cronLogs.slice(0, 20))
    } catch (e) {
      console.error('Failed to fetch logs:', e)
    }
    setLoading(false)
  }

  const copyLogs = () => {
    const text = logs.map(l =>
      `[${l.created_at}] ${l.type}: ${l.title} - ${l.body || ''}`
    ).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold">Cron Job Logs</h2>
        <div className="flex gap-2">
          {logs.length > 0 && (
            <button
              onClick={copyLogs}
              className="px-2 py-1 bg-gray-500 text-white text-xs rounded"
            >
              {copied ? '✓' : '📋'}
            </button>
          )}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg disabled:opacity-50"
          >
            {loading ? '...' : 'Load Logs'}
          </button>
        </div>
      </div>
      {logs.length > 0 ? (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="font-mono text-gray-500">{l.created_at?.substring(11, 19)}</div>
              <div className="font-medium">{l.type}</div>
              <div className="text-gray-600 dark:text-gray-400">{l.title}</div>
              {l.body && <div className="text-gray-500">{l.body}</div>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Click "Load Logs" to see recent cron executions</p>
      )}
    </Card>
  )
}

export default function DebugNotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const [results, setResults] = useState<any[]>([])
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)

  const addResult = (step: string, status: 'pass' | 'fail' | 'info', detail: string) => {
    setResults(prev => [...prev, { step, status, detail, time: new Date().toISOString() }])
  }

  const runDiagnostics = async () => {
    setResults([])
    setTesting(true)

    // Step 1: Check auth context
    addResult('Auth Context', user ? 'pass' : 'fail',
      user ? `User ID: ${user.id.substring(0, 8)}...` : 'No user in auth context!')

    // Step 2: Check direct session
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        addResult('Direct Session', 'fail', `Error: ${error.message}`)
      } else if (session?.user) {
        addResult('Direct Session', 'pass', `User ID: ${session.user.id.substring(0, 8)}...`)
      } else {
        addResult('Direct Session', 'fail', 'No session found - YOU ARE NOT LOGGED IN!')
      }
    } catch (e: any) {
      addResult('Direct Session', 'fail', `Exception: ${e.message}`)
    }

    // Step 3: Check push tokens
    try {
      const response = await fetch('/api/notifications/debug/status')
      const data = await response.json()
      addResult('Push Token Check', data.push_tokens?.count > 0 ? 'pass' : 'fail',
        `Tokens: ${data.push_tokens?.count || 0}, Platforms: ${data.push_tokens?.platforms?.join(', ') || 'none'}`)
    } catch (e: any) {
      addResult('Push Token Check', 'fail', `Error: ${e.message}`)
    }

    // Step 4: Try to record a test shopping change
    const testUserId = user?.id
    if (testUserId) {
      try {
        const response = await fetch('/api/notifications/triggers/shopping-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: testUserId,
            item_name: 'DEBUG_TEST_ITEM_' + Date.now(),
            action: 'added'
          }),
        })
        const result = await response.json()
        addResult('Record Shopping Change', response.ok ? 'pass' : 'fail',
          response.ok ? `Recorded: ${JSON.stringify(result)}` : `Failed: ${JSON.stringify(result)}`)
      } catch (e: any) {
        addResult('Record Shopping Change', 'fail', `Exception: ${e.message}`)
      }
    } else {
      addResult('Record Shopping Change', 'fail', 'SKIPPED - No user ID available!')
    }

    // Step 5: Check shopping_list_changes table
    try {
      const response = await fetch('/api/notifications/debug/test-shopping')
      const data = await response.json()
      const recentChanges = data.steps?.find((s: any) => s.step?.includes('recent'))
      addResult('Shopping Changes Table', 'info',
        `Recent changes: ${recentChanges?.count || 0}`)
    } catch (e: any) {
      addResult('Shopping Changes Table', 'fail', `Error: ${e.message}`)
    }

    // Step 6: Send test notification
    try {
      const response = await fetch('/api/notifications/debug/cron-test')
      const data = await response.json()
      addResult('Send Test Notification', data.success ? 'pass' : 'fail',
        data.success ? 'Notification sent! Check your device!' : `Failed: ${JSON.stringify(data)}`)
    } catch (e: any) {
      addResult('Send Test Notification', 'fail', `Exception: ${e.message}`)
    }

    setTesting(false)
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Notification Diagnostics</h1>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Quick Status</h2>
        <div className="space-y-1 text-sm">
          <p>Auth Loading: {authLoading ? 'Yes' : 'No'}</p>
          <p>User from Context: {user ? `${user.id.substring(0, 8)}...` : 'NULL ❌'}</p>
          <p>User Email: {user?.email || 'N/A'}</p>
        </div>
      </Card>

      <button
        onClick={runDiagnostics}
        disabled={testing}
        className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-semibold disabled:opacity-50"
      >
        {testing ? 'Running Tests...' : 'Run Full Diagnostics'}
      </button>

      {results.length > 0 && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold">Test Results</h2>
            <button
              onClick={() => {
                const text = results.map(r =>
                  `${r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : 'ℹ️'} ${r.step}: ${r.detail}`
                ).join('\n')
                const fullReport = `=== NOTIFICATION DEBUG REPORT ===
Time: ${new Date().toISOString()}
Auth Loading: ${authLoading}
User ID: ${user?.id || 'NULL'}
User Email: ${user?.email || 'NULL'}

=== TEST RESULTS ===
${text}
`
                navigator.clipboard.writeText(fullReport)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg"
            >
              {copied ? '✓ Copied!' : '📋 Copy All'}
            </button>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`p-2 rounded text-sm ${
                r.status === 'pass' ? 'bg-green-100 dark:bg-green-900' :
                r.status === 'fail' ? 'bg-red-100 dark:bg-red-900' :
                'bg-gray-100 dark:bg-gray-800'
              }`}>
                <div className="font-medium">
                  {r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : 'ℹ️'} {r.step}
                </div>
                <div className="text-xs opacity-75 break-all">{r.detail}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CronLogsSection />

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Manual Test Links</h2>
        <div className="space-y-2 text-sm">
          <a href="/api/notifications/debug/status" target="_blank" className="block text-blue-500 underline">
            → View Full System Status
          </a>
          <a href="/api/notifications/debug/test-shopping?test=true" target="_blank" className="block text-blue-500 underline">
            → Force Send Shopping Test Notification
          </a>
          <a href="/api/notifications/debug/cron-test" target="_blank" className="block text-blue-500 underline">
            → Send Generic Test Notification
          </a>
          <a href="/api/notifications/debug/logs" target="_blank" className="block text-blue-500 underline">
            → View Notification Logs
          </a>
        </div>
      </Card>
    </div>
  )
}
