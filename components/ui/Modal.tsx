'use client'

import { ReactNode, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { hapticTap } from '@/lib/haptics'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full'
  /** Enable glassmorphism effect (translucent background with blur) */
  glass?: boolean
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', glass = false }: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setIsClosing(false)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    hapticTap()
    setIsClosing(true)
    // Wait for animation to complete before closing
    setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 200)
  }, [onClose])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, handleClose])

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

  // Glassmorphism styles
  const glassStyles = glass
    ? 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl backdrop-saturate-150 border border-white/20 dark:border-slate-700/50'
    : 'bg-white dark:bg-slate-800'

  const overlayAnimation = isClosing ? 'animate-fade-out' : 'animate-fade-in'
  const modalAnimation = isClosing
    ? 'animate-spring-out sm:animate-scale-out'
    : 'animate-spring-in sm:animate-modal-in'

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop with blur */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-md ${overlayAnimation} motion-reduce:animate-none`}
        onClick={handleClose}
      />

      {/* Modal container */}
      <div
        className={`relative w-full ${sizeClasses[size]} ${glassStyles} rounded-t-3xl sm:rounded-2xl shadow-2xl ${modalAnimation} motion-reduce:animate-fade-in max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col safe-bottom`}
        style={{
          // Extra shadow for depth
          boxShadow: glass
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Drag indicator for mobile */}
        <div className="sm:hidden flex justify-center pt-2 pb-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {title && (
          <div className={`flex items-center justify-between p-4 border-b ${glass ? 'border-slate-200/50 dark:border-slate-700/50' : 'border-slate-200 dark:border-slate-700'} flex-shrink-0 no-select-interactive`}>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
            <button
              onClick={handleClose}
              aria-label="Close modal"
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all active:scale-95 touch-target tap-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div
          className="p-4 overflow-y-auto flex-1 overscroll-contain"
          style={{
            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body)
}
