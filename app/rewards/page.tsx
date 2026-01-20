'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Card, { CardHeader } from '@/components/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Trophy, Star, Gift, Plus, Edit2, Trash2, Sparkles, Crown, Medal, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'
import { Reward, RewardRedemption } from '@/lib/database.types'
import Link from 'next/link'

// Demo rewards
const DEMO_REWARDS: Reward[] = [
  { id: 'demo-1', user_id: 'demo', title: 'Extra Screen Time', emoji: '📺', description: '30 minutes extra TV or tablet', point_cost: 20, is_active: true, created_at: '', updated_at: '' },
  { id: 'demo-2', user_id: 'demo', title: 'Ice Cream Trip', emoji: '🍦', description: 'Family trip to get ice cream', point_cost: 50, is_active: true, created_at: '', updated_at: '' },
  { id: 'demo-3', user_id: 'demo', title: 'Movie Night Pick', emoji: '🎬', description: 'Choose the family movie', point_cost: 30, is_active: true, created_at: '', updated_at: '' },
  { id: 'demo-4', user_id: 'demo', title: 'Stay Up Late', emoji: '🌙', description: '30 minutes past bedtime', point_cost: 25, is_active: true, created_at: '', updated_at: '' },
  { id: 'demo-5', user_id: 'demo', title: 'New Toy', emoji: '🎁', description: 'Small toy or book under £10', point_cost: 100, is_active: true, created_at: '', updated_at: '' },
  { id: 'demo-6', user_id: 'demo', title: 'Day Out Choice', emoji: '🎢', description: 'Pick where we go for family day out', point_cost: 150, is_active: true, created_at: '', updated_at: '' },
]

