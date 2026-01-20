/**
 * Debug Logger
 *
 * Captures console logs for viewing in-app when USB debugging isn't available.
 * Logs are stored in memory and can be viewed at /debug page.
 */

interface LogEntry {
  timestamp: string
  level: 'log' | 'warn' | 'error'
  message: string
  data?: string
}

const MAX_LOGS = 200
const logs: LogEntry[] = []

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

function formatData(args: any[]): string | undefined {
  if (args.length === 0) return undefined
  try {
    return args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2)
      }
      return String(arg)
    }).join(' ')
  } catch {
    return '[Unable to serialize]'
  }
}

function addLog(level: LogEntry['level'], args: any[]) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
    level,
    message: String(args[0] || ''),
    data: args.length > 1 ? formatData(args.slice(1)) : undefined,
  }

  logs.push(entry)

  // Keep only last MAX_LOGS
  if (logs.length > MAX_LOGS) {
    logs.shift()
  }
}

/**
 * Initialize debug logger - intercepts console.log/warn/error
 * Call this once at app startup
 */
export function initDebugLogger() {
  // Only intercept if not already done
  if ((console.log as any).__debugWrapped) return

  console.log = (...args: any[]) => {
    addLog('log', args)
    originalConsole.log(...args)
  }
  ;(console.log as any).__debugWrapped = true

  console.warn = (...args: any[]) => {
    addLog('warn', args)
    originalConsole.warn(...args)
  }

  console.error = (...args: any[]) => {
    addLog('error', args)
    originalConsole.error(...args)
  }
}

/**
 * Get all captured logs
 */
export function getDebugLogs(): LogEntry[] {
  return [...logs]
}

/**
 * Clear all logs
 */
export function clearDebugLogs() {
  logs.length = 0
}

/**
 * Add a manual debug entry (useful for marking points in time)
 */
export function debugMark(message: string) {
  addLog('log', [`📍 MARK: ${message}`])
}
