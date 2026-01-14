'use client'

import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full'
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  // Mobile-first sizing: full width on mobile, constrained on larger screens
  const sizeClasses = {
    sm: 'max-w-[calc(100vw-2rem)] sm:max-w-sm',
    md: 'max-w-[calc(100vw-2rem)] sm:max-w-md',
    lg: 'max-w-[calc(100vw-2rem)] sm:max-w-lg',
    xl: 'max-w-[calc(100vw-2rem)] sm:max-w-xl',
    '2xl': 'max-w-[calc(100vw-2rem)] sm:max-w-2xl',
    '3xl': 'max-w-[calc(100vw-2rem)] sm:max-w-3xl',
    '4xl': 'max-w-[calc(100vw-2rem)] sm:max-w-4xl',
    full: 'max-w-[calc(100vw-2rem)]',
  }

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${sizeClasses[size]} bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up sm:animate-scale-in max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col safe-bottom`}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors touch-target tap-highlight"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-4 overflow-y-auto flex-1 overscroll-contain">{children}</div>
      </div>
    </div>
  )

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body)
}
