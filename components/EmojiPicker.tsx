'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-context'

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  onClose: () => void
}

// Emoji categories with touch-friendly selections
const EMOJI_CATEGORIES = {
  people: {
    label: 'People',
    icon: '👤',
    emojis: [
      '👨', '👩', '🧒', '👧', '👦', '👶', '🧒',
      '👴', '👵', '🧓', '👱', '👱‍♀️', '🧔', '👩‍🦰',
      '👨‍🦱', '👩‍🦱', '👨‍🦳', '👩‍🦳', '👨‍🦲', '👩‍🦲',
      '🧑', '👤', '👥', '🫂', '👭', '👫', '👬',
    ],
  },
  family: {
    label: 'Family',
    icon: '👨‍👩‍👧',
    emojis: [
      '👨‍👩‍👧', '👨‍👩‍👧‍👦', '👨‍👩‍👦‍👦', '👨‍👩‍👧‍👧',
      '👨‍👦', '👨‍👧', '👨‍👧‍👦', '👩‍👦', '👩‍👧', '👩‍👧‍👦',
      '👪', '🤰', '🤱', '👼', '🧒', '👶',
      '💑', '💏', '👩‍❤️‍👨', '👨‍❤️‍👨', '👩‍❤️‍👩',
    ],
  },
  animals: {
    label: 'Pets',
    icon: '🐾',
    emojis: [
      '🐕', '🐶', '🐩', '🐕‍🦺', '🦮', '🐈', '🐱', '🐈‍⬛',
      '🐰', '🐇', '🐹', '🐭', '🐀', '🦔', '🐿️',
      '🐦', '🦜', '🐤', '🦆', '🦢', '🦩',
      '🐠', '🐟', '🐡', '🦈', '🐙', '🐢', '🐍', '🦎',
      '🐾', '🦴', '🐴', '🐎', '🦄',
    ],
  },
  smileys: {
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
      '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒',
      '🙄', '😬', '😌', '😔', '😪', '🤤', '😴', '😷',
    ],
  },
  objects: {
    label: 'Objects',
    icon: '🎉',
    emojis: [
      '⭐', '🌟', '✨', '💫', '🎉', '🎊', '🎈', '🎁',
      '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎗️',
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💝', '💖', '💗', '💓', '💕', '💞', '💘', '💌',
      '🔔', '🎵', '🎶', '🎤', '🎧', '🎸', '🎹', '🎺',
    ],
  },
  activities: {
    label: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌',
      '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺',
    ],
  },
}

type CategoryKey = keyof typeof EMOJI_CATEGORIES

export default function EmojiPicker({ value, onChange, onClose }: EmojiPickerProps) {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('people')

  const handleSelect = (emoji: string) => {
    onChange(emoji)
    onClose()
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('emojiPicker.title')}
        </span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {(Object.keys(EMOJI_CATEGORIES) as CategoryKey[]).map((key) => {
          const category = EMOJI_CATEGORIES[key]
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl text-2xl transition-all ${
                activeCategory === key
                  ? 'bg-teal-100 dark:bg-teal-900/50 scale-105'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={category.label}
            >
              {category.icon}
            </button>
          )
        })}
      </div>

      {/* Emoji Grid */}
      <div className="p-3 max-h-64 overflow-y-auto">
        <div className="grid grid-cols-7 gap-1">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => handleSelect(emoji)}
              className={`w-11 h-11 flex items-center justify-center text-2xl rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-110 active:scale-95 ${
                value === emoji ? 'bg-teal-100 dark:bg-teal-900/50 ring-2 ring-teal-500' : ''
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Selected preview */}
      {value && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">{t('emojiPicker.selected')}</span>
          <span className="text-3xl">{value}</span>
          <button
            onClick={() => onChange('')}
            className="ml-auto text-xs text-slate-500 hover:text-red-500 transition-colors"
          >
            {t('emojiPicker.clear')}
          </button>
        </div>
      )}
    </div>
  )
}

// Compact emoji button that opens the picker
interface EmojiButtonProps {
  value: string
  onChange: (emoji: string) => void
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function EmojiButton({
  value,
  onChange,
  placeholder = '😀',
  size = 'md',
  className = '',
}: EmojiButtonProps) {
  const [showPicker, setShowPicker] = useState(false)

  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-4xl',
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className={`${sizeClasses[size]} flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500 bg-white dark:bg-slate-700 transition-all hover:scale-105 active:scale-95`}
      >
        {value || <span className="opacity-50">{placeholder}</span>}
      </button>

      {showPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          {/* Picker */}
          <div className="absolute z-50 mt-2 left-0">
            <EmojiPicker
              value={value}
              onChange={(emoji) => {
                onChange(emoji)
                setShowPicker(false)
              }}
              onClose={() => setShowPicker(false)}
            />
          </div>
        </>
      )}
    </div>
  )
}
