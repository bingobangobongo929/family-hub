'use client'

import { useState, useEffect, useCallback } from 'react'
import Card, { CardHeader } from '@/components/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Settings, Users, Moon, Sun, Monitor, Clock, CloudSun, Plus, Edit2, Trash2, GripVertical, Image, Palette } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { useFamily } from '@/lib/family-context'
import { FamilyMember, MEMBER_COLORS, DEFAULT_SETTINGS, DASHBOARD_GRADIENTS } from '@/lib/database.types'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { members, refreshMembers } = useFamily()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)

  // Member form state
  const [memberForm, setMemberForm] = useState({
    name: '',
    color: MEMBER_COLORS[0].color,
    role: 'child' as 'parent' | 'child' | 'pet',
    avatar: ''
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

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

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
          name: memberForm.name,
          color: memberForm.color,
          role: memberForm.role,
          avatar: memberForm.avatar || null,
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
          avatar: memberForm.avatar || null
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
      avatar: member.avatar || ''
    })
    setShowMemberModal(true)
  }

  const resetMemberForm = () => {
    setMemberForm({
      name: '',
      color: MEMBER_COLORS[0].color,
      role: 'child',
      avatar: ''
    })
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
              <GripVertical className="w-5 h-5 text-slate-400 cursor-move" />
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: member.color }}
              >
                {member.avatar || member.name.charAt(0)}
              </div>
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
              Avatar (emoji, optional)
            </label>
            <input
              type="text"
              value={memberForm.avatar}
              onChange={(e) => setMemberForm({ ...memberForm, avatar: e.target.value })}
              placeholder="e.g. 👨 👩 🧒 🐕"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-center text-2xl"
            />
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
    </div>
  )
}
