'use client'

import { Star, Trophy, Gift } from 'lucide-react'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n-context'

export default function StarsWidget() {
  const { members } = useFamily()
  const { rewardsEnabled } = useSettings()
  const { t } = useTranslation()

  // If rewards disabled, show a placeholder
  if (!rewardsEnabled) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark text-center">
        <Gift className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm text-slate-400 dark:text-slate-500">{t('stars.rewardsDisabled')}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('stars.enableInSettings')}</p>
      </div>
    )
  }

  // Get kids with stars enabled, sorted by points
  const kids = members
    .filter(m => m.role === 'child' && m.stars_enabled)
    .sort((a, b) => b.points - a.points)

  return (
    <div className="h-full flex flex-col p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">{t('stars.title')}</h3>
      </div>

      <div className="flex-1 space-y-2">
        {kids.map((member, index) => (
          <div
            key={member.id}
            className={`flex items-center gap-3 p-2.5 rounded-xl ${
              index === 0
                ? 'bg-amber-100/50 dark:bg-amber-900/30'
                : 'bg-white/50 dark:bg-slate-700/50'
            }`}
          >
            <span className="text-sm font-medium text-slate-500 w-4">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
            </span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: member.color }}
            >
              {member.avatar || member.name.charAt(0)}
            </div>
            <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
              {member.name}
            </span>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {member.points}
              </span>
            </div>
          </div>
        ))}

        {kids.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('stars.noChildren')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
