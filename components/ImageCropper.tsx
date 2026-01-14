'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Check, X, RotateCcw } from 'lucide-react'
import Modal from './ui/Modal'
import { useTranslation } from '@/lib/i18n-context'

interface ImageCropperProps {
  isOpen: boolean
  imageSrc: string
  onClose: () => void
  onCrop: (croppedBlob: Blob) => void
}

interface CropArea {
  x: number
  y: number
  size: number
}

export default function ImageCropper({ isOpen, imageSrc, onClose, onCrop }: ImageCropperProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, size: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeCorner, setResizeCorner] = useState<string | null>(null)

  const CROP_OUTPUT_SIZE = 256 // Output size in pixels
  const MIN_CROP_SIZE = 50

  // Load image when src changes
  useEffect(() => {
    if (!imageSrc) return

    const img = new Image()
    img.onload = () => {
      setImage(img)

      // Calculate display size to fit in container (max 400px)
      const maxSize = 400
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const width = img.width * scale
      const height = img.height * scale
      setDisplaySize({ width, height })

      // Initialize crop area centered, as large as possible (square)
      const initialSize = Math.min(width, height) * 0.8
      setCropArea({
        x: (width - initialSize) / 2,
        y: (height - initialSize) / 2,
        size: initialSize,
      })
    }
    img.src = imageSrc
  }, [imageSrc])

  const getEventPosition = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
    }
    return { clientX: e.clientX, clientY: e.clientY }
  }

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const { clientX, clientY } = getEventPosition(e)
    setIsDragging(true)
    setDragStart({ x: clientX - cropArea.x, y: clientY - cropArea.y })
  }, [cropArea])

  const handleResizeStart = useCallback((corner: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const { clientX, clientY } = getEventPosition(e)
    setIsResizing(true)
    setResizeCorner(corner)
    setDragStart({ x: clientX, y: clientY })
  }, [])

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging && !isResizing) return
    e.preventDefault()

    const { clientX, clientY } = getEventPosition(e)

    if (isDragging) {
      const newX = clientX - dragStart.x
      const newY = clientY - dragStart.y

      setCropArea(prev => ({
        ...prev,
        x: Math.max(0, Math.min(displaySize.width - prev.size, newX)),
        y: Math.max(0, Math.min(displaySize.height - prev.size, newY)),
      }))
    }

    if (isResizing && resizeCorner) {
      const deltaX = clientX - dragStart.x
      const deltaY = clientY - dragStart.y

      setCropArea(prev => {
        let newSize = prev.size
        let newX = prev.x
        let newY = prev.y

        // Calculate size change based on which corner
        if (resizeCorner.includes('e')) {
          newSize = Math.max(MIN_CROP_SIZE, prev.size + deltaX)
        } else if (resizeCorner.includes('w')) {
          const sizeDelta = -deltaX
          newSize = Math.max(MIN_CROP_SIZE, prev.size + sizeDelta)
          if (newSize !== prev.size) {
            newX = prev.x - (newSize - prev.size)
          }
        }

        if (resizeCorner.includes('s')) {
          newSize = Math.max(MIN_CROP_SIZE, Math.max(newSize, prev.size + deltaY))
        } else if (resizeCorner.includes('n')) {
          const sizeDelta = -deltaY
          const potentialSize = Math.max(MIN_CROP_SIZE, prev.size + sizeDelta)
          if (potentialSize > newSize) {
            newSize = potentialSize
            newY = prev.y - (newSize - prev.size)
          }
        }

        // Keep square and constrain to bounds
        newSize = Math.min(newSize, displaySize.width - newX, displaySize.height - newY)
        newX = Math.max(0, newX)
        newY = Math.max(0, newY)

        if (newX + newSize > displaySize.width) newSize = displaySize.width - newX
        if (newY + newSize > displaySize.height) newSize = displaySize.height - newY

        return { x: newX, y: newY, size: newSize }
      })

      setDragStart({ x: clientX, y: clientY })
    }
  }, [isDragging, isResizing, dragStart, displaySize, resizeCorner])

  const handleEnd = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeCorner(null)
  }, [])

  const handleReset = () => {
    const initialSize = Math.min(displaySize.width, displaySize.height) * 0.8
    setCropArea({
      x: (displaySize.width - initialSize) / 2,
      y: (displaySize.height - initialSize) / 2,
      size: initialSize,
    })
  }

  const handleCrop = useCallback(() => {
    if (!image) return

    const canvas = document.createElement('canvas')
    canvas.width = CROP_OUTPUT_SIZE
    canvas.height = CROP_OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate actual image coordinates from display coordinates
    const scaleX = image.width / displaySize.width
    const scaleY = image.height / displaySize.height

    const sourceX = cropArea.x * scaleX
    const sourceY = cropArea.y * scaleY
    const sourceSize = cropArea.size * Math.max(scaleX, scaleY)

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      CROP_OUTPUT_SIZE,
      CROP_OUTPUT_SIZE
    )

    canvas.toBlob((blob) => {
      if (blob) {
        onCrop(blob)
      }
    }, 'image/jpeg', 0.9)
  }, [image, displaySize, cropArea, onCrop])

  const cornerSize = 20

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('common.edit')} size="lg">
      <div className="flex flex-col items-center">
        {/* Instructions */}
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 text-center">
          {t('imageCropper.instructions')}
        </p>

        {/* Crop area */}
        <div
          ref={containerRef}
          className="relative bg-slate-900 select-none touch-none"
          style={{ width: displaySize.width, height: displaySize.height }}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        >
          {/* Image */}
          {imageSrc && (
            <img
              src={imageSrc}
              alt="Crop preview"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          )}

          {/* Darkened overlay outside crop area */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Top */}
            <div
              className="absolute bg-black/60"
              style={{ top: 0, left: 0, right: 0, height: cropArea.y }}
            />
            {/* Bottom */}
            <div
              className="absolute bg-black/60"
              style={{ top: cropArea.y + cropArea.size, left: 0, right: 0, bottom: 0 }}
            />
            {/* Left */}
            <div
              className="absolute bg-black/60"
              style={{ top: cropArea.y, left: 0, width: cropArea.x, height: cropArea.size }}
            />
            {/* Right */}
            <div
              className="absolute bg-black/60"
              style={{ top: cropArea.y, left: cropArea.x + cropArea.size, right: 0, height: cropArea.size }}
            />
          </div>

          {/* Crop box */}
          <div
            className="absolute border-2 border-white cursor-move"
            style={{
              left: cropArea.x,
              top: cropArea.y,
              width: cropArea.size,
              height: cropArea.size,
            }}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
            </div>

            {/* Corner handles */}
            {['nw', 'ne', 'sw', 'se'].map(corner => (
              <div
                key={corner}
                className="absolute w-5 h-5 bg-white border-2 border-teal-500 rounded-sm cursor-nwse-resize"
                style={{
                  left: corner.includes('w') ? -10 : 'auto',
                  right: corner.includes('e') ? -10 : 'auto',
                  top: corner.includes('n') ? -10 : 'auto',
                  bottom: corner.includes('s') ? -10 : 'auto',
                  cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                }}
                onMouseDown={(e) => handleResizeStart(corner, e)}
                onTouchStart={(e) => handleResizeStart(corner, e)}
              />
            ))}

            {/* Circular preview overlay */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.5)',
              }}
            />
          </div>
        </div>

        {/* Size indicator */}
        <p className="text-xs text-slate-400 mt-2">
          {Math.round(cropArea.size)} x {Math.round(cropArea.size)} px
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 mt-4 w-full max-w-sm">
          <button
            onClick={handleReset}
            className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium"
          >
            <X className="w-5 h-5" />
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCrop}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors font-medium"
          >
            <Check className="w-5 h-5" />
            {t('common.apply')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
