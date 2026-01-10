'use client'

import { useState } from 'react'
import { Plus, X, Link2, ChevronDown } from 'lucide-react'
import { useFamily } from '@/lib/family-context'
import { AvatarDisplay } from './PhotoUpload'

interface ContactLink {
  memberId: string
  relationshipType: string
}

interface ContactMemberLinkProps {
  links: ContactLink[]
  onChange: (links: ContactLink[]) => void
}

// Common relationship suggestions
const RELATIONSHIP_SUGGESTIONS = [
  // Danish
  'Mormor', 'Morfar', 'Farmor', 'Farfar',
  'Moster', 'Faster', 'Onkel', 'Fætter', 'Kusine',
  // English
  'Grandma', 'Grandpa', 'Grandmother', 'Grandfather',
  'Aunt', 'Uncle', 'Cousin',
  // Other
  'Godmother', 'Godfather', 'Nanny', 'Babysitter',
  'Teacher', 'Friend', 'Neighbour', 'Coach',
]

export default function ContactMemberLink({ links, onChange }: ContactMemberLinkProps) {
  const { members } = useFamily()
  const [isAdding, setIsAdding] = useState(false)
  const [newMemberId, setNewMemberId] = useState('')
  const [newRelationship, setNewRelationship] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleAddLink = () => {
    if (!newMemberId || !newRelationship.trim()) return

    // Check if this link already exists
    if (links.some(l => l.memberId === newMemberId)) {
      // Update existing link
      onChange(links.map(l =>
        l.memberId === newMemberId
          ? { ...l, relationshipType: newRelationship.trim() }
          : l
      ))
    } else {
      // Add new link
      onChange([...links, { memberId: newMemberId, relationshipType: newRelationship.trim() }])
    }

    // Reset form
    setNewMemberId('')
    setNewRelationship('')
    setIsAdding(false)
  }

  const handleRemoveLink = (memberId: string) => {
    onChange(links.filter(l => l.memberId !== memberId))
  }

  // Filter suggestions based on input
  const filteredSuggestions = RELATIONSHIP_SUGGESTIONS.filter(s =>
    s.toLowerCase().includes(newRelationship.toLowerCase()) &&
    s.toLowerCase() !== newRelationship.toLowerCase()
  ).slice(0, 5)

  // Get available members (not already linked)
  const availableMembers = members.filter(m =>
    !links.some(l => l.memberId === m.id)
  )

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        <Link2 className="w-4 h-4 inline mr-2" />
        Linked to Family Members
      </label>

      {/* Existing links */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => {
            const member = members.find(m => m.id === link.memberId)
            if (!member) return null

            return (
              <div
                key={link.memberId}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl"
              >
                <AvatarDisplay
                  photoUrl={member.photo_url}
                  emoji={member.avatar}
                  name={member.name}
                  color={member.color}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {member.name}
                  </p>
                  <p className="text-xs text-teal-600 dark:text-teal-400">
                    {link.relationshipType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveLink(link.memberId)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add new link */}
      {isAdding ? (
        <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl space-y-3">
          {/* Member selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Family Member
            </label>
            <select
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              <option value="">Select a family member...</option>
              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          {/* Relationship type */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Relationship (e.g., Grandma, Mormor, Uncle)
            </label>
            <input
              type="text"
              value={newRelationship}
              onChange={(e) => {
                setNewRelationship(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="e.g., Mormor, Grandma, Uncle..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setNewRelationship(suggestion)
                      setShowSuggestions(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-2">
            {['Mormor', 'Morfar', 'Grandma', 'Grandpa', 'Uncle', 'Aunt'].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setNewRelationship(suggestion)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  newRelationship === suggestion
                    ? 'bg-teal-500 text-white'
                    : 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900/50'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false)
                setNewMemberId('')
                setNewRelationship('')
              }}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!newMemberId || !newRelationship.trim()}
              className="flex-1 px-4 py-2 rounded-xl bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Link
            </button>
          </div>
        </div>
      ) : (
        availableMembers.length > 0 && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-teal-400 dark:hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Link to Family Member</span>
          </button>
        )
      )}

      {/* Help text */}
      {links.length === 0 && !isAdding && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Link this contact to a family member to show their relationship (e.g., "Olivia's Mormor")
        </p>
      )}
    </div>
  )
}

// Compact display for showing links (read-only)
interface ContactMemberLinkDisplayProps {
  links: { memberId: string; relationshipType: string }[]
  className?: string
}

export function ContactMemberLinkDisplay({ links, className = '' }: ContactMemberLinkDisplayProps) {
  const { getMember } = useFamily()

  if (links.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {links.map((link) => {
        const member = getMember(link.memberId)
        if (!member) return null

        return (
          <span
            key={link.memberId}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300"
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: member.color }}
            />
            {member.name}'s {link.relationshipType}
          </span>
        )
      })}
    </div>
  )
}
