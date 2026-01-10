'use client'

import { Star, Trophy } from 'lucide-react'
import { useFamily } from '@/lib/family-context'

export default function StarsWidget() {
  const { members } = useFamily()

  // Get kids sorted by points
  const kids = members
    .filter(m => m.role === 'child')
    .sort((a, b) => b.points - a.points)

  return (
    <div className="h-full flex flex-col p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Stars</h3>
      </div>

      <div className="flex-1 space-y-2">
        {kids.map((member, index) => (
          <div
            key={member.id}
            className={`flex items-center gap-3 p-2 rounded-lg ${
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
            <p className="text-sm text-slate-400 dark:text-slate-500">No children added yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
