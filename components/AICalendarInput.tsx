'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Sparkles, Image, X, Loader2, Calendar, Clock, MapPin, Users, Check, Plus, AlertCircle, Tag, Repeat, UserPlus } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useSettings, GeminiModel } from '@/lib/settings-context'
import { useFamily } from '@/lib/family-context'
import { useCategories } from '@/lib/categories-context'
import { useContacts } from '@/lib/contacts-context'
import { useTranslation } from '@/lib/i18n-context'
import { MEMBER_COLORS, RecurrencePattern, RecurrenceFrequency, DAYS_OF_WEEK } from '@/lib/database.types'
import CategorySelector from './CategorySelector'
import { patternToRRule, describeRecurrence } from '@/lib/rrule'
import MemberMultiSelect, { getMemberIdsByNames } from './MemberMultiSelect'

interface AIRecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  days_of_week?: string[]
  day_of_month?: number
  until?: string
  count?: number
}

interface ExtractedEvent {
  title: string
  description?: string
  start_date: string
  start_time?: string
  end_date?: string
  end_time?: string
  all_day: boolean
  location?: string
  suggested_member?: string // deprecated - kept for backwards compatibility
  suggested_members?: string[] // Multiple family member names
  suggested_category?: string // Category name to match
  suggested_contacts?: string[] // Extended contacts (grandparents, friends, etc.)
  recurrence_pattern?: AIRecurrencePattern // Pattern from AI
  // UI state
  selected?: boolean
  color?: string
  member_id?: string // deprecated
  member_ids?: string[] // Multiple member IDs
  contact_ids?: string[] // Extended contacts
  category_id?: string | null
  recurrence_rrule?: string // Converted RRULE for storage
  recurrence_ui_pattern?: RecurrencePattern // For UI display
}

interface AICalendarInputProps {
  isOpen: boolean
  onClose: () => void
  onAddEvents: (events: ExtractedEvent[]) => void
}

// Convert AI recurrence pattern to UI RecurrencePattern
function convertAIPatternToUIPattern(aiPattern: AIRecurrencePattern, startDate: string): RecurrencePattern {
  const dayNameToNumber: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6,
    'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
  }

  const pattern: RecurrencePattern = {
    frequency: aiPattern.frequency,
    interval: aiPattern.interval || 1,
    endType: 'never',
  }

  // Convert days of week from names to numbers
  if (aiPattern.days_of_week && aiPattern.days_of_week.length > 0) {
    pattern.daysOfWeek = aiPattern.days_of_week
      .map(d => dayNameToNumber[d.toLowerCase()])
      .filter(n => n !== undefined)
  } else if (aiPattern.frequency === 'weekly') {
    // Default to the start date's day of week
    pattern.daysOfWeek = [new Date(startDate).getDay()]
  }

  // Day of month for monthly
  if (aiPattern.day_of_month) {
    pattern.dayOfMonth = aiPattern.day_of_month
  }

  // End conditions
  if (aiPattern.until) {
    pattern.endType = 'until'
    pattern.endDate = aiPattern.until
  } else if (aiPattern.count) {
    pattern.endType = 'count'
    pattern.occurrences = aiPattern.count
  }

  return pattern
}

