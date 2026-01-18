'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { CheckSquare, Plus, Star, Trash2, RotateCcw } from 'lucide-react'
import Card, { CardHeader } from '@/components/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { Chore, CHORE_CATEGORIES, getChoreCategoryConfig } from '@/lib/database.types'
import { useTranslation } from '@/lib/i18n-context'
import { hapticSuccess, hapticLight } from '@/lib/haptics'

export default function TasksPage() {
  const { user } = useAuth()
  const { members, getMember, updateMemberPoints } = useFamily()
  const { t } = useTranslation()
  const [chores, setChores] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [showAddModal, setShowAddModal] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    emoji: '✨',
    description: '',
    assigned_to: '',
    points: 1,
    due_date: '',
    category: 'general',
    repeat_frequency: 'none' as const,
  })

  const fetchChores = useCallback(async () => {
    if (!user) {
      setChores([])
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('chores')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setChores((data as Chore[]) || [])
    } catch (error) {
      console.error('Error fetching chores:', error)
      setChores([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchChores()
  }, [fetchChores])

  const handleToggleChore = async (chore: Chore) => {
    if (!user) return

    const newStatus = chore.status === 'completed' ? 'pending' : 'completed'
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null
    const pointsChange = newStatus === 'completed' ? chore.points : -chore.points

    // Haptic feedback
    if (newStatus === 'completed') {
      hapticSuccess()
    } else {
      hapticLight()
    }

    try {
      const { error } = await supabase
        .from('chores')
        .update({
          status: newStatus,
          completed_at: completedAt,
          completed_by: newStatus === 'completed' ? chore.assigned_to : null,
        })
        .eq('id', chore.id)

      if (error) throw error

      // Update member points
      if (chore.assigned_to && chore.points > 0) {
        await updateMemberPoints(chore.assigned_to, pointsChange)
      }

      await fetchChores()
    } catch (error) {
      console.error('Error updating chore:', error)
    }
  }

  const handleAddChore = () => {
    setFormData({
      title: '',
      emoji: '✨',
      description: '',
      assigned_to: '',
      points: 1,
      due_date: format(new Date(), 'yyyy-MM-dd'),
      category: 'general',
      repeat_frequency: 'none',
    })
    setShowAddModal(true)
  }

  const handleSaveChore = async () => {
    if (!user || !formData.title.trim()) return

    const choreData = {
      title: formData.title,
      emoji: formData.emoji,
      description: formData.description || null,
      assigned_to: formData.assigned_to || null,
      points: formData.points,
      due_date: formData.due_date || null,
      category: formData.category,
      repeat_frequency: formData.repeat_frequency,
      status: 'pending' as const,
      repeat_interval: 1,
      sort_order: chores.length,
    }

    try {
      const { error } = await supabase
        .from('chores')
        .insert(choreData)

      if (error) throw error
      await fetchChores()
      setShowAddModal(false)
    } catch (error) {
      console.error('Error saving chore:', error)
    }
  }

  const handleDeleteChore = async (choreId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('chores')
        .delete()
        .eq('id', choreId)

      if (error) throw error
      await fetchChores()
    } catch (error) {
      console.error('Error deleting chore:', error)
    }
  }

  const childMembers = members.filter(m => m.role === 'child')
  const filteredChores = filter === 'all'
    ? chores
    : chores.filter(c => c.assigned_to === filter)

  const completedCount = chores.filter(c => c.status === 'completed').length
  const totalCount = chores.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Calculate total stars earned today
  const totalStarsToday = chores
    .filter(c => c.status === 'completed')
    .reduce((sum, c) => sum + c.points, 0)

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-header">{t('chores.title')}</h1>
          <p className="page-subtitle">{t('tasks.subtitle')}</p>
        </div>
        <Button onClick={handleAddChore} className="gap-2 w-full sm:w-auto">
          <Plus className="w-5 h-5" />
          {t('tasks.addChore')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-sage-500 to-sage-600 text-white">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sage-100 text-sm">{t('tasks.completed')}</p>
              <p className="text-2xl font-bold">{completedCount}/{totalCount}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-amber-400 to-orange-500 text-white">
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-amber-100 text-sm">{t('tasks.starsToday')}</p>
              <p className="text-2xl font-bold">{totalStarsToday}</p>
            </div>
          </div>
        </Card>
        <Card className="hidden sm:block">
          <div className="text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('tasks.progress')}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{progressPercent}%</p>
          </div>
        </Card>
      </div>

      {/* Filter by family member */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
            filter === 'all'
              ? 'bg-sage-500 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          {t('common.all')}
        </button>
        {members.map(member => (
          <button
            key={member.id}
            onClick={() => setFilter(member.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-[44px] flex items-center gap-2 ${
              filter === member.id
                ? 'bg-sage-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
              style={{ backgroundColor: member.color }}
            >
              {member.name[0]}
            </div>
            {member.name}
          </button>
        ))}
      </div>

      {/* Chore List */}
      <Card hover={false}>
        <CardHeader
          title={t('tasks.todaysChores')}
          icon={<CheckSquare className="w-5 h-5" />}
        />
        {loading ? (
          <p className="text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
        ) : filteredChores.length === 0 ? (
          <div className="text-center py-8">
            <CheckSquare className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">{t('tasks.noChores')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChores.map(chore => {
              const assignee = getMember(chore.assigned_to)
              const categoryConfig = getChoreCategoryConfig(chore.category)
              const isCompleted = chore.status === 'completed'

              return (
                <div
                  key={chore.id}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    isCompleted
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <button
                    onClick={() => handleToggleChore(chore)}
                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl transition-all flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-sage-500 hover:bg-sage-50 dark:hover:bg-sage-900/20'
                    }`}
                  >
                    {isCompleted ? '✓' : chore.emoji}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${isCompleted ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                      {chore.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${categoryConfig.color}`}>
                        {categoryConfig.label}
                      </span>
                      {chore.points > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 flex items-center gap-1">
                          <Star className="w-3 h-3" /> {chore.points}
                        </span>
                      )}
                    </div>
                  </div>

                  {assignee && (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                      style={{ backgroundColor: assignee.color }}
                      title={assignee.name}
                    >
                      {assignee.name[0]}
                    </div>
                  )}

                  <button
                    onClick={() => handleDeleteChore(chore.id)}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 tap-highlight"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Add Chore Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t('tasks.addChore')} size="md">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('tasks.icon')}
              </label>
              <select
                value={formData.emoji}
                onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                className="w-16 h-12 text-2xl text-center rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                {CHORE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.emoji}>{c.emoji}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('tasks.choreTitle')} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                placeholder={t('tasks.choreTitlePlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('tasks.assignTo')}
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              >
                <option value="">{t('tasks.unassigned')}</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('stars.title')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  className="w-20 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
                <Star className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.category')}
            </label>
            <div className="flex flex-wrap gap-2">
              {CHORE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.id, emoji: cat.emoji })}
                  className={`px-3 py-2 rounded-xl text-sm transition-all ${
                    formData.category === cat.id
                      ? 'ring-2 ring-sage-500 ' + cat.color
                      : cat.color + ' opacity-70 hover:opacity-100'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.repeat')}
            </label>
            <select
              value={formData.repeat_frequency}
              onChange={(e) => setFormData({ ...formData, repeat_frequency: e.target.value as typeof formData.repeat_frequency })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              <option value="none">{t('tasks.oneTime')}</option>
              <option value="daily">{t('tasks.daily')}</option>
              <option value="weekly">{t('tasks.weekly')}</option>
              <option value="monthly">{t('tasks.monthly')}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveChore} disabled={!formData.title.trim()}>
              {t('tasks.saveChore')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
