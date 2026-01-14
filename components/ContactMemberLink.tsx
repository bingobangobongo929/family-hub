'use client'

import { useState, useMemo } from 'react'
import { Plus, X, Link2, Users, User } from 'lucide-react'
import { useFamily } from '@/lib/family-context'
import { AvatarDisplay } from './PhotoUpload'
import { useTranslation } from '@/lib/i18n-context'

interface ContactLink {
  memberId: string
  relationshipType: string
}

interface ContactMemberLinkProps {
  links: ContactLink[]
  onChange: (links: ContactLink[]) => void
}

// Relationship patterns that apply to children
const GRANDPARENT_TYPES = ['mormor', 'morfar', 'farmor', 'farfar', 'grandma', 'grandpa', 'grandmother', 'grandfather', 'nana', 'nanny', 'granny', 'oma', 'opa', 'gran', 'gramps']
const AUNT_UNCLE_TYPES = ['moster', 'faster', 'onkel', 'aunt', 'uncle', 'tante']
const COUSIN_TYPES = ['fætter', 'kusine', 'cousin']

// Check if a relationship type applies to all children
function isChildRelationship(type: string): boolean {
  const lower = type.toLowerCase().trim()
  return [...GRANDPARENT_TYPES, ...AUNT_UNCLE_TYPES, ...COUSIN_TYPES].some(t => lower.includes(t))
}

// Check if it's a maternal relationship (wife's side)
function isMaternalRelationship(type: string): boolean {
  const lower = type.toLowerCase().trim()
  return ['mormor', 'morfar', 'moster'].some(t => lower.includes(t))
}

// Check if it's a paternal relationship (husband's side)
function isPaternalRelationship(type: string): boolean {
  const lower = type.toLowerCase().trim()
  return ['farmor', 'farfar', 'faster'].some(t => lower.includes(t))
}

// Get the corresponding parent relationship
function getParentRelationship(type: string, isToParent: boolean): string | null {
  const lower = type.toLowerCase().trim()

  // Grandparents
  if (GRANDPARENT_TYPES.some(t => lower.includes(t))) {
    if (lower.includes('mor') && !lower.includes('far')) return isToParent ? 'Mor' : 'Svigermor' // Mother / Mother-in-law
    if (lower.includes('far') && !lower.includes('mor')) return isToParent ? 'Far' : 'Svigerfar' // Father / Father-in-law
    // English - can't determine maternal/paternal from "grandma"
    return null
  }

  // Aunts/Uncles
  if (lower.includes('moster')) return isToParent ? 'Søster' : null // Sister
  if (lower.includes('faster')) return isToParent ? 'Søster' : null
  if (lower.includes('onkel')) return isToParent ? 'Bror' : null // Brother
  if (lower.includes('aunt')) return isToParent ? 'Sister' : null
  if (lower.includes('uncle')) return isToParent ? 'Brother' : null

  return null
}

// Common relationship suggestions organized by type
const RELATIONSHIP_GROUPS = {
  grandparents: {
    label: 'Grandparents',
    labelDa: 'Bedsteforældre',
    items: [
      { da: 'Mormor', en: 'Grandma (maternal)' },
      { da: 'Morfar', en: 'Grandpa (maternal)' },
      { da: 'Farmor', en: 'Grandma (paternal)' },
      { da: 'Farfar', en: 'Grandpa (paternal)' },
    ]
  },
  auntsUncles: {
    label: 'Aunts & Uncles',
    labelDa: 'Tanter og onkler',
    items: [
      { da: 'Moster', en: 'Aunt (maternal)' },
      { da: 'Faster', en: 'Aunt (paternal)' },
      { da: 'Onkel', en: 'Uncle' },
    ]
  },
  other: {
    label: 'Other',
    labelDa: 'Andre',
    items: [
      { da: 'Fætter', en: 'Cousin (male)' },
      { da: 'Kusine', en: 'Cousin (female)' },
      { da: 'Gudmor', en: 'Godmother' },
      { da: 'Gudfar', en: 'Godfather' },
      { da: 'Ven', en: 'Friend' },
      { da: 'Nabo', en: 'Neighbour' },
    ]
  }
}