export default function AICalendarInput({ isOpen, onClose, onAddEvents }: AICalendarInputProps) {
  const { aiModel: contextAiModel } = useSettings()
  const { members } = useFamily()
  const { categories, getCategoryByName } = useCategories()
  const { contacts } = useContacts()
  const { t } = useTranslation()
  const [inputText, setInputText] = useState('')

  // Get the latest aiModel - check localStorage directly to ensure we have the most recent value
  const [aiModel, setAiModel] = useState<GeminiModel>(contextAiModel)

  // Update aiModel when modal opens or context changes
  useEffect(() => {
    if (isOpen) {
      // Read directly from localStorage for the most up-to-date value
      const saved = localStorage.getItem('family-hub-settings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.ai_model && parsed.ai_model.startsWith('gemini-')) {
            setAiModel(parsed.ai_model)
          }
        } catch (e) {
          console.error('Error reading settings:', e)
        }
      }
    }
  }, [isOpen])

  // Also update when context changes
  useEffect(() => {
    setAiModel(contextAiModel)
  }, [contextAiModel])
  const [image, setImage] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError(t('aiCalendar.imageTooLarge'))
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setImage(base64)
      setImagePreview(base64)
      setError(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleRemoveImage = useCallback(() => {
    setImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleProcess = async () => {
    if (!inputText && !image) {
      setError(t('aiCalendar.enterTextOrImage'))
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Build context about family members and contacts
      // Include both real name and display_name so AI can match either
      const familyContext = [
        members.length > 0
          ? `${t('aiCalendar.boardMembers')} ${members.map(m => `${m.name} (${m.role})`).join(', ')}`
          : '',
        contacts.length > 0
          ? `${t('aiCalendar.extendedContacts')} ${contacts.map(c => {
              // Include display_name as alias if different from name
              if (c.display_name && c.display_name !== c.name) {
                return `${c.name} (also known as "${c.display_name}")`
              }
              return c.name
            }).join(', ')}`
          : ''
      ].filter(Boolean).join('\n')

      const response = await fetch('/api/calendar-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          image: image,
          model: aiModel,
          context: familyContext,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to process')
      }

      const data = await response.json()

      if (data.events && data.events.length > 0) {
        // Match suggested members and categories to actual data
        const processedEvents = data.events.map((event: ExtractedEvent) => {
          let memberIds: string[] = []
          let color = '#3b82f6' // Default blue
          let categoryId: string | null = null

          // Handle multi-member suggestions (new)
          if (event.suggested_members && event.suggested_members.length > 0) {
            memberIds = getMemberIdsByNames(event.suggested_members, members)
            // Use first member's color if available
            if (memberIds.length > 0) {
              const firstMember = members.find(m => m.id === memberIds[0])
              if (firstMember) color = firstMember.color
            }
          }
          // Fallback to old single member field
          else if (event.suggested_member) {
            const matchedMember = members.find(m =>
              m.name.toLowerCase().includes(event.suggested_member!.toLowerCase()) ||
              event.suggested_member!.toLowerCase().includes(m.name.toLowerCase())
            )
            if (matchedMember) {
              memberIds = [matchedMember.id]
              color = matchedMember.color
            }
          }

          // Match suggested category
          if (event.suggested_category) {
            const matchedCategory = getCategoryByName(event.suggested_category)
            if (matchedCategory) {
              categoryId = matchedCategory.id
              // Use category color if no members selected
              if (memberIds.length === 0) {
                color = matchedCategory.color
              }
            }
          }

          // Match suggested contacts - use flexible matching on name and display_name
          let contactIds: string[] = []
          if (event.suggested_contacts && event.suggested_contacts.length > 0) {
            for (const suggestedName of event.suggested_contacts) {
              const nameLower = suggestedName.toLowerCase().trim()

              // Try to find a matching contact with flexible matching
              const matchedContact = contacts.find(c => {
                const contactName = c.name.toLowerCase().trim()
                const displayName = c.display_name?.toLowerCase().trim() || ''

                // Exact match on name or display_name
                if (contactName === nameLower) return true
                if (displayName && displayName === nameLower) return true

                // Partial match (contact name/display_name contains suggested or vice versa)
                if (contactName.includes(nameLower) || nameLower.includes(contactName)) return true
                if (displayName && (displayName.includes(nameLower) || nameLower.includes(displayName))) return true

                // Word-based match (e.g., "Grandma Rose" matches "Grandma")
                const contactWords = contactName.split(/\s+/)
                const displayWords = displayName ? displayName.split(/\s+/) : []
                const suggestedWords = nameLower.split(/\s+/)
                if (contactWords.some(w => suggestedWords.includes(w))) return true
                if (suggestedWords.some(w => contactWords.includes(w))) return true
                if (displayWords.some(w => suggestedWords.includes(w))) return true
                if (suggestedWords.some(w => displayWords.includes(w))) return true

                return false
              })

              if (matchedContact && !contactIds.includes(matchedContact.id)) {
                contactIds.push(matchedContact.id)
              }
            }
          }

          // Handle recurrence pattern
          let recurrenceUiPattern: RecurrencePattern | undefined
          let recurrenceRrule: string | undefined

          if (event.recurrence_pattern) {
            recurrenceUiPattern = convertAIPatternToUIPattern(event.recurrence_pattern, event.start_date)
            recurrenceRrule = patternToRRule(recurrenceUiPattern, new Date(event.start_date))
          }

          return {
            ...event,
            selected: true,
            color,
            member_ids: memberIds,
            contact_ids: contactIds,
            category_id: categoryId,
            recurrence_ui_pattern: recurrenceUiPattern,
            recurrence_rrule: recurrenceRrule,
          }
        })

        setExtractedEvents(processedEvents)
        setSummary(data.summary)
        setStep('preview')
      } else {
        setError(t('aiCalendar.noEventsExtracted'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process input')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleToggleEvent = (index: number) => {
    setExtractedEvents(events =>
      events.map((e, i) => i === index ? { ...e, selected: !e.selected } : e)
    )
  }

  const handleUpdateEvent = (index: number, updates: Partial<ExtractedEvent>) => {
    setExtractedEvents(events =>
      events.map((e, i) => i === index ? { ...e, ...updates } : e)
    )
  }

  const handleAddSelected = () => {
    const selectedEvents = extractedEvents.filter(e => e.selected)
    if (selectedEvents.length > 0) {
      onAddEvents(selectedEvents)
      handleReset()
      onClose()
    }
  }

  const handleReset = () => {
    setInputText('')
    setImage(null)
    setImagePreview(null)
    setExtractedEvents([])
    setSummary(null)
    setError(null)
    setStep('input')
  }

  const handleBack = () => {
    setStep('input')
  }

  const selectedCount = extractedEvents.filter(e => e.selected).length

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('aiCalendar.title')} size="3xl">
      <div className="space-y-6">
        {/* AI Model Indicator */}
        <div className="flex items-center gap-2 text-base text-slate-500 dark:text-slate-400">
          <Sparkles className="w-5 h-5" />
          <span>{aiModel === 'claude' ? t('aiCalendar.usingClaude') : t('aiCalendar.usingGemini')}</span>
        </div>

        {step === 'input' ? (
          <>
            {/* Text Input */}
            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-3">
                {t('aiCalendar.describeEvents')}
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t('aiCalendar.placeholder')}
                className="w-full px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-lg focus:ring-2 focus:ring-sage-500 focus:border-transparent resize-none"
                rows={6}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-3">
                {t('aiCalendar.uploadImage')}
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {t('aiCalendar.uploadDescription')}
              </p>

              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Uploaded"
                    className="max-h-64 rounded-xl border border-slate-200 dark:border-slate-600"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-8 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl hover:border-sage-400 dark:hover:border-sage-500 transition-colors flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400"
                >
                  <Image className="w-12 h-12" />
                  <span className="text-base">{t('aiCalendar.tapToUpload')}</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-base">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" onClick={onClose} className="px-6 py-3 text-base">
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleProcess}
                disabled={isProcessing || (!inputText && !image)}
                className="px-6 py-3 text-base"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t('aiCalendar.processing')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    {t('aiCalendar.extractEvents')}
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Preview Step */}
            <div className="bg-sage-50 dark:bg-sage-900/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-sage-700 dark:text-sage-300">
                <Sparkles className="w-4 h-4 inline mr-1" />
                {summary}
              </p>
            </div>

            <div className="space-y-4">
              {extractedEvents.map((event, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    event.selected
                      ? 'border-sage-400 dark:border-sage-500 bg-white dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleEvent(index)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                        event.selected
                          ? 'bg-sage-500 border-sage-500 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {event.selected && <Check className="w-4 h-4" />}
                    </button>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={event.title}
                        onChange={(e) => handleUpdateEvent(index, { title: e.target.value })}
                        className="w-full font-medium text-slate-800 dark:text-slate-100 bg-transparent border-none p-0 focus:ring-0"
                      />

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <input
                            type="date"
                            value={event.start_date}
                            onChange={(e) => handleUpdateEvent(index, { start_date: e.target.value })}
                            className="bg-transparent border-none p-0 focus:ring-0 text-sm"
                          />
                        </div>

                        {!event.all_day && event.start_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <input
                              type="time"
                              value={event.start_time}
                              onChange={(e) => handleUpdateEvent(index, { start_time: e.target.value })}
                              className="bg-transparent border-none p-0 focus:ring-0 text-sm"
                            />
                            {event.end_time && (
                              <>
                                <span>-</span>
                                <input
                                  type="time"
                                  value={event.end_time}
                                  onChange={(e) => handleUpdateEvent(index, { end_time: e.target.value })}
                                  className="bg-transparent border-none p-0 focus:ring-0 text-sm"
                                />
                              </>
                            )}
                          </div>
                        )}

                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{event.location}</span>
                          </div>
                        )}

                        {event.recurrence_ui_pattern && (
                          <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                            <Repeat className="w-3.5 h-3.5" />
                            <span className="font-medium">{describeRecurrence(event.recurrence_ui_pattern)}</span>
                          </div>
                        )}
                      </div>

                      {/* Category & Member Selection */}
                      <div className="flex flex-col gap-3 mt-3">
                        {/* Category */}
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <CategorySelector
                            value={event.category_id || null}
                            onChange={(categoryId) => {
                              const category = categories.find(c => c.id === categoryId)
                              handleUpdateEvent(index, {
                                category_id: categoryId,
                                // Update color from category if no members selected
                                color: (event.member_ids?.length === 0 && category)
                                  ? category.color
                                  : event.color,
                              })
                            }}
                            placeholder="Select category"
                            className="flex-1"
                          />
                        </div>

                        {/* Members */}
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <MemberMultiSelect
                            value={event.member_ids || []}
                            onChange={(memberIds) => {
                              const firstMember = memberIds.length > 0
                                ? members.find(m => m.id === memberIds[0])
                                : null
                              handleUpdateEvent(index, {
                                member_ids: memberIds,
                                color: firstMember?.color || event.color,
                              })
                            }}
                            placeholder="Select members"
                            className="flex-1"
                          />
                        </div>

                        {/* Contacts (Extended Family/Friends) */}
                        {contacts.length > 0 && (
                          <div className="flex items-start gap-2">
                            <UserPlus className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-2" />
                            <div className="flex-1">
                              <div className="flex flex-wrap gap-1.5">
                                {contacts.map(contact => {
                                  const isSelected = event.contact_ids?.includes(contact.id)
                                  return (
                                    <button
                                      key={contact.id}
                                      onClick={() => {
                                        const currentIds = event.contact_ids || []
                                        const newIds = isSelected
                                          ? currentIds.filter(id => id !== contact.id)
                                          : [...currentIds, contact.id]
                                        handleUpdateEvent(index, { contact_ids: newIds })
                                      }}
                                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                        isSelected
                                          ? 'text-white'
                                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                      }`}
                                      style={isSelected ? { backgroundColor: contact.color || '#6b7280' } : undefined}
                                      title={contact.display_name && contact.display_name !== contact.name ? contact.name : undefined}
                                    >
                                      {contact.display_name || contact.name}
                                    </button>
                                  )
                                })}
                              </div>
                              {(event.contact_ids?.length ?? 0) > 0 && (
                                <p className="text-xs text-slate-400 mt-1">
                                  {event.contact_ids?.length === 1
                                    ? t('contacts.contactTagged')
                                    : t('contacts.contactsTagged', { count: event.contact_ids?.length ?? 0 })}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Color Selection */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Color:</span>
                          <div className="flex items-center gap-1">
                            {MEMBER_COLORS.slice(0, 8).map(c => (
                              <button
                                key={c.id}
                                onClick={() => handleUpdateEvent(index, { color: c.color })}
                                className={`w-5 h-5 rounded-full transition-transform ${
                                  event.color === c.color ? 'scale-125 ring-2 ring-offset-1 ring-slate-300 dark:ring-slate-600' : ''
                                }`}
                                style={{ backgroundColor: c.color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Color indicator */}
                    <div
                      className="w-3 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" onClick={handleBack}>
                {t('common.back')}
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedCount === 1
                    ? t('aiCalendar.eventSelected')
                    : t('aiCalendar.eventsSelected', { count: selectedCount })}
                </span>
                <Button
                  onClick={handleAddSelected}
                  disabled={selectedCount === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('aiCalendar.addToCalendar')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
