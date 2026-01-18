'use client'

import { useState, useEffect, useCallback } from 'react'
import Card, { CardHeader } from '@/components/Card'
import { Bell, Trash2, Calendar, Clock, Sparkles, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { usePush } from '@/lib/push-context'

interface NotificationPrefs {
  // Master toggle
  master_enabled: boolean

  // Bins
  bins_enabled: boolean
  bin_reminder_evening: boolean
  bin_reminder_morning: boolean

  // Calendar
  calendar_enabled: boolean
  calendar_event_created: boolean
  calendar_event_changed: boolean
  calendar_event_deleted: boolean
  calendar_reminder_15m: boolean
  calendar_reminder_30m: boolean
  calendar_reminder_1h: boolean
  calendar_reminder_1d: boolean

  // Routines
  routines_enabled: boolean
  routine_start_reminder: boolean

  // Chores
  chores_enabled: boolean
  chores_reminder: boolean

  // F1 - Session Reminders
  f1_enabled: boolean
  f1_session_reminder_15m: boolean
  f1_session_reminder_1h: boolean
  f1_session_reminder_1d: boolean

  // F1 - Results
  f1_race_results: boolean
  f1_quali_results: boolean
  f1_sprint_results: boolean
  f1_championship_updates: boolean

  // F1 - News
  f1_news_enabled: boolean
  f1_news_race_category: boolean
  f1_news_driver_category: boolean
  f1_news_technical_category: boolean
  f1_news_calendar_category: boolean

  // F1 - Favorites
  f1_spoiler_free: boolean
  f1_favorite_driver: string | null
  f1_favorite_team: string | null
  f1_favorite_podium: boolean
  f1_favorite_win: boolean
  f1_favorite_pole: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  master_enabled: true,
  bins_enabled: true,
  bin_reminder_evening: true,
  bin_reminder_morning: false,
  calendar_enabled: true,
  calendar_event_created: true,
  calendar_event_changed: true,
  calendar_event_deleted: true,
  calendar_reminder_15m: true,
  calendar_reminder_30m: false,
  calendar_reminder_1h: true,
  calendar_reminder_1d: false,
  routines_enabled: true,
  routine_start_reminder: true,
  chores_enabled: true,
  chores_reminder: true,
  f1_enabled: false,
  f1_session_reminder_15m: true,
  f1_session_reminder_1h: true,
  f1_session_reminder_1d: false,
  f1_race_results: true,
  f1_quali_results: false,
  f1_sprint_results: false,
  f1_championship_updates: true,
  f1_news_enabled: true,
  f1_news_race_category: true,
  f1_news_driver_category: true,
  f1_news_technical_category: false,
  f1_news_calendar_category: true,
  f1_spoiler_free: false,
  f1_favorite_driver: null,
  f1_favorite_team: null,
  f1_favorite_podium: true,
  f1_favorite_win: true,
  f1_favorite_pole: true,
}

// F1 Teams for 2026 season (11 teams)
const F1_TEAMS = [
  { id: 'mclaren', name: 'McLaren', emoji: '🟠' },
  { id: 'ferrari', name: 'Ferrari', emoji: '🔴' },
  { id: 'red_bull', name: 'Red Bull Racing', emoji: '🔵' },
  { id: 'mercedes', name: 'Mercedes', emoji: '⚫' },
  { id: 'aston_martin', name: 'Aston Martin', emoji: '🟢' },
  { id: 'alpine', name: 'Alpine', emoji: '🩵' },
  { id: 'williams', name: 'Williams', emoji: '🔵' },
  { id: 'audi', name: 'Audi', emoji: '⚪' },
  { id: 'haas', name: 'Haas', emoji: '⚪' },
  { id: 'racing_bulls', name: 'Racing Bulls', emoji: '🔵' },
  { id: 'cadillac', name: 'Cadillac', emoji: '🖤' },
]

// F1 Drivers for 2026 season (22 drivers)
const F1_DRIVERS = [
  // McLaren
  { id: 'norris', name: 'Lando Norris', team: 'McLaren' },
  { id: 'piastri', name: 'Oscar Piastri', team: 'McLaren' },
  // Ferrari
  { id: 'leclerc', name: 'Charles Leclerc', team: 'Ferrari' },
  { id: 'hamilton', name: 'Lewis Hamilton', team: 'Ferrari' },
  // Red Bull
  { id: 'verstappen', name: 'Max Verstappen', team: 'Red Bull' },
  { id: 'hadjar', name: 'Isack Hadjar', team: 'Red Bull' },
  // Mercedes
  { id: 'russell', name: 'George Russell', team: 'Mercedes' },
  { id: 'antonelli', name: 'Kimi Antonelli', team: 'Mercedes' },
  // Aston Martin
  { id: 'alonso', name: 'Fernando Alonso', team: 'Aston Martin' },
  { id: 'stroll', name: 'Lance Stroll', team: 'Aston Martin' },
  // Alpine
  { id: 'gasly', name: 'Pierre Gasly', team: 'Alpine' },
  { id: 'colapinto', name: 'Franco Colapinto', team: 'Alpine' },
  // Williams
  { id: 'sainz', name: 'Carlos Sainz', team: 'Williams' },
  { id: 'albon', name: 'Alex Albon', team: 'Williams' },
  // Audi (formerly Sauber)
  { id: 'hulkenberg', name: 'Nico Hulkenberg', team: 'Audi' },
  { id: 'bortoleto', name: 'Gabriel Bortoleto', team: 'Audi' },
  // Haas
  { id: 'ocon', name: 'Esteban Ocon', team: 'Haas' },
  { id: 'bearman', name: 'Oliver Bearman', team: 'Haas' },
  // Racing Bulls
  { id: 'lawson', name: 'Liam Lawson', team: 'Racing Bulls' },
  { id: 'lindblad', name: 'Arvid Lindblad', team: 'Racing Bulls' },
  // Cadillac (new team)
  { id: 'perez', name: 'Sergio Perez', team: 'Cadillac' },
  { id: 'bottas', name: 'Valtteri Bottas', team: 'Cadillac' },
]

// Toggle component
function Toggle({ enabled, onChange, disabled = false }: {
  enabled: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative w-12 h-7 rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${
        enabled ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}

// Category section component
function CategorySection({
  title,
  icon,
  enabled,
  onToggle,
  children,
  description,
  masterEnabled = true,
}: {
  title: string
  icon: React.ReactNode
  enabled: boolean
  onToggle: (value: boolean) => void
  children: React.ReactNode
  description?: string
  masterEnabled?: boolean
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className={`border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden ${!masterEnabled ? 'opacity-50' : ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled && masterEnabled ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
            {icon}
          </div>
          <div className="text-left">
            <p className="font-medium text-slate-800 dark:text-slate-100">{title}</p>
            {description && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle enabled={enabled} onChange={onToggle} disabled={!masterEnabled} />
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      {expanded && enabled && masterEnabled && (
        <div className="p-4 space-y-4 border-t border-slate-200 dark:border-slate-700">
          {children}
        </div>
      )}
    </div>
  )
}

// Sub-toggle item
function ToggleItem({
  label,
  description,
  enabled,
  onChange,
  disabled = false,
}: {
  label: string
  description?: string
  enabled: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function NotificationPreferences() {
  const { user } = useAuth()
  const { isNative, permissionStatus } = usePush()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch preferences
  const fetchPrefs = useCallback(async () => {
    if (!user) {
      // Load from localStorage for demo
      const saved = localStorage.getItem('family-hub-notification-prefs')
      if (saved) {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) })
      }
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setPrefs({ ...DEFAULT_PREFS, ...data })
      } else if (error?.code === 'PGRST116') {
        // No preferences found - create default
        await supabase.from('notification_preferences').insert({
          user_id: user.id,
          ...DEFAULT_PREFS,
        })
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchPrefs()
  }, [fetchPrefs])

  // Update a preference
  const updatePref = async (key: keyof NotificationPrefs, value: any) => {
    const newPrefs = { ...prefs, [key]: value }
    setPrefs(newPrefs)

    if (!user) {
      localStorage.setItem('family-hub-notification-prefs', JSON.stringify(newPrefs))
      return
    }

    setSaving(true)
    try {
      // Send all current preferences to ensure nothing gets lost
      // Remove any fields that shouldn't be sent to the database
      const { ...dbPrefs } = newPrefs

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...dbPrefs,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) {
        console.error('Error saving notification preference:', error)
        // Revert the optimistic update on error
        setPrefs(prefs)
      }
    } catch (error) {
      console.error('Error saving notification preference:', error)
      // Revert the optimistic update on error
      setPrefs(prefs)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader title="Notification Preferences" icon={<Bell className="w-5 h-5" />} />
        <div className="mt-4 flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </Card>
    )
  }

  // Show warning if push not enabled
  if (isNative && permissionStatus !== 'granted') {
    return (
      <Card className="mb-6">
        <CardHeader title="Notification Preferences" icon={<Bell className="w-5 h-5" />} />
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Enable push notifications above to customize your notification preferences.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <CardHeader title="Notification Preferences" icon={<Bell className="w-5 h-5" />} />
        {saving && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
          </span>
        )}
      </div>

      {/* Master Toggle */}
      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">All Notifications</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Master switch for all notification types
            </p>
          </div>
          <Toggle
            enabled={prefs.master_enabled}
            onChange={(v) => updatePref('master_enabled', v)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Bins Section */}
        <CategorySection
          title="Bin Collection"
          icon={<Trash2 className="w-5 h-5" />}
          enabled={prefs.bins_enabled}
          onToggle={(v) => updatePref('bins_enabled', v)}
          description="Reminders for bin day"
          masterEnabled={prefs.master_enabled}
        >
          <ToggleItem
            label="Evening Reminder"
            description="Notification at 7pm the night before"
            enabled={prefs.bin_reminder_evening}
            onChange={(v) => updatePref('bin_reminder_evening', v)}
          />
          <ToggleItem
            label="Morning Reminder"
            description="Notification at 7am on collection day"
            enabled={prefs.bin_reminder_morning}
            onChange={(v) => updatePref('bin_reminder_morning', v)}
          />
        </CategorySection>

        {/* Calendar Section */}
        <CategorySection
          title="Calendar Events"
          icon={<Calendar className="w-5 h-5" />}
          enabled={prefs.calendar_enabled}
          onToggle={(v) => updatePref('calendar_enabled', v)}
          description="Event reminders and notifications"
          masterEnabled={prefs.master_enabled}
        >
          <ToggleItem
            label="New Event Added"
            description="Notify when events are created"
            enabled={prefs.calendar_event_created}
            onChange={(v) => updatePref('calendar_event_created', v)}
          />
          <ToggleItem
            label="Event Updated"
            description="Notify when events are changed"
            enabled={prefs.calendar_event_changed}
            onChange={(v) => updatePref('calendar_event_changed', v)}
          />
          <ToggleItem
            label="Event Cancelled"
            description="Notify when events are deleted"
            enabled={prefs.calendar_event_deleted}
            onChange={(v) => updatePref('calendar_event_deleted', v)}
          />
          <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">Reminder Times</p>
          </div>
          <ToggleItem
            label="15 Minutes Before"
            description="Quick heads-up before events"
            enabled={prefs.calendar_reminder_15m}
            onChange={(v) => updatePref('calendar_reminder_15m', v)}
          />
          <ToggleItem
            label="30 Minutes Before"
            description="Half hour reminder"
            enabled={prefs.calendar_reminder_30m}
            onChange={(v) => updatePref('calendar_reminder_30m', v)}
          />
          <ToggleItem
            label="1 Hour Before"
            description="Time to prepare"
            enabled={prefs.calendar_reminder_1h}
            onChange={(v) => updatePref('calendar_reminder_1h', v)}
          />
          <ToggleItem
            label="1 Day Before"
            description="Plan ahead reminder"
            enabled={prefs.calendar_reminder_1d}
            onChange={(v) => updatePref('calendar_reminder_1d', v)}
          />
        </CategorySection>

        {/* Routines Section */}
        <CategorySection
          title="Routines"
          icon={<Clock className="w-5 h-5" />}
          enabled={prefs.routines_enabled}
          onToggle={(v) => updatePref('routines_enabled', v)}
          description="Morning and bedtime routine reminders"
          masterEnabled={prefs.master_enabled}
        >
          <ToggleItem
            label="Routine Start Reminder"
            description="Notification when it's time to start a routine"
            enabled={prefs.routine_start_reminder}
            onChange={(v) => updatePref('routine_start_reminder', v)}
          />
        </CategorySection>

        {/* Chores Section */}
        <CategorySection
          title="Chores"
          icon={<Sparkles className="w-5 h-5" />}
          enabled={prefs.chores_enabled}
          onToggle={(v) => updatePref('chores_enabled', v)}
          description="Chore assignment notifications"
          masterEnabled={prefs.master_enabled}
        >
          <ToggleItem
            label="Chore Reminders"
            description="Notifications for assigned chores"
            enabled={prefs.chores_reminder}
            onChange={(v) => updatePref('chores_reminder', v)}
          />
        </CategorySection>

        {/* F1 Section */}
        <CategorySection
          title="Formula 1"
          icon={<span className="text-lg">🏎️</span>}
          enabled={prefs.f1_enabled}
          onToggle={(v) => updatePref('f1_enabled', v)}
          description="Race sessions, results, and news"
          masterEnabled={prefs.master_enabled}
        >
          {/* Session Reminders */}
          <div className="pb-4 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
              Session Reminders
            </p>
            <div className="space-y-2">
              <ToggleItem
                label="15 Minutes Before"
                description="Last chance reminder"
                enabled={prefs.f1_session_reminder_15m}
                onChange={(v) => updatePref('f1_session_reminder_15m', v)}
              />
              <ToggleItem
                label="1 Hour Before"
                description="Time to settle in"
                enabled={prefs.f1_session_reminder_1h}
                onChange={(v) => updatePref('f1_session_reminder_1h', v)}
              />
              <ToggleItem
                label="1 Day Before"
                description="Mark your calendar"
                enabled={prefs.f1_session_reminder_1d}
                onChange={(v) => updatePref('f1_session_reminder_1d', v)}
              />
            </div>
          </div>

          {/* Results Notifications */}
          <div className="py-4 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
              Results & Updates
            </p>
            <div className="space-y-2">
              <ToggleItem
                label="Race Results"
                description="Podium and final standings"
                enabled={prefs.f1_race_results}
                onChange={(v) => updatePref('f1_race_results', v)}
              />
              <ToggleItem
                label="Qualifying Results"
                description="Grid positions"
                enabled={prefs.f1_quali_results}
                onChange={(v) => updatePref('f1_quali_results', v)}
              />
              <ToggleItem
                label="Sprint Results"
                description="Sprint race updates"
                enabled={prefs.f1_sprint_results}
                onChange={(v) => updatePref('f1_sprint_results', v)}
              />
              <ToggleItem
                label="Championship Updates"
                description="Leader changes and title news"
                enabled={prefs.f1_championship_updates}
                onChange={(v) => updatePref('f1_championship_updates', v)}
              />
            </div>
          </div>

          {/* News Notifications */}
          <div className="py-4 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
              News Categories
            </p>
            <div className="space-y-2">
              <ToggleItem
                label="News Notifications"
                description="AI-filtered interesting F1 news"
                enabled={prefs.f1_news_enabled}
                onChange={(v) => updatePref('f1_news_enabled', v)}
              />
              {prefs.f1_news_enabled && (
                <div className="ml-4 space-y-2 pt-2">
                  <ToggleItem
                    label="Race News"
                    description="Grand Prix updates"
                    enabled={prefs.f1_news_race_category}
                    onChange={(v) => updatePref('f1_news_race_category', v)}
                  />
                  <ToggleItem
                    label="Driver News"
                    description="Driver transfers and news"
                    enabled={prefs.f1_news_driver_category}
                    onChange={(v) => updatePref('f1_news_driver_category', v)}
                  />
                  <ToggleItem
                    label="Technical News"
                    description="Car developments and regulations"
                    enabled={prefs.f1_news_technical_category}
                    onChange={(v) => updatePref('f1_news_technical_category', v)}
                  />
                  <ToggleItem
                    label="Calendar News"
                    description="Schedule changes and new races"
                    enabled={prefs.f1_news_calendar_category}
                    onChange={(v) => updatePref('f1_news_calendar_category', v)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Spoiler-Free Mode */}
          <div className="py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <ToggleItem
                label="Spoiler-Free Mode"
                description="Hide results until you've watched"
                enabled={prefs.f1_spoiler_free}
                onChange={(v) => updatePref('f1_spoiler_free', v)}
              />
            </div>
          </div>

          {/* Favorite Driver/Team */}
          <div className="pt-4">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
              Favorite Driver & Team
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Favorite Driver
                </label>
                <select
                  value={prefs.f1_favorite_driver || ''}
                  onChange={(e) => updatePref('f1_favorite_driver', e.target.value || null)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="">None selected</option>
                  {F1_DRIVERS.map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} ({driver.team})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Favorite Team
                </label>
                <select
                  value={prefs.f1_favorite_team || ''}
                  onChange={(e) => updatePref('f1_favorite_team', e.target.value || null)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="">None selected</option>
                  {F1_TEAMS.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.emoji} {team.name}
                    </option>
                  ))}
                </select>
              </div>

              {(prefs.f1_favorite_driver || prefs.f1_favorite_team) && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Special alerts for your favorites:
                  </p>
                  <ToggleItem
                    label="Podium Finish"
                    description="When your favorite finishes P1-P3"
                    enabled={prefs.f1_favorite_podium}
                    onChange={(v) => updatePref('f1_favorite_podium', v)}
                  />
                  <ToggleItem
                    label="Race Win"
                    description="When your favorite wins a race"
                    enabled={prefs.f1_favorite_win}
                    onChange={(v) => updatePref('f1_favorite_win', v)}
                  />
                  <ToggleItem
                    label="Pole Position"
                    description="When your favorite takes pole"
                    enabled={prefs.f1_favorite_pole}
                    onChange={(v) => updatePref('f1_favorite_pole', v)}
                  />
                </div>
              )}
            </div>
          </div>
        </CategorySection>
      </div>
    </Card>
  )
}
