'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { EventCategory } from '@/lib/database.types'
import { useCategories } from '@/lib/categories-context'

interface CategorySelectorProps {
  value: string | null
  onChange: (categoryId: string | null) => void
  placeholder?: string
  className?: string
  showClear?: boolean
}

export default function CategorySelector({
  value,
  onChange,
  placeholder = 'Select category',
  className = '',
  showClear = true,
}: CategorySelectorProps) {
  const { categories, getCategory } = useCategories()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedCategory = value ? getCategory(value) : null

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

  const handleSelect = (category: EventCategory) => {
    onChange(category.id)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 min-h-[44px] rounded-xl border transition-colors ${
          isOpen
            ? 'border-teal-500 ring-2 ring-teal-500/20'
            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
        } bg-white dark:bg-slate-800 text-left`}
      >
        {selectedCategory ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-sm"
              style={{ backgroundColor: `${selectedCategory.color}20` }}
            >
              {selectedCategory.emoji}
            </span>
            <span className="truncate text-slate-700 dark:text-slate-200">
              {selectedCategory.name}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
        )}
        <div className="flex items-center gap-1">
          {showClear && selectedCategory && (
            <button
              type="button"
              onClick={handleClear}
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
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleSelect(category)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-left transition-colors ${
                value === category.id
                  ? 'bg-teal-50 dark:bg-teal-900/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span
                className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                style={{ backgroundColor: `${category.color}20` }}
              >
                {category.emoji}
              </span>
              <span className="truncate text-slate-700 dark:text-slate-200">
                {category.name}
              </span>
              {value === category.id && (
                <span
                  className="ml-auto w-2 h-2 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact pill version for displaying category on events
export function CategoryPill({ categoryId, className = '' }: { categoryId: string | null; className?: string }) {
  const { getCategory } = useCategories()
  const category = categoryId ? getCategory(categoryId) : null

  if (!category) return null

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${className}`}
      style={{
        backgroundColor: `${category.color}20`,
        color: category.color,
      }}
    >
      <span>{category.emoji}</span>
      <span>{category.name}</span>
    </span>
  )
}
