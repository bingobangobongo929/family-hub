'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'
import { FamilyMember } from '@/lib/database.types'
import { useFamily } from '@/lib/family-context'

interface MemberMultiSelectProps {
  value: string[]
  onChange: (memberIds: string[]) => void
  placeholder?: string
  className?: string
  maxDisplay?: number
}

export default function MemberMultiSelect({
  value,
  onChange,
  placeholder = 'Select members',
  className = '',
  maxDisplay = 3,
}: MemberMultiSelectProps) {
  const { members, getMember } = useFamily()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedMembers = value.map(id => getMember(id)).filter(Boolean) as FamilyMember[]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = (memberId: string) => {
    if (value.includes(memberId)) {
      onChange(value.filter(id => id !== memberId))
    } else {
      onChange([...value, memberId])
    }
  }

  const handleRemove = (e: React.MouseEvent, memberId: string) => {
    e.stopPropagation()
    onChange(value.filter(id => id !== memberId))
  }

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl border transition-colors ${
          isOpen
            ? 'border-teal-500 ring-2 ring-teal-500/20'
            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
        } bg-white dark:bg-slate-800 text-left`}
      >
        {selectedMembers.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            {selectedMembers.slice(0, maxDisplay).map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: `${member.color}20`,
                  color: member.color,
                }}
              >
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: member.color }}>
                  <span className="flex items-center justify-center h-full text-[10px] text-white font-semibold">
                    {member.name[0]}
                  </span>
                </span>
                {member.name}
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, member.id)}
                  className="ml-0.5 p-0.5 rounded hover:bg-black/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedMembers.length > maxDisplay && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                +{selectedMembers.length - maxDisplay} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedMembers.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 py-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg">
          {members.map((member) => {
            const isSelected = value.includes(member.id)
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => handleToggle(member.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-left transition-colors ${
                  isSelected
                    ? 'bg-teal-50 dark:bg-teal-900/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                  style={{ backgroundColor: member.color }}
                >
                  {member.name[0]}
                </span>
                <span className="flex-1 truncate text-slate-700 dark:text-slate-200">
                  {member.name}
                </span>
                <span className="text-xs text-slate-400 capitalize">{member.role}</span>
                {isSelected && (
                  <Check className="w-4 h-4 text-teal-500 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Helper to get member IDs by name (for AI suggestions)
// Checks name, aliases, and description for matches
export function getMemberIdsByNames(memberNames: string[], members: FamilyMember[]): string[] {
  return memberNames
    .map(name => {
      const nameLower = name.toLowerCase().trim()

      // Try exact match on name first
      let match = members.find(m => m.name.toLowerCase().trim() === nameLower)

      // Try exact match on aliases
      if (!match) {
        match = members.find(m =>
          m.aliases?.some(alias => alias.toLowerCase().trim() === nameLower)
        )
      }

      // Try partial match on name
      if (!match) {
        match = members.find(m =>
          m.name.toLowerCase().trim().includes(nameLower) ||
          nameLower.includes(m.name.toLowerCase().trim())
        )
      }

      // Try partial match on aliases
      if (!match) {
        match = members.find(m =>
          m.aliases?.some(alias =>
            alias.toLowerCase().trim().includes(nameLower) ||
            nameLower.includes(alias.toLowerCase().trim())
          )
        )
      }

      // Try match in description (e.g., "Chelina is the Mum")
      if (!match) {
        match = members.find(m =>
          m.description?.toLowerCase().includes(nameLower)
        )
      }

      return match?.id
    })
    .filter((id): id is string => id !== undefined)
}