export default function RewardsPage() {
  const { user } = useAuth()
  const { members, updateMemberPoints, getMember } = useFamily()
  const { rewardsEnabled } = useSettings()
  const { t } = useTranslation()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    emoji: '🎁',
    description: '',
    point_cost: 10
  })

  const fetchRewards = useCallback(async () => {
    if (!user) {
      setRewards(DEMO_REWARDS)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('is_active', true)
        .order('point_cost', { ascending: true })

      if (error) throw error
      setRewards(data || [])
    } catch (error) {
      console.error('Error fetching rewards:', error)
      setRewards(DEMO_REWARDS)
    }
    setLoading(false)
  }, [user])

  const fetchRedemptions = useCallback(async () => {
    if (!user) {
      // Demo redemptions
      setRedemptions([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('reward_redemptions')
        .select('*, reward:rewards(*), member:family_members(*)')
        .order('redeemed_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setRedemptions(data || [])
    } catch (error) {
      console.error('Error fetching redemptions:', error)
    }
  }, [user])

  useEffect(() => {
    fetchRewards()
    fetchRedemptions()
  }, [fetchRewards, fetchRedemptions])

  const handleAddReward = async () => {
    if (!formData.title || formData.point_cost < 1) return

    if (!user) {
      const newReward: Reward = {
        id: 'demo-' + Date.now(),
        user_id: 'demo',
        title: formData.title,
        emoji: formData.emoji,
        description: formData.description || null,
        point_cost: formData.point_cost,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setRewards([...rewards, newReward].sort((a, b) => a.point_cost - b.point_cost))
      setShowAddModal(false)
      resetForm()
      return
    }

    try {
      const { error } = await supabase
        .from('rewards')
        .insert({
          title: formData.title,
          emoji: formData.emoji,
          description: formData.description || null,
          point_cost: formData.point_cost
        })

      if (error) throw error
      await fetchRewards()
      setShowAddModal(false)
      resetForm()
    } catch (error) {
      console.error('Error adding reward:', error)
    }
  }

  const handleEditReward = async () => {
    if (!editingReward || !formData.title) return

    if (!user) {
      setRewards(rewards.map(r =>
        r.id === editingReward.id
          ? { ...r, ...formData }
          : r
      ).sort((a, b) => a.point_cost - b.point_cost))
      setEditingReward(null)
      setShowAddModal(false)
      resetForm()
      return
    }

    try {
      const { error } = await supabase
        .from('rewards')
        .update({
          title: formData.title,
          emoji: formData.emoji,
          description: formData.description || null,
          point_cost: formData.point_cost
        })
        .eq('id', editingReward.id)

      if (error) throw error
      await fetchRewards()
      setEditingReward(null)
      setShowAddModal(false)
      resetForm()
    } catch (error) {
      console.error('Error updating reward:', error)
    }
  }

  const handleDeleteReward = async (reward: Reward) => {
    if (!confirm('Delete this reward?')) return

    if (!user) {
      setRewards(rewards.filter(r => r.id !== reward.id))
      return
    }

    try {
      await supabase.from('rewards').update({ is_active: false }).eq('id', reward.id)
      await fetchRewards()
    } catch (error) {
      console.error('Error deleting reward:', error)
    }
  }

  const handleRedeem = async () => {
    if (!selectedReward || !selectedMember) return

    const member = getMember(selectedMember)
    if (!member || member.points < selectedReward.point_cost) return

    // Deduct points
    await updateMemberPoints(selectedMember, -selectedReward.point_cost)

    if (user) {
      try {
        await supabase
          .from('reward_redemptions')
          .insert({
            reward_id: selectedReward.id,
            member_id: selectedMember,
            points_spent: selectedReward.point_cost
          })
        await fetchRedemptions()
      } catch (error) {
        console.error('Error recording redemption:', error)
      }
    }

    setShowRedeemModal(false)
    setSelectedReward(null)
    setSelectedMember(null)
  }

  const openRedeemModal = (reward: Reward) => {
    setSelectedReward(reward)
    // Pre-select the first child with enough points
    const eligibleChild = members.find(m => m.role === 'child' && m.points >= reward.point_cost)
    setSelectedMember(eligibleChild?.id || null)
    setShowRedeemModal(true)
  }

  const openEditModal = (reward: Reward) => {
    setEditingReward(reward)
    setFormData({
      title: reward.title,
      emoji: reward.emoji,
      description: reward.description || '',
      point_cost: reward.point_cost
    })
    setShowAddModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      emoji: '🎁',
      description: '',
      point_cost: 10
    })
  }

  // Get kids sorted by points
  const kidsLeaderboard = members
    .filter(m => m.role === 'child')
    .sort((a, b) => b.points - a.points)

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Crown className="w-6 h-6 text-amber-500" />
      case 1: return <Medal className="w-6 h-6 text-slate-400" />
      case 2: return <Medal className="w-6 h-6 text-amber-700" />
      default: return <Star className="w-5 h-5 text-slate-300" />
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        </div>
      </div>
    )
  }

  // Show disabled message when rewards are off
  if (!rewardsEnabled) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
            <Gift className="w-10 h-10 text-slate-400 dark:text-slate-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            {t('rewards.systemDisabled')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
            {t('rewards.systemDisabledHint')}
          </p>
          <Link href="/settings">
            <Button>
              <Settings className="w-5 h-5 mr-2" />
              {t('rewards.goToSettings')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-select-interactive">
        <div>
          <h1 className="page-header">{t('rewards.title')}</h1>
          <p className="page-subtitle">{t('rewards.subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingReward(null); setShowAddModal(true) }} className="w-full sm:w-auto">
          <Plus className="w-5 h-5 mr-2" />
          {t('rewards.addReward')}
        </Button>
      </div>

      {/* Points Leaderboard */}
      <Card className="mb-8">
        <CardHeader title={t('rewards.starLeaderboard')} icon={<Trophy className="w-5 h-5 text-amber-500" />} />
        <div className="mt-4 space-y-3">
          {kidsLeaderboard.map((member, index) => (
            <div
              key={member.id}
              className={`flex items-center gap-4 p-4 rounded-xl ${
                index === 0
                  ? 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border-2 border-amber-200 dark:border-amber-700'
                  : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="w-10 flex items-center justify-center">
                {getRankIcon(index)}
              </div>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: member.color }}
              >
                {member.avatar || member.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg text-slate-800 dark:text-slate-100">{member.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{member.points}</span>
              </div>
            </div>
          ))}
          {kidsLeaderboard.length === 0 && (
            <p className="text-center text-slate-500 dark:text-slate-400 py-4">
              {t('rewards.noChildren')}
            </p>
          )}
        </div>
      </Card>

      {/* Prize Vault */}
      <Card className="mb-8">
        <CardHeader title={t('rewards.prizeVault')} icon={<Gift className="w-5 h-5 text-sage-500" />} />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map(reward => {
            // Find kid with most points
            const topKid = kidsLeaderboard[0]
            const canAfford = topKid && topKid.points >= reward.point_cost

            return (
              <div
                key={reward.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  canAfford
                    ? 'bg-white dark:bg-slate-800 border-sage-200 dark:border-sage-700 hover:border-sage-400 dark:hover:border-sage-500'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-4xl">{reward.emoji}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(reward)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteReward(reward)}
                      className="p-1 text-slate-400 hover:text-coral-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{reward.title}</h3>
                {reward.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{reward.description}</p>
                )}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-amber-600 dark:text-amber-400">{reward.point_cost}</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={!canAfford}
                    onClick={() => openRedeemModal(reward)}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    {t('rewards.redeem')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        {rewards.length === 0 && (
          <div className="text-center py-8">
            <Gift className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">{t('rewards.noRewards')}</p>
          </div>
        )}
      </Card>

      {/* Recent Redemptions */}
      {redemptions.length > 0 && (
        <Card>
          <CardHeader title={t('rewards.recentRedemptions')} />
          <div className="mt-4 space-y-3">
            {redemptions.slice(0, 5).map(redemption => (
              <div key={redemption.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-2xl">{redemption.reward?.emoji}</span>
                <div className="flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{redemption.reward?.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('rewards.redeemedBy')} {redemption.member?.name} • {new Date(redemption.redeemed_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                  <Star className="w-4 h-4 fill-current" />
                  -{redemption.points_spent}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add/Edit Reward Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingReward(null); resetForm() }}
        title={editingReward ? t('rewards.editReward') : t('rewards.newReward')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('rewards.rewardName')}
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ice Cream Trip"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('common.emoji')}
              </label>
              <input
                type="text"
                value={formData.emoji}
                onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent text-center text-2xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('rewards.descriptionOptional')}
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('rewards.descriptionPlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('rewards.pointCost')}
            </label>
            <div className="flex items-center gap-3">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              <input
                type="number"
                value={formData.point_cost}
                onChange={(e) => setFormData({ ...formData, point_cost: parseInt(e.target.value) || 1 })}
                min="1"
                className="w-24 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent text-center font-bold text-lg"
              />
              <span className="text-slate-500 dark:text-slate-400">{t('rewards.stars')}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingReward(null); resetForm() }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={editingReward ? handleEditReward : handleAddReward}>
              {editingReward ? t('common.saveChanges') : t('rewards.addReward')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Redeem Modal */}
      <Modal
        isOpen={showRedeemModal}
        onClose={() => { setShowRedeemModal(false); setSelectedReward(null); setSelectedMember(null) }}
        title={t('rewards.redeemReward')}
      >
        {selectedReward && (
          <div className="space-y-6">
            <div className="text-center p-6 bg-gradient-to-br from-sage-50 to-green-50 dark:from-sage-900/30 dark:to-green-900/30 rounded-xl">
              <span className="text-5xl block mb-3">{selectedReward.emoji}</span>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedReward.title}</h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span className="font-bold text-amber-600 dark:text-amber-400">{selectedReward.point_cost} {t('rewards.stars')}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                {t('rewards.whoIsRedeeming')}
              </label>
              <div className="space-y-2">
                {kidsLeaderboard.map(member => {
                  const canAfford = member.points >= selectedReward.point_cost
                  return (
                    <button
                      key={member.id}
                      onClick={() => canAfford && setSelectedMember(member.id)}
                      disabled={!canAfford}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        selectedMember === member.id
                          ? 'border-sage-400 dark:border-sage-500 bg-sage-50 dark:bg-sage-900/30'
                          : canAfford
                          ? 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          : 'border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{member.name}</p>
                        {!canAfford && (
                          <p className="text-sm text-coral-500">{t('rewards.needsMoreStars', { count: selectedReward.point_cost - member.points })}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                        <span className="font-bold text-amber-600 dark:text-amber-400">{member.points}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" onClick={() => { setShowRedeemModal(false); setSelectedReward(null); setSelectedMember(null) }}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleRedeem}
                disabled={!selectedMember}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {t('rewards.confirmRedemption')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
