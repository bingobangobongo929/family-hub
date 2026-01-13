'use client'

import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Photo {
  id: string
  baseUrl: string
  width: number
  height: number
  creationTime?: string
  description?: string
}

interface PhotoLightboxProps {
  photos: Photo[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate: (index: number) => void
}

export default function PhotoLightbox({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const [mounted, setMounted] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          onNavigate((currentIndex - 1 + photos.length) % photos.length)
          break
        case 'ArrowRight':
          onNavigate((currentIndex + 1) % photos.length)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate])

  // Lock body scroll when open
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

  // Reset loading state when photo changes
  useEffect(() => {
    setImageLoading(true)
  }, [currentIndex])

  // Touch handlers for swipe navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStart === null) return

    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd

    // Swipe threshold of 50px
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left - next photo
        onNavigate((currentIndex + 1) % photos.length)
      } else {
        // Swipe right - previous photo
        onNavigate((currentIndex - 1 + photos.length) % photos.length)
      }
    }

    setTouchStart(null)
  }, [touchStart, currentIndex, photos.length, onNavigate])

  if (!isOpen || !mounted) return null

  const currentPhoto = photos[currentIndex]
  if (!currentPhoto) return null

  // Get high-res URL
  const getPhotoUrl = (photo: Photo) => {
    return `${photo.baseUrl}=w1920-h1080`
  }

  const lightboxContent = (
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Photo counter */}
      <div className="absolute top-4 left-4 px-4 py-2 rounded-full bg-white/10 text-white text-sm">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Previous button */}
      {photos.length > 1 && (
        <button
          onClick={() => onNavigate((currentIndex - 1 + photos.length) % photos.length)}
          className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Next button */}
      {photos.length > 1 && (
        <button
          onClick={() => onNavigate((currentIndex + 1) % photos.length)}
          className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Loading indicator */}
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-white/50 animate-spin" />
        </div>
      )}

      {/* Photo */}
      <img
        src={getPhotoUrl(currentPhoto)}
        alt={currentPhoto.description || 'Photo'}
        className={`max-w-[90vw] max-h-[85vh] object-contain transition-opacity duration-300 ${
          imageLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setImageLoading(false)}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Caption */}
      {currentPhoto.description && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-white/10 text-white text-sm max-w-[80vw] text-center">
          {currentPhoto.description}
        </div>
      )}

      {/* Click backdrop to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  )

  return createPortal(lightboxContent, document.body)
}
