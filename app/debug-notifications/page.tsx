'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import Card from '@/components/Card'

export default function DebugNotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const [results, setResults] = useState<any[]>([])
  const [testing, setTesting] = useState(false)

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
          <h2 className="font-semibold mb-2">Test Results</h2>
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
