'use client'

import { useState, useEffect, useCallback } from 'react'
import Card, { CardHeader } from '@/components/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import AlbumSelector from '@/components/AlbumSelector'
import { Settings, Users, Moon, Sun, Monitor, Clock, CloudSun, Plus, Edit2, Trash2, ChevronUp, ChevronDown, Image, Palette, Star, Sparkles, Calendar, Link, Unlink, RefreshCw, Loader2, CheckCircle, Cake, Camera, PartyPopper, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { useFamily } from '@/lib/family-context'
import { FamilyMember, MEMBER_COLORS, DEFAULT_SETTINGS, DASHBOARD_GRADIENTS, RELATIONSHIP_GROUPS, CountdownEvent, CountdownEventType, COUNTDOWN_EVENT_TYPES, DEFAULT_DANISH_EVENTS } from '@/lib/database.types'
import PhotoUpload, { AvatarDisplay } from '@/components/PhotoUpload'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { members, refreshMembers, reorderMembers } = useFamily()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [googleSyncing, setGoogleSyncing] = useState(false)
  const [googleLastSync, setGoogleLastSync] = useState<string | null>(null)

  // Google Photos state
  const [googlePhotosConnected, setGooglePhotosConnected] = useState(false)
  const [googlePhotosEmail, setGooglePhotosEmail] = useState<string | null>(null)

  // Countdown events state
  const [countdownEvents, setCountdownEvents] = useState<CountdownEvent[]>([])
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CountdownEvent | null>(null)
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    emoji: '🎉',
    event_type: 'holiday' as CountdownEventType,
    is_recurring: true,
    is_active: true
  })

  // Member form state
  const [memberForm, setMemberForm] = useState({
    name: '',
    color: MEMBER_COLORS[0].color,
    role: 'child' as 'parent' | 'child' | 'pet',
    avatar: '',
    photo_url: null as string | null,
    date_of_birth: ''
  })

  const fetchSettings = useCallback(async () => {
    if (!user) {
      // Load from localStorage for demo mode
      const saved = localStorage.getItem('family-hub-settings')
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
      }
      setLoading(false)
      return
    }

    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')

      if (data) {
        const loadedSettings: Record<string, any> = { ...DEFAULT_SETTINGS }
        data.forEach(s => {
          loadedSettings[s.key] = s.value
        })
        setSettings(loadedSettings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
    setLoading(false)
  }, [user])

  const fetchCountdownEvents = useCallback(async () => {
    if (!user) {
      // Demo mode - use local storage or defaults
      const saved = localStorage.getItem('family-hub-countdown-events')
      if (saved) {
        setCountdownEvents(JSON.parse(saved))
      } else {
        // Use default Danish events for demo
        const demoEvents = DEFAULT_DANISH_EVENTS.map((e, i) => ({
          ...e,
          id: `demo-${i}`,
          user_id: 'demo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })) as CountdownEvent[]
        setCountdownEvents(demoEvents)
      }
      return
    }

    try {
      const { data, error } = await supabase
        .from('countdown_events')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setCountdownEvents(data)
      } else {
        // Seed default events for new users
        await seedDefaultEvents()
      }
    } catch (error) {
      console.error('Error fetching countdown events:', error)
    }
  }, [user])

  const seedDefaultEvents = async () => {
    if (!user) return

    try {
      const eventsToInsert = DEFAULT_DANISH_EVENTS.map((e, i) => ({
        ...e,
        user_id: user.id,
        sort_order: i
      }))

      const { data, error } = await supabase
        .from('countdown_events')
        .insert(eventsToInsert)
        .select()

      if (error) throw error
      if (data) setCountdownEvents(data)
    } catch (error) {
      console.error('Error seeding default events:', error)
    }
  }

  useEffect(() => {
    fetchSettings()
    fetchCountdownEvents()
    checkGoogleConnection()
  }, [fetchSettings, fetchCountdownEvents])

  // Check Google Calendar connection status
  const checkGoogleConnection = async () => {
    if (!user) return

    try {
      const { data } = await supabase
        .from('user_integrations')
        .select('provider_email, updated_at')
        .eq('user_id', user.id)
        .eq('provider', 'google_calendar')
        .single()

      if (data) {
        setGoogleConnected(true)
        setGoogleEmail(data.provider_email)
        setGoogleLastSync(data.updated_at)
      }
    } catch (error) {
      // No connection found
    }

    // Check Google Photos connection
    try {
      const { data } = await supabase
        .from('user_integrations')
        .select('provider_email')
        .eq('user_id', user.id)
        .eq('provider', 'google_photos')
        .single()

      if (data) {
        setGooglePhotosConnected(true)
        setGooglePhotosEmail(data.provider_email)
      }
    } catch (error) {
      // No connection found
    }
  }

  // Connect Google Calendar
  const handleConnectGoogle = async () => {
    try {
      const response = await fetch('/api/google-calendar/auth?action=url')
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error connecting Google Calendar:', error)
    }
  }

  // Disconnect Google Calendar
  const handleDisconnectGoogle = async () => {
    if (!user || !confirm('Disconnect Google Calendar?')) return

    try {
      await fetch('/api/google-calendar/auth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })

      setGoogleConnected(false)
      setGoogleEmail(null)
      setGoogleLastSync(null)
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error)
    }
  }

  // Sync Google Calendar
  const handleSyncGoogle = async () => {
    if (!user) return

    setGoogleSyncing(true)
    try {
      const response = await fetch(`/api/google-calendar/sync?user_id=${user.id}`)
      const data = await response.json()

      if (data.success) {
        setGoogleLastSync(new Date().toISOString())
        alert(`Synced ${data.synced} events from Google Calendar`)
      }
    } catch (error) {
      console.error('Error syncing Google Calendar:', error)
    }
    setGoogleSyncing(false)
  }

  // Connect Google Photos
  const handleConnectGooglePhotos = async () => {
    if (!user) return
    try {
      const response = await fetch(`/api/google-photos/auth?action=url&user_id=${user.id}`)
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error connecting Google Photos:', error)
    }
  }

  // Disconnect Google Photos
  const handleDisconnectGooglePhotos = async () => {
    if (!user || !confirm('Disconnect Google Photos? This will remove access to your photo albums.')) return

    try {
      await fetch('/api/google-photos/auth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })

      setGooglePhotosConnected(false)
      setGooglePhotosEmail(null)
      // Clear album selection
      updateSetting('google_photos_album_id', null)
      updateSetting('google_photos_album_title', null)
    } catch (error) {
      console.error('Error disconnecting Google Photos:', error)
    }
  }

  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)

    if (!user) {
      localStorage.setItem('family-hub-settings', JSON.stringify(newSettings))
      return
    }

    try {
      await supabase
        .from('app_settings')
        .upsert({ key, value, user_id: user.id }, { onConflict: 'user_id,key' })
    } catch (error) {
      console.error('Error saving setting:', error)
    }
  }

  const handleAddMember = async () => {
    if (!memberForm.name.trim()) return

    if (!user) {
      // Demo mode - just show a message
      alert('Sign in to add family members')
      return
    }

    try {
      const { error } = await supabase
        .from('family_members')
        .insert({
          user_id: user.id,
          name: memberForm.name,
          color: memberForm.color,
          role: memberForm.role,
          avatar: memberForm.avatar || null,
          photo_url: memberForm.photo_url,
          date_of_birth: memberForm.date_of_birth || null,
          sort_order: members.length
        })

      if (error) throw error
      await refreshMembers()
      setShowMemberModal(false)
      resetMemberForm()
    } catch (error) {
      console.error('Error adding member:', error)
    }
  }

  const handleEditMember = async () => {
    if (!editingMember || !memberForm.name.trim()) return

    if (!user) {
      alert('Sign in to edit family members')
      return
    }

    try {
      const { error } = await supabase
        .from('family_members')
        .update({
          name: memberForm.name,
          color: memberForm.color,
          role: memberForm.role,
          avatar: memberForm.avatar || null,
          photo_url: memberForm.photo_url,
          date_of_birth: memberForm.date_of_birth || null
        })
        .eq('id', editingMember.id)

      if (error) throw error
      await refreshMembers()
      setShowMemberModal(false)
      setEditingMember(null)
      resetMemberForm()
    } catch (error) {
      console.error('Error updating member:', error)
    }
  }

  const handleDeleteMember = async (member: FamilyMember) => {
    if (!confirm(`Remove ${member.name} from the family?`)) return

    if (!user) {
      alert('Sign in to remove family members')
      return
    }

    try {
      await supabase.from('family_members').delete().eq('id', member.id)
      await refreshMembers()
    } catch (error) {
      console.error('Error deleting member:', error)
    }
  }

  const openEditMemberModal = (member: FamilyMember) => {
    setEditingMember(member)
    setMemberForm({
      name: member.name,
      color: member.color,
      role: member.role,
      avatar: member.avatar || '',
      photo_url: member.photo_url || null,
      date_of_birth: member.date_of_birth || ''
    })
    setShowMemberModal(true)
  }

  const resetMemberForm = () => {
    setMemberForm({
      name: '',
      color: MEMBER_COLORS[0].color,
      role: 'child',
      avatar: '',
      photo_url: null,
      date_of_birth: ''
    })
  }

  // Countdown event handlers
  const resetEventForm = () => {
    setEventForm({
      title: '',
      date: '',
      emoji: '🎉',
      event_type: 'holiday',
      is_recurring: true,
      is_active: true
    })
  }

  const handleAddEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date) return

    if (!user) {
      // Demo mode - save to local storage
      const newEvent: CountdownEvent = {
        id: `demo-${Date.now()}`,
        user_id: 'demo',
        title: eventForm.title,
        date: eventForm.date,
        emoji: eventForm.emoji,
        event_type: eventForm.event_type,
        is_recurring: eventForm.is_recurring,
        is_active: eventForm.is_active,
        sort_order: countdownEvents.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      const updated = [...countdownEvents, newEvent]
      setCountdownEvents(updated)
      localStorage.setItem('family-hub-countdown-events', JSON.stringify(updated))
      setShowEventModal(false)
      resetEventForm()
      return
    }

    try {
      const { error } = await supabase
        .from('countdown_events')
        .insert({
          user_id: user.id,
          title: eventForm.title,
          date: eventForm.date,
          emoji: eventForm.emoji,
          event_type: eventForm.event_type,
          is_recurring: eventForm.is_recurring,
          is_active: eventForm.is_active,
          sort_order: countdownEvents.length
        })

      if (error) throw error
      await fetchCountdownEvents()
      setShowEventModal(false)
      resetEventForm()
    } catch (error) {
      console.error('Error adding countdown event:', error)
    }
  }

  const handleEditEvent = async () => {
    if (!editingEvent || !eventForm.title.trim() || !eventForm.date) return

    if (!user) {
      const updated = countdownEvents.map(e =>
        e.id === editingEvent.id
          ? { ...e, ...eventForm, updated_at: new Date().toISOString() }
          : e
      )
      setCountdownEvents(updated)
      localStorage.setItem('family-hub-countdown-events', JSON.stringify(updated))
      setShowEventModal(false)
      setEditingEvent(null)
      resetEventForm()
      return
    }

    try {
      const { error } = await supabase
        .from('countdown_events')
        .update({
          title: eventForm.title,
          date: eventForm.date,
          emoji: eventForm.emoji,
          event_type: eventForm.event_type,
          is_recurring: eventForm.is_recurring,
          is_active: eventForm.is_active
        })
        .eq('id', editingEvent.id)

      if (error) throw error
      await fetchCountdownEvents()
      setShowEventModal(false)
      setEditingEvent(null)
      resetEventForm()
    } catch (error) {
      console.error('Error updating countdown event:', error)
    }
  }

  const handleDeleteEvent = async (event: CountdownEvent) => {
    if (!confirm(`Delete "${event.title}"?`)) return

    if (!user) {
      const updated = countdownEvents.filter(e => e.id !== event.id)
      setCountdownEvents(updated)
      localStorage.setItem('family-hub-countdown-events', JSON.stringify(updated))
      return
    }

    try {
      await supabase.from('countdown_events').delete().eq('id', event.id)
      await fetchCountdownEvents()
    } catch (error) {
      console.error('Error deleting countdown event:', error)
    }
  }

  const handleToggleEvent = async (event: CountdownEvent) => {
    const newActive = !event.is_active

    if (!user) {
      const updated = countdownEvents.map(e =>
        e.id === event.id ? { ...e, is_active: newActive } : e
      )
      setCountdownEvents(updated)
      localStorage.setItem('family-hub-countdown-events', JSON.stringify(updated))
      return
    }

    try {
      await supabase
        .from('countdown_events')
        .update({ is_active: newActive })
        .eq('id', event.id)
      await fetchCountdownEvents()
    } catch (error) {
      console.error('Error toggling countdown event:', error)
    }
  }

  const openEditEventModal = (event: CountdownEvent) => {
    setEditingEvent(event)
    setEventForm({
      title: event.title,
      date: event.date,
      emoji: event.emoji,
      event_type: event.event_type,
      is_recurring: event.is_recurring,
      is_active: event.is_active
    })
    setShowEventModal(true)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Customize your Family Hub</p>
      </div>

      {/* Appearance */}
      <Card className="mb-6">
        <CardHeader title="Appearance" icon={<Sun className="w-5 h-5" />} />
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Theme</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose your preferred color scheme</p>
            </div>
            <div className="flex gap-2">
              {[
                { id: 'light', icon: Sun, label: 'Light' },
                { id: 'dark', icon: Moon, label: 'Dark' },
                { id: 'system', icon: Monitor, label: 'System' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id as 'light' | 'dark' | 'system')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    theme === opt.id
                      ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Dashboard Background */}
      <Card className="mb-6">
        <CardHeader title="Dashboard Background" icon={<Palette className="w-5 h-5" />} />
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose a background style for your dashboard
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DASHBOARD_GRADIENTS.map(gradient => (
              <button
                key={gradient.id}
                onClick={() => updateSetting('dashboard_gradient', gradient.id)}
                className={`relative h-20 rounded-xl overflow-hidden transition-all ${
                  settings.dashboard_gradient === gradient.id
                    ? 'ring-2 ring-sage-500 ring-offset-2 dark:ring-offset-slate-900'
                    : 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600'
                }`}
              >
                <div className={`absolute inset-0 ${gradient.class || 'bg-gradient-to-br from-cream-50 to-cream-100 dark:from-slate-900 dark:to-slate-800'} ${gradient.class ? 'bg-gradient-to-br' : ''}`} />
                <span className="absolute bottom-1 left-0 right-0 text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                  {gradient.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Features */}
      <Card className="mb-6">
        <CardHeader title="Features" icon={<Sparkles className="w-5 h-5" />} />
        <div className="mt-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Rewards System</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Enable stars and points for completing chores</p>
            </div>
            <button
              onClick={() => updateSetting('rewards_enabled', !settings.rewards_enabled)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                settings.rewards_enabled ? 'bg-sage-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  settings.rewards_enabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Calendar AI Model</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">AI for smart calendar entry</p>
            </div>
            <div className="flex gap-2">
              {[
                { id: 'claude', label: 'Claude Sonnet 4.5' },
                { id: 'gemini', label: 'Gemini 3.0 Flash' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => updateSetting('ai_model', opt.id)}
                  className={`px-4 py-2 rounded-xl transition-all text-sm ${
                    settings.ai_model === opt.id
                      ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Calendar Integrations */}
      <Card className="mb-6">
        <CardHeader title="Calendar Integrations" icon={<Calendar className="w-5 h-5" />} />
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">Google Calendar</p>
                {googleConnected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">Connected: {googleEmail}</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sync your family calendar</p>
                )}
              </div>
            </div>
            {googleConnected ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncGoogle}
                  disabled={googleSyncing}
                >
                  {googleSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDisconnectGoogle}
                  className="text-red-600 hover:text-red-700"
                >
                  <Unlink className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleConnectGoogle} disabled={!user}>
                <Link className="w-4 h-4 mr-2" />
                Connect
              </Button>
            )}
          </div>
          {googleLastSync && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-right">
              Last synced: {new Date(googleLastSync).toLocaleString()}
            </p>
          )}
          {!user && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Sign in to connect Google Calendar
            </p>
          )}

          {/* Auto-push to Google */}
          {googleConnected && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">Auto-Push to Google</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Automatically sync new events to Google Calendar</p>
              </div>
              <button
                onClick={() => updateSetting('google_calendar_auto_push', !settings.google_calendar_auto_push)}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  settings.google_calendar_auto_push ? 'bg-sage-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    settings.google_calendar_auto_push ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Google Photos Integration */}
      <Card className="mb-6">
        <CardHeader title="Google Photos" icon={<ImageIcon className="w-5 h-5" />} />
        <div className="mt-4 space-y-4">
          {/* Connection status */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M12 7.5c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5m0-2c-3.87 0-7 3.13-7 7s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z"/>
                  <path fill="#FBBC05" d="M12 2v3"/>
                  <path fill="#34A853" d="M12 19v3"/>
                  <path fill="#EA4335" d="M5 12H2"/>
                  <path fill="#4285F4" d="M22 12h-3"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">Google Photos</p>
                {googlePhotosConnected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">Connected: {googlePhotosEmail}</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Display your family photos</p>
                )}
              </div>
            </div>
            {googlePhotosConnected ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDisconnectGooglePhotos}
                className="text-red-600 hover:text-red-700"
              >
                <Unlink className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={handleConnectGooglePhotos}
                disabled={!user}
                className="gap-2"
              >
                <Link className="w-4 h-4" />
                Connect
              </Button>
            )}
          </div>
          {!user && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Sign in to connect Google Photos
            </p>
          )}

          {/* Album Selection */}
          {googlePhotosConnected && (
            <>
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">Photo Album</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Select album for widget and gallery</p>
                </div>
                <AlbumSelector
                  selectedAlbumId={settings.google_photos_album_id as string | null}
                  selectedAlbumTitle={settings.google_photos_album_title as string | null}
                  onSelect={(albumId, albumTitle) => {
                    updateSetting('google_photos_album_id', albumId)
                    updateSetting('google_photos_album_title', albumTitle)
                  }}
                />
              </div>

              {/* Slideshow Speed */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">Slideshow Speed</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Seconds between photos in widget</p>
                </div>
                <select
                  value={settings.google_photos_rotation_interval as number}
                  onChange={(e) => updateSetting('google_photos_rotation_interval', parseInt(e.target.value))}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                </select>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Birthday Settings */}
      <Card className="mb-6">
        <CardHeader title="Birthday Settings" icon={<Cake className="w-5 h-5" />} />
        <div className="mt-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Show Birthdays on Calendar</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Display contact birthdays as calendar events</p>
            </div>
            <button
              onClick={() => updateSetting('show_birthdays_on_calendar', !settings.show_birthdays_on_calendar)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                settings.show_birthdays_on_calendar ? 'bg-sage-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  settings.show_birthdays_on_calendar ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          <div>
            <div className="mb-3">
              <p className="font-medium text-slate-800 dark:text-slate-100">Countdown Widget Groups</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Select which contact groups appear in the birthday countdown widget</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIP_GROUPS.map(group => {
                const isSelected = ((settings.countdown_relationship_groups as string[]) || []).includes(group.id)
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      const current = (settings.countdown_relationship_groups as string[]) || []
                      const updated = isSelected
                        ? current.filter(g => g !== group.id)
                        : [...current, group.id]
                      updateSetting('countdown_relationship_groups', updated)
                    }}
                    className={`px-3 py-2 rounded-xl transition-all text-sm flex items-center gap-2 ${
                      isSelected
                        ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300 ring-2 ring-sage-500/30'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    <span>{group.emoji}</span>
                    <span>{group.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Countdown Events */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Countdown Events" icon={<PartyPopper className="w-5 h-5" />} />
          <Button size="sm" onClick={() => { resetEventForm(); setEditingEvent(null); setShowEventModal(true) }}>
            <Plus className="w-4 h-4 mr-1" />
            Add Event
          </Button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Holidays and events that appear in the countdown widget. Family member birthdays are automatically included.
        </p>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {countdownEvents.map(event => (
            <div
              key={event.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                event.is_active
                  ? 'bg-slate-50 dark:bg-slate-800'
                  : 'bg-slate-100/50 dark:bg-slate-800/50 opacity-60'
              }`}
            >
              <span className="text-2xl">{event.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${event.is_active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                  {event.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{new Date(event.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  {event.is_recurring && <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded">Yearly</span>}
                  <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded capitalize">{event.event_type}</span>
                </div>
              </div>
              <button
                onClick={() => handleToggleEvent(event)}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  event.is_active ? 'bg-sage-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    event.is_active ? 'translate-x-4' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => openEditEventModal(event)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteEvent(event)}
                className="p-2 text-slate-400 hover:text-coral-500 hover:bg-coral-50 dark:hover:bg-coral-900/30 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {countdownEvents.length === 0 && (
            <p className="text-center text-slate-500 dark:text-slate-400 py-4">
              No countdown events yet. Add your first one!
            </p>
          )}
        </div>
      </Card>

      {/* Screensaver Settings */}
      <Card className="mb-6">
        <CardHeader title="Screensaver" icon={<Image className="w-5 h-5" />} />
        <div className="mt-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Enable Screensaver</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Show screensaver when idle</p>
            </div>
            <button
              onClick={() => updateSetting('screensaver_enabled', !settings.screensaver_enabled)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                settings.screensaver_enabled ? 'bg-sage-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  settings.screensaver_enabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Idle Timeout</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Start screensaver after inactivity</p>
            </div>
            <select
              value={settings.screensaver_timeout as number}
              onChange={(e) => updateSetting('screensaver_timeout', parseInt(e.target.value))}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={900}>15 minutes</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Screensaver Mode</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">What to display on the screensaver</p>
            </div>
            <select
              value={settings.screensaver_mode as string}
              onChange={(e) => updateSetting('screensaver_mode', e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              <option value="clock">Clock</option>
              <option value="photos">Photos</option>
              <option value="gradient">Gradient</option>
              <option value="blank">Blank (Sleep)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Sleep Schedule */}
      <Card className="mb-6">
        <CardHeader title="Sleep Schedule" icon={<Moon className="w-5 h-5" />} />
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automatically dim the display during these hours
          </p>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Start</label>
              <input
                type="time"
                value={settings.sleep_start as string}
                onChange={(e) => updateSetting('sleep_start', e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
            <span className="text-slate-400 mt-6">to</span>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">End</label>
              <input
                type="time"
                value={settings.sleep_end as string}
                onChange={(e) => updateSetting('sleep_end', e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Weather Settings */}
      <Card className="mb-6">
        <CardHeader title="Weather" icon={<CloudSun className="w-5 h-5" />} />
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={settings.weather_location as string}
              onChange={(e) => updateSetting('weather_location', e.target.value)}
              placeholder="City, Country"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-800 dark:text-slate-100">Temperature Unit</p>
            <div className="flex gap-2">
              {['celsius', 'fahrenheit'].map(unit => (
                <button
                  key={unit}
                  onClick={() => updateSetting('weather_unit', unit)}
                  className={`px-4 py-2 rounded-xl transition-all ${
                    settings.weather_unit === unit
                      ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {unit === 'celsius' ? '°C' : '°F'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Family Members */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Family Members" icon={<Users className="w-5 h-5" />} />
          <Button size="sm" onClick={() => { resetMemberForm(); setEditingMember(null); setShowMemberModal(true) }}>
            <Plus className="w-4 h-4 mr-1" />
            Add Member
          </Button>
        </div>
        <div className="space-y-3">
          {members.map((member, index) => (
            <div
              key={member.id}
              className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => reorderMembers(member.id, 'up')}
                  disabled={index === 0}
                  className={`p-1 rounded transition-colors ${
                    index === 0
                      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30'
                  }`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => reorderMembers(member.id, 'down')}
                  disabled={index === members.length - 1}
                  className={`p-1 rounded transition-colors ${
                    index === members.length - 1
                      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <AvatarDisplay
                photoUrl={member.photo_url}
                emoji={member.avatar}
                name={member.name}
                color={member.color}
                size="md"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-800 dark:text-slate-100">{member.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{member.role}</p>
              </div>
              {member.role === 'child' && (
                <div className="text-sm text-amber-600 dark:text-amber-400">
                  {member.points} stars
                </div>
              )}
              <button
                onClick={() => openEditMemberModal(member)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteMember(member)}
                className="p-2 text-slate-400 hover:text-coral-500 hover:bg-coral-50 dark:hover:bg-coral-900/30 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-center text-slate-500 dark:text-slate-400 py-4">
              No family members yet. Add your first member!
            </p>
          )}
        </div>
      </Card>

      {/* Account */}
      {user && (
        <Card>
          <CardHeader title="Account" icon={<Settings className="w-5 h-5" />} />
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{user.email}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Signed in</p>
              </div>
              <Button variant="secondary" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Add/Edit Member Modal */}
      <Modal
        isOpen={showMemberModal}
        onClose={() => { setShowMemberModal(false); setEditingMember(null); resetMemberForm() }}
        title={editingMember ? 'Edit Family Member' : 'Add Family Member'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={memberForm.name}
              onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
              placeholder="Enter name"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Role
            </label>
            <div className="flex gap-2">
              {(['parent', 'child', 'pet'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setMemberForm({ ...memberForm, role })}
                  className={`flex-1 px-4 py-2 rounded-xl capitalize transition-all ${
                    memberForm.role === role
                      ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Birthday
            </label>
            <input
              type="date"
              value={memberForm.date_of_birth}
              onChange={(e) => setMemberForm({ ...memberForm, date_of_birth: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {MEMBER_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setMemberForm({ ...memberForm, color: c.color })}
                  className={`w-10 h-10 rounded-full transition-all ${
                    memberForm.color === c.color ? 'ring-2 ring-sage-500 ring-offset-2 dark:ring-offset-slate-800' : ''
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Avatar
            </label>
            <div className="flex justify-center">
              <PhotoUpload
                photoUrl={memberForm.photo_url}
                emoji={memberForm.avatar}
                name={memberForm.name || 'New Member'}
                color={memberForm.color}
                onPhotoChange={(url) => setMemberForm(prev => ({ ...prev, photo_url: url, avatar: url ? '' : prev.avatar }))}
                onEmojiChange={(emoji) => setMemberForm(prev => ({ ...prev, avatar: emoji, photo_url: emoji ? null : prev.photo_url }))}
                bucket="avatars"
                size="lg"
              />
            </div>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
              Tap to upload a photo or choose an emoji
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="secondary" onClick={() => { setShowMemberModal(false); setEditingMember(null); resetMemberForm() }}>
              Cancel
            </Button>
            <Button onClick={editingMember ? handleEditMember : handleAddMember}>
              {editingMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Countdown Event Modal */}
      <Modal
        isOpen={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); resetEventForm() }}
        title={editingEvent ? 'Edit Event' : 'Add Event'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Event Name
            </label>
            <input
              type="text"
              value={eventForm.title}
              onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
              placeholder="e.g., Christmas, Summer Holiday"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={eventForm.date}
              onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Emoji
            </label>
            <div className="flex flex-wrap gap-2">
              {['🎉', '🎄', '🎂', '🎃', '💕', '🔥', '🇩🇰', '🎭', '💐', '🦆', '🕯️', '🎆', '❄️', '☀️', '🍂', '🍺', '✈️', '🎒', '📅', '🎁'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setEventForm({ ...eventForm, emoji })}
                  className={`w-10 h-10 text-xl rounded-xl transition-all ${
                    eventForm.emoji === emoji
                      ? 'bg-sage-100 ring-2 ring-sage-500 dark:bg-sage-900/50'
                      : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {COUNTDOWN_EVENT_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setEventForm({ ...eventForm, event_type: type.id })}
                  className={`px-3 py-2 rounded-xl transition-all text-sm flex items-center gap-2 ${
                    eventForm.event_type === type.id
                      ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <span>{type.emoji}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Repeats Yearly</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Event occurs on the same date each year</p>
            </div>
            <button
              onClick={() => setEventForm({ ...eventForm, is_recurring: !eventForm.is_recurring })}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                eventForm.is_recurring ? 'bg-sage-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  eventForm.is_recurring ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="secondary" onClick={() => { setShowEventModal(false); setEditingEvent(null); resetEventForm() }}>
              Cancel
            </Button>
            <Button onClick={editingEvent ? handleEditEvent : handleAddEvent}>
              {editingEvent ? 'Save Changes' : 'Add Event'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
