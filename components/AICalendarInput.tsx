'use client'

import { useState, useRef, useCallback } from 'react'
import { Sparkles, Image, X, Loader2, Calendar, Clock, MapPin, User, Check, Plus, AlertCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useSettings } from '@/lib/settings-context'
import { useFamily } from '@/lib/family-context'
import { MEMBER_COLORS } from '@/lib/database.types'

interface ExtractedEvent {
  title: string
  description?: string
  start_date: string
  start_time?: string
  end_date?: string
  end_time?: string
  all_day: boolean
  location?: string
  suggested_member?: string
  // UI state
  selected?: boolean
  color?: string
  member_id?: string
}

interface AICalendarInputProps {
  isOpen: boolean
  onClose: () => void
  onAddEvents: (events: ExtractedEvent[]) => void
}

export default function AICalendarInput({ isOpen, onClose, onAddEvents }: AICalendarInputProps) {
  const { aiModel } = useSettings()
  const { members } = useFamily()
  const [inputText, setInputText] = useState('')
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
      setError('Image must be less than 5MB')
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
      setError('Please enter some text or upload an image')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Build context about family members
      const familyContext = members.length > 0
        ? `Family members: ${members.map(m => `${m.name} (${m.role})`).join(', ')}`
        : ''

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
        // Match suggested members to actual family members and assign colors
        const processedEvents = data.events.map((event: ExtractedEvent) => {
          let memberId = ''
          let color = '#3b82f6' // Default blue

          if (event.suggested_member) {
            const matchedMember = members.find(m =>
              m.name.toLowerCase().includes(event.suggested_member!.toLowerCase()) ||
              event.suggested_member!.toLowerCase().includes(m.name.toLowerCase())
            )
            if (matchedMember) {
              memberId = matchedMember.id
              color = matchedMember.color
            }
          }

          return {
            ...event,
            selected: true,
            color,
            member_id: memberId,
          }
        })

        setExtractedEvents(processedEvents)
        setSummary(data.summary)
        setStep('preview')
      } else {
        setError('No events could be extracted. Try being more specific.')
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
    <Modal isOpen={isOpen} onClose={onClose} title="Smart Add" size="lg">
      <div className="space-y-4">
        {/* AI Model Indicator */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Sparkles className="w-4 h-4" />
          <span>Using {aiModel === 'claude' ? 'Claude 3.5 Sonnet' : 'Gemini Flash'}</span>
        </div>

        {step === 'input' ? (
          <>
            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Describe the event(s)
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="e.g., Olivia has swimming lessons every Tuesday at 4pm at the leisure centre, or Doctor's appointment tomorrow at 10am..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sage-500 focus:border-transparent resize-none"
                rows={4}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Or upload an image (optional)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Screenshot a school newsletter, appointment letter, or any schedule
              </p>

              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Uploaded"
                    className="max-h-48 rounded-xl border border-slate-200 dark:border-slate-600"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-6 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl hover:border-sage-400 dark:hover:border-sage-500 transition-colors flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400"
                >
                  <Image className="w-8 h-8" />
                  <span className="text-sm">Click to upload image</span>
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
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleProcess}
                disabled={isProcessing || (!inputText && !image)}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Extract Events
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

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
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
                      </div>

                      {/* Member & Color Selection */}
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <select
                            value={event.member_id || ''}
                            onChange={(e) => {
                              const member = members.find(m => m.id === e.target.value)
                              handleUpdateEvent(index, {
                                member_id: e.target.value,
                                color: member?.color || event.color,
                              })
                            }}
                            className="text-sm bg-transparent border-none p-0 focus:ring-0 text-slate-600 dark:text-slate-400"
                          >
                            <option value="">Everyone</option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          {MEMBER_COLORS.slice(0, 6).map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleUpdateEvent(index, { color: c.color })}
                              className={`w-5 h-5 rounded-full transition-transform ${
                                event.color === c.color ? 'scale-125 ring-2 ring-offset-1 ring-slate-300' : ''
                              }`}
                              style={{ backgroundColor: c.color }}
                            />
                          ))}
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
                Back
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedCount} event{selectedCount !== 1 ? 's' : ''} selected
                </span>
                <Button
                  onClick={handleAddSelected}
                  disabled={selectedCount === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Calendar
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