export default function ContactMemberLink({ links, onChange }: ContactMemberLinkProps) {
  const { members } = useFamily()
  const { t, locale } = useTranslation()
  const [mode, setMode] = useState<'idle' | 'quick' | 'manual'>('idle')
  const [selectedRelationship, setSelectedRelationship] = useState('')
  const [applyToAllChildren, setApplyToAllChildren] = useState(true)
  const [selectedMemberId, setSelectedMemberId] = useState('')

  // Get children and parents
  const children = useMemo(() => members.filter(m => m.role === 'child'), [members])
  const parents = useMemo(() => members.filter(m => m.role === 'parent'), [members])

  // Quick add for family-wide relationships
  const handleQuickAdd = () => {
    if (!selectedRelationship.trim()) return

    const newLinks: ContactLink[] = []
    const relationship = selectedRelationship.trim()

    if (applyToAllChildren && isChildRelationship(relationship)) {
      // Add to all children
      children.forEach(child => {
        if (!links.some(l => l.memberId === child.id)) {
          newLinks.push({ memberId: child.id, relationshipType: relationship })
        }
      })
    }

    // Optionally add parent relationships (for Danish specific terms)
    if (isMaternalRelationship(relationship) || isPaternalRelationship(relationship)) {
      const isMaternal = isMaternalRelationship(relationship)

      parents.forEach((parent, idx) => {
        // Assume first parent is "mor" for maternal, or "far" for paternal
        // This is a simplification - ideally we'd know which parent is which
        const parentRel = getParentRelationship(relationship, idx === (isMaternal ? 0 : 1))
        if (parentRel && !links.some(l => l.memberId === parent.id)) {
          newLinks.push({ memberId: parent.id, relationshipType: parentRel })
        }
      })
    }

    if (newLinks.length > 0) {
      onChange([...links, ...newLinks])
    }

    setSelectedRelationship('')
    setMode('idle')
  }

  // Manual add for single member
  const handleManualAdd = () => {
    if (!selectedMemberId || !selectedRelationship.trim()) return

    if (!links.some(l => l.memberId === selectedMemberId)) {
      onChange([...links, { memberId: selectedMemberId, relationshipType: selectedRelationship.trim() }])
    }

    setSelectedMemberId('')
    setSelectedRelationship('')
    setMode('idle')
  }

  const handleRemoveLink = (memberId: string) => {
    onChange(links.filter(l => l.memberId !== memberId))
  }

  // Get available members (not already linked)
  const availableMembers = members.filter(m => !links.some(l => l.memberId === m.id))

  // Group linked members by relationship type for cleaner display
  const groupedLinks = useMemo(() => {
    const groups: Record<string, typeof links> = {}
    links.forEach(link => {
      const key = link.relationshipType.toLowerCase()
      if (!groups[key]) groups[key] = []
      groups[key].push(link)
    })
    return groups
  }, [links])

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        <Link2 className="w-4 h-4 inline mr-2" />
        {t('contacts.familyLinks')}
      </label>

      {/* Existing links - grouped by relationship */}
      {Object.entries(groupedLinks).length > 0 && (
        <div className="space-y-2">
          {Object.entries(groupedLinks).map(([relType, relLinks]) => (
            <div key={relType} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-2 capitalize">
                {relLinks[0].relationshipType}
              </p>
              <div className="flex flex-wrap gap-2">
                {relLinks.map((link) => {
                  const member = members.find(m => m.id === link.memberId)
                  if (!member) return null

                  return (
                    <div
                      key={link.memberId}
                      className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-600 rounded-lg"
                    >
                      <AvatarDisplay
                        photoUrl={member.photo_url}
                        emoji={member.avatar}
                        name={member.name}
                        color={member.color}
                        size="xs"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{member.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(link.memberId)}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new link */}
      {mode === 'idle' && availableMembers.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('quick')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-teal-300 dark:border-teal-600 text-teal-600 dark:text-teal-400 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">{t('contacts.addFamilyRole')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <User className="w-4 h-4" />
            <span className="text-sm">{t('contacts.addIndividual')}</span>
          </button>
        </div>
      )}

      {/* Quick add mode - family role */}
      {mode === 'quick' && (
        <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl space-y-3">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
            {t('contacts.selectFamilyRole')}
          </p>

          {/* Relationship type groups */}
          {Object.entries(RELATIONSHIP_GROUPS).map(([key, group]) => (
            <div key={key}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {locale === 'da' ? group.labelDa : group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => {
                  const label = locale === 'da' ? item.da : item.en
                  const value = item.da // Always use Danish for storage consistency
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedRelationship(value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedRelationship === value
                          ? 'bg-teal-500 text-white'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900/50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Custom input */}
          <div>
            <input
              type="text"
              value={selectedRelationship}
              onChange={(e) => setSelectedRelationship(e.target.value)}
              placeholder={t('contacts.customRelationship')}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm"
            />
          </div>

          {/* Options */}
          {selectedRelationship && isChildRelationship(selectedRelationship) && children.length > 1 && (
            <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={applyToAllChildren}
                onChange={(e) => setApplyToAllChildren(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {t('contacts.applyToAllChildren', { count: children.length })}
              </span>
            </label>
          )}

          {/* Preview */}
          {selectedRelationship && (
            <div className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('contacts.willLinkTo')}:</p>
              <div className="flex flex-wrap gap-1">
                {(applyToAllChildren && isChildRelationship(selectedRelationship) ? children : []).map(child => (
                  <span key={child.id} className="px-2 py-0.5 rounded-full text-xs bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
                    {child.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('idle')
                setSelectedRelationship('')
              }}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!selectedRelationship.trim()}
              className="flex-1 px-4 py-2 rounded-xl bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {t('contacts.addLinks')}
            </button>
          </div>
        </div>
      )}

      {/* Manual add mode - single member */}
      {mode === 'manual' && (
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('contacts.familyMember')}
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm"
            >
              <option value="">{t('contacts.selectMember')}</option>
              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('contacts.relationship')}
            </label>
            <input
              type="text"
              value={selectedRelationship}
              onChange={(e) => setSelectedRelationship(e.target.value)}
              placeholder={t('contacts.relationshipPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('idle')
                setSelectedMemberId('')
                setSelectedRelationship('')
              }}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-600 transition-colors text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleManualAdd}
              disabled={!selectedMemberId || !selectedRelationship.trim()}
              className="flex-1 px-4 py-2 rounded-xl bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {t('common.add')}
            </button>
          </div>
        </div>
      )}

      {/* Help text */}
      {links.length === 0 && mode === 'idle' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('contacts.linkHelp')}
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

  // Group by relationship type
  const grouped: Record<string, string[]> = {}
  links.forEach(link => {
    const member = getMember(link.memberId)
    if (!member) return
    const key = link.relationshipType
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(member.name)
  })

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {Object.entries(grouped).map(([relType, names]) => (
        <span
          key={relType}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300"
        >
          {names.length > 2
            ? `${relType} (${names.length})`
            : names.length === 1
              ? `${names[0]}'s ${relType}`
              : `${names.join(' & ')}'s ${relType}`
          }
        </span>
      ))}
    </div>
  )
}
