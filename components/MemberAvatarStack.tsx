'use client'

import { FamilyMember } from '@/lib/database.types'
import { useFamily } from '@/lib/family-context'

interface MemberAvatarStackProps {
  memberIds: string[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
  maxDisplay?: number
  className?: string
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

const overlapClasses = {
  xs: '-ml-1.5',
  sm: '-ml-2',
  md: '-ml-2.5',
  lg: '-ml-3',
}

export default function MemberAvatarStack({
  memberIds,
  size = 'sm',
  maxDisplay = 4,
  className = '',
}: MemberAvatarStackProps) {
  const { getMember } = useFamily()

  const members = memberIds.map(id => getMember(id)).filter(Boolean) as FamilyMember[]

  if (members.length === 0) return null

  const displayMembers = members.slice(0, maxDisplay)
  const remainingCount = members.length - maxDisplay

  return (
    <div className={`flex items-center ${className}`}>
      {displayMembers.map((member, index) => (
        <div
          key={member.id}
          className={`${sizeClasses[size]} ${index > 0 ? overlapClasses[size] : ''} rounded-full flex items-center justify-center text-white font-semibold ring-2 ring-white dark:ring-slate-800 flex-shrink-0`}
          style={{ backgroundColor: member.color, zIndex: displayMembers.length - index }}
          title={member.name}
        >
          {member.name[0]}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={`${sizeClasses[size]} ${overlapClasses[size]} rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-semibold ring-2 ring-white dark:ring-slate-800 flex-shrink-0`}
          style={{ zIndex: 0 }}
          title={`${remainingCount} more`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}

// Single member avatar for backwards compatibility
export function MemberAvatar({
  memberId,
  size = 'sm',
  className = '',
}: {
  memberId: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const { getMember } = useFamily()
  const member = memberId ? getMember(memberId) : null

  if (!member) return null

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
      style={{ backgroundColor: member.color }}
      title={member.name}
    >
      {member.name[0]}
    </div>
  )
}

// Dot indicator version (smaller, just colored dots)
export function MemberDotStack({
  memberIds,
  maxDisplay = 4,
  className = '',
}: {
  memberIds: string[]
  maxDisplay?: number
  className?: string
}) {
  const { getMember } = useFamily()

  const members = memberIds.map(id => getMember(id)).filter(Boolean) as FamilyMember[]

  if (members.length === 0) return null

  const displayMembers = members.slice(0, maxDisplay)
  const remainingCount = members.length - maxDisplay

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {displayMembers.map((member) => (
        <div
          key={member.id}
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: member.color }}
          title={member.name}
        />
      ))}
      {remainingCount > 0 && (
        <span className="text-[10px] text-slate-400 ml-0.5">+{remainingCount}</span>
      )}
    </div>
  )
}
